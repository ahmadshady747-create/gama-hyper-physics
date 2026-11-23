extends Node

## GAMA InventorySystem Autoload for Godot 4 AI Agents.
## Provides lightweight item/currency stack management, equipment flags,
## DialogueSystem pickup notifications, and automatic GameState persistence.

signal item_added(item_id: String, new_quantity: int)
signal item_removed(item_id: String, remaining_quantity: int)

var _items: Dictionary = {}


func _ready() -> void:
	var saved: Variant = GameState.get_value("inventory_items", {})
	if saved is Dictionary:
		_items = (saved as Dictionary).duplicate()


func add_item(item_id: String, count: int = 1, notify: bool = true) -> int:
	if item_id == "" or count <= 0:
		return 0
	var current: int = int(_items.get(item_id, 0)) + count
	_items[item_id] = current
	GameState.set_value("inventory_items", _items)
	item_added.emit(item_id, current)
	if notify:
		AudioSynth.play_tone(1080.0, 0.08, 0.2)
		DialogueSystem.show_line("ITEM ACQUIRED", item_id.to_upper() + " x" + str(current), 1.8)
	return current


func has_item(item_id: String, min_count: int = 1) -> bool:
	return int(_items.get(item_id, 0)) >= maxi(1, min_count)


func consume_item(item_id: String, count: int = 1) -> bool:
	var current: int = int(_items.get(item_id, 0))
	if current < count or count <= 0:
		return false
	var next_qty: int = current - count
	if next_qty <= 0:
		_items.erase(item_id)
	else:
		_items[item_id] = next_qty
	GameState.set_value("inventory_items", _items)
	item_removed.emit(item_id, maxi(0, next_qty))
	return true


func get_item_count(item_id: String) -> int:
	return int(_items.get(item_id, 0))


func get_all_items() -> Dictionary:
	return _items.duplicate()
