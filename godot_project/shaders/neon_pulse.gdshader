shader_type canvas_item;

uniform vec4 glow_color : source_color = vec4(0.0, 0.9, 0.77, 1.0);
uniform float pulse_speed : hint_range(0.5, 10.0) = 3.2;
uniform float glow_strength : hint_range(0.0, 2.0) = 0.45;

void fragment() {
	vec4 base = texture(TEXTURE, UV) * COLOR;
	float wave = (sin(TIME * pulse_speed) + 1.0) * 0.5;
	vec3 mixed = mix(base.rgb, glow_color.rgb, wave * glow_strength);
	COLOR = vec4(mixed, base.a);
}
