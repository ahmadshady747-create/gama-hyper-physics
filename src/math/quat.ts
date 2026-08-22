import { Vec3 } from './vec3';

/**
 * Quat - High-performance Unit Quaternion mathematics engine for 3D physics.
 * Supports in-place integration, vector rotation, and Zero-NaN guarded normalizations.
 */
export class Quat {
  public x: number;
  public y: number;
  public z: number;
  public w: number;

  constructor(x: number = 0, y: number = 0, z: number = 0, w: number = 1) {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
    this.w = Number.isFinite(w) ? w : 1;
  }

  // ==========================================
  // In-place Mutation Operations (Zero-GC)
  // ==========================================

  public set(x: number, y: number, z: number, w: number): this {
    this.x = Number.isFinite(x) ? x : 0;
    this.y = Number.isFinite(y) ? y : 0;
    this.z = Number.isFinite(z) ? z : 0;
    this.w = Number.isFinite(w) ? w : 1;
    return this;
  }

  public copy(q: Quat): this {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  public identity(): this {
    this.x = 0;
    this.y = 0;
    this.z = 0;
    this.w = 1;
    return this;
  }

  public setFromAxisAngle(axis: Vec3, angle: number): this {
    const halfAngle = angle * 0.5;
    const sin = Math.sin(halfAngle);
    const cos = Math.cos(halfAngle);

    const mSq = axis.magSq();
    if (mSq > 1e-6) {
      const invMag = 1.0 / Math.sqrt(mSq);
      this.x = axis.x * invMag * sin;
      this.y = axis.y * invMag * sin;
      this.z = axis.z * invMag * sin;
      this.w = cos;
    } else {
      this.identity();
    }
    return this;
  }

  public setFromEuler(pitch: number, yaw: number, roll: number): this {
    const c1 = Math.cos(pitch * 0.5);
    const s1 = Math.sin(pitch * 0.5);
    const c2 = Math.cos(yaw * 0.5);
    const s2 = Math.sin(yaw * 0.5);
    const c3 = Math.cos(roll * 0.5);
    const s3 = Math.sin(roll * 0.5);

    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 + s1 * s2 * c3;
    this.w = c1 * c2 * c3 - s1 * s2 * s3;
    return this;
  }

  public multiplyInPlace(q: Quat): this {
    const ax = this.x;
    const ay = this.y;
    const az = this.z;
    const aw = this.w;
    const bx = q.x;
    const by = q.y;
    const bz = q.z;
    const bw = q.w;

    this.x = aw * bx + ax * bw + ay * bz - az * by;
    this.y = aw * by - ax * bz + ay * bw + az * bx;
    this.z = aw * bz + ax * by - ay * bx + az * bw;
    this.w = aw * bw - ax * bx - ay * by - az * bz;
    return this;
  }

  public conjugateInPlace(): this {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }

  public invertInPlace(): this {
    const mSq = this.magSq();
    if (mSq > 1e-6) {
      const invSq = 1.0 / mSq;
      this.x = -this.x * invSq;
      this.y = -this.y * invSq;
      this.z = -this.z * invSq;
      this.w = this.w * invSq;
    } else {
      this.identity();
    }
    return this;
  }

  /**
   * Safe normalization preventing NaN during rapid rotational updates.
   */
  public normalizeSafe(): this {
    const mSq = this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
    if (mSq > 1e-6) {
      const invMag = 1.0 / Math.sqrt(mSq);
      this.x *= invMag;
      this.y *= invMag;
      this.z *= invMag;
      this.w *= invMag;
    } else {
      this.identity();
    }
    return this;
  }

  /**
   * Rotates a 3D vector by this quaternion in-place (v_out = q * v * q^-1).
   */
  public rotateVector(v: Vec3, out: Vec3): Vec3 {
    const qx = this.x;
    const qy = this.y;
    const qz = this.z;
    const qw = this.w;

    // t = 2 * cross(q.xyz, v)
    const tx = 2 * (qy * v.z - qz * v.y);
    const ty = 2 * (qz * v.x - qx * v.z);
    const tz = 2 * (qx * v.y - qy * v.x);

    // v' = v + q.w * t + cross(q.xyz, t)
    out.x = v.x + qw * tx + (qy * tz - qz * ty);
    out.y = v.y + qw * ty + (qz * tx - qx * tz);
    out.z = v.z + qw * tz + (qx * ty - qy * tx);
    return out;
  }

  /**
   * Integrates angular velocity into this orientation quaternion:
   * dq/dt = 0.5 * w * q
   */
  public integrateAngularVelocity(w: Vec3, dt: number): this {
    const halfDt = dt * 0.5;
    const wx = w.x * halfDt;
    const wy = w.y * halfDt;
    const wz = w.z * halfDt;

    const qx = this.x;
    const qy = this.y;
    const qz = this.z;
    const qw = this.w;

    this.x += (wx * qw + wy * qz - wz * qy);
    this.y += (wy * qw + wz * qx - wx * qz);
    this.z += (wz * qw + wx * qy - wy * qx);
    this.w += (-wx * qx - wy * qy - wz * qz);

    this.normalizeSafe();
    return this;
  }

  public rotateVec3(v: Vec3, out?: Vec3): Vec3 {
    return this.rotateVector(v, out || new Vec3());
  }

  public conjugate(): this {
    return this.conjugateInPlace();
  }

  public normalize(): this {
    return this.normalizeSafe();
  }

  public integrate(w: Vec3, dt: number): this {
    return this.integrateAngularVelocity(w, dt);
  }

  public toRotationMatrix(out: [Vec3, Vec3, Vec3]): [Vec3, Vec3, Vec3] {
    const x = this.x, y = this.y, z = this.z, w = this.w;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    out[0].set(1.0 - 2.0 * (yy + zz), 2.0 * (xy - wz), 2.0 * (xz + wy));
    out[1].set(2.0 * (xy + wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz - wx));
    out[2].set(2.0 * (xz - wy), 2.0 * (yz + wx), 1.0 - 2.0 * (xx + yy));
    return out;
  }

  public magSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }

  public clone(): Quat {
    return new Quat(this.x, this.y, this.z, this.w);
  }

  // ==========================================
  // Static Helper Methods
  // ==========================================

  public static slerp(qa: Quat, qb: Quat, t: number, out: Quat): Quat {
    let cosHalfTheta = qa.x * qb.x + qa.y * qb.y + qa.z * qb.z + qa.w * qb.w;

    let bx = qb.x;
    let by = qb.y;
    let bz = qb.z;
    let bw = qb.w;

    if (cosHalfTheta < 0) {
      cosHalfTheta = -cosHalfTheta;
      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }

    if (Math.abs(cosHalfTheta) >= 1.0) {
      out.x = qa.x;
      out.y = qa.y;
      out.z = qa.z;
      out.w = qa.w;
      return out;
    }

    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    if (sinHalfTheta > 1e-6 && sinHalfTheta != 0) {
      const halfTheta = Math.acos(cosHalfTheta);
      const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
      const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;

      out.x = qa.x * ratioA + bx * ratioB;
      out.y = qa.y * ratioA + by * ratioB;
      out.z = qa.z * ratioA + bz * ratioB;
      out.w = qa.w * ratioA + bw * ratioB;
    } else {
      out.x = qa.x + (bx - qa.x) * t;
      out.y = qa.y + (by - qa.y) * t;
      out.z = qa.z + (bz - qa.z) * t;
      out.w = qa.w + (bw - qa.w) * t;
      out.normalizeSafe();
    }
    return out;
  }
}
