import { Vec2 } from '../../math/vec2';
import { RigidBody2D } from './body2d';
import { CollisionSystem2D, ContactManifold2D, ManifoldPool2D } from './collision2d';
import { ParticlePool } from '../particles';
import { IDimensionalEngine, DimensionMode } from '../common/types';

export interface WorldOptions2D {
  gravity?: Vec2;
  wind?: Vec2;
  boundsWidth?: number;
  boundsHeight?: number;
  solverIterations?: number;
}

const SCRATCH_EXPLOSION_DIR = new Vec2();
const SCRATCH_EXPLOSION_IMPULSE = new Vec2();

/**
 * PhysicsWorld2D - 2D Physics Simulator implementing IDimensionalEngine.
 */
export class PhysicsWorld2D implements IDimensionalEngine {
  public readonly dimension: DimensionMode = '2d';
  public gravity: Vec2;
  public windForce: Vec2;
  public airResistance: number = 0.999;
  public angularDamping: number = 0.995;
  public solverIterations: number = 8;
  public bounds: { width: number; height: number };

  public bodies: RigidBody2D[] = [];
  public manifoldPool: ManifoldPool2D = new ManifoldPool2D(1024);
  public particlePool: ParticlePool = new ParticlePool(1000);
  public activeManifolds: ContactManifold2D[] = [];

  public fixedDeltaTime: number = 1.0 / 60.0;
  public accumulator: number = 0;
  public maxSubSteps: number = 5;
  public isPaused: boolean = false;
  public timeScale: number = 1.0;

  constructor(options: WorldOptions2D = {}) {
    this.gravity = options?.gravity?.clone() ?? new Vec2(0, 980);
    this.windForce = options?.wind?.clone() ?? new Vec2(0, 0);
    this.bounds = {
      width: options?.boundsWidth || 1280,
      height: options?.boundsHeight || 720
    };
    this.solverIterations = options?.solverIterations || 8;
  }

  public addBody(body: RigidBody2D): RigidBody2D {
    this.bodies?.push(body);
    return body;
  }

  public removeBody(body: RigidBody2D): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      this.bodies?.splice(idx, 1);
    }
  }

  public clearBodies(): void {
    this.bodies = [];
    this.manifoldPool?.clear();
    this.particlePool?.clear();
    this.activeManifolds = [];
  }

  public resizeBounds(width: number, height: number): void {
    this.bounds.width = Math.max(100, width);
    this.bounds.height = Math.max(100, height);
  }

  public getBodyCount(): number {
    return this.bodies.length;
  }

  public getContactCount(): number {
    return this.activeManifolds.length;
  }

  public getParticleCount(): number {
    return this.particlePool.activeCount;
  }

  public setGravity(x: number, y: number): void {
    this.gravity?.set(x, y);
  }

  public setWind(x: number, y: number): void {
    this.windForce?.set(x, y);
  }

  public setGlobalRestitution(val: number): void {
    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b = this.bodies.at(i);
      if (b) b.restitution = Math.max(0, Math.min(1, val));
    }
  }

  public setGlobalFriction(val: number): void {
    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b = this.bodies.at(i);
      if (b) b.friction = Math.max(0, Math.min(1, val));
    }
  }

  public setSolverIterations(iters: number): void {
    this.solverIterations = Math.max(1, iters);
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.05, Math.min(3.0, scale));
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public update(rawDt: number): void {
    if (this.isPaused) return;

    const clampedDt = Math.min(rawDt * this.timeScale, 0.1);
    this.accumulator += clampedDt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedDeltaTime && subSteps < this.maxSubSteps) {
      this.singleStep(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
      subSteps++;
    }

    this.particlePool?.update(clampedDt, this.gravity);
  }

  private singleStep(dt: number): void {
    const bodiesList = this.bodies;
    const bodyCount = bodiesList.length;

    for (let i = 0; i < bodyCount; i++) {
      const b = bodiesList.at(i);
      if (b && !b.isStatic) {
        b.integrateForces(this.gravity, this.windForce, dt);
      }
    }

    this.manifoldPool?.clear();
    this.activeManifolds = [];

    for (let i = 0; i < bodyCount; i++) {
      const bA = bodiesList.at(i);
      if (!bA) continue;

      for (let j = i + 1; j < bodyCount; j++) {
        const bB = bodiesList.at(j);
        if (!bB) continue;

        if (bA.isStatic && bB.isStatic) continue;

        const minA = bA.aabbMin;
        const maxA = bA.aabbMax;
        const minB = bB.aabbMin;
        const maxB = bB.aabbMax;

        if (maxA.x < minB.x || minA.x > maxB.x || maxA.y < minB.y || minA.y > maxB.y) {
          continue;
        }

        const manifold = this.manifoldPool.get();
        let hasCollision = false;

        if (bA.type === 'circle' && bB.type === 'circle') {
          hasCollision = CollisionSystem2D.circleVsCircle(bA, bB, manifold);
        } else if (bA.type === 'circle' && bB.type === 'box') {
          hasCollision = CollisionSystem2D.circleVsBox(bA, bB, manifold);
        } else if (bA.type === 'box' && bB.type === 'circle') {
          hasCollision = CollisionSystem2D.circleVsBox(bB, bA, manifold);
          if (hasCollision) {
            manifold.normal?.negateInPlace();
            manifold.bodyA = bA;
            manifold.bodyB = bB;
          }
        } else {
          hasCollision = CollisionSystem2D.boxVsBox(bA, bB, manifold);
        }

        if (hasCollision && manifold.penetration > 0) {
          this.activeManifolds?.push(manifold);

          const relVel = Math.abs(bA.velocity.x - bB.velocity.x) + Math.abs(bA.velocity.y - bB.velocity.y);
          if (relVel > 250) {
            const cp = manifold.contacts.at(0) ?? bA.position;
            this.particlePool?.emitImpactSparks(cp.x, cp.y, manifold.normal, 5, '#f59e0b');
          }
        }
      }
    }

    const manifoldCount = this.activeManifolds.length;
    const iters = this.solverIterations;

    for (let iter = 0; iter < iters; iter++) {
      for (let mIdx = 0; mIdx < manifoldCount; mIdx++) {
        const m = this.activeManifolds.at(mIdx);
        if (m) {
          CollisionSystem2D.solveVelocity(m);
        }
      }
    }

    for (let i = 0; i < bodyCount; i++) {
      const b = bodiesList.at(i);
      if (b && !b.isStatic) {
        b.integrateVelocity(dt, this.airResistance, this.angularDamping);
      }
    }

    for (let mIdx = 0; mIdx < manifoldCount; mIdx++) {
      const m = this.activeManifolds.at(mIdx);
      if (m) {
        CollisionSystem2D.correctPositions(m);
      }
    }

    this.handleBoundaryCollisions();
  }

  private handleBoundaryCollisions(): void {
    const width = this.bounds.width;
    const height = this.bounds.height;
    const bodiesList = this.bodies;
    const count = bodiesList.length;

    for (let i = 0; i < count; i++) {
      const b = bodiesList.at(i);
      if (!b || b.isStatic) continue;

      const pos = b.position;
      const vel = b.velocity;
      const rest = b.restitution;
      const fric = b.friction;

      if (b.type === 'circle') {
        const r = b.radius;
        if (pos.y + r > height) {
          pos.y = height - r;
          if (vel.y > 0) vel.y = -vel.y * rest;
          vel.x *= (1.0 - fric * 0.1);
          b.angularVelocity *= (1.0 - fric * 0.2);
          if (Math.abs(vel.y) < 15) vel.y = 0;
          b.updateTransform();
        } else if (pos.y - r < 0) {
          pos.y = r;
          if (vel.y < 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        if (pos.x - r < 0) {
          pos.x = r;
          if (vel.x < 0) vel.x = -vel.x * rest;
          vel.y *= (1.0 - fric * 0.1);
          b.updateTransform();
        } else if (pos.x + r > width) {
          pos.x = width - r;
          if (vel.x > 0) vel.x = -vel.x * rest;
          vel.y *= (1.0 - fric * 0.1);
          b.updateTransform();
        }
      } else {
        const min = b.aabbMin;
        const max = b.aabbMax;

        if (max.y > height) {
          const dy = max.y - height;
          pos.y -= dy;
          if (vel.y > 0) vel.y = -vel.y * rest;
          vel.x *= (1.0 - fric * 0.2);
          b.angularVelocity *= (1.0 - fric * 0.3);
          if (Math.abs(vel.y) < 15) vel.y = 0;
          b.updateTransform();
        } else if (min.y < 0) {
          pos.y -= min.y;
          if (vel.y < 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        if (min.x < 0) {
          pos.x -= min.x;
          if (vel.x < 0) vel.x = -vel.x * rest;
          vel.y *= (1.0 - fric * 0.1);
          b.updateTransform();
        } else if (max.x > width) {
          pos.x -= (max.x - width);
          if (vel.x > 0) vel.x = -vel.x * rest;
          vel.y *= (1.0 - fric * 0.1);
          b.updateTransform();
        }
      }
    }
  }

  public applyExplosion(origin: { x: number; y: number }, radius: number, maxForce: number = 800): void {
    const bodiesList = this.bodies;
    const count = bodiesList.length;
    const radSq = radius * radius;

    for (let i = 0; i < count; i++) {
      const b = bodiesList.at(i);
      if (!b || b.isStatic) continue;

      const pos = b.position;
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < radSq && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        SCRATCH_EXPLOSION_DIR?.set(dx, dy)?.normalizeSafe(new Vec2(0, -1));

        let forceMag = 0;
        if (radius != 0) {
          const falloff = 1.0 - dist / radius;
          forceMag = maxForce * falloff;
        }

        SCRATCH_EXPLOSION_IMPULSE?.set(
          SCRATCH_EXPLOSION_DIR.x * forceMag,
          SCRATCH_EXPLOSION_DIR.y * forceMag
        );

        b.velocity?.addScaledInPlace(SCRATCH_EXPLOSION_IMPULSE, b.invMass);
        b.angularVelocity += (Math.random() - 0.5) * 15 * b.invInertia;
      }
    }

    this.particlePool?.emitExplosion(origin.x, origin.y, 75, 450);
  }

  public getBodyAt(point: Vec2): RigidBody2D | null {
    const bodiesList = this.bodies;
    const count = bodiesList.length;

    for (let i = count - 1; i >= 0; i--) {
      const b = bodiesList.at(i);
      if (b && b.containsPoint(point)) {
        return b;
      }
    }
    return null;
  }
}

