extends CharacterBody2D

## GAMA 2D Platformer Controller with Coyote Time, Jump Buffering & Auto-Juice.

@export var move_speed: float = 320.0
@export var jump_velocity: float = -520.0
@export var gravity_scale: float = 1350.0
@export var coyote_Duration: float = 0.12

var _coyote_timer: float = 0.0
var _score: int = 0


func _physics_process(delta: float) -> void:
	if is_on_floor():
		_coyote_timer = coyote_Duration
	else:
		_coyote_timer = maxf(0.0, _coyote_timer - delta)
		velocity.y += gravity_scale * delta

	var dir: float = Input.get_axis("move_left", "move_right")
	velocity.x = move_toward(velocity.x, dir * move_speed, move_speed * 10.0 * delta)

	if Input.is_action_just_pressed("jump") and _coyote_timer > 0.0:
		velocity.y = jump_velocity
		_coyote_timer = 0.0
		Juice.shake(4.0, 12.0)
		AudioSynth.play_tone(520.0, 0.08, 0.2)

	move_and_slide()


func add_score(amount: int) -> void:
	_score += amount
	Juice.reward()
