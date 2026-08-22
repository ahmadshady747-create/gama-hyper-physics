import { Vec4 } from '../../math/vec4';
import { RigidBody4D } from './body4d';

/**
 * ContactManifold4D - 4D Hyper-Collision contact manifold.
 */
export class ContactManifold4D {
  public bodyA: RigidBody4D | null = null;
  public bodyB: RigidBody4D | null = null;
  public normal: Vec4 = new Vec4();
  public penetration: number = 0;
  public contacts: [Vec4] = [new Vec4()];
  public contactCount: number = 0;
  public restitution: number = 0;
  public friction: number = 0;

  public reset(): void {
    this.bodyA = null;
    this.bodyB = null;
    this.normal?.set(0, 0, 0, 0);
    this.penetration = 0;
    this.contactCount = 0;
    this.restitution = 0;
    this.friction = 0;
  }
}

/**
 * ManifoldPool4D - Zero-GC Pre-allocated 4D Manifold Pool.
 */
export class ManifoldPool4D {
  private pool: ContactManifold4D[] = [];
  public count: number = 0;

  constructor(capacity: number = 512) {
    for (let i = 0; i < capacity; i++) {
      this.pool?.push(new ContactManifold4D());
    }
  }

  public get(): ContactManifold4D {
    const list = this.pool;
    if (this.count < list.length) {
      const m = list.at(this.count) ?? new ContactManifold4D();
      this.count++;
      m.reset();
      return m;
    }
    const extra = new ContactManifold4D();
    list?.push(extra);
    this.count++;
    return extra;
  }

  public clear(): void {
    this.count = 0;
  }
}

const SCRATCH_RA_4D = new Vec4();
const SCRATCH_RB_4D = new Vec4();
const SCRATCH_VREL_4D = new Vec4();
const SCRATCH_IMPULSE_4D = new Vec4();

/**
 * CollisionSystem4D - 4D Hyper-Physics Collision Solver.
 */
export class CollisionSystem4D {
  public static hypersphereVsHypersphere(a: RigidBody4D, b: RigidBody4D, manifold: ContactManifold4D): boolean {
    const posA = a.position;
    const posB = b.position;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;
    const dw = posB.w - posA.w;
    const distSq = dx * dx + dy * dy + dz * dz + dw * dw;
    const radiusSum = a.radius + b.radius;

    if (distSq >= radiusSum * radiusSum) {
      return false;
    }

    manifold.bodyA = a;
    manifold.bodyB = b;
    manifold.restitution = Math.min(a.restitution, b.restitution);
    manifold.friction = Math.sqrt(a.friction * b.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      if (dist != 0) {
        const invDist = 1.0 / dist;
        normal?.set(dx * invDist, dy * invDist, dz * invDist, dw * invDist);
        manifold.penetration = radiusSum - dist;
      } else {
        normal?.set(0, 1, 0, 0);
        manifold.penetration = radiusSum;
      }
    } else {
      normal?.set(0, 1, 0, 0);
      manifold.penetration = a.radius;
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      posA.x + normal.x * a.radius,
      posA.y + normal.y * a.radius,
      posA.z + normal.z * a.radius,
      posA.w + normal.w * a.radius
    );

    return true;
  }

  public static hypersphereVsTesseract(sphere: RigidBody4D, box: RigidBody4D, manifold: ContactManifold4D): boolean {
    const sPos = sphere.position;
    const bPos = box.position;
    const bHalf = box.halfExtents;

    const dx = sPos.x - bPos.x;
    const dy = sPos.y - bPos.y;
    const dz = sPos.z - bPos.z;
    const dw = sPos.w - bPos.w;

    const cx = Math.max(-bHalf.x, Math.min(bHalf.x, dx));
    const cy = Math.max(-bHalf.y, Math.min(bHalf.y, dy));
    const cz = Math.max(-bHalf.z, Math.min(bHalf.z, dz));
    const cw = Math.max(-bHalf.w, Math.min(bHalf.w, dw));

    const diffX = dx - cx;
    const diffY = dy - cy;
    const diffZ = dz - cz;
    const diffW = dw - cw;
    const distSq = diffX * diffX + diffY * diffY + diffZ * diffZ + diffW * diffW;

    const isInside = (cx === dx && cy === dy && cz === dz && cw === dw);

    if (!isInside && distSq > sphere.radius * sphere.radius) {
      return false;
    }

    manifold.bodyA = sphere;
    manifold.bodyB = box;
    manifold.restitution = Math.min(sphere.restitution, box.restitution);
    manifold.friction = Math.sqrt(sphere.friction * box.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (isInside) {
      normal?.set(0, 1, 0, 0);
      manifold.penetration = sphere.radius;
    } else {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-6 && dist != 0) {
        normal?.set(diffX / dist, diffY / dist, diffZ / dist, diffW / dist);
        manifold.penetration = sphere.radius - dist;
      } else {
        normal?.set(0, 1, 0, 0);
        manifold.penetration = sphere.radius;
      }
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(bPos.x + cx, bPos.y + cy, bPos.z + cz, bPos.w + cw);

    return true;
  }

  public static tesseractVsTesseract(a: RigidBody4D, b: RigidBody4D, manifold: ContactManifold4D): boolean {
    const minA = a.aabbMin, maxA = a.aabbMax;
    const minB = b.aabbMin, maxB = b.aabbMax;

    const overlapX = Math.min(maxA.x, maxB.x) - Math.max(minA.x, minB.x);
    const overlapY = Math.min(maxA.y, maxB.y) - Math.max(minA.y, minB.y);
    const overlapZ = Math.min(maxA.z, maxB.z) - Math.max(minA.z, minB.z);
    const overlapW = Math.min(maxA.w, maxB.w) - Math.max(minA.w, minB.w);

    if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0 || overlapW <= 0) {
      return false;
    }

    const minOverlap = Math.min(overlapX, overlapY, overlapZ, overlapW);

    manifold.bodyA = a;
    manifold.bodyB = b;
    manifold.penetration = minOverlap;
    manifold.restitution = Math.min(a.restitution, b.restitution);
    manifold.friction = Math.sqrt(a.friction * b.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (minOverlap === overlapX) {
      normal?.set(b.position.x > a.position.x ? 1 : -1, 0, 0, 0);
    } else if (minOverlap === overlapY) {
      normal?.set(0, b.position.y > a.position.y ? 1 : -1, 0, 0);
    } else if (minOverlap === overlapZ) {
      normal?.set(0, 0, b.position.z > a.position.z ? 1 : -1, 0);
    } else {
      normal?.set(0, 0, 0, b.position.w > a.position.w ? 1 : -1);
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      (a.position.x + b.position.x) * 0.5,
      (a.position.y + b.position.y) * 0.5,
      (a.position.z + b.position.z) * 0.5,
      (a.position.w + b.position.w) * 0.5
    );

    return true;
  }

  public static solveVelocity(manifold: ContactManifold4D): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const normal = manifold.normal;
    const count = manifold.contactCount;
    if (count === 0) return;

    const posA = a.position;
    const posB = b.position;
    const velA = a.velocity;
    const velB = b.velocity;

    for (let i = 0; i < count; i++) {
      const cp = manifold.contacts.at(i);
      if (!cp) continue;

      SCRATCH_RA_4D?.set(cp.x - posA.x, cp.y - posA.y, cp.z - posA.z, cp.w - posA.w);
      SCRATCH_RB_4D?.set(cp.x - posB.x, cp.y - posB.y, cp.z - posB.z, cp.w - posB.w);

      SCRATCH_VREL_4D?.set(
        velB.x - velA.x,
        velB.y - velA.y,
        velB.z - velA.z,
        velB.w - velA.w
      );

      const contactVel = SCRATCH_VREL_4D.dot(normal);
      if (contactVel > 0) continue;

      const invMassSum = a.invMass + b.invMass;
      if (invMassSum <= 1e-6) continue;

      let jn = 0;
      if (invMassSum != 0) {
        jn = -(1.0 + manifold.restitution) * contactVel / (invMassSum * count);
      }

      SCRATCH_IMPULSE_4D?.set(
        normal.x * jn,
        normal.y * jn,
        normal.z * jn,
        normal.w * jn
      );

      a.applyImpulse(
        new Vec4(-SCRATCH_IMPULSE_4D.x, -SCRATCH_IMPULSE_4D.y, -SCRATCH_IMPULSE_4D.z, -SCRATCH_IMPULSE_4D.w),
        SCRATCH_RA_4D
      );
      b.applyImpulse(SCRATCH_IMPULSE_4D, SCRATCH_RB_4D);
    }
  }

  public static correctPositions(manifold: ContactManifold4D): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass <= 1e-6) return;

    const slop = 0.5;
    const percent = 0.3;
    const excess = Math.max(0, manifold.penetration - slop);
    if (excess <= 0) return;

    let corrMag = 0;
    if (totalInvMass != 0) {
      corrMag = (excess / totalInvMass) * percent;
    }

    const n = manifold.normal;
    if (!a.isStatic) {
      a.position.x -= n.x * corrMag * a.invMass;
      a.position.y -= n.y * corrMag * a.invMass;
      a.position.z -= n.z * corrMag * a.invMass;
      a.position.w -= n.w * corrMag * a.invMass;
      a.updateTransform();
    }
    if (!b.isStatic) {
      b.position.x += n.x * corrMag * b.invMass;
      b.position.y += n.y * corrMag * b.invMass;
      b.position.z += n.z * corrMag * b.invMass;
      b.position.w += n.w * corrMag * b.invMass;
      b.updateTransform();
    }
  }
}
