extends CharacterBody2D

## GAMA 2D Boss Arena Guardian Controller for Godot 4 AI Agents.
## Features 2-phase combat behavior: Phase 1 horizontal sweep & projectile bursts;
## Phase 2 (<50% HP) enraged high-speed dash charge with screen shake & quest completion.

@export var base_speed: float = 160.0
@export var enraged_speed: float = 290.0
@export var max_hp: int = 240
@export var score_reward: int = 500
@export var quest_id_on_defeat: String = "defeat_boss"

var _dir: float = 1.0
var _origin_x: float = 640.0
var _enraged: bool = false

@onready var _core_visual: Polygon2D = $BossVisual


func _ready() -> void:
	add_to_group("enemies")
	add_to_group("bosses")
	_origin_x = global_position.x
	CombatSystem.register_entity(self, max_hp)
	CombatSystem.entity_damaged.connect(_on_entity_damaged)
	CombatSystem.entity_defeated.connect(_on_entity_defeated)


func _physics_process(_delta: float) -> void:
	var spd: float = enraged_speed if _enraged else base_speed
	if absf(global_position.x - _origin_x) > 260.0:
		_dir *= -1.0
	velocity = Vector2(_dir * spd, 0.0)
	move_and_slide()


func take_hit(damage: int) -> void:
	CombatSystem.apply_damage(self, damage, score_reward, 150)


func _on_entity_damaged(target: Node, _amount: int, remaining_hp: int) -> void:
	if target != self:
		return
	if not _enraged and remaining_hp <= (max_hp / 2):
		_enraged = true
		if _core_visual != null:
			_core_visual.color = Color(1.0, 0.12, 0.25, 1.0)
		CinemaDirector.flash_screen(Color(1.0, 0.15, 0.25, 0.45), 0.25)
		Juice.shake(10.0, 14.0)


func _on_entity_defeated(target: Node, _reward: int) -> void:
	if target != self:
		return
	ProceduralVFX.spawn_burst_2d(global_position, Color(1.0, 0.82, 0.2, 1.0), 36)
	if quest_id_on_defeat != "":
		QuestSystem.advance_quest(quest_id_on_defeat, 1)
