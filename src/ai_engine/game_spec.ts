import { Vec2 } from '../math';
import { PhysicsWorld2D, RigidBody2D } from '../physics';

export type EntityRole = 'player' | 'target' | 'obstacle' | 'projectile' | 'prop';

export interface GameEntitySpec {
  id: string;
  role: EntityRole;
  shape: 'circle' | 'box';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  radius?: number;
  width?: number;
  height?: number;
  mass?: number;
  restitution?: number;
  friction?: number;
  isStatic?: boolean;
  color?: string;
}

export interface GamaGameSpec {
  title: string;
  width: number;
  height: number;
  gravityY?: number;
  entities: GameEntitySpec[];
  targetFallY?: number;
}

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BuiltGameWorld {
  world: PhysicsWorld2D;
  bodyById: Map<string, RigidBody2D>;
  specById: Map<string, GameEntitySpec>;
}

/**
 * Validates a declarative JSON game spec so AI agents catch layout,
 * boundary, or invalid physics parameter mistakes before running the game.
 */
export function validateGameSpec(spec: GamaGameSpec): SpecValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Spec must be a valid object.'], warnings };
  }
  if (!spec.title || typeof spec.title !== 'string') {
    errors.push('Missing required string field: title.');
  }
  if (typeof spec.width !== 'number' || spec.width < 200) {
    errors.push('Arena width must be a number >= 200.');
  }
  if (typeof spec.height !== 'number' || spec.height < 200) {
    errors.push('Arena height must be a number >= 200.');
  }
  if (!Array.isArray(spec.entities) || spec.entities.length === 0) {
    errors.push('Spec must contain at least one entity in entities[].');
    return { valid: false, errors, warnings };
  }

  const seenIds = new Set<string>();
  let dynamicCount = 0;

  for (const ent of spec.entities) {
    if (!ent.id || typeof ent.id !== 'string') {
      errors.push('Every entity must have a non-empty string id.');
      continue;
    }
    if (seenIds.has(ent.id)) {
      errors.push(`Duplicate entity id detected: "${ent.id}".`);
    }
    seenIds.add(ent.id);

    if (ent.shape !== 'circle' && ent.shape !== 'box') {
      errors.push(`Entity "${ent.id}" has invalid shape "${String(ent.shape)}".`);
    }
    if (!Number.isFinite(ent.x) || !Number.isFinite(ent.y)) {
      errors.push(`Entity "${ent.id}" has non-finite coordinates.`);
    } else if (
      ent.x < 0 ||
      ent.x > spec.width ||
      ent.y < 0 ||
      ent.y > spec.height
    ) {
      warnings.push(
        `Entity "${ent.id}" starts outside arena bounds (${spec.width}x${spec.height}).`
      );
    }

    if (ent.shape === 'circle' && ent.radius !== undefined && ent.radius <= 0) {
      errors.push(`Circle entity "${ent.id}" must have radius > 0.`);
    }
    if (
      ent.shape === 'box' &&
      ((ent.width !== undefined && ent.width <= 0) ||
        (ent.height !== undefined && ent.height <= 0))
    ) {
      errors.push(`Box entity "${ent.id}" must have width > 0 and height > 0.`);
    }
    if (ent.mass !== undefined && ent.mass <= 0 && !ent.isStatic) {
      errors.push(`Dynamic entity "${ent.id}" must have mass > 0.`);
    }
    if (!ent.isStatic) {
      dynamicCount++;
    }
  }

  if (dynamicCount === 0) {
    warnings.push('Scene has 0 dynamic entities; nothing will move during simulation.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Instantiates a live PhysicsWorld2D directly from a validated GamaGameSpec.
 */
export function buildWorldFromSpec(spec: GamaGameSpec): BuiltGameWorld {
  const world = new PhysicsWorld2D({
    gravity: new Vec2(0, spec.gravityY ?? 980),
    boundsWidth: spec.width,
    boundsHeight: spec.height,
  });

  const bodyById = new Map<string, RigidBody2D>();
  const specById = new Map<string, GameEntitySpec>();

  for (const ent of spec.entities) {
    const body = new RigidBody2D({
      type: ent.shape,
      position: new Vec2(ent.x, ent.y),
      velocity: new Vec2(ent.vx ?? 0, ent.vy ?? 0),
      radius: ent.radius ?? 20,
      width: ent.width ?? 40,
      height: ent.height ?? 40,
      mass: ent.mass ?? 1.0,
      restitution: ent.restitution ?? 0.35,
      friction: ent.friction ?? 0.4,
      isStatic: ent.isStatic ?? false,
      color: ent.color ?? '#00e5c4',
    });
    world.addBody(body);
    bodyById.set(ent.id, body);
    specById.set(ent.id, ent);
  }

  return { world, bodyById, specById };
}
