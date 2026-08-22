import { Vec2 } from '../../math/vec2';
import { RigidBody2D } from './body2d';

/**
 * ContactManifold2D - Stores contact details between two colliding rigid bodies.
 */
export class ContactManifold2D {
  public bodyA: RigidBody2D | null = null;
  public bodyB: RigidBody2D | null = null;
  public normal: Vec2 = new Vec2();
  public penetration: number = 0;
  public contacts: [Vec2, Vec2] = [new Vec2(), new Vec2()];
  public contactCount: number = 0;
  public restitution: number = 0;
  public friction: number = 0;

  public reset(): void {
    this.bodyA = null;
    this.bodyB = null;
    this.normal?.set(0, 0);
    this.penetration = 0;
    this.contactCount = 0;
    this.restitution = 0;
    this.friction = 0;
  }
}

/**
 * Pre-allocated Zero-GC Manifold Pool.
 */
export class ManifoldPool2D {
  private pool: ContactManifold2D[] = [];
  public count: number = 0;

  constructor(capacity: number = 512) {
    for (let i = 0; i < capacity; i++) {
      this.pool?.push(new ContactManifold2D());
    }
  }

  public get(): ContactManifold2D {
    const list = this.pool;
    if (this.count < list.length) {
      const m = list.at(this.count) ?? new ContactManifold2D();
      this.count++;
      m.reset();
      return m;
    }
    const extra = new ContactManifold2D();
    list?.push(extra);
    this.count++;
    return extra;
  }

  public clear(): void {
    this.count = 0;
  }
}

const SCRATCH_VEC_1 = new Vec2();
const SCRATCH_VEC_2 = new Vec2();
const SCRATCH_RA = new Vec2();
const SCRATCH_RB = new Vec2();
const SCRATCH_VREL = new Vec2();
const SCRATCH_IMPULSE = new Vec2();

/**
 * Collision Detector and Sequential Impulse Solver for 2D.
 */
export class CollisionSystem2D {
  public static circleVsCircle(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): boolean {
    const posA = a.position;
    const posB = b.position;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const distSq = dx * dx + dy * dy;
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
        normal?.set(dx * invDist, dy * invDist);
        manifold.penetration = radiusSum - dist;
      } else {
        normal?.set(0, 1);
        manifold.penetration = radiusSum;
      }
    } else {
      normal?.set(0, 1);
      manifold.penetration = a.radius;
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      posA.x + normal.x * a.radius,
      posA.y + normal.y * a.radius
    );

    return true;
  }

  public static circleVsBox(circle: RigidBody2D, box: RigidBody2D, manifold: ContactManifold2D): boolean {
    const cPos = circle.position;
    const bPos = box.position;
    const bHalf = box.halfExtents;

    const relX = cPos.x - bPos.x;
    const relY = cPos.y - bPos.y;

    const cos = Math.cos(-box.angle);
    const sin = Math.sin(-box.angle);

    const localX = relX * cos - relY * sin;
    const localY = relX * sin + relY * cos;

    const clampedX = Math.max(-bHalf.x, Math.min(bHalf.x, localX));
    const clampedY = Math.max(-bHalf.y, Math.min(bHalf.y, localY));

    let closestLocalX = clampedX;
    let closestLocalY = clampedY;
    let inside = false;

    if (localX === clampedX && localY === clampedY) {
      inside = true;
      const dxFace = bHalf.x - Math.abs(localX);
      const dyFace = bHalf.y - Math.abs(localY);

      if (dxFace < dyFace) {
        closestLocalX = localX > 0 ? bHalf.x : -bHalf.x;
      } else {
        closestLocalY = localY > 0 ? bHalf.y : -bHalf.y;
      }
    }

    const localDistX = localX - closestLocalX;
    const localDistY = localY - closestLocalY;
    const localDistSq = localDistX * localDistX + localDistY * localDistY;

    if (!inside && localDistSq > circle.radius * circle.radius) {
      return false;
    }

    const localDist = Math.sqrt(localDistSq);
    const cosW = Math.cos(box.angle);
    const sinW = Math.sin(box.angle);

    const worldClosestX = bPos.x + (closestLocalX * cosW - closestLocalY * sinW);
    const worldClosestY = bPos.y + (closestLocalX * sinW + closestLocalY * cosW);

    manifold.bodyA = circle;
    manifold.bodyB = box;
    manifold.restitution = Math.min(circle.restitution, box.restitution);
    manifold.friction = Math.sqrt(circle.friction * box.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (inside) {
      const nLocalX = localX > 0 ? 1 : -1;
      const nLocalY = localY > 0 ? 1 : -1;
      const nX = closestLocalX === localX ? 0 : (nLocalX * cosW - 0 * sinW);
      const nY = closestLocalX === localX ? (nLocalY * sinW + 0 * cosW) : 0;
      normal?.set(-nX, -nY)?.normalizeSafe(new Vec2(0, -1));
      manifold.penetration = circle.radius + localDist;
    } else {
      const nx = (worldClosestX - cPos.x);
      const ny = (worldClosestY - cPos.y);
      normal?.set(nx, ny)?.normalizeSafe(new Vec2(0, 1));
      manifold.penetration = circle.radius - localDist;
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(worldClosestX, worldClosestY);

    return true;
  }

  public static boxVsBox(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): boolean {
    let minOverlap = Number.MAX_VALUE;
    let smallestAxisIndex = -1;
    

    const a0 = a.axes.at(0) ?? new Vec2(1, 0);
    const a1 = a.axes.at(1) ?? new Vec2(0, 1);
    const b0 = b.axes.at(0) ?? new Vec2(1, 0);
    const b1 = b.axes.at(1) ?? new Vec2(0, 1);

    const axesToTest = [a0, a1, b0, b1];

    for (let i = 0; i < 4; i++) {
      const axis = axesToTest.at(i) ?? a0;
      const overlap = CollisionSystem2D.getAxisOverlap(a, b, axis);
      if (overlap <= 0) return false;
      if (overlap < minOverlap) {
        minOverlap = overlap;
        smallestAxisIndex = i;
        
      }
    }

    const chosenAxis = axesToTest.at(smallestAxisIndex) ?? a0;

    manifold.bodyA = a;
    manifold.bodyB = b;
    manifold.penetration = minOverlap;
    manifold.restitution = Math.min(a.restitution, b.restitution);
    manifold.friction = Math.sqrt(a.friction * b.friction);

    const normal = manifold.normal;
    const posA = a.position;
    const posB = b.position;
    const dirX = posB.x - posA.x;
    const dirY = posB.y - posA.y;
    if (dirX * chosenAxis.x + dirY * chosenAxis.y < 0) {
      normal?.set(-chosenAxis.x, -chosenAxis.y);
    } else {
      normal?.set(chosenAxis.x, chosenAxis.y);
    }

    CollisionSystem2D.findBoxBoxContacts(a, b, manifold);
    return true;
  }

  private static getAxisOverlap(a: RigidBody2D, b: RigidBody2D, axis: Vec2): number {
    const vA0 = a.vertices.at(0) ?? a.position;
    const vA1 = a.vertices.at(1) ?? a.position;
    const vA2 = a.vertices.at(2) ?? a.position;
    const vA3 = a.vertices.at(3) ?? a.position;

    const projA0 = vA0.dot(axis);
    const projA1 = vA1.dot(axis);
    const projA2 = vA2.dot(axis);
    const projA3 = vA3.dot(axis);

    const minA = Math.min(projA0, projA1, projA2, projA3);
    const maxA = Math.max(projA0, projA1, projA2, projA3);

    const vB0 = b.vertices.at(0) ?? b.position;
    const vB1 = b.vertices.at(1) ?? b.position;
    const vB2 = b.vertices.at(2) ?? b.position;
    const vB3 = b.vertices.at(3) ?? b.position;

    const projB0 = vB0.dot(axis);
    const projB1 = vB1.dot(axis);
    const projB2 = vB2.dot(axis);
    const projB3 = vB3.dot(axis);

    const minB = Math.min(projB0, projB1, projB2, projB3);
    const maxB = Math.max(projB0, projB1, projB2, projB3);

    return Math.min(maxA, maxB) - Math.max(minA, minB);
  }

  private static findBoxBoxContacts(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): void {
    manifold.contactCount = 0;

    for (let i = 0; i < 4; i++) {
      const v = a.vertices.at(i);
      if (v && b.containsPoint(v)) {
        if (manifold.contactCount === 0) {
          manifold.contacts.at(0)?.copy(v);
          manifold.contactCount++;
        } else if (manifold.contactCount === 1) {
          manifold.contacts.at(1)?.copy(v);
          manifold.contactCount++;
          break;
        }
      }
    }

    if (manifold.contactCount < 2) {
      for (let i = 0; i < 4; i++) {
        const v = b.vertices.at(i);
        if (v && a.containsPoint(v)) {
          if (manifold.contactCount === 0) {
            manifold.contacts.at(0)?.copy(v);
            manifold.contactCount++;
          } else if (manifold.contactCount === 1) {
            manifold.contacts.at(1)?.copy(v);
            manifold.contactCount++;
            break;
          }
        }
      }
    }

    if (manifold.contactCount === 0) {
      const c0 = manifold.contacts.at(0);
      const posA = a.position;
      const posB = b.position;
      c0?.set(
        (posA.x + posB.x) * 0.5,
        (posA.y + posB.y) * 0.5
      );
      manifold.contactCount = 1;
    }
  }

  public static solveVelocity(manifold: ContactManifold2D): void {
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

      SCRATCH_RA?.set(cp.x - posA.x, cp.y - posA.y);
      SCRATCH_RB?.set(cp.x - posB.x, cp.y - posB.y);

      const vAx = velA.x - a.angularVelocity * SCRATCH_RA.y;
      const vAy = velA.y + a.angularVelocity * SCRATCH_RA.x;
      const vBx = velB.x - b.angularVelocity * SCRATCH_RB.y;
      const vBy = velB.y + b.angularVelocity * SCRATCH_RB.x;

      SCRATCH_VREL?.set(vBx - vAx, vBy - vAy);
      const contactVel = SCRATCH_VREL.dot(normal);
      if (contactVel > 0) continue;

      const raCrossN = Vec2.cross(SCRATCH_RA, normal);
      const rbCrossN = Vec2.cross(SCRATCH_RB, normal);

      const invMassSum = a.invMass + b.invMass +
        raCrossN * raCrossN * a.invInertia +
        rbCrossN * rbCrossN * b.invInertia;

      if (invMassSum <= 1e-6) continue;

      let jn = 0;
      if (invMassSum != 0) {
        jn = -(1.0 + manifold.restitution) * contactVel / (invMassSum * count);
      }

      SCRATCH_IMPULSE?.set(normal.x * jn, normal.y * jn);
      a.applyImpulse(SCRATCH_VEC_1.set(-SCRATCH_IMPULSE.x, -SCRATCH_IMPULSE.y), SCRATCH_RA);
      b.applyImpulse(SCRATCH_IMPULSE, SCRATCH_RB);

      const tx = -normal.y;
      const ty = normal.x;

      const postVAx = velA.x - a.angularVelocity * SCRATCH_RA.y;
      const postVAy = velA.y + a.angularVelocity * SCRATCH_RA.x;
      const postVBx = velB.x - b.angularVelocity * SCRATCH_RB.y;
      const postVBy = velB.y + b.angularVelocity * SCRATCH_RB.x;

      const vt = (postVBx - postVAx) * tx + (postVBy - postVAy) * ty;
      const raCrossT = SCRATCH_RA.x * ty - SCRATCH_RA.y * tx;
      const rbCrossT = SCRATCH_RB.x * ty - SCRATCH_RB.y * tx;

      const invMassTangent = a.invMass + b.invMass +
        raCrossT * raCrossT * a.invInertia +
        rbCrossT * rbCrossT * b.invInertia;

      if (invMassTangent > 1e-6) {
        let jt = 0;
        if (invMassTangent != 0) {
          jt = -vt / (invMassTangent * count);
        }

        const maxFriction = Math.abs(jn) * manifold.friction;
        jt = Math.max(-maxFriction, Math.min(maxFriction, jt));

        SCRATCH_IMPULSE?.set(tx * jt, ty * jt);
        a.applyImpulse(SCRATCH_VEC_2.set(-SCRATCH_IMPULSE.x, -SCRATCH_IMPULSE.y), SCRATCH_RA);
        b.applyImpulse(SCRATCH_IMPULSE, SCRATCH_RB);
      }
    }
  }

  public static correctPositions(manifold: ContactManifold2D): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const totalInvMass = a.invMass + b.invMass;
    if (totalInvMass <= 1e-6) return;

    const slop = 0.5;
    const percent = 0.3;

    const excessPenetration = Math.max(0, manifold.penetration - slop);
    if (excessPenetration <= 0) return;

    let correctionMag = 0;
    if (totalInvMass != 0) {
      correctionMag = (excessPenetration / totalInvMass) * percent;
    }

    const normal = manifold.normal;
    const corrX = normal.x * correctionMag;
    const corrY = normal.y * correctionMag;

    if (!a.isStatic) {
      a.position.x -= corrX * a.invMass;
      a.position.y -= corrY * a.invMass;
      a.updateTransform();
    }
    if (!b.isStatic) {
      b.position.x += corrX * b.invMass;
      b.position.y += corrY * b.invMass;
      b.updateTransform();
    }
  }
}

