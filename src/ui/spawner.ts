import { Vec2, Vec3, Vec4 } from '../math';
import {
  DimensionMode,
  MaterialProperties,
  RigidBody2D,
  PhysicsWorld2D,
  RigidBody3D,
  PhysicsWorld3D,
  RigidBody4D,
  PhysicsWorld4D
} from '../physics';
import { SpawnerRenderState } from '../render';

export class InteractiveSpawner {
  public enabled: boolean = false;
  public activeDimension: DimensionMode = '2d';
  public currentShape: string = 'circle';

  public material: MaterialProperties = {
    mass: 2.0,
    restitution: 0.5,
    friction: 0.3,
    isStatic: false,
    color: '#38bdf8'
  };

  public isDragging: boolean = false;
  public startScreen: Vec2 = new Vec2();
  public currentScreen: Vec2 = new Vec2();
  public startWorld: { x: number; y: number; z?: number; w?: number } = { x: 0, y: 0 };
  public currentWorld: { x: number; y: number; z?: number; w?: number } = { x: 0, y: 0 };
  public computedRadius: number = 25;

  public setDimension(dim: DimensionMode): void {
    this.activeDimension = dim;
    if (dim === '2d') {
      if (this.currentShape !== 'circle' && this.currentShape !== 'box') {
        this.currentShape = 'circle';
      }
    } else if (dim === '3d') {
      if (this.currentShape !== 'sphere' && this.currentShape !== 'cube') {
        this.currentShape = 'sphere';
      }
    } else if (dim === '4d') {
      if (this.currentShape !== 'hypersphere' && this.currentShape !== 'tesseract') {
        this.currentShape = 'hypersphere';
      }
    }
  }

  public setShape(shape: string): void {
    this.currentShape = shape;
  }

  public onPointerDown(screenX: number, screenY: number, worldX: number, worldY: number, worldZ: number = 0, worldW: number = 0): void {
    this.isDragging = true;
    this.startScreen?.set(screenX, screenY);
    this.currentScreen?.set(screenX, screenY);
    this.startWorld = { x: worldX, y: worldY, z: worldZ, w: worldW };
    this.currentWorld = { x: worldX, y: worldY, z: worldZ, w: worldW };
    this.computedRadius = 25;
  }

  public onPointerMove(screenX: number, screenY: number, worldX: number, worldY: number, worldZ: number = 0, worldW: number = 0): void {
    if (!this.isDragging) return;
    this.currentScreen?.set(screenX, screenY);
    this.currentWorld = { x: worldX, y: worldY, z: worldZ, w: worldW };

    const dx = screenX - this.startScreen.x;
    const dy = screenY - this.startScreen.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.computedRadius = Math.max(15, Math.min(150, dist));
  }

  public onPointerUp(
    world2D?: PhysicsWorld2D,
    world3D?: PhysicsWorld3D,
    world4D?: PhysicsWorld4D
  ): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const rad = this.computedRadius;
    const mat = this.material;
    const sx = this.startWorld.x;
    const sy = this.startWorld.y;
    const sz = this.startWorld.z ?? 0;
    const sw = this.startWorld.w ?? 0;

    const flingX = (this.startScreen.x - this.currentScreen.x) * 3.5;
    const flingY = (this.startScreen.y - this.currentScreen.y) * 3.5;

    if (this.activeDimension === '2d' && world2D) {
      if (this.currentShape === 'circle') {
        world2D.addBody(new RigidBody2D({
          type: 'circle',
          position: new Vec2(sx, sy),
          velocity: new Vec2(flingX, flingY),
          radius: rad,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      } else {
        const side = rad * 1.6;
        world2D.addBody(new RigidBody2D({
          type: 'box',
          position: new Vec2(sx, sy),
          velocity: new Vec2(flingX, flingY),
          width: side,
          height: side,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      }
    } else if (this.activeDimension === '3d' && world3D) {
      if (this.currentShape === 'sphere') {
        world3D.addBody(new RigidBody3D({
          type: 'sphere',
          position: new Vec3(sx, Math.max(rad, sy), sz),
          velocity: new Vec3(flingX, 100, -flingY * 0.5),
          radius: rad,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      } else {
        const side = rad * 1.6;
        world3D.addBody(new RigidBody3D({
          type: 'cube',
          position: new Vec3(sx, Math.max(side * 0.5, sy), sz),
          velocity: new Vec3(flingX, 100, -flingY * 0.5),
          width: side,
          height: side,
          depth: side,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      }
    } else if (this.activeDimension === '4d' && world4D) {
      if (this.currentShape === 'hypersphere') {
        world4D.addBody(new RigidBody4D({
          type: 'hypersphere',
          position: new Vec4(sx, Math.max(rad, sy), sz, sw),
          velocity: new Vec4(flingX, 100, -flingY * 0.5, (Math.random() - 0.5) * 100),
          radius: rad,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      } else {
        const side = rad * 1.6;
        world4D.addBody(new RigidBody4D({
          type: 'tesseract',
          position: new Vec4(sx, Math.max(side * 0.5, sy), sz, sw),
          velocity: new Vec4(flingX, 100, -flingY * 0.5, (Math.random() - 0.5) * 100),
          width: side,
          height: side,
          depth: side,
          hyperDepth: side,
          mass: mat.mass,
          restitution: mat.restitution,
          friction: mat.friction,
          isStatic: mat.isStatic,
          color: mat.color
        }));
      }
    }
  }

  public getRenderState(): SpawnerRenderState {
    const flingX = (this.startScreen.x - this.currentScreen.x) * 3.5;
    const flingY = (this.startScreen.y - this.currentScreen.y) * 3.5;

    return {
      isActive: this.isDragging,
      shape: this.currentShape,
      startWorld: this.startWorld,
      currentWorld: this.currentWorld,
      flingVelocity: { x: flingX, y: flingY },
      color: this.material.color,
      size: this.computedRadius
    };
  }
}
