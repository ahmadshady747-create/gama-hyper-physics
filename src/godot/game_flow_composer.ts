import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { GodotArchetypeId } from './archetypes';
import { generateTscn, GodotNodeSpec } from './tscn_generator';

export interface FullGameFlowOptions {
  gameTitle: string;
  archetypeId: GodotArchetypeId;
  levelSceneRelativePath?: string;
  includeEnemies?: boolean;
  includePickups?: boolean;
  includeHazardsOrPlatforms?: boolean;
  includeGoalOrCheckpoint?: boolean;
  includeMobileTouchControls?: boolean;
}

export interface FullGameFlowResult {
  ok: boolean;
  gameTitle: string;
  archetypeId: GodotArchetypeId;
  dimension: '2D' | '3D';
  levelScene: string;
  titleScene: string;
  gameOverScene: string;
  injectedPrefabs: string[];
}

/**
 * Composes a complete playable Godot 4 game flow in one step:
 * builds a rich 2D or 3D level scene pre-wired with Player, Camera, GameHUD,
 * MobileTouchControls, Enemies, Pickups, Hazards/MovingPlatforms, and Checkpoint/GoalPortal,
 * and wires both `title_menu.tscn` and `game_over.tscn` to launch/retry the composed level.
 */
export function composeFullGameFlow(
  projectDir: string,
  opts: FullGameFlowOptions
): FullGameFlowResult {
  const is3D = opts.archetypeId === 'collectathon_3d' || opts.archetypeId === 'hover_racer_3d';
  const dimension: '2D' | '3D' = is3D ? '3D' : '2D';
  const levelRel = (
    opts.levelSceneRelativePath ??
    (is3D ? 'scenes/composed_arena_3d.tscn' : 'scenes/composed_stage_2d.tscn')
  ).replace(/^res:\/\//, '');
  const levelResPath = `res://${levelRel}`;

  const injectedPrefabs: string[] = ['res://scenes/ui_hud.tscn'];
  const nodes: GodotNodeSpec[] = [];

  if (!is3D) {
    const playerScript =
      opts.archetypeId === 'topdown_arena_2d'
        ? 'res://scripts/topdown_arena_player.gd'
        : opts.archetypeId === 'twin_stick_cyber_2d'
          ? 'res://scripts/twin_stick_player_2d.gd'
          : 'res://scripts/platformer_player_2d.gd';

    nodes.push(
      {
        name: 'Player',
        type: 'CharacterBody2D',
        position: [220, 520],
        scriptPath: playerScript,
        groups: ['player'],
      },
      {
        name: 'Camera2D',
        type: 'Camera2D',
        parent: 'Player',
        properties: { position_smoothing_enabled: true },
      },
      {
        name: 'GameHUD',
        instanceScenePath: 'res://scenes/ui_hud.tscn',
      }
    );

    if (opts.includeMobileTouchControls !== false) {
      nodes.push({
        name: 'MobileTouchControls',
        instanceScenePath: 'res://scenes/mobile_touch_controls.tscn',
      });
      injectedPrefabs.push('res://scenes/mobile_touch_controls.tscn');
    }

    if (opts.includePickups !== false) {
      nodes.push(
        {
          name: 'PickupCoinA',
          instanceScenePath: 'res://scenes/pickup_coin_2d.tscn',
          position: [440, 480],
        },
        {
          name: 'LootChestA',
          instanceScenePath: 'res://scenes/loot_chest_2d.tscn',
          position: [640, 520],
        }
      );
      injectedPrefabs.push('res://scenes/pickup_coin_2d.tscn', 'res://scenes/loot_chest_2d.tscn');
    }

    if (opts.includeEnemies !== false) {
      nodes.push({
        name: 'EnemyChaserA',
        instanceScenePath: 'res://scenes/enemy_chaser_2d.tscn',
        position: [820, 520],
      });
      injectedPrefabs.push('res://scenes/enemy_chaser_2d.tscn');
    }

    if (opts.includeHazardsOrPlatforms !== false) {
      nodes.push({
        name: 'HazardSpikes',
        instanceScenePath: 'res://scenes/hazard_spikes_2d.tscn',
        position: [540, 640],
      });
      injectedPrefabs.push('res://scenes/hazard_spikes_2d.tscn');
    }

    if (opts.includeGoalOrCheckpoint !== false) {
      nodes.push({
        name: 'StageCheckpoint',
        instanceScenePath: 'res://scenes/checkpoint_2d.tscn',
        position: [980, 520],
      });
      injectedPrefabs.push('res://scenes/checkpoint_2d.tscn');
    }
  } else {
    const playerScript3D =
      opts.archetypeId === 'hover_racer_3d'
        ? 'res://scripts/hover_racer_3d.gd'
        : 'res://scripts/demo_player.gd';

    nodes.push(
      {
        name: 'DirectionalLight3D',
        type: 'DirectionalLight3D',
        position: [0, 12, 0],
        properties: { shadow_enabled: true },
      },
      {
        name: 'Player3D',
        type: 'CharacterBody3D',
        position: [0, 1.2, 0],
        scriptPath: playerScript3D,
        groups: ['player'],
      },
      {
        name: 'Camera3D',
        type: 'Camera3D',
        position: [0, 6, 10],
        properties: { current: true },
      },
      {
        name: 'GameHUD',
        instanceScenePath: 'res://scenes/ui_hud.tscn',
      }
    );

    if (opts.includeMobileTouchControls !== false) {
      nodes.push({
        name: 'MobileTouchControls',
        instanceScenePath: 'res://scenes/mobile_touch_controls.tscn',
      });
      injectedPrefabs.push('res://scenes/mobile_touch_controls.tscn');
    }

    if (opts.includePickups !== false) {
      nodes.push({
        name: 'EnergyCrystalA',
        instanceScenePath: 'res://scenes/pickup_crystal_3d.tscn',
        position: [3, 1.2, -3],
      });
      injectedPrefabs.push('res://scenes/pickup_crystal_3d.tscn');
    }

    if (opts.includeEnemies !== false) {
      nodes.push({
        name: 'EnemyDroneA',
        instanceScenePath: 'res://scenes/enemy_chaser_3d.tscn',
        position: [-4, 1.5, -5],
      });
      injectedPrefabs.push('res://scenes/enemy_chaser_3d.tscn');
    }

    if (opts.includeHazardsOrPlatforms !== false) {
      nodes.push({
        name: 'MovingPlatformA',
        instanceScenePath: 'res://scenes/moving_platform_3d.tscn',
        position: [0, 0.5, -6],
      });
      injectedPrefabs.push('res://scenes/moving_platform_3d.tscn');
    }

    if (opts.includeGoalOrCheckpoint !== false) {
      nodes.push({
        name: 'GoalPortal',
        instanceScenePath: 'res://scenes/goal_portal_3d.tscn',
        position: [0, 1.2, -12],
      });
      injectedPrefabs.push('res://scenes/goal_portal_3d.tscn');
    }
  }

  const tscn = generateTscn({
    rootName: opts.gameTitle.replace(/[^a-zA-Z0-9_]/g, '') || 'ComposedLevel',
    rootType: is3D ? 'Node3D' : 'Node2D',
    nodes,
  });

  const absLevel = resolve(projectDir, levelRel);
  mkdirSync(dirname(absLevel), { recursive: true });
  writeFileSync(absLevel, tscn, 'utf-8');

  // Wire title_menu.tscn to display gameTitle and point start_scene_path to levelResPath
  const titleAbs = resolve(projectDir, 'scenes/title_menu.tscn');
  if (existsSync(titleAbs)) {
    let rawTitle = readFileSync(titleAbs, 'utf-8');
    rawTitle = rawTitle.replace(
      /text = ".*?"/,
      `text = "${opts.gameTitle.replace(/"/g, '')}"`
    );
    if (rawTitle.includes('start_scene_path =')) {
      rawTitle = rawTitle.replace(
        /start_scene_path = ".*?"/,
        `start_scene_path = "${levelResPath}"`
      );
    } else {
      rawTitle = rawTitle.replace(
        'script = ExtResource("1_title")',
        `script = ExtResource("1_title")\nstart_scene_path = "${levelResPath}"`
      );
    }
    writeFileSync(titleAbs, rawTitle, 'utf-8');
  }

  // Wire game_over.tscn retry_scene_path to levelResPath
  const gameOverAbs = resolve(projectDir, 'scenes/game_over.tscn');
  if (existsSync(gameOverAbs)) {
    let rawGo = readFileSync(gameOverAbs, 'utf-8');
    if (rawGo.includes('retry_scene_path =')) {
      rawGo = rawGo.replace(
        /retry_scene_path = ".*?"/,
        `retry_scene_path = "${levelResPath}"`
      );
    } else {
      rawGo = rawGo.replace(
        'script = ExtResource("1_gameover")',
        `script = ExtResource("1_gameover")\nretry_scene_path = "${levelResPath}"`
      );
    }
    writeFileSync(gameOverAbs, rawGo, 'utf-8');
  }

  return {
    ok: true,
    gameTitle: opts.gameTitle,
    archetypeId: opts.archetypeId,
    dimension,
    levelScene: levelResPath,
    titleScene: 'res://scenes/title_menu.tscn',
    gameOverScene: 'res://scenes/game_over.tscn',
    injectedPrefabs,
  };
}
