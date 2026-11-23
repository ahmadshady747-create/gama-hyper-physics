extends Node

## GAMA CinemaDirector Autoload for Godot 4 AI Agents.
## Provides instant screen flash, vignette/fade transitions, cinematic letterbox bars,
## hit-stop impact freezes, slow-motion pulses, 2D/3D camera trauma shakes, and 2D/3D cutscene focus pans.

signal cutscene_started(label: String)
signal cutscene_finished(label: String)

var _overlay_layer: CanvasLayer = null
var _flash_rect: ColorRect = null
var _top_bar: ColorRect = null
var _bottom_bar: ColorRect = null
var _letterbox_active: bool = false


func _ready() -> void:
	_overlay_layer = CanvasLayer.new()
	_overlay_layer.layer = 100
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(_overlay_layer)

	_flash_rect = ColorRect.new()
	_flash_rect.color = Color(1.0, 1.0, 1.0, 0.0)
	_flash_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay_layer.add_child(_flash_rect)

	_top_bar = ColorRect.new()
	_top_bar.color = Color(0.02, 0.02, 0.04, 0.96)
	_top_bar.offset_left = 0.0
	_top_bar.offset_top = 0.0
	_top_bar.offset_right = 1280.0
	_top_bar.offset_bottom = 0.0
	_top_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay_layer.add_child(_top_bar)

	_bottom_bar = ColorRect.new()
	_bottom_bar.color = Color(0.02, 0.02, 0.04, 0.96)
	_bottom_bar.offset_left = 0.0
	_bottom_bar.offset_top = 720.0
	_bottom_bar.offset_right = 1280.0
	_bottom_bar.offset_bottom = 720.0
	_bottom_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_overlay_layer.add_child(_bottom_bar)


func set_letterbox(enabled: bool, bar_height_px: float = 52.0, duration_sec: float = 0.24) -> void:
	_letterbox_active = enabled
	if _top_bar == null or _bottom_bar == null:
		return
	var target_h: float = clampf(bar_height_px, 0.0, 140.0) if enabled else 0.0
	var dur: float = maxf(0.05, duration_sec)
	var tw: Tween = create_tween().set_parallel(true)
	tw.tween_property(_top_bar, "offset_bottom", target_h, dur)
	tw.tween_property(_bottom_bar, "offset_top", 720.0 - target_h, dur)


func is_letterbox_active() -> bool:
	return _letterbox_active


func flash_screen(color: Color = Color(1.0, 0.95, 0.8, 0.45), duration_sec: float = 0.18) -> void:
	if _flash_rect == null:
		return
	_flash_rect.color = color
	var tw: Tween = create_tween()
	tw.tween_property(_flash_rect, "color:a", 0.0, maxf(0.05, duration_sec))


func fade_to_black(duration_sec: float = 0.35) -> void:
	if _flash_rect == null:
		return
	_flash_rect.color = Color(0.0, 0.0, 0.0, 0.0)
	var tw: Tween = create_tween()
	tw.tween_property(_flash_rect, "color:a", 1.0, maxf(0.05, duration_sec))


func fade_from_black(duration_sec: float = 0.35) -> void:
	if _flash_rect == null:
		return
	_flash_rect.color = Color(0.0, 0.0, 0.0, 1.0)
	var tw: Tween = create_tween()
	tw.tween_property(_flash_rect, "color:a", 0.0, maxf(0.05, duration_sec))


func hit_stop(freeze_sec: float = 0.055) -> void:
	Engine.time_scale = 0.05
	var timer: SceneTreeTimer = get_tree().create_timer(maxf(0.015, freeze_sec) * Engine.time_scale, true, false, true)
	timer.timeout.connect(_restore_time_scale)


func slow_mo_pulse(time_scale: float = 0.25, duration_sec: float = 0.22) -> void:
	Engine.time_scale = clampf(time_scale, 0.05, 1.0)
	var timer: SceneTreeTimer = get_tree().create_timer(duration_sec * Engine.time_scale, true, false, true)
	timer.timeout.connect(_restore_time_scale)


func _restore_time_scale() -> void:
	Engine.time_scale = 1.0


func shake_camera_2d(intensity: float = 7.0, duration_sec: float = 0.16) -> void:
	var cam: Camera2D = get_viewport().get_camera_2d()
	if cam == null:
		return
	var base_offset: Vector2 = cam.offset
	var step_sec: float = maxf(0.02, duration_sec * 0.25)
	var tw: Tween = create_tween()
	tw.tween_property(cam, "offset", base_offset + Vector2(intensity, -intensity * 0.7), step_sec)
	tw.tween_property(cam, "offset", base_offset + Vector2(-intensity * 0.8, intensity * 0.6), step_sec)
	tw.tween_property(cam, "offset", base_offset + Vector2(intensity * 0.4, -intensity * 0.3), step_sec)
	tw.tween_property(cam, "offset", base_offset, step_sec)


func shake_camera_3d(intensity: float = 0.16, duration_sec: float = 0.16) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	var base_h: float = cam.h_offset
	var base_v: float = cam.v_offset
	var step_sec: float = maxf(0.02, duration_sec * 0.5)
	var tw: Tween = create_tween().set_parallel(true)
	cam.h_offset = base_h + intensity
	cam.v_offset = base_v - intensity * 0.6
	tw.tween_property(cam, "h_offset", base_h, step_sec * 2.0)
	tw.tween_property(cam, "v_offset", base_v, step_sec * 2.0)


func focus_target_2d(world_pos: Vector2, hold_sec: float = 0.45) -> void:
	var cam: Camera2D = get_viewport().get_camera_2d()
	if cam == null:
		return
	cutscene_started.emit("focus_2d")
	var origin_pos: Vector2 = cam.global_position
	var tw: Tween = create_tween()
	tw.tween_property(cam, "global_position", world_pos, 0.2)
	tw.tween_interval(maxf(0.05, hold_sec))
	tw.tween_property(cam, "global_position", origin_pos, 0.2)
	tw.finished.connect(_on_cutscene_done.bind("focus_2d"))


func focus_target_3d(
	world_pos: Vector3,
	camera_offset: Vector3 = Vector3(0.0, 3.5, 5.5),
	hold_sec: float = 0.55
) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	cutscene_started.emit("focus_3d")
	set_letterbox(true, 48.0, 0.2)
	var origin_pos: Vector3 = cam.global_position
	var target_cam_pos: Vector3 = world_pos + camera_offset
	var tw: Tween = create_tween()
	tw.tween_property(cam, "global_position", target_cam_pos, 0.25)
	tw.tween_interval(maxf(0.05, hold_sec))
	tw.tween_property(cam, "global_position", origin_pos, 0.25)
	tw.finished.connect(_on_focus_3d_done)


func orbit_sweep_3d(
	center_pos: Vector3,
	radius: float = 7.0,
	height: float = 4.2,
	duration_sec: float = 0.9
) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	cutscene_started.emit("orbit_3d")
	var origin_pos: Vector3 = cam.global_position
	var step_dur: float = maxf(0.08, duration_sec / 3.0)
	var wp_a: Vector3 = center_pos + Vector3(radius, height, 0.0)
	var wp_b: Vector3 = center_pos + Vector3(0.0, height, radius)
	var tw: Tween = create_tween()
	tw.tween_property(cam, "global_position", wp_a, step_dur)
	tw.tween_property(cam, "global_position", wp_b, step_dur)
	tw.tween_property(cam, "global_position", origin_pos, step_dur)
	tw.finished.connect(_on_cutscene_done.bind("orbit_3d"))


func _on_focus_3d_done() -> void:
	set_letterbox(false, 48.0, 0.2)
	cutscene_finished.emit("focus_3d")


func _on_cutscene_done(label: String) -> void:
	cutscene_finished.emit(label)


func punch_zoom_2d(scale_factor: float = 1.15, duration_sec: float = 0.18) -> void:
	var cam: Camera2D = get_viewport().get_camera_2d()
	if cam == null:
		return
	var base_zoom: Vector2 = cam.zoom
	cam.zoom = base_zoom * scale_factor
	var tw: Tween = create_tween()
	tw.tween_property(cam, "zoom", base_zoom, maxf(0.05, duration_sec))


func punch_fov_3d(fov_delta: float = -8.0, duration_sec: float = 0.2) -> void:
	var cam: Camera3D = get_viewport().get_camera_3d()
	if cam == null:
		return
	var base_fov: float = cam.fov
	cam.fov = clampf(base_fov + fov_delta, 30.0, 120.0)
	var tw: Tween = create_tween()
	tw.tween_property(cam, "fov", base_fov, maxf(0.05, duration_sec))
