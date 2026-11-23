extends StaticBody3D

## GAMA 3D Auto-Targeting Turret Enemy Controller for Godot 4 AI Agents.
## Rotates toward the nearest 3D player node and periodically fires Projectile3D bolts.

@export var projectile_scene: PackedScene = preload("res://scenes/projectile_3d.tscn")
@export var fire_interval_sec: float = 1.8
@export var detection_range: float = 18.0
@export var max_hp: int = 80
@export var score_reward: int = 120

var _fire_timer: float = 1.0


func _ready() -> void:
	add_to_group("enemies")
	CombatSystem.register_entity(self, max_hp)
	_fire_timer = fire_interval_sec


func _physics_process(delta: float) -> void:
	var target: Node3D = _find_player_3d()
	if target == null:
		return

	var dist: float = global_position.distance_to(target.global_position)
	if dist > detection_range:
		return

	var look_pos: Vector3 = Vector3(target.global_position.x, global_position.y, target.global_position.z)
	if global_position.distance_to(look_pos) > 0.05:
		look_at(look_pos, Vector3.UP)

	_fire_timer -= delta
	if _fire_timer <= 0.0:
		_fire_timer = maxf(0.4, fire_interval_sec)
		_spawn_projectile(target.global_position)


func _spawn_projectile(target_pos: Vector3) -> void:
	if projectile_scene == null:
		return
	var bolt: Node = projectile_scene.instantiate()
	if bolt is Area3D:
		var b3d: Area3D = bolt as Area3D
		b3d.global_position = global_position + Vector3(0.0, 0.8, 0.0)
		var dir: Vector3 = (target_pos - b3d.global_position).normalized()
		b3d.set("direction", dir)
		get_tree().current_scene.add_child(b3d)
		AudioSynth.play_tone(340.0, 0.07, 0.2)


func take_hit(damage: int) -> void:
	CombatSystem.apply_damage(self, damage, score_reward)


func _find_player_3d() -> Node3D:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	for p: Node in players:
		if p is Node3D:
			return p as Node3D
	return null
