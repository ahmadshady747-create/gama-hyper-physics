import { resolve } from 'node:path';
import { auditGdScript } from '../src/godot/gdscript_auditor';
import { listProjectFiles } from '../src/godot/runner';
import { generateTscn } from '../src/godot/tscn_generator';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`GAMA-Godot4 Verification Failed: ${msg}`);
}

function main(): void {
  // 1. Verify .tscn generator produces valid Godot 4 format=3 scene
  const tscn = generateTscn({
    rootName: 'Arena',
    rootType: 'Node3D',
    nodes: [
      { name: 'Hero', type: 'CharacterBody3D', position: [0, 1.5, 0], scriptPath: 'res://scripts/demo_player.gd' },
      { name: 'Cam', type: 'Camera3D', position: [0, 6, 12], properties: { current: true } },
    ],
  });
  assert(tscn.includes('[gd_scene load_steps=2 format=3]'), 'Should emit Godot 4 format=3 header');
  assert(tscn.includes('script = ExtResource("1_script")'), 'Should wire script ExtResource');
  assert(tscn.includes('Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 0)'), 'Should emit 3D transform');

  // 2. Verify GDScript 4 auditor catches Godot 3 hallucinations
  const bad = auditGdScript('extends KinematicBody2D\nexport var speed = 5\nfunc f(): yield(get_tree(), "idle_frame")');
  assert(!bad.valid, 'Godot 3 script should fail audit');
  assert(bad.issues.length >= 3, 'Should flag KinematicBody2D, export var, and yield()');

  const good = auditGdScript('extends CharacterBody3D\n@export var speed: float = 5.0\nfunc _ready() -> void:\n\tpass');
  assert(good.valid && good.issues.length === 0, 'Valid GDScript 4 should pass cleanly');

  // 3. Verify bundled godot_project contains starter scenes & autoload scripts
  const files = listProjectFiles(resolve(process.cwd(), 'godot_project'));
  assert(files.scenes.includes('res://scenes/main.tscn'), 'main.tscn should exist');
  assert(files.scripts.includes('res://addons/gama_agent/juice.gd'), 'juice.gd autoload should exist');
  assert(files.scripts.includes('res://addons/gama_agent/audio_synth.gd'), 'audio_synth.gd autoload should exist');
  assert(files.scripts.includes('res://addons/gama_agent/agent_qa_runner.gd'), 'agent_qa_runner.gd should exist');

  console.log('[PASS] GAMA-Godot4 AI Studio v5.0 verification passed.');
}

main();
