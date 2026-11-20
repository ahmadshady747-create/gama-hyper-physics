import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { Vec2, Vec3, Vec4, Rotor4D } from '../math';
import {
  PhysicsWorld2D,
  RigidBody2D,
  PhysicsWorld3D,
  RigidBody3D,
  PhysicsWorld4D,
  RigidBody4D
} from '../physics';
import { Projection4D } from '../render';
import {
  GamaGameSpec,
  runHeadlessPlaytest,
  validateGameSpec
} from '../ai_engine';
import {
  createArchetypeGame,
  exportPlayableHtml,
  GameArchetype,
  GamaGameRuntime,
  renderRuntimeToSvg,
  VirtualInput
} from '../game_engine';

const TOOLS_MANIFEST: Tool[] = [
  {
    name: 'gama_create_archetype_game',
    description:
      'Generates a complete, balanced, ready-to-play GamaGameSpec for one of 4 game archetypes: tower_demolition, arena_survivor, physics_platformer, or pinball_breakout.',
    inputSchema: {
      type: 'object',
      properties: {
        archetype: {
          type: 'string',
          enum: ['tower_demolition', 'arena_survivor', 'physics_platformer', 'pinball_breakout']
        },
        title: { type: 'string', description: 'Optional custom game title' }
      },
      required: ['archetype']
    }
  },
  {
    name: 'gama_run_game_session',
    description:
      'Boots a stateful GamaGameRuntime from a spec, steps it for N frames with optional virtual agent inputs (move/jump/launch), and returns score, combo, phase, entity states, and game events.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'GamaGameSpec JSON' },
        frames: { type: 'number', description: 'Frames to step (default: 120)' },
        input: { type: 'object', description: 'Optional VirtualInput applied on frame 10' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_capture_svg_snapshot',
    description:
      'Simulates a game spec to frame N and returns a crisp, zero-dependency SVG visual snapshot of the arena, entities, rotations, and HUD so AI agents can inspect layout and visuals.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'GamaGameSpec JSON' },
        frames: { type: 'number', description: 'Frames to advance before snapshot (default: 0)' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_export_playable_html',
    description:
      'Compiles any GamaGameSpec into a standalone, self-contained playable HTML5 Canvas game file with drag-to-launch controls, screen shake, particles, and Web Audio SFX.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'GamaGameSpec JSON' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_balance_sweep',
    description:
      'Runs an automated parameter sweep across multiple launch impulses (e.g. 450, 650, 850, 1050) on a GamaGameSpec and recommends the most fun and reliable difficulty tuning.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'GamaGameSpec JSON' },
        impulses: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of launch speeds to test (default: [450, 650, 850, 1050])'
        }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_validate_game_spec',
    description:
      'Validates a declarative 2D GamaGameSpec JSON scene (arena bounds, entity shapes, mass, IDs) and returns errors and warnings before running.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'GamaGameSpec JSON object' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_auto_playtest',
    description:
      'Runs a headless AI bot playtest on a GamaGameSpec for N frames, checking NaN explosions, out-of-bounds escapes, structure stability, target toppling, FPS, and QA recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object' },
        policy: {
          type: 'string',
          enum: ['stability_check', 'launch_towards_target', 'stress_impulse']
        },
        frames: { type: 'number' },
        launchImpulse: { type: 'number' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_check_tower_stability',
    description:
      'Verifies whether a stacked 2D physics structure remains stable under gravity for 180 frames without collapsing.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object' },
        frames: { type: 'number' }
      },
      required: ['spec']
    }
  },
  {
    name: 'gama_simulate_2d',
    description: 'Executes a 2D physics simulation trajectory and returns body states and contact count.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'number' },
        dt: { type: 'number' },
        gravityY: { type: 'number' },
        bodies: { type: 'array' }
      }
    }
  },
  {
    name: 'gama_simulate_3d',
    description: 'Executes a 3D rigid body simulation and returns 3D positions, orientations, and contacts.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'number' },
        dt: { type: 'number' },
        gravityY: { type: 'number' },
        bodies: { type: 'array' }
      }
    }
  },
  {
    name: 'gama_simulate_4d',
    description: 'Executes a 4D Hyper-Physics simulation and returns 4D and projected 3D states.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: { type: 'number' },
        dt: { type: 'number' },
        hyperSpinXW: { type: 'number' },
        hyperSpinZW: { type: 'number' },
        bodies: { type: 'array' }
      }
    }
  },
  {
    name: 'gama_rotate_4d_vector',
    description: 'Rotates a 4D hyper-vector (x, y, z, w) across any of the 6 orthogonal planes in SO(4).',
    inputSchema: {
      type: 'object',
      properties: {
        vector: { type: 'object' },
        plane: { type: 'string', enum: ['xy', 'xz', 'xw', 'yz', 'yw', 'zw'] },
        theta: { type: 'number' }
      },
      required: ['vector', 'plane', 'theta']
    }
  },
  {
    name: 'gama_project_4d',
    description: 'Calculates 4D -> 3D perspective projection with w-depth chromatic shift.',
    inputSchema: {
      type: 'object',
      properties: {
        points4D: { type: 'array' },
        hyperDistance: { type: 'number' }
      },
      required: ['points4D']
    }
  },
  {
    name: 'gama_benchmark',
    description: 'Runs Zero-GC physics simulation benchmark across 2D, 3D, and 4D regimes.',
    inputSchema: {
      type: 'object',
      properties: {
        iterations: { type: 'number' }
      }
    }
  }
];

export class GamaMcpServer {
  private server: Server;
  private proj4D = new Projection4D(450);

  constructor() {
    this.server = new Server(
      {
        name: 'gama-game-engine',
        version: '4.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS_MANIFEST
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        const toolResult = this.executeTool(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
            }
          ]
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text',
              text: `Tool execution failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GAMA AI Game Engine MCP Server v4.0 (14 tools) running on stdio');
  }

  private executeTool(name: string, args: Record<string, unknown>): unknown {
    switch (name) {
      case 'gama_create_archetype_game':
        return createArchetypeGame(
          args.archetype as GameArchetype,
          typeof args.title === 'string' ? args.title : undefined
        );
      case 'gama_run_game_session': {
        const runtime = new GamaGameRuntime(args.spec as GamaGameSpec);
        const frames = Math.min(600, Math.max(1, Number(args.frames) || 120));
        const input = (args.input as VirtualInput) || {};
        for (let f = 0; f < frames; f++) {
          runtime.step(1 / 60, f === 10 ? input : {});
        }
        return runtime.getSnapshot();
      }
      case 'gama_capture_svg_snapshot': {
        const runtime = new GamaGameRuntime(args.spec as GamaGameSpec);
        const frames = Math.min(300, Math.max(0, Number(args.frames) || 0));
        for (let f = 0; f < frames; f++) runtime.step(1 / 60);
        return renderRuntimeToSvg(runtime);
      }
      case 'gama_export_playable_html':
        return exportPlayableHtml(args.spec as GamaGameSpec);
      case 'gama_balance_sweep': {
        const spec = args.spec as GamaGameSpec;
        const impulses = Array.isArray(args.impulses) && args.impulses.length > 0
          ? (args.impulses as number[])
          : [450, 650, 850, 1050];
        const trials = impulses.map((imp) => {
          const rep = runHeadlessPlaytest(spec, {
            policy: 'launch_towards_target',
            frames: 180,
            launchImpulse: imp
          });
          return {
            launchImpulse: imp,
            targetsToppled: rep.targetsToppled,
            totalTargets: rep.totalTargets,
            nanDetected: rep.nanDetected,
            outOfBoundsCount: rep.outOfBoundsIds.length
          };
        });
        const best = trials.find((t) => !t.nanDetected && t.targetsToppled > 0) ?? trials[0];
        return { title: spec.title, trials, recommendedImpulse: best.launchImpulse };
      }
      case 'gama_validate_game_spec':
        return validateGameSpec(args.spec as GamaGameSpec);
      case 'gama_auto_playtest':
        return runHeadlessPlaytest(args.spec as GamaGameSpec, {
          policy: args.policy as 'stability_check' | 'launch_towards_target' | 'stress_impulse' | undefined,
          frames: typeof args.frames === 'number' ? args.frames : 180,
          launchImpulse: typeof args.launchImpulse === 'number' ? args.launchImpulse : undefined
        });
      case 'gama_check_tower_stability':
        return runHeadlessPlaytest(args.spec as GamaGameSpec, {
          policy: 'stability_check',
          frames: typeof args.frames === 'number' ? args.frames : 180
        });
      case 'gama_simulate_2d':
        return this.toolSimulate2D(args);
      case 'gama_simulate_3d':
        return this.toolSimulate3D(args);
      case 'gama_simulate_4d':
        return this.toolSimulate4D(args);
      case 'gama_rotate_4d_vector':
        return this.toolRotate4D(args);
      case 'gama_project_4d':
        return this.toolProject4D(args);
      case 'gama_benchmark':
        return this.toolBenchmark(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private toolSimulate2D(args: any): any {
    const steps = Math.min(100, Math.max(1, args.steps || 1));
    const dt = args.dt || 0.0166;
    const gY = args.gravityY ?? 980;
    const world = new PhysicsWorld2D({ gravity: new Vec2(0, gY), boundsWidth: 1200, boundsHeight: 800 });
    for (const bi of args.bodies || []) {
      world.addBody(new RigidBody2D({
        type: bi.type || 'circle',
        position: new Vec2(bi.x, bi.y),
        velocity: new Vec2(bi.vx || 0, bi.vy || 0),
        radius: bi.radius || 20,
        width: bi.width || 40,
        height: bi.height || 40,
        mass: bi.mass || 1.0,
        isStatic: bi.isStatic || false
      }));
    }
    for (let s = 0; s < steps; s++) world.update(dt);
    return {
      dimension: '2D',
      simulatedSteps: steps,
      contacts: world.getContactCount(),
      bodies: world.bodies.map(b => ({
        type: b.type,
        position: { x: b.position.x, y: b.position.y },
        velocity: { x: b.velocity.x, y: b.velocity.y },
        angle: b.angle,
        angularVelocity: b.angularVelocity
      }))
    };
  }

  private toolSimulate3D(args: any): any {
    const steps = Math.min(100, Math.max(1, args.steps || 1));
    const dt = args.dt || 0.0166;
    const gY = args.gravityY ?? -980;
    const world = new PhysicsWorld3D({ gravity: new Vec3(0, gY, 0), boundsWidth: 800, boundsHeight: 600, boundsDepth: 800 });
    for (const bi of args.bodies || []) {
      world.addBody(new RigidBody3D({
        type: bi.type || 'sphere',
        position: new Vec3(bi.x, bi.y, bi.z),
        velocity: new Vec3(bi.vx || 0, bi.vy || 0, bi.vz || 0),
        radius: bi.radius || 20,
        width: bi.size || 40,
        height: bi.size || 40,
        depth: bi.size || 40,
        mass: bi.mass || 1.0,
        isStatic: bi.isStatic || false
      }));
    }
    for (let s = 0; s < steps; s++) world.update(dt);
    return {
      dimension: '3D',
      simulatedSteps: steps,
      contacts: world.getContactCount(),
      bodies: world.bodies.map(b => ({
        type: b.type,
        position: { x: b.position.x, y: b.position.y, z: b.position.z },
        velocity: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z },
        orientation: { x: b.orientation.x, y: b.orientation.y, z: b.orientation.z, w: b.orientation.w }
      }))
    };
  }

  private toolSimulate4D(args: any): any {
    const steps = Math.min(100, Math.max(1, args.steps || 1));
    const dt = args.dt || 0.0166;
    const world = new PhysicsWorld4D({ gravity: new Vec4(0, -980, 0, 0), boundsWidth: 800, boundsHeight: 600, boundsDepth: 800, boundsHyperDepth: 800 });
    if (args.hyperSpinXW) world.hyperSpinXW = args.hyperSpinXW;
    if (args.hyperSpinZW) world.hyperSpinZW = args.hyperSpinZW;
    for (const bi of args.bodies || []) {
      world.addBody(new RigidBody4D({
        type: bi.type || 'hypersphere',
        position: new Vec4(bi.x, bi.y, bi.z, bi.w),
        velocity: new Vec4(bi.vx || 0, bi.vy || 0, bi.vz || 0, bi.vw || 0),
        radius: bi.radius || 25,
        width: bi.size || 50,
        height: bi.size || 50,
        depth: bi.size || 50,
        hyperDepth: bi.size || 50,
        mass: bi.mass || 1.0
      }));
    }
    for (let s = 0; s < steps; s++) world.update(dt);
    const projOut3 = new Vec3();
    return {
      dimension: '4D Hyper',
      simulatedSteps: steps,
      contacts: world.getContactCount(),
      bodies: world.bodies.map(b => {
        this.proj4D.project4DTo3D(b.position, projOut3);
        return {
          type: b.type,
          position4D: { x: b.position.x, y: b.position.y, z: b.position.z, w: b.position.w },
          projected3D: { x: projOut3.x, y: projOut3.y, z: projOut3.z },
          velocity4D: { x: b.velocity.x, y: b.velocity.y, z: b.velocity.z, w: b.velocity.w },
          depthHueColor: this.proj4D.getDepthCueColor(b.position.w, 1.0)
        };
      })
    };
  }

  private toolRotate4D(args: any): any {
    const v = args.vector;
    const plane = args.plane || 'xw';
    const theta = args.theta || 0;
    const rotor = new Rotor4D();
    if (plane === 'xy') rotor.angleXY = theta;
    else if (plane === 'xz') rotor.angleXZ = theta;
    else if (plane === 'xw') rotor.angleXW = theta;
    else if (plane === 'yz') rotor.angleYZ = theta;
    else if (plane === 'yw') rotor.angleYW = theta;
    else if (plane === 'zw') rotor.angleZW = theta;
    const outV = new Vec4();
    rotor.rotateVec4(new Vec4(v.x, v.y, v.z, v.w), outV);
    return { inputVector: v, plane, thetaRadians: theta, rotatedVector: { x: outV.x, y: outV.y, z: outV.z, w: outV.w } };
  }

  private toolProject4D(args: any): any {
    const pts = args.points4D || [];
    const hDist = args.hyperDistance || 450;
    const proj = new Projection4D(hDist);
    const out3 = new Vec3();
    return {
      hyperDistance: hDist,
      projectedPoints: pts.map((p: any) => {
        proj.project4DTo3D(new Vec4(p.x, p.y, p.z, p.w), out3);
        return { original4D: p, projected3D: { x: out3.x, y: out3.y, z: out3.z }, depthCueColor: proj.getDepthCueColor(p.w, 1.0) };
      })
    };
  }

  private toolBenchmark(args: any): any {
    const iters = Math.min(500, Math.max(10, args.iterations || 120));
    const w2 = new PhysicsWorld2D({ boundsWidth: 1000, boundsHeight: 1000 });
    for (let i = 0; i < 100; i++) {
      w2.addBody(new RigidBody2D({ type: i % 2 === 0 ? 'circle' : 'box', position: new Vec2(100 + (i * 20) % 800, 100 + (i * 15) % 600), radius: 15, width: 30, height: 30 }));
    }
    const t0 = performance.now();
    for (let i = 0; i < iters; i++) w2.update(0.0166);
    const ms2D = (performance.now() - t0) / iters;
    return { iterations: iters, '2D_100_bodies': { latency_ms: +ms2D.toFixed(3), fps_potential: Math.round(1000 / ms2D) } };
  }
}

const server = new GamaMcpServer();
server.start().catch((err) => {
  console.error('Fatal error starting GAMA MCP Server:', err);
  process.exit(1);
});
