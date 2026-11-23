shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, unshaded;

uniform vec4 holo_color : source_color = vec4(0.0, 0.92, 0.82, 0.78);
uniform float scanline_density : hint_range(10.0, 120.0) = 48.0;
uniform float scroll_speed : hint_range(0.5, 8.0) = 2.4;

void fragment() {
	float scan = sin((UV.y + TIME * scroll_speed * 0.1) * scanline_density) * 0.5 + 0.5;
	ALBEDO = holo_color.rgb * (0.75 + scan * 0.35);
	ALPHA = holo_color.a * (0.65 + scan * 0.35);
}
