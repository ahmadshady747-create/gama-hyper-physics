extends Node

## GAMA WaveSpawner Component for 2D & 3D Godot 4 AI Agent Games.
## Attach to any Node2D or Node3D and set `enemy_scene` to spawn waves around a target.

signal wave_started(wave_index: int, enemy_count: int)
signal enemy_spawned(enemy_node: Node)

@export var enemy_scene: PackedScene
@export var spawn_interval_sec: float = 2.5
@export var base_enemies_per_wave: int = 4
@export var spawn_radius: float = 240.0
@export var auto_start: bool = false

var current_wave: int = 0
var _timer: float = 0.0
var _active: bool = false


func _ready() -> void:
	_active = auto_start


func start_waves() -> void:
	_active = true
	_timer = 0.1


func stop_waves() -> void:
	_active = false


func _process(delta: float) -> void:
	if not _active:
		return
	_timer -= delta
	if _timer <= 0.0:
		spawn_next_wave()
		_timer = maxf(0.5, spawn_interval_sec)


func spawn_next_wave() -> void:
	current_wave += 1
	var count: int = base_enemies_per_wave + (current_wave - 1) * 2
	wave_started.emit(current_wave, count)
	if enemy_scene == null:
		return

	for i: int in range(count):
		var angle: float = (TAU / float(maxi(1, count))) * float(i)
		var inst: Node = enemy_scene.instantiate()
		if inst is Node2D and get_parent() is Node2D:
			var p2d: Node2D = get_parent() as Node2D
			(inst as Node2D).position = p2d.position + Vector2(cos(angle), sin(angle)) * spawn_radius
		elif inst is Node3D and get_parent() is Node3D:
			var p3d: Node3D = get_parent() as Node3D
			var r3: float = spawn_radius * 0.04
			(inst as Node3D).position = p3d.position + Vector3(cos(angle) * r3, 0.0, sin(angle) * r3)
		get_tree().current_scene.add_child(inst)
		enemy_spawned.emit(inst)
