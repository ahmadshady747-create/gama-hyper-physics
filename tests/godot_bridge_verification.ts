import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listArchetypes, scaffoldArchetype } from '../src/godot/archetypes';
import { composeFullGameFlow } from '../src/godot/game_flow_composer';
import { balanceGameplayParameters } from '../src/godot/gameplay_balancer';
import {
  auditGdScript,
  autoFixGdScript,
  getAuditorRuleCount,
} from '../src/godot/gdscript_auditor';
import { configureInputAction } from '../src/godot/input_configurator';
import { generateProceduralGridLevel } from '../src/godot/level_grid_generator';
import { auditExportPresets, auditProjectHealth } from '../src/godot/project_auditor';
import { listProjectFiles } from '../src/godot/runner';
import { auditGdShader, generateGdShaderPreset } from '../src/godot/shader_generator';
import { generateThemeResource } from '../src/godot/theme_generator';
import { TOOLS } from '../src/mcp/godot_mcp_server';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`GAMA-Godot4 Verification Failed: ${msg}`);
}

function main(): void {
  const cwd = process.cwd();
  const projectDir = resolve(cwd, 'godot_project');

  // 1. Verify MCP Server remains lean at 23 tools, 28 GDScript 4 rules, and 5 game archetypes
  assert(TOOLS.length === 23, `Expected 23 MCP tools, got ${TOOLS.length}`);
  assert(
    getAuditorRuleCount() === 28,
    `Expected 28 GDScript 4 auditor rules, got ${getAuditorRuleCount()}`
  );
  const archetypes = listArchetypes();
  assert(archetypes.length === 5, `Expected 5 game archetypes, got ${archetypes.length}`);

  // 2. Verify expanded 28-rule GDScript 4 auditor & auto-healer (str2var/var2str, Directory.new(), await .connect())
  const legacyGd = [
    'extends KinematicBody2D',
    'export var speed: float = 200.0',
    'var health: int = 100 setget _set_hp',
    'var pts: PoolVector2Array = PoolVector2Array()',
    'signal hit_taken(dmg)',
    'func _ready() -> void:',
    '\tvar tw = Tween.new()',
    '\tvar dir = Directory.new()',
    '\tvar parsed = str2var("{}")',
    '\tvar now = OS.get_ticks_msec()',
    '\tawait hit_taken.connect(_on_hit)',
    '\temit_signal("hit_taken", 10)',
    'func _process(delta: float) -> void:',
    '\tvar tex = load("res://icon.svg")',
    '\tvar lbl = $HudLabel',
    '\tprint(delta)',
  ].join('\n');

  const rawAudit = auditGdScript(legacyGd);
  const rawCodes = new Set(rawAudit.issues.map((i) => i.code));
  assert(rawCodes.has('GD3_STR2VAR'), 'Should detect Godot 3 str2var()');
  assert(rawCodes.has('GD3_DIRECTORY_API'), 'Should detect Godot 3 Directory.new()');
  assert(rawCodes.has('GD4_AWAIT_CONNECT'), 'Should detect awaiting .connect()');
  assert(rawCodes.has('GD3_POOL_ARRAY'), 'Should detect Godot 3 Pool*Array');
  assert(rawCodes.has('GD3_SETGET'), 'Should detect Godot 3 setget syntax');
  assert(rawCodes.has('GD3_TWEEN_NODE'), 'Should detect Tween.new()');
  assert(rawCodes.has('GD3_OS_TIME'), 'Should detect OS.get_ticks_msec()');
  assert(rawCodes.has('GD3_EMIT_SIGNAL_CALL'), 'Should detect string-based emit_signal()');
  assert(rawCodes.has('GD4_UNTYPED_SIGNAL_PARAM'), 'Should detect untyped signal parameter');
  assert(rawCodes.has('GD4_PERF_ALLOC_IN_PROCESS'), 'Should detect disk load() inside _process()');
  assert(rawCodes.has('GD4_PERF_NODE_LOOKUP_IN_PROCESS'), 'Should detect $Node lookup inside _process()');
  assert(rawCodes.has('GD4_PERF_PRINT_IN_PROCESS'), 'Should detect print() inside _process()');

  const healed = autoFixGdScript(
    [
      'extends KinematicBody2D',
      'export var speed: float = 200.0',
      'var pts: PoolVector2Array = PoolVector2Array()',
      'signal hit_taken(dmg: int)',
      'func _ready() -> void:',
      '\tvar tw: Tween = Tween.new()',
      '\tvar parsed: Variant = str2var("{}")',
      '\tvar now: int = OS.get_ticks_msec()',
      '\temit_signal("hit_taken", 10)',
    ].join('\n')
  );
  assert(
    healed.audit.valid && healed.audit.warningCount === 0,
    `Healed script should pass GDScript 4 audit with 0 errors and 0 warnings, got: ${JSON.stringify(healed.audit.issues)}`
  );
  assert(
    healed.fixedCode.includes('PackedVector2Array') && healed.fixedCode.includes('str_to_var('),
    'Auto-healer should rewrite PoolVector2Array and str2var()'
  );

  // 3. Verify .gdshader generator, .tres UI Theme Generator, 11-symbol 2D & 3D Grid Level Generator & InputMap
  generateGdShaderPreset(projectDir, {
    presetId: 'neon_pulse_canvas',
    relativePath: 'shaders/neon_pulse.gdshader',
  });
  generateGdShaderPreset(projectDir, {
    presetId: 'hologram_spatial_3d',
    relativePath: 'shaders/hologram_3d.gdshader',
  });
  const shAudit = auditGdShader(projectDir, 'shaders/neon_pulse.gdshader');
  assert(shAudit.valid && shAudit.shaderType === 'canvas_item', 'Shader audit should pass');

  generateThemeResource(projectDir, {
    relativePath: 'themes/cyber_neon.tres',
    primaryColorHex: '#00E5C4',
    panelBgColorHex: '#0A101E',
  });
  generateProceduralGridLevel(projectDir, {
    levelName: 'GridBossStage2D',
    dimension: '2D',
    relativePath: 'scenes/grid_stage_2d.tscn',
    gridRows: ['P.C.H.B.L.D.E.T.K.G'],
  });
  generateProceduralGridLevel(projectDir, {
    levelName: 'GridBossArena3D',
    dimension: '3D',
    relativePath: 'scenes/grid_arena_3d.tscn',
    gridRows: ['P.C.H.B.L.D.E.T.S.K.G'],
  });
  configureInputAction(projectDir, { actionName: 'dash', keys: ['SHIFT', 'Q'] });

  // 4. Scaffold all 5 2D & 3D archetypes and compose full game flows
  for (const arch of archetypes) {
    scaffoldArchetype(projectDir, arch.id);
  }
  composeFullGameFlow(projectDir, {
    gameTitle: 'GAMA TwinStick Cyber 2D',
    archetypeId: 'twin_stick_cyber_2d',
    levelSceneRelativePath: 'scenes/composed_stage_2d.tscn',
  });
  composeFullGameFlow(projectDir, {
    gameTitle: 'GAMA Hover Pod Racer 3D',
    archetypeId: 'hover_racer_3d',
    levelSceneRelativePath: 'scenes/composed_arena_3d.tscn',
  });

  // 5. Verify CinemaDirector 3D Focus/Orbit, AudioSynth Chords/Sweeps, and 9-Controller Gameplay Balancer
  const cinemaSrc = readFileSync(
    resolve(projectDir, 'addons/gama_agent/cinema_director.gd'),
    'utf-8'
  );
  assert(
    cinemaSrc.includes('func focus_target_3d(') &&
      cinemaSrc.includes('func orbit_sweep_3d(') &&
      cinemaSrc.includes('signal cutscene_started('),
    'cinema_director.gd must support 3D focus pans, orbital sweeps, and cutscene signals'
  );

  const audioSrc = readFileSync(
    resolve(projectDir, 'addons/gama_agent/audio_synth.gd'),
    'utf-8'
  );
  assert(
    audioSrc.includes('func play_sweep(') &&
      audioSrc.includes('func play_chord(') &&
      audioSrc.includes('func play_powerup_fanfare('),
    'audio_synth.gd must support frequency sweeps, multi-oscillator chords, and semantic SFX presets'
  );

  const balanceRes = balanceGameplayParameters(projectDir, { difficulty: 'standard' });
  assert(
    balanceRes.tunedScripts.length === 9,
    `Expected 9 tuned gameplay controllers, got ${balanceRes.tunedScripts.length}`
  );

  // 6. Verify Export Presets Auditor & Run full static Project Health Audit
  const expAudit = auditExportPresets(projectDir);
  assert(expAudit.valid, `Export preset audit failed: ${JSON.stringify(expAudit)}`);

  const files = listProjectFiles(projectDir);
  const health = auditProjectHealth(projectDir);
  assert(health.ok, `Project health audit failed with ${health.totalErrors} errors`);
  assert(
    health.unreferencedScripts.length === 0,
    `Expected 0 unreferenced scripts, got: ${health.unreferencedScripts.join(', ')}`
  );

  // 7. Audit EVERY bundled & scaffolded .gd script directly (0 errors AND 0 warnings across 28 rules)
  for (const resPath of files.scripts) {
    const abs = resolve(projectDir, resPath.replace(/^res:\/\//, ''));
    const src = readFileSync(abs, 'utf-8');
    const report = auditGdScript(src);
    assert(
      report.valid,
      `Bundled script ${resPath} failed GDScript 4 audit: ${JSON.stringify(report.issues)}`
    );
    assert(
      report.warningCount === 0,
      `Bundled script ${resPath} has ${report.warningCount} warnings: ${JSON.stringify(report.issues)}`
    );
  }

  // 8. Verify package.json v5.19.0
  const pkg = JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf-8')) as {
    version: string;
  };
  assert(pkg.version === '5.19.0', `Expected version 5.19.0, got ${pkg.version}`);

  console.log(
    `[PASS] GAMA-Godot4 AI Studio v5.19.0 verification passed (${TOOLS.length} MCP tools, ${archetypes.length} archetypes, ${getAuditorRuleCount()} GDScript 4 rules, ${health.totalScenes} scenes, ${health.totalScripts} GDScript files with 0 errors and 0 warnings).`
  );
}

main();
