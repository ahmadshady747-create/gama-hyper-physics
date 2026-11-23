extends CharacterBody2D

## GAMA 2D Chaser Enemy AI Controller for Godot 4 AI Agents.
## Automatically tracks nodes in the "player" group or patrols horizontally.

@export var move_speed: float = 175.0
@export var max_hp: int = 40
@export var contact_damage: int = 15
@export var score_reward: int = 50
@export var patrol_range: float = 160.0

var _spawn_x: float = 0.0
var _patrol_dir: float = 1.0


func _ready() -> void:
	add_to_group("enemies")
	_spawn_x = global_position.x
	CombatSystem.register_entity(self, max_hp)


func _physics_process(delta: float) -> void:
	var target: Node2D = _find_player_2d()
	if target != null:
		var dir: Vector2 = (target.global_position - global_position).normalized()
		velocity = velocity.move_toward(dir * move_speed, move_speed * 8.0 * delta)
	else:
		if absf(global_position.x - _spawn_x) > patrol_range:
			_patrol_dir *= -1.0
		velocity = Vector2(_patrol_dir * move_speed * 0.7, 0.0)

	move_and_slide()


func take_hit(damage: int) -> void:
	CombatSystem.apply_damage(self, damage, score_reward)


func _find_player_2d() -> Node2D:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	for p: Node in players:
		if p is Node2D:
			return p as Node2D
	return null
