extends Node

## GAMA Agent Autoload: Zero-asset procedural audio synthesizer for Godot 4.
## Provides pure-code tone, frequency sweep, multi-oscillator chord, and semantic SFX presets.

var _player: AudioStreamPlayer = null
var _generator: AudioStreamGenerator = null
var _phase: float = 0.0


func _ready() -> void:
	_generator = AudioStreamGenerator.new()
	_generator.mix_rate = 22050.0
	_generator.buffer_length = 0.22
	_player = AudioStreamPlayer.new()
	_player.stream = _generator
	add_child(_player)


func play_tone(freq_hz: float = 440.0, duration_sec: float = 0.12, volume: float = 0.25) -> void:
	if DisplayServer.get_name() == "headless" or _player == null or _generator == null:
		return
	if not _player.playing:
		_player.play()
	var playback: AudioStreamGeneratorPlayback = _player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null:
		return
	var sample_rate: float = _generator.mix_rate
	var frames: int = mini(int(sample_rate * duration_sec), playback.get_frames_available())
	var increment: float = freq_hz / sample_rate
	for i: int in range(frames):
		var env: float = 1.0 - (float(i) / maxf(1.0, float(frames)))
		var sample: float = sin(_phase * TAU) * volume * env
		playback.push_frame(Vector2(sample, sample))
		_phase = fmod(_phase + increment, 1.0)


func play_sweep(
	start_hz: float = 720.0,
	end_hz: float = 220.0,
	duration_sec: float = 0.14,
	volume: float = 0.24
) -> void:
	if DisplayServer.get_name() == "headless" or _player == null or _generator == null:
		return
	if not _player.playing:
		_player.play()
	var playback: AudioStreamGeneratorPlayback = _player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null:
		return
	var sample_rate: float = _generator.mix_rate
	var frames: int = mini(int(sample_rate * duration_sec), playback.get_frames_available())
	for i: int in range(frames):
		var t: float = float(i) / maxf(1.0, float(frames))
		var curr_freq: float = lerpf(start_hz, end_hz, t)
		var env: float = 1.0 - t
		var sample: float = sin(_phase * TAU) * volume * env
		playback.push_frame(Vector2(sample, sample))
		_phase = fmod(_phase + (curr_freq / sample_rate), 1.0)


func play_chord(
	frequencies: Array[float],
	duration_sec: float = 0.2,
	volume: float = 0.22
) -> void:
	if frequencies.is_empty():
		return
	if DisplayServer.get_name() == "headless" or _player == null or _generator == null:
		return
	if not _player.playing:
		_player.play()
	var playback: AudioStreamGeneratorPlayback = _player.get_stream_playback() as AudioStreamGeneratorPlayback
	if playback == null:
		return
	var sample_rate: float = _generator.mix_rate
	var frames: int = mini(int(sample_rate * duration_sec), playback.get_frames_available())
	var count_inv: float = 1.0 / float(frequencies.size())
	for i: int in range(frames):
		var t: float = float(i) / maxf(1.0, float(frames))
		var env: float = 1.0 - t
		var mixed: float = 0.0
		for f_hz: float in frequencies:
			mixed += sin(float(i) * (f_hz / sample_rate) * TAU)
		var sample: float = mixed * count_inv * volume * env
		playback.push_frame(Vector2(sample, sample))


func play_coin_chime() -> void:
	var notes: Array[float] = [987.77, 1318.51]
	play_chord(notes, 0.14, 0.24)


func play_laser_pew() -> void:
	play_sweep(880.0, 210.0, 0.11, 0.24)


func play_powerup_fanfare() -> void:
	var triad: Array[float] = [523.25, 659.25, 783.99]
	play_chord(triad, 0.22, 0.25)


func play_explosion_rumble() -> void:
	play_sweep(190.0, 55.0, 0.22, 0.3)
