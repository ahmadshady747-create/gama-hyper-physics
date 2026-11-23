extends Area3D

## GAMA 3D Jump Pad / Bounce Launcher Controller for Godot 4 AI Agents.
## Launches any CharacterBody3D player upward with `launch_velocity_y`,
## triggers FOV punch zoom via CinemaDirector, and spawns a 3D particle ring.

@export var launch_velocity_y: float = 13.5
@export var bonus_score: int = 15


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body is CharacterBody3D and (body.is_in_group("player") or body.name.to_lower().contains("player")):
		var player3d: CharacterBody3D = body as CharacterBody3D
		player3d.velocity.y = launch_velocity_y
		GameState.add_score(bonus_score)
		ProceduralVFX.spawn_burst_3d(global_position, Color(0.18, 0.98, 0.65, 1.0), 20)
		CinemaDirector.punch_fov_3d(7.0, 0.24)
		AudioSynth.play_tone(680.0, 0.11, 0.24)
