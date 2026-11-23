extends Area2D

## GAMA 2D Speed & Invulnerability Power-Up Controller for Godot 4 AI Agents.
## Temporarily boosts player move_speed, triggers gold screen flash, particle burst,
## and restores normal speed after duration_sec.

@export var speed_multiplier: float = 1.45
@export var duration_sec: float = 4.5
@export var bonus_score: int = 40

var _consumed: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if _consumed or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		_consumed = true
		GameState.add_score(bonus_score)
		ProceduralVFX.spawn_burst_2d(global_position, Color(0.2, 0.96, 1.0, 1.0), 22)
		CinemaDirector.flash_screen(Color(0.2, 0.96, 1.0, 0.35), 0.18)
		AudioSynth.play_tone(1120.0, 0.12, 0.25)

		if "move_speed" in body:
			var orig_speed: float = float(body.get("move_speed"))
			body.set("move_speed", orig_speed * speed_multiplier)
			visible = false
			var timer: SceneTreeTimer = get_tree().create_timer(duration_sec)
			await timer.timeout
			if is_instance_valid(body):
				body.set("move_speed", orig_speed)
		queue_free()
