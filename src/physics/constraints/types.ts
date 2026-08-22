export interface JointLimit {
  lower: number;
  upper: number;
  enabled: boolean;
}

export interface JointMotor {
  speed: number;
  maxForce: number;
  enabled: boolean;
}

export interface IConstraint2D {
  id: number;
  enabled: boolean;
  preSolve(dt: number): void;
  solveVelocity(): void;
  solvePosition(beta?: number, slop?: number): boolean;
}

export interface IConstraint3D {
  id: number;
  enabled: boolean;
  preSolve(dt: number): void;
  solveVelocity(): void;
  solvePosition(beta?: number, slop?: number): boolean;
}
