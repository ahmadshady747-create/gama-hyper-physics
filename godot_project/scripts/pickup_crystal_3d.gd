extends Area3D

## GAMA 3D Collectible Energy Crystal Prefab Controller.
## Rotates smoothly and awards score + 3D particle burst when touched by a player.

@export var score_value: int = 50
@export var spin_speed: float = 2.8

var _base_y: float = 0.0
var _time: float = 0.0


func _ready() -> void:
	_base_y = position.y
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	_time += delta
	rotate_y(spin_speed * delta)
	position.y = _base_y + sin(_time * 3.2) * 0.2


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		GameState.add_score(score_value)
		ProceduralVFX.spawn_burst_3d(global_position, Color(0.98, 0.82, 0.2, 1.0), 18)
		Juice.reward()
		AudioSynth.play_tone(960.0, 0.1, 0.25)
		queue_free()
