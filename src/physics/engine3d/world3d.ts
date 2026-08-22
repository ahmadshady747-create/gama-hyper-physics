import { Vec3 } from '../../math/vec3';
import { RigidBody3D } from './body3d';
import { CollisionSystem3D, ContactManifold3D, ManifoldPool3D } from './collision3d';
import { ParticlePool3D } from '../common/pool';
import { IDimensionalEngine, DimensionMode } from '../common/types';

export interface WorldOptions3D {
  gravity?: Vec3;
  wind?: Vec3;
  boundsWidth?: number;
  boundsHeight?: number;
  boundsDepth?: number;
  solverIterations?: number;
}

const SCRATCH_EXPLOSION_DIR = new Vec3();
const SCRATCH_EXPLOSION_IMPULSE = new Vec3();

/**
 * PhysicsWorld3D - 3D Physics Simulator with 3D Bounds Enclosure.
 */
export class PhysicsWorld3D implements IDimensionalEngine {
  public readonly dimension: DimensionMode = '3d';
  public gravity: Vec3;
  public windForce: Vec3;
  public airResistance: number = 0.999;
  public angularDamping: number = 0.995;
  public solverIterations: number = 8;
  public bounds: { width: number; height: number; depth: number };

  public bodies: RigidBody3D[] = [];
  public manifoldPool: ManifoldPool3D = new ManifoldPool3D(1024);
  public particlePool: ParticlePool3D = new ParticlePool3D(1000);
  public activeManifolds: ContactManifold3D[] = [];

  public fixedDeltaTime: number = 1.0 / 60.0;
  public accumulator: number = 0;
  public maxSubSteps: number = 5;
  public isPaused: boolean = false;
  public timeScale: number = 1.0;

  constructor(options: WorldOptions3D = {}) {
    this.gravity = options?.gravity?.clone() ?? new Vec3(0, -980, 0);
    this.windForce = options?.wind?.clone() ?? new Vec3(0, 0, 0);
    this.bounds = {
      width: options?.boundsWidth || 800,
      height: options?.boundsHeight || 700,
      depth: options?.boundsDepth || 800
    };
    this.solverIterations = options?.solverIterations || 8;
  }

  public addBody(body: RigidBody3D): RigidBody3D {
    this.bodies?.push(body);
    return body;
  }

  public removeBody(body: RigidBody3D): void {
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

  public resizeBounds(width: number, height: number, depth?: number): void {
    this.bounds.width = Math.max(100, width);
    this.bounds.height = Math.max(100, height);
    this.bounds.depth = Math.max(100, depth || width);
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

  public setGravity(x: number, y: number, z: number = 0): void {
    this.gravity?.set(x, y, z);
  }

  public setWind(x: number, y: number, z: number = 0): void {
    this.windForce?.set(x, y, z);
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

        // 3D AABB Overlap
        const minA = bA.aabbMin, maxA = bA.aabbMax;
        const minB = bB.aabbMin, maxB = bB.aabbMax;

        if (
          maxA.x < minB.x || minA.x > maxB.x ||
          maxA.y < minB.y || minA.y > maxB.y ||
          maxA.z < minB.z || minA.z > maxB.z
        ) {
          continue;
        }

        const manifold = this.manifoldPool.get();
        let hasCollision = false;

        if (bA.type === 'sphere' && bB.type === 'sphere') {
          hasCollision = CollisionSystem3D.sphereVsSphere(bA, bB, manifold);
        } else if (bA.type === 'sphere' && bB.type === 'cube') {
          hasCollision = CollisionSystem3D.sphereVsBox(bA, bB, manifold);
        } else if (bA.type === 'cube' && bB.type === 'sphere') {
          hasCollision = CollisionSystem3D.sphereVsBox(bB, bA, manifold);
          if (hasCollision) {
            manifold.normal.negateInPlace();
            manifold.bodyA = bA;
            manifold.bodyB = bB;
          }
        } else {
          hasCollision = CollisionSystem3D.boxVsBox(bA, bB, manifold);
        }

        if (hasCollision && manifold.penetration > 0) {
          this.activeManifolds?.push(manifold);

          const relVel =
            Math.abs(bA.velocity.x - bB.velocity.x) +
            Math.abs(bA.velocity.y - bB.velocity.y) +
            Math.abs(bA.velocity.z - bB.velocity.z);

          if (relVel > 250) {
            const cp = manifold.contacts.at(0) ?? bA.position;
            this.particlePool?.emitImpactSparks(cp, manifold.normal, 5, '#f59e0b');
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
          CollisionSystem3D.solveVelocity(m);
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
        CollisionSystem3D.correctPositions(m);
      }
    }

    this.handleBoundaryCollisions();
  }

  private handleBoundaryCollisions(): void {
    const halfW = this.bounds.width * 0.5;
    const halfD = this.bounds.depth * 0.5;
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

      if (b.type === 'sphere') {
        const r = b.radius;
        // Floor (y = 0)
        if (pos.y - r < 0) {
          pos.y = r;
          if (vel.y < 0) vel.y = -vel.y * rest;
          vel.x *= (1.0 - fric * 0.1);
          vel.z *= (1.0 - fric * 0.1);
          if (Math.abs(vel.y) < 15) vel.y = 0;
          b.updateTransform();
        }
        // Ceiling
        else if (pos.y + r > height) {
          pos.y = height - r;
          if (vel.y > 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        // Left / Right Walls (-halfW, +halfW)
        if (pos.x - r < -halfW) {
          pos.x = -halfW + r;
          if (vel.x < 0) vel.x = -vel.x * rest;
          b.updateTransform();
        } else if (pos.x + r > halfW) {
          pos.x = halfW - r;
          if (vel.x > 0) vel.x = -vel.x * rest;
          b.updateTransform();
        }

        // Front / Back Walls (-halfD, +halfD)
        if (pos.z - r < -halfD) {
          pos.z = -halfD + r;
          if (vel.z < 0) vel.z = -vel.z * rest;
          b.updateTransform();
        } else if (pos.z + r > halfD) {
          pos.z = halfD - r;
          if (vel.z > 0) vel.z = -vel.z * rest;
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
          if (Math.abs(vel.y) < 15) vel.y = 0;
          b.updateTransform();
        } else if (max.y > height) {
          pos.y -= (max.y - height);
          if (vel.y > 0) vel.y = -vel.y * rest;
          b.updateTransform();
        }

        // X Walls
        if (min.x < -halfW) {
          pos.x -= (min.x - -halfW);
          if (vel.x < 0) vel.x = -vel.x * rest;
          b.updateTransform();
        } else if (max.x > halfW) {
          pos.x -= (max.x - halfW);
          if (vel.x > 0) vel.x = -vel.x * rest;
          b.updateTransform();
        }

        // Z Walls
        if (min.z < -halfD) {
          pos.z -= (min.z - -halfD);
          if (vel.z < 0) vel.z = -vel.z * rest;
          b.updateTransform();
        } else if (max.z > halfD) {
          pos.z -= (max.z - halfD);
          if (vel.z > 0) vel.z = -vel.z * rest;
          b.updateTransform();
        }
      }
    }
  }

  public applyExplosion(origin: { x: number; y: number; z?: number }, radius: number, maxForce: number = 900): void {
    const origZ = origin.z ?? 0;
    const origPos = new Vec3(origin.x, origin.y, origZ);
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
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < radSq && distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        SCRATCH_EXPLOSION_DIR.set(dx, dy, dz).normalizeSafe(new Vec3(0, 1, 0));

        let forceMag = 0;
        if (radius != 0) {
          const falloff = 1.0 - dist / radius;
          forceMag = maxForce * falloff;
        }

        SCRATCH_EXPLOSION_IMPULSE.set(
          SCRATCH_EXPLOSION_DIR.x * forceMag,
          SCRATCH_EXPLOSION_DIR.y * forceMag,
          SCRATCH_EXPLOSION_DIR.z * forceMag
        );

        b.velocity?.addScaledInPlace(SCRATCH_EXPLOSION_IMPULSE, b.invMass);
        b.angularVelocity?.set(
          b.angularVelocity.x + (Math.random() - 0.5) * 10 * b.invMass,
          b.angularVelocity.y + (Math.random() - 0.5) * 10 * b.invMass,
          b.angularVelocity.z + (Math.random() - 0.5) * 10 * b.invMass
        );
      }
    }

    this.particlePool?.emitExplosion(origPos, 75, 450);
  }

  public getBodyAtRay(rayOrigin: Vec3, rayDir: Vec3): RigidBody3D | null {
    let closestDist = Number.MAX_VALUE;
    let closestBody: RigidBody3D | null = null;
    const bodiesList = this.bodies;
    const count = bodiesList.length;

    for (let i = 0; i < count; i++) {
      const b = bodiesList.at(i);
      if (!b) continue;

      // Sphere test
      const toBody = new Vec3(b.position.x - rayOrigin.x, b.position.y - rayOrigin.y, b.position.z - rayOrigin.z);
      const proj = toBody.dot(rayDir);
      if (proj > 0) {
        const perpSq = toBody.magSq() - proj * proj;
        const rad = b.radius || (Math.max(b.width, b.height, b.depth) * 0.5);
        if (perpSq <= rad * rad && proj < closestDist) {
          closestDist = proj;
          closestBody = b;
        }
      }
    }
    return closestBody;
  }
}

