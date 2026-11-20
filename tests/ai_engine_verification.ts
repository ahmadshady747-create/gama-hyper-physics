import {
  AutoJuiceController,
  buildWorldFromSpec,
  GamaGameSpec,
  runHeadlessPlaytest,
  validateGameSpec,
} from '../src/ai_engine';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`AI Engine Verification Failed: ${msg}`);
  }
}

export function runAiEngineVerification(): void {
  // 1. Validation catches invalid specs cleanly
  const badSpec: GamaGameSpec = {
    title: '',
    width: 100,
    height: 100,
    entities: [
      { id: 'dup', role: 'prop', shape: 'circle', x: 50, y: 50, radius: -5 },
      { id: 'dup', role: 'prop', shape: 'box', x: 50, y: 50, width: 20, height: 20 },
    ],
  };
  const badRes = validateGameSpec(badSpec);
  assert(!badRes.valid, 'Invalid spec should fail validation');
  assert(badRes.errors.length >= 3, 'Should report multiple specific errors');

  // 2. Valid tower spec builds and passes stability playtest
  const towerSpec: GamaGameSpec = {
    title: 'Tower Stability & Demolition Test',
    width: 1000,
    height: 600,
    gravityY: 980,
    entities: [
      { id: 'floor', role: 'obstacle', shape: 'box', x: 500, y: 580, width: 1000, height: 40, isStatic: true },
      { id: 'ball', role: 'projectile', shape: 'circle', x: 180, y: 500, radius: 22, mass: 3.5 },
      { id: 't1', role: 'target', shape: 'box', x: 680, y: 530, width: 50, height: 60, mass: 1.5, friction: 0.7 },
    ],
  };

  const okRes = validateGameSpec(towerSpec);
  assert(okRes.valid, `Valid spec should pass, got: ${okRes.errors.join(', ')}`);

  const built = buildWorldFromSpec(towerSpec);
  assert(built.bodyById.size === 3, 'World should contain 3 registered bodies');

  const report = runHeadlessPlaytest(towerSpec, {
    policy: 'launch_towards_target',
    frames: 150,
    launchImpulse: 820,
  });
  assert(report.specValid, 'Playtest report should mark spec valid');
  assert(!report.nanDetected, 'No NaNs should occur during simulation');
  assert(report.framesSimulated === 150, 'Should simulate all 150 frames');
  assert(report.totalTargets === 1, 'Should detect 1 target entity');

  // 3. AutoJuiceController triggers and decays smoothly in headless mode
  const juice = new AutoJuiceController();
  juice.trigger('heavy_hit', 200, 300, '+50');
  assert(juice.shakeIntensity > 0, 'Heavy hit should activate screen shake');
  assert(juice.floatingTexts.length === 1, 'Floating text should be spawned');
  const pausedForHitstop = juice.update(0.016);
  assert(pausedForHitstop, 'First frame after heavy hit should trigger hitstop');
  juice.update(0.1);
  juice.update(0.1);
  assert(juice.hitstopRemaining === 0, 'Hitstop should expire cleanly');

  console.log('[PASS] AI-First Game Engine verification passed (Spec, Auto-Juice, Headless Playtest Bot).');
}

runAiEngineVerification();
