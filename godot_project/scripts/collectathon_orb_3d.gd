extends Node3D

## Rotating 3D Energy Core for GAMA 3D Collectathon template.

@export var spin_speed: float = 2.4
var _time: float = 0.0


func _process(delta: float) -> void:
	_time += delta
	rotate_y(spin_speed * delta)
	position.y = 1.4 + sin(_time * 3.0) * 0.25
