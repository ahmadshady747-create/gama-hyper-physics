import { Vec2 } from '../../math/vec2';
import { PhysicsWorld2D } from '../engine2d/world2d';
import { Ray2D, RayHit2D } from '../queries/raycast';
import { Capsule2D } from '../shapes/capsule';

export interface CharacterOptions2D {
  radius?: number;
  height?: number;
  maxSlopeAngleDeg?: number;
  stepOffset?: number;
  gravity?: number;
  layerMask?: number;
}

/**
 * KinematicCharacterController2D - High performance 2D Move-and-Slide Character Controller.
 * Supports slope projection, step climbing, ground snapping, jumping, and obstacle deflection.
 */
export class KinematicCharacterController2D {
  public position: Vec2 = new Vec2();
  public velocity: Vec2 = new Vec2();
  public radius: number = 16;
  public height: number = 48;
  public capsule: Capsule2D;

  public maxSlopeAngle: number; // in radians
  public stepOffset: number = 12.0; // max step-up height
  public gravity: number = 980.0;
  public layerMask: number = 0xFFFFFFFF;

  // Runtime State
  public isGrounded: boolean = false;
  public groundNormal: Vec2 = new Vec2(0, -1);
  public isOnSlope: boolean = false;

  private scratchRay: Ray2D = new Ray2D(new Vec2(), new Vec2(), 100);
  private scratchHit: RayHit2D = new RayHit2D();

  constructor(options: CharacterOptions2D = {}) {
    this.radius = options.radius ?? 16;
    this.height = options.height ?? 48;
    this.capsule = new Capsule2D(this.radius, Math.max(0, this.height - this.radius * 2));
    this.maxSlopeAngle = ((options.maxSlopeAngleDeg ?? 45) * Math.PI) / 180.0;
    this.stepOffset = options.stepOffset ?? 12.0;
    this.gravity = options.gravity ?? 980.0;
    this.layerMask = options.layerMask ?? 0xFFFFFFFF;
  }

  public setPosition(x: number, y: number): void {
    this.position.set(x, y);
  }

  public jump(jumpSpeed: number = 400): boolean {
    if (this.isGrounded) {
      this.velocity.y = -jumpSpeed;
      this.isGrounded = false;
      return true;
    }
    return false;
  }

  /**
   * Main Kinematic Move-and-Slide loop.
   */
  public moveAndSlide(inputVelocity: Vec2, dt: number, world: PhysicsWorld2D): void {
    this.velocity.x = inputVelocity.x;
    if (inputVelocity.y !== 0) {
      this.velocity.y = inputVelocity.y;
    } else if (!this.isGrounded) {
      this.velocity.y += this.gravity * dt;
    }

    let remainingMove = new Vec2(this.velocity.x * dt, this.velocity.y * dt);
    let iterations = 4;

    while (iterations > 0 && remainingMove.magSq() > 1e-6) {
      iterations--;
      const moveDist = remainingMove.length();
      const moveDir = new Vec2(remainingMove.x / moveDist, remainingMove.y / moveDist);

      // Probe ray forward along movement direction
      this.scratchRay.origin.copy(this.position);
      this.scratchRay.direction.copy(moveDir);
      this.scratchRay.maxDistance = moveDist + this.radius;
      this.scratchRay.layerMask = this.layerMask;

      const hitFound = world.raycast(this.scratchRay, this.scratchHit);

      if (hitFound && this.scratchHit.distance <= moveDist + this.radius) {
        const allowedDist = Math.max(0, this.scratchHit.distance - this.radius - 0.05);
        this.position.x += moveDir.x * allowedDist;
        this.position.y += moveDir.y * allowedDist;

        // Step-climbing check: if blocked horizontally while moving forward on ground
        if (this.isGrounded && Math.abs(this.scratchHit.normal.x) > 0.7 && remainingMove.y >= 0) {
          const stepUpPos = new Vec2(this.position.x, this.position.y - this.stepOffset);
          this.scratchRay.origin.copy(stepUpPos);
          this.scratchRay.direction.set(moveDir.x > 0 ? 1 : -1, 0);
          this.scratchRay.maxDistance = this.radius + 5;
          const stepBlocked = world.raycast(this.scratchRay, this.scratchHit);

          if (!stepBlocked) {
            // Climb step
            this.position.y -= this.stepOffset * 0.5;
            remainingMove.x *= 0.5;
            continue;
          }
        }

        // Project remaining movement along obstacle tangent
        const normal = this.scratchHit.normal;
        const dot = remainingMove.x * normal.x + remainingMove.y * normal.y;
        remainingMove.x -= normal.x * dot;
        remainingMove.y -= normal.y * dot;

        // Clip velocity against plane
        const vDot = this.velocity.x * normal.x + this.velocity.y * normal.y;
        if (vDot < 0) {
          this.velocity.x -= normal.x * vDot;
          this.velocity.y -= normal.y * vDot;
        }
      } else {
        // Full uninhibited movement
        this.position.x += remainingMove.x;
        this.position.y += remainingMove.y;
        remainingMove.set(0, 0);
      }
    }

    // Ground Check Probe
    this.checkGround(world);
  }

  private checkGround(world: PhysicsWorld2D): void {
    this.scratchRay.origin.set(this.position.x, this.position.y);
    this.scratchRay.direction.set(0, 1);
    this.scratchRay.maxDistance = this.radius + 4.0;
    this.scratchRay.layerMask = this.layerMask;

    const hit = world.raycast(this.scratchRay, this.scratchHit);

    if (hit && this.scratchHit.distance <= this.radius + 4.0 && this.scratchHit.normal.y < -0.5) {
      this.isGrounded = true;
      this.groundNormal.copy(this.scratchHit.normal);

      // Snap to ground surface
      this.position.y = this.scratchHit.point.y - this.radius;
      if (this.velocity.y > 0) this.velocity.y = 0;

      const slopeAngle = Math.acos(Math.max(-1, Math.min(1, -this.groundNormal.y)));
      this.isOnSlope = slopeAngle > 0.05 && slopeAngle <= this.maxSlopeAngle;
    } else {
      this.isGrounded = false;
      this.isOnSlope = false;
      this.groundNormal.set(0, -1);
    }
  }
}
