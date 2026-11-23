extends Control

## GAMA Universal Title Menu Controller for Godot 4 AI Agents.
## Displays localized Arabic/English labels via LocalizationSystem, shows high score
## from GameState, plays procedural audio feedback, and transitions smoothly via transition_with_fade.

@export var start_scene_path: String = "res://scenes/main.tscn"

@onready var _best_label: Label = $CenterPanel/BestScoreLabel
@onready var _start_btn: Button = $CenterPanel/StartButton
@onready var _quit_btn: Button = $CenterPanel/QuitButton


func _ready() -> void:
	LocalizationSystem.locale_changed.connect(_on_locale_changed)
	_refresh_ui()
	if _start_btn != null:
		_start_btn.pressed.connect(_on_start_pressed)
	if _quit_btn != null:
		_quit_btn.pressed.connect(_on_quit_pressed)


func _on_locale_changed(_new_locale: String) -> void:
	_refresh_ui()


func _refresh_ui() -> void:
	var best_txt: String = LocalizationSystem.translate("HIGH_SCORE", "HIGH SCORE")
	if _best_label != null:
		_best_label.text = best_txt + ": " + str(GameState.high_score)
	if _start_btn != null:
		_start_btn.text = LocalizationSystem.translate("START_GAME", "START GAME")
	if _quit_btn != null:
		_quit_btn.text = LocalizationSystem.translate("QUIT_GAME", "QUIT")


func _on_start_pressed() -> void:
	GameState.reset_run_score()
	AudioSynth.play_tone(740.0, 0.1, 0.25)
	GameState.transition_with_fade(start_scene_path, 0.25)


func _on_quit_pressed() -> void:
	GameState.save_game()
	get_tree().quit()
