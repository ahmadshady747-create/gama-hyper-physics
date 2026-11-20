import { Vec2 } from '../math';
import {
  buildWorldFromSpec,
  GamaGameSpec,
  validateGameSpec,
} from './game_spec';

export type BotPolicy = 'stability_check' | 'launch_towards_target' | 'stress_impulse';

export interface PlaytestOptions {
  frames?: number;
  dt?: number;
  policy?: BotPolicy;
  launchImpulse?: number;
}

export interface PlaytestReport {
  title: string;
  policy: BotPolicy;
  specValid: boolean;
  specErrors: string[];
  specWarnings: string[];
  framesSimulated: number;
  elapsedMs: number;
  estimatedFps: number;
  totalContacts: number;
  maxSpeedObserved: number;
  nanDetected: boolean;
  outOfBoundsIds: string[];
  stabilityScore: number;
  targetsToppled: number;
  totalTargets: number;
  agentRecommendations: string[];
}

/**
 * Headless Auto-Playtester for AI Agents:
 * Simulates a declarative game scene without a browser, detects NaN explosions,
 * measures tower stability or target toppling, and returns actionable feedback.
 */
export function runHeadlessPlaytest(
  spec: GamaGameSpec,
  options: PlaytestOptions = {}
): PlaytestReport {
  const validation = validateGameSpec(spec);
  const policy: BotPolicy = options.policy ?? 'stability_check';
  const frames = Math.min(1200, Math.max(10, options.frames ?? 180));
  const dt = options.dt ?? 1 / 60;

  if (!validation.valid) {
    return {
      title: spec?.title ?? 'Invalid Spec',
      policy,
      specValid: false,
      specErrors: validation.errors,
      specWarnings: validation.warnings,
      framesSimulated: 0,
      elapsedMs: 0,
      estimatedFps: 0,
      totalContacts: 0,
      maxSpeedObserved: 0,
      nanDetected: false,
      outOfBoundsIds: [],
      stabilityScore: 0,
      targetsToppled: 0,
      totalTargets: 0,
      agentRecommendations: [
        'Fix spec validation errors before running simulation.',
      ],
    };
  }

  const built = buildWorldFromSpec(spec);
  const { world, bodyById, specById } = built;

  const initialPositions = new Map<string, { x: number; y: number }>();
  for (const [id, body] of bodyById.entries()) {
    initialPositions.set(id, { x: body.position.x, y: body.position.y });
  }

  // Apply bot action on frame 10 if launch or stress policy is chosen
  let totalContacts = 0;
  let maxSpeed = 0;
  let nanDetected = false;
  const outOfBounds = new Set<string>();

  const t0 = performance.now();
  for (let frame = 0; frame < frames; frame++) {
    if (frame === 10 && policy === 'launch_towards_target') {
      const projectile = [...specById.values()].find(
        (e) => e.role === 'projectile' || e.role === 'player'
      );
      const target = [...specById.values()].find((e) => e.role === 'target');
      if (projectile && target) {
        const pBody = bodyById.get(projectile.id);
        const tBody = bodyById.get(target.id);
        if (pBody && tBody && !pBody.isStatic) {
          const dir = new Vec2(
            tBody.position.x - pBody.position.x,
            tBody.position.y - pBody.position.y - 80
          );
          const len = Math.hypot(dir.x, dir.y) || 1;
          const speed = options.launchImpulse ?? 650;
          pBody.velocity.set((dir.x / len) * speed, (dir.y / len) * speed);
        }
      }
    } else if (frame === 10 && policy === 'stress_impulse') {
      for (const [id, body] of bodyById.entries()) {
        if (!body.isStatic && id.length > 0) {
          body.velocity.addInPlace(new Vec2(120, -180));
        }
      }
    }

    world.update(dt);
    totalContacts += world.getContactCount();

    for (const [id, body] of bodyById.entries()) {
      if (
        !Number.isFinite(body.position.x) ||
        !Number.isFinite(body.position.y) ||
        !Number.isFinite(body.velocity.x) ||
        !Number.isFinite(body.velocity.y)
      ) {
        nanDetected = true;
      }
      const speed = Math.hypot(body.velocity.x, body.velocity.y);
      if (speed > maxSpeed) maxSpeed = speed;

      if (
        body.position.x < -50 ||
        body.position.x > spec.width + 50 ||
        body.position.y < -200 ||
        body.position.y > spec.height + 50
      ) {
        outOfBounds.add(id);
      }
    }
  }
  const elapsedMs = Math.max(0.01, performance.now() - t0);

  // Measure displacement for stability & target toppling
  let totalDisp = 0;
  let dynamicCount = 0;
  let totalTargets = 0;
  let targetsToppled = 0;

  for (const [id, body] of bodyById.entries()) {
    const init = initialPositions.get(id)!;
    const disp = Math.hypot(body.position.x - init.x, body.position.y - init.y);
    const meta = specById.get(id)!;

    if (!body.isStatic) {
      totalDisp += disp;
      dynamicCount++;
    }
    if (meta.role === 'target') {
      totalTargets++;
      const fell =
        disp > 35 ||
        Math.abs(body.angle) > 0.45 ||
        (spec.targetFallY !== undefined && body.position.y >= spec.targetFallY);
      if (fell) targetsToppled++;
    }
  }

  const avgDisp = dynamicCount > 0 ? totalDisp / dynamicCount : 0;
  const stabilityScore = Math.round(Math.max(0, Math.min(100, 100 - avgDisp * 1.4)));

  const recommendations: string[] = [];
  if (nanDetected) {
    recommendations.push(
      'CRITICAL: NaN detected in kinematics — reduce initial overlap or increase mass.'
    );
  }
  if (outOfBounds.size > 0) {
    recommendations.push(
      `Entities escaped arena bounds: ${[...outOfBounds].join(', ')}. Add boundary walls or lower launch velocity.`
    );
  }
  if (policy === 'stability_check' && stabilityScore < 75) {
    recommendations.push(
      `Structure stability is low (${stabilityScore}/100). Increase friction or align stacked boxes cleanly.`
    );
  }
  if (
    policy === 'launch_towards_target' &&
    totalTargets > 0 &&
    targetsToppled === 0
  ) {
    recommendations.push(
      'Bot launch did not topple any target. Increase launchImpulse or reduce target mass.'
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Simulation passed all physics & playability checks cleanly.');
  }

  return {
    title: spec.title,
    policy,
    specValid: true,
    specErrors: [],
    specWarnings: validation.warnings,
    framesSimulated: frames,
    elapsedMs: +elapsedMs.toFixed(2),
    estimatedFps: Math.round((frames / elapsedMs) * 1000),
    totalContacts,
    maxSpeedObserved: +maxSpeed.toFixed(1),
    nanDetected,
    outOfBoundsIds: [...outOfBounds],
    stabilityScore,
    targetsToppled,
    totalTargets,
    agentRecommendations: recommendations,
  };
}
