extends Area2D

## GAMA 2D Stage Goal Portal Controller for Godot 4 AI Agents.
## Rotates its procedural neon portal rings, awards stage completion bonus,
## triggers ProceduralVFX burst & CinemaDirector flash, and advances GameState campaign stage.

@export var next_scene_path: String = "res://scenes/title_menu.tscn"
@export var use_campaign_playlist: bool = true
@export var completion_bonus: int = 250
@export var spin_speed: float = 2.2

var _triggered: bool = false

@onready var _outer_ring: Polygon2D = $OuterRing
@onready var _inner_core: Polygon2D = $InnerCore


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if _outer_ring != null:
		_outer_ring.rotation += spin_speed * delta
	if _inner_core != null:
		_inner_core.rotation -= spin_speed * 1.4 * delta


func _on_body_entered(body: Node) -> void:
	if _triggered or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		_triggered = true
		ProceduralVFX.spawn_burst_2d(global_position, Color(0.0, 0.96, 0.82, 1.0), 28)
		CinemaDirector.flash_screen(Color(0.0, 0.96, 0.82, 0.45), 0.24)
		AudioSynth.play_tone(1220.0, 0.16, 0.28)
		if use_campaign_playlist:
			GameState.advance_to_next_stage(completion_bonus)
		else:
			GameState.add_score(completion_bonus)
			GameState.transition_with_fade(next_scene_path, 0.25)
