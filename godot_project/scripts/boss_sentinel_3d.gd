extends CharacterBody3D

## GAMA 3D Arena Boss Sentinel Controller for Godot 4 AI Agents.
##Orbits the 3D arena center, periodically fires Projectile3D bursts toward the player,
## enters an enraged high-speed phase below 50% HP, and completes `defeat_boss_3d` quest.

@export var projectile_scene: PackedScene = preload("res://scenes/projectile_3d.tscn")
@export var orbit_radius: float = 6.5
@export var orbit_speed: float = 1.2
@export var fire_interval_sec: float = 1.6
@export var max_hp: int = 320
@export var score_reward: int = 800
@export var quest_id_on_defeat: String = "defeat_boss_3d"

var _angle: float = 0.0
var _fire_timer: float = 1.2
var _enraged: bool = false


func _ready() -> void:
	add_to_group("enemies")
	add_to_group("bosses")
	CombatSystem.register_entity(self, max_hp)
	CombatSystem.entity_damaged.connect(_on_entity_damaged)
	CombatSystem.entity_defeated.connect(_on_entity_defeated)


func _physics_process(delta: float) -> void:
	var speed_mult: float = 1.75 if _enraged else 1.0
	_angle += delta * orbit_speed * speed_mult
	var desired_pos: Vector3 = Vector3(cos(_angle) * orbit_radius, 2.2 + sin(_angle * 2.0) * 0.4, sin(_angle) * orbit_radius)
	velocity = (desired_pos - global_position) * 4.0
	move_and_slide()

	_fire_timer -= delta * speed_mult
	if _fire_timer <= 0.0:
		_fire_timer = maxf(0.45, fire_interval_sec)
		_fire_at_player()


func take_hit(damage: int) -> void:
	CombatSystem.apply_damage(self, damage, score_reward, 160)


func _fire_at_player() -> void:
	if projectile_scene == null:
		return
	var players: Array[Node] = get_tree().get_nodes_in_group("player")
	for p: Node in players:
		if p is Node3D:
			var target_pos: Vector3 = (p as Node3D).global_position
			var bolt: Node = projectile_scene.instantiate()
			if bolt is Area3D:
				var b3d: Area3D = bolt as Area3D
				b3d.global_position = global_position
				b3d.set("direction", (target_pos - global_position).normalized())
				get_tree().current_scene.add_child(b3d)
				AudioSynth.play_tone(280.0, 0.09, 0.24)
			return


func _on_entity_damaged(target: Node, _amount: int, remaining_hp: int) -> void:
	if target != self:
		return
	if not _enraged and remaining_hp <= (max_hp / 2):
		_enraged = true
		CinemaDirector.flash_screen(Color(1.0, 0.15, 0.25, 0.45), 0.25)
		CinemaDirector.punch_fov_3d(-10.0, 0.28)
		DialogueSystem.show_line("BOSS SENTINEL", "WARNING — CORE OVERDRIVE ENGAGED!", 2.4)


func _on_entity_defeated(target: Node, _reward: int) -> void:
	if target != self:
		return
	ProceduralVFX.spawn_burst_3d(global_position, Color(1.0, 0.85, 0.2, 1.0), 40)
	if quest_id_on_defeat != "":
		QuestSystem.advance_quest(quest_id_on_defeat, 1)
