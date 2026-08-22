import { Vec3 } from '../../math/vec3';
import { RigidBody3D } from './body3d';

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
const SCRATCH_VREL = new Vec3();
const SCRATCH_IMPULSE = new Vec3();
const SCRATCH_T1 = new Vec3();
const SCRATCH_T2 = new Vec3();
const SCRATCH_AXIS = new Vec3();
const SCRATCH_TEMP = new Vec3();

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

    // Transform sphere position into box local space
    SCRATCH_TEMP?.set(sPos.x - bPos.x, sPos.y - bPos.y, sPos.z - bPos.z);
    const qBox = box.orientation.clone().conjugateInPlace();
    const localSphere = new Vec3();
    qBox.rotateVector(SCRATCH_TEMP, localSphere);

    // Closest point in local space
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

    // World closest point
    const localClosest = new Vec3(cx, cy, cz);
    const worldClosest = new Vec3();
    box.orientation.rotateVector(localClosest, worldClosest);
    worldClosest.addInPlace(bPos);

    manifold.bodyA = sphere;
    manifold.bodyB = box;
    manifold.restitution = Math.min(sphere.restitution, box.restitution);
    manifold.friction = Math.sqrt(sphere.friction * box.friction);
    manifold.contactCount = 1;

    const normal = manifold.normal;
    if (isInside) {
      // Push along minimum face
      const dFaceX = bHalf.x - Math.abs(localSphere.x);
      const dFaceY = bHalf.y - Math.abs(localSphere.y);
      const dFaceZ = bHalf.z - Math.abs(localSphere.z);
      const minFace = Math.min(dFaceX, dFaceY, dFaceZ);

      const localN = new Vec3();
      if (minFace === dFaceX) localN.x = localSphere.x > 0 ? 1 : -1;
      else if (minFace === dFaceY) localN.y = localSphere.y > 0 ? 1 : -1;
      else localN.z = localSphere.z > 0 ? 1 : -1;

      box.orientation.rotateVector(localN, normal);
      normal.negateInPlace();
      manifold.penetration = sphere.radius + minFace;
    } else {
      const dist = Math.sqrt(distSq);
      if (dist > 1e-6 && dist != 0) {
        normal.set((worldClosest.x - sPos.x) / dist, (worldClosest.y - sPos.y) / dist, (worldClosest.z - sPos.z) / dist);
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

  public static boxVsBox(a: RigidBody3D, b: RigidBody3D, manifold: ContactManifold3D): boolean {
    let minOverlap = Number.MAX_VALUE;
    let chosenAxis: Vec3 | null = null;

    const axesA = a.axes;
    const axesB = b.axes;

    // Test 3 Face Axes of Box A
    for (let i = 0; i < 3; i++) {
      const axis = axesA.at(i);
      if (!axis) continue;
      const overlap = CollisionSystem3D.getAxisOverlap(a, b, axis);
      if (overlap <= 0) return false;
      if (overlap < minOverlap) {
        minOverlap = overlap;
        chosenAxis = axis;
      }
    }

    // Test 3 Face Axes of Box B
    for (let i = 0; i < 3; i++) {
      const axis = axesB.at(i);
      if (!axis) continue;
      const overlap = CollisionSystem3D.getAxisOverlap(a, b, axis);
      if (overlap <= 0) return false;
      if (overlap < minOverlap) {
        minOverlap = overlap;
        chosenAxis = axis;
      }
    }

    // Test 9 Cross Product Axes (Ai x Bj)
    for (let i = 0; i < 3; i++) {
      const axA = axesA.at(i);
      if (!axA) continue;
      for (let j = 0; j < 3; j++) {
        const axB = axesB.at(j);
        if (!axB) continue;

        Vec3.cross(axA, axB, SCRATCH_AXIS);
        const mSq = SCRATCH_AXIS.magSq();
        if (mSq < 1e-6) continue; // Parallel axes

        SCRATCH_AXIS.normalizeSafe();
        const overlap = CollisionSystem3D.getAxisOverlap(a, b, SCRATCH_AXIS);
        if (overlap <= 0) return false;
        if (overlap < minOverlap) {
          minOverlap = overlap;
          chosenAxis = SCRATCH_AXIS.clone();
        }
      }
    }

    if (!chosenAxis) return false;

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
    const dirZ = posB.z - posA.z;

    if (dirX * chosenAxis.x + dirY * chosenAxis.y + dirZ * chosenAxis.z < 0) {
      normal.set(-chosenAxis.x, -chosenAxis.y, -chosenAxis.z);
    } else {
      normal.set(chosenAxis.x, chosenAxis.y, chosenAxis.z);
    }

    // Approximate Contact Point (Midpoint of overlap)
    const c0 = manifold.contacts.at(0);
    c0?.set(
      (posA.x + posB.x) * 0.5 + normal.x * (minOverlap * 0.5),
      (posA.y + posB.y) * 0.5 + normal.y * (minOverlap * 0.5),
      (posA.z + posB.z) * 0.5 + normal.z * (minOverlap * 0.5)
    );
    manifold.contactCount = 1;

    return true;
  }

  private static getAxisOverlap(a: RigidBody3D, b: RigidBody3D, axis: Vec3): number {
    let minA = Number.MAX_VALUE, maxA = -Number.MAX_VALUE;
    let minB = Number.MAX_VALUE, maxB = -Number.MAX_VALUE;

    for (let i = 0; i < 8; i++) {
      const vA = a.vertices.at(i) ?? a.position;
      const projA = vA.dot(axis);
      if (projA < minA) minA = projA;
      if (projA > maxA) maxA = projA;

      const vB = b.vertices.at(i) ?? b.position;
      const projB = vB.dot(axis);
      if (projB < minB) minB = projB;
      if (projB > maxB) maxB = projB;
    }

    return Math.min(maxA, maxB) - Math.max(minA, minB);
  }

  public static solveVelocity(manifold: ContactManifold3D): void {
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
    const angA = a.angularVelocity;
    const angB = b.angularVelocity;

    for (let i = 0; i < count; i++) {
      const cp = manifold.contacts.at(i);
      if (!cp) continue;

      SCRATCH_RA.set(cp.x - posA.x, cp.y - posA.y, cp.z - posA.z);
      SCRATCH_RB.set(cp.x - posB.x, cp.y - posB.y, cp.z - posB.z);

      // vA_contact = vA + wA x rA
      const vAx = velA.x + (angA.y * SCRATCH_RA.z - angA.z * SCRATCH_RA.y);
      const vAy = velA.y + (angA.z * SCRATCH_RA.x - angA.x * SCRATCH_RA.z);
      const vAz = velA.z + (angA.x * SCRATCH_RA.y - angA.y * SCRATCH_RA.x);

      // vB_contact = vB + wB x rB
      const vBx = velB.x + (angB.y * SCRATCH_RB.z - angB.z * SCRATCH_RB.y);
      const vBy = velB.y + (angB.z * SCRATCH_RB.x - angB.x * SCRATCH_RB.z);
      const vBz = velB.z + (angB.x * SCRATCH_RB.y - angB.y * SCRATCH_RB.x);

      SCRATCH_VREL.set(vBx - vAx, vBy - vAy, vBz - vAz);
      const contactVel = SCRATCH_VREL.dot(normal);
      if (contactVel > 0) continue;

      // Effective Mass
      const raCrossN = new Vec3();
      Vec3.cross(SCRATCH_RA, normal, raCrossN);
      const rbCrossN = new Vec3();
      Vec3.cross(SCRATCH_RB, normal, rbCrossN);

      // (ra x n)^T * I_A^-1 * (ra x n)
      const w0A = a.worldInvInertia.at(0) ?? new Vec3();
      const w1A = a.worldInvInertia.at(1) ?? new Vec3();
      const w2A = a.worldInvInertia.at(2) ?? new Vec3();
      const iaX = w0A.x * raCrossN.x + w0A.y * raCrossN.y + w0A.z * raCrossN.z;
      const iaY = w1A.x * raCrossN.x + w1A.y * raCrossN.y + w1A.z * raCrossN.z;
      const iaZ = w2A.x * raCrossN.x + w2A.y * raCrossN.y + w2A.z * raCrossN.z;
      const rotInertiaA = raCrossN.x * iaX + raCrossN.y * iaY + raCrossN.z * iaZ;

      const w0B = b.worldInvInertia.at(0) ?? new Vec3();
      const w1B = b.worldInvInertia.at(1) ?? new Vec3();
      const w2B = b.worldInvInertia.at(2) ?? new Vec3();
      const ibX = w0B.x * rbCrossN.x + w0B.y * rbCrossN.y + w0B.z * rbCrossN.z;
      const ibY = w1B.x * rbCrossN.x + w1B.y * rbCrossN.y + w1B.z * rbCrossN.z;
      const ibZ = w2B.x * rbCrossN.x + w2B.y * rbCrossN.y + w2B.z * rbCrossN.z;
      const rotInertiaB = rbCrossN.x * ibX + rbCrossN.y * ibY + rbCrossN.z * ibZ;

      const invMassSum = a.invMass + b.invMass + rotInertiaA + rotInertiaB;
      if (invMassSum <= 1e-6) continue;

      let jn = 0;
      if (invMassSum != 0) {
        jn = -(1.0 + manifold.restitution) * contactVel / (invMassSum * count);
      }

      SCRATCH_IMPULSE.set(normal.x * jn, normal.y * jn, normal.z * jn);
      a.applyImpulse(new Vec3(-SCRATCH_IMPULSE.x, -SCRATCH_IMPULSE.y, -SCRATCH_IMPULSE.z), SCRATCH_RA);
      b.applyImpulse(SCRATCH_IMPULSE, SCRATCH_RB);

      // Friction Impulses along 2 Tangent Vectors
      if (Math.abs(normal.x) < 0.9) {
        SCRATCH_T1.set(1, 0, 0);
      } else {
        SCRATCH_T1.set(0, 1, 0);
      }
      Vec3.cross(normal, SCRATCH_T1, SCRATCH_T2);
      SCRATCH_T2.normalizeSafe();
      Vec3.cross(normal, SCRATCH_T2, SCRATCH_T1);
      SCRATCH_T1.normalizeSafe();

      // Tangent 1 Friction
      const vt1 = SCRATCH_VREL.dot(SCRATCH_T1);
      let jt1 = 0;
      if (invMassSum != 0) {
        jt1 = -vt1 / (invMassSum * count);
      }
      const maxFric = Math.abs(jn) * manifold.friction;
      jt1 = Math.max(-maxFric, Math.min(maxFric, jt1));

      SCRATCH_IMPULSE.set(SCRATCH_T1.x * jt1, SCRATCH_T1.y * jt1, SCRATCH_T1.z * jt1);
      a.applyImpulse(new Vec3(-SCRATCH_IMPULSE.x, -SCRATCH_IMPULSE.y, -SCRATCH_IMPULSE.z), SCRATCH_RA);
      b.applyImpulse(SCRATCH_IMPULSE, SCRATCH_RB);

      // Tangent 2 Friction
      const vt2 = SCRATCH_VREL.dot(SCRATCH_T2);
      let jt2 = 0;
      if (invMassSum != 0) {
        jt2 = -vt2 / (invMassSum * count);
      }
      jt2 = Math.max(-maxFric, Math.min(maxFric, jt2));

      SCRATCH_IMPULSE.set(SCRATCH_T2.x * jt2, SCRATCH_T2.y * jt2, SCRATCH_T2.z * jt2);
      a.applyImpulse(new Vec3(-SCRATCH_IMPULSE.x, -SCRATCH_IMPULSE.y, -SCRATCH_IMPULSE.z), SCRATCH_RA);
      b.applyImpulse(SCRATCH_IMPULSE, SCRATCH_RB);
    }
  }

  public static correctPositions(manifold: ContactManifold3D): void {
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
      a.updateTransform();
    }
    if (!b.isStatic) {
      b.position.x += n.x * corrMag * b.invMass;
      b.position.y += n.y * corrMag * b.invMass;
      b.position.z += n.z * corrMag * b.invMass;
      b.updateTransform();
    }
  }
}
