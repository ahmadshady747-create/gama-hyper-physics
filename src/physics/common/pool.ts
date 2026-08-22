import { Vec3 } from '../../math/vec3';
import { Vec4 } from '../../math/vec4';

/**
 * Particle3D - Pre-allocated 3D Spark / Debris object.
 */
export class Particle3D {
  public position: Vec3 = new Vec3();
  public velocity: Vec3 = new Vec3();
  public color: string = '#f59e0b';
  public size: number = 3;
  public initialSize: number = 3;
  public life: number = 0;
  public maxLife: number = 1.0;
  public alpha: number = 1.0;
  public active: boolean = false;
  public drag: number = 0.98;

  public reset(): void {
    this.position?.set(0, 0, 0);
    this.velocity?.set(0, 0, 0);
    this.color = '#f59e0b';
    this.size = 3;
    this.initialSize = 3;
    this.life = 0;
    this.maxLife = 1.0;
    this.alpha = 1.0;
    this.active = false;
    this.drag = 0.98;
  }
}

/**
 * ParticlePool3D - Zero-GC 3D Particle Pool.
 */
export class ParticlePool3D {
  public particles: Particle3D[] = [];
  public capacity: number;
  private head: number = 0;
  public activeCount: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      this.particles?.push(new Particle3D());
    }
  }

  public emit(
    pos: Vec3,
    count: number,
    color: string = '#38bdf8',
    speed: number = 200,
    life: number = 0.8,
    size: number = 3.5
  ): void {
    const total = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles.at(this.head);
      this.head = (this.head + 1) % total;
      if (!p) continue;

      // Random 3D spherical direction
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const sinPhi = Math.sin(phi);

      const vx = Math.cos(theta) * sinPhi;
      const vy = Math.sin(theta) * sinPhi;
      const vz = Math.cos(phi);
      const velMag = speed * (0.4 + Math.random() * 0.8);

      p.position?.copy(pos);
      p.velocity?.set(vx * velMag, vy * velMag, vz * velMag);
      p.color = color;
      p.initialSize = size * (0.6 + Math.random() * 0.8);
      p.size = p.initialSize;
      p.maxLife = life * (0.5 + Math.random() * 0.7);
      p.life = p.maxLife;
      p.alpha = 1.0;
      p.active = true;
      p.drag = 0.96 + Math.random() * 0.03;
    }
  }

  public emitImpactSparks(pos: Vec3, normal: Vec3, count: number = 8, color: string = '#fbbf24'): void {
    const total = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles.at(this.head);
      this.head = (this.head + 1) % total;
      if (!p) continue;

      // Reflective cone around collision normal
      const rx = normal.x + (Math.random() - 0.5) * 0.8;
      const ry = normal.y + (Math.random() - 0.5) * 0.8;
      const rz = normal.z + (Math.random() - 0.5) * 0.8;
      const velMag = 180 * (0.5 + Math.random() * 0.8);

      p.position?.copy(pos);
      p.velocity?.set(rx * velMag, ry * velMag, rz * velMag);
      p.color = color;
      p.initialSize = 3.0;
      p.size = 3.0;
      p.maxLife = 0.45;
      p.life = 0.45;
      p.alpha = 1.0;
      p.active = true;
      p.drag = 0.95;
    }
  }

  public emitExplosion(pos: Vec3, count: number = 60, speed: number = 350): void {
    this.emit(pos, Math.floor(count * 0.5), '#ef4444', speed * 1.2, 1.0, 5.0);
    this.emit(pos, Math.floor(count * 0.3), '#f59e0b', speed * 0.9, 0.7, 4.0);
    this.emit(pos, Math.floor(count * 0.2), '#38bdf8', speed * 0.6, 0.5, 3.0);
  }

  public update(dt: number, gravity: Vec3): void {
    let active = 0;
    const len = this.particles.length;

    for (let i = 0; i < len; i++) {
      const p = this.particles.at(i);
      if (!p || !p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      active++;

      const vel = p.velocity;
      vel?.addScaledInPlace(gravity, dt * 0.3);
      vel?.scaleInPlace(p.drag);

      const pos = p.position;
      pos?.addScaledInPlace(vel, dt);

      const maxL = p.maxLife;
      if (maxL > 1e-6 && maxL != 0) {
        const ratio = Math.max(0, p.life / maxL);
        p.alpha = ratio;
        p.size = p.initialSize * ratio;
      }
    }

    this.activeCount = active;
  }

  public clear(): void {
    const len = this.particles.length;
    for (let i = 0; i < len; i++) {
      const p = this.particles.at(i);
      if (p) p.active = false;
    }
    this.activeCount = 0;
  }
}

/**
 * Particle4D - Pre-allocated 4D Hyper-Spark object.
 */
export class Particle4D {
  public position: Vec4 = new Vec4();
  public velocity: Vec4 = new Vec4();
  public color: string = '#c084fc';
  public size: number = 3;
  public initialSize: number = 3;
  public life: number = 0;
  public maxLife: number = 1.0;
  public alpha: number = 1.0;
  public active: boolean = false;
  public drag: number = 0.98;

  public reset(): void {
    this.position?.set(0, 0, 0, 0);
    this.velocity?.set(0, 0, 0, 0);
    this.color = '#c084fc';
    this.size = 3;
    this.initialSize = 3;
    this.life = 0;
    this.maxLife = 1.0;
    this.alpha = 1.0;
    this.active = false;
    this.drag = 0.98;
  }
}

/**
 * ParticlePool4D - Zero-GC 4D Hyper-Particle Pool.
 */
export class ParticlePool4D {
  public particles: Particle4D[] = [];
  public capacity: number;
  private head: number = 0;
  public activeCount: number = 0;

  constructor(capacity: number = 1000) {
    this.capacity = capacity;
    for (let i = 0; i < capacity; i++) {
      this.particles?.push(new Particle4D());
    }
  }

  public emit(
    pos: Vec4,
    count: number,
    color: string = '#c084fc',
    speed: number = 200,
    life: number = 0.8,
    size: number = 3.5
  ): void {
    const total = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles.at(this.head);
      this.head = (this.head + 1) % total;
      if (!p) continue;

      // 4D Gaussian random direction
      let x = (Math.random() - 0.5) * 2;
      let y = (Math.random() - 0.5) * 2;
      let z = (Math.random() - 0.5) * 2;
      let w = (Math.random() - 0.5) * 2;
      const mSq = x * x + y * y + z * z + w * w;

      if (mSq > 1e-6) {
        const invM = 1.0 / Math.sqrt(mSq);
        x *= invM;
        y *= invM;
        z *= invM;
        w *= invM;
      }

      const velMag = speed * (0.4 + Math.random() * 0.8);

      p.position?.copy(pos);
      p.velocity?.set(x * velMag, y * velMag, z * velMag, w * velMag);
      p.color = color;
      p.initialSize = size * (0.6 + Math.random() * 0.8);
      p.size = p.initialSize;
      p.maxLife = life * (0.5 + Math.random() * 0.7);
      p.life = p.maxLife;
      p.alpha = 1.0;
      p.active = true;
      p.drag = 0.96 + Math.random() * 0.03;
    }
  }

  public emitImpactSparks(pos: Vec4, normal: Vec4, count: number = 8, color: string = '#fbbf24'): void {
    const total = this.particles.length;
    for (let i = 0; i < count; i++) {
      const p = this.particles.at(this.head);
      this.head = (this.head + 1) % total;
      if (!p) continue;

      const rx = normal.x + (Math.random() - 0.5) * 0.6;
      const ry = normal.y + (Math.random() - 0.5) * 0.6;
      const rz = normal.z + (Math.random() - 0.5) * 0.6;
      const rw = normal.w + (Math.random() - 0.5) * 0.6;
      const velMag = 160 * (0.5 + Math.random() * 0.8);

      p.position?.copy(pos);
      p.velocity?.set(rx * velMag, ry * velMag, rz * velMag, rw * velMag);
      p.color = color;
      p.initialSize = 3.0;
      p.size = 3.0;
      p.maxLife = 0.45;
      p.life = 0.45;
      p.alpha = 1.0;
      p.active = true;
      p.drag = 0.95;
    }
  }

  public emitExplosion(pos: Vec4, count: number = 60, speed: number = 320): void {
    this.emit(pos, Math.floor(count * 0.5), '#f43f5e', speed * 1.2, 1.0, 5.0);
    this.emit(pos, Math.floor(count * 0.3), '#c084fc', speed * 0.9, 0.7, 4.0);
    this.emit(pos, Math.floor(count * 0.2), '#38bdf8', speed * 0.6, 0.5, 3.0);
  }

  public update(dt: number, gravity: Vec4): void {
    let active = 0;
    const len = this.particles.length;

    for (let i = 0; i < len; i++) {
      const p = this.particles.at(i);
      if (!p || !p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      active++;

      const vel = p.velocity;
      vel?.addScaledInPlace(gravity, dt * 0.3);
      vel?.scaleInPlace(p.drag);

      const pos = p.position;
      pos?.addScaledInPlace(vel, dt);

      const maxL = p.maxLife;
      if (maxL > 1e-6 && maxL != 0) {
        const ratio = Math.max(0, p.life / maxL);
        p.alpha = ratio;
        p.size = p.initialSize * ratio;
      }
    }

    this.activeCount = active;
  }

  public clear(): void {
    const len = this.particles.length;
    for (let i = 0; i < len; i++) {
      const p = this.particles.at(i);
      if (p) p.active = false;
    }
    this.activeCount = 0;
  }
}
