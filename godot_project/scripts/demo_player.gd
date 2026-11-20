extends CharacterBody3D
## Starter typed GDScript 4 controller wired to GAMA Juice & AudioSynth autoloads.

@export var move_speed: float = 7.5
@export var jump_velocity: float = 8.5

var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")

func _physics_process(delta: float) -> void:
	if not is_on_floor():
		velocity.y -= _gravity * delta

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity
		Juice.shake(0.12)
		AudioSynth.play_tone(520.0, 0.1, 0.2)

	var dir_x := Input.get_axis("move_left", "move_right")
	velocity.x = move_toward(velocity.x, dir_x * move_speed, move_speed * 8.0 * delta)
	move_and_slide()
