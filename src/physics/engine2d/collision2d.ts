import { Vec2 } from '../../math/vec2';
import { RigidBody2D } from './body2d';
import {
  Capsule2D,
  testCapsuleVsCapsule2D,
  testCapsuleVsCircle2D,
  CapsuleHit2D
} from '../shapes/capsule';

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
const SCRATCH_CAP_HIT: CapsuleHit2D = {
  collided: false,
  normal: new Vec2(),
  penetration: 0,
  contactPoint: new Vec2()
};

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

    manifold.bodyA = circle;
    manifold.bodyB = box;
    manifold.restitution = Math.min(circle.restitution, box.restitution);
    manifold.friction = Math.sqrt(circle.friction * box.friction);
    manifold.contactCount = 1;

    const worldCos = Math.cos(box.angle);
    const worldSin = Math.sin(box.angle);
    const normal = manifold.normal;

    if (inside) {
      const dist = Math.sqrt(localDistSq);
      manifold.penetration = circle.radius + dist;
      const nlx = localDistX !== 0 ? localDistX / (dist || 1) : 0;
      const nly = localDistY !== 0 ? localDistY / (dist || 1) : -1;
      normal.set(-(worldCos * nlx - worldSin * nly), -(worldSin * nlx + worldCos * nly));
    } else {
      const dist = Math.sqrt(localDistSq);
      manifold.penetration = circle.radius - dist;
      const nlx = dist !== 0 ? localDistX / dist : 0;
      const nly = dist !== 0 ? localDistY / dist : 1;
      normal.set(worldCos * nlx - worldSin * nly, worldSin * nlx + worldCos * nly);
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      bPos.x + (worldCos * closestLocalX - worldSin * closestLocalY),
      bPos.y + (worldSin * closestLocalX + worldCos * closestLocalY)
    );

    return true;
  }

  public static boxVsCircle(box: RigidBody2D, circle: RigidBody2D, manifold: ContactManifold2D): boolean {
    const hit = CollisionSystem2D.circleVsBox(circle, box, manifold);
    if (!hit) return false;
    manifold.bodyA = box;
    manifold.bodyB = circle;
    manifold.normal.negate();
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

  public static capsuleVsCapsule(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): boolean {
    const capA = a.capsule || new Capsule2D(a.radius, a.length);
    const capB = b.capsule || new Capsule2D(b.radius, b.length);
    const hit = testCapsuleVsCapsule2D(capA, a.position, a.angle, capB, b.position, b.angle, SCRATCH_CAP_HIT);
    if (!hit) return false;

    manifold.bodyA = a;
    manifold.bodyB = b;
    manifold.normal.copy(SCRATCH_CAP_HIT.normal);
    manifold.penetration = SCRATCH_CAP_HIT.penetration;
    manifold.restitution = Math.min(a.restitution, b.restitution);
    manifold.friction = Math.sqrt(a.friction * b.friction);
    manifold.contactCount = 1;
    manifold.contacts[0].copy(SCRATCH_CAP_HIT.contactPoint);
    return true;
  }

  public static capsuleVsCircle(capsule: RigidBody2D, circle: RigidBody2D, manifold: ContactManifold2D): boolean {
    const cap = capsule.capsule || new Capsule2D(capsule.radius, capsule.length);
    const hit = testCapsuleVsCircle2D(cap, capsule.position, capsule.angle, circle.position, circle.radius, SCRATCH_CAP_HIT);
    if (!hit) return false;

    manifold.bodyA = capsule;
    manifold.bodyB = circle;
    manifold.normal.copy(SCRATCH_CAP_HIT.normal);
    manifold.penetration = SCRATCH_CAP_HIT.penetration;
    manifold.restitution = Math.min(capsule.restitution, circle.restitution);
    manifold.friction = Math.sqrt(capsule.friction * circle.friction);
    manifold.contactCount = 1;
    manifold.contacts[0].copy(SCRATCH_CAP_HIT.contactPoint);
    return true;
  }

  public static circleVsCapsule(circle: RigidBody2D, capsule: RigidBody2D, manifold: ContactManifold2D): boolean {
    const hit = CollisionSystem2D.capsuleVsCircle(capsule, circle, manifold);
    if (!hit) return false;
    manifold.bodyA = circle;
    manifold.bodyB = capsule;
    manifold.normal.negate();
    return true;
  }

  public static capsuleVsBox(capsule: RigidBody2D, box: RigidBody2D, manifold: ContactManifold2D): boolean {
    const cap = capsule.capsule || new Capsule2D(capsule.radius, capsule.length);
    const p1 = new Vec2(), p2 = new Vec2();
    cap.getSegment(capsule.position, capsule.angle, p1, p2);

    // Test segment endpoints as circles vs box
    const dummyC1 = new RigidBody2D({ type: 'circle', position: p1, radius: cap.radius });
    const dummyC2 = new RigidBody2D({ type: 'circle', position: p2, radius: cap.radius });
    const m1 = new ContactManifold2D();
    const m2 = new ContactManifold2D();

    const hit1 = CollisionSystem2D.circleVsBox(dummyC1, box, m1);
    const hit2 = CollisionSystem2D.circleVsBox(dummyC2, box, m2);

    if (!hit1 && !hit2) return false;

    const bestM = (hit1 && hit2) ? (m1.penetration > m2.penetration ? m1 : m2) : (hit1 ? m1 : m2);
    manifold.bodyA = capsule;
    manifold.bodyB = box;
    manifold.normal.copy(bestM.normal);
    manifold.penetration = bestM.penetration;
    manifold.restitution = Math.min(capsule.restitution, box.restitution);
    manifold.friction = Math.sqrt(capsule.friction * box.friction);
    manifold.contactCount = 1;
    manifold.contacts[0].copy(bestM.contacts[0]);
    return true;
  }

  public static boxVsCapsule(box: RigidBody2D, capsule: RigidBody2D, manifold: ContactManifold2D): boolean {
    const hit = CollisionSystem2D.capsuleVsBox(capsule, box, manifold);
    if (!hit) return false;
    manifold.bodyA = box;
    manifold.bodyB = capsule;
    manifold.normal.negate();
    return true;
  }

  public static detectCollision(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): boolean {
    if (a.isStatic && b.isStatic) return false;
    if (a.isSleeping && b.isSleeping) return false;

    if (a.type === 'circle' && b.type === 'circle') return CollisionSystem2D.circleVsCircle(a, b, manifold);
    if (a.type === 'circle' && b.type === 'box') return CollisionSystem2D.circleVsBox(a, b, manifold);
    if (a.type === 'box' && b.type === 'circle') return CollisionSystem2D.boxVsCircle(a, b, manifold);
    if (a.type === 'box' && b.type === 'box') return CollisionSystem2D.boxVsBox(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'capsule') return CollisionSystem2D.capsuleVsCapsule(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'circle') return CollisionSystem2D.capsuleVsCircle(a, b, manifold);
    if (a.type === 'circle' && b.type === 'capsule') return CollisionSystem2D.circleVsCapsule(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'box') return CollisionSystem2D.capsuleVsBox(a, b, manifold);
    if (a.type === 'box' && b.type === 'capsule') return CollisionSystem2D.boxVsCapsule(a, b, manifold);

    return false;
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

    if (maxA < minB || maxB < minA) return 0;
    return Math.min(maxA - minB, maxB - minA);
  }

  private static findBoxBoxContacts(a: RigidBody2D, b: RigidBody2D, manifold: ContactManifold2D): void {
    manifold.contactCount = 0;
    const normal = manifold.normal;

    for (let i = 0; i < 4; i++) {
      const v = b.vertices.at(i);
      if (!v) continue;
      if (CollisionSystem2D.isPointInsideBox(v, a)) {
        const c = manifold.contacts.at(manifold.contactCount);
        c?.copy(v);
        manifold.contactCount++;
        if (manifold.contactCount >= 2) return;
      }
    }

    if (manifold.contactCount < 2) {
      for (let i = 0; i < 4; i++) {
        const v = a.vertices.at(i);
        if (!v) continue;
        if (CollisionSystem2D.isPointInsideBox(v, b)) {
          const c = manifold.contacts.at(manifold.contactCount);
          c?.copy(v);
          manifold.contactCount++;
          if (manifold.contactCount >= 2) return;
        }
      }
    }

    if (manifold.contactCount === 0) {
      const c0 = manifold.contacts.at(0);
      c0?.set(
        (a.position.x + b.position.x) * 0.5 + normal.x * (manifold.penetration * 0.5),
        (a.position.y + b.position.y) * 0.5 + normal.y * (manifold.penetration * 0.5)
      );
      manifold.contactCount = 1;
    }
  }

  private static isPointInsideBox(pt: Vec2, box: RigidBody2D): boolean {
    const relX = pt.x - box.position.x;
    const relY = pt.y - box.position.y;
    const cos = Math.cos(-box.angle);
    const sin = Math.sin(-box.angle);
    const lx = relX * cos - relY * sin;
    const ly = relX * sin + relY * cos;
    return Math.abs(lx) <= box.halfExtents.x + 0.5 && Math.abs(ly) <= box.halfExtents.y + 0.5;
  }

  public static resolveVelocity(manifold: ContactManifold2D): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const normal = manifold.normal;
    const contactCount = manifold.contactCount;
    if (contactCount === 0) return;

    for (let i = 0; i < contactCount; i++) {
      const contact = manifold.contacts.at(i);
      if (!contact) continue;

      const ra = SCRATCH_RA;
      ra.set(contact.x - a.position.x, contact.y - a.position.y);
      const rb = SCRATCH_RB;
      rb.set(contact.x - b.position.x, contact.y - b.position.y);

      const vrel = SCRATCH_VREL;
      vrel.set(
        (b.velocity.x - b.angularVelocity * rb.y) - (a.velocity.x - a.angularVelocity * ra.y),
        (b.velocity.y + b.angularVelocity * rb.x) - (a.velocity.y + a.angularVelocity * ra.x)
      );

      const normalVelocity = vrel.dot(normal);
      if (normalVelocity > 0) continue;

      const raCrossN = ra.x * normal.y - ra.y * normal.x;
      const rbCrossN = rb.x * normal.y - rb.y * normal.x;
      const invMassSum = a.invMass + b.invMass + (raCrossN * raCrossN) * a.invInertia + (rbCrossN * rbCrossN) * b.invInertia;
      if (invMassSum === 0) continue;

      const e = manifold.restitution;
      let j = -(1.0 + e) * normalVelocity / (invMassSum * contactCount);

      const impulse = SCRATCH_IMPULSE;
      impulse.set(normal.x * j, normal.y * j);

      a.applyImpulse(SCRATCH_VEC_1.set(-impulse.x, -impulse.y), ra, false);
      b.applyImpulse(impulse, rb, false);

      // Friction
      vrel.set(
        (b.velocity.x - b.angularVelocity * rb.y) - (a.velocity.x - a.angularVelocity * ra.y),
        (b.velocity.y + b.angularVelocity * rb.x) - (a.velocity.y + a.angularVelocity * ra.x)
      );
      const tangent = SCRATCH_VEC_2;
      tangent.set(vrel.x - normal.x * vrel.dot(normal), vrel.y - normal.y * vrel.dot(normal));
      const tangentLen = tangent.length();
      if (tangentLen > 1e-4) {
        tangent.scale(1.0 / tangentLen);
        const jt = -vrel.dot(tangent) / (invMassSum * contactCount);
        const mu = manifold.friction;
        const maxJt = Math.abs(j) * mu;
        const clampedJt = Math.max(-maxJt, Math.min(maxJt, jt));
        const frictionImpulse = SCRATCH_VEC_1;
        frictionImpulse.set(tangent.x * clampedJt, tangent.y * clampedJt);
        a.applyImpulse(SCRATCH_VEC_2.set(-frictionImpulse.x, -frictionImpulse.y), ra, false);
        b.applyImpulse(frictionImpulse, rb, false);
      }
    }
  }

  public static resolvePosition(manifold: ContactManifold2D, beta: number = 0.2, slop: number = 0.05): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const penetration = manifold.penetration;
    if (penetration <= slop) return;

    const invMassSum = a.invMass + b.invMass;
    if (invMassSum === 0) return;

    const correctionMag = (Math.max(0, penetration - slop) / invMassSum) * beta;
    const normal = manifold.normal;
    const cx = normal.x * correctionMag;
    const cy = normal.y * correctionMag;

    if (!a.isStatic) {
      a.position.x -= cx * a.invMass;
      a.position.y -= cy * a.invMass;
    }
    if (!b.isStatic) {
      b.position.x += cx * b.invMass;
      b.position.y += cy * b.invMass;
    }
  }
}
