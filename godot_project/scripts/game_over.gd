extends Control

## GAMA Universal Game Over Screen Controller for Godot 4 AI Agents.
## Displays localized Arabic/English labels, final score & high score,
## saves persistent state, and transitions smoothly via GameState.transition_with_fade.

@export var retry_scene_path: String = "res://scenes/main.tscn"
@export var title_scene_path: String = "res://scenes/title_menu.tscn"

@onready var _title_label: Label = $CenterPanel/TitleLabel
@onready var _final_score_label: Label = $CenterPanel/FinalScoreLabel
@onready var _retry_btn: Button = $CenterPanel/RetryButton
@onready var _menu_btn: Button = $CenterPanel/MenuButton


func _ready() -> void:
	GameState.save_game()
	LocalizationSystem.locale_changed.connect(_on_locale_changed)
	_refresh_ui()
	if _retry_btn != null:
		_retry_btn.pressed.connect(_on_retry_pressed)
	if _menu_btn != null:
		_menu_btn.pressed.connect(_on_menu_pressed)


func _on_locale_changed(_new_locale: String) -> void:
	_refresh_ui()


func _refresh_ui() -> void:
	var score_txt: String = LocalizationSystem.translate("SCORE", "SCORE")
	var best_txt: String = LocalizationSystem.translate("HIGH_SCORE", "BEST")
	if _title_label != null:
		_title_label.text = LocalizationSystem.translate("GAME_OVER", "GAME OVER")
	if _final_score_label != null:
		_final_score_label.text = score_txt + ": " + str(GameState.score) + "  |  " + best_txt + ": " + str(GameState.high_score)
	if _retry_btn != null:
		_retry_btn.text = LocalizationSystem.translate("PLAY_AGAIN", "PLAY AGAIN")
	if _menu_btn != null:
		_menu_btn.text = LocalizationSystem.translate("MAIN_MENU", "MAIN MENU")


func _on_retry_pressed() -> void:
	GameState.reset_run_score()
	AudioSynth.play_tone(640.0, 0.1, 0.25)
	GameState.transition_with_fade(retry_scene_path, 0.22)


func _on_menu_pressed() -> void:
	GameState.reset_run_score()
	GameState.transition_with_fade(title_scene_path, 0.22)
