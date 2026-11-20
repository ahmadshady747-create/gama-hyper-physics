import { writeFileSync } from 'node:fs';
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

function main(): void {
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
  console.log(JSON.stringify({ engine: 'GAMA AI Game Engine v4.0', dimension: dim.toUpperCase(), bodies, steps, totalContacts: contacts, elapsedMs: +elapsedMs.toFixed(2) }, null, 2));
}

main();
