extends Area3D

## GAMA 3D Level Goal Portal Controller for Godot 4 AI Agents.
## Rotates continuously, awards stage completion bonus, triggers slow-mo flash,
## and advances through GameState's multi-stage campaign playlist (or `next_scene_path`).

@export var next_scene_path: String = "res://scenes/title_menu.tscn"
@export var use_campaign_playlist: bool = true
@export var completion_bonus: int = 250
@export var spin_speed: float = 1.8

var _triggered: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	rotate_y(spin_speed * delta)


func _on_body_entered(body: Node) -> void:
	if _triggered or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		_triggered = true
		ProceduralVFX.spawn_burst_3d(global_position, Color(0.2, 0.98, 0.75, 1.0), 28)
		CinemaDirector.flash_screen(Color(0.2, 0.98, 0.75, 0.45), 0.25)
		AudioSynth.play_tone(1180.0, 0.16, 0.28)
		if use_campaign_playlist:
			GameState.advance_to_next_stage(completion_bonus)
		else:
			GameState.add_score(completion_bonus)
			GameState.transition_with_fade(next_scene_path, 0.25)
