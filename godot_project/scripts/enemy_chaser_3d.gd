extends CharacterBody3D

## GAMA 3D Drone Chaser Enemy AI Controller for Godot 4 AI Agents.
## Tracks the first Node3D in the "player" group with smooth hover oscillation.

@export var move_speed: float = 4.2
@export var max_hp: int = 60
@export var score_reward: int = 75

var _hover_time: float = 0.0


func _ready() -> void:
	add_to_group("enemies")
	CombatSystem.register_entity(self, max_hp)


func _physics_process(delta: float) -> void:
	_hover_time += delta
	var target: Node3D = _find_player_3d()
	if target != null:
		var offset: Vector3 = target.global_position - global_position
		offset.y = 0.0
		var dir: Vector3 = offset.normalized()
		velocity.x = dir.x * move_speed
		velocity.z = dir.z * move_speed
	else:
		velocity.x = cos(_hover_time * 1.4) * move_speed * 0.5
		velocity.z = sin(_hover_time * 1.4) * move_speed * 0.5

	velocity.y = sin(_hover_time * 4.0) * 0.6
	move_and_slide()


func take_hit(damage: int) -> void:
	CombatSystem.apply_damage(self, damage, score_reward)


func _find_player_3d() -> Node3D:
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	for p: Node in players:
		if p is Node3D:
			return p as Node3D
	return null
