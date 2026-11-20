import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function resolveGodotBinary(): string {
  return process.env.GODOT_BIN || 'godot';
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
        else if (/\.(glb|gltf|png|jpg|wav|ogg|tres)$/i.test(entry)) assets.push(rel);
      }
    }
  };

  walk(projectDir);
  return { scenes: scenes.sort(), scripts: scripts.sort(), assets: assets.sort() };
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
    const jsonLine = out
      .split(/\r?\n/)
      .reverse()
      .find((l) => l.trim().startsWith('{') && l.trim().endsWith('}'));
    if (jsonLine) {
      return JSON.parse(jsonLine) as Record<string, unknown>;
    }
    return { ok: true, rawOutput: out.trim() };
  } catch (err) {
    return {
      ok: false,
      godotBinary: bin,
      error: err instanceof Error ? err.message : String(err),
      hint: 'Install Godot 4.3+ and add `godot` to PATH or set GODOT_BIN=/path/to/godot.',
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
