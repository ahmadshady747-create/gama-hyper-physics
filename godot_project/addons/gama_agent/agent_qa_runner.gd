extends SceneTree

## Headless QA Runner for AI Agents (v5.15 Deep Telemetry Edition):
## Usage: godot --headless --path godot_project --script res://addons/gama_agent/agent_qa_runner.gd -- --scene=res://scenes/main.tscn --frames=120


func _initialize() -> void:
	var scene_path: String = "res://scenes/main.tscn"
	var frames_to_run: int = 120

	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--scene="):
			scene_path = arg.trim_prefix("--scene=")
		elif arg.begins_with("--frames="):
			frames_to_run = maxi(1, int(arg.trim_prefix("--frames=")))

	var packed: PackedScene = load(scene_path) as PackedScene
	if packed == null:
		print(JSON.stringify({
			"ok": false,
			"error": "Failed to load scene: " + scene_path
		}))
		quit(1)
		return

	var instance: Node = packed.instantiate()
	root.add_child(instance)

	var t0: int = Time.get_ticks_usec()
	for _i: int in range(frames_to_run):
		await process_frame
	var elapsed_ms: float = float(Time.get_ticks_usec() - t0) / 1000.0

	var node_count: int = _count_nodes(instance)
	var player: Node = _find_player_node(instance)
	var player_pos: Dictionary = {}
	if player is Node3D:
		var p3: Vector3 = (player as Node3D).global_position
		player_pos = {"x": snappedf(p3.x, 0.01), "y": snappedf(p3.y, 0.01), "z": snappedf(p3.z, 0.01)}
	elif player is Node2D:
		var p2: Vector2 = (player as Node2D).global_position
		player_pos = {"x": snappedf(p2.x, 0.01), "y": snappedf(p2.y, 0.01)}

	var mem_mb: float = float(OS.get_static_memory_usage()) / (1024.0 * 1024.0)
	var enemies_count: int = get_nodes_in_group("enemies").size()
	var pickups_count: int = get_nodes_in_group("pickups").size()

	print(JSON.stringify({
		"ok": true,
		"scene": scene_path,
		"frames_simulated": frames_to_run,
		"elapsed_ms": snappedf(elapsed_ms, 0.01),
		"node_count": node_count,
		"enemies_count": enemies_count,
		"pickups_count": pickups_count,
		"static_memory_mb": snappedf(mem_mb, 0.1),
		"player_found": player != null,
		"player_position": player_pos
	}))
	quit(0)


func _find_player_node(root_node: Node) -> Node:
	var grouped: Array[Node] = get_nodes_in_group("player")
	if not grouped.is_empty():
		return grouped[0]
	for child: Node in root_node.get_children():
		if child.name.to_lower().contains("player"):
			return child
	return null


func _count_nodes(node: Node) -> int:
	var count: int = 1
	for child: Node in node.get_children():
		count += _count_nodes(child)
	return count
