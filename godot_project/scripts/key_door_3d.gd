extends Area3D

## GAMA 3D Key-Gated Security Door Controller for Godot 4 AI Agents.
## Checks InventorySystem for `required_key_id`; unlocks, slides upward,
## spawns 3D particle burst, and advances optional quest when unlocked.

@export var required_key_id: String = "ancient_key"
@export var consume_key: bool = true
@export var unlock_quest_id: String = "unlock_gate"

var _unlocked: bool = false

@onready var _blocker: StaticBody3D = $DoorBlocker


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if _unlocked or body == null:
		return
	if not (body.is_in_group("player") or body.name.to_lower().contains("player")):
		return

	if required_key_id != "" and not InventorySystem.has_item(required_key_id, 1):
		DialogueSystem.show_line("SECURITY GATE", "LOCKED — Requires item: " + required_key_id.to_upper(), 2.2)
		AudioSynth.play_tone(220.0, 0.1, 0.22)
		return

	if required_key_id != "" and consume_key:
		InventorySystem.consume_item(required_key_id, 1)

	_unlocked = true
	ProceduralVFX.spawn_burst_3d(global_position, Color(0.2, 0.98, 0.65, 1.0), 24)
	AudioSynth.play_tone(980.0, 0.14, 0.25)
	DialogueSystem.show_line("SECURITY GATE", "ACCESS GRANTED — Gate Unlocked!", 2.2)

	if unlock_quest_id != "":
		QuestSystem.advance_quest(unlock_quest_id, 1)

	if _blocker != null:
		_blocker.queue_free()
	var tw: Tween = create_tween()
	tw.tween_property(self, "position:y", position.y + 3.5, 0.45)
