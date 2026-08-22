import { Vec3 } from '../../math/vec3';
import { Quat } from '../../math/quat';
import { BodyType3D } from '../common/types';
import { Capsule3D } from '../shapes/capsule';
import { AABB3D } from '../broadphase/bvh';
import { ISleepableBody } from '../common/sleeping';

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
  length?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  color?: string;
  isTrigger?: boolean;
  isBullet?: boolean;
  layerMask?: number;
  canSleep?: boolean;
}

let nextBodyId3D = 1;

/**
 * RigidBody3D - 3D Physical Rigid Body with In-Place Kinematics, Quaternion Orientations,
 * Dynamic BVH Proxies, Sleeping, and Capsule Colliders.
 */
export class RigidBody3D implements ISleepableBody {
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
  public length: number;
  public halfExtents: Vec3;
  public capsule?: Capsule3D;

  // Pre-allocated Box Geometry Buffers (8 vertices & 3 principal normal axes)
  public vertices: [Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3, Vec3];
  public axes: [Vec3, Vec3, Vec3];
  public aabbMin: Vec3 = new Vec3();
  public aabbMax: Vec3 = new Vec3();
  public currentAABB: AABB3D = new AABB3D();

  // Spatial & Sleeping Systems
  public bvhProxyId: number = -1;
  public isSleeping: boolean = false;
  public canSleep: boolean = true;
  public sleepTimer: number = 0;

  // Triggers & Layers
  public isTrigger: boolean = false;
  public layerMask: number = 0xFFFFFFFF;

  // Continuous Collision Detection (CCD)
  public isBullet: boolean = false;
  public ccdSwept: boolean = false;

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
    this.length = options?.length || 40;
    this.halfExtents = new Vec3(this.width * 0.5, this.height * 0.5, this.depth * 0.5);

    if (this.type === 'capsule') {
      this.capsule = new Capsule3D(this.radius, this.length);
    }

    this.restitution = typeof options?.restitution === 'number' ? Math.max(0, Math.min(1, options.restitution)) : 0.3;
    this.friction = typeof options?.friction === 'number' ? Math.max(0, Math.min(1, options.friction)) : 0.3;
    this.isStatic = Boolean(options?.isStatic);
    this.isTrigger = Boolean(options?.isTrigger);
    this.isBullet = Boolean(options?.isBullet);
    this.layerMask = options?.layerMask ?? 0xFFFFFFFF;
    this.canSleep = options?.canSleep !== undefined ? options.canSleep : true;

    this.color = options?.color || '#38bdf8';

    // Pre-allocate 8 vertices and 3 axes for SAT
    this.vertices = [
      new Vec3(), new Vec3(), new Vec3(), new Vec3(),
      new Vec3(), new Vec3(), new Vec3(), new Vec3()
    ];
    this.axes = [new Vec3(1, 0, 0), new Vec3(0, 1, 0), new Vec3(0, 0, 1)];

    this.mass = 1.0;
    this.invMass = 1.0;

    const initialMass = options?.mass || (
      this.type === 'sphere' ? (4.0 / 3.0) * Math.PI * Math.pow(this.radius, 3) * 0.0001 :
      this.type === 'capsule' ? (Math.PI * this.radius * this.radius * this.length + (4.0 / 3.0) * Math.PI * Math.pow(this.radius, 3)) * 0.0001 :
      this.width * this.height * this.depth * 0.0001
    );
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
      this.localInvInertia.set(0, 0, 0);
      this.worldInvInertia[0].set(0, 0, 0);
      this.worldInvInertia[1].set(0, 0, 0);
      this.worldInvInertia[2].set(0, 0, 0);
      this.velocity.set(0, 0, 0);
      this.angularVelocity.set(0, 0, 0);
    } else {
      this.setMass(this.mass > 0 ? this.mass : 1.0);
    }
  }

  public setMass(m: number): void {
    this.mass = Math.max(0.0001, m);

    if (this.isStatic) {
      this.invMass = 0;
      this.localInvInertia.set(0, 0, 0);
      return;
    }

    this.invMass = 1.0 / this.mass;

    if (this.type === 'sphere') {
      const iVal = 0.4 * this.mass * this.radius * this.radius;
      const invI = iVal > 0 ? 1.0 / iVal : 0;
      this.localInvInertia.set(invI, invI, invI);
    } else if (this.type === 'capsule') {
      const iXZ = this.mass * (0.25 * this.radius * this.radius + (1.0 / 12.0) * this.length * this.length);
      const iY = 0.5 * this.mass * this.radius * this.radius;
      this.localInvInertia.set(iXZ > 0 ? 1.0 / iXZ : 0, iY > 0 ? 1.0 / iY : 0, iXZ > 0 ? 1.0 / iXZ : 0);
    } else {
      const w2 = this.width * this.width;
      const h2 = this.height * this.height;
      const d2 = this.depth * this.depth;
      const ix = (1.0 / 12.0) * this.mass * (h2 + d2);
      const iy = (1.0 / 12.0) * this.mass * (w2 + d2);
      const iz = (1.0 / 12.0) * this.mass * (w2 + h2);
      this.localInvInertia.set(
        ix > 0 ? 1.0 / ix : 0,
        iy > 0 ? 1.0 / iy : 0,
        iz > 0 ? 1.0 / iz : 0
      );
    }

    this.updateInertiaTensor();
  }

  public getKineticEnergy(): number {
    const vSq = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y + this.velocity.z * this.velocity.z;
    const wSq = this.angularVelocity.x * this.angularVelocity.x + this.angularVelocity.y * this.angularVelocity.y + this.angularVelocity.z * this.angularVelocity.z;
    return 0.5 * this.mass * vSq + 0.5 * wSq;
  }

  public wakeUp(): void {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }

  public putToSleep(): void {
    if (this.isStatic) return;
    this.isSleeping = true;
    this.velocity.set(0, 0, 0);
    this.angularVelocity.set(0, 0, 0);
    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  public applyForce(f: Vec3): void {
    if (this.isStatic) return;
    this.wakeUp();
    this.force.x += f.x;
    this.force.y += f.y;
    this.force.z += f.z;
  }

  public applyForceAtPoint(f: Vec3, pt: Vec3): void {
    if (this.isStatic) return;
    this.wakeUp();
    this.force.x += f.x;
    this.force.y += f.y;
    this.force.z += f.z;

    const rx = pt.x - this.position.x;
    const ry = pt.y - this.position.y;
    const rz = pt.z - this.position.z;

    this.torque.x += ry * f.z - rz * f.y;
    this.torque.y += rz * f.x - rx * f.z;
    this.torque.z += rx * f.y - ry * f.x;
  }

  public applyImpulse(impulse: Vec3, r?: Vec3, wake: boolean = true): void {
    if (this.isStatic) return;
    if (wake) this.wakeUp();
    this.velocity.x += impulse.x * this.invMass;
    this.velocity.y += impulse.y * this.invMass;
    this.velocity.z += impulse.z * this.invMass;

    if (r) {
      const tx = r.y * impulse.z - r.z * impulse.y;
      const ty = r.z * impulse.x - r.x * impulse.z;
      const tz = r.x * impulse.y - r.y * impulse.x;

      const dw = new Vec3(
        this.worldInvInertia[0].x * tx + this.worldInvInertia[0].y * ty + this.worldInvInertia[0].z * tz,
        this.worldInvInertia[1].x * tx + this.worldInvInertia[1].y * ty + this.worldInvInertia[1].z * tz,
        this.worldInvInertia[2].x * tx + this.worldInvInertia[2].y * ty + this.worldInvInertia[2].z * tz
      );

      this.angularVelocity.x += dw.x;
      this.angularVelocity.y += dw.y;
      this.angularVelocity.z += dw.z;
    }
  }

  public integrateForces(gravity: Vec3, wind: Vec3, dt: number): void {
    if (this.isStatic || this.isSleeping) return;

    this.velocity.x += (gravity.x + wind.x + this.force.x * this.invMass) * dt;
    this.velocity.y += (gravity.y + wind.y + this.force.y * this.invMass) * dt;
    this.velocity.z += (gravity.z + wind.z + this.force.z * this.invMass) * dt;

    const dwX = this.worldInvInertia[0].x * this.torque.x + this.worldInvInertia[0].y * this.torque.y + this.worldInvInertia[0].z * this.torque.z;
    const dwY = this.worldInvInertia[1].x * this.torque.x + this.worldInvInertia[1].y * this.torque.y + this.worldInvInertia[1].z * this.torque.z;
    const dwZ = this.worldInvInertia[2].x * this.torque.x + this.worldInvInertia[2].y * this.torque.y + this.worldInvInertia[2].z * this.torque.z;

    this.angularVelocity.x += dwX * dt;
    this.angularVelocity.y += dwY * dt;
    this.angularVelocity.z += dwZ * dt;

    this.force.set(0, 0, 0);
    this.torque.set(0, 0, 0);
  }

  public integrateVelocity(dt: number, airResistance: number = 0.999, angularDamping: number = 0.995): void {
    if (this.isStatic || this.isSleeping) return;

    this.velocity.x *= airResistance;
    this.velocity.y *= airResistance;
    this.velocity.z *= airResistance;

    this.angularVelocity.x *= angularDamping;
    this.angularVelocity.y *= angularDamping;
    this.angularVelocity.z *= angularDamping;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    this.orientation.integrate(this.angularVelocity, dt);
    this.orientation.normalize();

    this.updateTransform();
  }

  public updateInertiaTensor(): void {
    if (this.isStatic) return;

    const rotMatrix: [Vec3, Vec3, Vec3] = [new Vec3(), new Vec3(), new Vec3()];
    this.orientation.toRotationMatrix(rotMatrix);

    const r0 = rotMatrix[0];
    const r1 = rotMatrix[1];
    const r2 = rotMatrix[2];

    const ix = this.localInvInertia.x;
    const iy = this.localInvInertia.y;
    const iz = this.localInvInertia.z;

    const m00 = r0.x * ix, m01 = r0.y * iy, m02 = r0.z * iz;
    const m10 = r1.x * ix, m11 = r1.y * iy, m12 = r1.z * iz;
    const m20 = r2.x * ix, m21 = r2.y * iy, m22 = r2.z * iz;

    this.worldInvInertia[0].set(
      m00 * r0.x + m01 * r0.y + m02 * r0.z,
      m00 * r1.x + m01 * r1.y + m02 * r1.z,
      m00 * r2.x + m01 * r2.y + m02 * r2.z
    );
    this.worldInvInertia[1].set(
      m10 * r0.x + m11 * r0.y + m12 * r0.z,
      m10 * r1.x + m11 * r1.y + m12 * r1.z,
      m10 * r2.x + m11 * r2.y + m12 * r2.z
    );
    this.worldInvInertia[2].set(
      m20 * r0.x + m21 * r0.y + m22 * r0.z,
      m20 * r1.x + m21 * r1.y + m22 * r1.z,
      m20 * r2.x + m21 * r2.y + m22 * r2.z
    );
  }

  public updateTransform(): void {
    this.updateInertiaTensor();

    if (this.type === 'sphere') {
      this.aabbMin.set(this.position.x - this.radius, this.position.y - this.radius, this.position.z - this.radius);
      this.aabbMax.set(this.position.x + this.radius, this.position.y + this.radius, this.position.z + this.radius);
      this.currentAABB.set(this.aabbMin.x, this.aabbMin.y, this.aabbMin.z, this.aabbMax.x, this.aabbMax.y, this.aabbMax.z);
      return;
    }

    if (this.type === 'capsule') {
      if (!this.capsule) this.capsule = new Capsule3D(this.radius, this.length);
      this.capsule.getAABB(this.position, this.orientation, this.currentAABB);
      this.aabbMin.copy(this.currentAABB.min);
      this.aabbMax.copy(this.currentAABB.max);
      return;
    }

    const hx = this.halfExtents.x;
    const hy = this.halfExtents.y;
    const hz = this.halfExtents.z;

    this.axes[0].set(1, 0, 0);
    this.axes[1].set(0, 1, 0);
    this.axes[2].set(0, 0, 1);
    this.orientation.rotateVec3(this.axes[0], this.axes[0]);
    this.orientation.rotateVec3(this.axes[1], this.axes[1]);
    this.orientation.rotateVec3(this.axes[2], this.axes[2]);

    const signs = [
      [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
      [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]
    ];

    let minX = Number.MAX_VALUE, maxX = -Number.MAX_VALUE;
    let minY = Number.MAX_VALUE, maxY = -Number.MAX_VALUE;
    let minZ = Number.MAX_VALUE, maxZ = -Number.MAX_VALUE;

    const localPt = new Vec3();
    for (let i = 0; i < 8; i++) {
      const s = signs[i];
      localPt.set(s[0] * hx, s[1] * hy, s[2] * hz);
      const worldOffset = this.orientation.rotateVec3(localPt);
      const v = this.vertices[i];
      v.set(
        this.position.x + worldOffset.x,
        this.position.y + worldOffset.y,
        this.position.z + worldOffset.z
      );

      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
      if (v.z < minZ) minZ = v.z;
      if (v.z > maxZ) maxZ = v.z;
    }

    this.aabbMin.set(minX, minY, minZ);
    this.aabbMax.set(maxX, maxY, maxZ);
    this.currentAABB.set(minX, minY, minZ, maxX, maxY, maxZ);
  }

  public getAABB(outAABB?: AABB3D): AABB3D {
    const target = outAABB || this.currentAABB;
    target.set(this.aabbMin.x, this.aabbMin.y, this.aabbMin.z, this.aabbMax.x, this.aabbMax.y, this.aabbMax.z);
    return target;
  }
}
