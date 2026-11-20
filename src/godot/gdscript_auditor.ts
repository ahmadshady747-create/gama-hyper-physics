export interface GdScriptIssue {
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface GdScriptAuditResult {
  valid: boolean;
  issues: GdScriptIssue[];
}

const GODOT3_DEPRECATED: Array<{ pattern: RegExp; suggestion: string }> = [
  { pattern: /\bKinematicBody2D\b/, suggestion: 'Use CharacterBody2D in Godot 4.' },
  { pattern: /\bKinematicBody\b/, suggestion: 'Use CharacterBody3D in Godot 4.' },
  { pattern: /\bSpatial\b/, suggestion: 'Use Node3D in Godot 4.' },
  { pattern: /(?<!@)\bexport\s+var\b/, suggestion: 'Use @export var in Godot 4.' },
  { pattern: /(?<!@)\bonready\s+var\b/, suggestion: 'Use @onready var in Godot 4.' },
  { pattern: /\byield\s*\(/, suggestion: 'Use await instead of yield() in Godot 4.' },
  { pattern: /\.instance\s*\(\s*\)/, suggestion: 'Use .instantiate() instead of .instance() in Godot 4.' },
];

/**
 * Statically audits GDScript 4 files written by AI agents to catch
 * Godot 3 hallucinations and missing extends declarations before launching Godot.
 */
export function auditGdScript(source: string): GdScriptAuditResult {
  const issues: GdScriptIssue[] = [];
  const lines = source.split(/\r?\n/);

  const hasExtends = lines.some((l) => /^\s*(extends|class_name)\s+\w+/.test(l));
  if (!hasExtends) {
    issues.push({
      line: 1,
      severity: 'error',
      message: 'GDScript file should start with an `extends <NodeType>` declaration.',
    });
  }

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return;
    for (const rule of GODOT3_DEPRECATED) {
      if (rule.pattern.test(line)) {
        issues.push({
          line: idx + 1,
          severity: 'error',
          message: `Deprecated Godot 3 syntax detected. ${rule.suggestion}`,
        });
      }
    }
  });

  return {
    valid: issues.every((i) => i.severity !== 'error'),
    issues,
  };
}
