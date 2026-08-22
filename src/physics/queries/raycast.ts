import { Vec2, Vec3, Quat } from "../../math";
import { Capsule2D, Capsule3D } from "../shapes/capsule";

export interface ITriggerEventListener<T = any> {
  onTriggerEnter?(trigger: T, other: T): void;
  onTriggerStay?(trigger: T, other: T): void;
  onTriggerExit?(trigger: T, other: T): void;
}

export class Ray2D {
  public origin: Vec2 = new Vec2();
  public direction: Vec2 = new Vec2(1, 0);
  public maxDistance: number = Infinity;
  public layerMask: number = 0xFFFFFFFF;

  constructor(origin?: Vec2, direction?: Vec2, maxDistance: number = 10000, layerMask: number = 0xFFFFFFFF) {
    if (origin) this.origin.copy(origin);
    if (direction) this.setDirection(direction);
    this.maxDistance = maxDistance;
    this.layerMask = layerMask;
  }

  public set(origin: Vec2, direction: Vec2, maxDistance: number = 10000, layerMask: number = 0xFFFFFFFF): this {
    this.origin.copy(origin);
    this.setDirection(direction);
    this.maxDistance = maxDistance;
    this.layerMask = layerMask;
    return this;
  }

  public setDirection(dir: Vec2): this {
    const lenSq = dir.x * dir.x + dir.y * dir.y;
    if (lenSq > 1e-6) {
      const invLen = 1.0 / Math.sqrt(lenSq);
      this.direction.set(dir.x * invLen, dir.y * invLen);
    } else {
      this.direction.set(1, 0);
    }
    return this;
  }

  public getPoint(fraction: number, outPoint: Vec2): void {
    const d = fraction * this.maxDistance;
    outPoint.set(this.origin.x + this.direction.x * d, this.origin.y + this.direction.y * d);
  }
}

export class Ray3D {
  public origin: Vec3 = new Vec3();
  public direction: Vec3 = new Vec3(0, 0, -1);
  public maxDistance: number = Infinity;
  public layerMask: number = 0xFFFFFFFF;

  constructor(origin?: Vec3, direction?: Vec3, maxDistance: number = 10000, layerMask: number = 0xFFFFFFFF) {
    if (origin) this.origin.copy(origin);
    if (direction) this.setDirection(direction);
    this.maxDistance = maxDistance;
    this.layerMask = layerMask;
  }

  public set(origin: Vec3, direction: Vec3, maxDistance: number = 10000, layerMask: number = 0xFFFFFFFF): this {
    this.origin.copy(origin);
    this.setDirection(direction);
    this.maxDistance = maxDistance;
    this.layerMask = layerMask;
    return this;
  }

  public setDirection(dir: Vec3): this {
    const lenSq = dir.x * dir.x + dir.y * dir.y + dir.z * dir.z;
    if (lenSq > 1e-6) {
      const invLen = 1.0 / Math.sqrt(lenSq);
      this.direction.set(dir.x * invLen, dir.y * invLen, dir.z * invLen);
    } else {
      this.direction.set(0, 0, -1);
    }
    return this;
  }

  public getPoint(fraction: number, outPoint: Vec3): void {
    const d = fraction * this.maxDistance;
    outPoint.set(
      this.origin.x + this.direction.x * d,
      this.origin.y + this.direction.y * d,
      this.origin.z + this.direction.z * d
    );
  }
}

export class RayHit2D<T = any> {
  public hit: boolean = false;
  public point: Vec2 = new Vec2();
  public normal: Vec2 = new Vec2();
  public fraction: number = 1.0;
  public distance: number = 0;
  public body: T | null = null;
  public isTrigger: boolean = false;

  public reset(): void {
    this.hit = false;
    this.fraction = 1.0;
    this.distance = 0;
    this.body = null;
    this.isTrigger = false;
    this.point.set(0, 0);
    this.normal.set(0, 0);
  }
}

export class RayHit3D<T = any> {
  public hit: boolean = false;
  public point: Vec3 = new Vec3();
  public normal: Vec3 = new Vec3();
  public fraction: number = 1.0;
  public distance: number = 0;
  public body: T | null = null;
  public isTrigger: boolean = false;

  public reset(): void {
    this.hit = false;
    this.fraction = 1.0;
    this.distance = 0;
    this.body = null;
    this.isTrigger = false;
    this.point.set(0, 0, 0);
    this.normal.set(0, 0, 0);
  }
}

/** Ray vs Circle 2D */
export function rayVsCircle2D(ray: Ray2D, center: Vec2, radius: number, outHit: RayHit2D): boolean {
  const ocX = ray.origin.x - center.x;
  const ocY = ray.origin.y - center.y;
  const b = ocX * ray.direction.x + ocY * ray.direction.y;
  const c = ocX * ocX + ocY * ocY - radius * radius;
  const discriminant = b * b - c;

  if (discriminant < 0) return false;

  const sqrtD = Math.sqrt(discriminant);
  let t = -b - sqrtD;
  if (t < 0) t = -b + sqrtD;

  if (t < 0 || t > ray.maxDistance) return false;

  const fraction = t / ray.maxDistance;
  if (fraction >= outHit.fraction) return false;

  outHit.hit = true;
  outHit.distance = t;
  outHit.fraction = fraction;
  ray.getPoint(fraction, outHit.point);
  outHit.normal.set(
    (outHit.point.x - center.x) / radius,
    (outHit.point.y - center.y) / radius
  );
  return true;
}

/** Ray vs OBB Box 2D */
export function rayVsBox2D(
  ray: Ray2D,
  center: Vec2,
  width: number,
  height: number,
  angle: number,
  outHit: RayHit2D
): boolean {
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const hW = width * 0.5;
  const hH = height * 0.5;

  // Transform ray to local box space
  const relX = ray.origin.x - center.x;
  const relY = ray.origin.y - center.y;
  const localOx = cos * relX - sin * relY;
  const localOy = sin * relX + cos * relY;
  const localDx = cos * ray.direction.x - sin * ray.direction.y;
  const localDy = sin * ray.direction.x + cos * ray.direction.y;

  let tmin = 0;
  let tmax = ray.maxDistance;
  let hitNormX = 0, hitNormY = 0;

  // X slab
  if (Math.abs(localDx) < 1e-8) {
    if (localOx < -hW || localOx > hW) return false;
  } else {
    const invD = 1.0 / localDx;
    let t1 = (-hW - localOx) * invD;
    let t2 = (hW - localOx) * invD;
    let nX = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; nX = 1; }
    if (t1 > tmin) { tmin = t1; hitNormX = nX; hitNormY = 0; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(localDy) < 1e-8) {
    if (localOy < -hH || localOy > hH) return false;
  } else {
    const invD = 1.0 / localDy;
    let t1 = (-hH - localOy) * invD;
    let t2 = (hH - localOy) * invD;
    let nY = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; nY = 1; }
    if (t1 > tmin) { tmin = t1; hitNormX = 0; hitNormY = nY; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (tmin < 0 || tmin > ray.maxDistance) return false;
  const fraction = tmin / ray.maxDistance;
  if (fraction >= outHit.fraction) return false;

  outHit.hit = true;
  outHit.distance = tmin;
  outHit.fraction = fraction;
  ray.getPoint(fraction, outHit.point);

  // Rotate normal back to world space
  const worldCos = Math.cos(angle);
  const worldSin = Math.sin(angle);
  outHit.normal.set(
    worldCos * hitNormX - worldSin * hitNormY,
    worldSin * hitNormX + worldCos * hitNormY
  );
  return true;
}

/** Ray vs Sphere 3D */
export function rayVsSphere3D(ray: Ray3D, center: Vec3, radius: number, outHit: RayHit3D): boolean {
  const ocX = ray.origin.x - center.x;
  const ocY = ray.origin.y - center.y;
  const ocZ = ray.origin.z - center.z;
  const b = ocX * ray.direction.x + ocY * ray.direction.y + ocZ * ray.direction.z;
  const c = ocX * ocX + ocY * ocY + ocZ * ocZ - radius * radius;
  const discriminant = b * b - c;

  if (discriminant < 0) return false;

  const sqrtD = Math.sqrt(discriminant);
  let t = -b - sqrtD;
  if (t < 0) t = -b + sqrtD;

  if (t < 0 || t > ray.maxDistance) return false;

  const fraction = t / ray.maxDistance;
  if (fraction >= outHit.fraction) return false;

  outHit.hit = true;
  outHit.distance = t;
  outHit.fraction = fraction;
  ray.getPoint(fraction, outHit.point);
  outHit.normal.set(
    (outHit.point.x - center.x) / radius,
    (outHit.point.y - center.y) / radius,
    (outHit.point.z - center.z) / radius
  );
  return true;
}

/** Ray vs OBB Box 3D */
export function rayVsBox3D(
  ray: Ray3D,
  center: Vec3,
  halfExtents: Vec3,
  orientation: Quat,
  outHit: RayHit3D
): boolean {
  const invQ = orientation.clone().conjugate();
  const rel = new Vec3(ray.origin.x - center.x, ray.origin.y - center.y, ray.origin.z - center.z);
  const localO = invQ.rotateVec3(rel);
  const localD = invQ.rotateVec3(ray.direction);

  let tmin = 0;
  let tmax = ray.maxDistance;
  let normAxis = 0, normSign = 0;

  // X slab
  if (Math.abs(localD.x) < 1e-8) {
    if (localO.x < -halfExtents.x || localO.x > halfExtents.x) return false;
  } else {
    const invD = 1.0 / localD.x;
    let t1 = (-halfExtents.x - localO.x) * invD;
    let t2 = (halfExtents.x - localO.x) * invD;
    let s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; normAxis = 0; normSign = s; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(localD.y) < 1e-8) {
    if (localO.y < -halfExtents.y || localO.y > halfExtents.y) return false;
  } else {
    const invD = 1.0 / localD.y;
    let t1 = (-halfExtents.y - localO.y) * invD;
    let t2 = (halfExtents.y - localO.y) * invD;
    let s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; normAxis = 1; normSign = s; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z slab
  if (Math.abs(localD.z) < 1e-8) {
    if (localO.z < -halfExtents.z || localO.z > halfExtents.z) return false;
  } else {
    const invD = 1.0 / localD.z;
    let t1 = (-halfExtents.z - localO.z) * invD;
    let t2 = (halfExtents.z - localO.z) * invD;
    let s = -1;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; s = 1; }
    if (t1 > tmin) { tmin = t1; normAxis = 2; normSign = s; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  if (tmin < 0 || tmin > ray.maxDistance) return false;
  const fraction = tmin / ray.maxDistance;
  if (fraction >= outHit.fraction) return false;

  outHit.hit = true;
  outHit.distance = tmin;
  outHit.fraction = fraction;
  ray.getPoint(fraction, outHit.point);

  const localNorm = new Vec3(
    normAxis === 0 ? normSign : 0,
    normAxis === 1 ? normSign : 0,
    normAxis === 2 ? normSign : 0
  );
  const worldNorm = orientation.rotateVec3(localNorm);
  outHit.normal.copy(worldNorm);
  return true;
}

/** Ray vs Capsule 2D */
export function rayVsCapsule2D(ray: Ray2D, capsule: Capsule2D, pos: Vec2, angle: number, outHit: RayHit2D): boolean {
  const p1 = new Vec2(), p2 = new Vec2();
  capsule.getSegment(pos, angle, p1, p2);

  // Check end-cap circles
  let hit = rayVsCircle2D(ray, p1, capsule.radius, outHit);
  hit = rayVsCircle2D(ray, p2, capsule.radius, outHit) || hit;

  // Check cylinder body (box along segment)
  const segCenter = new Vec2((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5);
  hit = rayVsBox2D(ray, segCenter, capsule.radius * 2, capsule.length, angle, outHit) || hit;
  return hit;
}

/** Ray vs Capsule 3D */
export function rayVsCapsule3D(ray: Ray3D, capsule: Capsule3D, pos: Vec3, orientation: Quat, outHit: RayHit3D): boolean {
  const p1 = new Vec3(), p2 = new Vec3();
  capsule.getSegment(pos, orientation, p1, p2);

  let hit = rayVsSphere3D(ray, p1, capsule.radius, outHit);
  hit = rayVsSphere3D(ray, p2, capsule.radius, outHit) || hit;

  const segCenter = new Vec3((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, (p1.z + p2.z) * 0.5);
  const halfExt = new Vec3(capsule.radius, capsule.length * 0.5, capsule.radius);
  hit = rayVsBox3D(ray, segCenter, halfExt, orientation, outHit) || hit;
  return hit;
}
