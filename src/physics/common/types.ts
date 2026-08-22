export type DimensionMode = "2d" | "3d" | "4d";

export type BodyType2D = "circle" | "box" | "capsule";
export type BodyType3D = "sphere" | "cube" | "capsule";
export type BodyType4D = "hypersphere" | "tesseract";
export type AnyBodyType = BodyType2D | BodyType3D | BodyType4D;

export interface MaterialProperties {
  mass: number;
  restitution: number;
  friction: number;
  isStatic: boolean;
  color: string;
}

export interface SpawnRequest {
  shape: AnyBodyType;
  position: { x: number; y: number; z?: number; w?: number };
  velocity?: { x: number; y: number; z?: number; w?: number };
  size: { width: number; height: number; depth?: number; hyperDepth?: number; radius?: number; length?: number };
  material: MaterialProperties;
}

export interface IDimensionalEngine {
  readonly dimension: DimensionMode;
  isPaused: boolean;
  timeScale: number;
  solverIterations: number;

  update(rawDt: number): void;
  clearBodies(): void;
  resizeBounds(width: number, height: number, depth?: number, hyperDepth?: number): void;
  getBodyCount(): number;
  getContactCount(): number;
  getParticleCount(): number;

  setGravity(x: number, y: number, z?: number, w?: number): void;
  setWind(x: number, y: number, z?: number): void;
  setGlobalRestitution(val: number): void;
  setGlobalFriction(val: number): void;
  setSolverIterations(iters: number): void;
  setTimeScale(scale: number): void;
  setPaused(paused: boolean): void;

  applyExplosion(origin: { x: number; y: number; z?: number; w?: number }, radius: number, maxForce?: number): void;
}
