export interface GodotNodeSpec {
  name: string;
  type: string;
  parent?: string;
  position?: [number, number] | [number, number, number];
  scriptPath?: string;
  properties?: Record<string, string | number | boolean>;
}

export interface GodotSceneSpec {
  rootName: string;
  rootType: 'Node2D' | 'Node3D' | 'Control';
  nodes: GodotNodeSpec[];
}

/**
 * Generates a clean, valid Godot 4 `.tscn` (format=3) scene file from JSON
 * so AI agents can construct 2D/3D/UI scenes reliably without corrupting syntax.
 */
export function generateTscn(spec: GodotSceneSpec): string {
  const scriptResources: Array<{ id: string; path: string }> = [];
  const scriptIdByPath = new Map<string, string>();

  for (const node of spec.nodes) {
    if (node.scriptPath && !scriptIdByPath.has(node.scriptPath)) {
      const id = `${scriptResources.length + 1}_script`;
      scriptIdByPath.set(node.scriptPath, id);
      scriptResources.push({ id, path: node.scriptPath });
    }
  }

  const loadSteps = scriptResources.length + 1;
  const lines: string[] = [`[gd_scene load_steps=${loadSteps} format=3]`, ''];

  for (const res of scriptResources) {
    lines.push(`[ext_resource type="Script" path="${res.path}" id="${res.id}"]`);
  }
  if (scriptResources.length > 0) lines.push('');

  lines.push(`[node name="${spec.rootName}" type="${spec.rootType}"]`);
  lines.push('');

  for (const node of spec.nodes) {
    const parent = node.parent ?? '.';
    lines.push(`[node name="${node.name}" type="${node.type}" parent="${parent}"]`);
    if (node.position) {
      if (node.position.length === 3) {
        const [x, y, z] = node.position;
        lines.push(`transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, ${x}, ${y}, ${z})`);
      } else {
        const [x, y] = node.position;
        lines.push(`position = Vector2(${x}, ${y})`);
      }
    }
    if (node.scriptPath) {
      lines.push(`script = ExtResource("${scriptIdByPath.get(node.scriptPath)}")`);
    }
    if (node.properties) {
      for (const [key, val] of Object.entries(node.properties)) {
        const formatted = typeof val === 'string' ? `"${val}"` : String(val);
        lines.push(`${key} = ${formatted}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
