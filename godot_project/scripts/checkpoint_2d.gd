extends Area2D

## GAMA 2D Checkpoint & Respawn Flag Controller for Godot 4 AI Agents.
## Saves active checkpoint position into GameState multi-slot persistence,
## triggers ProceduralVFX burst, and plays an activation chime when touched by a player.

@export var checkpoint_id: String = "cp_1"
var activated: bool = false

@onready var _flag_visual: Polygon2D = $FlagVisual


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if activated or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		activated = true
		GameState.set_checkpoint_2d(checkpoint_id, global_position)
		if _flag_visual != null:
			_flag_visual.color = Color(0.15, 0.96, 0.55, 1.0)
		ProceduralVFX.spawn_burst_2d(global_position, Color(0.15, 0.96, 0.55, 1.0), 20)
		AudioSynth.play_tone(1040.0, 0.12, 0.25)
