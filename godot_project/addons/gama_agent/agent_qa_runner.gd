extends SceneTree
## Headless QA Runner for AI Agents:
## Usage: godot --headless --path godot_project --script res://addons/gama_agent/agent_qa_runner.gd -- --scene=res://scenes/main.tscn --frames=120

func _initialize() -> void:
	var scene_path := "res://scenes/main.tscn"
	var frames_to_run := 120

	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--scene="):
			scene_path = arg.trim_prefix("--scene=")
		elif arg.begins_with("--frames="):
			frames_to_run = maxi(1, int(arg.trim_prefix("--frames=")))

	var packed := load(scene_path) as PackedScene
	if packed == null:
		print(JSON.stringify({
			"ok": false,
			"error": "Failed to load scene: " + scene_path
		}))
		quit(1)
		return

	var instance := packed.instantiate()
	root.add_child(instance)

	var t0 := Time.get_ticks_usec()
	for i in range(frames_to_run):
		await process_frame
	var elapsed_ms := float(Time.get_ticks_usec() - t0) / 1000.0

	var node_count := _count_nodes(instance)
	var player := instance.get_node_or_null("Player")
	var player_pos := {}
	if player is Node3D:
		var p3 := (player as Node3D).global_position
		player_pos = {"x": snappedf(p3.x, 0.01), "y": snappedf(p3.y, 0.01), "z": snappedf(p3.z, 0.01)}
	elif player is Node2D:
		var p2 := (player as Node2D).global_position
		player_pos = {"x": snappedf(p2.x, 0.01), "y": snappedf(p2.y, 0.01)}

	print(JSON.stringify({
		"ok": true,
		"scene": scene_path,
		"frames_simulated": frames_to_run,
		"elapsed_ms": snappedf(elapsed_ms, 0.01),
		"node_count": node_count,
		"player_position": player_pos
	}))
	quit(0)

func _count_nodes(node: Node) -> int:
	var count := 1
	for child in node.get_children():
		count += _count_nodes(child)
	return count
