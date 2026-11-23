extends Area2D

## GAMA 2D Projectile Prefab Controller for Godot 4 AI Agents.
## Moves along direction vector, damages nodes in "enemies" group via CombatSystem,
## spawns ProceduralVFX impact sparks, and auto-expires after lifetime_sec.

@export var speed: float = 720.0
@export var damage: int = 25
@export var lifetime_sec: float = 1.6
var direction: Vector2 = Vector2.RIGHT
var _elapsed: float = 0.0


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	position += direction.normalized() * speed * delta
	_elapsed += delta
	if _elapsed >= lifetime_sec:
		queue_free()


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("enemies"):
		CombatSystem.apply_damage(body, damage, 50)
		ProceduralVFX.spawn_burst_2d(global_position, Color(1.0, 0.45, 0.2, 1.0), 14)
		queue_free()
