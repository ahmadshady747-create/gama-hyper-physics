import { Vec3 } from '../../math/vec3';
import { RigidBody3D } from './body3d';
import {
  Capsule3D,
  testCapsuleVsCapsule3D,
  testCapsuleVsSphere3D,
  CapsuleHit3D
} from '../shapes/capsule';

/**
 * ContactManifold3D - Contact point details for 3D collisions.
 */
export class ContactManifold3D {
  public bodyA: RigidBody3D | null = null;
  public bodyB: RigidBody3D | null = null;
  public normal: Vec3 = new Vec3();
  public penetration: number = 0;
  public contacts: [Vec3, Vec3, Vec3, Vec3] = [new Vec3(), new Vec3(), new Vec3(), new Vec3()];
  public contactCount: number = 0;
  public restitution: number = 0;
  public friction: number = 0;

  public reset(): void {
    this.bodyA = null;
    this.bodyB = null;
    this.normal?.set(0, 0, 0);
    this.penetration = 0;
    this.contactCount = 0;
    this.restitution = 0;
    this.friction = 0;
  }
}

/**
 * ManifoldPool3D - Zero-GC Pre-allocated Manifold Pool for 3D.
 */
export class ManifoldPool3D {
  private pool: ContactManifold3D[] = [];
  public count: number = 0;

  constructor(capacity: number = 512) {
    for (let i = 0; i < capacity; i++) {
      this.pool?.push(new ContactManifold3D());
    }
  }

  public get(): ContactManifold3D {
    const list = this.pool;
    if (this.count < list.length) {
      const m = list.at(this.count) ?? new ContactManifold3D();
      this.count++;
      m.reset();
      return m;
    }
    const extra = new ContactManifold3D();
    list?.push(extra);
    this.count++;
    return extra;
  }

  public clear(): void {
    this.count = 0;
  }
}

const SCRATCH_RA = new Vec3();
const SCRATCH_RB = new Vec3();
const SCRATCH_TEMP = new Vec3();
const SCRATCH_CAP_HIT: CapsuleHit3D = {
  collided: false,
  normal: new Vec3(),
  penetration: 0,
  contactPoint: new Vec3()
};

/**
 * CollisionSystem3D - High-performance 3D SAT Collision Detection & Impulse Solver.
 */
export class CollisionSystem3D {
  public static sphereVsSphere(a: RigidBody3D, b: RigidBody3D, manifold: ContactManifold3D): boolean {
    const posA = a.position;
    const posB = b.position;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;
    const distSq = dx * dx + dy * dy + dz * dz;
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
        normal?.set(dx * invDist, dy * invDist, dz * invDist);
        manifold.penetration = radiusSum - dist;
      } else {
        normal?.set(0, 1, 0);
        manifold.penetration = radiusSum;
      }
    } else {
      normal?.set(0, 1, 0);
      manifold.penetration = a.radius;
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      posA.x + normal.x * a.radius,
      posA.y + normal.y * a.radius,
      posA.z + normal.z * a.radius
    );

    return true;
  }

  public static sphereVsBox(sphere: RigidBody3D, box: RigidBody3D, manifold: ContactManifold3D): boolean {
    const sPos = sphere.position;
    const bPos = box.position;
    const bHalf = box.halfExtents;

    SCRATCH_TEMP?.set(sPos.x - bPos.x, sPos.y - bPos.y, sPos.z - bPos.z);
    const qBox = box.orientation.clone().conjugate();
    const localSphere = qBox.rotateVec3(SCRATCH_TEMP);

    const cx = Math.max(-bHalf.x, Math.min(bHalf.x, localSphere.x));
    const cy = Math.max(-bHalf.y, Math.min(bHalf.y, localSphere.y));
    const cz = Math.max(-bHalf.z, Math.min(bHalf.z, localSphere.z));

    const dx = localSphere.x - cx;
    const dy = localSphere.y - cy;
    const dz = localSphere.z - cz;
    const distSq = dx * dx + dy * dy + dz * dz;

    const isInside = (cx === localSphere.x && cy === localSphere.y && cz === localSphere.z);

    if (!isInside && distSq > sphere.radius * sphere.radius) {
      return false;
    }

    const localClosest = new Vec3(cx, cy, cz);
    const worldClosest = box.orientation.rotateVec3(localClosest);
    worldClosest.x += bPos.x;
    worldClosest.y += bPos.y;
    worldClosest.z += bPos.z;

    manifold.bodyA = sphere;
    manifold.bodyB = box;
    manifold.restitution = Math.min(sphere.restitution, box.restitution);
    manifold.friction = Math.sqrt(sphere.friction * box.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (isInside) {
      const dxFace = bHalf.x - Math.abs(localSphere.x);
      const dyFace = bHalf.y - Math.abs(localSphere.y);
      const dzFace = bHalf.z - Math.abs(localSphere.z);
      const minFace = Math.min(dxFace, dyFace, dzFace);

      let localNorm = new Vec3();
      if (minFace === dxFace) localNorm.set(localSphere.x > 0 ? -1 : 1, 0, 0);
      else if (minFace === dyFace) localNorm.set(0, localSphere.y > 0 ? -1 : 1, 0);
      else localNorm.set(0, 0, localSphere.z > 0 ? -1 : 1);

      const worldNorm = box.orientation.rotateVec3(localNorm);
      normal.copy(worldNorm);
      manifold.penetration = sphere.radius + minFace;
    } else {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-6) {
        normal.set((sPos.x - worldClosest.x) / dist, (sPos.y - worldClosest.y) / dist, (sPos.z - worldClosest.z) / dist);
        manifold.penetration = sphere.radius - dist;
      } else {
        normal.set(0, 1, 0);
        manifold.penetration = sphere.radius;
      }
    }

    const c0 = manifold.contacts.at(0);
    c0?.copy(worldClosest);

    return true;
  }

  public static boxVsSphere(box: RigidBody3D, sphere: RigidBody3D, manifold: ContactManifold3D): boolean {
    const hit = CollisionSystem3D.sphereVsBox(sphere, box, manifold);
    if (!hit) return false;
    manifold.bodyA = box;
    manifold.bodyB = sphere;
    manifold.normal.negate();
    return true;
  }

  public static boxVsBox(a: RigidBody3D, b: RigidBody3D, manifold: ContactManifold3D): boolean {
    let minOverlap = Number.MAX_VALUE;
    const bestAxis = new Vec3();

    const axesA = a.axes;
    const axesB = b.axes;

    const axes: Vec3[] = [
      axesA[0], axesA[1], axesA[2],
      axesB[0], axesB[1], axesB[2]
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cross = axesA[i].cross(axesB[j]);
        if (cross.lengthSq() > 1e-6) {
          cross.normalize();
          axes.push(cross);
        }
      }
    }

    const len = axes.length;
    for (let i = 0; i < len; i++) {
      const axis = axes[i];
      const overlap = CollisionSystem3D.getAxisOverlap(a, b, axis);
      if (overlap <= 0) return false;

      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestAxis.copy(axis);
      }
    }

    manifold.bodyA = a;
    manifold.bodyB = b;
    manifold.penetration = minOverlap;
    manifold.restitution = Math.min(a.restitution, b.restitution);
    manifold.friction = Math.sqrt(a.friction * b.friction);

    const normal = manifold.normal;
    const dir = new Vec3(b.position.x - a.position.x, b.position.y - a.position.y, b.position.z - a.position.z);
    if (dir.dot(bestAxis) < 0) {
      normal.set(-bestAxis.x, -bestAxis.y, -bestAxis.z);
    } else {
      normal.copy(bestAxis);
    }

    const c0 = manifold.contacts.at(0);
    c0?.set(
      (a.position.x + b.position.x) * 0.5,
      (a.position.y + b.position.y) * 0.5,
      (a.position.z + b.position.z) * 0.5
    );
    manifold.contactCount = 1;

    return true;
  }

  public static capsuleVsCapsule(a: RigidBody3D, b: RigidBody3D, manifold: ContactManifold3D): boolean {
    const capA = a.capsule || new Capsule3D(a.radius, a.length);
    const capB = b.capsule || new Capsule3D(b.radius, b.length);
    const hit = testCapsuleVsCapsule3D(capA, a.position, a.orientation, capB, b.position, b.orientation, SCRATCH_CAP_HIT);
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

  public static capsuleVsSphere(capsule: RigidBody3D, sphere: RigidBody3D, manifold: ContactManifold3D): boolean {
    const cap = capsule.capsule || new Capsule3D(capsule.radius, capsule.length);
    const hit = testCapsuleVsSphere3D(cap, capsule.position, capsule.orientation, sphere.position, sphere.radius, SCRATCH_CAP_HIT);
    if (!hit) return false;

    manifold.bodyA = capsule;
    manifold.bodyB = sphere;
    manifold.normal.copy(SCRATCH_CAP_HIT.normal);
    manifold.penetration = SCRATCH_CAP_HIT.penetration;
    manifold.restitution = Math.min(capsule.restitution, sphere.restitution);
    manifold.friction = Math.sqrt(capsule.friction * sphere.friction);
    manifold.contactCount = 1;
    manifold.contacts[0].copy(SCRATCH_CAP_HIT.contactPoint);
    return true;
  }

  public static sphereVsCapsule(sphere: RigidBody3D, capsule: RigidBody3D, manifold: ContactManifold3D): boolean {
    const hit = CollisionSystem3D.capsuleVsSphere(capsule, sphere, manifold);
    if (!hit) return false;
    manifold.bodyA = sphere;
    manifold.bodyB = capsule;
    manifold.normal.negate();
    return true;
  }

  public static capsuleVsBox(capsule: RigidBody3D, box: RigidBody3D, manifold: ContactManifold3D): boolean {
    const cap = capsule.capsule || new Capsule3D(capsule.radius, capsule.length);
    const p1 = new Vec3(), p2 = new Vec3();
    cap.getSegment(capsule.position, capsule.orientation, p1, p2);

    const dummyS1 = new RigidBody3D({ type: 'sphere', position: p1, radius: cap.radius });
    const dummyS2 = new RigidBody3D({ type: 'sphere', position: p2, radius: cap.radius });
    const m1 = new ContactManifold3D();
    const m2 = new ContactManifold3D();

    const hit1 = CollisionSystem3D.sphereVsBox(dummyS1, box, m1);
    const hit2 = CollisionSystem3D.sphereVsBox(dummyS2, box, m2);

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

  public static boxVsCapsule(box: RigidBody3D, capsule: RigidBody3D, manifold: ContactManifold3D): boolean {
    const hit = CollisionSystem3D.capsuleVsBox(capsule, box, manifold);
    if (!hit) return false;
    manifold.bodyA = box;
    manifold.bodyB = capsule;
    manifold.normal.negate();
    return true;
  }

  public static detectCollision(a: RigidBody3D, b: RigidBody3D, manifold: ContactManifold3D): boolean {
    if (a.isStatic && b.isStatic) return false;
    if (a.isSleeping && b.isSleeping) return false;

    if (a.type === 'sphere' && b.type === 'sphere') return CollisionSystem3D.sphereVsSphere(a, b, manifold);
    if (a.type === 'sphere' && b.type === 'cube') return CollisionSystem3D.sphereVsBox(a, b, manifold);
    if (a.type === 'cube' && b.type === 'sphere') return CollisionSystem3D.boxVsSphere(a, b, manifold);
    if (a.type === 'cube' && b.type === 'cube') return CollisionSystem3D.boxVsBox(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'capsule') return CollisionSystem3D.capsuleVsCapsule(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'sphere') return CollisionSystem3D.capsuleVsSphere(a, b, manifold);
    if (a.type === 'sphere' && b.type === 'capsule') return CollisionSystem3D.sphereVsCapsule(a, b, manifold);
    if (a.type === 'capsule' && b.type === 'cube') return CollisionSystem3D.capsuleVsBox(a, b, manifold);
    if (a.type === 'cube' && b.type === 'capsule') return CollisionSystem3D.boxVsCapsule(a, b, manifold);

    return false;
  }

  private static getAxisOverlap(a: RigidBody3D, b: RigidBody3D, axis: Vec3): number {
    let minA = Number.MAX_VALUE, maxA = -Number.MAX_VALUE;
    for (let i = 0; i < 8; i++) {
      const v = a.vertices.at(i) ?? a.position;
      const proj = v.dot(axis);
      if (proj < minA) minA = proj;
      if (proj > maxA) maxA = proj;
    }

    let minB = Number.MAX_VALUE, maxB = -Number.MAX_VALUE;
    for (let i = 0; i < 8; i++) {
      const v = b.vertices.at(i) ?? b.position;
      const proj = v.dot(axis);
      if (proj < minB) minB = proj;
      if (proj > maxB) maxB = proj;
    }

    if (maxA < minB || maxB < minA) return 0;
    return Math.min(maxA - minB, maxB - minA);
  }

  public static resolveVelocity(manifold: ContactManifold3D): void {
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
      ra.set(contact.x - a.position.x, contact.y - a.position.y, contact.z - a.position.z);
      const rb = SCRATCH_RB;
      rb.set(contact.x - b.position.x, contact.y - b.position.y, contact.z - b.position.z);

      const va = a.velocity.clone().addInPlace(a.angularVelocity.cross(ra));
      const vb = b.velocity.clone().addInPlace(b.angularVelocity.cross(rb));
      const vrel = vb.subInPlace(va);

      const normalVelocity = vrel.dot(normal);
      if (normalVelocity > 0) continue;

      const raCrossN = ra.cross(normal);
      const rbCrossN = rb.cross(normal);

      const iRaN = new Vec3(
        a.worldInvInertia[0].dot(raCrossN),
        a.worldInvInertia[1].dot(raCrossN),
        a.worldInvInertia[2].dot(raCrossN)
      );
      const iRbN = new Vec3(
        b.worldInvInertia[0].dot(rbCrossN),
        b.worldInvInertia[1].dot(rbCrossN),
        b.worldInvInertia[2].dot(rbCrossN)
      );

      const angA = iRaN.cross(ra).dot(normal);
      const angB = iRbN.cross(rb).dot(normal);
      const invMassSum = a.invMass + b.invMass + angA + angB;
      if (invMassSum === 0) continue;

      const e = manifold.restitution;
      const j = -(1.0 + e) * normalVelocity / (invMassSum * contactCount);

      const impulse = normal.clone().scale(j);
      a.applyImpulse(impulse.clone().scale(-1), ra, false);
      b.applyImpulse(impulse, rb, false);
    }
  }

  public static resolvePosition(manifold: ContactManifold3D, beta: number = 0.2, slop: number = 0.05): void {
    const a = manifold.bodyA;
    const b = manifold.bodyB;
    if (!a || !b) return;

    const penetration = manifold.penetration;
    if (penetration <= slop) return;

    const invMassSum = a.invMass + b.invMass;
    if (invMassSum === 0) return;

    const correctionMag = (Math.max(0, penetration - slop) / invMassSum) * beta;
    const cx = manifold.normal.x * correctionMag;
    const cy = manifold.normal.y * correctionMag;
    const cz = manifold.normal.z * correctionMag;

    if (!a.isStatic) {
      a.position.x -= cx * a.invMass;
      a.position.y -= cy * a.invMass;
      a.position.z -= cz * a.invMass;
    }
    if (!b.isStatic) {
      b.position.x += cx * b.invMass;
      b.position.y += cy * b.invMass;
      b.position.z += cz * b.invMass;
    }
  }
}
