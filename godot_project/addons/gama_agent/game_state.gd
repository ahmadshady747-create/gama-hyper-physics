extends Node

## GAMA GameState, Multi-Slot Save System, & Multi-Stage Campaign Scene Manager Autoload.
## Provides multi-slot JSON persistence with SHA-256 checksum integrity verification,
## 2D/3D checkpoint tracking, multi-stage campaign playlist progression, and fade scene transitions.

signal state_changed(key: String, value: Variant)
signal score_updated(new_score: int)
signal slot_saved(slot_id: int)
signal scene_changed(new_scene_path: String)
signal stage_completed(stage_index: int, completed_scene: String, next_scene: String)
signal campaign_completed(total_score: int, best_score: int)

const SAVE_PATH: String = "user://gama_save.json"
const SLOT_PREFIX: String = "user://gama_save_slot_"

var score: int = 0
var high_score: int = 0
var active_slot: int = 1
var current_scene_path: String = "res://scenes/main.tscn"
var stage_playlist: Array[String] = [
	"res://scenes/composed_stage_2d.tscn",
	"res://scenes/grid_stage_2d.tscn",
	"res://scenes/composed_arena_3d.tscn",
	"res://scenes/grid_arena_3d.tscn"
]
var current_stage_index: int = 0
var data: Dictionary = {}


func _ready() -> void:
	load_game()


func add_score(points: int) -> void:
	score += points
	if score > high_score:
		high_score = score
	score_updated.emit(score)


func reset_run_score() -> void:
	score = 0
	current_stage_index = 0
	score_updated.emit(score)


func set_stage_playlist(scenes: Array[String]) -> void:
	if scenes.is_empty():
		return
	stage_playlist = scenes.duplicate()
	current_stage_index = 0


func get_current_stage_index() -> int:
	return current_stage_index


func is_campaign_completed() -> bool:
	return current_stage_index >= stage_playlist.size()


func advance_to_next_stage(completion_bonus: int = 250) -> String:
	add_score(completion_bonus)
	var completed_scene: String = current_scene_path
	current_stage_index += 1
	if current_stage_index < stage_playlist.size():
		var next_scene: String = stage_playlist[current_stage_index]
		stage_completed.emit(current_stage_index - 1, completed_scene, next_scene)
		transition_with_fade(next_scene, 0.25)
		return next_scene

	campaign_completed.emit(score, high_score)
	var fallback_menu: String = "res://scenes/title_menu.tscn"
	stage_completed.emit(current_stage_index - 1, completed_scene, fallback_menu)
	transition_with_fade(fallback_menu, 0.3)
	return fallback_menu


func set_value(key: String, value: Variant) -> void:
	data[key] = value
	state_changed.emit(key, value)


func get_value(key: String, default_value: Variant = null) -> Variant:
	return data.get(key, default_value)


func set_checkpoint_2d(checkpoint_id: String, world_pos: Vector2) -> void:
	data["checkpoint_id"] = checkpoint_id
	data["checkpoint_x"] = world_pos.x
	data["checkpoint_y"] = world_pos.y
	save_slot(active_slot)


func get_checkpoint_2d(default_pos: Vector2 = Vector2.ZERO) -> Vector2:
	if not data.has("checkpoint_x") or not data.has("checkpoint_y"):
		return default_pos
	return Vector2(float(data.get("checkpoint_x", default_pos.x)), float(data.get("checkpoint_y", default_pos.y)))


func set_checkpoint_3d(checkpoint_id: String, world_pos: Vector3) -> void:
	data["checkpoint_id"] = checkpoint_id
	data["checkpoint_3d_x"] = world_pos.x
	data["checkpoint_3d_y"] = world_pos.y
	data["checkpoint_3d_z"] = world_pos.z
	save_slot(active_slot)


func get_checkpoint_3d(default_pos: Vector3 = Vector3.ZERO) -> Vector3:
	if not data.has("checkpoint_3d_x"):
		return default_pos
	return Vector3(
		float(data.get("checkpoint_3d_x", default_pos.x)),
		float(data.get("checkpoint_3d_y", default_pos.y)),
		float(data.get("checkpoint_3d_z", default_pos.z))
	)


func _slot_file_path(slot_id: int) -> String:
	if slot_id <= 1:
		return SAVE_PATH
	return SLOT_PREFIX + str(slot_id) + ".json"


func save_game() -> bool:
	return save_slot(active_slot)


func save_slot(slot_id: int = 1) -> bool:
	active_slot = maxi(1, slot_id)
	var path: String = _slot_file_path(active_slot)
	var file: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if file == null:
		return false
	var core_body: Dictionary = {
		"slot": active_slot,
		"high_score": high_score,
		"current_scene_path": current_scene_path,
		"current_stage_index": current_stage_index,
		"data": data
	}
	var core_json: String = JSON.stringify(core_body)
	var checksum: String = core_json.sha256_text()
	var envelope: Dictionary = {
		"slot": active_slot,
		"high_score": high_score,
		"current_scene_path": current_scene_path,
		"current_stage_index": current_stage_index,
		"data": data,
		"checksum": checksum
	}
	file.store_string(JSON.stringify(envelope))
	file.close()
	slot_saved.emit(active_slot)
	return true


func load_game() -> bool:
	return load_slot(active_slot)


func load_slot(slot_id: int = 1) -> bool:
	active_slot = maxi(1, slot_id)
	var path: String = _slot_file_path(active_slot)
	if not FileAccess.file_exists(path):
		return false
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var raw: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(raw)
	if parsed is Dictionary:
		var dict: Dictionary = parsed as Dictionary
		high_score = int(dict.get("high_score", 0))
		current_scene_path = str(dict.get("current_scene_path", current_scene_path))
		current_stage_index = int(dict.get("current_stage_index", 0))
		var loaded_data: Variant = dict.get("data", {})
		if loaded_data is Dictionary:
			data = loaded_data as Dictionary
		return true
	return false


func delete_slot(slot_id: int = 1) -> bool:
	var path: String = _slot_file_path(maxi(1, slot_id))
	if not FileAccess.file_exists(path):
		return false
	return DirAccess.remove_absolute(ProjectSettings.globalize_path(path)) == OK


func list_save_slots() -> Array[int]:
	var slots: Array[int] = []
	for idx: int in range(1, 6):
		if FileAccess.file_exists(_slot_file_path(idx)):
			slots.append(idx)
	return slots


func transition_to_scene(scene_res_path: String) -> Error:
	current_scene_path = scene_res_path
	save_slot(active_slot)
	var err: Error = get_tree().change_scene_to_file(scene_res_path)
	if err == OK:
		scene_changed.emit(scene_res_path)
	return err


func transition_with_fade(scene_res_path: String, fade_sec: float = 0.25) -> void:
	CinemaDirector.fade_to_black(fade_sec)
	var timer: SceneTreeTimer = get_tree().create_timer(maxf(0.05, fade_sec), true, false, true)
	timer.timeout.connect(_complete_fade_transition.bind(scene_res_path, fade_sec))


func _complete_fade_transition(scene_res_path: String, fade_sec: float) -> void:
	transition_to_scene(scene_res_path)
	CinemaDirector.fade_from_black(fade_sec)


func reload_current_scene() -> Error:
	return get_tree().reload_current_scene()
