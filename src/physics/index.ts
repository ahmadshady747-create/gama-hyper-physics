export * from './common/types';
export * from './common/pool';
export * from './common/sleeping';
export * from './particles';
export * from './broadphase/bvh';
export * from './shapes/capsule';
export * from './queries/raycast';
export * from './queries/ccd';

// Constraints & Multi-Joints
export * from './constraints/types';
export * from './constraints/distance_joint';
export * from './constraints/revolute_joint';
export * from './constraints/prismatic_joint';

// Gameplay Physics Controllers
export * from './controllers/character2d';
export * from './controllers/character3d';

// 2D Physics Subsystem
export * from './engine2d/body2d';
export * from './engine2d/collision2d';
export * from './engine2d/world2d';

// 3D Physics Subsystem
export * from './engine3d/body3d';
export * from './engine3d/collision3d';
export * from './engine3d/world3d';

// 4D Hyper-Physics Subsystem
export * from './engine4d/body4d';
export * from './engine4d/collision4d';
export * from './engine4d/world4d';

// Legacy compatibility aliases for existing references if any
export { RigidBody2D as RigidBody } from './engine2d/body2d';
export { PhysicsWorld2D as PhysicsWorld } from './engine2d/world2d';
