import { Vec3 } from '../../math/vec3';
import { RigidBody3D } from './body3d';
import { CollisionSystem3D, ContactManifold3D, ManifoldPool3D } from './collision3d';
import { ParticlePool3D } from '../common/pool';
import { IDimensionalEngine, DimensionMode } from '../common/types';
import { DynamicBVHTree3D } from '../broadphase/bvh';
import { IslandSleepingManager, ISleepContact } from '../common/sleeping';
import { Ray3D, RayHit3D, rayVsSphere3D, rayVsBox3D, rayVsCapsule3D } from '../queries/raycast';
import { Capsule3D } from '../shapes/capsule';

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
 * PhysicsWorld3D - 3D Physics Simulator with Dynamic BVH Tree, Island Sleeping, and Raycasting.
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

  // Phase 1 Subsystems: BVH Broadphase & Island Sleeping
  public bvhTree: DynamicBVHTree3D<RigidBody3D> = new DynamicBVHTree3D<RigidBody3D>(256);
  public sleepingManager: IslandSleepingManager<RigidBody3D> = new IslandSleepingManager<RigidBody3D>();

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
    body.updateTransform();
    body.bvhProxyId = this.bvhTree.createProxy(body.currentAABB, body);
    this.bodies.push(body);
    return body;
  }

  public removeBody(body: RigidBody3D): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      if (body.bvhProxyId !== -1) {
        this.bvhTree.destroyProxy(body.bvhProxyId);
        body.bvhProxyId = -1;
      }
      this.bodies.splice(idx, 1);
    }
  }

  public clearBodies(): void {
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.bvhProxyId !== -1) {
        this.bvhTree.destroyProxy(b.bvhProxyId);
        b.bvhProxyId = -1;
      }
    }
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

  public setGravity(x: number, y: number, z?: number): void {
    this.gravity?.set(x, y, z ?? 0);
  }

  public setWind(x: number, y: number, z?: number): void {
    this.windForce?.set(x, y, z ?? 0);
  }

  public setGlobalRestitution(val: number): void {
    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b = this.bodies[i];
      if (b) b.restitution = Math.max(0, Math.min(1, val));
    }
  }

  public setGlobalFriction(val: number): void {
    const len = this.bodies.length;
    for (let i = 0; i < len; i++) {
      const b = this.bodies[i];
      if (b) b.friction = Math.max(0, Math.min(1, val));
    }
  }

  public setSolverIterations(iters: number): void {
    this.solverIterations = Math.max(1, Math.min(30, iters));
  }

  public setTimeScale(scale: number): void {
    this.timeScale = Math.max(0, Math.min(5, scale));
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public update(rawDt: number): void {
    if (this.isPaused) return;

    const clampedDt = Math.min(0.1, Math.max(0.001, rawDt)) * this.timeScale;
    this.accumulator += clampedDt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedDeltaTime && subSteps < this.maxSubSteps) {
      this.singleStep(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
      subSteps++;
    }

    this.particlePool.update(clampedDt, this.gravity);
  }

  public singleStep(dt: number): void {
    const bodyCount = this.bodies.length;
    if (bodyCount === 0) return;

    // 1. Integrate Forces (skip sleeping bodies)
    for (let i = 0; i < bodyCount; i++) {
      const b = this.bodies[i];
      if (!b || b.isStatic || b.isSleeping) continue;
      b.integrateForces(this.gravity, this.windForce, dt);
    }

    // 2. Integrate Velocities and Update BVH Proxies
    for (let i = 0; i < bodyCount; i++) {
      const b = this.bodies[i];
      if (!b || b.isStatic || b.isSleeping) continue;
      b.integrateVelocity(dt, this.airResistance, this.angularDamping);
      this.enforceBoundary(b);

      if (b.bvhProxyId !== -1) {
        this.bvhTree.moveProxy(b.bvhProxyId, b.currentAABB, b.velocity);
      }
    }

    // 3. Broadphase Collision via Dynamic BVH Tree
    this.manifoldPool.clear();
    this.activeManifolds = [];

    this.bvhTree.generatePairs((a: RigidBody3D, b: RigidBody3D) => {
      if (a.id === b.id) return;
      if (a.isStatic && b.isStatic) return;
      if (a.isSleeping && b.isSleeping) return;

      const manifold = this.manifoldPool.get();
      const collided = CollisionSystem3D.detectCollision(a, b, manifold);

      if (collided) {
        if (a.isTrigger || b.isTrigger) {
          return;
        }

        this.activeManifolds.push(manifold);

        if (manifold.penetration > 2.0) {
          this.emitCollisionParticles(manifold);
        }
      }
    });

    // 4. Island Sleeping System Update
    const sleepContacts: ISleepContact<RigidBody3D>[] = [];
    for (let m = 0; m < this.activeManifolds.length; m++) {
      const c = this.activeManifolds[m];
      if (c.bodyA && c.bodyB) {
        sleepContacts.push({ bodyA: c.bodyA, bodyB: c.bodyB });
      }
    }
    this.sleepingManager.update(this.bodies, sleepContacts, dt);

    // 5. Sequential Impulse Solver
    const manifoldCount = this.activeManifolds.length;
    for (let it = 0; it < this.solverIterations; it++) {
      for (let m = 0; m < manifoldCount; m++) {
        const manifold = this.activeManifolds[m];
        if (manifold) {
          CollisionSystem3D.resolveVelocity(manifold);
        }
      }
    }

    // 6. Position Stabilization
    for (let m = 0; m < manifoldCount; m++) {
      const manifold = this.activeManifolds[m];
      if (manifold) {
        CollisionSystem3D.resolvePosition(manifold, 0.2, 0.05);
      }
    }
  }

  /**
   * Raycast against all 3D bodies using the BVH tree.
   */
  public raycast(ray: Ray3D, outHit: RayHit3D): boolean {
    outHit.reset();
    let hitFound = false;

    this.bvhTree.queryRay(ray.origin, ray.direction, 1.0, (body: RigidBody3D) => {
      if ((body.layerMask & ray.layerMask) === 0) return 1.0;

      const localHit = new RayHit3D();
      localHit.fraction = outHit.fraction;

      let hit = false;
      if (body.type === 'sphere') {
        hit = rayVsSphere3D(ray, body.position, body.radius, localHit);
      } else if (body.type === 'cube') {
        hit = rayVsBox3D(ray, body.position, body.halfExtents, body.orientation, localHit);
      } else if (body.type === 'capsule') {
        const cap = body.capsule || new Capsule3D(body.radius, body.length);
        hit = rayVsCapsule3D(ray, cap, body.position, body.orientation, localHit);
      }

      if (hit && localHit.fraction < outHit.fraction) {
        outHit.hit = true;
        outHit.fraction = localHit.fraction;
        outHit.distance = localHit.distance;
        outHit.point.copy(localHit.point);
        outHit.normal.copy(localHit.normal);
        outHit.body = body;
        outHit.isTrigger = body.isTrigger;
        hitFound = true;
        return localHit.fraction;
      }
      return outHit.fraction;
    });

    return hitFound;
  }

  private enforceBoundary(b: RigidBody3D): void {
    if (b.isStatic) return;

    const hw = this.bounds.width * 0.5;
    const hd = this.bounds.depth * 0.5;
    const r = b.radius;
    const e = b.restitution;

    if (b.type === 'sphere') {
      if (b.position.x - r < -hw) {
        b.position.x = -hw + r;
        b.velocity.x = -b.velocity.x * e;
      } else if (b.position.x + r > hw) {
        b.position.x = hw - r;
        b.velocity.x = -b.velocity.x * e;
      }

      if (b.position.y - r < 0) {
        b.position.y = r;
        b.velocity.y = -b.velocity.y * e;
      } else if (b.position.y + r > this.bounds.height) {
        b.position.y = this.bounds.height - r;
        b.velocity.y = -b.velocity.y * e;
      }

      if (b.position.z - r < -hd) {
        b.position.z = -hd + r;
        b.velocity.z = -b.velocity.z * e;
      } else if (b.position.z + r > hd) {
        b.position.z = hd - r;
        b.velocity.z = -b.velocity.z * e;
      }
    } else {
      const maxDim = Math.max(b.halfExtents.x, b.halfExtents.y, b.halfExtents.z);

      if (b.position.x - maxDim < -hw) {
        b.position.x = -hw + maxDim;
        b.velocity.x = -b.velocity.x * e;
      } else if (b.position.x + maxDim > hw) {
        b.position.x = hw - maxDim;
        b.velocity.x = -b.velocity.x * e;
      }

      if (b.position.y - maxDim < 0) {
        b.position.y = maxDim;
        b.velocity.y = -b.velocity.y * e;
      } else if (b.position.y + maxDim > this.bounds.height) {
        b.position.y = this.bounds.height - maxDim;
        b.velocity.y = -b.velocity.y * e;
      }

      if (b.position.z - maxDim < -hd) {
        b.position.z = -hd + maxDim;
        b.velocity.z = -b.velocity.z * e;
      } else if (b.position.z + maxDim > hd) {
        b.position.z = hd - maxDim;
        b.velocity.z = -b.velocity.z * e;
      }
    }
  }

  private emitCollisionParticles(manifold: ContactManifold3D): void {
    const contact = manifold.contacts.at(0);
    if (!contact) return;

    const count = Math.min(6, Math.floor(manifold.penetration * 1.5));
    this.particlePool.emit(
      contact,
      count,
      manifold.bodyA?.color || '#38bdf8',
      120.0
    );
  }

  public applyExplosion(origin: { x: number; y: number; z?: number }, radius: number, maxForce: number = 80000): void {
    const origZ = origin.z || 0;
    const rSq = radius * radius;
    const len = this.bodies.length;

    for (let i = 0; i < len; i++) {
      const b = this.bodies.at(i);
      if (!b || b.isStatic) continue;

      const pos = b.position;
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const dz = pos.z - origZ;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < rSq && distSq > 1e-4) {
        const dist = Math.sqrt(distSq);
        const factor = 1.0 - (dist / radius);
        const forceMag = maxForce * factor * factor;

        SCRATCH_EXPLOSION_DIR.set(dx / dist, dy / dist, dz / dist);
        SCRATCH_EXPLOSION_IMPULSE.set(
          SCRATCH_EXPLOSION_DIR.x * forceMag * b.invMass * 0.016,
          SCRATCH_EXPLOSION_DIR.y * forceMag * b.invMass * 0.016,
          SCRATCH_EXPLOSION_DIR.z * forceMag * b.invMass * 0.016
        );

        b.applyImpulse(SCRATCH_EXPLOSION_IMPULSE);
      }
    }

    this.particlePool.emitExplosion(new Vec3(origin.x, origin.y, origZ), 40, 350.0);
  }
}
