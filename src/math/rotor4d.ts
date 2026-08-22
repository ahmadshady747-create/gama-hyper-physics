import { Vec4 } from './vec4';

/**
 * Rotor4D - High-performance SO(4) 6-Plane Hyper-Rotation Engine.
 * Covers the 6 independent rotation 2-planes in 4D space: (xy, xz, xw, yz, yw, zw).
 * Designed with Zero-GC in-place transformations and Zero-NaN arithmetic guards.
 */
export class Rotor4D {
  // Plane angles in radians
  public angleXY: number = 0;
  public angleXZ: number = 0;
  public angleXW: number = 0;
  public angleYZ: number = 0;
  public angleYW: number = 0;
  public angleZW: number = 0;

  constructor() {
    this.reset();
  }

  public reset(): this {
    this.angleXY = 0;
    this.angleXZ = 0;
    this.angleXW = 0;
    this.angleYZ = 0;
    this.angleYW = 0;
    this.angleZW = 0;
    return this;
  }

  public set(
    xy: number = 0,
    xz: number = 0,
    xw: number = 0,
    yz: number = 0,
    yw: number = 0,
    zw: number = 0
  ): this {
    this.angleXY = Number.isFinite(xy) ? xy : 0;
    this.angleXZ = Number.isFinite(xz) ? xz : 0;
    this.angleXW = Number.isFinite(xw) ? xw : 0;
    this.angleYZ = Number.isFinite(yz) ? yz : 0;
    this.angleYW = Number.isFinite(yw) ? yw : 0;
    this.angleZW = Number.isFinite(zw) ? zw : 0;
    return this;
  }

  public copy(r: Rotor4D): this {
    this.angleXY = r.angleXY;
    this.angleXZ = r.angleXZ;
    this.angleXW = r.angleXW;
    this.angleYZ = r.angleYZ;
    this.angleYW = r.angleYW;
    this.angleZW = r.angleZW;
    return this;
  }

  /**
   * Integrates 6-plane angular velocities into angles in-place (Zero-GC).
   */
  public integrate(
    wXY: number,
    wXZ: number,
    wXW: number,
    wYZ: number,
    wYW: number,
    wZW: number,
    dt: number
  ): this {
    const twoPi = Math.PI * 2;
    this.angleXY = (this.angleXY + wXY * dt) % twoPi;
    this.angleXZ = (this.angleXZ + wXZ * dt) % twoPi;
    this.angleXW = (this.angleXW + wXW * dt) % twoPi;
    this.angleYZ = (this.angleYZ + wYZ * dt) % twoPi;
    this.angleYW = (this.angleYW + wYW * dt) % twoPi;
    this.angleZW = (this.angleZW + wZW * dt) % twoPi;
    return this;
  }

  /**
   * Rotates a 4D Hyper-Vector in-place across all active planes (Zero-GC).
   */
  public rotateVec4InPlace(v: Vec4): Vec4 {
    let x = v.x;
    let y = v.y;
    let z = v.z;
    let w = v.w;

    // 1. XY Plane Rotation
    if (Math.abs(this.angleXY) > 1e-6) {
      const c = Math.cos(this.angleXY);
      const s = Math.sin(this.angleXY);
      const nx = x * c - y * s;
      const ny = x * s + y * c;
      x = nx;
      y = ny;
    }

    // 2. XZ Plane Rotation
    if (Math.abs(this.angleXZ) > 1e-6) {
      const c = Math.cos(this.angleXZ);
      const s = Math.sin(this.angleXZ);
      const nx = x * c - z * s;
      const nz = x * s + z * c;
      x = nx;
      z = nz;
    }

    // 3. XW Plane Rotation
    if (Math.abs(this.angleXW) > 1e-6) {
      const c = Math.cos(this.angleXW);
      const s = Math.sin(this.angleXW);
      const nx = x * c - w * s;
      const nw = x * s + w * c;
      x = nx;
      w = nw;
    }

    // 4. YZ Plane Rotation
    if (Math.abs(this.angleYZ) > 1e-6) {
      const c = Math.cos(this.angleYZ);
      const s = Math.sin(this.angleYZ);
      const ny = y * c - z * s;
      const nz = y * s + z * c;
      y = ny;
      z = nz;
    }

    // 5. YW Plane Rotation
    if (Math.abs(this.angleYW) > 1e-6) {
      const c = Math.cos(this.angleYW);
      const s = Math.sin(this.angleYW);
      const ny = y * c - w * s;
      const nw = y * s + w * c;
      y = ny;
      w = nw;
    }

    // 6. ZW Plane Rotation
    if (Math.abs(this.angleZW) > 1e-6) {
      const c = Math.cos(this.angleZW);
      const s = Math.sin(this.angleZW);
      const nz = z * c - w * s;
      const nw = z * s + w * c;
      z = nz;
      w = nw;
    }

    v.x = x;
    v.y = y;
    v.z = z;
    v.w = w;
    return v;
  }

  public rotateVec4(v: Vec4, out: Vec4): Vec4 {
    out.copy(v);
    return this.rotateVec4InPlace(out);
  }
}
