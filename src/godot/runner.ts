import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

export function resolveGodotBinary(): string {
  return process.env.GODOT_BIN || 'godot';
}

export function checkGodotEnvironment(): Record<string, unknown> {
  const bin = resolveGodotBinary();
  try {
    const version = execFileSync(bin, ['--version'], {
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    const isGodot4 = /^4\./.test(version);
    return {
      ok: isGodot4,
      godotBinary: bin,
      version,
      isGodot4,
      hint: isGodot4
        ? 'Godot 4 runtime detected and ready.'
        : 'Detected Godot binary is not 4.x; install Godot 4.3+.',
    };
  } catch (err) {
    return {
      ok: false,
      godotBinary: bin,
      version: null,
      isGodot4: false,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Install Godot 4.3+ from godotengine.org and add `godot` to PATH or set GODOT_BIN.',
    };
  }
}

export function listProjectFiles(projectDir: string): {
  scenes: string[];
  scripts: string[];
  assets: string[];
} {
  const scenes: string[] = [];
  const scripts: string[] = [];
  const assets: string[] = [];

  if (!existsSync(projectDir)) return { scenes, scripts, assets };

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith('.godot')) continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
      } else {
        const rel = `res://${relative(projectDir, full).replace(/\\/g, '/')}`;
        if (entry.endsWith('.tscn')) scenes.push(rel);
        else if (entry.endsWith('.gd')) scripts.push(rel);
        else if (/\.(glb|gltf|png|jpg|wav|ogg|tres|gdshader)$/i.test(entry)) assets.push(rel);
      }
    }
  };

  walk(projectDir);
  return { scenes: scenes.sort(), scripts: scripts.sort(), assets: assets.sort() };
}

function parseLastJsonLine(stdout: string): Record<string, unknown> | null {
  const jsonLine = stdout
    .split(/\r?\n/)
    .reverse()
    .find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
  if (!jsonLine) return null;
  try {
    return JSON.parse(jsonLine) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function runGodotHeadlessQa(
  projectDir: string,
  sceneResPath: string = 'res://scenes/main.tscn',
  frames: number = 120
): Record<string, unknown> {
  const bin = resolveGodotBinary();
  try {
    const out = execFileSync(
      bin,
      [
        '--headless',
        '--path',
        projectDir,
        '--script',
        'res://addons/gama_agent/agent_qa_runner.gd',
        '--',
        `--scene=${sceneResPath}`,
        `--frames=${frames}`,
      ],
      { encoding: 'utf-8', timeout: 30000 }
    );
    const parsed = parseLastJsonLine(out);
    return parsed ?? { ok: true, rawOutput: out.trim() };
  } catch (err) {
    return {
      ok: false,
      godotBinary: bin,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Install Godot 4.3+ and add `godot` to PATH or set GODOT_BIN=/path/to/godot.',
    };
  }
}

export function runGodotPlaytestBot(
  projectDir: string,
  sceneResPath: string = 'res://scenes/main.tscn',
  frames: number = 180,
  profile: string = 'explorer'
): Record<string, unknown> {
  const bin = resolveGodotBinary();
  try {
    const out = execFileSync(
      bin,
      [
        '--headless',
        '--path',
        projectDir,
        '--script',
        'res://addons/gama_agent/agent_playtest_bot.gd',
        '--',
        `--scene=${sceneResPath}`,
        `--frames=${Math.max(10, Math.floor(frames))}`,
        `--profile=${profile}`,
      ],
      { encoding: 'utf-8', timeout: 30000 }
    );
    const parsed = parseLastJsonLine(out);
    return parsed ?? { ok: true, rawOutput: out.trim() };
  } catch (err) {
    return {
      ok: false,
      godotBinary: bin,
      scene: sceneResPath,
      profile,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Install Godot 4.3+ and add `godot` to PATH or set GODOT_BIN=/path/to/godot.',
    };
  }
}

export interface ScreenshotCaptureResult extends Record<string, unknown> {
  ok: boolean;
  scene: string;
  outputPath: string;
  width?: number;
  height?: number;
  framesStepped?: number;
  activeCamera?: string;
  avgLuminance?: number;
  nonBlackRatio?: number;
  isBlankScreen?: boolean;
  base64Png?: string;
  error?: string;
  hint?: string;
}

export function captureGodotScreenshot(
  projectDir: string,
  sceneResPath: string = 'res://scenes/main.tscn',
  outputPath?: string,
  frames: number = 8,
  width?: number,
  height?: number
): ScreenshotCaptureResult {
  const bin = resolveGodotBinary();
  const absOutput = resolve(
    outputPath ?? join(projectDir, '.gama_captures', 'capture.png')
  );
  mkdirSync(dirname(absOutput), { recursive: true });

  const userArgs = [
    `--scene=${sceneResPath}`,
    `--output=${absOutput}`,
    `--frames=${Math.max(2, Math.floor(frames))}`,
  ];
  if (width && width >= 320) userArgs.push(`--width=${Math.floor(width)}`);
  if (height && height >= 180) userArgs.push(`--height=${Math.floor(height)}`);

  try {
    const out = execFileSync(
      bin,
      [
        '--rendering-driver',
        'opengl3',
        '--path',
        projectDir,
        '--script',
        'res://addons/gama_agent/agent_screenshot.gd',
        '--',
        ...userArgs,
      ],
      { encoding: 'utf-8', timeout: 30000 }
    );
    const parsed = parseLastJsonLine(out);
    const ok = Boolean(parsed?.ok) && existsSync(absOutput);
    const base64Png = ok ? readFileSync(absOutput).toString('base64') : undefined;
    return {
      ok,
      scene: sceneResPath,
      outputPath: absOutput,
      ...(parsed ?? {}),
      ...(base64Png ? { base64Png } : {}),
    };
  } catch (err) {
    return {
      ok: false,
      scene: sceneResPath,
      outputPath: absOutput,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Requires Godot 4.3+ with OpenGL 3 display context (on headless Linux, wrap with xvfb-run).',
    };
  }
}

export function exportGodotBuild(
  projectDir: string,
  preset: string,
  outputPath: string
): Record<string, unknown> {
  const bin = resolveGodotBinary();
  try {
    const out = execFileSync(
      bin,
      ['--headless', '--path', projectDir, '--export-release', preset, outputPath],
      { encoding: 'utf-8', timeout: 120000 }
    );
    return { ok: true, preset, outputPath, log: out.trim() };
  } catch (err) {
    return {
      ok: false,
      preset,
      outputPath,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Ensure Godot 4.3+ and matching export templates are installed locally.',
    };
  }
}
