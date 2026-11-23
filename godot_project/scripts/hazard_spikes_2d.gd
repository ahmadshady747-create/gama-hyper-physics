extends Area2D

## GAMA 2D Hazard Spike Zone Controller for Godot 4 AI Agents.
## Applies contact damage via CombatSystem, flashes screen red via CinemaDirector,
## and spawns impact sparks when touched by a player.

@export var damage_amount: int = 20
@export var knockback_impulse: float = -360.0


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		CombatSystem.apply_damage(body, damage_amount, 0, 450)
		CinemaDirector.flash_screen(Color(0.95, 0.15, 0.2, 0.38), 0.2)
		ProceduralVFX.spawn_burst_2d(global_position, Color(0.96, 0.22, 0.3, 1.0), 14)
		if body is CharacterBody2D:
			(body as CharacterBody2D).velocity.y = knockback_impulse
