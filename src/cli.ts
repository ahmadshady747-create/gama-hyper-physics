import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createArchetypeGame,
  exportPlayableHtml,
  GameArchetype,
  GamaGameRuntime,
  renderRuntimeToSvg,
} from './game_engine';
import { runHeadlessPlaytest } from './ai_engine';
import { Vec2, Vec3, Vec4 } from './math';
import {
  PhysicsWorld2D,
  RigidBody2D,
  PhysicsWorld3D,
  RigidBody3D,
  PhysicsWorld4D,
  RigidBody4D,
} from './physics';
import { GodotArchetypeId, listArchetypes, scaffoldArchetype } from './godot/archetypes';
import { auditGdScript } from './godot/gdscript_auditor';
import { auditExportPresets, auditProjectHealth } from './godot/project_auditor';
import {
  captureGodotScreenshot,
  checkGodotEnvironment,
  listProjectFiles,
  runGodotHeadlessQa,
} from './godot/runner';

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function parseArg(flag: string, fallback: number): number {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const val = Number(process.argv[idx + 1]);
  return Number.isFinite(val) ? val : fallback;
}

function parseStrArg(flag: string, fallback: string): string {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function runSimCli(): void {
  if (process.argv.includes('--export-demo')) {
    const archetype = parseStrArg('--archetype', 'tower_demolition') as GameArchetype;
    const spec = createArchetypeGame(archetype);
    const html = exportPlayableHtml(spec);
    const outFile = `gama_${archetype}_demo.html`;
    writeFileSync(outFile, html, 'utf-8');
    console.log(`Exported standalone playable HTML5 game to: ${outFile}`);
    return;
  }

  if (process.argv.includes('--snapshot')) {
    const spec = createArchetypeGame('tower_demolition');
    const rt = new GamaGameRuntime(spec);
    for (let i = 0; i < 30; i++) rt.step(1 / 60);
    const svg = renderRuntimeToSvg(rt);
    writeFileSync('gama_snapshot.svg', svg, 'utf-8');
    console.log('Saved headless SVG visual snapshot to: gama_snapshot.svg');
    return;
  }

  if (process.argv.includes('--playtest')) {
    const spec = createArchetypeGame('tower_demolition');
    const stability = runHeadlessPlaytest(spec, { policy: 'stability_check', frames: 120 });
    const attack = runHeadlessPlaytest(spec, { policy: 'launch_towards_target', frames: 180, launchImpulse: 820 });
    console.log(JSON.stringify({ stability, attack }, null, 2));
    return;
  }

  const dim = parseStrArg('--dim', '2d').toLowerCase();
  const bodies = parseArg('--bodies', 50);
  const steps = parseArg('--steps', 200);
  const dt = 1 / 60;
  const t0 = performance.now();
  let contacts = 0;

  if (dim === '3d') {
    const w = new PhysicsWorld3D({ boundsWidth: 800, boundsHeight: 600, boundsDepth: 800 });
    for (let i = 0; i < bodies; i++) {
      w.addBody(new RigidBody3D({ type: i % 2 === 0 ? 'sphere' : 'cube', position: new Vec3((i % 5) * 45 - 90, 120 + i * 10, (i % 3) * 45 - 45), radius: 18, width: 36, height: 36, depth: 36 }));
    }
    for (let s = 0; s < steps; s++) { w.update(dt); contacts += w.getContactCount(); }
  } else if (dim === '4d') {
    const w = new PhysicsWorld4D({ boundsWidth: 800, boundsHeight: 600, boundsDepth: 800, boundsHyperDepth: 800 });
    for (let i = 0; i < bodies; i++) {
      w.addBody(new RigidBody4D({ type: i % 2 === 0 ? 'hypersphere' : 'tesseract', position: new Vec4((i % 4) * 50 - 80, 120 + i * 12, (i % 3) * 50 - 50, (i % 2) * 30), radius: 20, width: 40, height: 40, depth: 40, hyperDepth: 40 }));
    }
    for (let s = 0; s < steps; s++) { w.update(dt); contacts += w.getContactCount(); }
  } else {
    const w = new PhysicsWorld2D({ boundsWidth: 1200, boundsHeight: 800 });
    for (let i = 0; i < bodies; i++) {
      w.addBody(new RigidBody2D({ type: i % 2 === 0 ? 'circle' : 'box', position: new Vec2(120 + (i * 25) % 900, 100 + (i * 18) % 500), radius: 16, width: 32, height: 32 }));
    }
    for (let s = 0; s < steps; s++) { w.update(dt); contacts += w.getContactCount(); }
  }

  const elapsedMs = performance.now() - t0;
  console.log(JSON.stringify({ engine: 'GAMA AI Game Engine v5.19.0', dimension: dim.toUpperCase(), bodies, steps, totalContacts: contacts, elapsedMs: +elapsedMs.toFixed(2) }, null, 2));
}

function runGodotCli(): void {
  const projectDir = resolve(process.cwd(), 'godot_project');
  const [cmd = 'help', arg1, arg2] = process.argv.slice(2);

  switch (cmd) {
    case 'doctor':
      printJson(checkGodotEnvironment());
      break;

    case 'inspect':
      printJson({ projectDir, ...listProjectFiles(projectDir) });
      break;

    case 'audit': {
      const { scripts } = listProjectFiles(projectDir);
      const reports = scripts.map((resPath) => {
        const full = resolve(projectDir, resPath.replace(/^res:\/\//, ''));
        const src = readFileSync(full, 'utf-8');
        return { file: resPath, ...auditGdScript(src) };
      });
      const exportAudit = auditExportPresets(projectDir);
      const allValid = reports.every((r) => r.valid) && exportAudit.valid;
      printJson({ totalScripts: reports.length, allValid, exportAudit, reports });
      if (!allValid) process.exit(1);
      break;
    }

    case 'health':
      printJson(auditProjectHealth(projectDir));
      break;

    case 'archetypes':
      printJson({ archetypes: listArchetypes() });
      break;

    case 'scaffold': {
      const id = (arg1 || 'platformer_2d') as GodotArchetypeId;
      printJson(scaffoldArchetype(projectDir, id, arg2));
      break;
    }

    case 'qa':
      printJson(
        runGodotHeadlessQa(
          projectDir,
          arg1 || 'res://scenes/main.tscn',
          arg2 ? Number(arg2) : 120
        )
      );
      break;

    case 'screenshot':
      printJson(
        captureGodotScreenshot(
          projectDir,
          arg1 || 'res://scenes/main.tscn',
          arg2 ? resolve(projectDir, arg2) : undefined,
          8
        )
      );
      break;

    default:
      printJson({
        cli: 'GAMA-Godot4 AI Studio CLI v5.19.0',
        commands: [
          'gama-godot doctor                         — Verify local Godot 4.3+ installation',
          'gama-godot inspect                        — List all scenes, scripts, and assets',
          'gama-godot audit                          — Audit all GDScript 4 files (28 rules) & export presets',
          'gama-godot health                         — Run full project health & scene ExtResource audit',
          'gama-godot archetypes                     — List available 2D & 3D game archetypes (5 templates)',
          'gama-godot scaffold <id> [customPath]     — Scaffold an archetype into godot_project/',
          'gama-godot qa [sceneResPath] [frames]     — Run headless SceneTree QA telemetry',
          'gama-godot screenshot [sceneResPath] [out]— Capture live OpenGL3 PNG screenshot + pixel diagnostics',
        ],
      });
      break;
  }
}

function printCombinedHelp(): void {
  printJson({
    cli: 'GAMA AI Game Engine CLI v5.19.0',
    godot: [
      'doctor                         — Verify local Godot 4.3+ installation',
      'inspect                        — List all scenes, scripts, and assets',
      'audit                          — Audit all GDScript 4 files (28 rules) & export presets',
      'health                         — Run full project health & scene ExtResource audit',
      'archetypes                     — List available 2D & 3D game archetypes (5 templates)',
      'scaffold <id> [customPath]     — Scaffold an archetype into godot_project/',
      'qa [sceneResPath] [frames]     — Run headless SceneTree QA telemetry',
      'screenshot [sceneResPath] [out]— Capture live OpenGL3 PNG screenshot + pixel diagnostics',
    ],
    simulator: [
      '--dim 2d|3d|4d --bodies 50 --steps 200 — Headless physics benchmark',
      '--playtest                              — Headless bot playtest QA',
      '--snapshot                              — Headless SVG visual snapshot',
      '--export-demo [--archetype id]          — Export standalone playable HTML5 game',
    ],
  });
}

const GODOT_COMMANDS = new Set([
  'doctor',
  'inspect',
  'audit',
  'health',
  'archetypes',
  'scaffold',
  'qa',
  'screenshot',
]);

function main(): void {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'help' || cmd === '--help') {
    printCombinedHelp();
    return;
  }
  if (cmd !== undefined && GODOT_COMMANDS.has(cmd)) {
    runGodotCli();
    return;
  }
  runSimCli();
}

main();
