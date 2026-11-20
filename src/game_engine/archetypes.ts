import { GamaGameSpec } from '../ai_engine';

export type GameArchetype =
  | 'tower_demolition'
  | 'arena_survivor'
  | 'physics_platformer'
  | 'pinball_breakout';

/**
 * Generates ready-to-play, balanced, validated GamaGameSpec templates
 * so AI agents can bootstrap full games in a single call and iterate rapidly.
 */
export function createArchetypeGame(
  archetype: GameArchetype,
  title?: string
): GamaGameSpec {
  switch (archetype) {
    case 'tower_demolition':
      return {
        title: title ?? 'Neon Tower Demolition',
        width: 1000,
        height: 600,
        gravityY: 980,
        entities: [
          { id: 'ground', role: 'obstacle', shape: 'box', x: 500, y: 580, width: 1000, height: 40, isStatic: true, color: '#1e293b' },
          { id: 'wall_right', role: 'obstacle', shape: 'box', x: 990, y: 300, width: 20, height: 600, isStatic: true, color: '#1e293b' },
          { id: 'cannonball', role: 'projectile', shape: 'circle', x: 170, y: 490, radius: 22, mass: 4.0, restitution: 0.45, color: '#00e5c4' },
          { id: 'pillar_left', role: 'target', shape: 'box', x: 680, y: 525, width: 36, height: 70, mass: 1.4, friction: 0.75, color: '#f5c451' },
          { id: 'pillar_right', role: 'target', shape: 'box', x: 780, y: 525, width: 36, height: 70, mass: 1.4, friction: 0.75, color: '#f5c451' },
          { id: 'roof_beam', role: 'target', shape: 'box', x: 730, y: 472, width: 150, height: 24, mass: 1.6, friction: 0.75, color: '#8b7cff' },
          { id: 'core_crystal', role: 'target', shape: 'circle', x: 730, y: 440, radius: 18, mass: 1.0, restitution: 0.5, color: '#f43f5e' },
        ],
      };

    case 'arena_survivor':
      return {
        title: title ?? 'Cyber Arena Survivor',
        width: 960,
        height: 600,
        gravityY: 0,
        entities: [
          { id: 'wall_top', role: 'obstacle', shape: 'box', x: 480, y: 12, width: 960, height: 24, isStatic: true, color: '#1e293b' },
          { id: 'wall_bot', role: 'obstacle', shape: 'box', x: 480, y: 588, width: 960, height: 24, isStatic: true, color: '#1e293b' },
          { id: 'wall_l', role: 'obstacle', shape: 'box', x: 12, y: 300, width: 24, height: 600, isStatic: true, color: '#1e293b' },
          { id: 'wall_r', role: 'obstacle', shape: 'box', x: 948, y: 300, width: 24, height: 600, isStatic: true, color: '#1e293b' },
          { id: 'hero', role: 'player', shape: 'circle', x: 480, y: 300, radius: 22, mass: 2.0, restitution: 0.6, color: '#00e5c4' },
          { id: 'drone_1', role: 'target', shape: 'circle', x: 180, y: 140, vx: 90, vy: 50, radius: 18, mass: 1.2, restitution: 0.85, color: '#f43f5e' },
          { id: 'drone_2', role: 'target', shape: 'circle', x: 780, y: 160, vx: -85, vy: 65, radius: 18, mass: 1.2, restitution: 0.85, color: '#f43f5e' },
          { id: 'drone_3', role: 'target', shape: 'circle', x: 760, y: 470, vx: -70, vy: -80, radius: 18, mass: 1.2, restitution: 0.85, color: '#f5c451' },
        ],
      };

    case 'physics_platformer':
      return {
        title: title ?? 'Quantum Hopper',
        width: 1000,
        height: 600,
        gravityY: 980,
        entities: [
          { id: 'floor', role: 'obstacle', shape: 'box', x: 500, y: 580, width: 1000, height: 40, isStatic: true, color: '#1e293b' },
          { id: 'plat_1', role: 'obstacle', shape: 'box', x: 320, y: 450, width: 180, height: 22, isStatic: true, color: '#334155' },
          { id: 'plat_2', role: 'obstacle', shape: 'box', x: 600, y: 340, width: 180, height: 22, isStatic: true, color: '#334155' },
          { id: 'hero', role: 'player', shape: 'box', x: 120, y: 520, width: 34, height: 44, mass: 1.5, friction: 0.5, color: '#00e5c4' },
          { id: 'orb_1', role: 'target', shape: 'circle', x: 320, y: 410, radius: 14, mass: 0.6, color: '#f5c451' },
          { id: 'orb_2', role: 'target', shape: 'circle', x: 600, y: 300, radius: 14, mass: 0.6, color: '#f5c451' },
        ],
      };

    case 'pinball_breakout':
      return {
        title: title ?? 'Neon Core Breaker',
        width: 800,
        height: 600,
        gravityY: 0,
        entities: [
          { id: 'wall_top', role: 'obstacle', shape: 'box', x: 400, y: 12, width: 800, height: 24, isStatic: true, color: '#1e293b' },
          { id: 'wall_l', role: 'obstacle', shape: 'box', x: 12, y: 300, width: 24, height: 600, isStatic: true, color: '#1e293b' },
          { id: 'wall_r', role: 'obstacle', shape: 'box', x: 788, y: 300, width: 24, height: 600, isStatic: true, color: '#1e293b' },
          { id: 'ball', role: 'projectile', shape: 'circle', x: 400, y: 480, vx: 210, vy: -390, radius: 14, mass: 1.0, restitution: 1.0, friction: 0, color: '#00e5c4' },
          { id: 'brick_1', role: 'target', shape: 'box', x: 220, y: 130, width: 110, height: 28, mass: 1.0, restitution: 0.9, color: '#8b7cff' },
          { id: 'brick_2', role: 'target', shape: 'box', x: 400, y: 130, width: 110, height: 28, mass: 1.0, restitution: 0.9, color: '#f5c451' },
          { id: 'brick_3', role: 'target', shape: 'box', x: 580, y: 130, width: 110, height: 28, mass: 1.0, restitution: 0.9, color: '#f43f5e' },
        ],
      };
  }
}
