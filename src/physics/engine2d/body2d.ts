import { Vec2 } from '../../math/vec2';
import { BodyType2D } from '../common/types';
import { Capsule2D } from '../shapes/capsule';
import { AABB2D } from '../broadphase/bvh';
import { ISleepableBody } from '../common/sleeping';

export interface BodyOptions2D {
  type?: BodyType2D;
  position?: Vec2;
  velocity?: Vec2;
  angle?: number;
  angularVelocity?: number;
  mass?: number;
  radius?: number;
  width?: number;
  height?: number;
  length?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  color?: string;
  isTrigger?: boolean;
  layerMask?: number;
  canSleep?: boolean;
}

let nextBodyId2D = 1;

/**
 * RigidBody2D - 2D Physical Rigid Body with In-Place Kinematics, Sleeping, BVH Proxies, and Capsule Colliders.
 */
export class RigidBody2D implements ISleepableBody {
  public id: number;
  public type: BodyType2D;

  // Translational Kinematics
  public position: Vec2;
  public velocity: Vec2;
  public force: Vec2;

  // Rotational Kinematics
  public angle: number;
  public angularVelocity: number;
  public torque: number;

  // Physical Properties
  public mass: number;
  public invMass: number;
  public inertia: number;
  public invInertia: number;
  public restitution: number;
  public friction: number;
  public isStatic: boolean;

  // Geometric Parameters
  public radius: number;
  public width: number;
  public height: number;
  public length: number;
  public halfExtents: Vec2;
  public capsule?: Capsule2D;

  // Pre-allocated Box Geometry Buffers (Zero-GC)
  public vertices: [Vec2, Vec2, Vec2, Vec2];
  public axes: [Vec2, Vec2];
  public aabbMin: Vec2;
  public aabbMax: Vec2;
  public currentAABB: AABB2D;

  // Spatial & Sleeping Systems
  public bvhProxyId: number = -1;
  public isSleeping: boolean = false;
  public canSleep: boolean = true;
  public sleepTimer: number = 0;

  // Triggers & Layers
  public isTrigger: boolean = false;
  public layerMask: number = 0xFFFFFFFF;

  // Visual Customization
  public color: string;

  constructor(options: BodyOptions2D = {}) {
    this.id = nextBodyId2D++;
    this.type = options?.type || 'circle';

    this.position = options?.position?.clone() ?? new Vec2();
    this.velocity = options?.velocity?.clone() ?? new Vec2();
    this.force = new Vec2();

    this.angle = options?.angle || 0;
    this.angularVelocity = options?.angularVelocity || 0;
    this.torque = 0;

    this.radius = options?.radius || 20;
    this.width = options?.width || 40;
    this.height = options?.height || 40;
    this.length = options?.length || 40;
    this.halfExtents = new Vec2(this.width * 0.5, this.height * 0.5);

    if (this.type === 'capsule') {
      this.capsule = new Capsule2D(this.radius, this.length);
    }

    this.restitution = typeof options?.restitution === 'number' ? Math.max(0, Math.min(1, options.restitution)) : 0.4;
    this.friction = typeof options?.friction === 'number' ? Math.max(0, Math.min(1, options.friction)) : 0.3;
    this.isStatic = Boolean(options?.isStatic);
    this.isTrigger = Boolean(options?.isTrigger);
    this.layerMask = options?.layerMask ?? 0xFFFFFFFF;
    this.canSleep = options?.canSleep !== undefined ? options.canSleep : true;

    this.color = options?.color || '#38bdf8';

    // Pre-allocate 4 Box vertices and 2 normal axes for SAT
    this.vertices = [new Vec2(), new Vec2(), new Vec2(), new Vec2()];
    this.axes = [new Vec2(1, 0), new Vec2(0, 1)];
    this.aabbMin = new Vec2();
    this.aabbMax = new Vec2();
    this.currentAABB = new AABB2D();

    this.mass = 1.0;
    this.invMass = 1.0;
    this.inertia = 1.0;
    this.invInertia = 1.0;

    const initialMass = options?.mass || (
      this.type === 'circle' ? Math.PI * this.radius * this.radius * 0.001 :
      this.type === 'capsule' ? (Math.PI * this.radius * this.radius + 2 * this.radius * this.length) * 0.001 :
      this.width * this.height * 0.001
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
      this.invInertia = 0;
      this.velocity?.set(0, 0);
      this.angularVelocity = 0;
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

    if (this.type === 'circle') {
      this.inertia = 0.5 * this.mass * this.radius * this.radius;
    } else if (this.type === 'capsule') {
      this.inertia = this.mass * (0.25 * this.radius * this.radius + (1.0 / 12.0) * this.length * this.length);
    } else {
      this.inertia = (1.0 / 12.0) * this.mass * (this.width * this.width + this.height * this.height);
    }

    if (this.inertia != 0) {
      this.invInertia = 1.0 / this.inertia;
    } else {
      this.invInertia = 0;
    }
  }

  public getKineticEnergy(): number {
    const vSq = this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y;
    return 0.5 * this.mass * vSq + 0.5 * this.inertia * this.angularVelocity * this.angularVelocity;
  }

  public wakeUp(): void {
    this.isSleeping = false;
    this.sleepTimer = 0;
  }

  public putToSleep(): void {
    if (this.isStatic) return;
    this.isSleeping = true;
    this.velocity.set(0, 0);
    this.angularVelocity = 0;
    this.force.set(0, 0);
    this.torque = 0;
  }

  public applyForce(f: Vec2): void {
    if (this.isStatic) return;
    this.wakeUp();
    this.force.x += f.x;
    this.force.y += f.y;
  }

  public applyForceAtPoint(f: Vec2, pt: Vec2): void {
    if (this.isStatic) return;
    this.wakeUp();
    this.force.x += f.x;
    this.force.y += f.y;
    const rx = pt.x - this.position.x;
    const ry = pt.y - this.position.y;
    this.torque += rx * f.y - ry * f.x;
  }

  public applyImpulse(impulse: Vec2, r?: Vec2, wake: boolean = true): void {
    if (this.isStatic) return;
    if (wake) this.wakeUp();
    this.velocity.x += impulse.x * this.invMass;
    this.velocity.y += impulse.y * this.invMass;

    if (r) {
      this.angularVelocity += (r.x * impulse.y - r.y * impulse.x) * this.invInertia;
    }
  }

  public applyTorque(t: number): void {
    if (this.isStatic) return;
    this.wakeUp();
    this.torque += t;
  }

  public integrateForces(gravity: Vec2, wind: Vec2, dt: number): void {
    if (this.isStatic || this.isSleeping) return;

    this.velocity.x += (gravity.x + wind.x + this.force.x * this.invMass) * dt;
    this.velocity.y += (gravity.y + wind.y + this.force.y * this.invMass) * dt;
    this.angularVelocity += this.torque * this.invInertia * dt;

    this.force.set(0, 0);
    this.torque = 0;
  }

  public integrateVelocity(dt: number, airResistance: number = 0.999, angularDamping: number = 0.995): void {
    if (this.isStatic || this.isSleeping) return;

    this.velocity.x *= airResistance;
    this.velocity.y *= airResistance;
    this.angularVelocity *= angularDamping;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.angle += this.angularVelocity * dt;

    this.updateTransform();
  }

  public updateTransform(): void {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    if (this.type === 'circle') {
      this.aabbMin.set(this.position.x - this.radius, this.position.y - this.radius);
      this.aabbMax.set(this.position.x + this.radius, this.position.y + this.radius);
      this.currentAABB.set(this.aabbMin.x, this.aabbMin.y, this.aabbMax.x, this.aabbMax.y);
      return;
    }

    if (this.type === 'capsule') {
      if (!this.capsule) this.capsule = new Capsule2D(this.radius, this.length);
      this.capsule.getAABB(this.position, this.angle, this.currentAABB);
      this.aabbMin.copy(this.currentAABB.min);
      this.aabbMax.copy(this.currentAABB.max);
      return;
    }

    const hx = this.halfExtents.x;
    const hy = this.halfExtents.y;

    this.vertices[0].set(this.position.x + (-hx * cos - -hy * sin), this.position.y + (-hx * sin + -hy * cos));
    this.vertices[1].set(this.position.x + (hx * cos - -hy * sin), this.position.y + (hx * sin + -hy * cos));
    this.vertices[2].set(this.position.x + (hx * cos - hy * sin), this.position.y + (hx * sin + hy * cos));
    this.vertices[3].set(this.position.x + (-hx * cos - hy * sin), this.position.y + (-hx * sin + hy * cos));

    this.axes[0].set(cos, sin);
    this.axes[1].set(-sin, cos);

    let minX = this.vertices[0].x, maxX = this.vertices[0].x;
    let minY = this.vertices[0].y, maxY = this.vertices[0].y;

    for (let i = 1; i < 4; i++) {
      const v = this.vertices[i];
      if (v.x < minX) minX = v.x;
      if (v.x > maxX) maxX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.y > maxY) maxY = v.y;
    }

    this.aabbMin.set(minX, minY);
    this.aabbMax.set(maxX, maxY);
    this.currentAABB.set(minX, minY, maxX, maxY);
  }

  public getAABB(outAABB?: AABB2D): AABB2D {
    const target = outAABB || this.currentAABB;
    target.set(this.aabbMin.x, this.aabbMin.y, this.aabbMax.x, this.aabbMax.y);
    return target;
  }
}
