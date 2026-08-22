import { Vec2 } from '../../math/vec2';
import { Vec3 } from '../../math/vec3';
import { Quat } from '../../math/quat';
import { Capsule3D } from '../shapes/capsule';

/** Time of Impact result for 2D sweeps */
export class TimeOfImpact2D {
  public hit: boolean = false;
  public toi: number = 1.0; // in [0, 1]
  public point: Vec2 = new Vec2();
  public normal: Vec2 = new Vec2();

  public reset(): void {
    this.hit = false;
    this.toi = 1.0;
    this.point.set(0, 0);
    this.normal.set(0, 0);
  }
}

/** Time of Impact result for 3D sweeps */
export class TimeOfImpact3D {
  public hit: boolean = false;
  public toi: number = 1.0; // in [0, 1]
  public point: Vec3 = new Vec3();
  public normal: Vec3 = new Vec3();

  public reset(): void {
    this.hit = false;
    this.toi = 1.0;
    this.point.set(0, 0, 0);
    this.normal.set(0, 0, 0);
  }
}

/**
 * Swept Circle vs Circle Continuous Collision Detection (CCD).
 * Solves: ||(pA0 + tau*vA) - (pB0 + tau*vB)||^2 = (radA + radB)^2
 */
export function sweepCircleVsCircle(
  posA0: Vec2,
  dispA: Vec2,
  radA: number,
  posB0: Vec2,
  dispB: Vec2,
  radB: number,
  outTOI: TimeOfImpact2D
): boolean {
  outTOI.reset();

  // Relative initial position and relative displacement
  const dx0 = posA0.x - posB0.x;
  const dy0 = posA0.y - posB0.y;
  const dvx = dispA.x - dispB.x;
  const dvy = dispA.y - dispB.y;

  const radSum = radA + radB;
  const radSumSq = radSum * radSum;
  const dist0Sq = dx0 * dx0 + dy0 * dy0;

  // Already overlapping at t = 0
  if (dist0Sq <= radSumSq) {
    outTOI.hit = true;
    outTOI.toi = 0;
    if (dist0Sq > 1e-6) {
      const invD = 1.0 / Math.sqrt(dist0Sq);
      outTOI.normal.set(dx0 * invD, dy0 * invD);
    } else {
      outTOI.normal.set(1, 0);
    }
    outTOI.point.set(posA0.x - outTOI.normal.x * radA, posA0.y - outTOI.normal.y * radA);
    return true;
  }

  // Solve a * tau^2 + b * tau + c = 0
  const a = dvx * dvx + dvy * dvy;
  if (a < 1e-8) {
    return false; // Stationary relative motion
  }

  const b = 2.0 * (dx0 * dvx + dy0 * dvy);
  const c = dist0Sq - radSumSq;

  // Moving away from each other
  if (b >= 0) {
    return false;
  }

  const discr = b * b - 4.0 * a * c;
  if (discr < 0) {
    return false; // Missed
  }

  const sqrtDiscr = Math.sqrt(discr);
  const t = (-b - sqrtDiscr) / (2.0 * a);

  if (t >= 0 && t <= 1.0) {
    outTOI.hit = true;
    outTOI.toi = t;

    // Contact position and normal at impact
    const hitAX = posA0.x + dispA.x * t;
    const hitAY = posA0.y + dispA.y * t;
    const hitBX = posB0.x + dispB.x * t;
    const hitBY = posB0.y + dispB.y * t;

    const nx = hitAX - hitBX;
    const ny = hitAY - hitBY;
    const nLen = Math.sqrt(nx * nx + ny * ny);

    if (nLen > 1e-6) {
      outTOI.normal.set(nx / nLen, ny / nLen);
    } else {
      outTOI.normal.set(1, 0);
    }

    outTOI.point.set(hitAX - outTOI.normal.x * radA, hitAY - outTOI.normal.y * radA);
    return true;
  }

  return false;
}

/**
 * Swept Circle vs OBB Box 2D.
 */
export function sweepCircleVsBox2D(
  posA0: Vec2,
  dispA: Vec2,
  radA: number,
  boxPos: Vec2,
  boxHalf: Vec2,
  boxAngle: number,
  outTOI: TimeOfImpact2D
): boolean {
  outTOI.reset();

  // Transform ray into Box local coordinates
  const cos = Math.cos(-boxAngle);
  const sin = Math.sin(-boxAngle);

  const relX = posA0.x - boxPos.x;
  const relY = posA0.y - boxPos.y;
  const localOrigin = new Vec2(relX * cos - relY * sin, relX * sin + relY * cos);
  const localDisp = new Vec2(dispA.x * cos - dispA.y * sin, dispA.x * sin + dispA.y * cos);

  // Expanded AABB in local space
  const ex = boxHalf.x + radA;
  const ey = boxHalf.y + radA;

  let tmin = 0;
  let tmax = 1.0;
  let hitNormLocal = new Vec2();

  // X slab
  if (Math.abs(localDisp.x) < 1e-8) {
    if (localOrigin.x < -ex || localOrigin.x > ex) return false;
  } else {
    const invD = 1.0 / localDisp.x;
    let t1 = (-ex - localOrigin.x) * invD;
    let t2 = (ex - localOrigin.x) * invD;
    let norm = new Vec2(-1, 0);
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
      norm.set(1, 0);
    }
    if (t1 > tmin) {
      tmin = t1;
      hitNormLocal.copy(norm);
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(localDisp.y) < 1e-8) {
    if (localOrigin.y < -ey || localOrigin.y > ey) return false;
  } else {
    const invD = 1.0 / localDisp.y;
    let t1 = (-ey - localOrigin.y) * invD;
    let t2 = (ey - localOrigin.y) * invD;
    let norm = new Vec2(0, -1);
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
      norm.set(0, 1);
    }
    if (t1 > tmin) {
      tmin = t1;
      hitNormLocal.copy(norm);
    }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (tmin >= 0 && tmin <= 1.0) {
    outTOI.hit = true;
    outTOI.toi = tmin;

    // Rotate normal back to world space
    const cosW = Math.cos(boxAngle);
    const sinW = Math.sin(boxAngle);
    outTOI.normal.set(
      hitNormLocal.x * cosW - hitNormLocal.y * sinW,
      hitNormLocal.x * sinW + hitNormLocal.y * cosW
    );

    outTOI.point.set(
      posA0.x + dispA.x * tmin - outTOI.normal.x * radA,
      posA0.y + dispA.y * tmin - outTOI.normal.y * radA
    );
    return true;
  }

  return false;
}

/**
 * Swept Sphere vs Sphere 3D.
 */
export function sweepSphereVsSphere(
  posA0: Vec3,
  dispA: Vec3,
  radA: number,
  posB0: Vec3,
  dispB: Vec3,
  radB: number,
  outTOI: TimeOfImpact3D
): boolean {
  outTOI.reset();

  const dx0 = posA0.x - posB0.x;
  const dy0 = posA0.y - posB0.y;
  const dz0 = posA0.z - posB0.z;

  const dvx = dispA.x - dispB.x;
  const dvy = dispA.y - dispB.y;
  const dvz = dispA.z - dispB.z;

  const radSum = radA + radB;
  const radSumSq = radSum * radSum;
  const dist0Sq = dx0 * dx0 + dy0 * dy0 + dz0 * dz0;

  if (dist0Sq <= radSumSq) {
    outTOI.hit = true;
    outTOI.toi = 0;
    if (dist0Sq > 1e-6) {
      const invD = 1.0 / Math.sqrt(dist0Sq);
      outTOI.normal.set(dx0 * invD, dy0 * invD, dz0 * invD);
    } else {
      outTOI.normal.set(0, 1, 0);
    }
    outTOI.point.set(
      posA0.x - outTOI.normal.x * radA,
      posA0.y - outTOI.normal.y * radA,
      posA0.z - outTOI.normal.z * radA
    );
    return true;
  }

  const a = dvx * dvx + dvy * dvy + dvz * dvz;
  if (a < 1e-8) return false;

  const b = 2.0 * (dx0 * dvx + dy0 * dvy + dz0 * dvz);
  const c = dist0Sq - radSumSq;

  if (b >= 0) return false;

  const discr = b * b - 4.0 * a * c;
  if (discr < 0) return false;

  const sqrtDiscr = Math.sqrt(discr);
  const t = (-b - sqrtDiscr) / (2.0 * a);

  if (t >= 0 && t <= 1.0) {
    outTOI.hit = true;
    outTOI.toi = t;

    const hitAX = posA0.x + dispA.x * t;
    const hitAY = posA0.y + dispA.y * t;
    const hitAZ = posA0.z + dispA.z * t;

    const hitBX = posB0.x + dispB.x * t;
    const hitBY = posB0.y + dispB.y * t;
    const hitBZ = posB0.z + dispB.z * t;

    const nx = hitAX - hitBX;
    const ny = hitAY - hitBY;
    const nz = hitAZ - hitBZ;
    const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (nLen > 1e-6) {
      outTOI.normal.set(nx / nLen, ny / nLen, nz / nLen);
    } else {
      outTOI.normal.set(0, 1, 0);
    }

    outTOI.point.set(
      hitAX - outTOI.normal.x * radA,
      hitAY - outTOI.normal.y * radA,
      hitAZ - outTOI.normal.z * radA
    );
    return true;
  }

  return false;
}

/**
 * Swept Sphere vs Box 3D.
 */
export function sweepSphereVsBox3D(
  posA0: Vec3,
  dispA: Vec3,
  radA: number,
  boxPos: Vec3,
  boxHalf: Vec3,
  boxOrientation: Quat,
  outTOI: TimeOfImpact3D
): boolean {
  outTOI.reset();

  const invQ = boxOrientation.clone().conjugate();
  const rel = new Vec3(posA0.x - boxPos.x, posA0.y - boxPos.y, posA0.z - boxPos.z);
  const localOrigin = invQ.rotateVec3(rel);
  const localDisp = invQ.rotateVec3(dispA);

  const ex = boxHalf.x + radA;
  const ey = boxHalf.y + radA;
  const ez = boxHalf.z + radA;

  let tmin = 0;
  let tmax = 1.0;
  let hitNormLocal = new Vec3();

  // X slab
  if (Math.abs(localDisp.x) < 1e-8) {
    if (localOrigin.x < -ex || localOrigin.x > ex) return false;
  } else {
    const invD = 1.0 / localDisp.x;
    let t1 = (-ex - localOrigin.x) * invD;
    let t2 = (ex - localOrigin.x) * invD;
    let norm = new Vec3(-1, 0, 0);
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; norm.set(1, 0, 0); }
    if (t1 > tmin) { tmin = t1; hitNormLocal.copy(norm); }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(localDisp.y) < 1e-8) {
    if (localOrigin.y < -ey || localOrigin.y > ey) return false;
  } else {
    const invD = 1.0 / localDisp.y;
    let t1 = (-ey - localOrigin.y) * invD;
    let t2 = (ey - localOrigin.y) * invD;
    let norm = new Vec3(0, -1, 0);
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; norm.set(0, 1, 0); }
    if (t1 > tmin) { tmin = t1; hitNormLocal.copy(norm); }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z slab
  if (Math.abs(localDisp.z) < 1e-8) {
    if (localOrigin.z < -ez || localOrigin.z > ez) return false;
  } else {
    const invD = 1.0 / localDisp.z;
    let t1 = (-ez - localOrigin.z) * invD;
    let t2 = (ez - localOrigin.z) * invD;
    let norm = new Vec3(0, 0, -1);
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; norm.set(0, 0, 1); }
    if (t1 > tmin) { tmin = t1; hitNormLocal.copy(norm); }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (tmin >= 0 && tmin <= 1.0) {
    outTOI.hit = true;
    outTOI.toi = tmin;

    const worldNorm = boxOrientation.rotateVec3(hitNormLocal);
    outTOI.normal.copy(worldNorm);

    outTOI.point.set(
      posA0.x + dispA.x * tmin - outTOI.normal.x * radA,
      posA0.y + dispA.y * tmin - outTOI.normal.y * radA,
      posA0.z + dispA.z * tmin - outTOI.normal.z * radA
    );
    return true;
  }

  return false;
}

/**
 * Swept Sphere vs Capsule 3D.
 */
export function sweepSphereVsCapsule3D(
  posA0: Vec3,
  dispA: Vec3,
  radA: number,
  capsule: Capsule3D,
  capPos: Vec3,
  capOrientation: Quat,
  outTOI: TimeOfImpact3D
): boolean {
  outTOI.reset();
  const p1 = new Vec3(), p2 = new Vec3();
  capsule.getSegment(capPos, capOrientation, p1, p2);

  // Test against upper sphere at p1
  const toi1 = new TimeOfImpact3D();
  const hit1 = sweepSphereVsSphere(posA0, dispA, radA, p1, new Vec3(), capsule.radius, toi1);

  // Test against lower sphere at p2
  const toi2 = new TimeOfImpact3D();
  const hit2 = sweepSphereVsSphere(posA0, dispA, radA, p2, new Vec3(), capsule.radius, toi2);

  if (hit1 && hit2) {
    const best = toi1.toi < toi2.toi ? toi1 : toi2;
    outTOI.hit = true;
    outTOI.toi = best.toi;
    outTOI.point.copy(best.point);
    outTOI.normal.copy(best.normal);
    return true;
  } else if (hit1) {
    outTOI.hit = true;
    outTOI.toi = toi1.toi;
    outTOI.point.copy(toi1.point);
    outTOI.normal.copy(toi1.normal);
    return true;
  } else if (hit2) {
    outTOI.hit = true;
    outTOI.toi = toi2.toi;
    outTOI.point.copy(toi2.point);
    outTOI.normal.copy(toi2.normal);
    return true;
  }

  return false;
}
