export interface GodotNodeSpec {
  name: string;
  type?: string;
  parent?: string;
  position?: [number, number] | [number, number, number];
  scriptPath?: string;
  instanceScenePath?: string;
  groups?: string[];
  properties?: Record<string, string | number | boolean>;
}

export interface GodotSceneSpec {
  rootName: string;
  rootType: 'Node2D' | 'Node3D' | 'Control' | 'CanvasLayer';
  rootScriptPath?: string;
  nodes: GodotNodeSpec[];
}

/**
 * Generates a clean, valid Godot 4 `.tscn` (format=3) scene file from JSON
 * supporting script resources, nested PackedScene instances (`instanceScenePath`),
 * and node groups (`groups`) so AI agents can compose modular scenes reliably.
 */
export function generateTscn(spec: GodotSceneSpec): string {
  const extResources: Array<{ id: string; type: 'Script' | 'PackedScene'; path: string }> = [];
  const resIdByKey = new Map<string, string>();

  const registerExt = (type: 'Script' | 'PackedScene', path: string): string => {
    const key = `${type}:${path}`;
    const existing = resIdByKey.get(key);
    if (existing) return existing;
    const suffix = type === 'Script' ? 'script' : 'scene';
    const id = `${extResources.length + 1}_${suffix}`;
    resIdByKey.set(key, id);
    extResources.push({ id, type, path });
    return id;
  };

  if (spec.rootScriptPath) {
    registerExt('Script', spec.rootScriptPath);
  }

  for (const node of spec.nodes) {
    if (node.instanceScenePath) {
      registerExt('PackedScene', node.instanceScenePath);
    }
    if (node.scriptPath) {
      registerExt('Script', node.scriptPath);
    }
  }

  const loadSteps = extResources.length + 1;
  const lines: string[] = [`[gd_scene load_steps=${loadSteps} format=3]`, ''];

  for (const res of extResources) {
    lines.push(`[ext_resource type="${res.type}" path="${res.path}" id="${res.id}"]`);
  }
  if (extResources.length > 0) lines.push('');

  lines.push(`[node name="${spec.rootName}" type="${spec.rootType}"]`);
  if (spec.rootScriptPath) {
    const rootScriptId = resIdByKey.get(`Script:${spec.rootScriptPath}`);
    lines.push(`script = ExtResource("${rootScriptId}")`);
  }
  lines.push('');

  for (const node of spec.nodes) {
    const parent = node.parent ?? '.';
    const groupsAttr =
      node.groups && node.groups.length > 0
        ? ` groups=[${node.groups.map((g) => `"${g}"`).join(', ')}]`
        : '';

    if (node.instanceScenePath) {
      const sceneId = resIdByKey.get(`PackedScene:${node.instanceScenePath}`);
      lines.push(
        `[node name="${node.name}" parent="${parent}"${groupsAttr} instance=ExtResource("${sceneId}")]`
      );
    } else {
      const nodeType = node.type ?? 'Node';
      lines.push(`[node name="${node.name}" type="${nodeType}" parent="${parent}"${groupsAttr}]`);
    }

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
      lines.push(`script = ExtResource("${resIdByKey.get(`Script:${node.scriptPath}`)}")`);
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
