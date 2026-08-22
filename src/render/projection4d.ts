import { Vec4 } from '../math/vec4';
import { Vec3 } from '../math/vec3';

/**
 * Projection4D - Dual Stage Hyper-Dimensional Projector (4D -> 3D -> 2D).
 * Features Zero-NaN Singularity Guards and Hyper-Depth Chromatic Encoding.
 */
export class Projection4D {
  public hyperDistance: number = 400; // Viewing distance in the 4th dimension
  public sliceW: number = 0; // Current hyperplane slicing position

  constructor(hyperDistance: number = 400) {
    this.hyperDistance = hyperDistance;
  }

  /**
   * Projects a 4D Hyper-Point into 3D Space via w-Perspective:
   * x' = (x * d) / (d - w)
   * y' = (y * d) / (d - w)
   * z' = (z * d) / (d - w)
   * Includes strict singularity guard |d - w| > 0.05.
   */
  public project4DTo3D(v4: Vec4, out: Vec3): Vec3 {
    const d = this.hyperDistance;
    const denom = d - v4.w;

    let scale = 1.0;
    if (Math.abs(denom) > 0.05 && denom != 0) {
      scale = d / denom;
    } else {
      scale = denom >= 0 ? (d / 0.05) : -(d / 0.05);
    }

    out?.set(v4.x * scale, v4.y * scale, v4.z * scale);
    return out;
  }

  /**
   * Returns a glowing neon color shift based on 4D w-depth:
   * -w: Cyan (#38bdf8) -> 0: Purple (#c084fc) -> +w: Pink/Magenta (#f472b6)
   */
  public getDepthCueColor(w: number, baseAlpha: number = 0.8): string {
    const normalized = Math.max(-1.0, Math.min(1.0, w / (this.hyperDistance * 0.5)));

    let r = 56, g = 189, b = 248; // Cyan
    if (normalized > 0) {
      // Interpolate Purple -> Magenta
      const t = normalized;
      r = Math.round(192 + (244 - 192) * t);
      g = Math.round(132 + (114 - 132) * t);
      b = Math.round(252 + (182 - 252) * t);
    } else {
      // Interpolate Cyan -> Purple
      const t = 1.0 + normalized;
      r = Math.round(56 + (192 - 56) * t);
      g = Math.round(189 + (132 - 189) * t);
      b = Math.round(248 + (252 - 248) * t);
    }

    return `rgba(${r}, ${g}, ${b}, ${baseAlpha.toFixed(2)})`;
  }
}
