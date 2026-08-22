/**
 * Vec4 - High-performance 4D Hyper-Vector mathematics engine.
 * Designed with Zero-GC in-place mutations and Zero-NaN arithmetic guards.
 */
export class Vec4 {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 0) {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
    this.w = Number.isFinite(w) ? w : 0;
  }

  // ==========================================
  // In-place Mutation Operations (Zero-GC)
  // ==========================================

  public set(x: number, y: number, z: number, w: number): this {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
    this.w = Number.isFinite(w) ? w : 0;
    return this;
  }

  public copy(v: Vec4): this {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w;
    return this;
  }

  public addInPlace(v: Vec4): this {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }

  public subInPlace(v: Vec4): this {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }

  public scaleInPlace(s: number): this {
    if (Number.isFinite(s)) {
      this.x *= s;
      this.y *= s;
      this.z *= s;
      this.w *= s;
    }
    return this;
  }

  public addScaledInPlace(v: Vec4, s: number): this {
    if (Number.isFinite(s)) {
      this.x += v.x * s;
      this.y += v.y * s;
      this.z += v.z * s;
      this.w += v.w * s;
    }
    return this;
  }

  public negateInPlace(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }

  /**
   * Zero-NaN Protected Safe Normalization.
   * Checks magSq() > 1e-6 before computing inverse square root.
   */
  public normalizeSafe(fallback?: Vec4): this {
    const mSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    if (mSq > 1e-6) {
      const invMag = 1.0 / Math.sqrt(mSq);
      this.x *= invMag;
      this.y *= invMag;
      this.z *= invMag;
      this.w *= invMag;
    } else if (fallback) {
      this.x = fallback.x;
      this.y = fallback.y;
      this.z = fallback.z;
      this.w = fallback.w;
    } else {
      this.x = 0;
      this.y = 0;
      this.z = 0;
      this.w = 0;
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

  public dot(v: Vec4): number {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }

  public magSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  public mag(): number {
    return Math.sqrt(this.magSq());
  }

  public distSq(v: Vec4): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    const dw = this.w - v.w;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }

  public dist(v: Vec4): number {
    return Math.sqrt(this.distSq(v));
  }

  public clone(): Vec4 {
    return new Vec4(this.x, this.y, this.z, this.w);
  }

  // ==========================================
  // Static Helper Methods
  // ==========================================

  public static create(x: number = 0, y: number = 0, z: number = 0, w: number = 0): Vec4 {
    return new Vec4(x, y, z, w);
  }

  public static dot(a: Vec4, b: Vec4): number {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  }

  public static distSq(a: Vec4, b: Vec4): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    const dw = a.w - b.w;
    return dx * dx + dy * dy + dz * dz + dw * dw;
  }

  public static dist(a: Vec4, b: Vec4): number {
    return Math.sqrt(Vec4.distSq(a, b));
  }

  public static lerp(a: Vec4, b: Vec4, t: number, out: Vec4): Vec4 {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    out.w = a.w + (b.w - a.w) * t;
    return out;
  }
}
