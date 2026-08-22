import { Vec2, Vec3, Quat } from "../../math";
import { AABB2D, AABB3D } from "../broadphase/bvh";

export class Capsule2D {
  public radius: number;
  public length: number; // Distance between hemispherical centers

  constructor(radius: number = 15, length: number = 30) {
    this.radius = radius;
    this.length = length;
  }

  public getSegment(pos: Vec2, angle: number, outP1: Vec2, outP2: Vec2): void {
    const halfL = this.length * 0.5;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Local segment along Y axis: (0, -halfL) to (0, halfL)
    const dx = -sin * halfL;
    const dy = cos * halfL;
    outP1.set(pos.x - dx, pos.y - dy);
    outP2.set(pos.x + dx, pos.y + dy);
  }

  public getAABB(pos: Vec2, angle: number, outAABB: AABB2D): void {
    const p1 = new Vec2();
    const p2 = new Vec2();
    this.getSegment(pos, angle, p1, p2);
    const minX = Math.min(p1.x, p2.x) - this.radius;
    const minY = Math.min(p1.y, p2.y) - this.radius;
    const maxX = Math.max(p1.x, p2.x) + this.radius;
    const maxY = Math.max(p1.y, p2.y) + this.radius;
    outAABB.set(minX, minY, maxX, maxY);
  }
}

export class Capsule3D {
  public radius: number;
  public length: number; // Distance between sphere centers along local Y

  constructor(radius: number = 15, length: number = 30) {
    this.radius = radius;
    this.length = length;
  }

  public getSegment(pos: Vec3, orientation: Quat, outP1: Vec3, outP2: Vec3): void {
    const halfL = this.length * 0.5;
    const localAxis = new Vec3(0, halfL, 0);
    const worldOffset = orientation.rotateVec3(localAxis);
    outP1.set(pos.x - worldOffset.x, pos.y - worldOffset.y, pos.z - worldOffset.z);
    outP2.set(pos.x + worldOffset.x, pos.y + worldOffset.y, pos.z + worldOffset.z);
  }

  public getAABB(pos: Vec3, orientation: Quat, outAABB: AABB3D): void {
    const p1 = new Vec3();
    const p2 = new Vec3();
    this.getSegment(pos, orientation, p1, p2);
    const minX = Math.min(p1.x, p2.x) - this.radius;
    const minY = Math.min(p1.y, p2.y) - this.radius;
    const minZ = Math.min(p1.z, p2.z) - this.radius;
    const maxX = Math.max(p1.x, p2.x) + this.radius;
    const maxY = Math.max(p1.y, p2.y) + this.radius;
    const maxZ = Math.max(p1.z, p2.z) + this.radius;
    outAABB.set(minX, minY, minZ, maxX, maxY, maxZ);
  }
}

/** Closest point on 2D line segment AB to point P (clamped parameter t in [0, 1]) */
export function closestPointSegmentPoint2D(a: Vec2, b: Vec2, p: Vec2, outClosest: Vec2): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const apX = p.x - a.x;
  const apY = p.y - a.y;
  const abLenSq = abX * abX + abY * abY;
  if (abLenSq < 1e-8) {
    outClosest.copy(a);
    return 0;
  }
  let t = (apX * abX + apY * abY) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  outClosest.set(a.x + t * abX, a.y + t * abY);
  return t;
}

/** Closest point on 3D line segment AB to point P */
export function closestPointSegmentPoint3D(a: Vec3, b: Vec3, p: Vec3, outClosest: Vec3): number {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abZ = b.z - a.z;
  const apX = p.x - a.x;
  const apY = p.y - a.y;
  const apZ = p.z - a.z;
  const abLenSq = abX * abX + abY * abY + abZ * abZ;
  if (abLenSq < 1e-8) {
    outClosest.copy(a);
    return 0;
  }
  let t = (apX * abX + apY * abY + apZ * abZ) / abLenSq;
  t = Math.max(0, Math.min(1, t));
  outClosest.set(a.x + t * abX, a.y + t * abY, a.z + t * abZ);
  return t;
}

/** Closest points between two 3D line segments (P1-Q1) and (P2-Q2) with division-by-zero guards */
export function closestPointsSegmentSegment3D(
  p1: Vec3, q1: Vec3,
  p2: Vec3, q2: Vec3,
  outClosestA: Vec3,
  outClosestB: Vec3
): void {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y, d1z = q1.z - p1.z;
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y, d2z = q2.z - p2.z;
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;

  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;

  let s = 0;
  let t = 0;

  if (a <= 1e-8 && e <= 1e-8) {
    outClosestA.copy(p1);
    outClosestB.copy(p2);
    return;
  }

  if (a <= 1e-8) {
    s = 0;
    t = Math.max(0, Math.min(1, f / e));
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-8) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a));
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      if (Math.abs(denom) > 1e-8) {
        s = Math.max(0, Math.min(1, (b * f - c * e) / denom));
      } else {
        s = 0;
      }
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = Math.max(0, Math.min(1, -c / a));
      } else if (t > 1) {
        t = 1;
        s = Math.max(0, Math.min(1, (b - c) / a));
      }
    }
  }

  outClosestA.set(p1.x + s * d1x, p1.y + s * d1y, p1.z + s * d1z);
  outClosestB.set(p2.x + t * d2x, p2.y + t * d2y, p2.z + t * d2z);
}

/** Closest points between two 2D line segments */
export function closestPointsSegmentSegment2D(
  p1: Vec2, q1: Vec2,
  p2: Vec2, q2: Vec2,
  outClosestA: Vec2,
  outClosestB: Vec2
): void {
  const p1_3 = new Vec3(p1.x, p1.y, 0);
  const q1_3 = new Vec3(q1.x, q1.y, 0);
  const p2_3 = new Vec3(p2.x, p2.y, 0);
  const q2_3 = new Vec3(q2.x, q2.y, 0);
  const outA_3 = new Vec3();
  const outB_3 = new Vec3();
  closestPointsSegmentSegment3D(p1_3, q1_3, p2_3, q2_3, outA_3, outB_3);
  outClosestA.set(outA_3.x, outA_3.y);
  outClosestB.set(outB_3.x, outB_3.y);
}

export interface CapsuleHit2D {
  collided: boolean;
  normal: Vec2;
  penetration: number;
  contactPoint: Vec2;
}

export interface CapsuleHit3D {
  collided: boolean;
  normal: Vec3;
  penetration: number;
  contactPoint: Vec3;
}

/** 2D Capsule vs Capsule collision */
export function testCapsuleVsCapsule2D(
  c1: Capsule2D, pos1: Vec2, angle1: number,
  c2: Capsule2D, pos2: Vec2, angle2: number,
  outHit: CapsuleHit2D
): boolean {
  const p1 = new Vec2(), q1 = new Vec2();
  const p2 = new Vec2(), q2 = new Vec2();
  c1.getSegment(pos1, angle1, p1, q1);
  c2.getSegment(pos2, angle2, p2, q2);

  const closestA = new Vec2();
  const closestB = new Vec2();
  closestPointsSegmentSegment2D(p1, q1, p2, q2, closestA, closestB);

  const dx = closestB.x - closestA.x;
  const dy = closestB.y - closestA.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = c1.radius + c2.radius;

  if (distSq >= radiusSum * radiusSum) {
    outHit.collided = false;
    return false;
  }

  const dist = Math.sqrt(Math.max(1e-12, distSq));
  if (dist > 1e-6) {
    outHit.normal.set(dx / dist, dy / dist);
  } else {
    outHit.normal.set(0, 1);
  }
  outHit.penetration = radiusSum - dist;
  outHit.contactPoint.set(
    closestA.x + outHit.normal.x * (c1.radius - outHit.penetration * 0.5),
    closestA.y + outHit.normal.y * (c1.radius - outHit.penetration * 0.5)
  );
  outHit.collided = true;
  return true;
}

/** 2D Capsule vs Circle collision */
export function testCapsuleVsCircle2D(
  capsule: Capsule2D, capPos: Vec2, capAngle: number,
  circleCenter: Vec2, circleRadius: number,
  outHit: CapsuleHit2D
): boolean {
  const p1 = new Vec2(), p2 = new Vec2();
  capsule.getSegment(capPos, capAngle, p1, p2);

  const closestOnCap = new Vec2();
  closestPointSegmentPoint2D(p1, p2, circleCenter, closestOnCap);

  const dx = circleCenter.x - closestOnCap.x;
  const dy = circleCenter.y - closestOnCap.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = capsule.radius + circleRadius;

  if (distSq >= radiusSum * radiusSum) {
    outHit.collided = false;
    return false;
  }

  const dist = Math.sqrt(Math.max(1e-12, distSq));
  if (dist > 1e-6) {
    outHit.normal.set(dx / dist, dy / dist);
  } else {
    outHit.normal.set(0, 1);
  }
  outHit.penetration = radiusSum - dist;
  outHit.contactPoint.set(
    closestOnCap.x + outHit.normal.x * capsule.radius,
    closestOnCap.y + outHit.normal.y * capsule.radius
  );
  outHit.collided = true;
  return true;
}

/** 3D Capsule vs Capsule collision */
export function testCapsuleVsCapsule3D(
  c1: Capsule3D, pos1: Vec3, q1: Quat,
  c2: Capsule3D, pos2: Vec3, q2: Quat,
  outHit: CapsuleHit3D
): boolean {
  const p1 = new Vec3(), q1_end = new Vec3();
  const p2 = new Vec3(), q2_end = new Vec3();
  c1.getSegment(pos1, q1, p1, q1_end);
  c2.getSegment(pos2, q2, p2, q2_end);

  const closestA = new Vec3();
  const closestB = new Vec3();
  closestPointsSegmentSegment3D(p1, q1_end, p2, q2_end, closestA, closestB);

  const dx = closestB.x - closestA.x;
  const dy = closestB.y - closestA.y;
  const dz = closestB.z - closestA.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const radiusSum = c1.radius + c2.radius;

  if (distSq >= radiusSum * radiusSum) {
    outHit.collided = false;
    return false;
  }

  const dist = Math.sqrt(Math.max(1e-12, distSq));
  if (dist > 1e-6) {
    outHit.normal.set(dx / dist, dy / dist, dz / dist);
  } else {
    outHit.normal.set(0, 1, 0);
  }
  outHit.penetration = radiusSum - dist;
  outHit.contactPoint.set(
    closestA.x + outHit.normal.x * (c1.radius - outHit.penetration * 0.5),
    closestA.y + outHit.normal.y * (c1.radius - outHit.penetration * 0.5),
    closestA.z + outHit.normal.z * (c1.radius - outHit.penetration * 0.5)
  );
  outHit.collided = true;
  return true;
}

/** 3D Capsule vs Sphere collision */
export function testCapsuleVsSphere3D(
  capsule: Capsule3D, capPos: Vec3, capQuat: Quat,
  sphereCenter: Vec3, sphereRadius: number,
  outHit: CapsuleHit3D
): boolean {
  const p1 = new Vec3(), p2 = new Vec3();
  capsule.getSegment(capPos, capQuat, p1, p2);

  const closestOnCap = new Vec3();
  closestPointSegmentPoint3D(p1, p2, sphereCenter, closestOnCap);

  const dx = sphereCenter.x - closestOnCap.x;
  const dy = sphereCenter.y - closestOnCap.y;
  const dz = sphereCenter.z - closestOnCap.z;
  const distSq = dx * dx + dy * dy + dz * dz;
  const radiusSum = capsule.radius + sphereRadius;

  if (distSq >= radiusSum * radiusSum) {
    outHit.collided = false;
    return false;
  }

  const dist = Math.sqrt(Math.max(1e-12, distSq));
  if (dist > 1e-6) {
    outHit.normal.set(dx / dist, dy / dist, dz / dist);
  } else {
    outHit.normal.set(0, 1, 0);
  }
  outHit.penetration = radiusSum - dist;
  outHit.contactPoint.set(
    closestOnCap.x + outHit.normal.x * capsule.radius,
    closestOnCap.y + outHit.normal.y * capsule.radius,
    closestOnCap.z + outHit.normal.z * capsule.radius
  );
  outHit.collided = true;
  return true;
}
