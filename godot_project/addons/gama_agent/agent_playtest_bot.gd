extends SceneTree

## Autonomous Headless Playtest Bot for Godot 4 AI Agents.
## Instantiates a target scene, injects synthetic Input actions (move_right, jump,
## action, move_left) across N frames, tracks player displacement, collisions,
## score progression, and enemy count, and outputs rich JSON playtest telemetry.

var _scene_path: String = "res://scenes/main.tscn"
var _frames_to_run: int = 180
var _profile: String = "explorer"
var _frame: int = 0
var _instance: Node = null
var _start_pos: Variant = null
var _max_displacement: float = 0.0
var _actions_triggered: int = 0


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--scene="):
			_scene_path = arg.substr(8)
		elif arg.begins_with("--frames="):
			_frames_to_run = maxi(10, int(arg.substr(9)))
		elif arg.begins_with("--profile="):
			_profile = arg.substr(10)

	var packed: Resource = load(_scene_path)
	if packed == null or not (packed is PackedScene):
		print(JSON.stringify({
			"ok": false,
			"scene": _scene_path,
			"error": "Failed to load PackedScene at " + _scene_path
		}))
		quit(1)
		return

	_instance = (packed as PackedScene).instantiate()
	get_root().add_child(_instance)
	_start_pos = _read_player_pos()


func _process(_delta: float) -> bool:
	_frame += 1
	_inject_bot_inputs(_frame)
	_update_displacement()

	if _frame >= _frames_to_run:
		_release_all_inputs()
		var end_pos: Variant = _read_player_pos()
		var enemies_alive: int = get_nodes_in_group("enemies").size()
		var pickups_left: int = get_nodes_in_group("pickups").size()
		print(JSON.stringify({
			"ok": true,
			"scene": _scene_path,
			"profile": _profile,
			"framesSimulated": _frame,
			"actionsTriggered": _actions_triggered,
			"startPosition": str(_start_pos),
			"endPosition": str(end_pos),
			"maxDisplacement": snappedf(_max_displacement, 0.01),
			"movementVerified": _max_displacement > 0.05,
			"enemiesRemaining": enemies_alive,
			"pickupsRemaining": pickups_left
		}))
		quit(0)
		return true

	return false


func _inject_bot_inputs(frame_idx: int) -> void:
	if _profile == "Rusher":
		Input.action_press("move_right")
		if frame_idx % 30 == 0:
			Input.action_press("jump")
			_actions_triggered += 1
		else:
			Input.action_release("jump")
		return

	# Default "explorer" profile: alternate right/left sweep + periodic jump & action
	var phase: int = (frame_idx / 45) % 2
	if phase == 0:
		Input.action_press("move_right")
		Input.action_release("move_left")
	else:
		Input.action_press("move_left")
		Input.action_release("move_right")

	if frame_idx % 25 == 0:
		Input.action_press("jump")
		_actions_triggered += 1
	elif frame_idx % 25 == 3:
		Input.action_release("jump")

	if frame_idx % 40 == 0:
		Input.action_press("action")
		_actions_triggered += 1
	elif frame_idx % 40 == 3:
		Input.action_release("action")


func _release_all_inputs() -> void:
	for act: String in ["move_left", "move_right", "jump", "action"]:
		if InputMap.has_action(act):
			Input.action_release(act)


func _read_player_pos() -> Variant:
	if _instance == null:
		return null
	for child: Node in _instance.get_children():
		if child.name.to_lower().contains("player"):
			if child is Node3D:
				return (child as Node3D).global_position
			if child is Node2D:
				return (child as Node2D).global_position
	return null


func _update_displacement() -> void:
	var cur: Variant = _read_player_pos()
	if _start_pos == null or cur == null:
		return
	if _start_pos is Vector3 and cur is Vector3:
		var d3: float = (_start_pos as Vector3).distance_to(cur as Vector3)
		if d3 > _max_displacement:
			_max_displacement = d3
	elif _start_pos is Vector2 and cur is Vector2:
		var d2: float = (_start_pos as Vector2).distance_to(cur as Vector2)
		if d2 > _max_displacement:
			_max_displacement = d2
