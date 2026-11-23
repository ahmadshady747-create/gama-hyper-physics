extends Node

## GAMA ObjectPool Autoload for Godot 4 AI Agents.
## Recycles frequently spawned 2D/3D nodes (projectiles, particles, enemies)
## to prevent frame-time GC spikes on integrated GPUs and 8GB RAM machines.

var _pools: Dictionary = {}


func prewarm(pool_key: String, scene: PackedScene, count: int = 8) -> void:
	if scene == null or count <= 0:
		return
	if not _pools.has(pool_key):
		_pools[pool_key] = []
	var bucket: Array = _pools[pool_key] as Array
	for _i: int in range(count):
		var inst: Node = scene.instantiate()
		_deactivate_node(inst)
		bucket.append(inst)


func acquire(pool_key: String, fallback_scene: PackedScene = null) -> Node:
	if _pools.has(pool_key):
		var bucket: Array = _pools[pool_key] as Array
		while not bucket.is_empty():
			var candidate: Variant = bucket.pop_back()
			if candidate is Node and is_instance_valid(candidate):
				var node: Node = candidate as Node
				_activate_node(node)
				return node

	if fallback_scene != null:
		return fallback_scene.instantiate()
	return null


func release(pool_key: String, node: Node) -> void:
	if node == null or not is_instance_valid(node):
		return
	if not _pools.has(pool_key):
		_pools[pool_key] = []
	_deactivate_node(node)
	var parent: Node = node.get_parent()
	if parent != null:
		parent.remove_child(node)
	(_pools[pool_key] as Array).append(node)


func clear_pool(pool_key: String) -> void:
	if not _pools.has(pool_key):
		return
	var bucket: Array = _pools[pool_key] as Array
	for item: Variant in bucket:
		if item is Node and is_instance_valid(item):
			(item as Node).queue_free()
	_pools.erase(pool_key)


func get_pool_size(pool_key: String) -> int:
	if not _pools.has(pool_key):
		return 0
	return (_pools[pool_key] as Array).size()


func _deactivate_node(node: Node) -> void:
	node.process_mode = Node.PROCESS_MODE_DISABLED
	if node is CanvasItem:
		(node as CanvasItem).visible = false
	elif node is Node3D:
		(node as Node3D).visible = false


func _activate_node(node: Node) -> void:
	node.process_mode = Node.PROCESS_MODE_INHERIT
	if node is CanvasItem:
		(node as CanvasItem).visible = true
	elif node is Node3D:
		(node as Node3D).visible = true
