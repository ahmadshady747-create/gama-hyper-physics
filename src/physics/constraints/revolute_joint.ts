import { Vec2 } from '../../math/vec2';
import { Vec3 } from '../../math/vec3';
import { RigidBody2D } from '../engine2d/body2d';
import { RigidBody3D } from '../engine3d/body3d';
import { IConstraint2D, IConstraint3D, JointLimit, JointMotor } from './types';

let nextJointId = 1;

export interface RevoluteJointOptions2D {
  localAnchorA?: Vec2;
  localAnchorB?: Vec2;
  referenceAngle?: number;
  lowerAngle?: number;
  upperAngle?: number;
  enableLimit?: boolean;
  motorSpeed?: number;
  maxMotorTorque?: number;
  enableMotor?: boolean;
}

/**
 * RevoluteJoint2D - 2D Pin / Hinge constraint with angular limits and motorized drive.
 */
export class RevoluteJoint2D implements IConstraint2D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody2D;
  public bodyB: RigidBody2D;

  public localAnchorA: Vec2;
  public localAnchorB: Vec2;
  public referenceAngle: number;

  public limit: JointLimit;
  public motor: JointMotor;

  // Solver internal variables
  private rA: Vec2 = new Vec2();
  private rB: Vec2 = new Vec2();
  private linearImpulse: Vec2 = new Vec2();
  private angularImpulse: number = 0;
  private motorImpulse: number = 0;

  // Mass matrix (2x2)
  private k11: number = 0;
  private k12: number = 0;
  private k22: number = 0;
  private angularMass: number = 0;

  constructor(bodyA: RigidBody2D, bodyB: RigidBody2D, options: RevoluteJointOptions2D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = options.localAnchorA?.clone() ?? new Vec2();
    this.localAnchorB = options.localAnchorB?.clone() ?? new Vec2();
    this.referenceAngle = options.referenceAngle ?? (bodyB.angle - bodyA.angle);

    this.limit = {
      lower: options.lowerAngle ?? 0,
      upper: options.upperAngle ?? 0,
      enabled: options.enableLimit ?? false
    };

    this.motor = {
      speed: options.motorSpeed ?? 0,
      maxForce: options.maxMotorTorque ?? 1000,
      enabled: options.enableMotor ?? false
    };
  }

  public getWorldAnchorA(out: Vec2 = new Vec2()): Vec2 {
    const cos = Math.cos(this.bodyA.angle);
    const sin = Math.sin(this.bodyA.angle);
    out.x = this.bodyA.position.x + (this.localAnchorA.x * cos - this.localAnchorA.y * sin);
    out.y = this.bodyA.position.y + (this.localAnchorA.x * sin + this.localAnchorA.y * cos);
    return out;
  }

  public getWorldAnchorB(out: Vec2 = new Vec2()): Vec2 {
    const cos = Math.cos(this.bodyB.angle);
    const sin = Math.sin(this.bodyB.angle);
    out.x = this.bodyB.position.x + (this.localAnchorB.x * cos - this.localAnchorB.y * sin);
    out.y = this.bodyB.position.y + (this.localAnchorB.x * sin + this.localAnchorB.y * cos);
    return out;
  }

  public getJointAngle(): number {
    return this.bodyB.angle - this.bodyA.angle - this.referenceAngle;
  }

  public preSolve(dt: number): void {
    if (!this.enabled || dt <= 0) return;

    this.motorImpulse = 0;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();

    this.rA.set(pA.x - this.bodyA.position.x, pA.y - this.bodyA.position.y);
    this.rB.set(pB.x - this.bodyB.position.x, pB.y - this.bodyB.position.y);

    const mA = this.bodyA.invMass;
    const mB = this.bodyB.invMass;
    const iA = this.bodyA.invInertia;
    const iB = this.bodyB.invInertia;

    // 2x2 K matrix for point-to-point constraint
    this.k11 = mA + mB + this.rA.y * this.rA.y * iA + this.rB.y * this.rB.y * iB;
    this.k12 = -this.rA.x * this.rA.y * iA - this.rB.x * this.rB.y * iB;
    this.k22 = mA + mB + this.rA.x * this.rA.x * iA + this.rB.x * this.rB.x * iB;

    const invAngMass = iA + iB;
    this.angularMass = invAngMass > 0 ? 1.0 / invAngMass : 0;

    // Warm start linear impulses
    if (!this.bodyA.isStatic) {
      this.bodyA.applyImpulse(new Vec2(-this.linearImpulse.x, -this.linearImpulse.y), this.rA, false);
      this.bodyA.angularVelocity -= this.angularImpulse * iA;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.applyImpulse(this.linearImpulse, this.rB, false);
      this.bodyB.angularVelocity += this.angularImpulse * iB;
    }
  }

  public solveVelocity(): void {
    if (!this.enabled) return;

    const iA = this.bodyA.invInertia;
    const iB = this.bodyB.invInertia;

    // 1. Solve Motor
    if (this.motor.enabled) {
      const Cdot = this.bodyB.angularVelocity - this.bodyA.angularVelocity - this.motor.speed;
      let impulse = -this.angularMass * Cdot;
      const oldImpulse = this.motorImpulse;
      const maxImpulse = 0.016 * this.motor.maxForce;
      this.motorImpulse = Math.max(-maxImpulse, Math.min(maxImpulse, this.motorImpulse + impulse));
      impulse = this.motorImpulse - oldImpulse;

      if (!this.bodyA.isStatic) this.bodyA.angularVelocity -= iA * impulse;
      if (!this.bodyB.isStatic) this.bodyB.angularVelocity += iB * impulse;
    }

    // 2. Solve Angular Limit
    if (this.limit.enabled) {
      const angle = this.getJointAngle();
      if (angle <= this.limit.lower || angle >= this.limit.upper) {
        const Cdot = this.bodyB.angularVelocity - this.bodyA.angularVelocity;
        const impulse = -this.angularMass * Cdot;
        this.angularImpulse += impulse;

        if (!this.bodyA.isStatic) this.bodyA.angularVelocity -= iA * impulse;
        if (!this.bodyB.isStatic) this.bodyB.angularVelocity += iB * impulse;
      }
    }

    // 3. Solve Point-to-Point Linear Constraint
    const vAx = this.bodyA.velocity.x - this.bodyA.angularVelocity * this.rA.y;
    const vAy = this.bodyA.velocity.y + this.bodyA.angularVelocity * this.rA.x;
    const vBx = this.bodyB.velocity.x - this.bodyB.angularVelocity * this.rB.y;
    const vBy = this.bodyB.velocity.y + this.bodyB.angularVelocity * this.rB.x;

    const CdotX = vBx - vAx;
    const CdotY = vBy - vAy;

    // Solve 2x2: K * impulse = -Cdot
    const det = this.k11 * this.k22 - this.k12 * this.k12;
    if (Math.abs(det) > 1e-8) {
      const invDet = 1.0 / det;
      const impulseX = -invDet * (this.k22 * CdotX - this.k12 * CdotY);
      const impulseY = -invDet * (-this.k12 * CdotX + this.k11 * CdotY);

      this.linearImpulse.x += impulseX;
      this.linearImpulse.y += impulseY;

      const P = new Vec2(impulseX, impulseY);
      if (!this.bodyA.isStatic) this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), this.rA, false);
      if (!this.bodyB.isStatic) this.bodyB.applyImpulse(P, this.rB, false);
    }
  }

  public solvePosition(_beta: number = 0.2, slop: number = 0.05): boolean {
    if (!this.enabled) return true;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();

    const cx = pB.x - pA.x;
    const cy = pB.y - pA.y;
    const err = Math.sqrt(cx * cx + cy * cy);

    if (err <= slop) return true;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum === 0) return true;

    const impulseX = -cx / invMassSum;
    const impulseY = -cy / invMassSum;

    if (!this.bodyA.isStatic) {
      this.bodyA.position.x -= impulseX * this.bodyA.invMass;
      this.bodyA.position.y -= impulseY * this.bodyA.invMass;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position.x += impulseX * this.bodyB.invMass;
      this.bodyB.position.y += impulseY * this.bodyB.invMass;
    }

    return err <= slop;
  }
}

export interface HingeJointOptions3D {
  localAnchorA?: Vec3;
  localAnchorB?: Vec3;
  localAxisA?: Vec3;
  localAxisB?: Vec3;
  lowerAngle?: number;
  upperAngle?: number;
  enableLimit?: boolean;
  motorSpeed?: number;
  maxMotorTorque?: number;
  enableMotor?: boolean;
}

/**
 * HingeJoint3D - 3D Hinge / Revolute Constraint allowing rotation only along 1 axis.
 */
export class HingeJoint3D implements IConstraint3D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody3D;
  public bodyB: RigidBody3D;

  public localAnchorA: Vec3;
  public localAnchorB: Vec3;
  public localAxisA: Vec3;
  public localAxisB: Vec3;

  public limit: JointLimit;
  public motor: JointMotor;

  private rA: Vec3 = new Vec3();
  private rB: Vec3 = new Vec3();
  private linearImpulse: Vec3 = new Vec3();

  constructor(bodyA: RigidBody3D, bodyB: RigidBody3D, options: HingeJointOptions3D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = options.localAnchorA?.clone() ?? new Vec3();
    this.localAnchorB = options.localAnchorB?.clone() ?? new Vec3();
    this.localAxisA = options.localAxisA?.clone() ?? new Vec3(0, 1, 0);
    this.localAxisB = options.localAxisB?.clone() ?? new Vec3(0, 1, 0);

    this.limit = {
      lower: options.lowerAngle ?? 0,
      upper: options.upperAngle ?? 0,
      enabled: options.enableLimit ?? false
    };

    this.motor = {
      speed: options.motorSpeed ?? 0,
      maxForce: options.maxMotorTorque ?? 1000,
      enabled: options.enableMotor ?? false
    };
  }

  public getWorldAnchorA(out: Vec3 = new Vec3()): Vec3 {
    this.bodyA.orientation.rotateVector(this.localAnchorA, out);
    out.addInPlace(this.bodyA.position);
    return out;
  }

  public getWorldAnchorB(out: Vec3 = new Vec3()): Vec3 {
    this.bodyB.orientation.rotateVector(this.localAnchorB, out);
    out.addInPlace(this.bodyB.position);
    return out;
  }

  public preSolve(dt: number): void {
    if (!this.enabled || dt <= 0) return;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();

    this.rA.set(pA.x - this.bodyA.position.x, pA.y - this.bodyA.position.y, pA.z - this.bodyA.position.z);
    this.rB.set(pB.x - this.bodyB.position.x, pB.y - this.bodyB.position.y, pB.z - this.bodyB.position.z);

    if (!this.bodyA.isStatic) this.bodyA.applyImpulse(this.linearImpulse.clone().scale(-1), this.rA, false);
    if (!this.bodyB.isStatic) this.bodyB.applyImpulse(this.linearImpulse, this.rB, false);
  }

  public solveVelocity(): void {
    if (!this.enabled) return;

    // Linear point-to-point constraint
    const vA = this.bodyA.velocity.clone().addInPlace(this.bodyA.angularVelocity.cross(this.rA));
    const vB = this.bodyB.velocity.clone().addInPlace(this.bodyB.angularVelocity.cross(this.rB));
    const vrel = vB.subInPlace(vA);

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum > 0) {
      const impulse = vrel.scale(-1.0 / invMassSum);
      this.linearImpulse.addInPlace(impulse);
      if (!this.bodyA.isStatic) this.bodyA.applyImpulse(impulse.clone().scale(-1), this.rA, false);
      if (!this.bodyB.isStatic) this.bodyB.applyImpulse(impulse, this.rB, false);
    }
  }

  public solvePosition(beta: number = 0.2, slop: number = 0.05): boolean {
    if (!this.enabled) return true;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();
    const cx = pB.x - pA.x;
    const cy = pB.y - pA.y;
    const cz = pB.z - pA.z;
    const err = Math.sqrt(cx * cx + cy * cy + cz * cz);

    if (err <= slop) return true;

    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum === 0) return true;

    const impulse = new Vec3(-beta * cx / invMassSum, -beta * cy / invMassSum, -beta * cz / invMassSum);
    if (!this.bodyA.isStatic) {
      this.bodyA.position.x -= impulse.x * this.bodyA.invMass;
      this.bodyA.position.y -= impulse.y * this.bodyA.invMass;
      this.bodyA.position.z -= impulse.z * this.bodyA.invMass;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position.x += impulse.x * this.bodyB.invMass;
      this.bodyB.position.y += impulse.y * this.bodyB.invMass;
      this.bodyB.position.z += impulse.z * this.bodyB.invMass;
    }

    return err <= slop;
  }
}
