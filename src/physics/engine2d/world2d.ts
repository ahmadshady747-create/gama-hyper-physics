import { Vec2 } from '../../math/vec2';
import { RigidBody2D } from './body2d';
import { CollisionSystem2D, ContactManifold2D, ManifoldPool2D } from './collision2d';
import { ParticlePool } from '../particles';
import { IDimensionalEngine, DimensionMode } from '../common/types';
import { DynamicBVHTree2D, AABB2D } from '../broadphase/bvh';
import { IslandSleepingManager, ISleepContact } from '../common/sleeping';
import { Ray2D, RayHit2D, rayVsCircle2D, rayVsBox2D, rayVsCapsule2D } from '../queries/raycast';
import { Capsule2D, closestPointSegmentPoint2D } from '../shapes/capsule';
import { IConstraint2D } from '../constraints/types';
import { TimeOfImpact2D, sweepCircleVsCircle, sweepCircleVsBox2D } from '../queries/ccd';

export interface WorldOptions2D {
  gravity?: Vec2;
  wind?: Vec2;
  boundsWidth?: number;
  boundsHeight?: number;
  solverIterations?: number;
}

const SCRATCH_EXPLOSION_DIR = new Vec2();
const SCRATCH_EXPLOSION_IMPULSE = new Vec2();
const SCRATCH_CCD_TOI = new TimeOfImpact2D();

/**
 * PhysicsWorld2D - 2D Physics Simulator with Dynamic BVH Tree, Island Sleeping, Raycasting,
 * Continuous Collision Detection (CCD), and Multi-Joint Constraints.
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
  public constraints: IConstraint2D[] = [];
  public manifoldPool: ManifoldPool2D = new ManifoldPool2D(1024);
  public particlePool: ParticlePool = new ParticlePool(1000);
  public activeManifolds: ContactManifold2D[] = [];

  // Phase 1 Subsystems: BVH Broadphase & Island Sleeping
  public bvhTree: DynamicBVHTree2D<RigidBody2D> = new DynamicBVHTree2D<RigidBody2D>(256);
  public sleepingManager: IslandSleepingManager<RigidBody2D> = new IslandSleepingManager<RigidBody2D>();

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
    body.updateTransform();
    body.bvhProxyId = this.bvhTree.createProxy(body.currentAABB, body);
    this.bodies.push(body);
    return body;
  }

  public removeBody(body: RigidBody2D): void {
    const idx = this.bodies.indexOf(body);
    if (idx !== -1) {
      if (body.bvhProxyId !== -1) {
        this.bvhTree.destroyProxy(body.bvhProxyId);
        body.bvhProxyId = -1;
      }
      this.bodies.splice(idx, 1);
    }
  }

  public addConstraint(constraint: IConstraint2D): IConstraint2D {
    this.constraints.push(constraint);
    return constraint;
  }

  public removeConstraint(constraint: IConstraint2D): void {
    const idx = this.constraints.indexOf(constraint);
    if (idx !== -1) {
      this.constraints.splice(idx, 1);
    }
  }

  public clearConstraints(): void {
    this.constraints = [];
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
    this.constraints = [];
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

    // 2. Continuous Collision Detection (CCD) for fast-moving Bullet bodies
    for (let i = 0; i < bodyCount; i++) {
      const b = this.bodies[i];
      if (!b || b.isStatic || b.isSleeping || !b.isBullet) continue;

      const dispX = b.velocity.x * dt;
      const dispY = b.velocity.y * dt;
      const dispLen = Math.sqrt(dispX * dispX + dispY * dispY);

      if (dispLen > b.radius * 0.5) {
        this.performCCD2D(b, new Vec2(dispX, dispY), dt);
      }
    }

    // 3. Integrate Velocities and Update BVH Proxies
    for (let i = 0; i < bodyCount; i++) {
      const b = this.bodies[i];
      if (!b || b.isStatic || b.isSleeping) continue;
      b.integrateVelocity(dt, this.airResistance, this.angularDamping);
      this.enforceBoundary(b);

      if (b.bvhProxyId !== -1) {
        this.bvhTree.moveProxy(b.bvhProxyId, b.currentAABB, b.velocity);
      }
    }

    // 4. Broadphase Collision via Dynamic BVH Tree
    this.manifoldPool.clear();
    this.activeManifolds = [];

    this.bvhTree.generatePairs((a: RigidBody2D, b: RigidBody2D) => {
      if (a.id === b.id) return;
      if (a.isStatic && b.isStatic) return;
      if (a.isSleeping && b.isSleeping) return;

      const manifold = this.manifoldPool.get();
      const collided = CollisionSystem2D.detectCollision(a, b, manifold);

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

    // 5. Constraints Pre-Solve
    const constraintCount = this.constraints.length;
    for (let c = 0; c < constraintCount; c++) {
      this.constraints[c].preSolve(dt);
    }

    // 6. Island Sleeping System Update
    const sleepContacts: ISleepContact<RigidBody2D>[] = [];
    for (let m = 0; m < this.activeManifolds.length; m++) {
      const ct = this.activeManifolds[m];
      if (ct.bodyA && ct.bodyB) {
        sleepContacts.push({ bodyA: ct.bodyA, bodyB: ct.bodyB });
      }
    }
    this.sleepingManager.update(this.bodies, sleepContacts, dt);

    // 7. Sequential Impulse Solver (Contacts + Joint Constraints)
    const manifoldCount = this.activeManifolds.length;
    for (let it = 0; it < this.solverIterations; it++) {
      for (let c = 0; c < constraintCount; c++) {
        this.constraints[c].solveVelocity();
      }

      for (let m = 0; m < manifoldCount; m++) {
        const manifold = this.activeManifolds[m];
        if (manifold) {
          CollisionSystem2D.resolveVelocity(manifold);
        }
      }
    }

    // 8. Baumgarte Position Stabilization
    for (let m = 0; m < manifoldCount; m++) {
      const manifold = this.activeManifolds[m];
      if (manifold) {
        CollisionSystem2D.resolvePosition(manifold, 0.2, 0.05);
      }
    }

    for (let c = 0; c < constraintCount; c++) {
      this.constraints[c].solvePosition(0.2, 0.05);
    }
  }

  private performCCD2D(bullet: RigidBody2D, disp: Vec2, dt: number): void {
    let minTOI = 1.0;
    const hitNormal = new Vec2();
    let hitFound = false;

    for (let i = 0; i < this.bodies.length; i++) {
      const other = this.bodies[i];
      if (other.id === bullet.id || other.isTrigger) continue;

      const otherDisp = other.isStatic ? new Vec2() : new Vec2(other.velocity.x * dt, other.velocity.y * dt);

      let hit = false;
      if (other.type === 'circle') {
        hit = sweepCircleVsCircle(bullet.position, disp, bullet.radius, other.position, otherDisp, other.radius, SCRATCH_CCD_TOI);
      } else if (other.type === 'box') {
        hit = sweepCircleVsBox2D(bullet.position, disp, bullet.radius, other.position, other.halfExtents, other.angle, SCRATCH_CCD_TOI);
      }

      if (hit && SCRATCH_CCD_TOI.toi < minTOI) {
        minTOI = SCRATCH_CCD_TOI.toi;
        hitNormal.copy(SCRATCH_CCD_TOI.normal);
        hitFound = true;
      }
    }

    if (hitFound && minTOI < 1.0) {
      bullet.position.x += disp.x * minTOI;
      bullet.position.y += disp.y * minTOI;

      // Reflect bullet velocity
      const dot = bullet.velocity.x * hitNormal.x + bullet.velocity.y * hitNormal.y;
      if (dot < 0) {
        const e = bullet.restitution;
        bullet.velocity.x -= (1.0 + e) * hitNormal.x * dot;
        bullet.velocity.y -= (1.0 + e) * hitNormal.y * dot;
      }
    }
  }

  /**
   * Spatial query returning a body under point pt or null.
   */
  public getBodyAt(pt: Vec2): RigidBody2D | null {
    const qBox = new AABB2D(pt.x - 2, pt.y - 2, pt.x + 2, pt.y + 2);
    let found: RigidBody2D | null = null;

    this.bvhTree.queryAABB(qBox, (b: RigidBody2D) => {
      if (b.type === 'circle') {
        const dx = pt.x - b.position.x;
        const dy = pt.y - b.position.y;
        if (dx * dx + dy * dy <= b.radius * b.radius) {
          found = b;
          return false;
        }
      } else if (b.type === 'capsule') {
        const p1 = new Vec2(), p2 = new Vec2();
        const cap = b.capsule || new Capsule2D(b.radius, b.length);
        cap.getSegment(b.position, b.angle, p1, p2);
        const closest = new Vec2();
        closestPointSegmentPoint2D(p1, p2, pt, closest);
        const dx = pt.x - closest.x;
        const dy = pt.y - closest.y;
        if (dx * dx + dy * dy <= b.radius * b.radius) {
          found = b;
          return false;
        }
      } else {
        const relX = pt.x - b.position.x;
        const relY = pt.y - b.position.y;
        const cos = Math.cos(-b.angle);
        const sin = Math.sin(-b.angle);
        const lx = relX * cos - relY * sin;
        const ly = relX * sin + relY * cos;
        if (Math.abs(lx) <= b.halfExtents.x && Math.abs(ly) <= b.halfExtents.y) {
          found = b;
          return false;
        }
      }
      return true;
    });

    return found;
  }

  /**
   * Raycast against all 2D bodies using the BVH tree for fast spatial pruning.
   */
  public raycast(ray: Ray2D, outHit: RayHit2D): boolean {
    outHit.reset();
    let hitFound = false;

    this.bvhTree.queryRay(ray.origin, ray.direction, ray.maxDistance, (body: RigidBody2D) => {
      if ((body.layerMask & ray.layerMask) === 0) return 1.0;

      const localHit = new RayHit2D();
      localHit.fraction = outHit.fraction;

      let hit = false;
      if (body.type === 'circle') {
        hit = rayVsCircle2D(ray, body.position, body.radius, localHit);
      } else if (body.type === 'box') {
        hit = rayVsBox2D(ray, body.position, body.width, body.height, body.angle, localHit);
      } else if (body.type === 'capsule') {
        const cap = body.capsule || new Capsule2D(body.radius, body.length);
        hit = rayVsCapsule2D(ray, cap, body.position, body.angle, localHit);
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

  private enforceBoundary(b: RigidBody2D): void {
    if (b.isStatic) return;

    const w = this.bounds.width;
    const h = this.bounds.height;
    const r = b.radius;
    const e = b.restitution;

    if (b.type === 'circle') {
      if (b.position.x - r < 0) {
        b.position.x = r;
        b.velocity.x = -b.velocity.x * e;
      } else if (b.position.x + r > w) {
        b.position.x = w - r;
        b.velocity.x = -b.velocity.x * e;
      }

      if (b.position.y - r < 0) {
        b.position.y = r;
        b.velocity.y = -b.velocity.y * e;
      } else if (b.position.y + r > h) {
        b.position.y = h - r;
        b.velocity.y = -b.velocity.y * e;
      }
    } else {
      const hx = b.halfExtents.x;
      const hy = b.halfExtents.y;
      const maxDim = Math.max(hx, hy);

      if (b.position.x - maxDim < 0) {
        b.position.x = maxDim;
        b.velocity.x = -b.velocity.x * e;
      } else if (b.position.x + maxDim > w) {
        b.position.x = w - maxDim;
        b.velocity.x = -b.velocity.x * e;
      }

      if (b.position.y - maxDim < 0) {
        b.position.y = maxDim;
        b.velocity.y = -b.velocity.y * e;
      } else if (b.position.y + maxDim > h) {
        b.position.y = h - maxDim;
        b.velocity.y = -b.velocity.y * e;
      }
    }
  }

  private emitCollisionParticles(manifold: ContactManifold2D): void {
    const contact = manifold.contacts.at(0);
    if (!contact) return;

    const count = Math.min(6, Math.floor(manifold.penetration * 1.5));
    this.particlePool.emit(contact.x, contact.y, count, manifold.bodyA?.color || '#38bdf8', 120.0);
  }

  public applyExplosion(origin: { x: number; y: number }, radius: number, maxForce: number = 80000): void {
    const rSq = radius * radius;
    const len = this.bodies.length;

    for (let i = 0; i < len; i++) {
      const b = this.bodies.at(i);
      if (!b || b.isStatic) continue;

      const pos = b.position;
      const dx = pos.x - origin.x;
      const dy = pos.y - origin.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < rSq && distSq > 1e-4) {
        const dist = Math.sqrt(distSq);
        const factor = 1.0 - (dist / radius);
        const forceMag = maxForce * factor * factor;

        SCRATCH_EXPLOSION_DIR.set(dx / dist, dy / dist);
        SCRATCH_EXPLOSION_IMPULSE.set(
          SCRATCH_EXPLOSION_DIR.x * forceMag * b.invMass * 0.016,
          SCRATCH_EXPLOSION_DIR.y * forceMag * b.invMass * 0.016
        );

        b.applyImpulse(SCRATCH_EXPLOSION_IMPULSE);
      }
    }

    this.particlePool.emitExplosion(origin.x, origin.y, 40, 350.0);
  }
}
