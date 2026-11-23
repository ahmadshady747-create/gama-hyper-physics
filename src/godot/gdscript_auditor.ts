export interface GdScriptIssue {
  line: number;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface GdScriptAuditResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  rulesChecked: number;
  issues: GdScriptIssue[];
}

export interface GdScriptAutoFixResult {
  fixedCode: string;
  fixesApplied: string[];
  audit: GdScriptAuditResult;
}

interface AuditRule {
  code: string;
  severity: 'error' | 'warning';
  pattern: RegExp;
  suggestion: string;
}

const GODOT4_RULES: AuditRule[] = [
  {
    code: 'GD3_KINEMATIC_2D',
    severity: 'error',
    pattern: /\bKinematicBody2D\b/,
    suggestion: 'Use CharacterBody2D in Godot 4.',
  },
  {
    code: 'GD3_KINEMATIC_3D',
    severity: 'error',
    pattern: /\bKinematicBody\b/,
    suggestion: 'Use CharacterBody3D in Godot 4.',
  },
  {
    code: 'GD3_SPATIAL',
    severity: 'error',
    pattern: /\bSpatial\b/,
    suggestion: 'Use Node3D in Godot 4.',
  },
  {
    code: 'GD3_EXPORT',
    severity: 'error',
    pattern: /^(?!.*@export)\s*export\s+var\b/,
    suggestion: 'Use @export var in Godot 4.',
  },
  {
    code: 'GD3_ONREADY',
    severity: 'error',
    pattern: /^(?!.*@onready)\s*onready\s+var\b/,
    suggestion: 'Use @onready var in Godot 4.',
  },
  {
    code: 'GD3_YIELD',
    severity: 'error',
    pattern: /\byield\s*\(/,
    suggestion: 'Use await instead of yield() in Godot 4.',
  },
  {
    code: 'GD3_INSTANCE',
    severity: 'error',
    pattern: /\.instance\s*\(\s*\)/,
    suggestion: 'Use .instantiate() instead of .instance() in Godot 4.',
  },
  {
    code: 'GD3_CONNECT_STRING',
    severity: 'error',
    pattern: /\.connect\s*\(\s*["'][^"']+["']\s*,\s*self\s*,/,
    suggestion: 'Use Godot 4 signal syntax: `signal_name.connect(_on_handler)` instead of 3-argument string connect.',
  },
  {
    code: 'GD3_MOVE_AND_SLIDE_ARGS',
    severity: 'error',
    pattern: /\bmove_and_slide\s*\(\s*[^)\s]+/,
    suggestion: 'In Godot 4, set `velocity = ...` on CharacterBody2D/3D and call `move_and_slide()` with 0 arguments.',
  },
  {
    code: 'GD3_DEG2RAD',
    severity: 'error',
    pattern: /\b(deg2rad|rad2deg)\s*\(/,
    suggestion: 'Use `deg_to_rad()` / `rad_to_deg()` in Godot 4.',
  },
  {
    code: 'GD3_RAND_RANGE',
    severity: 'error',
    pattern: /\brand_range\s*\(/,
    suggestion: 'Use `randf_range()` or `randi_range()` in Godot 4.',
  },
  {
    code: 'GD3_CHANGE_SCENE',
    severity: 'error',
    pattern: /\.change_scene\s*\(/,
    suggestion: 'Use `get_tree().change_scene_to_file(path)` or `change_scene_to_packed(scene)` in Godot 4.',
  },
  {
    code: 'GD3_FILE_API',
    severity: 'error',
    pattern: /\bFile\.new\s*\(\s*\)/,
    suggestion: 'Use `FileAccess.open(path, FileAccess.READ/WRITE)` in Godot 4 instead of `File.new()`.',
  },
  {
    code: 'GD3_TWEEN_NODE',
    severity: 'error',
    pattern: /\bTween\.new\s*\(\s*\)/,
    suggestion: 'Use `create_tween()` in Godot 4 instead of instantiating `Tween.new()`.',
  },
  {
    code: 'GD3_OS_TIME',
    severity: 'error',
    pattern: /\bOS\.(get_ticks_msec|get_ticks_usec|get_unix_time)\s*\(/,
    suggestion: 'Use `Time.get_ticks_msec()`, `Time.get_ticks_usec()`, or `Time.get_unix_time_from_system()` in Godot 4.',
  },
  {
    code: 'GD3_EMIT_SIGNAL_CALL',
    severity: 'error',
    pattern: /\bemit_signal\s*\(\s*["'][a-zA-Z0-9_]+["']/,
    suggestion: 'Use Godot 4 first-class signal emission (`signal_name.emit(...)`) instead of string-based `emit_signal("name", ...)`.',
  },
  {
    code: 'GD3_SIGNAL_STRING_DISCONNECT',
    severity: 'error',
    pattern: /\.(is_connected|disconnect)\s*\(\s*["'][^"']+["']\s*,/,
    suggestion: 'Use Godot 4 Callable signal methods (`signal_name.is_connected(fn)` / `signal_name.disconnect(fn)`) instead of string-based calls.',
  },
  {
    code: 'GD3_POOL_ARRAY',
    severity: 'error',
    pattern: /\bPool(Byte|Int|Real|String|Vector2|Vector3|Color)Array\b/,
    suggestion: 'Use Godot 4 `Packed*Array` (`PackedByteArray`, `PackedInt32Array`, `PackedFloat32Array`, `PackedStringArray`, `PackedVector2Array`, `PackedVector3Array`, `PackedColorArray`) instead of Godot 3 `Pool*Array`.',
  },
  {
    code: 'GD3_SETGET',
    severity: 'error',
    pattern: /\bvar\s+[a-zA-Z0-9_]+[^#\n]*\bsetget\b/,
    suggestion: 'Use Godot 4 property setter/getter syntax (`var x: int: set = _set_x, get = _get_x`) instead of Godot 3 `setget`.',
  },
  {
    code: 'GD3_STR2VAR',
    severity: 'error',
    pattern: /\b(str2var|var2str|bytes2var|var2bytes)\s*\(/,
    suggestion: 'Use `str_to_var()`, `var_to_str()`, `bytes_to_var()`, or `var_to_bytes()` in Godot 4.',
  },
  {
    code: 'GD3_DIRECTORY_API',
    severity: 'error',
    pattern: /\bDirectory\.new\s*\(\s*\)/,
    suggestion: 'Use `DirAccess.open(path)` or `DirAccess` static methods in Godot 4 instead of `Directory.new()`.',
  },
  {
    code: 'GD4_AWAIT_CONNECT',
    severity: 'warning',
    pattern: /\bawait\s+[a-zA-Z0-9_.]+\.connect\s*\(/,
    suggestion: 'Do not `await` a `.connect()` call; `await` the signal directly (`await obj.signal_name`).',
  },
  {
    code: 'GD4_UNTYPED_FUNC',
    severity: 'warning',
    pattern: /^\s*func\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*:/,
    suggestion: 'Prefer explicit return type annotations (`func foo() -> void:`) for better GDScript 4 VM performance and agent safety.',
  },
  {
    code: 'GD4_UNTYPED_SIGNAL_PARAM',
    severity: 'warning',
    pattern: /^\s*signal\s+[a-zA-Z0-9_]+\s*\((?=[^)]*[a-zA-Z0-9_])(?![^)]*:)/,
    suggestion: 'Include explicit GDScript 4 type annotations on signal parameters (`signal damaged(amount: int)`).',
  },
];

export function getAuditorRuleCount(): number {
  // 24 line rules + GD4_MISSING_EXTENDS + GD4_PERF_NODE_LOOKUP_IN_PROCESS + GD4_PERF_ALLOC_IN_PROCESS + GD4_PERF_PRINT_IN_PROCESS = 28 rules
  return GODOT4_RULES.length + 4;
}

/**
 * Automatically heals common Godot 3 -> Godot 4 syntax hallucinations
 * written by AI agents before running static audit.
 */
export function autoFixGdScript(source: string): GdScriptAutoFixResult {
  const fixesApplied: string[] = [];
  let code = source;

  const rules: Array<{ label: string; regex: RegExp; replacement: string }> = [
    { label: 'KinematicBody2D -> CharacterBody2D', regex: /\bKinematicBody2D\b/g, replacement: 'CharacterBody2D' },
    { label: 'KinematicBody -> CharacterBody3D', regex: /\bKinematicBody\b/g, replacement: 'CharacterBody3D' },
    { label: 'Spatial -> Node3D', regex: /\bSpatial\b/g, replacement: 'Node3D' },
    { label: 'export var -> @export var', regex: /^(\s*)export\s+var\b/gm, replacement: '$1@export var' },
    { label: 'onready var -> @onready var', regex: /^(\s*)onready\s+var\b/gm, replacement: '$1@onready var' },
    { label: '.instance() -> .instantiate()', regex: /\.instance\s*\(\s*\)/g, replacement: '.instantiate()' },
    { label: 'deg2rad() -> deg_to_rad()', regex: /\bdeg2rad\s*\(/g, replacement: 'deg_to_rad(' },
    { label: 'rad2deg() -> rad_to_deg()', regex: /\brad2deg\s*\(/g, replacement: 'rad_to_deg(' },
    { label: 'rand_range() -> randf_range()', regex: /\brand_range\s*\(/g, replacement: 'randf_range(' },
    { label: '.change_scene() -> .change_scene_to_file()', regex: /\.change_scene\s*\(/g, replacement: '.change_scene_to_file(' },
    { label: 'Tween.new() -> create_tween()', regex: /\bTween\.new\s*\(\s*\)/g, replacement: 'create_tween()' },
    { label: 'OS.get_ticks_msec() -> Time.get_ticks_msec()', regex: /\bOS\.get_ticks_msec\s*\(\s*\)/g, replacement: 'Time.get_ticks_msec()' },
    { label: 'OS.get_ticks_usec() -> Time.get_ticks_usec()', regex: /\bOS\.get_ticks_usec\s*\(\s*\)/g, replacement: 'Time.get_ticks_usec()' },
    {
      label: 'OS.get_unix_time() -> Time.get_unix_time_from_system()',
      regex: /\bOS\.get_unix_time\s*\(\s*\)/g,
      replacement: 'Time.get_unix_time_from_system()',
    },
    { label: 'PoolByteArray -> PackedByteArray', regex: /\bPoolByteArray\b/g, replacement: 'PackedByteArray' },
    { label: 'PoolIntArray -> PackedInt32Array', regex: /\bPoolIntArray\b/g, replacement: 'PackedInt32Array' },
    { label: 'PoolRealArray -> PackedFloat32Array', regex: /\bPoolRealArray\b/g, replacement: 'PackedFloat32Array' },
    { label: 'PoolStringArray -> PackedStringArray', regex: /\bPoolStringArray\b/g, replacement: 'PackedStringArray' },
    { label: 'PoolVector2Array -> PackedVector2Array', regex: /\bPoolVector2Array\b/g, replacement: 'PackedVector2Array' },
    { label: 'PoolVector3Array -> PackedVector3Array', regex: /\bPoolVector3Array\b/g, replacement: 'PackedVector3Array' },
    { label: 'PoolColorArray -> PackedColorArray', regex: /\bPoolColorArray\b/g, replacement: 'PackedColorArray' },
    { label: 'str2var() -> str_to_var()', regex: /\bstr2var\s*\(/g, replacement: 'str_to_var(' },
    { label: 'var2str() -> var_to_str()', regex: /\bvar2str\s*\(/g, replacement: 'var_to_str(' },
    { label: 'bytes2var() -> bytes_to_var()', regex: /\bbytes2var\s*\(/g, replacement: 'bytes_to_var(' },
    { label: 'var2bytes() -> var_to_bytes()', regex: /\bvar2bytes\s*\(/g, replacement: 'var_to_bytes(' },
    {
      label: 'emit_signal("sig", args) -> sig.emit(args)',
      regex: /\bemit_signal\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*,\s*([^)]+)\)/g,
      replacement: '$1.emit($2)',
    },
    {
      label: 'emit_signal("sig") -> sig.emit()',
      regex: /\bemit_signal\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*\)/g,
      replacement: '$1.emit()',
    },
    {
      label: '3-arg signal.connect("sig", self, "fn") -> sig.connect(fn)',
      regex: /\.connect\s*\(\s*["']([a-zA-Z0-9_]+)["']\s*,\s*self\s*,\s*["']([a-zA-Z0-9_]+)["']\s*\)/g,
      replacement: '.$1.connect($2)',
    },
    {
      label: 'velocity = move_and_slide(vel...) -> move_and_slide()',
      regex: /\bvelocity\s*=\s*move_and_slide\s*\([^)]*\)/g,
      replacement: 'move_and_slide()',
    },
    {
      label: 'move_and_slide(velocity...) -> move_and_slide()',
      regex: /\bmove_and_slide\s*\(\s*velocity(?:\s*,[^)]*)?\)/g,
      replacement: 'move_and_slide()',
    },
    {
      label: 'yield(obj, "sig") -> await obj.sig',
      regex: /\byield\s*\(\s*([^,]+?)\s*,\s*["']([a-zA-Z0-9_]+)["']\s*\)/g,
      replacement: 'await $1.$2',
    },
  ];

  for (const r of rules) {
    if (r.regex.test(code)) {
      code = code.replace(r.regex, r.replacement);
      fixesApplied.push(r.label);
    }
  }

  return {
    fixedCode: code,
    fixesApplied,
    audit: auditGdScript(code),
  };
}

/**
 * Statically audits GDScript 4 files written by AI agents to catch
 * Godot 3 hallucinations, signal/physics API mismatches, and performance anti-patterns.
 */
export function auditGdScript(source: string): GdScriptAuditResult {
  const issues: GdScriptIssue[] = [];
  const lines = source.split(/\r?\n/);

  const hasExtends = lines.some((l) => /^\s*(extends|class_name)\s+\w+/.test(l));
  if (!hasExtends) {
    issues.push({
      line: 1,
      severity: 'error',
      code: 'GD4_MISSING_EXTENDS',
      message: 'GDScript file should start with an `extends <NodeType>` declaration.',
    });
  }

  let inProcessLoop = false;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) return;

    if (/^\s*func\s+_(physics_)?process\s*\(/.test(line)) {
      inProcessLoop = true;
    } else if (/^\s*func\s+/.test(line)) {
      inProcessLoop = false;
    }

    for (const rule of GODOT4_RULES) {
      if (rule.pattern.test(line)) {
        issues.push({
          line: idx + 1,
          severity: rule.severity,
          code: rule.code,
          message: `${rule.code}: ${rule.suggestion}`,
        });
      }
    }

    if (inProcessLoop && /(\bget_node\s*\(|\$[A-Za-z0-9_/]+)/.test(line)) {
      issues.push({
        line: idx + 1,
        severity: 'warning',
        code: 'GD4_PERF_NODE_LOOKUP_IN_PROCESS',
        message:
          'GD4_PERF_NODE_LOOKUP_IN_PROCESS: Avoid calling `get_node()` or `$Node` inside `_process`/`_physics_process`; cache node references with `@onready var`.',
      });
    }

    if (inProcessLoop && /\b(load\s*\(\s*["']res:\/\/|ResourceLoader\.load\s*\(|FileAccess\.open\s*\()/.test(line)) {
      issues.push({
        line: idx + 1,
        severity: 'warning',
        code: 'GD4_PERF_ALLOC_IN_PROCESS',
        message:
          'GD4_PERF_ALLOC_IN_PROCESS: Avoid synchronous disk I/O (`load("res://...")` or `FileAccess.open()`) inside `_process`/`_physics_process`; preload or cache in `_ready()`.',
      });
    }

    if (inProcessLoop && /^\s*prints?\s*\((?!\s*JSON\.stringify)/.test(line)) {
      issues.push({
        line: idx + 1,
        severity: 'warning',
        code: 'GD4_PERF_PRINT_IN_PROCESS',
        message:
          'GD4_PERF_PRINT_IN_PROCESS: Avoid unguarded debug `print()`/`prints()` calls inside `_process`/`_physics_process` as per-frame console I/O causes frame stutter.',
      });
    }
  });

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  return {
    valid: errorCount === 0,
    errorCount,
    warningCount,
    rulesChecked: getAuditorRuleCount(),
    issues,
  };
}
