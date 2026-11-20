extends Node
## GAMA Agent Autoload: One-line Game Feel (Screen Shake, Hitstop, Camera Impulse) for Godot 4.

var _shake_strength: float = 0.0
var _shake_decay: float = 8.0
var _rng := RandomNumberGenerator.new()

func _ready() -> void:
	_rng.randomize()

func _process(delta: float) -> void:
	if _shake_strength <= 0.001:
		return
	_shake_strength = lerpf(_shake_strength, 0.0, clampf(_shake_decay * delta, 0.0, 1.0))
	var cam := get_viewport().get_camera_3d()
	if cam != null:
		cam.h_offset = _rng.randf_range(-_shake_strength, _shake_strength)
		cam.v_offset = _rng.randf_range(-_shake_strength, _shake_strength)
	else:
		var cam2d := get_viewport().get_camera_2d()
		if cam2d != null:
			cam2d.offset = Vector2(
				_rng.randf_range(-_shake_strength * 20.0, _shake_strength * 20.0),
				_rng.randf_range(-_shake_strength * 20.0, _shake_strength * 20.0)
			)

func shake(strength: float = 0.25, decay: float = 8.0) -> void:
	_shake_strength = maxf(_shake_strength, strength)
	_shake_decay = decay

func hitstop(duration_sec: float = 0.045, time_scale: float = 0.08) -> void:
	Engine.time_scale = time_scale
	await get_tree().create_timer(duration_sec, true, false, true).timeout
	Engine.time_scale = 1.0

func hit_heavy() -> void:
	shake(0.35, 7.0)
	AudioSynth.play_tone(150.0, 0.16, 0.28)
	hitstop(0.04)

func reward() -> void:
	shake(0.12, 10.0)
	AudioSynth.play_tone(780.0, 0.18, 0.22)
