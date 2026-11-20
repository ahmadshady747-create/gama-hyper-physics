extends Node
## GAMA Agent Autoload: Zero-asset procedural audio synthesizer for Godot 4.

var _player: AudioStreamPlayer
var _generator: AudioStreamGenerator
var _phase: float = 0.0

func _ready() -> void:
	_generator = AudioStreamGenerator.new()
	_generator.mix_rate = 22050.0
	_generator.buffer_length = 0.15
	_player = AudioStreamPlayer.new()
	_player.stream = _generator
	add_child(_player)

func play_tone(freq_hz: float = 440.0, duration_sec: float = 0.12, volume: float = 0.25) -> void:
	if DisplayServer.get_name() == "headless":
		return
	if not _player.playing:
		_player.play()
	var playback := _player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null:
		return
	var sample_rate := _generator.mix_rate
	var frames := mini(int(sample_rate * duration_sec), playback.get_frames_available())
	var increment := freq_hz / sample_rate
	for i in range(frames):
		var env := 1.0 - (float(i) / maxf(1.0, float(frames)))
		var sample := sin(_phase * TAU) * volume * env
		playback.push_frame(Vector2(sample, sample))
		_phase = fmod(_phase + increment, 1.0)
