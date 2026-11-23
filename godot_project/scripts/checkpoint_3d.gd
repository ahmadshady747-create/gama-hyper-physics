extends Area3D

## GAMA 3D Checkpoint & Respawn Beacon Controller for Godot 4 AI Agents.
## Rotates its procedural halo ring, saves 3D checkpoint coordinates into GameState
## multi-slot persistence, triggers 3D particle burst & camera focus, and plays fanfare chime.

@export var checkpoint_id: String = "cp_3d_1"
@export var focus_camera_on_activate: bool = true
var activated: bool = false

@onready var _halo_mesh: MeshInstance3D = $HaloRing


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	if _halo_mesh != null:
		_halo_mesh.rotate_y(2.0 * delta)


func _on_body_entered(body: Node) -> void:
	if activated or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		activated = true
		GameState.set_checkpoint_3d(checkpoint_id, global_position)
		ProceduralVFX.spawn_burst_3d(global_position + Vector3(0.0, 1.2, 0.0), Color(0.15, 0.96, 0.65, 1.0), 24)
		AudioSynth.play_powerup_fanfare()
		if focus_camera_on_activate:
			CinemaDirector.focus_target_3d(global_position, Vector3(0.0, 3.2, 5.2), 0.35)
