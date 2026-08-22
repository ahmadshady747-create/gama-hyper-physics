import { Vec3 } from '../../math/vec3';
import { Quat } from '../../math/quat';
import { PhysicsWorld3D } from '../engine3d/world3d';
import { Ray3D, RayHit3D } from '../queries/raycast';
import { Capsule3D } from '../shapes/capsule';

export interface CharacterOptions3D {
  radius?: number;
  height?: number;
  maxSlopeAngleDeg?: number;
  stepOffset?: number;
  gravity?: number;
  layerMask?: number;
}

/**
 * KinematicCharacterController3D - 3D Move-and-Slide Character Controller.
 */
export class KinematicCharacterController3D {
  public position: Vec3 = new Vec3();
  public velocity: Vec3 = new Vec3();
  public orientation: Quat = new Quat();
  public radius: number = 16;
  public height: number = 48;
  public capsule: Capsule3D;

  public maxSlopeAngle: number;
  public stepOffset: number = 12.0;
  public gravity: number = 980.0;
  public layerMask: number = 0xFFFFFFFF;

  public isGrounded: boolean = false;
  public groundNormal: Vec3 = new Vec3(0, 1, 0);

  private scratchRay: Ray3D = new Ray3D(new Vec3(), new Vec3(), 100);
  private scratchHit: RayHit3D = new RayHit3D();

  constructor(options: CharacterOptions3D = {}) {
    this.radius = options.radius ?? 16;
    this.height = options.height ?? 48;
    this.capsule = new Capsule3D(this.radius, Math.max(0, this.height - this.radius * 2));
    this.maxSlopeAngle = ((options.maxSlopeAngleDeg ?? 45) * Math.PI) / 180.0;
    this.stepOffset = options.stepOffset ?? 12.0;
    this.gravity = options.gravity ?? 980.0;
    this.layerMask = options.layerMask ?? 0xFFFFFFFF;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  public jump(jumpSpeed: number = 400): boolean {
    if (this.isGrounded) {
      this.velocity.y = jumpSpeed;
      this.isGrounded = false;
      return true;
    }
    return false;
  }

  public moveAndSlide(inputVelocity: Vec3, dt: number, world: PhysicsWorld3D): void {
    this.velocity.x = inputVelocity.x;
    this.velocity.z = inputVelocity.z;

    if (inputVelocity.y !== 0) {
      this.velocity.y = inputVelocity.y;
    } else if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    let remainingMove = new Vec3(this.velocity.x * dt, this.velocity.y * dt, this.velocity.z * dt);
    let iterations = 4;

    while (iterations > 0 && remainingMove.magSq() > 1e-6) {
      iterations--;
      const moveDist = remainingMove.length();
      const moveDir = new Vec3(remainingMove.x / moveDist, remainingMove.y / moveDist, remainingMove.z / moveDist);

      this.scratchRay.origin.copy(this.position);
      this.scratchRay.direction.copy(moveDir);
      this.scratchRay.maxDistance = moveDist + this.radius;
      this.scratchRay.layerMask = this.layerMask;

      const hit = world.raycast(this.scratchRay, this.scratchHit);

      if (hit && this.scratchHit.distance <= moveDist + this.radius) {
        const allowedDist = Math.max(0, this.scratchHit.distance - this.radius - 0.05);
        this.position.x += moveDir.x * allowedDist;
        this.position.y += moveDir.y * allowedDist;
        this.position.z += moveDir.z * allowedDist;

        // Plane deflection
        const normal = this.scratchHit.normal;
        const dot = remainingMove.dot(normal);
        remainingMove.x -= normal.x * dot;
        remainingMove.y -= normal.y * dot;
        remainingMove.z -= normal.z * dot;

        const vDot = this.velocity.dot(normal);
        if (vDot < 0) {
          this.velocity.x -= normal.x * vDot;
          this.velocity.y -= normal.y * vDot;
          this.velocity.z -= normal.z * vDot;
        }
      } else {
        this.position.x += remainingMove.x;
        this.position.y += remainingMove.y;
        this.position.z += remainingMove.z;
        remainingMove.set(0, 0, 0);
      }
    }

    this.checkGround(world);
  }

  private checkGround(world: PhysicsWorld3D): void {
    this.scratchRay.origin.copy(this.position);
    this.scratchRay.direction.set(0, -1, 0);
    this.scratchRay.maxDistance = this.radius + 4.0;
    this.scratchRay.layerMask = this.layerMask;

    const hit = world.raycast(this.scratchRay, this.scratchHit);

    if (hit && this.scratchHit.distance <= this.radius + 4.0 && this.scratchHit.normal.y > 0.5) {
      this.isGrounded = true;
      this.groundNormal.copy(this.scratchHit.normal);

      this.position.y = this.scratchHit.point.y + this.radius;
      if (this.velocity.y < 0) this.velocity.y = 0;
    } else {
      this.isGrounded = false;
      this.groundNormal.set(0, 1, 0);
    }
  }
}
