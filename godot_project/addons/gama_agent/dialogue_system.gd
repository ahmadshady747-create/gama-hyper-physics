extends CanvasLayer

## GAMA DialogueSystem Autoload for Godot 4 AI Agents.
## Provides instant bottom-anchored narrative dialogue boxes, cinematic letterbox framing
## via CinemaDirector, procedural voice bleeps via AudioSynth, and signal notifications.

signal dialogue_started(speaker: String)
signal dialogue_finished()

var _panel: ColorRect = null
var _speaker_label: Label = null
var _body_label: Label = null
var _queue: Array[Dictionary] = []
var _active: bool = false


func _ready() -> void:
	layer = 95
	process_mode = Node.PROCESS_MODE_ALWAYS

	_panel = ColorRect.new()
	_panel.color = Color(0.03, 0.05, 0.1, 0.92)
	_panel.offset_left = 140.0
	_panel.offset_top = 520.0
	_panel.offset_right = 1140.0
	_panel.offset_bottom = 690.0
	_panel.visible = false
	add_child(_panel)

	_speaker_label = Label.new()
	_speaker_label.offset_left = 24.0
	_speaker_label.offset_top = 14.0
	_speaker_label.offset_right = 960.0
	_speaker_label.offset_bottom = 44.0
	_speaker_label.text = "SYSTEM"
	_panel.add_child(_speaker_label)

	_body_label = Label.new()
	_body_label.offset_left = 24.0
	_body_label.offset_top = 52.0
	_body_label.offset_right = 960.0
	_body_label.offset_bottom = 150.0
	_body_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_body_label.text = ""
	_panel.add_child(_body_label)


func show_line(speaker: String, text: String, auto_close_sec: float = 3.0) -> void:
	_queue.append({
		"speaker": speaker,
		"text": text,
		"duration": maxf(0.5, auto_close_sec)
	})
	if not _active:
		_play_next()


func show_sequence(lines: Array[Dictionary]) -> void:
	for entry: Dictionary in lines:
		var spk: String = str(entry.get("speaker", "AGENT"))
		var txt: String = str(entry.get("text", ""))
		var dur: float = float(entry.get("duration", 2.8))
		show_line(spk, txt, dur)


func hide_dialogue() -> void:
	_queue.clear()
	_active = false
	if _panel != null:
		_panel.visible = false
	CinemaDirector.set_letterbox(false, 48.0, 0.2)
	dialogue_finished.emit()


func _play_next() -> void:
	if _queue.is_empty():
		_active = false
		if _panel != null:
			_panel.visible = false
		CinemaDirector.set_letterbox(false, 48.0, 0.2)
		dialogue_finished.emit()
		return

	_active = true
	CinemaDirector.set_letterbox(true, 48.0, 0.22)
	var item: Dictionary = _queue.pop_front()
	var speaker: String = str(item.get("speaker", "AGENT"))
	var text: String = str(item.get("text", ""))
	var duration: float = float(item.get("duration", 2.8))

	if _panel != null:
		_panel.visible = true
	if _speaker_label != null:
		_speaker_label.text = "[ " + speaker + " ]"
	if _body_label != null:
		_body_label.text = text

	AudioSynth.play_tone(620.0, 0.05, 0.16)
	dialogue_started.emit(speaker)

	var timer: SceneTreeTimer = get_tree().create_timer(duration, true, false, true)
	timer.timeout.connect(_play_next)
