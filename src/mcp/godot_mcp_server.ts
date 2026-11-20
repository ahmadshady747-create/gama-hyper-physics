import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { auditGdScript } from '../godot/gdscript_auditor';
import {
  exportGodotBuild,
  listProjectFiles,
  runGodotHeadlessQa,
} from '../godot/runner';
import { generateTscn, GodotSceneSpec } from '../godot/tscn_generator';

const PROJECT_DIR = resolve(process.cwd(), 'godot_project');

const TOOLS: Tool[] = [
  {
    name: 'godot_inspect_project',
    description:
      'Inspects the Godot 4 project and returns all .tscn scenes, .gd scripts, and 3D/2D assets.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_generate_scene_tscn',
    description:
      'Generates and saves a valid Godot 4 (.tscn format=3) scene file from structured JSON nodes.',
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
    name: 'godot_write_gdscript',
    description:
      'Audits a GDScript 4 file for Godot 3 hallucinations and saves it into godot_project if valid.',
    inputSchema: {
      type: 'object',
      properties: {
        relativePath: {
          type: 'string',
          description: 'Path inside godot_project, e.g. scripts/enemy.gd',
        },
        code: { type: 'string', description: 'Typed GDScript 4 source code' },
      },
      required: ['relativePath', 'code'],
    },
  },
  {
    name: 'godot_validate_all_scripts',
    description:
      'Runs static GDScript 4 audit across every .gd file in godot_project and reports issues.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'godot_run_headless_qa',
    description:
      'Runs Godot 4 in --headless mode on a target scene for N frames and returns JSON QA telemetry (node count, player position, elapsed time).',
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
    name: 'godot_export_build',
    description:
      'Exports a release build (Android AAB/APK, Web, or Windows) via Godot 4 headless export.',
    inputSchema: {
      type: 'object',
      properties: {
        preset: { type: 'string', description: 'Export preset name, e.g. Android or Web' },
        outputPath: { type: 'string', description: 'Target output file path' },
      },
      required: ['preset', 'outputPath'],
    },
  },
  {
    name: 'godot_list_agent_autoloads',
    description:
      'Returns the built-in GAMA Godot 4 Autoload APIs (Juice & AudioSynth) available in every script.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export class GamaGodotMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'gama-godot4-ai', version: '5.0.0' },
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
        const result = this.dispatch(name, (args ?? {}) as Record<string, unknown>);
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
    if (!target.startsWith(PROJECT_DIR)) {
      throw new Error('Path traversal outside godot_project is blocked.');
    }
    return target;
  }

  private dispatch(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'godot_inspect_project':
        return { projectDir: PROJECT_DIR, ...listProjectFiles(PROJECT_DIR) };

      case 'godot_generate_scene_tscn': {
        const rel = String(args.relativePath);
        const content = generateTscn(args.spec as GodotSceneSpec);
        const out = this.safeResolve(rel);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, content, 'utf-8');
        return { ok: true, saved: `res://${rel.replace(/^res:\/\//, '')}`, bytes: content.length };
      }

      case 'godot_write_gdscript': {
        const rel = String(args.relativePath);
        const code = String(args.code);
        const audit = auditGdScript(code);
        if (!audit.valid) {
          return { ok: false, audit };
        }
        const out = this.safeResolve(rel);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, code, 'utf-8');
        return { ok: true, saved: `res://${rel.replace(/^res:\/\//, '')}`, audit };
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

      case 'godot_export_build':
        return exportGodotBuild(
          PROJECT_DIR,
          String(args.preset),
          String(args.outputPath)
        );

      case 'godot_list_agent_autoloads':
        return {
          Juice: ['Juice.shake(strength, decay)', 'Juice.hitstop(duration_sec)', 'Juice.hit_heavy()', 'Juice.reward()'],
          AudioSynth: ['AudioSynth.play_tone(freq_hz, duration_sec, volume)'],
          HeadlessQA: 'godot --headless --path godot_project --script res://addons/gama_agent/agent_qa_runner.gd',
        };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GAMA-Godot4 AI MCP Server v5.0 (7 lean agent tools) running on stdio');
  }
}

const server = new GamaGodotMcpServer();
server.start().catch((err) => {
  console.error('Fatal MCP Server Error:', err);
  process.exit(1);
});
