import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type InputKeyName =
  | 'A'
  | 'D'
  | 'W'
  | 'S'
  | 'SPACE'
  | 'E'
  | 'Q'
  | 'SHIFT'
  | 'ENTER'
  | 'ESCAPE'
  | 'LEFT'
  | 'RIGHT'
  | 'UP'
  | 'DOWN';

export interface InputActionSpec {
  actionName: string;
  keys: InputKeyName[];
  deadzone?: number;
}

const KEYCODE_TABLE: Record<InputKeyName, { keycode: number; unicode: number }> = {
  A: { keycode: 65, unicode: 97 },
  D: { keycode: 68, unicode: 100 },
  W: { keycode: 87, unicode: 119 },
  S: { keycode: 83, unicode: 115 },
  SPACE: { keycode: 32, unicode: 32 },
  E: { keycode: 69, unicode: 101 },
  Q: { keycode: 81, unicode: 113 },
  SHIFT: { keycode: 4194325, unicode: 0 },
  ENTER: { keycode: 4194309, unicode: 13 },
  ESCAPE: { keycode: 4194305, unicode: 0 },
  LEFT: { keycode: 4194319, unicode: 0 },
  UP: { keycode: 4194320, unicode: 0 },
  RIGHT: { keycode: 4194321, unicode: 0 },
  DOWN: { keycode: 4194322, unicode: 0 },
};

/**
 * Configures or updates an InputMap action in `godot_project/project.godot`
 * so AI agents can add custom controls (e.g. `fire`, `dash`, `interact`, `move_up`, `move_down`)
 * without manually editing serialized Godot `Object(InputEventKey,...)` strings.
 */
export function configureInputAction(
  projectDir: string,
  spec: InputActionSpec
): {
  ok: boolean;
  actionName: string;
  keys: InputKeyName[];
} {
  const projPath = resolve(projectDir, 'project.godot');
  if (!existsSync(projPath)) {
    throw new Error(`project.godot not found at ${projPath}`);
  }

  const cleanAction = spec.actionName.replace(/[^a-zA-Z0-9_]/g, '');
  if (!cleanAction) {
    throw new Error('Invalid actionName');
  }

  const deadzone = typeof spec.deadzone === 'number' ? spec.deadzone : 0.2;
  const eventStrings = spec.keys.map((k) => {
    const info = KEYCODE_TABLE[k] ?? KEYCODE_TABLE.E;
    return `Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":${info.keycode},"physical_keycode":0,"key_label":0,"unicode":${info.unicode})`;
  });

  const block = [
    `${cleanAction}={`,
    `"deadzone": ${deadzone},`,
    `"events": [${eventStrings.join(', ')}]`,
    `}`,
  ].join('\n');

  let content = readFileSync(projPath, 'utf-8');
  const existingRegex = new RegExp(
    `^${cleanAction}=\\{[\\s\\S]*?^\\}`,
    'm'
  );

  if (existingRegex.test(content)) {
    content = content.replace(existingRegex, block);
  } else if (content.includes('[input]')) {
    content = content.replace('[input]\n', `[input]\n\n${block}\n`);
  } else {
    content += `\n[input]\n\n${block}\n`;
  }

  writeFileSync(projPath, content, 'utf-8');
  return {
    ok: true,
    actionName: cleanAction,
    keys: spec.keys,
  };
}
