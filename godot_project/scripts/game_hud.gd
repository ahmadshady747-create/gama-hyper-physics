extends CanvasLayer

## GAMA Universal Game HUD & Pause Controller for Godot 4 AI Agents.
## Deeply integrated with GameState, LocalizationSystem, CombatSystem, QuestSystem, and InventorySystem.

@export var max_health: int = 100
@export var game_over_scene_path: String = "res://scenes/game_over.tscn"
var current_health: int = 100

@onready var _score_label: Label = $TopBar/ScoreLabel
@onready var _health_label: Label = $TopBar/HealthLabel
@onready var _pause_panel: ColorRect = $PauseOverlay
@onready var _pause_title: Label = $PauseOverlay/PauseTitle


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if _pause_panel != null:
		_pause_panel.visible = false

	GameState.score_updated.connect(_on_score_updated)
	LocalizationSystem.locale_changed.connect(_on_locale_changed)
	CombatSystem.entity_damaged.connect(_on_combat_entity_damaged)
	CombatSystem.entity_defeated.connect(_on_combat_entity_defeated)

	_refresh_labels()
	set_health(max_health)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		toggle_pause()


func _on_locale_changed(_new_locale: String) -> void:
	_refresh_labels()


func _on_score_updated(_new_score: int) -> void:
	_refresh_labels()


func _refresh_labels() -> void:
	var score_txt: String = LocalizationSystem.translate("SCORE", "SCORE")
	var best_txt: String = LocalizationSystem.translate("HIGH_SCORE", "BEST")
	var hp_txt: String = LocalizationSystem.translate("HEALTH", "HP")
	var paused_txt: String = LocalizationSystem.translate("PAUSED", "PAUSED")

	if _score_label != null:
		_score_label.text = score_txt + ": " + str(GameState.score) + "  |  " + best_txt + ": " + str(GameState.high_score)
	if _health_label != null:
		_health_label.text = hp_txt + ": " + str(current_health) + " / " + str(max_health)
	if _pause_title != null:
		_pause_title.text = paused_txt


func _on_combat_entity_damaged(target: Node, _amount: int, remaining_hp: int) -> void:
	if target == null:
		return
	if target.is_in_group("player") or target.name.to_lower().contains("player"):
		set_health(remaining_hp)


func _on_combat_entity_defeated(target: Node, _reward: int) -> void:
	if target == null:
		return
	if target.is_in_group("player") or target.name.to_lower().contains("player"):
		GameState.transition_to_scene(game_over_scene_path)


func set_health(hp: int) -> void:
	current_health = clampi(hp, 0, max_health)
	_refresh_labels()
	if current_health <= 25 and current_health > 0:
		CinemaDirector.flash_screen(Color(0.95, 0.15, 0.2, 0.35), 0.22)
	elif current_health <= 0:
		GameState.transition_to_scene(game_over_scene_path)


func apply_damage(amount: int) -> void:
	set_health(current_health - amount)
	Juice.hit_heavy()


func toggle_pause() -> void:
	var paused: bool = not get_tree().paused
	get_tree().paused = paused
	if _pause_panel != null:
		_pause_panel.visible = paused
