import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { auditGdScript } from './gdscript_auditor';
import { listProjectFiles } from './runner';
import { inspectTscnScene, TscnAuditReport } from './tscn_inspector';

export interface ExportPresetAuditReport {
  valid: boolean;
  presetsFound: string[];
  hasWebPreset: boolean;
  hasWindowsPreset: boolean;
  hasAndroidArm64Preset: boolean;
  issues: string[];
}

export interface ProjectHealthAudit {
  ok: boolean;
  totalScenes: number;
  totalScripts: number;
  totalErrors: number;
  totalWarnings: number;
  exportPresets: ExportPresetAuditReport;
  sceneReports: TscnAuditReport[];
  scriptReports: Array<{
    file: string;
    valid: boolean;
    errorCount: number;
    warningCount: number;
  }>;
  unreferencedScripts: string[];
}

const CORE_SYSTEM_SCRIPTS = new Set<string>([
  'res://addons/gama_agent/juice.gd',
  'res://addons/gama_agent/audio_synth.gd',
  'res://addons/gama_agent/game_state.gd',
  'res://addons/gama_agent/cinema_director.gd',
  'res://addons/gama_agent/combat_system.gd',
  'res://addons/gama_agent/procedural_vfx.gd',
  'res://addons/gama_agent/dialogue_system.gd',
  'res://addons/gama_agent/object_pool.gd',
  'res://addons/gama_agent/perf_monitor.gd',
  'res://addons/gama_agent/quest_system.gd',
  'res://addons/gama_agent/inventory_system.gd',
  'res://addons/gama_agent/localization_system.gd',
  'res://addons/gama_agent/agent_qa_runner.gd',
  'res://addons/gama_agent/agent_screenshot.gd',
  'res://addons/gama_agent/agent_playtest_bot.gd',
  'res://scripts/wave_spawner.gd',
]);

/**
 * Statically validates `export_presets.cfg` inside `godot_project/` to ensure
 * runnable Web, Windows Desktop (x86_64), and Android (arm64-v8a) presets exist.
 */
export function auditExportPresets(projectDir: string): ExportPresetAuditReport {
  const cfgPath = resolve(projectDir, 'export_presets.cfg');
  const issues: string[] = [];
  if (!existsSync(cfgPath)) {
    return {
      valid: false,
      presetsFound: [],
      hasWebPreset: false,
      hasWindowsPreset: false,
      hasAndroidArm64Preset: false,
      issues: ['Missing export_presets.cfg in godot_project/'],
    };
  }

  const raw = readFileSync(cfgPath, 'utf-8');
  const nameMatches = Array.from(raw.matchAll(/^name="([^"]+)"/gm)).map((m) => m[1]);
  const hasWebPreset = nameMatches.includes('Web') && raw.includes('export_path="../builds/web/index.html"');
  const hasWindowsPreset =
    nameMatches.includes('Windows Desktop') &&
    raw.includes('binary_format/embed_pck=true') &&
    raw.includes('binary_format/architecture="x86_64"');
  const hasAndroidArm64Preset =
    nameMatches.includes('Android') && raw.includes('architectures/arm64-v8a=true');

  if (!hasWebPreset) issues.push('Missing runnable Web export preset in export_presets.cfg');
  if (!hasWindowsPreset) {
    issues.push('Missing Windows Desktop (x86_64 embedded PCK) preset in export_presets.cfg');
  }
  if (!hasAndroidArm64Preset) {
    issues.push('Missing Android (arm64-v8a) export preset in export_presets.cfg');
  }

  return {
    valid: issues.length === 0,
    presetsFound: nameMatches,
    hasWebPreset,
    hasWindowsPreset,
    hasAndroidArm64Preset,
    issues,
  };
}

/**
 * Performs a full static health audit across every `.tscn` scene, `.gd` script,
 * and `export_presets.cfg` in `godot_project/` without launching the Godot binary.
 */
export function auditProjectHealth(projectDir: string): ProjectHealthAudit {
  const { scenes, scripts } = listProjectFiles(projectDir);
  const referencedScripts = new Set<string>(CORE_SYSTEM_SCRIPTS);

  const sceneReports = scenes.map((sceneRes) => {
    const rep = inspectTscnScene(projectDir, sceneRes);
    for (const ext of rep.extResources) {
      if (ext.type === 'Script') {
        referencedScripts.add(ext.path);
      }
    }
    return rep;
  });

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const sr of sceneReports) {
    if (!sr.validFormat3) totalErrors += 1;
    totalErrors += sr.brokenExtResources.length;
  }

  const exportPresets = auditExportPresets(projectDir);
  totalErrors += exportPresets.issues.length;

  const scriptReports = scripts.map((scriptRes) => {
    const abs = resolve(projectDir, scriptRes.replace(/^res:\/\//, ''));
    const src = readFileSync(abs, 'utf-8');
    const res = auditGdScript(src);
    totalErrors += res.errorCount;
    totalWarnings += res.warningCount;
    return {
      file: scriptRes,
      valid: res.valid,
      errorCount: res.errorCount,
      warningCount: res.warningCount,
    };
  });

  const unreferencedScripts = scripts.filter((s) => !referencedScripts.has(s));

  return {
    ok: totalErrors === 0,
    totalScenes: scenes.length,
    totalScripts: scripts.length,
    totalErrors,
    totalWarnings,
    exportPresets,
    sceneReports,
    scriptReports,
    unreferencedScripts,
  };
}
