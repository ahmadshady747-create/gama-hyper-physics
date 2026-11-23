extends CharacterBody2D

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
