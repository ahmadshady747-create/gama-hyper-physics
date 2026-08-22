import { Vec4 } from '../../math/vec4';
import { RigidBody4D } from './body4d';
import { CollisionSystem4D, ContactManifold4D, ManifoldPool4D } from './collision4d';
import { ParticlePool4D } from '../common/pool';
import { IDimensionalEngine, DimensionMode } from '../common/types';

export interface WorldOptions4D {
  gravity?: Vec4;
  boundsWidth?: number;
  boundsHeight?: number;
  boundsDepth?: number;
  boundsHyperDepth?: number;
  solverIterations?: number;
}

const SCRATCH_EXPLOSION_DIR_4D = new Vec4();
const SCRATCH_EXPLOSION_IMPULSE_4D = new Vec4();

/**
 * PhysicsWorld4D - 4D Hyper-Physics Simulator with 4D Hyper-Bounding Cage.
 */
export class PhysicsWorld4D implements IDimensionalEngine {
  public readonly dimension: DimensionMode = '4d';
  public gravity: Vec4;
  public windForce: Vec4;
  public airResistance: number = 0.999;
  public angularDamping: number = 0.995;
  public solverIterations: number = 8;
  public bounds: { width: number; height: number; depth: number; hyperDepth: number };

  // Real-time live hyper-plane spin speeds
  public hyperSpinXW: number = 0;
  public hyperSpinZW: number = 0;

  public bodies: RigidBody4D[] = [];
  public manifoldPool: ManifoldPool4D = new ManifoldPool4D(1024);
  public particlePool: ParticlePool4D = new ParticlePool4D(1000);
  public activeManifolds: ContactManifold4D[] = [];

  public fixedDeltaTime: number = 1.0 / 60.0;
  public accumulator: number = 0;
  public maxSubSteps: number = 5;
  public isPaused: boolean = false;
  public timeScale: number = 1.0;

  constructor(options: WorldOptions4D = {}) {
    this.gravity = options?.gravity?.clone() ?? new Vec4(0, -980, 0, 0);
    this.windForce = new Vec4(0, 0, 0, 0);
    this.bounds = {
      width: options?.boundsWidth || 700,
      height: options?.boundsHeight || 600,
      depth: options?.boundsDepth || 700,
      hyperDepth: options?.boundsHyperDepth || 700
    };
    this.solverIterations = options?.solverIterations || 8;
  }

  public addBody(body: RigidBody4D): RigidBody4D {
    this.bodies?.push(body);
    return body;
  }

  public removeBody(body: RigidBody4D): void {
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

  public resizeBounds(width: number, height: number, depth?: number, hyperDepth?: number): void {
    this.bounds.width = Math.max(100, width);
    this.bounds.height = Math.max(100, height);
    this.bounds.depth = Math.max(100, depth || width);
    this.bounds.hyperDepth = Math.max(100, hyperDepth || width);
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

  public setGravity(x: number, y: number, z: number = 0, w: number = 0): void {
    this.gravity?.set(x, y, z, w);
  }

  public setWind(x: number, y: number, z: number = 0): void {
    this.windForce?.set(x, y, z, 0);
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

  public setHyperSpin(xw: number, zw: number): void {
    this.hyperSpinXW = xw;
    this.hyperSpinZW = zw;
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
        // Apply manual hyper-plane spin forces
        b.angularVelocityXW += this.hyperSpinXW * dt;
        b.angularVelocityZW += this.hyperSpinZW * dt;
        b.integrateForces(this.gravity, dt);
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

        // 4D AABB Overlap
        const minA = bA.aabbMin, maxA = bA.aabbMax;
        const minB = bB.aabbMin, maxB = bB.aabbMax;

        if (
          maxA.x < minB.x || minA.x > maxB.x ||
          maxA.y < minB.y || minA.y > maxB.y ||
          maxA.z < minB.z || minA.z > maxB.z ||
          maxA.w < minB.w || minA.w > maxB.w
        ) {
          continue;
        }

        const manifold = this.manifoldPool.get();
        let hasCollision = false;

        if (bA.type === 'hypersphere' && bB.type === 'hypersphere') {
          hasCollision = CollisionSystem4D.hypersphereVsHypersphere(bA, bB, manifold);
        } else if (bA.type === 'hypersphere' && bB.type === 'tesseract') {
          hasCollision = CollisionSystem4D.hypersphereVsTesseract(bA, bB, manifold);
        } else if (bA.type === 'tesseract' && bB.type === 'hypersphere') {
          hasCollision = CollisionSystem4D.hypersphereVsTesseract(bB, bA, manifold);
          if (hasCollision) {
            manifold.normal.negateInPlace();
            manifold.bodyA = bA;
            manifold.bodyB = bB;
          }
        } else {
          hasCollision = CollisionSystem4D.tesseractVsTesseract(bA, bB, manifold);
        }

        if (hasCollision && manifold.penetration > 0) {
          this.activeManifolds?.push(manifold);

          const relVel =
            Math.abs(bA.velocity.x - bB.velocity.x) +
            Math.abs(bA.velocity.y - bB.velocity.y) +
            Math.abs(bA.velocity.z - bB.velocity.z) +
            Math.abs(bA.velocity.w - bB.velocity.w);

          if (relVel > 250) {
            const cp = manifold.contacts.at(0) ?? bA.position;
            this.particlePool?.emitImpactSparks(cp, manifold.normal, 5, '#c084fc');
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
          CollisionSystem4D.solveVelocity(m);
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
        CollisionSystem4D.correctPositions(m);
      }
    }

    this.handleBoundaryCollisions();
  }

  private handleBoundaryCollisions(): void {
    const halfW = this.bounds.width * 0.5;
    const halfD = this.bounds.depth * 0.5;
    const halfHq = this.bounds.hyperDepth * 0.5;
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

      if (b.type === 'hypersphere') {
        const r = b.radius;
        // Floor
        if (pos.y - r < 0) {
          pos.y = r;
          if (vel.y < 0) vel.y = -vel.y * rest;
          vel.x *= (1.0 - fric * 0.1);
          vel.z *= (1.0 - fric * 0.1);
          vel.w *= (1.0 - fric * 0.1);
          b.updateTransform();
        } else if (pos.y + r > height) {
          pos.y = height - r;
          if (vel.y > 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        // X
        if (pos.x - r < -halfW) {
          pos.x = -halfW + r;
          if (vel.x < 0) vel.x = -vel.x * rest;
          b.updateTransform();
        } else if (pos.x + r > halfW) {
          pos.x = halfW - r;
          if (vel.x > 0) vel.x = -vel.x * rest;
          b.updateTransform();
        }

        // Z
        if (pos.z - r < -halfD) {
          pos.z = -halfD + r;
          if (vel.z < 0) vel.z = -vel.z * rest;
          b.updateTransform();
        } else if (pos.z + r > halfD) {
          pos.z = halfD - r;
          if (vel.z > 0) vel.z = -vel.z * rest;
          b.updateTransform();
        }

        // W (4th Dimension Hyper-Walls)
        if (pos.w - r < -halfHq) {
          pos.w = -halfHq + r;
          if (vel.w < 0) vel.w = -vel.w * rest;
          b.updateTransform();
        } else if (pos.w + r > halfHq) {
          pos.w = halfHq - r;
          if (vel.w > 0) vel.w = -vel.w * rest;
          b.updateTransform();
        }
      } else {
        const min = b.aabbMin;
        const max = b.aabbMax;

        // Floor
        if (min.y < 0) {
          pos.y -= min.y;
          if (vel.y < 0) vel.y = -vel.y * rest;
          vel.x *= (1.0 - fric * 0.1);
          vel.z *= (1.0 - fric * 0.1);
          vel.w *= (1.0 - fric * 0.1);
          b.updateTransform();
        } else if (max.y > height) {
          pos.y -= (max.y - height);
          if (vel.y > 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        // X
        if (min.x < -halfW) {
          pos.x -= (min.x - -halfW);
          if (vel.x < 0) vel.x = -vel.x * rest;
          b.updateTransform();
        } else if (max.x > halfW) {
          pos.x -= (max.x - halfW);
          if (vel.x > 0) vel.x = -vel.x * rest;
          b.updateTransform();
        }

        // Z
        if (min.z < -halfD) {
          pos.z -= (min.z - -halfD);
          if (vel.z < 0) vel.z = -vel.z * rest;
          b.updateTransform();
        } else if (max.z > halfD) {
          pos.z -= (max.z - halfD);
          if (vel.z > 0) vel.z = -vel.z * rest;
          b.updateTransform();
        }

        // W
        if (min.w < -halfHq) {
          pos.w -= (min.w - -halfHq);
          if (vel.w < 0) vel.w = -vel.w * rest;
          b.updateTransform();
        } else if (max.w > halfHq) {
          pos.w -= (max.w - halfHq);
          if (vel.w > 0) vel.w = -vel.w * rest;
          b.updateTransform();
        }
      }
    }
  }

  public applyExplosion(origin: { x: number; y: number; z?: number; w?: number }, radius: number, maxForce: number = 1000): void {
    const origZ = origin.z ?? 0;
    const origW = origin.w ?? 0;
    const origPos = new Vec4(origin.x, origin.y, origZ, origW);
    const bodiesList = this.bodies;
    const count = bodiesList.length;
    const radSq = radius * radius;

    for (let i = 0; i < count; i++) {
      const b = bodiesList.at(i);
      if (!b || b.isStatic) continue;

      const pos = b.position;
      const dx = pos.x - origPos.x;
      const dy = pos.y - origPos.y;
      const dz = pos.z - origPos.z;
      const dw = pos.w - origPos.w;
      const distSq = dx * dx + dy * dy + dz * dz + dw * dw;

      if (distSq < radSq && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        SCRATCH_EXPLOSION_DIR_4D.set(dx, dy, dz, dw).normalizeSafe(new Vec4(0, 1, 0, 0));

        let forceMag = 0;
        if (radius != 0) {
          const falloff = 1.0 - dist / radius;
          forceMag = maxForce * falloff;
        }

        SCRATCH_EXPLOSION_IMPULSE_4D.set(
          SCRATCH_EXPLOSION_DIR_4D.x * forceMag,
          SCRATCH_EXPLOSION_DIR_4D.y * forceMag,
          SCRATCH_EXPLOSION_DIR_4D.z * forceMag,
          SCRATCH_EXPLOSION_DIR_4D.w * forceMag
        );

        b.velocity?.addScaledInPlace(SCRATCH_EXPLOSION_IMPULSE_4D, b.invMass);
        b.angularVelocityXW += (Math.random() - 0.5) * 8 * b.invInertia;
        b.angularVelocityZW += (Math.random() - 0.5) * 8 * b.invInertia;
      }
    }

    this.particlePool?.emitExplosion(origPos, 75, 450);
  }
}

