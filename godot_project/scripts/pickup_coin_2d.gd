extends Area2D

## GAMA 2D Collectible Pickup Prefab Controller.
## Awards score via GameState, triggers ProceduralVFX burst, AudioSynth chime, and Juice reward.

@export var score_value: int = 25
@export var heal_amount: int = 0
@export var bob_amplitude: float = 5.0
@export var bob_speed: float = 4.0

var _base_y: float = 0.0
var _time: float = 0.0


func _ready() -> void:
	_base_y = position.y
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	_time += delta
	position.y = _base_y + sin(_time * bob_speed) * bob_amplitude


func _on_body_entered(body: Node) -> void:
	if body == null:
		return
	if body.is_in_group("player") or body.name.to_lower().contains("player"):
		GameState.add_score(score_value)
		ProceduralVFX.spawn_burst_2d(global_position, Color(0.15, 0.95, 0.78, 1.0), 16)
		Juice.reward()
		AudioSynth.play_tone(880.0, 0.09, 0.22)
		queue_free()
