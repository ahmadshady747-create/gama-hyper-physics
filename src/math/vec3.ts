/**
 * Vec3 - High-performance 3D Vector mathematics engine.
 * Designed with Zero-GC in-place mutations and Zero-NaN arithmetic guards.
 */
export class Vec3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x: number = 0, y: number = 0, z: number = 0) {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
  }

  // ==========================================
  // In-place Mutation Operations (Zero-GC)
  // ==========================================

  public set(x: number, y: number, z: number): this {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
    return this;
  }

  public copy(v: Vec3): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  public addInPlace(v: Vec3): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  public subInPlace(v: Vec3): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  public scaleInPlace(s: number): this {
    if (Number.isFinite(s)) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
    }
    return this;
  }

  public addScaledInPlace(v: Vec3, s: number): this {
    if (Number.isFinite(s)) {
      this.x += v.x * s;
      this.y += v.y * s;
      this.z += v.z * s;
    }
    return this;
  }

  public negateInPlace(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  public crossInPlace(v: Vec3): this {
    const cx = this.y * v.z - this.z * v.y;
    const cy = this.z * v.x - this.x * v.z;
    const cz = this.x * v.y - this.y * v.x;
    this.x = cx;
    this.y = cy;
    this.z = cz;
    return this;
  }

  /**
   * Zero-NaN Protected Safe Normalization.
   * Checks magSq() > 1e-6 before computing inverse square root.
   */
  public normalizeSafe(fallback?: Vec3): this {
    const mSq = this.x * this.x + this.y * this.y + this.z * this.z;
    if (mSq > 1e-6) {
      const invMag = 1.0 / Math.sqrt(mSq);
      this.x *= invMag;
      this.y *= invMag;
      this.z *= invMag;
    } else if (fallback) {
      this.x = fallback.x;
      this.y = fallback.y;
      this.z = fallback.z;
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
    }
    return this;
  }

  public setLengthInPlace(len: number): this {
    this.normalizeSafe();
    this.scaleInPlace(len);
    return this;
  }

  public clampLengthInPlace(min: number, max: number): this {
    const mSq = this.magSq();
    if (mSq > 1e-6) {
      const m = Math.sqrt(mSq);
      if (m != 0 && m < min && min > 0) {
        this.scaleInPlace(min / m);
      } else if (m != 0 && m > max && max > 0) {
        this.scaleInPlace(max / m);
      }
    }
    return this;
  }

  // ==========================================
  // Geometric & Scalar Operations
  // ==========================================

  public dot(v: Vec3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }

  public cross(v: Vec3, out: Vec3): Vec3 {
    const cx = this.y * v.z - this.z * v.y;
    const cy = this.z * v.x - this.x * v.z;
    const cz = this.x * v.y - this.y * v.x;
    out.x = cx;
    out.y = cy;
    out.z = cz;
    return out;
  }

  public magSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  public mag(): number {
    return Math.sqrt(this.magSq());
  }

  public distSq(v: Vec3): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  public dist(v: Vec3): number {
    return Math.sqrt(this.distSq(v));
  }

  public clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }

  // ==========================================
  // Static Helper Methods
  // ==========================================

  public static create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
    return new Vec3(x, y, z);
  }

  public static dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  public static cross(a: Vec3, b: Vec3, out: Vec3): Vec3 {
    const cx = a.y * b.z - a.z * b.y;
    const cy = a.z * b.x - a.x * b.z;
    const cz = a.x * b.y - a.y * b.x;
    out.x = cx;
    out.y = cy;
    out.z = cz;
    return out;
  }

  public static distSq(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
  }

  public static dist(a: Vec3, b: Vec3): number {
    return Math.sqrt(Vec3.distSq(a, b));
  }

  public static lerp(a: Vec3, b: Vec3, t: number, out: Vec3): Vec3 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  }
}
