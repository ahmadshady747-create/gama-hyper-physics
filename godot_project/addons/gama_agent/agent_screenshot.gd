extends SceneTree

## Headless-friendly visual screenshot capture & pixel diagnostics script for AI Coding Agents.
## Note: Requires a rendering driver (e.g., --rendering-driver opengl3), NOT --headless,
## so the GPU/software OpenGL viewport renders real PBR lighting & post-processing.
## Outputs PNG dimensions plus visual health telemetry (avgLuminance, nonBlackRatio, isBlankScreen, activeCamera).

var _scene_path: String = "res://scenes/main.tscn"
var _output_path: String = ".gama_captures/capture.png"
var _frames_to_step: int = 8
var _target_width: int = 0
var _target_height: int = 0
var _elapsed_frames: int = 0
var _captured: bool = false


func _initialize() -> void:
	for arg: String in OS.get_cmdline_user_args():
		if arg.begins_with("--scene="):
			_scene_path = arg.substr(8)
		elif arg.begins_with("--output="):
			_output_path = arg.substr(9)
		elif arg.begins_with("--frames="):
			_frames_to_step = maxi(2, int(arg.substr(9)))
		elif arg.begins_with("--width="):
			_target_width = maxi(320, int(arg.substr(8)))
		elif arg.begins_with("--height="):
			_target_height = maxi(180, int(arg.substr(9)))

	if _target_width > 0 and _target_height > 0:
		get_root().size = Vector2i(_target_width, _target_height)

	var packed: Resource = load(_scene_path)
	if packed == null or not (packed is PackedScene):
		print(JSON.stringify({
			"ok": false,
			"scene": _scene_path,
			"error": "Failed to load PackedScene at " + _scene_path
		}))
		quit(1)
		return

	var instance: Node = (packed as PackedScene).instantiate()
	get_root().add_child(instance)


func _analyze_image_telemetry(img: Image) -> Dictionary:
	var w: int = maxi(1, img.get_width())
	var h: int = maxi(1, img.get_height())
	var step_x: int = maxi(1, int(w / 16.0))
	var step_y: int = maxi(1, int(h / 16.0))
	var sample_count: int = 0
	var non_black_count: int = 0
	var lum_sum: float = 0.0

	var y: int = 0
	while y < h:
		var x: int = 0
		while x < w:
			var c: Color = img.get_pixel(x, y)
			var lum: float = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
			lum_sum += lum
			if lum > 0.015:
				non_black_count += 1
			sample_count += 1
			x += step_x
		y += step_y

	var denom: float = maxf(1.0, float(sample_count))
	var avg_lum: float = snappedf(lum_sum / denom, 0.001)
	var non_black_ratio: float = snappedf(float(non_black_count) / denom, 0.001)
	return {
		"avgLuminance": avg_lum,
		"nonBlackRatio": non_black_ratio,
		"isBlankScreen": non_black_ratio < 0.02
	}


func _detect_active_camera() -> String:
	if get_root().get_camera_3d() != null:
		return "Camera3D"
	if get_root().get_camera_2d() != null:
		return "Camera2D"
	return "CanvasDefault"


func _process(_delta: float) -> bool:
	if _captured:
		return true

	_elapsed_frames += 1
	if _elapsed_frames < _frames_to_step:
		return false

	_captured = true
	var viewport_tex: ViewportTexture = get_root().get_texture()
	if viewport_tex == null:
		print(JSON.stringify({
			"ok": false,
			"scene": _scene_path,
			"error": "ViewportTexture is null (do not pass --headless when capturing screenshots)."
		}))
		quit(1)
		return true

	var img: Image = viewport_tex.get_image()
	if img == null or img.is_empty():
		print(JSON.stringify({
			"ok": false,
			"scene": _scene_path,
			"error": "Captured viewport image is empty."
		}))
		quit(1)
		return true

	var dir_path: String = _output_path.get_base_dir()
	if dir_path != "":
		DirAccess.make_dir_recursive_absolute(dir_path)

	var err: Error = img.save_png(_output_path)
	if err != OK:
		print(JSON.stringify({
			"ok": false,
			"scene": _scene_path,
			"outputPath": _output_path,
			"error": "save_png failed with error code " + str(err)
		}))
		quit(1)
		return true

	var diag: Dictionary = _analyze_image_telemetry(img)
	print(JSON.stringify({
		"ok": true,
		"scene": _scene_path,
		"outputPath": _output_path,
		"width": img.get_width(),
		"height": img.get_height(),
		"framesStepped": _elapsed_frames,
		"activeCamera": _detect_active_camera(),
		"avgLuminance": diag.get("avgLuminance", 0.0),
		"nonBlackRatio": diag.get("nonBlackRatio", 0.0),
		"isBlankScreen": diag.get("isBlankScreen", false)
	}))
	quit(0)
	return true
