extends Area3D

## GAMA 3D Energy Projectile Prefab Controller for Godot 4 AI Agents.
## Travels along 3D direction vector, damages 3D enemies via CombatSystem,
## and triggers a 3D particle burst on impact.

@export var speed: float = 22.0
@export var damage: int = 30
@export var lifetime_sec: float = 2.0
var direction: Vector3 = Vector3.FORWARD
var _elapsed: float = 0.0


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	global_position += direction.normalized() * speed * delta
	_elapsed += delta
	if _elapsed >= lifetime_sec:
		queue_free()


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("enemies"):
		CombatSystem.apply_damage(body, damage, 75)
		ProceduralVFX.spawn_burst_3d(global_position, Color(0.0, 0.95, 0.85, 1.0), 16)
		queue_free()
