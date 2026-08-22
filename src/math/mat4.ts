import { Vec3 } from './vec3';
import { Vec4 } from './vec4';
import { Quat } from './quat';

/**
 * Mat4 - High-performance 4x4 Matrix for 3D/4D transformations, camera view, and perspective projections.
 * Column-major format with Zero-GC in-place methods and Zero-NaN division guards.
 */
export class Mat4 {
  public elements: Float32Array;

  constructor() {
    this.elements = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  }

  // ==========================================
  // In-place Mutation Operations (Zero-GC)
  // ==========================================

  public identity(): this {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8]  = 0; e[12] = 0;
    e[1] = 0; e[5] = 1; e[9]  = 0; e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }

  public copy(m: Mat4): this {
    this.elements?.set(m.elements);
    return this;
  }

  public multiply(b: Mat4, out: Mat4): Mat4 {
    const ae = this.elements;
    const be = b.elements;
    const te = out.elements;

    const a00 = ae[0], a01 = ae[4], a02 = ae[8],  a03 = ae[12];
    const a10 = ae[1], a11 = ae[5], a12 = ae[9],  a13 = ae[13];
    const a20 = ae[2], a21 = ae[6], a22 = ae[10], a23 = ae[14];
    const a30 = ae[3], a31 = ae[7], a32 = ae[11], a33 = ae[15];

    let b0 = be[0], b1 = be[1], b2 = be[2], b3 = be[3];
    te[0] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    te[1] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    te[2] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    te[3] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[4]; b1 = be[5]; b2 = be[6]; b3 = be[7];
    te[4] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    te[5] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    te[6] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    te[7] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[8]; b1 = be[9]; b2 = be[10]; b3 = be[11];
    te[8] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    te[9] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    te[10] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    te[11] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    b0 = be[12]; b1 = be[13]; b2 = be[14]; b3 = be[15];
    te[12] = b0 * a00 + b1 * a01 + b2 * a02 + b3 * a03;
    te[13] = b0 * a10 + b1 * a11 + b2 * a12 + b3 * a13;
    te[14] = b0 * a20 + b1 * a21 + b2 * a22 + b3 * a23;
    te[15] = b0 * a30 + b1 * a31 + b2 * a32 + b3 * a33;

    return out;
  }

  public perspective(fovy: number, aspect: number, near: number, far: number): this {
    const f = 1.0 / Math.tan(fovy * 0.5);
    const nf = near - far;
    const e = this.elements;

    this.identity();
    if (aspect != 0) {
      e[0] = f / aspect;
    } else {
      e[0] = f;
    }
    e[5] = f;
    if (nf != 0) {
      e[10] = (far + near) / nf;
      e[14] = (2 * far * near) / nf;
    } else {
      e[10] = -1;
      e[14] = -2 * near;
    }
    e[11] = -1;
    e[15] = 0;
    return this;
  }

  public lookAt(eye: Vec3, center: Vec3, up: Vec3): this {
    let z0 = eye.x - center.x;
    let z1 = eye.y - center.y;
    let z2 = eye.z - center.z;

    let len = z0 * z0 + z1 * z1 + z2 * z2;
    if (len > 1e-6) {
      const invLen = 1.0 / Math.sqrt(len);
      z0 *= invLen;
      z1 *= invLen;
      z2 *= invLen;
    } else {
      z0 = 0; z1 = 0; z2 = 1;
    }

    let x0 = up.y * z2 - up.z * z1;
    let x1 = up.z * z0 - up.x * z2;
    let x2 = up.x * z1 - up.y * z0;
    len = x0 * x0 + x1 * x1 + x2 * x2;
    if (len > 1e-6) {
      const invLen = 1.0 / Math.sqrt(len);
      x0 *= invLen;
      x1 *= invLen;
      x2 *= invLen;
    } else {
      x0 = 1; x1 = 0; x2 = 0;
    }

    const y0 = z1 * x2 - z2 * x1;
    const y1 = z2 * x0 - z0 * x2;
    const y2 = z0 * x1 - z1 * x0;

    const e = this.elements;
    e[0] = x0; e[4] = x1; e[8]  = x2; e[12] = -(x0 * eye.x + x1 * eye.y + x2 * eye.z);
    e[1] = y0; e[5] = y1; e[9]  = y2; e[13] = -(y0 * eye.x + y1 * eye.y + y2 * eye.z);
    e[2] = z0; e[6] = z1; e[10] = z2; e[14] = -(z0 * eye.x + z1 * eye.y + z2 * eye.z);
    e[3] = 0;  e[7] = 0;  e[11] = 0;  e[15] = 1;

    return this;
  }

  public fromRotationTranslation(q: Quat, v: Vec3): this {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    const e = this.elements;
    e[0] = 1 - (yy + zz);
    e[1] = xy + wz;
    e[2] = xz - wy;
    e[3] = 0;

    e[4] = xy - wz;
    e[5] = 1 - (xx + zz);
    e[6] = yz + wx;
    e[7] = 0;

    e[8] = xz + wy;
    e[9] = yz - wx;
    e[10] = 1 - (xx + yy);
    e[11] = 0;

    e[12] = v.x;
    e[13] = v.y;
    e[14] = v.z;
    e[15] = 1;

    return this;
  }

  public transformVec3(v: Vec3, out: Vec3): Vec3 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    const invW = (Math.abs(w) > 1e-6 && w != 0) ? (1.0 / w) : 1.0;

    out.x = (e[0] * x + e[4] * y + e[8]  * z + e[12]) * invW;
    out.y = (e[1] * x + e[5] * y + e[9]  * z + e[13]) * invW;
    out.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * invW;
    return out;
  }

  public transformVec4(v: Vec4, out: Vec4): Vec4 {
    const e = this.elements;
    const x = v.x, y = v.y, z = v.z, w = v.w;

    out.x = e[0] * x + e[4] * y + e[8]  * z + e[12] * w;
    out.y = e[1] * x + e[5] * y + e[9]  * z + e[13] * w;
    out.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
    out.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
    return out;
  }
}
