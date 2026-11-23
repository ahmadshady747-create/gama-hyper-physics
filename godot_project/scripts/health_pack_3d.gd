extends Area3D

## GAMA 3D Health & Shield Restore Pickup Controller for Godot 4 AI Agents.
## Rotates smoothly, restores player health or awards shield bonus,
## triggers emerald 3D particle burst, and plays a healing chime.

@export var heal_amount: int = 35
@export var score_bonus: int = 30
@export var spin_speed: float = 2.2

var _base_y: float = 0.0
var _time: float = 0.0


func _ready() -> void:
	_base_y = position.y
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	_time += delta
	rotate_y(spin_speed * delta)
	position.y = _base_y + sin(_time * 3.0) * 0.18


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		var current_hp: int = CombatSystem.get_hp(body, 100)
		CombatSystem.register_entity(body, mini(100, current_hp + heal_amount))
		GameState.add_score(score_bonus)
		ProceduralVFX.spawn_burst_3d(global_position, Color(0.18, 0.98, 0.48, 1.0), 20)
		CinemaDirector.flash_screen(Color(0.18, 0.98, 0.48, 0.28), 0.18)
		AudioSynth.play_tone(920.0, 0.11, 0.24)
		queue_free()
