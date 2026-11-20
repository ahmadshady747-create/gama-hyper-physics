import {
  createArchetypeGame,
  exportPlayableHtml,
  GamaGameRuntime,
  renderRuntimeToSvg,
} from '../src/game_engine';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`GAMA Game Engine v4 Verification Failed: ${msg}`);
}

export function runGameEngineV4Verification(): void {
  // 1. All 4 archetypes generate valid, runnable games
  const archetypes = [
    'tower_demolition',
    'arena_survivor',
    'physics_platformer',
    'pinball_breakout',
  ] as const;

  for (const arch of archetypes) {
    const spec = createArchetypeGame(arch);
    const rt = new GamaGameRuntime(spec);
    rt.step(1 / 60, { moveX: 0.5, action: true, launchDirX: 1, launchDirY: -0.4, launchPower: 750 });
    assert(rt.frame === 1, `Archetype ${arch} should step to frame 1`);
  }

  // 2. Headless SVG visual snapshot renders valid SVG with HUD & entities
  const towerSpec = createArchetypeGame('tower_demolition', 'Unit Test Tower');
  const rt = new GamaGameRuntime(towerSpec);
  for (let i = 0; i < 20; i++) rt.step(1 / 60);
  const svg = renderRuntimeToSvg(rt);
  assert(svg.startsWith('<svg') && svg.includes('Unit Test Tower'), 'SVG snapshot should include title and root tag');
  assert(svg.includes('cannonball'), 'SVG snapshot should label entity IDs');

  // 3. Standalone playable HTML5 exporter produces complete offline game
  const html = exportPlayableHtml(towerSpec);
  assert(html.includes('<!DOCTYPE html>') && html.includes('<canvas'), 'Exported HTML should contain playable canvas');
  assert(html.includes('Unit Test Tower'), 'Exported HTML should embed game title');

  console.log('[PASS] GAMA Game Engine v4.0 verification passed (4 Archetypes, Stateful Runtime, SVG Snapshot, HTML5 Exporter).');
}

runGameEngineV4Verification();
