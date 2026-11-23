import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ShaderPresetSpec {
  presetId: 'neon_pulse_canvas' | 'hit_flash_canvas' | 'hologram_spatial_3d';
  relativePath: string;
}

const SHADER_TEMPLATES: Record<ShaderPresetSpec['presetId'], string> = {
  neon_pulse_canvas: `shader_type canvas_item;

uniform vec4 glow_color : source_color = vec4(0.0, 0.9, 0.77, 1.0);
uniform float pulse_speed : hint_range(0.5, 10.0) = 3.2;
uniform float glow_strength : hint_range(0.0, 2.0) = 0.45;

void fragment() {
	vec4 base = texture(TEXTURE, UV) * COLOR;
	float wave = (sin(TIME * pulse_speed) + 1.0) * 0.5;
	vec3 mixed = mix(base.rgb, glow_color.rgb, wave * glow_strength);
	COLOR = vec4(mixed, base.a);
}
`,
  hit_flash_canvas: `shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec4 base = texture(TEXTURE, UV) * COLOR;
	vec3 flashed = mix(base.rgb, flash_color.rgb, flash_amount);
	COLOR = vec4(flashed, base.a);
}
`,
  hologram_spatial_3d: `shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, unshaded;

uniform vec4 holo_color : source_color = vec4(0.0, 0.92, 0.82, 0.78);
uniform float scanline_density : hint_range(10.0, 120.0) = 48.0;
uniform float scroll_speed : hint_range(0.5, 8.0) = 2.4;

void fragment() {
	float scan = sin((UV.y + TIME * scroll_speed * 0.1) * scanline_density) * 0.5 + 0.5;
	ALBEDO = holo_color.rgb * (0.75 + scan * 0.35);
	ALPHA = holo_color.a * (0.65 + scan * 0.35);
}
`,
};

/**
 * Generates lightweight Godot 4 `.gdshader` files compatible with the `gl_compatibility`
 * renderer, and audits `.gdshader` code for mandatory `shader_type` declarations.
 */
export function generateGdShaderPreset(
  projectDir: string,
  spec: ShaderPresetSpec
): {
  ok: boolean;
  presetId: string;
  savedShader: string;
  bytes: number;
} {
  const code = SHADER_TEMPLATES[spec.presetId];
  if (!code) {
    throw new Error(`Unknown shader preset: ${String(spec.presetId)}`);
  }
  const cleanRel = spec.relativePath.replace(/^res:\/\//, '');
  const absOut = resolve(projectDir, cleanRel);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, code, 'utf-8');

  return {
    ok: true,
    presetId: spec.presetId,
    savedShader: `res://${cleanRel}`,
    bytes: code.length,
  };
}

export function auditGdShader(
  projectDir: string,
  shaderRelativePath: string
): {
  valid: boolean;
  shaderPath: string;
  shaderType: string | null;
  issues: string[];
} {
  const cleanRel = shaderRelativePath.replace(/^res:\/\//, '');
  const abs = resolve(projectDir, cleanRel);
  if (!existsSync(abs)) {
    throw new Error(`Shader file not found: ${shaderRelativePath}`);
  }
  const src = readFileSync(abs, 'utf-8');
  const issues: string[] = [];
  const typeMatch = /^\s*shader_type\s+(canvas_item|spatial|particles|sky|fog)\s*;/m.exec(src);
  if (!typeMatch) {
    issues.push('Missing mandatory `shader_type <canvas_item|spatial|particles|sky|fog>;` declaration.');
  }
  if (/\bhint_color\b/.test(src)) {
    issues.push('Deprecated Godot 3 `hint_color` uniform hint found; use `: source_color` in Godot 4.');
  }
  return {
    valid: issues.length === 0,
    shaderPath: `res://${cleanRel}`,
    shaderType: typeMatch ? typeMatch[1] : null,
    issues,
  };
}
