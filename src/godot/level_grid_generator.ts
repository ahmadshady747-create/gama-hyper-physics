import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { generateTscn, GodotNodeSpec } from './tscn_generator';

export interface ProceduralGridLevelOptions {
  levelName: string;
  dimension: '2D' | '3D';
  relativePath: string;
  gridRows: string[];
  cellSize?: number;
}

export interface ProceduralGridLevelResult {
  ok: boolean;
  levelName: string;
  dimension: '2D' | '3D';
  savedScene: string;
  spawnedCounts: Record<string, number>;
}

/**
 * Generates a complete playable 2D or 3D Godot 4 level `.tscn` scene from an ASCII grid map!
 * Legend (11 symbols):
 *  - `P` : Player + Camera + GameHUD + MobileTouchControls
 *  - `E` : Chaser Enemy (`enemy_chaser_2d` or `enemy_chaser_3d`)
 *  - `T` : Auto-Turret (`turret_3d`) or Boss Guardian (`boss_guardian_2d`)
 *  - `S` : Arena Boss (`boss_guardian_2d` in 2D or `boss_sentinel_3d` in 3D)
 *  - `C` : Coin / Crystal Pickup (`pickup_coin_2d` or `pickup_crystal_3d`)
 *  - `H` : Hazard Spikes (`hazard_spikes_2d`) or Health Pack (`health_pack_3d`)
 *  - `B` : Power-Up Boost (`powerup_boost_2d`) or Jump Pad (`jump_pad_3d`)
 *  - `L` : Loot Chest (`loot_chest_2d`) or Key Door (`key_door_3d`)
 *  - `D` : Dialogue Trigger (`dialogue_trigger_2d`) or Moving Platform (`moving_platform_3d`)
 *  - `K` : Checkpoint Flag/Beacon (`checkpoint_2d` in 2D or `checkpoint_3d` in 3D)
 *  - `G` : Stage Goal Portal (`goal_portal_2d` in 2D or `goal_portal_3d` in 3D)
 */
export function generateProceduralGridLevel(
  projectDir: string,
  opts: ProceduralGridLevelOptions
): ProceduralGridLevelResult {
  const is3D = opts.dimension === '3D';
  const cell = opts.cellSize ?? (is3D ? 3 : 80);
  const cleanRel = opts.relativePath.replace(/^res:\/\//, '');
  const nodes: GodotNodeSpec[] = [];
  const counts: Record<string, number> = {};

  const bump = (key: string): number => {
    counts[key] = (counts[key] ?? 0) + 1;
    return counts[key];
  };

  if (is3D) {
    nodes.push(
      {
        name: 'DirectionalLight3D',
        type: 'DirectionalLight3D',
        position: [0, 14, 0],
        properties: { shadow_enabled: true },
      },
      {
        name: 'Camera3D',
        type: 'Camera3D',
        position: [0, 9, 14],
        properties: { current: true },
      }
    );
  }

  nodes.push(
    {
      name: 'GameHUD',
      instanceScenePath: 'res://scenes/ui_hud.tscn',
    },
    {
      name: 'MobileTouchControls',
      instanceScenePath: 'res://scenes/mobile_touch_controls.tscn',
    }
  );

  opts.gridRows.forEach((row, rIdx) => {
    for (let cIdx = 0; cIdx < row.length; cIdx++) {
      const ch = row[cIdx].toUpperCase();
      if (ch === '.' || ch === ' ') continue;

      const x2d = 120 + cIdx * cell;
      const y2d = 140 + rIdx * cell;
      const x3d = (cIdx - Math.floor(row.length / 2)) * cell;
      const z3d = (rIdx - Math.floor(opts.gridRows.length / 2)) * cell;

      if (ch === 'P') {
        const idx = bump('player');
        if (!is3D) {
          nodes.push(
            {
              name: idx === 1 ? 'Player' : `Player_${idx}`,
              type: 'CharacterBody2D',
              position: [x2d, y2d],
              scriptPath: 'res://scripts/platformer_player_2d.gd',
              groups: ['player'],
            },
            {
              name: `Camera2D_${idx}`,
              type: 'Camera2D',
              parent: idx === 1 ? 'Player' : `Player_${idx}`,
              properties: { position_smoothing_enabled: true },
            }
          );
        } else {
          nodes.push({
            name: idx === 1 ? 'Player3D' : `Player3D_${idx}`,
            type: 'CharacterBody3D',
            position: [x3d, 1.2, z3d],
            scriptPath: 'res://scripts/demo_player.gd',
            groups: ['player'],
          });
        }
      } else if (ch === 'E') {
        const idx = bump('enemy');
        nodes.push({
          name: `Enemy_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/enemy_chaser_3d.tscn'
            : 'res://scenes/enemy_chaser_2d.tscn',
          position: is3D ? [x3d, 1.4, z3d] : [x2d, y2d],
        });
      } else if (ch === 'T') {
        const idx = bump('turret_or_boss');
        nodes.push({
          name: is3D ? `Turret_${idx}` : `BossGuardian_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/turret_3d.tscn'
            : 'res://scenes/boss_guardian_2d.tscn',
          position: is3D ? [x3d, 0.8, z3d] : [x2d, y2d],
        });
      } else if (ch === 'S') {
        const idx = bump('boss_sentinel');
        nodes.push({
          name: is3D ? `BossSentinel_${idx}` : `BossGuardianS_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/boss_sentinel_3d.tscn'
            : 'res://scenes/boss_guardian_2d.tscn',
          position: is3D ? [x3d, 2.2, z3d] : [x2d, y2d],
        });
      } else if (ch === 'C') {
        const idx = bump('pickup');
        nodes.push({
          name: `Pickup_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/pickup_crystal_3d.tscn'
            : 'res://scenes/pickup_coin_2d.tscn',
          position: is3D ? [x3d, 1.2, z3d] : [x2d, y2d],
        });
      } else if (ch === 'H') {
        const idx = bump('hazard_or_heal');
        nodes.push({
          name: is3D ? `HealthPack_${idx}` : `HazardSpikes_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/health_pack_3d.tscn'
            : 'res://scenes/hazard_spikes_2d.tscn',
          position: is3D ? [x3d, 1.0, z3d] : [x2d, y2d],
        });
      } else if (ch === 'B') {
        const idx = bump('boost_or_pad');
        nodes.push({
          name: is3D ? `JumpPad_${idx}` : `PowerupBoost_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/jump_pad_3d.tscn'
            : 'res://scenes/powerup_boost_2d.tscn',
          position: is3D ? [x3d, 0.2, z3d] : [x2d, y2d],
        });
      } else if (ch === 'L') {
        const idx = bump('loot_or_door');
        nodes.push({
          name: is3D ? `KeyDoor_${idx}` : `LootChest_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/key_door_3d.tscn'
            : 'res://scenes/loot_chest_2d.tscn',
          position: is3D ? [x3d, 1.2, z3d] : [x2d, y2d],
        });
      } else if (ch === 'D') {
        const idx = bump('dialogue_or_platform');
        nodes.push({
          name: is3D ? `MovingPlatform_${idx}` : `DialogueTrigger_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/moving_platform_3d.tscn'
            : 'res://scenes/dialogue_trigger_2d.tscn',
          position: is3D ? [x3d, 0.6, z3d] : [x2d, y2d],
        });
      } else if (ch === 'K') {
        const idx = bump('checkpoint');
        nodes.push({
          name: is3D ? `Checkpoint3D_${idx}` : `Checkpoint_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/checkpoint_3d.tscn'
            : 'res://scenes/checkpoint_2d.tscn',
          position: is3D ? [x3d, 0.0, z3d] : [x2d, y2d],
        });
      } else if (ch === 'G') {
        const idx = bump('goal_or_checkpoint');
        nodes.push({
          name: is3D ? `GoalPortal3D_${idx}` : `GoalPortal2D_${idx}`,
          instanceScenePath: is3D
            ? 'res://scenes/goal_portal_3d.tscn'
            : 'res://scenes/goal_portal_2d.tscn',
          position: is3D ? [x3d, 1.2, z3d] : [x2d, y2d],
        });
      }
    }
  });

  const tscn = generateTscn({
    rootName: opts.levelName.replace(/[^a-zA-Z0-9_]/g, '') || 'GridLevel',
    rootType: is3D ? 'Node3D' : 'Node2D',
    nodes,
  });

  const absOut = resolve(projectDir, cleanRel);
  mkdirSync(dirname(absOut), { recursive: true });
  writeFileSync(absOut, tscn, 'utf-8');

  return {
    ok: true,
    levelName: opts.levelName,
    dimension: opts.dimension,
    savedScene: `res://${cleanRel}`,
    spawnedCounts: counts,
  };
}
