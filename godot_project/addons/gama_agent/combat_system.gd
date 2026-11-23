extends Node

## GAMA Universal CombatSystem Autoload for Godot 4 AI Agents.
## Provides instant damage calculation, invulnerability windows, knockback vectors,
## score awards, and automatic Juice/CinemaDirector/AudioSynth combat feedback.

signal entity_damaged(target: Node, amount: int, remaining_hp: int)
signal entity_defeated(target: Node, score_reward: int)

var _hp_registry: Dictionary = {}
var _iframes_until_ms: Dictionary = {}


func register_entity(entity: Node, max_hp: int) -> void:
	if entity == null:
		return
	var id: int = entity.get_instance_id()
	_hp_registry[id] = max_hp
	_iframes_until_ms[id] = 0


func get_hp(entity: Node, default_hp: int = 100) -> int:
	if entity == null:
		return 0
	return int(_hp_registry.get(entity.get_instance_id(), default_hp))


func apply_damage(
	target: Node,
	amount: int,
	score_on_defeat: int = 25,
	iframe_ms: int = 250
) -> bool:
	if target == null or amount <= 0:
		return false
	var id: int = target.get_instance_id()
	var now_ms: int = Time.get_ticks_msec()
	var locked_until: int = int(_iframes_until_ms.get(id, 0))
	if now_ms < locked_until:
		return false

	var current_hp: int = int(_hp_registry.get(id, 100))
	var next_hp: int = maxi(0, current_hp - amount)
	_hp_registry[id] = next_hp
	_iframes_until_ms[id] = now_ms + iframe_ms

	Juice.hit_heavy()
	CinemaDirector.shake_camera_2d(6.5, 0.14)
	CinemaDirector.shake_camera_3d(0.14, 0.14)
	AudioSynth.play_tone(180.0, 0.09, 0.25)
	entity_damaged.emit(target, amount, next_hp)

	if next_hp <= 0:
		GameState.add_score(score_on_defeat)
		CinemaDirector.hit_stop(0.045)
		CinemaDirector.slow_mo_pulse(0.3, 0.14)
		entity_defeated.emit(target, score_on_defeat)
		_hp_registry.erase(id)
		_iframes_until_ms.erase(id)
		target.queue_free()
		return true

	return false
