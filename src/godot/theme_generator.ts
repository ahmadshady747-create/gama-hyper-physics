import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface ThemeResourceSpec {
  relativePath: string;
  primaryColorHex?: string;
  panelBgColorHex?: string;
  borderColorHex?: string;
  cornerRadius?: number;
  defaultFontSize?: number;
}

function hexToGodotColor(hex: string, alpha: number = 1.0): string {
  const clean = hex.replace(/^#/, '');
  const num = parseInt(clean.length === 6 ? clean : '00E5C4', 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return `Color(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, ${alpha.toFixed(2)})`;
}

/**
 * Generates a valid Godot 4 `.tres` (`format=3`) UI Theme resource with styled
 * `StyleBoxFlat` panels and buttons so AI agents can theme menus and HUDs cleanly.
 */
export function generateThemeResource(
  projectDir: string,
  spec: ThemeResourceSpec
): {
  ok: boolean;
  savedResource: string;
  bytes: number;
} {
  const cleanRel = spec.relativePath.replace(/^res:\/\//, '');
  const primary = hexToGodotColor(spec.primaryColorHex ?? '#00E5C4', 1.0);
  const panelBg = hexToGodotColor(spec.panelBgColorHex ?? '#0A101E', 0.94);
  const border = hexToGodotColor(spec.borderColorHex ?? '#00E5C4', 0.85);
  const radius = spec.cornerRadius ?? 10;
  const fontSize = spec.defaultFontSize ?? 20;

  const tres = [
    '[gd_resource type="Theme" load_steps=3 format=3]',
    '',
    '[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_panel"]',
    `bg_color = ${panelBg}`,
    'border_width_left = 2',
    'border_width_top = 2',
    'border_width_right = 2',
    'border_width_bottom = 2',
    `border_color = ${border}`,
    `corner_radius_top_left = ${radius}`,
    `corner_radius_top_right = ${radius}`,
    `corner_radius_bottom_right = ${radius}`,
    `corner_radius_bottom_left = ${radius}`,
    '',
    '[sub_resource type="StyleBoxFlat" id="StyleBoxFlat_button"]',
    `bg_color = ${primary}`,
    `corner_radius_top_left = ${radius}`,
    `corner_radius_top_right = ${radius}`,
    `corner_radius_bottom_right = ${radius}`,
    `corner_radius_bottom_left = ${radius}`,
    '',
    '[resource]',
    `default_font_size = ${fontSize}`,
    'Button/styles/normal = SubResource("StyleBoxFlat_button")',
    'Panel/styles/panel = SubResource("StyleBoxFlat_panel")',
    '',
  ].join('\n');

  const absOut = resolve(projectDir, cleanRel);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, tres, 'utf-8');

  return {
    ok: true,
    savedResource: `res://${cleanRel}`,
    bytes: tres.length,
  };
}
