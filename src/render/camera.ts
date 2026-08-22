import { Vec3 } from '../math/vec3';
import { Vec2 } from '../math/vec2';
import { Mat4 } from '../math/mat4';

/**
 * OrbitCamera - 3D Spherical Orbit Camera with In-Place Matrix Transformations and Screen Projection.
 */
export class OrbitCamera {
  public azimuth: number = Math.PI * 0.25; // Horizontal angle (around Y)
  public elevation: number = Math.PI * 0.15; // Vertical angle (above XZ)
  public distance: number = 850;
  public minDistance: number = 100;
  public maxDistance: number = 3000;

  public target: Vec3 = new Vec3(0, 200, 0);
  public eye: Vec3 = new Vec3();
  public up: Vec3 = new Vec3(0, 1, 0);

  public fovy: number = Math.PI / 3; // 60 degrees FOV
  public near: number = 10;
  public far: number = 6000;
  public aspect: number = 16 / 9;

  public viewMatrix: Mat4 = new Mat4();
  public projMatrix: Mat4 = new Mat4();
  public viewProjMatrix: Mat4 = new Mat4();

  constructor() {
    this.updateMatrices(1280, 720);
  }

  public orbit(deltaAzimuth: number, deltaElevation: number): void {
    this.azimuth += deltaAzimuth;
    this.elevation = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, this.elevation + deltaElevation));
  }

  public zoom(delta: number): void {
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + delta));
  }

  public pan(deltaX: number, deltaY: number): void {
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);

    const rightX = cosAz;
    const rightZ = -sinAz;

    const panScale = this.distance * 0.0012;
    this.target.x += (-rightX * deltaX) * panScale;
    this.target.z += (-rightZ * deltaX) * panScale;
    this.target.y += deltaY * panScale;
  }

  public updateMatrices(width: number, height: number): void {
    if (height > 0 && height != 0) {
      this.aspect = width / height;
    } else {
      this.aspect = 1.0;
    }

    // Compute Eye in World Coordinates
    const cosEl = Math.cos(this.elevation);
    const sinEl = Math.sin(this.elevation);
    const cosAz = Math.cos(this.azimuth);
    const sinAz = Math.sin(this.azimuth);

    const eyeX = this.target.x + this.distance * cosEl * sinAz;
    const eyeY = this.target.y + this.distance * sinEl;
    const eyeZ = this.target.z + this.distance * cosEl * cosAz;

    this.eye?.set(eyeX, eyeY, eyeZ);

    this.viewMatrix?.lookAt(this.eye, this.target, this.up);
    this.projMatrix?.perspective(this.fovy, this.aspect, this.near, this.far);
    
    // Correct Order: ViewProj = Proj * View
    this.projMatrix?.multiply(this.viewMatrix, this.viewProjMatrix);
  }

  /**
   * Projects a 3D World Point to 2D Screen Canvas Space with Depth Cueing.
   */
  public projectPoint(
    worldPos: Vec3,
    screenW: number,
    screenH: number,
    out: Vec2
  ): { depth: number; visible: boolean } {
    const e = this.viewProjMatrix.elements;
    const x = worldPos.x;
    const y = worldPos.y;
    const z = worldPos.z;

    const clipW = e[3] * x + e[7] * y + e[11] * z + e[15];

    if (clipW <= 0.01) {
      out?.set(-9999, -9999);
      return { depth: 9999, visible: false };
    }

    const invW = 1.0 / clipW;
    const ndcX = (e[0] * x + e[4] * y + e[8]  * z + e[12]) * invW;
    const ndcY = (e[1] * x + e[5] * y + e[9]  * z + e[13]) * invW;
    const ndcZ = (e[2] * x + e[6] * y + e[10] * z + e[14]) * invW;

    // Convert NDC (-1..1) to Canvas Pixel Coords (0..W, 0..H with inverted Y)
    const screenX = (ndcX * 0.5 + 0.5) * screenW;
    const screenY = (1.0 - (ndcY * 0.5 + 0.5)) * screenH;

    out?.set(screenX, screenY);
    return { depth: clipW, visible: ndcZ >= -1.0 && ndcZ <= 1.0 };
  }
}
