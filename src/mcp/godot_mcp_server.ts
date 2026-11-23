import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  GODOT_ARCHETYPES,
  GodotArchetypeId,
  listArchetypes,
  scaffoldArchetype,
} from '../godot/archetypes';
import { composeFullGameFlow } from '../godot/game_flow_composer';
import {
  balanceGameplayParameters,
  GameplayBalanceOptions,
} from '../godot/gameplay_balancer';
import { auditGdScript, autoFixGdScript } from '../godot/gdscript_auditor';
import { configureInputAction, InputKeyName } from '../godot/input_configurator';
import { generateProceduralGridLevel } from '../godot/level_grid_generator';
import { auditProjectHealth } from '../godot/project_auditor';
import {
  captureGodotScreenshot,
  checkGodotEnvironment,
  exportGodotBuild,
  listProjectFiles,
  runGodotHeadlessQa,
  runGodotPlaytestBot,
} from '../godot/runner';
import { generateGdShaderPreset } from '../godot/shader_generator';
import { generateThemeResource } from '../godot/theme_generator';
import { generateTscn, GodotSceneSpec } from '../godot/tscn_generator';
import { inspectTscnScene } from '../godot/tscn_inspector';

const PROJECT_DIR = resolve(process.cwd(), 'godot_project');

const ARCHETYPE_IDS: GodotArchetypeId[] = [
  'platformer_2d',
  'topdown_arena_2d',
  'twin_stick_cyber_2d',
  'collectathon_3d',
  'hover_racer_3d',
];

export const TOOLS: Tool[] = [
  {
    name: 'godot_check_environment',
    description:
      'Verifies that Godot 4.3+ is installed and accessible via PATH or GODOT_BIN and reports the exact engine version.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_inspect_project',
    description:
      'Inspects the Godot 4 project and returns all .tscn scenes, .gd scripts, and 3D/2D assets.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_inspect_scene_tree',
    description:
      'Statically parses any .tscn scene file without launching Godot, returning its full node hierarchy, groups, and verifying that every ExtResource path exists on disk.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneRelativePath: {
          type: 'string',
          description: 'Scene path inside godot_project, e.g. scenes/main.tscn',
        },
      },
      required: ['sceneRelativePath'],
    },
  },
  {
    name: 'godot_audit_project_health',
    description:
      'Runs a full static health audit across every .tscn scene, .gd script, and export_presets.cfg in godot_project/, checking format=3 headers, broken ExtResource links, 28 GDScript 4 rules, export preset readiness (Web, Windows Desktop, Android ARM64), and unreferenced gameplay scripts.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_list_archetypes',
    description:
      'Lists ready-to-scaffold 2D and 3D Godot 4 game archetypes (platformer_2d, topdown_arena_2d, twin_stick_cyber_2d, collectathon_3d, hover_racer_3d).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_scaffold_archetype',
    description:
      'Scaffolds a complete playable 2D or 3D Godot 4 game archetype (.tscn scene + typed GDScript 4 controller) into godot_project/.',
    inputSchema: {
      type: 'object',
      properties: {
        archetypeId: {
          type: 'string',
          enum: ARCHETYPE_IDS,
          description: 'Target archetype ID to scaffold',
        },
        customSceneRelativePath: {
          type: 'string',
          description: 'Optional custom output path for the .tscn scene inside godot_project',
        },
      },
      required: ['archetypeId'],
    },
  },
  {
    name: 'godot_compose_full_game_flow',
    description:
      'One-call complete game loop builder: composes a rich 2D or 3D gameplay scene pre-wired with Player, Camera, GameHUD, MobileTouchControls, Enemies, Pickups, Hazards/MovingPlatforms, and Checkpoint/GoalPortal, and updates TitleMenu and GameOverScreen.',
    inputSchema: {
      type: 'object',
      properties: {
        gameTitle: {
          type: 'string',
          description: 'Display title for the game, e.g. Cyber Runner 2099',
        },
        archetypeId: {
          type: 'string',
          enum: ARCHETYPE_IDS,
          description: 'Base gameplay archetype (2D or 3D)',
        },
        levelSceneRelativePath: {
          type: 'string',
          description: 'Optional output scene path inside godot_project, e.g. scenes/stage_1.tscn',
        },
      },
      required: ['gameTitle', 'archetypeId'],
    },
  },
  {
    name: 'godot_generate_grid_level',
    description:
      'Generates a complete 2D or 3D Godot 4 level (.tscn) from an 11-symbol ASCII grid map (P=Player, E=Enemy, T=Turret/Boss2D, S=ArenaBoss3D/2D, C=Coin/Crystal, H=Hazard/HealthPack, B=Boost/JumpPad, L=LootChest/KeyDoor, D=Dialogue/MovingPlatform, K=Checkpoint2D/3D, G=GoalPortal2D/3D).',
    inputSchema: {
      type: 'object',
      properties: {
        levelName: { type: 'string', description: 'Root node name for the level' },
        dimension: { type: 'string', enum: ['2D', '3D'], description: '2D or 3D level layout' },
        relativePath: {
          type: 'string',
          description: 'Output .tscn path inside godot_project, e.g. scenes/grid_level_1.tscn',
        },
        gridRows: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of ASCII strings representing rows, e.g. ["P.C.H.B.L.D.E.T.K.G"]',
        },
        cellSize: {
          type: 'number',
          description: 'Optional spacing per grid cell (default: 80 for 2D, 3 for 3D)',
        },
      },
      required: ['levelName', 'dimension', 'relativePath', 'gridRows'],
    },
  },
  {
    name: 'godot_generate_theme_tres',
    description:
      'Generates a valid Godot 4 (.tres format=3) UI Theme resource with styled StyleBoxFlat panels and buttons.',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: {
          type: 'string',
          description: 'Output .tres path inside godot_project, e.g. themes/cyber_theme.tres',
        },
        primaryColorHex: { type: 'string', description: 'Primary hex color, e.g. #00E5C4' },
        panelBgColorHex: { type: 'string', description: 'Panel background hex color, e.g. #0A101E' },
        borderColorHex: { type: 'string', description: 'Border hex color, e.g. #00E5C4' },
        cornerRadius: { type: 'number', description: 'Corner radius in px (default: 10)' },
        defaultFontSize: { type: 'number', description: 'Default font size (default: 20)' },
      },
      required: ['relativePath'],
    },
  },
  {
    name: 'godot_generate_shader_gdshader',
    description:
      'Generates a lightweight Godot 4 (.gdshader) visual shader preset (neon_pulse_canvas, hit_flash_canvas, hologram_spatial_3d) compatible with the GL Compatibility renderer.',
    inputSchema: {
      type: 'object',
      properties: {
        presetId: {
          type: 'string',
          enum: ['neon_pulse_canvas', 'hit_flash_canvas', 'hologram_spatial_3d'],
          description: 'Visual shader preset ID',
        },
        relativePath: {
          type: 'string',
          description: 'Output .gdshader path inside godot_project, e.g. shaders/neon_pulse.gdshader',
        },
      },
      required: ['presetId', 'relativePath'],
    },
  },
  {
    name: 'godot_balance_gameplay_parameters',
    description:
      'Automatically tunes @export var gameplay parameters across all 9 player, enemy, turret, and boss GDScript 4 controllers to match a target difficulty preset (casual, standard, hardcore).',
    inputSchema: {
      type: 'object',
      properties: {
        difficulty: {
          type: 'string',
          enum: ['casual', 'standard', 'hardcore'],
          description: 'Difficulty curve preset to apply',
        },
        scriptRelativePath: {
          type: 'string',
          description: 'Optional single script path to tune (tunes all 9 player/enemy/boss scripts if omitted)',
        },
      },
      required: ['difficulty'],
    },
  },
  {
    name: 'godot_configure_input_action',
    description:
      'Adds or updates an InputMap action in godot_project/project.godot (e.g. fire, dash, interact, move_up, move_down) bound to keyboard keys without manual InputEventKey serialization.',
    inputSchema: {
      type: 'object',
      properties: {
        actionName: {
          type: 'string',
          description: 'InputMap action name, e.g. fire or move_up',
        },
        keys: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['A', 'D', 'W', 'S', 'SPACE', 'E', 'Q', 'SHIFT', 'ENTER', 'ESCAPE', 'LEFT', 'RIGHT', 'UP', 'DOWN'],
          },
          description: 'List of keyboard keys to bind to this action',
        },
      },
      required: ['actionName', 'keys'],
    },
  },
  {
    name: 'godot_generate_scene_tscn',
    description:
      'Generates and saves a valid Godot 4 (.tscn format=3) scene file from structured JSON nodes (supports scriptPath, instanceScenePath for PackedScenes, and node groups).',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: {
          type: 'string',
          description: 'Path inside godot_project, e.g. scenes/level_1.tscn',
        },
        spec: { type: 'object', description: 'GodotSceneSpec JSON' },
      },
      required: ['relativePath', 'spec'],
    },
  },
  {
    name: 'godot_attach_hud_to_scene',
    description:
      'Attaches the built-in GAMA GameHUD (res://scenes/ui_hud.tscn) and optional WaveSpawner (res://scripts/wave_spawner.gd) to any existing .tscn scene in godot_project/.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneRelativePath: {
          type: 'string',
          description: 'Existing scene path inside godot_project, e.g. scenes/main.tscn',
        },
        includeWaveSpawner: {
          type: 'boolean',
          description: 'Whether to also attach a WaveSpawner node to the scene root',
        },
      },
      required: ['sceneRelativePath'],
    },
  },
  {
    name: 'godot_inject_enemy_spawner',
    description:
      'Injects a pre-wired WaveSpawner configured with either the 2D Chaser Enemy (res://scenes/enemy_chaser_2d.tscn) or 3D Drone Enemy (res://scenes/enemy_chaser_3d.tscn) into any target .tscn scene.',
    inputSchema: {
      type: 'object',
      properties: {
        sceneRelativePath: {
          type: 'string',
          description: 'Target .tscn scene inside godot_project, e.g. scenes/topdown_arena_2d.tscn',
        },
        dimension: {
          type: 'string',
          enum: ['2D', '3D'],
          description: 'Selects 2D Chaser Enemy or 3D Drone Enemy prefab',
        },
        autoStart: {
          type: 'boolean',
          description: 'Whether wave spawning starts immediately on _ready() (default: true)',
        },
      },
      required: ['sceneRelativePath', 'dimension'],
    },
  },
  {
    name: 'godot_write_gdscript',
    description:
      'Audits (and optionally auto-heals Godot 3 hallucinations in) a GDScript 4 file against 28 rules, saving it into godot_project if valid.',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: {
          type: 'string',
          description: 'Path inside godot_project, e.g. scripts/enemy.gd',
        },
        code: { type: 'string', description: 'Typed GDScript 4 source code' },
        autoFix: {
          type: 'boolean',
          description: 'Automatically rewrite Godot 3 syntax to Godot 4 before auditing (default: true)',
        },
      },
      required: ['relativePath', 'code'],
    },
  },
  {
    name: 'godot_autofix_gdscript',
    description:
      'Automatically heals Godot 3 hallucinations (KinematicBody2D/3D, Spatial, export/onready var, .instance(), yield(), move_and_slide(vel), 3-arg connect, Tween.new(), OS.get_ticks_msec(), emit_signal(), Pool*Array, str2var/var2str) into clean Godot 4 code and optionally saves it.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'GDScript source code to auto-heal (optional if relativePath is an existing file)',
        },
        relativePath: {
          type: 'string',
          description: 'Optional file path inside godot_project to read/save the healed script',
        },
      },
    },
  },
  {
    name: 'godot_validate_all_scripts',
    description:
      'Runs static 28-rule GDScript 4 audit across every .gd file in godot_project and reports errors and warnings.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_run_headless_qa',
    description:
      'Runs Godot 4 in --headless mode on a target scene for N frames and returns JSON QA telemetry (node count, player position, enemies count, pickups count, static memory).',
    inputSchema: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          description: 'Godot res:// scene path (default: res://scenes/main.tscn)',
        },
        frames: { type: 'number', description: 'Frames to simulate (default: 120)' },
      },
    },
  },
  {
    name: 'godot_run_playtest_bot',
    description:
      'Runs the autonomous Godot 4 playtest bot in --headless mode, injecting synthetic player input actions (move_left, move_right, jump, action) across N frames and verifying player displacement and gameplay telemetry.',
    inputSchema: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          description: 'Godot res:// scene path (default: res://scenes/main.tscn)',
        },
        frames: {
          type: 'number',
          description: 'Frames to simulate with synthetic input (default: 180)',
        },
        profile: {
          type: 'string',
          enum: ['explorer', 'Rusher'],
          description: 'Bot input behavior profile (default: explorer)',
        },
      },
    },
  },
  {
    name: 'godot_capture_screenshot',
    description:
      'Renders a target Godot 4 scene for N frames, captures a PNG screenshot of the live viewport, performs pixel-level visual health diagnostics (avgLuminance, nonBlackRatio, isBlankScreen, activeCamera), and returns both metadata and an inline image block.',
    inputSchema: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          description: 'Godot res:// scene path (default: res://scenes/main.tscn)',
        },
        frames: {
          type: 'number',
          description: 'Frames to step before capturing (default: 8)',
        },
        outputRelativePath: {
          type: 'string',
          description: 'Optional relative path inside godot_project, e.g. .gama_captures/main.png',
        },
        width: {
          type: 'number',
          description: 'Optional custom capture width in px (min 320)',
        },
        height: {
          type: 'number',
          description: 'Optional custom capture height in px (min 180)',
        },
      },
    },
  },
  {
    name: 'godot_export_build',
    description:
      'Exports a release build (Android, Web, or Windows Desktop) via Godot 4 headless export using export_presets.cfg.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: {
          type: 'string',
          description: 'Export preset name from export_presets.cfg: "Web", "Windows Desktop", or "Android"',
        },
        outputPath: { type: 'string', description: 'Target output file path' },
      },
      required: ['preset', 'outputPath'],
    },
  },
  {
    name: 'godot_list_agent_autoloads',
    description:
      'Returns the 12 built-in GAMA Godot 4 Autoload APIs (Juice, AudioSynth, GameState, CinemaDirector, CombatSystem, ProceduralVFX, DialogueSystem, ObjectPool, PerfMonitor, QuestSystem, InventorySystem, LocalizationSystem), 26 reusable prefabs, 5 game archetypes, and export presets.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export class GamaGodotMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'gama-godot4-ai', version: '5.19.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
      const { name, arguments: args } = req.params;
      try {
        const safeArgs = (args ?? {}) as Record<string, unknown>;
        if (name === 'godot_capture_screenshot') {
          const outPath =
            typeof safeArgs.outputRelativePath === 'string'
              ? this.safeResolve(safeArgs.outputRelativePath)
              : undefined;
          const capture = captureGodotScreenshot(
            PROJECT_DIR,
            typeof safeArgs.scene === 'string' ? safeArgs.scene : 'res://scenes/main.tscn',
            outPath,
            typeof safeArgs.frames === 'number' ? safeArgs.frames : 8,
            typeof safeArgs.width === 'number' ? safeArgs.width : undefined,
            typeof safeArgs.height === 'number' ? safeArgs.height : undefined
          );
          const { base64Png, ...meta } = capture;
          const content: Array<
            | { type: 'text'; text: string }
            | { type: 'image'; data: string; mimeType: string }
          > = [{ type: 'text', text: JSON.stringify(meta, null, 2) }];
          if (base64Png) {
            content.push({ type: 'image', data: base64Png, mimeType: 'image/png' });
          }
          return { content, isError: !capture.ok };
        }

        const result = this.dispatch(name, safeArgs);
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private safeResolve(rel: string): string {
    const clean = rel.replace(/^res:\/\//, '');
    const target = resolve(PROJECT_DIR, clean);
    if (target !== PROJECT_DIR && !target.startsWith(PROJECT_DIR + sep)) {
      throw new Error('Path traversal outside godot_project is blocked.');
    }
    return target;
  }

  private attachHudToScene(
    sceneRelativePath: string,
    includeWaveSpawner: boolean
  ): Record<string, unknown> {
    const abs = this.safeResolve(sceneRelativePath);
    if (!existsSync(abs)) {
      throw new Error(`Scene file not found: ${sceneRelativePath}`);
    }
    let content = readFileSync(abs, 'utf-8');
    let attachedHud = false;
    let attachedSpawner = false;

    if (!content.includes('res://scenes/ui_hud.tscn')) {
      const extLine = '[ext_resource type="PackedScene" path="res://scenes/ui_hud.tscn" id="gama_hud_ext"]';
      const lines = content.split(/\r?\n/);
      lines.splice(1, 0, extLine);
      lines.push(
        '',
        '[node name="GameHUD" parent="." instance=ExtResource("gama_hud_ext")]'
      );
      content = lines.join('\n');
      attachedHud = true;
    }

    if (includeWaveSpawner && !content.includes('res://scripts/wave_spawner.gd')) {
      const extLine = '[ext_resource type="Script" path="res://scripts/wave_spawner.gd" id="gama_spawner_ext"]';
      const lines = content.split(/\r?\n/);
      lines.splice(1, 0, extLine);
      lines.push(
        '',
        '[node name="WaveSpawner" type="Node" parent="."]',
        'script = ExtResource("gama_spawner_ext")'
      );
      content = lines.join('\n');
      attachedSpawner = true;
    }

    writeFileSync(abs, content, 'utf-8');
    return {
      ok: true,
      scene: `res://${sceneRelativePath.replace(/^res:\/\//, '')}`,
      attachedHud,
      attachedSpawner,
    };
  }

  private injectEnemySpawner(
    sceneRelativePath: string,
    dimension: '2D' | '3D',
    autoStart: boolean
  ): Record<string, unknown> {
    const abs = this.safeResolve(sceneRelativePath);
    if (!existsSync(abs)) {
      throw new Error(`Scene file not found: ${sceneRelativePath}`);
    }
    const enemyPrefab =
      dimension === '2D'
        ? 'res://scenes/enemy_chaser_2d.tscn'
        : 'res://scenes/enemy_chaser_3d.tscn';

    let content = readFileSync(abs, 'utf-8');
    const lines = content.split(/\r?\n/);

    if (!content.includes('id="gama_wave_script"')) {
      lines.splice(
        1,
        0,
        '[ext_resource type="Script" path="res://scripts/wave_spawner.gd" id="gama_wave_script"]',
        `[ext_resource type="PackedScene" path="${enemyPrefab}" id="gama_enemy_prefab"]`
      );
      lines.push(
        '',
        '[node name="EnemyWaveSpawner" type="Node" parent="."]',
        'script = ExtResource("gama_wave_script")',
        'enemy_scene = ExtResource("gama_enemy_prefab")',
        `auto_start = ${autoStart ? 'true' : 'false'}`
      );
      content = lines.join('\n');
      writeFileSync(abs, content, 'utf-8');
    }

    return {
      ok: true,
      scene: `res://${sceneRelativePath.replace(/^res:\/\//, '')}`,
      enemyPrefab,
      autoStart,
    };
  }

  public dispatch(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'godot_check_environment':
        return checkGodotEnvironment();

      case 'godot_inspect_project':
        return { projectDir: PROJECT_DIR, ...listProjectFiles(PROJECT_DIR) };

      case 'godot_inspect_scene_tree': {
        const rel = String(args.sceneRelativePath);
        this.safeResolve(rel);
        return inspectTscnScene(PROJECT_DIR, rel);
      }

      case 'godot_audit_project_health':
        return auditProjectHealth(PROJECT_DIR);

      case 'godot_list_archetypes':
        return { archetypes: listArchetypes() };

      case 'godot_scaffold_archetype': {
        const id = String(args.archetypeId) as GodotArchetypeId;
        const customScene =
          typeof args.customSceneRelativePath === 'string'
            ? args.customSceneRelativePath
            : undefined;
        if (customScene) {
          this.safeResolve(customScene);
        }
        return scaffoldArchetype(PROJECT_DIR, id, customScene);
      }

      case 'godot_compose_full_game_flow': {
        const customScene =
          typeof args.levelSceneRelativePath === 'string'
            ? args.levelSceneRelativePath
            : undefined;
        if (customScene) {
          this.safeResolve(customScene);
        }
        return composeFullGameFlow(PROJECT_DIR, {
          gameTitle: String(args.gameTitle || 'GAMA AI Game'),
          archetypeId: String(args.archetypeId) as GodotArchetypeId,
          levelSceneRelativePath: customScene,
        });
      }

      case 'godot_generate_grid_level': {
        const rel = String(args.relativePath);
        this.safeResolve(rel);
        const rows = Array.isArray(args.gridRows)
          ? args.gridRows.map((r) => String(r))
          : ['P..C..E..G'];
        return generateProceduralGridLevel(PROJECT_DIR, {
          levelName: String(args.levelName || 'GridStage'),
          dimension: String(args.dimension) === '3D' ? '3D' : '2D',
          relativePath: rel,
          gridRows: rows,
          cellSize: typeof args.cellSize === 'number' ? args.cellSize : undefined,
        });
      }

      case 'godot_generate_theme_tres': {
        const rel = String(args.relativePath);
        this.safeResolve(rel);
        return generateThemeResource(PROJECT_DIR, {
          relativePath: rel,
          primaryColorHex:
            typeof args.primaryColorHex === 'string' ? args.primaryColorHex : undefined,
          panelBgColorHex:
            typeof args.panelBgColorHex === 'string' ? args.panelBgColorHex : undefined,
          borderColorHex:
            typeof args.borderColorHex === 'string' ? args.borderColorHex : undefined,
          cornerRadius:
            typeof args.cornerRadius === 'number' ? args.cornerRadius : undefined,
          defaultFontSize:
            typeof args.defaultFontSize === 'number' ? args.defaultFontSize : undefined,
        });
      }

      case 'godot_generate_shader_gdshader': {
        const rel = String(args.relativePath);
        this.safeResolve(rel);
        return generateGdShaderPreset(PROJECT_DIR, {
          presetId: String(args.presetId) as
            | 'neon_pulse_canvas'
            | 'hit_flash_canvas'
            | 'hologram_spatial_3d',
          relativePath: rel,
        });
      }

      case 'godot_balance_gameplay_parameters': {
        const scriptRel =
          typeof args.scriptRelativePath === 'string'
            ? args.scriptRelativePath
            : undefined;
        if (scriptRel) {
          this.safeResolve(scriptRel);
        }
        return balanceGameplayParameters(PROJECT_DIR, {
          difficulty: (String(args.difficulty || 'standard') as GameplayBalanceOptions['difficulty']),
          scriptRelativePath: scriptRel,
        });
      }

      case 'godot_configure_input_action': {
        const keys = Array.isArray(args.keys)
          ? (args.keys.map((k) => String(k).toUpperCase()) as InputKeyName[])
          : (['E'] as InputKeyName[]);
        return configureInputAction(PROJECT_DIR, {
          actionName: String(args.actionName || 'custom_action'),
          keys,
        });
      }

      case 'godot_generate_scene_tscn': {
        const rel = String(args.relativePath);
        const content = generateTscn(args.spec as GodotSceneSpec);
        const out = this.safeResolve(rel);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, content, 'utf-8');
        return { ok: true, saved: `res://${rel.replace(/^res:\/\//, '')}`, bytes: content.length };
      }

      case 'godot_attach_hud_to_scene':
        return this.attachHudToScene(
          String(args.sceneRelativePath),
          Boolean(args.includeWaveSpawner)
        );

      case 'godot_inject_enemy_spawner':
        return this.injectEnemySpawner(
          String(args.sceneRelativePath),
          String(args.dimension) === '3D' ? '3D' : '2D',
          args.autoStart !== false
        );

      case 'godot_write_gdscript': {
        const rel = String(args.relativePath);
        const rawCode = String(args.code);
        const shouldAutoFix = args.autoFix !== false;
        const { fixedCode, fixesApplied, audit } = shouldAutoFix
          ? autoFixGdScript(rawCode)
          : { fixedCode: rawCode, fixesApplied: [], audit: auditGdScript(rawCode) };
        if (!audit.valid) {
          return { ok: false, fixesApplied, audit };
        }
        const out = this.safeResolve(rel);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, fixedCode, 'utf-8');
        return {
          ok: true,
          saved: `res://${rel.replace(/^res:\/\//, '')}`,
          fixesApplied,
          audit,
        };
      }

      case 'godot_autofix_gdscript': {
        const rel = typeof args.relativePath === 'string' ? args.relativePath : undefined;
        let sourceCode = typeof args.code === 'string' ? args.code : '';
        if (!sourceCode && rel) {
          const abs = this.safeResolve(rel);
          sourceCode = readFileSync(abs, 'utf-8');
        }
        const res = autoFixGdScript(sourceCode);
        if (rel && res.audit.valid) {
          const out = this.safeResolve(rel);
          mkdirSync(dirname(out), { recursive: true });
          writeFileSync(out, res.fixedCode, 'utf-8');
        }
        return {
          ok: res.audit.valid,
          ...(rel ? { saved: `res://${rel.replace(/^res:\/\//, '')}` } : {}),
          ...res,
        };
      }

      case 'godot_validate_all_scripts': {
        const { scripts } = listProjectFiles(PROJECT_DIR);
        const reports = scripts.map((resPath) => {
          const full = this.safeResolve(resPath);
          const src = readFileSync(full, 'utf-8');
          return { file: resPath, ...auditGdScript(src) };
        });
        return {
          totalScripts: reports.length,
          allValid: reports.every((r) => r.valid),
          reports,
        };
      }

      case 'godot_run_headless_qa':
        return runGodotHeadlessQa(
          PROJECT_DIR,
          typeof args.scene === 'string' ? args.scene : 'res://scenes/main.tscn',
          typeof args.frames === 'number' ? args.frames : 120
        );

      case 'godot_run_playtest_bot':
        return runGodotPlaytestBot(
          PROJECT_DIR,
          typeof args.scene === 'string' ? args.scene : 'res://scenes/main.tscn',
          typeof args.frames === 'number' ? args.frames : 180,
          typeof args.profile === 'string' ? args.profile : 'explorer'
        );

      case 'godot_export_build':
        return exportGodotBuild(
          PROJECT_DIR,
          String(args.preset),
          String(args.outputPath)
        );

      case 'godot_list_agent_autoloads':
        return {
          Juice: [
            'Juice.shake(strength, decay)',
            'Juice.hitstop(duration_sec)',
            'Juice.hit_heavy()',
            'Juice.reward()',
          ],
          AudioSynth: [
            'AudioSynth.play_tone(freq_hz, duration_sec, volume)',
            'AudioSynth.play_sweep(start_hz, end_hz, duration_sec, volume)',
            'AudioSynth.play_chord(frequencies_array, duration_sec, volume)',
            'AudioSynth.play_coin_chime()',
            'AudioSynth.play_laser_pew()',
            'AudioSynth.play_powerup_fanfare()',
            'AudioSynth.play_explosion_rumble()',
          ],
          GameState: [
            'GameState.add_score(points)',
            'GameState.reset_run_score()',
            'GameState.set_stage_playlist(scenes_array)',
            'GameState.advance_to_next_stage(completion_bonus)',
            'GameState.get_current_stage_index()',
            'GameState.is_campaign_completed()',
            'GameState.set_value(key, value)',
            'GameState.get_value(key, default_value)',
            'GameState.save_slot(slot_id)',
            'GameState.load_slot(slot_id)',
            'GameState.delete_slot(slot_id)',
            'GameState.list_save_slots()',
            'GameState.set_checkpoint_2d(checkpoint_id, world_pos)',
            'GameState.set_checkpoint_3d(checkpoint_id, world_pos)',
            'GameState.transition_to_scene(res_path)',
            'GameState.transition_with_fade(res_path, fade_sec)',
          ],
          CinemaDirector: [
            'CinemaDirector.set_letterbox(enabled, bar_height_px, duration_sec)',
            'CinemaDirector.flash_screen(color, duration_sec)',
            'CinemaDirector.fade_to_black(duration_sec)',
            'CinemaDirector.fade_from_black(duration_sec)',
            'CinemaDirector.hit_stop(freeze_sec)',
            'CinemaDirector.slow_mo_pulse(time_scale, duration_sec)',
            'CinemaDirector.shake_camera_2d(intensity, duration_sec)',
            'CinemaDirector.shake_camera_3d(intensity, duration_sec)',
            'CinemaDirector.focus_target_2d(world_pos, hold_sec)',
            'CinemaDirector.focus_target_3d(world_pos, camera_offset, hold_sec)',
            'CinemaDirector.orbit_sweep_3d(center_pos, radius, height, duration_sec)',
            'CinemaDirector.punch_zoom_2d(scale_factor, duration_sec)',
            'CinemaDirector.punch_fov_3d(fov_delta, duration_sec)',
          ],
          CombatSystem: [
            'CombatSystem.register_entity(entity, max_hp)',
            'CombatSystem.get_hp(entity, default_hp)',
            'CombatSystem.apply_damage(target, amount, score_on_defeat, iframe_ms)',
          ],
          ProceduralVFX: [
            'ProceduralVFX.spawn_burst_2d(world_pos, color, amount)',
            'ProceduralVFX.spawn_burst_3d(world_pos, color, amount)',
          ],
          DialogueSystem: [
            'DialogueSystem.show_line(speaker, text, auto_close_sec)',
            'DialogueSystem.show_sequence(lines_array)',
            'DialogueSystem.hide_dialogue()',
          ],
          ObjectPool: [
            'ObjectPool.prewarm(pool_key, packed_scene, count)',
            'ObjectPool.acquire(pool_key, fallback_scene)',
            'ObjectPool.release(pool_key, node)',
            'ObjectPool.clear_pool(pool_key)',
          ],
          PerfMonitor: [
            'PerfMonitor.get_snapshot()',
            'PerfMonitor.performance_warning(fps, memory_mb, node_count)',
          ],
          QuestSystem: [
            'QuestSystem.start_quest(quest_id, title, target_count, reward_score)',
            'QuestSystem.advance_quest(quest_id, step)',
            'QuestSystem.is_completed(quest_id)',
            'QuestSystem.get_quest_status(quest_id)',
          ],
          InventorySystem: [
            'InventorySystem.add_item(item_id, count, notify)',
            'InventorySystem.has_item(item_id, min_count)',
            'InventorySystem.consume_item(item_id, count)',
            'InventorySystem.get_item_count(item_id)',
            'InventorySystem.get_all_items()',
          ],
          LocalizationSystem: [
            'LocalizationSystem.set_locale("ar" | "en")',
            'LocalizationSystem.translate(key, fallback)',
            'LocalizationSystem.register_translation(key, ar_text, en_text)',
            'LocalizationSystem.is_rtl()',
          ],
          Prefabs: {
            TitleMenu: 'res://scenes/title_menu.tscn',
            GameOverScreen: 'res://scenes/game_over.tscn',
            GameHUD: 'res://scenes/ui_hud.tscn',
            MobileTouchControls: 'res://scenes/mobile_touch_controls.tscn',
            WaveSpawner: 'res://scripts/wave_spawner.gd',
            EnemyChaser2D: 'res://scenes/enemy_chaser_2d.tscn',
            EnemyChaser3D: 'res://scenes/enemy_chaser_3d.tscn',
            PickupCoin2D: 'res://scenes/pickup_coin_2d.tscn',
            PickupCrystal3D: 'res://scenes/pickup_crystal_3d.tscn',
            Projectile2D: 'res://scenes/projectile_2d.tscn',
            Projectile3D: 'res://scenes/projectile_3d.tscn',
            Checkpoint2D: 'res://scenes/checkpoint_2d.tscn',
            Checkpoint3D: 'res://scenes/checkpoint_3d.tscn',
            GoalPortal2D: 'res://scenes/goal_portal_2d.tscn',
            GoalPortal3D: 'res://scenes/goal_portal_3d.tscn',
            HazardSpikes2D: 'res://scenes/hazard_spikes_2d.tscn',
            MovingPlatform3D: 'res://scenes/moving_platform_3d.tscn',
            PowerupBoost2D: 'res://scenes/powerup_boost_2d.tscn',
            Turret3D: 'res://scenes/turret_3d.tscn',
            DialogueTrigger2D: 'res://scenes/dialogue_trigger_2d.tscn',
            JumpPad3D: 'res://scenes/jump_pad_3d.tscn',
            BossGuardian2D: 'res://scenes/boss_guardian_2d.tscn',
            BossSentinel3D: 'res://scenes/boss_sentinel_3d.tscn',
            HealthPack3D: 'res://scenes/health_pack_3d.tscn',
            LootChest2D: 'res://scenes/loot_chest_2d.tscn',
            KeyDoor3D: 'res://scenes/key_door_3d.tscn',
          },
          ExportPresets: ['Web', 'Windows Desktop', 'Android'],
          Archetypes: Object.keys(GODOT_ARCHETYPES),
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GAMA-Godot4 AI MCP Server v5.19.0 (23 lean agent tools) running on stdio');
  }
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  process.argv[1].replace(/\\/g, '/').endsWith('godot_mcp_server.ts');

if (isDirectRun) {
  const server = new GamaGodotMcpServer();
  server.start().catch((err) => {
    console.error('Fatal MCP Server Error:', err);
    process.exit(1);
  });
}
