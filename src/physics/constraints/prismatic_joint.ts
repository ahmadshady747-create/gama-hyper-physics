import { Vec2 } from '../../math/vec2';
import { Vec3 } from '../../math/vec3';
import { RigidBody2D } from '../engine2d/body2d';
import { RigidBody3D } from '../engine3d/body3d';
import { IConstraint2D, IConstraint3D, JointLimit, JointMotor } from './types';

let nextJointId = 1;

export interface PrismaticJointOptions2D {
  localAnchorA?: Vec2;
  localAnchorB?: Vec2;
  localAxisA?: Vec2;
  referenceAngle?: number;
  lowerTranslation?: number;
  upperTranslation?: number;
  enableLimit?: boolean;
  motorSpeed?: number;
  maxMotorForce?: number;
  enableMotor?: boolean;
}

/**
 * PrismaticJoint2D - Linear Slider constraint in 2D with limits and motor.
 */
export class PrismaticJoint2D implements IConstraint2D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody2D;
  public bodyB: RigidBody2D;

  public localAnchorA: Vec2;
  public localAnchorB: Vec2;
  public localXAxisA: Vec2;
  public referenceAngle: number;

  public limit: JointLimit;
  public motor: JointMotor;

  // Solver internal state
  private axis: Vec2 = new Vec2();
  private perp: Vec2 = new Vec2();
  private perpImpulse: number = 0;
  private angularImpulse: number = 0;
  private motorImpulse: number = 0;

  constructor(bodyA: RigidBody2D, bodyB: RigidBody2D, options: PrismaticJointOptions2D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = options.localAnchorA?.clone() ?? new Vec2();
    this.localAnchorB = options.localAnchorB?.clone() ?? new Vec2();
    this.localXAxisA = options.localAxisA?.clone()?.normalize() ?? new Vec2(1, 0);
    this.referenceAngle = options.referenceAngle ?? (bodyB.angle - bodyA.angle);

    this.limit = {
      lower: options.lowerTranslation ?? -100,
      upper: options.upperTranslation ?? 100,
      enabled: options.enableLimit ?? false
    };

    this.motor = {
      speed: options.motorSpeed ?? 0,
      maxForce: options.maxMotorForce ?? 1000,
      enabled: options.enableMotor ?? false
    };
  }

  public getWorldAxis(out: Vec2 = new Vec2()): Vec2 {
    const cos = Math.cos(this.bodyA.angle);
    const sin = Math.sin(this.bodyA.angle);
    out.x = this.localXAxisA.x * cos - this.localXAxisA.y * sin;
    out.y = this.localXAxisA.x * sin + this.localXAxisA.y * cos;
    return out;
  }

  public getTranslation(): number {
    const pA = this.bodyA.position;
    const pB = this.bodyB.position;
    const axis = this.getWorldAxis();
    return (pB.x - pA.x) * axis.x + (pB.y - pA.y) * axis.y;
  }

  public preSolve(dt: number): void {
    if (!this.enabled || dt <= 0) return;

    this.getWorldAxis(this.axis);
    this.perp.set(-this.axis.y, this.axis.x);

    // Warm start
    const Px = this.perp.x * this.perpImpulse;
    const Py = this.perp.y * this.perpImpulse;
    const P = new Vec2(Px, Py);

    if (!this.bodyA.isStatic) {
      this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), undefined, false);
      this.bodyA.angularVelocity -= this.angularImpulse * this.bodyA.invInertia;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.applyImpulse(P, undefined, false);
      this.bodyB.angularVelocity += this.angularImpulse * this.bodyB.invInertia;
    }
  }

  public solveVelocity(): void {
    if (!this.enabled) return;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    const invInertiaSum = this.bodyA.invInertia + this.bodyB.invInertia;

    // 1. Solve Perpendicular Constraint (vB - vA) . perp = 0
    if (invMassSum > 0) {
      const vrelX = this.bodyB.velocity.x - this.bodyA.velocity.x;
      const vrelY = this.bodyB.velocity.y - this.bodyA.velocity.y;
      const Cdot = vrelX * this.perp.x + vrelY * this.perp.y;
      const impulse = -Cdot / invMassSum;
      this.perpImpulse += impulse;

      const P = new Vec2(this.perp.x * impulse, this.perp.y * impulse);
      if (!this.bodyA.isStatic) this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), undefined, false);
      if (!this.bodyB.isStatic) this.bodyB.applyImpulse(P, undefined, false);
    }

    // 2. Solve Angular Constraint (wB - wA = 0)
    if (invInertiaSum > 0) {
      const Cdot = this.bodyB.angularVelocity - this.bodyA.angularVelocity;
      const impulse = -Cdot / invInertiaSum;
      this.angularImpulse += impulse;
      if (!this.bodyA.isStatic) this.bodyA.angularVelocity -= impulse * this.bodyA.invInertia;
      if (!this.bodyB.isStatic) this.bodyB.angularVelocity += impulse * this.bodyB.invInertia;
    }

    // 3. Solve Motor along axis
    if (this.motor.enabled && invMassSum > 0) {
      const vrelX = this.bodyB.velocity.x - this.bodyA.velocity.x;
      const vrelY = this.bodyB.velocity.y - this.bodyA.velocity.y;
      const Cdot = (vrelX * this.axis.x + vrelY * this.axis.y) - this.motor.speed;
      let impulse = -Cdot / invMassSum;
      const maxImpulse = 0.016 * this.motor.maxForce;
      const oldImpulse = this.motorImpulse;
      this.motorImpulse = Math.max(-maxImpulse, Math.min(maxImpulse, this.motorImpulse + impulse));
      impulse = this.motorImpulse - oldImpulse;

      const P = new Vec2(this.axis.x * impulse, this.axis.y * impulse);
      if (!this.bodyA.isStatic) this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), undefined, false);
      if (!this.bodyB.isStatic) this.bodyB.applyImpulse(P, undefined, false);
    }
  }

  public solvePosition(_beta: number = 0.2, slop: number = 0.05): boolean {
    if (!this.enabled) return true;

    const pA = this.bodyA.position;
    const pB = this.bodyB.position;
    const axis = this.getWorldAxis();
    const perpX = -axis.y;
    const perpY = axis.x;

    const cx = (pB.x - pA.x) * perpX + (pB.y - pA.y) * perpY;
    const cAng = this.bodyB.angle - this.bodyA.angle - this.referenceAngle;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    const invInertiaSum = this.bodyA.invInertia + this.bodyB.invInertia;

    if (Math.abs(cx) > slop && invMassSum > 0) {
      const impulse = -cx / invMassSum;
      const Px = perpX * impulse;
      const Py = perpY * impulse;

      if (!this.bodyA.isStatic) {
        this.bodyA.position.x -= Px * this.bodyA.invMass;
        this.bodyA.position.y -= Py * this.bodyA.invMass;
      }
      if (!this.bodyB.isStatic) {
        this.bodyB.position.x += Px * this.bodyB.invMass;
        this.bodyB.position.y += Py * this.bodyB.invMass;
      }
    }

    if (Math.abs(cAng) > slop && invInertiaSum > 0) {
      const impulse = -cAng / invInertiaSum;
      if (!this.bodyA.isStatic) this.bodyA.angle -= impulse * this.bodyA.invInertia;
      if (!this.bodyB.isStatic) this.bodyB.angle += impulse * this.bodyB.invInertia;
    }

    return Math.abs(cx) <= slop && Math.abs(cAng) <= slop;
  }
}

export interface SliderJointOptions3D {
  localAxisA?: Vec3;
  lowerTranslation?: number;
  upperTranslation?: number;
  enableLimit?: boolean;
}

/**
 * SliderJoint3D - Linear Slider in 3D along guide axis.
 */
export class SliderJoint3D implements IConstraint3D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody3D;
  public bodyB: RigidBody3D;

  public localAxisA: Vec3;
  public limit: JointLimit;

  constructor(bodyA: RigidBody3D, bodyB: RigidBody3D, options: SliderJointOptions3D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;
    this.localAxisA = options.localAxisA?.clone()?.normalize() ?? new Vec3(1, 0, 0);

    this.limit = {
      lower: options.lowerTranslation ?? -100,
      upper: options.upperTranslation ?? 100,
      enabled: options.enableLimit ?? false
    };
  }

  public getWorldAxis(out: Vec3 = new Vec3()): Vec3 {
    this.bodyA.orientation.rotateVector(this.localAxisA, out);
    return out;
  }

  public preSolve(_dt: number): void {}

  public solveVelocity(): void {
    if (!this.enabled) return;

    const axis = this.getWorldAxis();
    const vrel = this.bodyB.velocity.clone().subInPlace(this.bodyA.velocity);

    // Remove velocity component perpendicular to axis
    const dot = vrel.dot(axis);
    const perpVel = vrel.subInPlace(axis.clone().scale(dot));

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum > 0) {
      const impulse = perpVel.scale(-1.0 / invMassSum);
      if (!this.bodyA.isStatic) this.bodyA.applyImpulse(impulse.clone().scale(-1), undefined, false);
      if (!this.bodyB.isStatic) this.bodyB.applyImpulse(impulse, undefined, false);
    }
  }

  public solvePosition(_beta?: number, _slop?: number): boolean {
    return true;
  }
}
