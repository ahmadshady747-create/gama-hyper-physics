extends Area2D

## GAMA 2D Treasure Chest & Loot Dropper Controller for Godot 4 AI Agents.
## Opens when touched by a player, grants an item into InventorySystem,
## awards bonus score, and spawns a golden ProceduralVFX celebration burst.

@export var item_id: String = "ancient_key"
@export var item_count: int = 1
@export var score_bonus: int = 100

var _opened: bool = false

@onready var _lid_visual: Polygon2D = $ChestVisual


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if _opened or body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		_opened = true
		InventorySystem.add_item(item_id, item_count, true)
		GameState.add_score(score_bonus)
		if _lid_visual != null:
			_lid_visual.color = Color(0.2, 0.96, 0.58, 1.0)
		ProceduralVFX.spawn_burst_2d(global_position, Color(1.0, 0.85, 0.2, 1.0), 26)
		Juice.reward()
