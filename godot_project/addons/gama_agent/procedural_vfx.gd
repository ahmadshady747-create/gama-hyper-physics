extends Node

## GAMA ProceduralVFX Autoload for Godot 4 AI Agents.
## Generates lightweight CPU-driven 2D & 3D particle bursts (explosions, hit sparks,
## level-up rings) compatible with the GL Compatibility renderer on integrated GPUs.


func spawn_burst_2d(
	world_pos: Vector2,
	color: Color = Color(1.0, 0.78, 0.22, 1.0),
	amount: int = 18
) -> void:
	var scene_root: Node = get_tree().current_scene
	if scene_root == null:
		return

	var particles: CPUParticles2D = CPUParticles2D.new()
	particles.position = world_pos
	particles.amount = clampi(amount, 4, 64)
	particles.lifetime = 0.42
	particles.one_shot = true
	particles.explosiveness = 0.92
	particles.spread = 180.0
	particles.gravity = Vector2(0.0, 420.0)
	particles.initial_velocity_min = 90.0
	particles.initial_velocity_max = 240.0
	particles.scale_amount_min = 3.0
	particles.scale_amount_max = 7.0
	particles.color = color
	scene_root.add_child(particles)
	particles.emitting = true

	var timer: SceneTreeTimer = get_tree().create_timer(0.6)
	timer.timeout.connect(particles.queue_free)


func spawn_burst_3d(
	world_pos: Vector3,
	color: Color = Color(0.0, 0.92, 0.78, 1.0),
	amount: int = 16
) -> void:
	var scene_root: Node = get_tree().current_scene
	if scene_root == null:
		return

	var particles: CPUParticles3D = CPUParticles3D.new()
	particles.position = world_pos
	particles.amount = clampi(amount, 4, 64)
	particles.lifetime = 0.48
	particles.one_shot = true
	particles.explosiveness = 0.9
	particles.spread = 180.0
	particles.initial_velocity_min = 3.0
	particles.initial_velocity_max = 7.5

	var mesh: SphereMesh = SphereMesh.new()
	mesh.radius = 0.08
	mesh.height = 0.16
	var mat: StandardMaterial3D = StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 2.0
	mesh.material = mat
	particles.mesh = mesh

	scene_root.add_child(particles)
	particles.emitting = true

	var timer: SceneTreeTimer = get_tree().create_timer(0.65)
	timer.timeout.connect(particles.queue_free)
