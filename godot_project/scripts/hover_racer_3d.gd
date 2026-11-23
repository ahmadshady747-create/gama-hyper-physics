extends CharacterBody3D

## GAMA 3D Anti-Gravity Hover-Pod Controller for Godot 4 AI Agents.
## Provides magnetic hover suspension, banking turn tilt, and FOV turbo boosts.

@export var cruise_speed: float = 14.0
@export var boost_speed: float = 24.0
@export var steer_speed: float = 11.0
@export var hover_height: float = 1.25

var _hover_phase: float = 0.0
var _boost_timer: float = 0.0


func _ready() -> void:
	add_to_group("player")
	CombatSystem.register_entity(self, 100)


func _physics_process(delta: float) -> void:
	_hover_phase += delta * 4.5
	_boost_timer = maxf(0.0, _boost_timer - delta)

	var steer: float = Input.get_axis("move_left", "move_right")
	var current_forward: float = boost_speed if _boost_timer > 0.0 else cruise_speed

	velocity.x = move_toward(velocity.x, steer * steer_speed, steer_speed * 8.0 * delta)
	velocity.z = -current_forward * 0.15
	position.y = hover_height + sin(_hover_phase) * 0.12
	rotation.z = lerp_angle(rotation.z, -steer * 0.32, 10.0 * delta)

	if Input.is_action_just_pressed("action") and _boost_timer <= 0.0:
		_trigger_turbo()

	move_and_slide()


func _trigger_turbo() -> void:
	_boost_timer = 0.75
	GameState.add_score(15)
	CinemaDirector.punch_fov_3d(-10.0, 0.25)
	AudioSynth.play_tone(860.0, 0.11, 0.24)
