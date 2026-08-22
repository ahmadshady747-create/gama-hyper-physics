import { Vec4 } from '../../math/vec4';
import { Rotor4D } from '../../math/rotor4d';
import { BodyType4D } from '../common/types';

export interface BodyOptions4D {
  type?: BodyType4D;
  position?: Vec4;
  velocity?: Vec4;
  rotor?: Rotor4D;
  mass?: number;
  radius?: number;
  width?: number;
  height?: number;
  depth?: number;
  hyperDepth?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  color?: string;
}

let nextBodyId4D = 1;

/**
 * RigidBody4D - 4D Hyper-Physics Rigid Body (Hypersphere S³ or Tesseract 8-Cell).
 * Supports in-place 4D kinematics and SO(4) 6-Plane Rotors.
 */
export class RigidBody4D {
  public id: number;
  public type: BodyType4D;

  // 4D Translational Kinematics
  public position: Vec4;
  public velocity: Vec4;
  public force: Vec4;

  // 6-Plane Hyper-Rotational Kinematics
  public rotor: Rotor4D;
  public angularVelocityXY: number = 0;
  public angularVelocityXZ: number = 0;
  public angularVelocityXW: number = 0;
  public angularVelocityYZ: number = 0;
  public angularVelocityYW: number = 0;
  public angularVelocityZW: number = 0;

  public torqueXY: number = 0;
  public torqueXZ: number = 0;
  public torqueXW: number = 0;
  public torqueYZ: number = 0;
  public torqueYW: number = 0;
  public torqueZW: number = 0;

  // Physical Properties
  public mass: number;
  public invMass: number;
  public invInertia: number;
  public restitution: number;
  public friction: number;
  public isStatic: boolean;

  // Geometric Parameters
  public radius: number;
  public width: number;
  public height: number;
  public depth: number;
  public hyperDepth: number;
  public halfExtents: Vec4;

  // Pre-allocated Tesseract 16 Vertices (Zero-GC)
  public vertices: Vec4[] = [];
  public aabbMin: Vec4;
  public aabbMax: Vec4;

  // Visual Customization
  public color: string;

  constructor(options: BodyOptions4D = {}) {
    this.id = nextBodyId4D++;
    this.type = options?.type || 'tesseract';

    this.position = options?.position?.clone() ?? new Vec4();
    this.velocity = options?.velocity?.clone() ?? new Vec4();
    this.force = new Vec4();

    this.rotor = options?.rotor?.reset() ?? new Rotor4D();

    this.radius = options?.radius || 25;
    this.width = options?.width || 50;
    this.height = options?.height || 50;
    this.depth = options?.depth || 50;
    this.hyperDepth = options?.hyperDepth || 50;
    this.halfExtents = new Vec4(
      this.width * 0.5,
      this.height * 0.5,
      this.depth * 0.5,
      this.hyperDepth * 0.5
    );

    this.restitution = typeof options?.restitution === 'number' ? Math.max(0, Math.min(1, options.restitution)) : 0.5;
    this.friction = typeof options?.friction === 'number' ? Math.max(0, Math.min(1, options.friction)) : 0.2;
    this.isStatic = Boolean(options?.isStatic);

    this.color = options?.color || '#c084fc';

    // Initialize 16 Tesseract Vertices (±x, ±y, ±z, ±w)
    for (let i = 0; i < 16; i++) {
      this.vertices?.push(new Vec4());
    }

    this.aabbMin = new Vec4();
    this.aabbMax = new Vec4();

    this.mass = 1.0;
    this.invMass = 1.0;
    this.invInertia = 1.0;

    const initialMass = options?.mass || (this.type === 'hypersphere'
      ? 0.5 * Math.PI * Math.PI * Math.pow(this.radius, 4) * 0.00001
      : this.width * this.height * this.depth * this.hyperDepth * 0.00001);

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
      this.invInertia = 0;
      this.velocity?.set(0, 0, 0, 0);
      this.angularVelocityXY = 0;
      this.angularVelocityXZ = 0;
      this.angularVelocityXW = 0;
      this.angularVelocityYZ = 0;
      this.angularVelocityYW = 0;
      this.angularVelocityZW = 0;
    } else {
      this.setMass(this.mass > 0 ? this.mass : 1.0);
    }
  }

  public setMass(m: number): void {
    this.mass = Math.max(0.0001, m);

    if (this.isStatic) {
      this.invMass = 0;
      this.invInertia = 0;
      return;
    }

    if (this.mass != 0) {
      this.invMass = 1.0 / this.mass;
    } else {
      this.invMass = 0;
    }

    // Hyper-Inertia for 4D Rigid Body
    const radSq = (this.radius * this.radius);
    const iVal = (1.0 / 6.0) * this.mass * radSq;
    if (iVal > 1e-6 && iVal != 0) {
      this.invInertia = 1.0 / iVal;
    } else {
      this.invInertia = 0;
    }
  }

  public applyForce(f: Vec4): void {
    if (this.isStatic) return;
    this.force?.addInPlace(f);
  }

  public applyTorque(plane: 'xy' | 'xz' | 'xw' | 'yz' | 'yw' | 'zw', t: number): void {
    if (this.isStatic) return;
    if (plane === 'xy') this.torqueXY += t;
    else if (plane === 'xz') this.torqueXZ += t;
    else if (plane === 'xw') this.torqueXW += t;
    else if (plane === 'yz') this.torqueYZ += t;
    else if (plane === 'yw') this.torqueYW += t;
    else if (plane === 'zw') this.torqueZW += t;
  }

  public applyImpulse(j: Vec4, r: Vec4): void {
    if (this.isStatic) return;

    this.velocity?.addScaledInPlace(j, this.invMass);

    // 4D Angular impulse torque: Tau_ij = r_i * j_j - r_j * j_i
    const jx = j.x, jy = j.y, jz = j.z, jw = j.w;
    const rx = r.x, ry = r.y, rz = r.z, rw = r.w;

    this.angularVelocityXY += (rx * jy - ry * jx) * this.invInertia;
    this.angularVelocityXZ += (rx * jz - rz * jx) * this.invInertia;
    this.angularVelocityXW += (rx * jw - rw * jx) * this.invInertia;
    this.angularVelocityYZ += (ry * jz - rz * jy) * this.invInertia;
    this.angularVelocityYW += (ry * jw - rw * jy) * this.invInertia;
    this.angularVelocityZW += (rz * jw - rw * jz) * this.invInertia;
  }

  public updateTransform(): void {
    if (this.type === 'hypersphere') {
      const r = this.radius;
      this.aabbMin?.set(this.position.x - r, this.position.y - r, this.position.z - r, this.position.w - r);
      this.aabbMax?.set(this.position.x + r, this.position.y + r, this.position.z + r, this.position.w + r);
      return;
    }

    const hw = this.halfExtents.x;
    const hh = this.halfExtents.y;
    const hd = this.halfExtents.z;
    const hq = this.halfExtents.w;

    let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, minZ = Number.MAX_VALUE, minW = Number.MAX_VALUE;
    let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE, maxZ = -Number.MAX_VALUE, maxW = -Number.MAX_VALUE;

    const tempV = new Vec4();

    // 16 Vertex permutations: (±hw, ±hh, ±hd, ±hq)
    for (let i = 0; i < 16; i++) {
      const sx = (i & 1) ? hw : -hw;
      const sy = (i & 2) ? hh : -hh;
      const sz = (i & 4) ? hd : -hd;
      const sw = (i & 8) ? hq : -hq;

      tempV?.set(sx, sy, sz, sw);
      const v = this.vertices.at(i);
      if (v) {
        this.rotor.rotateVec4(tempV, v);
        v.addInPlace(this.position);

        if (v.x < minX) minX = v.x;
        if (v.x > maxX) maxX = v.x;
        if (v.y < minY) minY = v.y;
        if (v.y > maxY) maxY = v.y;
        if (v.z < minZ) minZ = v.z;
        if (v.z > maxZ) maxZ = v.z;
        if (v.w < minW) minW = v.w;
        if (v.w > maxW) maxW = v.w;
      }
    }

    this.aabbMin?.set(minX, minY, minZ, minW);
    this.aabbMax?.set(maxX, maxY, maxZ, maxW);
  }

  public integrateForces(gravity: Vec4, dt: number): void {
    if (this.isStatic) return;

    this.velocity?.addScaledInPlace(gravity, dt);
    this.velocity?.addScaledInPlace(this.force, this.invMass * dt);

    this.angularVelocityXY += this.torqueXY * this.invInertia * dt;
    this.angularVelocityXZ += this.torqueXZ * this.invInertia * dt;
    this.angularVelocityXW += this.torqueXW * this.invInertia * dt;
    this.angularVelocityYZ += this.torqueYZ * this.invInertia * dt;
    this.angularVelocityYW += this.torqueYW * this.invInertia * dt;
    this.angularVelocityZW += this.torqueZW * this.invInertia * dt;

    this.force?.set(0, 0, 0, 0);
    this.torqueXY = 0;
    this.torqueXZ = 0;
    this.torqueXW = 0;
    this.torqueYZ = 0;
    this.torqueYW = 0;
    this.torqueZW = 0;
  }

  public integrateVelocity(dt: number, linearDamping: number = 0.999, angularDamping: number = 0.995): void {
    if (this.isStatic) return;

    this.position?.addScaledInPlace(this.velocity, dt);

    this.rotor?.integrate(
      this.angularVelocityXY,
      this.angularVelocityXZ,
      this.angularVelocityXW,
      this.angularVelocityYZ,
      this.angularVelocityYW,
      this.angularVelocityZW,
      dt
    );

    this.velocity?.scaleInPlace(linearDamping);
    this.angularVelocityXY *= angularDamping;
    this.angularVelocityXZ *= angularDamping;
    this.angularVelocityXW *= angularDamping;
    this.angularVelocityYZ *= angularDamping;
    this.angularVelocityYW *= angularDamping;
    this.angularVelocityZW *= angularDamping;

    this.updateTransform();
  }
}
