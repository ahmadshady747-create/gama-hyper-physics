extends CharacterBody2D

## GAMA 2D Top-Down Arena Controller with Dash Impulse & Auto-Juice.

@export var move_speed: float = 340.0
@export var dash_speed: float = 880.0
var _dash_cooldown: float = 0.0


func _physics_process(delta: float) -> void:
	_dash_cooldown = maxf(0.0, _dash_cooldown - delta)
	var x_dir: float = Input.get_axis("move_left", "move_right")
	var desired: Vector2 = Vector2(x_dir, 0.0).normalized() * move_speed
	velocity = velocity.move_toward(desired, move_speed * 12.0 * delta)

	if Input.is_action_just_pressed("action") and _dash_cooldown <= 0.0:
		var boost_dir: Vector2 = Vector2(x_dir if x_dir != 0.0 else 1.0, 0.0)
		velocity = boost_dir * dash_speed
		_dash_cooldown = 0.65
		Juice.hit_heavy()

	move_and_slide()
