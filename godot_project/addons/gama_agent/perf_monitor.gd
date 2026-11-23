extends Node

## GAMA PerfMonitor Autoload for Godot 4 AI Agents.
## Tracks FPS, frame time, static memory usage, and active node count,
## and emits `performance_warning` if frame rate drops on integrated GPUs.

signal performance_warning(fps: float, memory_mb: float, node_count: int)

@export var min_acceptable_fps: float = 45.0
var _sample_timer: float = 0.0
var _peak_memory_mb: float = 0.0
var _min_fps_recorded: float = 999.0


func _process(delta: float) -> void:
	_sample_timer += delta
	if _sample_timer < 1.0:
		return
	_sample_timer = 0.0

	var fps: float = Engine.get_frames_per_second()
	var mem_mb: float = float(OS.get_static_memory_usage()) / (1024.0 * 1024.0)
	if mem_mb > _peak_memory_mb:
		_peak_memory_mb = mem_mb
	if fps > 0.0 and fps < _min_fps_recorded:
		_min_fps_recorded = fps

	if fps > 0.0 and fps < min_acceptable_fps:
		var nodes: int = int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
		performance_warning.emit(fps, snappedf(mem_mb, 0.1), nodes)


func get_snapshot() -> Dictionary:
	var fps: float = Engine.get_frames_per_second()
	var mem_mb: float = float(OS.get_static_memory_usage()) / (1024.0 * 1024.0)
	var nodes: int = int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	var draw_calls: int = int(Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME))
	return {
		"fps": fps,
		"minFpsRecorded": _min_fps_recorded if _min_fps_recorded < 999.0 else fps,
		"staticMemoryMb": snappedf(mem_mb, 0.1),
		"peakMemoryMb": snappedf(maxf(mem_mb, _peak_memory_mb), 0.1),
		"nodeCount": nodes,
		"drawCalls": draw_calls
	}
