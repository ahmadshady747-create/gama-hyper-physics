extends AnimatableBody3D

## GAMA 3D Oscillating Moving Platform Controller for Godot 4 AI Agents.
## Smoothly interpolates along `travel_offset` using a sine wave cycle.

@export var travel_offset: Vector3 = Vector3(0.0, 0.0, 6.0)
@export var cycle_speed: float = 1.4

var _origin: Vector3 = Vector3.ZERO
var _time: float = 0.0


func _ready() -> void:
	_origin = global_position


func _physics_process(delta: float) -> void:
	_time += delta * cycle_speed
	var alpha: float = (sin(_time) + 1.0) * 0.5
	global_position = _origin.lerp(_origin + travel_offset, alpha)
