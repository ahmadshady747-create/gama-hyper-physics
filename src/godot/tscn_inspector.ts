import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TscnExtResource {
  id: string;
  type: string;
  path: string;
  existsOnDisk: boolean;
}

export interface TscnNodeSummary {
  name: string;
  type: string;
  parent: string;
  groups: string[];
  instanceExtId?: string;
}

export interface TscnAuditReport {
  scenePath: string;
  validFormat3: boolean;
  nodeCount: number;
  extResources: TscnExtResource[];
  brokenExtResources: string[];
  nodes: TscnNodeSummary[];
}

/**
 * Parses and audits a Godot 4 `.tscn` file, verifying `format=3`, enumerating
 * its node hierarchy, and confirming every `ExtResource` path exists inside `godot_project/`.
 */
export function inspectTscnScene(
  projectDir: string,
  sceneRelativePath: string
): TscnAuditReport {
  const cleanRel = sceneRelativePath.replace(/^res:\/\//, '');
  const abs = resolve(projectDir, cleanRel);
  if (!existsSync(abs)) {
    throw new Error(`Scene file not found: ${sceneRelativePath}`);
  }

  const raw = readFileSync(abs, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const firstLine = lines.find((l) => l.trim().startsWith('[gd_scene')) ?? '';
  const validFormat3 = firstLine.includes('format=3');

  const extResources: TscnExtResource[] = [];
  const brokenExtResources: string[] = [];
  const nodes: TscnNodeSummary[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[ext_resource ')) {
      const typeMatch = /type="([^"]+)"/.exec(trimmed);
      const pathMatch = /path="([^"]+)"/.exec(trimmed);
      const idMatch = /id="([^"]+)"/.exec(trimmed);
      if (pathMatch && idMatch) {
        const resPath = pathMatch[1];
        const diskPath = resolve(projectDir, resPath.replace(/^res:\/\//, ''));
        const existsOnDisk = existsSync(diskPath);
        extResources.push({
          id: idMatch[1],
          type: typeMatch ? typeMatch[1] : 'Resource',
          path: resPath,
          existsOnDisk,
        });
        if (!existsOnDisk) {
          brokenExtResources.push(resPath);
        }
      }
    } else if (trimmed.startsWith('[node ')) {
      const nameMatch = /name="([^"]+)"/.exec(trimmed);
      const typeMatch = /type="([^"]+)"/.exec(trimmed);
      const parentMatch = /parent="([^"]+)"/.exec(trimmed);
      const instMatch = /instance=ExtResource\("([^"]+)"\)/.exec(trimmed);
      const groupsMatch = /groups=\[([^\]]+)\]/.exec(trimmed);
      const groups = groupsMatch
        ? groupsMatch[1]
            .split(',')
            .map((s) => s.trim().replace(/^"|"$/g, ''))
            .filter(Boolean)
        : [];
      nodes.push({
        name: nameMatch ? nameMatch[1] : 'Unnamed',
        type: typeMatch ? typeMatch[1] : instMatch ? 'PackedSceneInstance' : 'Node',
        parent: parentMatch ? parentMatch[1] : '<root>',
        groups,
        ...(instMatch ? { instanceExtId: instMatch[1] } : {}),
      });
    }
  }

  return {
    scenePath: `res://${cleanRel}`,
    validFormat3,
    nodeCount: nodes.length,
    extResources,
    brokenExtResources,
    nodes,
  };
}
