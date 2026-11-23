import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface GameplayBalanceOptions {
  difficulty: 'casual' | 'standard' | 'hardcore';
  scriptRelativePath?: string;
}

export interface GameplayBalanceResult {
  ok: boolean;
  difficulty: string;
  tunedScripts: Array<{
    script: string;
    changes: Record<string, number>;
  }>;
}

const PRESETS: Record<
  GameplayBalanceOptions['difficulty'],
  Record<string, Record<string, number>>
> = {
  casual: {
    'scripts/platformer_player_2d.gd': {
      move_speed: 350.0,
      jump_velocity: -560.0,
      coyote_Duration: 0.18,
    },
    'scripts/topdown_arena_player.gd': {
      move_speed: 380.0,
      dash_speed: 940.0,
    },
    'scripts/twin_stick_player_2d.gd': {
      move_speed: 390.0,
      fire_interval_sec: 0.14,
    },
    'scripts/hover_racer_3d.gd': {
      cruise_speed: 16.0,
      boost_speed: 26.0,
      steer_speed: 12.5,
    },
    'scripts/enemy_chaser_2d.gd': {
      move_speed: 135.0,
      max_hp: 30,
      contact_damage: 10,
    },
    'scripts/enemy_chaser_3d.gd': {
      move_speed: 3.2,
      max_hp: 45,
    },
    'scripts/turret_3d.gd': {
      fire_interval_sec: 2.4,
      max_hp: 60,
    },
    'scripts/boss_guardian_2d.gd': {
      base_speed: 130.0,
      enraged_speed: 230.0,
      max_hp: 180,
    },
    'scripts/boss_sentinel_3d.gd': {
      orbit_speed: 0.9,
      fire_interval_sec: 2.1,
      max_hp: 240,
    },
  },
  standard: {
    'scripts/platformer_player_2d.gd': {
      move_speed: 320.0,
      jump_velocity: -520.0,
      coyote_Duration: 0.12,
    },
    'scripts/topdown_arena_player.gd': {
      move_speed: 340.0,
      dash_speed: 880.0,
    },
    'scripts/twin_stick_player_2d.gd': {
      move_speed: 360.0,
      fire_interval_sec: 0.18,
    },
    'scripts/hover_racer_3d.gd': {
      cruise_speed: 14.0,
      boost_speed: 24.0,
      steer_speed: 11.0,
    },
    'scripts/enemy_chaser_2d.gd': {
      move_speed: 175.0,
      max_hp: 40,
      contact_damage: 15,
    },
    'scripts/enemy_chaser_3d.gd': {
      move_speed: 4.2,
      max_hp: 60,
    },
    'scripts/turret_3d.gd': {
      fire_interval_sec: 1.8,
      max_hp: 80,
    },
    'scripts/boss_guardian_2d.gd': {
      base_speed: 160.0,
      enraged_speed: 290.0,
      max_hp: 240,
    },
    'scripts/boss_sentinel_3d.gd': {
      orbit_speed: 1.2,
      fire_interval_sec: 1.6,
      max_hp: 320,
    },
  },
  hardcore: {
    'scripts/platformer_player_2d.gd': {
      move_speed: 340.0,
      jump_velocity: -510.0,
      coyote_Duration: 0.08,
    },
    'scripts/topdown_arena_player.gd': {
      move_speed: 350.0,
      dash_speed: 900.0,
    },
    'scripts/twin_stick_player_2d.gd': {
      move_speed: 375.0,
      fire_interval_sec: 0.16,
    },
    'scripts/hover_racer_3d.gd': {
      cruise_speed: 17.5,
      boost_speed: 28.0,
      steer_speed: 13.0,
    },
    'scripts/enemy_chaser_2d.gd': {
      move_speed: 230.0,
      max_hp: 65,
      contact_damage: 25,
    },
    'scripts/enemy_chaser_3d.gd': {
      move_speed: 5.6,
      max_hp: 95,
    },
    'scripts/turret_3d.gd': {
      fire_interval_sec: 1.15,
      max_hp: 120,
    },
    'scripts/boss_guardian_2d.gd': {
      base_speed: 210.0,
      enraged_speed: 350.0,
      max_hp: 340,
    },
    'scripts/boss_sentinel_3d.gd': {
      orbit_speed: 1.65,
      fire_interval_sec: 1.1,
      max_hp: 460,
    },
  },
};

/**
 * Automatically tunes `@export var` gameplay parameters across all 9 player, enemy,
 * turret, and boss GDScript 4 controllers to match a target difficulty curve.
 */
export function balanceGameplayParameters(
  projectDir: string,
  opts: GameplayBalanceOptions
): GameplayBalanceResult {
  const table = PRESETS[opts.difficulty] ?? PRESETS.standard;
  const tunedScripts: Array<{ script: string; changes: Record<string, number> }> = [];

  for (const [relPath, vars] of Object.entries(table)) {
    if (
      opts.scriptRelativePath &&
      opts.scriptRelativePath.replace(/^res:\/\//, '') !== relPath
    ) {
      continue;
    }
    const abs = resolve(projectDir, relPath);
    if (!existsSync(abs)) continue;

    let src = readFileSync(abs, 'utf-8');
    const applied: Record<string, number> = {};

    for (const [varName, numVal] of Object.entries(vars)) {
      const isFloat = !Number.isInteger(numVal) || /speed|velocity|Duration|interval/i.test(varName);
      const formatted = isFloat && Number.isInteger(numVal) ? `${numVal}.0` : String(numVal);
      const pattern = new RegExp(
        `(@export\\s+var\\s+${varName}\\s*:\\s*(?:float|int)\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`
      );
      if (pattern.test(src)) {
        src = src.replace(pattern, `$1${formatted}`);
        applied[varName] = numVal;
      }
    }

    if (Object.keys(applied).length > 0) {
      writeFileSync(abs, src, 'utf-8');
      tunedScripts.push({ script: `res://${relPath}`, changes: applied });
    }
  }

  return {
    ok: true,
    difficulty: opts.difficulty,
    tunedScripts,
  };
}
