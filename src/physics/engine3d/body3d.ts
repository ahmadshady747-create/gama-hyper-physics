import { Vec3 } from '../../math/vec3';
import { Quat } from '../../math/quat';
import { BodyType3D } from '../common/types';

export interface BodyOptions3D {
  type?: BodyType3D;
  position?: Vec3;
  velocity?: Vec3;
  orientation?: Quat;
  angularVelocity?: Vec3;
  mass?: number;
  radius?: number;
  width?: number;
  height?: number;
  depth?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  color?: string;
}

let nextBodyId3D = 1;

/**
 * RigidBody3D - 3D Physical Rigid Body with In-Place Kinematics, Quaternion Orientations,
 * and 3x3 Rotated Inertia Tensors.
 */
export class RigidBody3D {
  public id: number;
  public type: BodyType3D;

  // Translational Kinematics
  public position: Vec3;
  public velocity: Vec3;
  public force: Vec3;

  // Rotational Kinematics
  public orientation: Quat;
  public angularVelocity: Vec3;
  public torque: Vec3;

  // Physical Properties
  public mass: number;
  public invMass: number;
  public restitution: number;
  public friction: number;
  public isStatic: boolean;

  // Local & World Inverse Inertia Tensors (3x3 represented as diagonal in local, full in world)
  public localInvInertia: Vec3 = new Vec3();
  public worldInvInertia: [Vec3, Vec3, Vec3] = [new Vec3(), new Vec3(), new Vec3()];

  // Geometric Parameters
  public radius: number;
  public width: number;
  public height: number;
  public depth: number;
  public halfExtents: Vec3;

  // Pre-allocated Box Geometry Buffers (8 vertices & 3 principal normal axes)
  public vertices: [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];
  public axes: [Vec3, Vec3, Vec3];
  public aabbMin: Vec3;
  public aabbMax: Vec3;

  // Visual Customization
  public color: string;

  constructor(options: BodyOptions3D = {}) {
    this.id = nextBodyId3D++;
    this.type = options?.type || 'sphere';

    this.position = options?.position?.clone() ?? new Vec3();
    this.velocity = options?.velocity?.clone() ?? new Vec3();
    this.force = new Vec3();

    this.orientation = options?.orientation?.clone() ?? new Quat();
    this.angularVelocity = options?.angularVelocity?.clone() ?? new Vec3();
    this.torque = new Vec3();

    this.radius = options?.radius || 20;
    this.width = options?.width || 40;
    this.height = options?.height || 40;
    this.depth = options?.depth || 40;
    this.halfExtents = new Vec3(this.width * 0.5, this.height * 0.5, this.depth * 0.5);

    this.restitution = typeof options?.restitution === 'number' ? Math.max(0, Math.min(1, options.restitution)) : 0.4;
    this.friction = typeof options?.friction === 'number' ? Math.max(0, Math.min(1, options.friction)) : 0.3;
    this.isStatic = Boolean(options?.isStatic);

    this.color = options?.color || '#38bdf8';

    // 8 Box Vertices
    this.vertices = [
      new Vec3(), new Vec3(), new Vec3(), new Vec3(),
      new Vec3(), new Vec3(), new Vec3(), new Vec3()
    ];
    this.axes = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)];
    this.aabbMin = new Vec3();
    this.aabbMax = new Vec3();

    this.mass = 1.0;
    this.invMass = 1.0;

    const initialMass = options?.mass || (this.type === 'sphere'
      ? (4.0 / 3.0) * Math.PI * this.radius * this.radius * this.radius * 0.0001
      : this.width * this.height * this.depth * 0.0001);

    this.setMass(initialMass);

    if (this.isStatic) {
      this.setStatic(true);
    }

    this.updateTransform();
  }

  public setStatic(isStatic: boolean): void {
    this.isStatic = isStatic;
    if (isStatic) {
      this.invMass = 0;
      this.localInvInertia?.set(0, 0, 0);
      this.velocity?.set(0, 0, 0);
      this.angularVelocity?.set(0, 0, 0);
      this.updateInertiaTensor();
    } else {
      this.setMass(this.mass > 0 ? this.mass : 1.0);
    }
  }

  public setMass(m: number): void {
    this.mass = Math.max(0.0001, m);

    if (this.isStatic) {
      this.invMass = 0;
      this.localInvInertia?.set(0, 0, 0);
      this.updateInertiaTensor();
      return;
    }

    if (this.mass != 0) {
      this.invMass = 1.0 / this.mass;
    } else {
      this.invMass = 0;
    }

    if (this.type === 'sphere') {
      // Inertia for Solid Sphere: I = 2/5 * m * r^2
      const iVal = 0.4 * this.mass * this.radius * this.radius;
      if (iVal > 1e-6 && iVal != 0) {
        this.localInvInertia?.set(1.0 / iVal, 1.0 / iVal, 1.0 / iVal);
      } else {
        this.localInvInertia?.set(0, 0, 0);
      }
    } else {
      // Inertia for Solid Cuboid: I_x = 1/12 * m * (h^2 + d^2), I_y = 1/12 * m * (w^2 + d^2), I_z = 1/12 * m * (w^2 + h^2)
      const w2 = this.width * this.width;
      const h2 = this.height * this.height;
      const d2 = this.depth * this.depth;
      const factor = (1.0 / 12.0) * this.mass;

      const ix = factor * (h2 + d2);
      const iy = factor * (w2 + d2);
      const iz = factor * (w2 + h2);

      const invX = (ix > 1e-6 && ix != 0) ? (1.0 / ix) : 0;
      const invY = (iy > 1e-6 && iy != 0) ? (1.0 / iy) : 0;
      const invZ = (iz > 1e-6 && iz != 0) ? (1.0 / iz) : 0;

      this.localInvInertia?.set(invX, invY, invZ);
    }

    this.updateInertiaTensor();
  }

  /**
   * Updates World Inverse Inertia Tensor via Rotation Matrix R * I_local^-1 * R^T (Zero-GC).
   */
  public updateInertiaTensor(): void {
    if (this.isStatic) {
      this.worldInvInertia.at(0)?.set(0, 0, 0);
      this.worldInvInertia.at(1)?.set(0, 0, 0);
      this.worldInvInertia.at(2)?.set(0, 0, 0);
      return;
    }

    const q = this.orientation;
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    // Rotation Matrix Columns
    const r00 = 1 - (yy + zz), r01 = xy - wz,        r02 = xz + wy;
    const r10 = xy + wz,        r11 = 1 - (xx + zz), r12 = yz - wx;
    const r20 = xz - wy,        r21 = yz + wx,        r22 = 1 - (xx + yy);

    const l = this.localInvInertia;
    const lx = l.x, ly = l.y, lz = l.z;

    // M = R * diag(lx, ly, lz)
    const m00 = r00 * lx, m01 = r01 * ly, m02 = r02 * lz;
    const m10 = r10 * lx, m11 = r11 * ly, m12 = r12 * lz;
    const m20 = r20 * lx, m21 = r21 * ly, m22 = r22 * lz;

    // Result = M * R^T
    const w0 = this.worldInvInertia.at(0);
    const w1 = this.worldInvInertia.at(1);
    const w2 = this.worldInvInertia.at(2);

    w0?.set(
      m00 * r00 + m01 * r01 + m02 * r02,
      m00 * r10 + m01 * r11 + m02 * r12,
      m00 * r20 + m01 * r21 + m02 * r22
    );

    w1?.set(
      m10 * r00 + m11 * r01 + m12 * r02,
      m10 * r10 + m11 * r11 + m12 * r12,
      m10 * r20 + m11 * r21 + m12 * r22
    );

    w2?.set(
      m20 * r00 + m21 * r01 + m22 * r02,
      m20 * r10 + m21 * r11 + m22 * r12,
      m20 * r20 + m21 * r21 + m22 * r22
    );
  }

  public applyForce(f: Vec3): void {
    if (this.isStatic) return;
    this.force?.addInPlace(f);
  }

  public applyTorque(t: Vec3): void {
    if (this.isStatic) return;
    this.torque?.addInPlace(t);
  }

  public applyImpulse(j: Vec3, r: Vec3): void {
    if (this.isStatic) return;

    this.velocity?.addScaledInPlace(j, this.invMass);

    // Angular impulse: deltaW = I_world^-1 * (r x J)
    const rx = r.y * j.z - r.z * j.y;
    const ry = r.z * j.x - r.x * j.z;
    const rz = r.x * j.y - r.y * j.x;

    const w0 = this.worldInvInertia.at(0);
    const w1 = this.worldInvInertia.at(1);
    const w2 = this.worldInvInertia.at(2);

    if (w0 && w1 && w2) {
      const dwX = w0.x * rx + w0.y * ry + w0.z * rz;
      const dwY = w1.x * rx + w1.y * ry + w1.z * rz;
      const dwZ = w2.x * rx + w2.y * ry + w2.z * rz;
      this.angularVelocity?.set(
        this.angularVelocity.x + dwX,
        this.angularVelocity.y + dwY,
        this.angularVelocity.z + dwZ
      );
    }
  }

  public updateTransform(): void {
    this.updateInertiaTensor();

    if (this.type === 'sphere') {
      const r = this.radius;
      this.aabbMin?.set(this.position.x - r, this.position.y - r, this.position.z - r);
      this.aabbMax?.set(this.position.x + r, this.position.y + r, this.position.z + r);
      return;
    }

    const q = this.orientation;
    const hw = this.halfExtents.x;
    const hh = this.halfExtents.y;
    const hd = this.halfExtents.z;

    // 8 Local Corner Points
    const signs = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1,  1], [1, -1,  1], [1, 1,  1], [-1, 1,  1]
    ];

    let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, minZ = Number.MAX_VALUE;
    let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE, maxZ = -Number.MAX_VALUE;

    const tempV = new Vec3();
    for (let i = 0; i < 8; i++) {
      const s = signs.at(i) ?? [-1, -1, -1];
      const sx = s.at(0) ?? -1;
      const sy = s.at(1) ?? -1;
      const sz = s.at(2) ?? -1;

      tempV?.set(sx * hw, sy * hh, sz * hd);
      const v = this.vertices.at(i);
      if (v) {
        q.rotateVector(tempV, v);
        v.addInPlace(this.position);

        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
      }
    }

    // 3 Principal Normal Axes
    const a0 = this.axes.at(0);
    const a1 = this.axes.at(1);
    const a2 = this.axes.at(2);

    if (a0) q.rotateVector(tempV.set(1, 0, 0), a0);
    if (a1) q.rotateVector(tempV.set(0, 1, 0), a1);
    if (a2) q.rotateVector(tempV.set(0, 0, 1), a2);

    this.aabbMin?.set(minX, minY, minZ);
    this.aabbMax?.set(maxX, maxY, maxZ);
  }

  public integrateForces(gravity: Vec3, wind: Vec3, dt: number): void {
    if (this.isStatic) return;

    this.velocity?.addScaledInPlace(gravity, dt);
    this.velocity?.addScaledInPlace(wind, dt);
    this.velocity?.addScaledInPlace(this.force, this.invMass * dt);

    // Angular acceleration = I_world^-1 * torque
    const tx = this.torque.x;
    const ty = this.torque.y;
    const tz = this.torque.z;

    const w0 = this.worldInvInertia.at(0);
    const w1 = this.worldInvInertia.at(1);
    const w2 = this.worldInvInertia.at(2);

    if (w0 && w1 && w2) {
      const dAngX = (w0.x * tx + w0.y * ty + w0.z * tz) * dt;
      const dAngY = (w1.x * tx + w1.y * ty + w1.z * tz) * dt;
      const dAngZ = (w2.x * tx + w2.y * ty + w2.z * tz) * dt;
      this.angularVelocity?.set(
        this.angularVelocity.x + dAngX,
        this.angularVelocity.y + dAngY,
        this.angularVelocity.z + dAngZ
      );
    }

    this.force?.set(0, 0, 0);
    this.torque?.set(0, 0, 0);
  }

  public integrateVelocity(dt: number, linearDamping: number = 0.999, angularDamping: number = 0.995): void {
    if (this.isStatic) return;

    this.position?.addScaledInPlace(this.velocity, dt);
    this.orientation?.integrateAngularVelocity(this.angularVelocity, dt);

    this.velocity?.scaleInPlace(linearDamping);
    this.angularVelocity?.scaleInPlace(angularDamping);

    this.updateTransform();
  }
}
