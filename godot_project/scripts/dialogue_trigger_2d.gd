extends Area2D

## GAMA 2D Dialogue & Quest Trigger Zone Controller for Godot 4 AI Agents.
## Triggers a narrative line via DialogueSystem when entered by a player.

@export var speaker_name: String = "AI GUIDE"
@export var dialogue_text: String = "Reach the checkpoint and clear the sector!"
@export var display_duration_sec: float = 3.2
@export var trigger_once: bool = true

var _triggered: bool = false


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if trigger_once and _triggered:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		_triggered = true
		DialogueSystem.show_line(speaker_name, dialogue_text, display_duration_sec)
