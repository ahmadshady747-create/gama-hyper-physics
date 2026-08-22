import {
  PhysicsWorld2D,
  PhysicsWorld3D,
  RigidBody2D,
  RigidBody3D,
  DistanceJoint2D,
  DistanceJoint3D,
  RevoluteJoint2D,
  PrismaticJoint2D,
  KinematicCharacterController2D,
  KinematicCharacterController3D,
  sweepCircleVsCircle,
  sweepCircleVsBox2D,
  sweepSphereVsSphere,
  sweepSphereVsBox3D,
  TimeOfImpact2D,
  TimeOfImpact3D
} from '../src/physics';
import { Vec2, Vec3, Quat } from '../src/math';

console.log('🧪 Starting LOCUS Phase 2 Verification Suite...\n');

let passedTests = 0;
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
  passedTests++;
}

// ----------------------------------------------------
// 1. Continuous Collision Detection (CCD / TOI) Tests
// ----------------------------------------------------
console.log('--- 1. Testing Continuous Collision Detection (CCD) ---');
{
  const toi = new TimeOfImpact2D();

  // Fast bullet moving from x=-100 to x=100 (disp=(200, 0)) against stationary circle at x=0
  const hit = sweepCircleVsCircle(
    new Vec2(-100, 0), new Vec2(200, 0), 10,
    new Vec2(0, 0), new Vec2(0, 0), 10,
    toi
  );
  assert(hit && toi.hit && Math.abs(toi.toi - 0.4) < 1e-3, '2D Swept Circle vs Circle exact TOI (0.4) verified');

  // Bullet vs Box 2D
  toi.reset();
  const hitBox = sweepCircleVsBox2D(
    new Vec2(-100, 0), new Vec2(200, 0), 10,
    new Vec2(0, 0), new Vec2(20, 40), 0,
    toi
  );
  assert(hitBox && toi.hit && toi.toi > 0 && toi.toi < 1.0, '2D Swept Circle vs Box TOI detected preventing tunneling');

  // 3D Swept Sphere vs Sphere
  const toi3D = new TimeOfImpact3D();
  const hit3D = sweepSphereVsSphere(
    new Vec3(0, 0, -100), new Vec3(0, 0, 200), 10,
    new Vec3(0, 0, 0), new Vec3(0, 0, 0), 10,
    toi3D
  );
  assert(hit3D && toi3D.hit && Math.abs(toi3D.toi - 0.4) < 1e-3, '3D Swept Sphere vs Sphere exact TOI verified');

  // 3D Swept Sphere vs Box
  toi3D.reset();
  const hitBox3D = sweepSphereVsBox3D(
    new Vec3(0, 0, -100), new Vec3(0, 0, 200), 10,
    new Vec3(0, 0, 0), new Vec3(20, 20, 20), new Quat(),
    toi3D
  );
  assert(hitBox3D && toi3D.hit && toi3D.toi > 0 && toi3D.toi < 1.0, '3D Swept Sphere vs Box TOI verified');
}

// ----------------------------------------------------
// 2. Multi-Joint & Constraint Framework Tests
// ----------------------------------------------------
console.log('\n--- 2. Testing Constraints & Multi-Joints ---');
{
  // 2D Distance Joint
  const world2D = new PhysicsWorld2D({ gravity: new Vec2(0, 980) });
  const bStatic = world2D.addBody(new RigidBody2D({ position: new Vec2(100, 100), isStatic: true }));
  const bDynamic = world2D.addBody(new RigidBody2D({ position: new Vec2(100, 180) })); // initial len = 80

  const distJoint = new DistanceJoint2D(bStatic, bDynamic, { length: 80 });
  world2D.addConstraint(distJoint);

  // Run 60 simulation steps under heavy gravity
  for (let s = 0; s < 60; s++) {
    world2D.singleStep(0.0166);
  }

  const finalDist = bStatic.position.dist(bDynamic.position);
  assert(Math.abs(finalDist - 80) < 2.0, '2D Distance Joint preserves constraint length under gravity');
}

{
  // 3D Distance Joint
  const world3D = new PhysicsWorld3D({ gravity: new Vec3(0, -980, 0) });
  const bStatic3 = world3D.addBody(new RigidBody3D({ position: new Vec3(0, 100, 0), isStatic: true }));
  const bDynamic3 = world3D.addBody(new RigidBody3D({ position: new Vec3(0, 50, 0) }));

  const distJoint3 = new DistanceJoint3D(bStatic3, bDynamic3, { length: 50 });
  world3D.addConstraint(distJoint3);

  for (let s = 0; s < 60; s++) {
    world3D.singleStep(0.0166);
  }

  const finalDist3 = bStatic3.position.dist(bDynamic3.position);
  assert(Math.abs(finalDist3 - 50) < 2.0, '3D Distance Joint preserves distance under gravity');
}

{
  // 2D Revolute Joint (Pin Joint) with Motor
  const world2D = new PhysicsWorld2D({ gravity: new Vec2(0, 0) });
  const b1 = world2D.addBody(new RigidBody2D({ position: new Vec2(200, 200), isStatic: true }));
  const b2 = world2D.addBody(new RigidBody2D({ position: new Vec2(250, 200) }));

  const revJoint = new RevoluteJoint2D(b1, b2, {
    localAnchorA: new Vec2(0, 0),
    localAnchorB: new Vec2(-50, 0),
    enableMotor: true,
    motorSpeed: 5.0, // 5 rad/s
    maxMotorTorque: 50000
  });
  world2D.addConstraint(revJoint);

  for (let s = 0; s < 30; s++) {
    world2D.singleStep(0.0166);
  }

  assert(Math.abs(b2.angularVelocity - 5.0) < 0.5, '2D Revolute Joint motor accelerates body to target speed');
}

{
  // 2D Prismatic Joint (Slider Joint)
  const world2D = new PhysicsWorld2D({ gravity: new Vec2(0, 0) });
  const b1 = world2D.addBody(new RigidBody2D({ position: new Vec2(0, 0), isStatic: true }));
  const b2 = world2D.addBody(new RigidBody2D({ position: new Vec2(50, 0) }));

  // Constrain along X axis (1, 0)
  const prismJoint = new PrismaticJoint2D(b1, b2, {
    localAxisA: new Vec2(1, 0)
  });
  world2D.addConstraint(prismJoint);

  // Apply lateral impulse perpendicular to slider axis (along Y)
  b2.applyImpulse(new Vec2(0, 500));
  world2D.singleStep(0.0166);

  // Y velocity and perpendicular drift must be locked
  assert(Math.abs(b2.position.y) < 1.0, '2D Prismatic Joint locks perpendicular translation degrees of freedom');
}

// ----------------------------------------------------
// 3. Kinematic Character Controller (KCC) Tests
// ----------------------------------------------------
console.log('\n--- 3. Testing Kinematic Character Controller (KCC) ---');
{
  const world = new PhysicsWorld2D({ gravity: new Vec2(0, 0) });

  // Ground plane
  world.addBody(new RigidBody2D({
    type: 'box',
    position: new Vec2(300, 500),
    width: 600,
    height: 40,
    isStatic: true
  }));

  // Vertical wall at x = 400
  world.addBody(new RigidBody2D({
    type: 'box',
    position: new Vec2(400, 350),
    width: 40,
    height: 260,
    isStatic: true
  }));

  const kcc = new KinematicCharacterController2D({ radius: 16, height: 48 });
  kcc.setPosition(200, 400);

  // Move right into wall
  for (let s = 0; s < 30; s++) {
    kcc.moveAndSlide(new Vec2(200, 0), 0.0166, world);
  }

  // Position x must stop before wall
  assert(kcc.position.x <= 365, '2D KCC deflects and stops at obstacle wall without tunneling');

  // Move down onto ground
  kcc.setPosition(200, 400);
  for (let s = 0; s < 30; s++) {
    kcc.moveAndSlide(new Vec2(0, 200), 0.0166, world);
  }
  assert(kcc.isGrounded, '2D KCC ground check detects landing on surface');

  // Jump
  const jumped = kcc.jump(300);
  assert(jumped && !kcc.isGrounded && kcc.velocity.y < 0, '2D KCC jump launches character vertically');
}

{
  // 3D KCC Test
  const world3D = new PhysicsWorld3D({ gravity: new Vec3(0, 0, 0) });
  world3D.addBody(new RigidBody3D({
    type: 'cube',
    position: new Vec3(0, -20, 0),
    width: 500,
    height: 40,
    depth: 500,
    isStatic: true
  }));

  const kcc3D = new KinematicCharacterController3D({ radius: 16, height: 48 });
  kcc3D.setPosition(0, 50, 0);

  // Fall to ground
  for (let s = 0; s < 20; s++) {
    kcc3D.moveAndSlide(new Vec3(0, -100, 0), 0.0166, world3D);
  }

  assert(kcc3D.isGrounded, '3D KCC ground probe detects landing on ground box');
}

console.log(`\n🎉 All ${passedTests} LOCUS Phase 2 Tests Passed Successfully with 0 Invariant Violations!`);
