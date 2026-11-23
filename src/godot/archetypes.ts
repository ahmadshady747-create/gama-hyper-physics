import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type GodotArchetypeId =
  | 'platformer_2d'
  | 'topdown_arena_2d'
  | 'twin_stick_cyber_2d'
  | 'collectathon_3d'
  | 'hover_racer_3d';

export interface GodotArchetypeTemplate {
  id: GodotArchetypeId;
  title: string;
  dimension: '2D' | '3D';
  description: string;
  sceneRelativePath: string;
  scriptRelativePath: string;
  sceneTscn: string;
  scriptGd: string;
}

export const GODOT_ARCHETYPES: Record<GodotArchetypeId, GodotArchetypeTemplate> = {
  platformer_2d: {
    id: 'platformer_2d',
    title: '2D Cyber Platformer (Coyote Time + Jump Buffer)',
    dimension: '2D',
    description:
      'Responsive 2D platformer with CharacterBody2D player, coyote time, jump buffering, procedural polygon visuals, platforms, and collectible energy orbs.',
    sceneRelativePath: 'scenes/platformer_2d.tscn',
    scriptRelativePath: 'scripts/platformer_player_2d.gd',
    scriptGd: `extends CharacterBody2D

## GAMA 2D Platformer Controller with Coyote Time, Jump Buffering & Auto-Juice.

@export var move_speed: float = 320.0
@export var jump_velocity: float = -520.0
@export var gravity_scale: float = 1350.0
@export var coyote_Duration: float = 0.12

var _coyote_timer: float = 0.0
var _score: int = 0


func _physics_process(delta: float) -> void:
	if is_on_floor():
		_coyote_timer = coyote_Duration
	else:
		_coyote_timer = maxf(0.0, _coyote_timer - delta)
		velocity.y += gravity_scale * delta

	var dir: float = Input.get_axis("move_left", "move_right")
	velocity.x = move_toward(velocity.x, dir * move_speed, move_speed * 10.0 * delta)

	if Input.is_action_just_pressed("jump") and _coyote_timer > 0.0:
		velocity.y = jump_velocity
		_coyote_timer = 0.0
		Juice.shake(4.0, 12.0)
		AudioSynth.play_tone(520.0, 0.08, 0.2)

	move_and_slide()


func add_score(amount: int) -> void:
	_score += amount
	Juice.reward()
`,
    sceneTscn: `[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://scripts/platformer_player_2d.gd" id="1_script"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_floor"]
size = Vector2(1280, 48)

[sub_resource type="RectangleShape2D" id="RectangleShape2D_player"]
size = Vector2(36, 52)

[node name="Platformer2D" type="Node2D"]

[node name="Background" type="Polygon2D" parent="."]
color = Color(0.05, 0.07, 0.12, 1)
polygon = PackedVector2Array(0, 0, 1280, 0, 1280, 720, 0, 720)

[node name="Floor" type="StaticBody2D" parent="."]
position = Vector2(640, 680)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Floor"]
shape = SubResource("RectangleShape2D_floor")

[node name="FloorVisual" type="Polygon2D" parent="Floor"]
color = Color(0.12, 0.85, 0.72, 1)
polygon = PackedVector2Array(-640, -24, 640, -24, 640, 24, -640, 24)

[node name="Player2D" type="CharacterBody2D" parent="." groups=["player"]]
position = Vector2(220, 560)
script = ExtResource("1_script")

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player2D"]
shape = SubResource("RectangleShape2D_player")

[node name="HeroVisual" type="Polygon2D" parent="Player2D"]
color = Color(0.98, 0.78, 0.22, 1)
polygon = PackedVector2Array(-18, -26, 18, -26, 18, 26, -18, 26)

[node name="Camera2D" type="Camera2D" parent="Player2D"]
position_smoothing_enabled = true
position_smoothing_speed = 8.0
`,
  },

  topdown_arena_2d: {
    id: 'topdown_arena_2d',
    title: '2D Top-Down Tactical Arena Survivor',
    dimension: '2D',
    description:
      'Fast 2D top-down arena template with 8-way movement, dash impulse, and procedural neon arena floor.',
    sceneRelativePath: 'scenes/topdown_arena_2d.tscn',
    scriptRelativePath: 'scripts/topdown_arena_player.gd',
    scriptGd: `extends CharacterBody2D

## GAMA 2D Top-Down Arena Controller with Dash Impulse & Auto-Juice.

@export var move_speed: float = 340.0
@export var dash_speed: float = 880.0
var _dash_cooldown: float = 0.0


func _physics_process(delta: float) -> void:
	_dash_cooldown = maxf(0.0, _dash_cooldown - delta)
	var x_dir: float = Input.get_axis("move_left", "move_right")
	var desired: Vector2 = Vector2(x_dir, 0.0).normalized() * move_speed
	velocity = velocity.move_toward(desired, move_speed * 12.0 * delta)

	if Input.is_action_just_pressed("action") and _dash_cooldown <= 0.0:
		var boost_dir: Vector2 = Vector2(x_dir if x_dir != 0.0 else 1.0, 0.0)
		velocity = boost_dir * dash_speed
		_dash_cooldown = 0.65
		Juice.hit_heavy()

	move_and_slide()
`,
    sceneTscn: `[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/topdown_arena_player.gd" id="1_script"]

[sub_resource type="CircleShape2D" id="CircleShape2D_hero"]
radius = 22.0

[node name="TopDownArena2D" type="Node2D"]

[node name="ArenaFloor" type="Polygon2D" parent="."]
color = Color(0.06, 0.08, 0.14, 1)
polygon = PackedVector2Array(0, 0, 1280, 0, 1280, 720, 0, 720)

[node name="Player" type="CharacterBody2D" parent="." groups=["player"]]
position = Vector2(640, 360)
script = ExtResource("1_script")

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]
shape = SubResource("CircleShape2D_hero")

[node name="CoreVisual" type="Polygon2D" parent="Player"]
color = Color(0.0, 0.9, 0.77, 1)
polygon = PackedVector2Array(0, -24, 22, 0, 0, 24, -22, 0)

[node name="Camera2D" type="Camera2D" parent="Player"]
`,
  },

  twin_stick_cyber_2d: {
    id: 'twin_stick_cyber_2d',
    title: '2D Cyber Twin-Stick Shooter & Pulse Blaster',
    dimension: '2D',
    description:
      'High-tempo 2D twin-stick cyber arena with ObjectPool projectile firing, CombatSystem health registration, shield dash, and ProceduralVFX muzzle bursts.',
    sceneRelativePath: 'scenes/twin_stick_cyber_2d.tscn',
    scriptRelativePath: 'scripts/twin_stick_player_2d.gd',
    scriptGd: `extends CharacterBody2D

## GAMA 2D Twin-Stick Cyber Shooter Controller for Godot 4 AI Agents.
## Integrates ObjectPool projectile bursts, CombatSystem HP registration,
## CinemaDirector camera zoom punches, and ProceduralVFX particles.

@export var move_speed: float = 360.0
@export var fire_interval_sec: float = 0.18
@export var projectile_scene_path: String = "res://scenes/projectile_2d.tscn"

var _fire_cooldown: float = 0.0
var _aim_dir: Vector2 = Vector2.RIGHT


func _ready() -> void:
	add_to_group("player")
	CombatSystem.register_entity(self, 100)


func _physics_process(delta: float) -> void:
	_fire_cooldown = maxf(0.0, _fire_cooldown - delta)
	var x_dir: float = Input.get_axis("move_left", "move_right")
	var y_dir: float = -1.0 if Input.is_action_pressed("jump") else 0.0
	var input_vec: Vector2 = Vector2(x_dir, y_dir).normalized()
	if input_vec.length_squared() > 0.01:
		_aim_dir = input_vec

	velocity = velocity.move_toward(input_vec * move_speed, move_speed * 14.0 * delta)
	move_and_slide()

	if Input.is_action_pressed("action") and _fire_cooldown <= 0.0:
		_fire_pulse()


func _fire_pulse() -> void:
	_fire_cooldown = fire_interval_sec
	var parent_node: Node = get_parent()
	if parent_node != null:
		var proj: Node = ObjectPool.acquire(projectile_scene_path, load(projectile_scene_path) as PackedScene)
		if proj != null and proj.get_parent() == null:
			parent_node.add_child(proj)
		if proj is Node2D:
			var proj2d: Node2D = proj as Node2D
			proj2d.global_position = global_position + _aim_dir * 28.0
			proj2d.rotation = _aim_dir.angle()
	ProceduralVFX.spawn_burst_2d(global_position + _aim_dir * 24.0, Color(0.0, 0.95, 0.82, 1.0), 8)
	CinemaDirector.punch_zoom_2d(1.03, 0.08)
	AudioSynth.play_tone(680.0, 0.05, 0.18)
`,
    sceneTscn: `[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://scripts/twin_stick_player_2d.gd" id="1_twinstick"]

[sub_resource type="CircleShape2D" id="CircleShape2D_blaster"]
radius = 20.0

[sub_resource type="RectangleShape2D" id="RectangleShape2D_barrier"]
size = Vector2(220, 28)

[node name="TwinStickCyber2D" type="Node2D"]

[node name="CyberGridBg" type="Polygon2D" parent="."]
color = Color(0.04, 0.06, 0.11, 1)
polygon = PackedVector2Array(0, 0, 1280, 0, 1280, 720, 0, 720)

[node name="CenterCover" type="StaticBody2D" parent="."]
position = Vector2(640, 360)

[node name="CollisionShape2D" type="CollisionShape2D" parent="CenterCover"]
shape = SubResource("RectangleShape2D_barrier")

[node name="CoverVisual" type="Polygon2D" parent="CenterCover"]
color = Color(0.14, 0.22, 0.36, 1)
polygon = PackedVector2Array(-110, -14, 110, -14, 110, 14, -110, 14)

[node name="Player" type="CharacterBody2D" parent="." groups=["player"]]
position = Vector2(320, 360)
script = ExtResource("1_twinstick")

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]
shape = SubResource("CircleShape2D_blaster")

[node name="ShipVisual" type="Polygon2D" parent="Player"]
color = Color(0.0, 0.94, 0.82, 1)
polygon = PackedVector2Array(24, 0, -16, 18, -8, 0, -16, -18)

[node name="Camera2D" type="Camera2D" parent="Player"]
position_smoothing_enabled = true
position_smoothing_speed = 9.0
`,
  },

  collectathon_3d: {
    id: 'collectathon_3d',
    title: '3D PBR Arena Collectathon (GL Compatibility)',
    dimension: '3D',
    description:
      'Lightweight 3D PBR arena with ACES tonemapping, glow, CharacterBody3D hero, directional sun shadows, and rotating energy core.',
    sceneRelativePath: 'scenes/collectathon_3d.tscn',
    scriptRelativePath: 'scripts/collectathon_orb_3d.gd',
    scriptGd: `extends Node3D

## Rotating 3D Energy Core for GAMA 3D Collectathon template.

@export var spin_speed: float = 2.4
var _time: float = 0.0


func _process(delta: float) -> void:
	_time += delta
	rotate_y(spin_speed * delta)
	position.y = 1.4 + sin(_time * 3.0) * 0.25
`,
    sceneTscn: `[gd_scene load_steps=7 format=3]

[ext_resource type="Script" path="res://scripts/demo_player.gd" id="1_player"]
[ext_resource type="Script" path="res://scripts/collectathon_orb_3d.gd" id="2_orb"]

[sub_resource type="BoxShape3D" id="BoxShape3D_floor"]
size = Vector3(24, 1, 24)

[sub_resource type="BoxMesh" id="BoxMesh_floor"]
size = Vector3(24, 1, 24)

[sub_resource type="CapsuleShape3D" id="CapsuleShape3D_hero"]

[sub_resource type="SphereMesh" id="SphereMesh_orb"]
radius = 0.45
height = 0.9

[node name="Collectathon3D" type="Node3D"]

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 10, 0)
shadow_enabled = true

[node name="Floor" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.5, 0)

[node name="CollisionShape3D" type="CollisionShape3D" parent="Floor"]
shape = SubResource("BoxShape3D_floor")

[node name="MeshInstance3D" type="MeshInstance3D" parent="Floor"]
mesh = SubResource("BoxMesh_floor")

[node name="Player" type="CharacterBody3D" parent="." groups=["player"]]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.2, 0)
script = ExtResource("1_player")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Player"]
shape = SubResource("CapsuleShape3D_hero")

[node name="EnergyOrb" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 1.4, -2)
script = ExtResource("2_orb")

[node name="OrbMesh" type="MeshInstance3D" parent="EnergyOrb"]
mesh = SubResource("SphereMesh_orb")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.906308, 0.422618, 0, -0.422618, 0.906308, 0, 5.5, 9.5)
current = true
`,
  },

  hover_racer_3d: {
    id: 'hover_racer_3d',
    title: '3D Anti-Gravity Neon Hover-Pod Racer (GL Compatibility)',
    dimension: '3D',
    description:
      'High-speed 3D anti-gravity hover-pod time trial with magnetic suspension bobbing, banking turn physics, FOV turbo boost via CinemaDirector, and track gate checkpoints.',
    sceneRelativePath: 'scenes/hover_racer_3d.tscn',
    scriptRelativePath: 'scripts/hover_racer_3d.gd',
    scriptGd: `extends CharacterBody3D

## GAMA 3D Anti-Gravity Hover-Pod Controller for Godot 4 AI Agents.
## Provides magnetic hover suspension, banking turn tilt, and FOV turbo boosts.

@export var cruise_speed: float = 14.0
@export var boost_speed: float = 24.0
@export var steer_speed: float = 11.0
@export var hover_height: float = 1.25

var _hover_phase: float = 0.0
var _boost_timer: float = 0.0


func _ready() -> void:
	add_to_group("player")
	CombatSystem.register_entity(self, 100)


func _physics_process(delta: float) -> void:
	_hover_phase += delta * 4.5
	_boost_timer = maxf(0.0, _boost_timer - delta)

	var steer: float = Input.get_axis("move_left", "move_right")
	var current_forward: float = boost_speed if _boost_timer > 0.0 else cruise_speed

	velocity.x = move_toward(velocity.x, steer * steer_speed, steer_speed * 8.0 * delta)
	velocity.z = -current_forward * 0.15
	position.y = hover_height + sin(_hover_phase) * 0.12
	rotation.z = lerp_angle(rotation.z, -steer * 0.32, 10.0 * delta)

	if Input.is_action_just_pressed("action") and _boost_timer <= 0.0:
		_trigger_turbo()

	move_and_slide()


func _trigger_turbo() -> void:
	_boost_timer = 0.75
	GameState.add_score(15)
	CinemaDirector.punch_fov_3d(-10.0, 0.25)
	AudioSynth.play_tone(860.0, 0.11, 0.24)
`,
    sceneTscn: `[gd_scene load_steps=7 format=3]

[ext_resource type="Script" path="res://scripts/hover_racer_3d.gd" id="1_hover"]

[sub_resource type="BoxShape3D" id="BoxShape3D_track"]
size = Vector3(18, 1, 60)

[sub_resource type="BoxMesh" id="BoxMesh_track"]
size = Vector3(18, 1, 60)

[sub_resource type="BoxShape3D" id="BoxShape3D_pod"]
size = Vector3(1.4, 0.6, 2.2)

[sub_resource type="BoxMesh" id="BoxMesh_pod"]
size = Vector3(1.4, 0.6, 2.2)

[sub_resource type="TorusMesh" id="TorusMesh_gate"]
inner_radius = 2.4
outer_radius = 2.8

[node name="HoverRacer3D" type="Node3D"]

[node name="SunLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 12, 0)
shadow_enabled = true

[node name="TrackFloor" type="StaticBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.5, -16)

[node name="CollisionShape3D" type="CollisionShape3D" parent="TrackFloor"]
shape = SubResource("BoxShape3D_track")

[node name="TrackMesh" type="MeshInstance3D" parent="TrackFloor"]
mesh = SubResource("BoxMesh_track")

[node name="HoverPod" type="CharacterBody3D" parent="." groups=["player"]]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.25, 0)
script = ExtResource("1_hover")

[node name="CollisionShape3D" type="CollisionShape3D" parent="HoverPod"]
shape = SubResource("BoxShape3D_pod")

[node name="HullMesh" type="MeshInstance3D" parent="HoverPod"]
mesh = SubResource("BoxMesh_pod")

[node name="SpeedGate" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2.4, -10)
mesh = SubResource("TorusMesh_gate")

[node name="ChaseCamera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.939693, 0.34202, 0, -0.34202, 0.939693, 0, 4.2, 6.8)
current = true
`,
  },
};

export function listArchetypes(): Array<{
  id: GodotArchetypeId;
  title: string;
  dimension: '2D' | '3D';
  description: string;
  sceneRelativePath: string;
  scriptRelativePath: string;
}> {
  return Object.values(GODOT_ARCHETYPES).map((a) => ({
    id: a.id,
    title: a.title,
    dimension: a.dimension,
    description: a.description,
    sceneRelativePath: a.sceneRelativePath,
    scriptRelativePath: a.scriptRelativePath,
  }));
}

export function scaffoldArchetype(
  projectDir: string,
  archetypeId: GodotArchetypeId,
  customSceneRelativePath?: string
): {
  ok: boolean;
  archetypeId: GodotArchetypeId;
  sceneSaved: string;
  scriptSaved: string;
} {
  const tpl = GODOT_ARCHETYPES[archetypeId];
  if (!tpl) {
    throw new Error(
      `Unknown archetype '${String(archetypeId)}'. Valid options: ${Object.keys(GODOT_ARCHETYPES).join(', ')}`
    );
  }

  const sceneRel = (customSceneRelativePath ?? tpl.sceneRelativePath).replace(/^res:\/\//, '');
  const scriptRel = tpl.scriptRelativePath.replace(/^res:\/\//, '');

  const sceneAbs = resolve(projectDir, sceneRel);
  const scriptAbs = resolve(projectDir, scriptRel);

  mkdirSync(dirname(sceneAbs), { recursive: true });
  mkdirSync(dirname(scriptAbs), { recursive: true });

  writeFileSync(scriptAbs, tpl.scriptGd, 'utf-8');
  writeFileSync(sceneAbs, tpl.sceneTscn, 'utf-8');

  return {
    ok: true,
    archetypeId: tpl.id,
    sceneSaved: `res://${sceneRel}`,
    scriptSaved: `res://${scriptRel}`,
  };
}
