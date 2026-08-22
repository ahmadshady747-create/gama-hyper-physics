import { Vec2 } from '../../math/vec2';
import { Vec3 } from '../../math/vec3';
import { RigidBody2D } from '../engine2d/body2d';
import { RigidBody3D } from '../engine3d/body3d';
import { IConstraint2D, IConstraint3D } from './types';

let nextJointId = 1;

export interface DistanceJointOptions2D {
  localAnchorA?: Vec2;
  localAnchorB?: Vec2;
  length?: number;
  frequencyHz?: number; // 0 = rigid, >0 = soft spring
  dampingRatio?: number; // 0 = no damping, 1 = critical damping
}

/**
 * DistanceJoint2D - Rigid or Soft Spring distance constraint between two 2D rigid bodies.
 */
export class DistanceJoint2D implements IConstraint2D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody2D;
  public bodyB: RigidBody2D;

  public localAnchorA: Vec2;
  public localAnchorB: Vec2;
  public length: number;

  public frequencyHz: number;
  public dampingRatio: number;

  // Solver internal state
  private u: Vec2 = new Vec2();
  private rA: Vec2 = new Vec2();
  private rB: Vec2 = new Vec2();
  private mass: number = 0;
  private impulse: number = 0;
  private gamma: number = 0;
  private bias: number = 0;

  constructor(bodyA: RigidBody2D, bodyB: RigidBody2D, options: DistanceJointOptions2D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = options.localAnchorA?.clone() ?? new Vec2();
    this.localAnchorB = options.localAnchorB?.clone() ?? new Vec2();

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();
    this.length = options.length !== undefined ? options.length : pA.dist(pB);
    this.frequencyHz = options.frequencyHz ?? 0;
    this.dampingRatio = options.dampingRatio ?? 0.7;
  }

  public getWorldAnchorA(out: Vec2 = new Vec2()): Vec2 {
    const cos = Math.cos(this.bodyA.angle);
    const sin = Math.sin(this.bodyA.angle);
    const lx = this.localAnchorA.x;
    const ly = this.localAnchorA.y;
    out.x = this.bodyA.position.x + (lx * cos - ly * sin);
    out.y = this.bodyA.position.y + (lx * sin + ly * cos);
    return out;
  }

  public getWorldAnchorB(out: Vec2 = new Vec2()): Vec2 {
    const cos = Math.cos(this.bodyB.angle);
    const sin = Math.sin(this.bodyB.angle);
    const lx = this.localAnchorB.x;
    const ly = this.localAnchorB.y;
    out.x = this.bodyB.position.x + (lx * cos - ly * sin);
    out.y = this.bodyB.position.y + (lx * sin + ly * cos);
    return out;
  }

  public preSolve(dt: number): void {
    if (!this.enabled || dt <= 0) return;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();

    this.rA.set(pA.x - this.bodyA.position.x, pA.y - this.bodyA.position.y);
    this.rB.set(pB.x - this.bodyB.position.x, pB.y - this.bodyB.position.y);

    const dX = pB.x - pA.x;
    const dY = pB.y - pA.y;
    const currentLen = Math.sqrt(dX * dX + dY * dY);

    if (currentLen > 1e-6) {
      this.u.set(dX / currentLen, dY / currentLen);
    } else {
      this.u.set(0, 0);
    }

    const crA = this.rA.x * this.u.y - this.rA.y * this.u.x;
    const crB = this.rB.x * this.u.y - this.rB.y * this.u.x;

    const invMassA = this.bodyA.invMass;
    const invMassB = this.bodyB.invMass;
    const invIA = this.bodyA.invInertia;
    const invIB = this.bodyB.invInertia;

    let K = invMassA + invMassB + invIA * crA * crA + invIB * crB * crB;

    // Soft spring formulation
    if (this.frequencyHz > 0 && K > 1e-8) {
      const C = currentLen - this.length;
      const omega = 2.0 * Math.PI * this.frequencyHz;
      const d = 2.0 * (1.0 / K) * this.dampingRatio * omega;
      const k = (1.0 / K) * omega * omega;

      this.gamma = dt * (d + dt * k);
      this.gamma = this.gamma > 0 ? 1.0 / this.gamma : 0;
      this.bias = C * dt * k * this.gamma;

      K += this.gamma;
      this.mass = K > 0 ? 1.0 / K : 0;
    } else {
      this.gamma = 0;
      this.bias = 0;
      this.mass = K > 0 ? 1.0 / K : 0;
    }

    // Warm start with previous frame impulse
    const Px = this.u.x * this.impulse;
    const Py = this.u.y * this.impulse;
    const P = new Vec2(Px, Py);

    if (!this.bodyA.isStatic) {
      this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), this.rA, false);
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.applyImpulse(P, this.rB, false);
    }
  }

  public solveVelocity(): void {
    if (!this.enabled) return;

    // v_rel = (vB + wB x rB) - (vA + wA x rA)
    const vAx = this.bodyA.velocity.x - this.bodyA.angularVelocity * this.rA.y;
    const vAy = this.bodyA.velocity.y + this.bodyA.angularVelocity * this.rA.x;
    const vBx = this.bodyB.velocity.x - this.bodyB.angularVelocity * this.rB.y;
    const vBy = this.bodyB.velocity.y + this.bodyB.angularVelocity * this.rB.x;

    const Cdot = (vBx - vAx) * this.u.x + (vBy - vAy) * this.u.y;
    const impulse = -this.mass * (Cdot + this.bias + this.gamma * this.impulse);
    this.impulse += impulse;

    const Px = this.u.x * impulse;
    const Py = this.u.y * impulse;
    const P = new Vec2(Px, Py);

    if (!this.bodyA.isStatic) {
      this.bodyA.applyImpulse(new Vec2(-P.x, -P.y), this.rA, false);
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.applyImpulse(P, this.rB, false);
    }
  }

  public solvePosition(beta: number = 0.2, slop: number = 0.05): boolean {
    if (!this.enabled || this.frequencyHz > 0) return true;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();

    const dX = pB.x - pA.x;
    const dY = pB.y - pA.y;
    const currentLen = Math.sqrt(dX * dX + dY * dY);

    if (currentLen < 1e-6) return true;

    const uX = dX / currentLen;
    const uY = dY / currentLen;
    const C = currentLen - this.length;

    if (Math.abs(C) <= slop) return true;

    const rAx = pA.x - this.bodyA.position.x;
    const rAy = pA.y - this.bodyA.position.y;
    const rBx = pB.x - this.bodyB.position.x;
    const rBy = pB.y - this.bodyB.position.y;

    const crA = rAx * uY - rAy * uX;
    const crB = rBx * uY - rBy * uX;

    const K = this.bodyA.invMass + this.bodyB.invMass + this.bodyA.invInertia * crA * crA + this.bodyB.invInertia * crB * crB;
    if (K === 0) return true;

    const impulse = -beta * C / K;
    const Px = uX * impulse;
    const Py = uY * impulse;

    if (!this.bodyA.isStatic) {
      this.bodyA.position.x -= Px * this.bodyA.invMass;
      this.bodyA.position.y -= Py * this.bodyA.invMass;
      this.bodyA.angle -= crA * impulse * this.bodyA.invInertia;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position.x += Px * this.bodyB.invMass;
      this.bodyB.position.y += Py * this.bodyB.invMass;
      this.bodyB.angle += crB * impulse * this.bodyB.invInertia;
    }

    return Math.abs(C) <= slop;
  }
}

export interface DistanceJointOptions3D {
  localAnchorA?: Vec3;
  localAnchorB?: Vec3;
  length?: number;
  frequencyHz?: number;
  dampingRatio?: number;
}

/**
 * DistanceJoint3D - Rigid or Soft Spring distance constraint between two 3D rigid bodies.
 */
export class DistanceJoint3D implements IConstraint3D {
  public id: number;
  public enabled: boolean = true;
  public bodyA: RigidBody3D;
  public bodyB: RigidBody3D;

  public localAnchorA: Vec3;
  public localAnchorB: Vec3;
  public length: number;

  public frequencyHz: number;
  public dampingRatio: number;

  private u: Vec3 = new Vec3();
  private rA: Vec3 = new Vec3();
  private rB: Vec3 = new Vec3();
  private mass: number = 0;
  private impulse: number = 0;
  private gamma: number = 0;
  private bias: number = 0;

  constructor(bodyA: RigidBody3D, bodyB: RigidBody3D, options: DistanceJointOptions3D = {}) {
    this.id = nextJointId++;
    this.bodyA = bodyA;
    this.bodyB = bodyB;

    this.localAnchorA = options.localAnchorA?.clone() ?? new Vec3();
    this.localAnchorB = options.localAnchorB?.clone() ?? new Vec3();

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();
    this.length = options.length !== undefined ? options.length : pA.dist(pB);
    this.frequencyHz = options.frequencyHz ?? 0;
    this.dampingRatio = options.dampingRatio ?? 0.7;
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

    const dX = pB.x - pA.x;
    const dY = pB.y - pA.y;
    const dZ = pB.z - pA.z;
    const currentLen = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

    if (currentLen > 1e-6) {
      this.u.set(dX / currentLen, dY / currentLen, dZ / currentLen);
    } else {
      this.u.set(0, 1, 0);
    }

    const crA = this.rA.cross(this.u);
    const crB = this.rB.cross(this.u);

    const iRaU = new Vec3(
      this.bodyA.worldInvInertia[0].dot(crA),
      this.bodyA.worldInvInertia[1].dot(crA),
      this.bodyA.worldInvInertia[2].dot(crA)
    );
    const iRbU = new Vec3(
      this.bodyB.worldInvInertia[0].dot(crB),
      this.bodyB.worldInvInertia[1].dot(crB),
      this.bodyB.worldInvInertia[2].dot(crB)
    );

    const angA = iRaU.cross(this.rA).dot(this.u);
    const angB = iRbU.cross(this.rB).dot(this.u);
    let K = this.bodyA.invMass + this.bodyB.invMass + angA + angB;

    if (this.frequencyHz > 0 && K > 1e-8) {
      const C = currentLen - this.length;
      const omega = 2.0 * Math.PI * this.frequencyHz;
      const d = 2.0 * (1.0 / K) * this.dampingRatio * omega;
      const k = (1.0 / K) * omega * omega;

      this.gamma = dt * (d + dt * k);
      this.gamma = this.gamma > 0 ? 1.0 / this.gamma : 0;
      this.bias = C * dt * k * this.gamma;

      K += this.gamma;
      this.mass = K > 0 ? 1.0 / K : 0;
    } else {
      this.gamma = 0;
      this.bias = 0;
      this.mass = K > 0 ? 1.0 / K : 0;
    }

    const P = this.u.clone().scale(this.impulse);
    if (!this.bodyA.isStatic) this.bodyA.applyImpulse(P.clone().scale(-1), this.rA, false);
    if (!this.bodyB.isStatic) this.bodyB.applyImpulse(P, this.rB, false);
  }

  public solveVelocity(): void {
    if (!this.enabled) return;

    const vA = this.bodyA.velocity.clone().addInPlace(this.bodyA.angularVelocity.cross(this.rA));
    const vB = this.bodyB.velocity.clone().addInPlace(this.bodyB.angularVelocity.cross(this.rB));
    const vrel = vB.subInPlace(vA);

    const Cdot = vrel.dot(this.u);
    const impulse = -this.mass * (Cdot + this.bias + this.gamma * this.impulse);
    this.impulse += impulse;

    const P = this.u.clone().scale(impulse);
    if (!this.bodyA.isStatic) this.bodyA.applyImpulse(P.clone().scale(-1), this.rA, false);
    if (!this.bodyB.isStatic) this.bodyB.applyImpulse(P, this.rB, false);
  }

  public solvePosition(beta: number = 0.2, slop: number = 0.05): boolean {
    if (!this.enabled || this.frequencyHz > 0) return true;

    const pA = this.getWorldAnchorA();
    const pB = this.getWorldAnchorB();
    const dX = pB.x - pA.x;
    const dY = pB.y - pA.y;
    const dZ = pB.z - pA.z;
    const currentLen = Math.sqrt(dX * dX + dY * dY + dZ * dZ);

    if (currentLen < 1e-6) return true;
    const C = currentLen - this.length;
    if (Math.abs(C) <= slop) return true;

    const u = new Vec3(dX / currentLen, dY / currentLen, dZ / currentLen);
    const invMassSum = this.bodyA.invMass + this.bodyB.invMass;
    if (invMassSum === 0) return true;

    const impulse = -beta * C / invMassSum;
    const P = u.scale(impulse);

    if (!this.bodyA.isStatic) {
      this.bodyA.position.x -= P.x * this.bodyA.invMass;
      this.bodyA.position.y -= P.y * this.bodyA.invMass;
      this.bodyA.position.z -= P.z * this.bodyA.invMass;
    }
    if (!this.bodyB.isStatic) {
      this.bodyB.position.x += P.x * this.bodyB.invMass;
      this.bodyB.position.y += P.y * this.bodyB.invMass;
      this.bodyB.position.z += P.z * this.bodyB.invMass;
    }

    return Math.abs(C) <= slop;
  }
}

/** Convenience SpringJoint2D */
export class SpringJoint2D extends DistanceJoint2D {
  constructor(bodyA: RigidBody2D, bodyB: RigidBody2D, frequencyHz: number = 4.0, dampingRatio: number = 0.5) {
    super(bodyA, bodyB, { frequencyHz, dampingRatio });
  }
}

/** Convenience SpringJoint3D */
export class SpringJoint3D extends DistanceJoint3D {
  constructor(bodyA: RigidBody3D, bodyB: RigidBody3D, frequencyHz: number = 4.0, dampingRatio: number = 0.5) {
    super(bodyA, bodyB, { frequencyHz, dampingRatio });
  }
}
