import { PhysicsWorld2D, RigidBody2D } from '../physics';
import {
  AutoJuiceController,
  buildWorldFromSpec,
  GameEntitySpec,
  GamaGameSpec,
  validateGameSpec,
} from '../ai_engine';

export type GamePhase = 'menu' | 'playing' | 'paused' | 'victory' | 'gameover';

export interface VirtualInput {
  moveX?: number; // -1..1
  moveY?: number; // -1..1
  jump?: boolean;
  action?: boolean;
  launchDirX?: number;
  launchDirY?: number;
  launchPower?: number;
}

export interface RuntimeEntity {
  id: string;
  spec: GameEntitySpec;
  body: RigidBody2D;
  hp: number;
  maxHp: number;
  alive: boolean;
  initialX: number;
  initialY: number;
}

export interface GameEventRecord {
  frame: number;
  type: 'spawn' | 'hit' | 'destroy' | 'score' | 'victory' | 'gameover' | 'action';
  message: string;
}

/**
 * Full stateful game runtime built on top of GAMA Physics + Auto-Juice.
 * Supports both human play (Browser Canvas) and headless AI agent control (MCP/Bot).
 */
export class GamaGameRuntime {
  public readonly spec: GamaGameSpec;
  public readonly world: PhysicsWorld2D;
  public readonly juice: AutoJuiceController;
  public readonly entities: Map<string, RuntimeEntity> = new Map();
  public readonly events: GameEventRecord[] = [];

  public phase: GamePhase = 'playing';
  public frame = 0;
  public score = 0;
  public combo = 0;
  public playerHp = 100;
  public maxPlayerHp = 100;

  constructor(spec: GamaGameSpec) {
    const check = validateGameSpec(spec);
    if (!check.valid) {
      throw new Error(`Invalid GamaGameSpec: ${check.errors.join('; ')}`);
    }
    this.spec = spec;
    const built = buildWorldFromSpec(spec);
    this.world = built.world;
    this.juice = new AutoJuiceController();

    for (const [id, body] of built.bodyById.entries()) {
      const entSpec = built.specById.get(id)!;
      const baseHp = entSpec.role === 'player' ? 100 : entSpec.role === 'target' ? 40 : 9999;
      this.entities.set(id, {
        id,
        spec: entSpec,
        body,
        hp: baseHp,
        maxHp: baseHp,
        alive: true,
        initialX: body.position.x,
        initialY: body.position.y,
      });
    }
    this.logEvent('spawn', `Started "${spec.title}" with ${this.entities.size} entities.`);
  }

  private logEvent(type: GameEventRecord['type'], message: string): void {
    this.events.push({ frame: this.frame, type, message });
    if (this.events.length > 200) {
      this.events.shift();
    }
  }

  public getPlayer(): RuntimeEntity | undefined {
    for (const ent of this.entities.values()) {
      if (ent.spec.role === 'player' || ent.spec.role === 'projectile') {
        return ent;
      }
    }
    return undefined;
  }

  public step(dt: number = 1 / 60, input: VirtualInput = {}): void {
    if (this.phase !== 'playing') return;
    this.frame++;

    const hitstop = this.juice.update(dt);
    if (hitstop) return;

    const player = this.getPlayer();
    if (player && !player.body.isStatic) {
      if (input.moveX) {
        player.body.velocity.x += input.moveX * 420 * dt;
      }
      if (input.moveY) {
        player.body.velocity.y += input.moveY * 420 * dt;
      }
      if (input.jump && Math.abs(player.body.velocity.y) < 35) {
        player.body.velocity.y = -480;
        this.juice.trigger('light_hit', player.body.position.x, player.body.position.y, 'JUMP');
        this.logEvent('action', `${player.id} jumped.`);
      }
      if (
        input.action &&
        input.launchDirX !== undefined &&
        input.launchDirY !== undefined
      ) {
        const len = Math.hypot(input.launchDirX, input.launchDirY) || 1;
        const pwr = input.launchPower ?? 720;
        player.body.velocity.set(
          (input.launchDirX / len) * pwr,
          (input.launchDirY / len) * pwr
        );
        this.juice.trigger('heavy_hit', player.body.position.x, player.body.position.y, 'LAUNCH!');
        this.logEvent('action', `${player.id} launched at power ${pwr}.`);
      }
    }

    this.world.update(dt);

    // Evaluate targets toppled or knocked out of bounds
    let aliveTargets = 0;
    let totalTargets = 0;
    for (const ent of this.entities.values()) {
      if (ent.spec.role !== 'target') continue;
      totalTargets++;
      if (!ent.alive) continue;

      const disp = Math.hypot(
        ent.body.position.x - ent.initialX,
        ent.body.position.y - ent.initialY
      );
      const speed = Math.hypot(ent.body.velocity.x, ent.body.velocity.y);
      if (speed > 260) {
        ent.hp -= Math.round(speed * 0.08);
      }

      const knockedDown =
        ent.hp <= 0 ||
        disp > 75 ||
        Math.abs(ent.body.angle) > 0.75 ||
        ent.body.position.y > this.spec.height + 20;

      if (knockedDown) {
        ent.alive = false;
        this.combo++;
        const pts = 100 * this.combo;
        this.score += pts;
        this.juice.trigger(
          'reward',
          ent.body.position.x,
          ent.body.position.y,
          `+${pts}`
        );
        this.logEvent('destroy', `Target "${ent.id}" cleared (+${pts}).`);
      } else {
        aliveTargets++;
      }
    }

    if (totalTargets > 0 && aliveTargets === 0) {
      this.phase = 'victory';
      this.juice.trigger('level_up', this.spec.width / 2, this.spec.height / 2, 'VICTORY!');
      this.logEvent('victory', `All ${totalTargets} targets cleared! Final score: ${this.score}`);
    } else if (this.playerHp <= 0) {
      this.phase = 'gameover';
      this.juice.trigger('fail', this.spec.width / 2, this.spec.height / 2, 'GAME OVER');
      this.logEvent('gameover', 'Player HP reached 0.');
    }
  }

  public getSnapshot(): Record<string, unknown> {
    return {
      title: this.spec.title,
      phase: this.phase,
      frame: this.frame,
      score: this.score,
      combo: this.combo,
      playerHp: this.playerHp,
      contacts: this.world.getContactCount(),
      entities: [...this.entities.values()].map((e) => ({
        id: e.id,
        role: e.spec.role,
        alive: e.alive,
        hp: e.hp,
        x: +e.body.position.x.toFixed(1),
        y: +e.body.position.y.toFixed(1),
        angle: +e.body.angle.toFixed(3),
      })),
      recentEvents: this.events.slice(-8),
    };
  }
}
