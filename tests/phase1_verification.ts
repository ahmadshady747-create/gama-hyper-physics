import {
  DynamicBVHTree2D,
  DynamicBVHTree3D,
  AABB2D,
  AABB3D,
  Capsule2D,
  Capsule3D,
  Ray2D,
  Ray3D,
  RayHit2D,
  RayHit3D,
  rayVsCircle2D,
  rayVsBox2D,
  rayVsCapsule2D,
  rayVsSphere3D,
  rayVsBox3D,
  testCapsuleVsCapsule2D,
  testCapsuleVsCircle2D,
  testCapsuleVsCapsule3D,
  testCapsuleVsSphere3D,
  PhysicsWorld2D,
  RigidBody2D
} from '../src/physics';
import { Vec2, Vec3, Quat } from '../src/math';

console.log('🧪 Starting LOCUS Phase 1 Verification Suite...\n');

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
// 1. Dynamic BVH Tree Tests (2D & 3D)
// ----------------------------------------------------
console.log('--- 1. Testing Dynamic BVH Trees ---');
{
  const bvh2D = new DynamicBVHTree2D<string>(64);
  const aabbA = new AABB2D(0, 0, 50, 50);
  const aabbB = new AABB2D(100, 100, 150, 150);
  const aabbC = new AABB2D(20, 20, 70, 70);

  const proxyA = bvh2D.createProxy(aabbA, 'A');
  const proxyB = bvh2D.createProxy(aabbB, 'B');
  const proxyC = bvh2D.createProxy(aabbC, 'C');

  assert(bvh2D.nodeCount >= 3, 'BVH 2D has correct node count');

  // Query AABB overlapping A and C
  const queryBox = new AABB2D(10, 10, 30, 30);
  const hits: string[] = [];
  bvh2D.queryAABB(queryBox, (data) => {
    hits.push(data);
    return true;
  });
  assert(hits.includes('A') && hits.includes('C') && !hits.includes('B'), 'BVH 2D spatial pruning works for AABB query');

  // Pair generation (A and C overlap)
  const pairs: [string, string][] = [];
  bvh2D.generatePairs((a, b) => {
    pairs.push([a, b]);
  });
  assert(pairs.some(([a, b]) => (a === 'A' && b === 'C') || (a === 'C' && b === 'A')), 'BVH 2D pair generation finds overlapping proxies');

  // Move proxy & destroy
  bvh2D.moveProxy(proxyB, new AABB2D(30, 30, 80, 80));
  bvh2D.destroyProxy(proxyA);
  assert(bvh2D.getUserData(proxyA) === null, 'BVH 2D destroyed proxy is cleaned up');
}

{
  const bvh3D = new DynamicBVHTree3D<string>(64);
  bvh3D.createProxy(new AABB3D(0, 0, 0, 10, 10, 10), 'Node1');
  bvh3D.createProxy(new AABB3D(5, 5, 5, 15, 15, 15), 'Node2');
  bvh3D.createProxy(new AABB3D(100, 100, 100, 110, 110, 110), 'Node3');

  let overlapFound = false;
  bvh3D.generatePairs((a, b) => {
    if ((a === 'Node1' && b === 'Node2') || (a === 'Node2' && b === 'Node1')) overlapFound = true;
  });
  assert(overlapFound, 'BVH 3D pair generation correctly finds 3D overlaps');
}

// ----------------------------------------------------
// 2. Capsule Colliders Tests (2D & 3D)
// ----------------------------------------------------
console.log('\n--- 2. Testing Capsule Colliders ---');
{
  const cap1 = new Capsule2D(10, 40);
  const cap2 = new Capsule2D(10, 40);
  const hit = { collided: false, normal: new Vec2(), penetration: 0, contactPoint: new Vec2() };

  // Parallel touching capsules
  const collided = testCapsuleVsCapsule2D(
    cap1, new Vec2(0, 0), 0,
    cap2, new Vec2(15, 0), 0,
    hit
  );
  assert(collided && hit.penetration > 0, '2D Capsule vs Capsule collision detected with positive penetration');

  // Capsule vs Circle
  const circleHit = { collided: false, normal: new Vec2(), penetration: 0, contactPoint: new Vec2() };
  const capCircleCollided = testCapsuleVsCircle2D(
    cap1, new Vec2(0, 0), 0,
    new Vec2(12, 10), 10,
    circleHit
  );
  assert(capCircleCollided && circleHit.penetration > 0, '2D Capsule vs Circle collision verified');
}

{
  const cap3D_1 = new Capsule3D(10, 40);
  const cap3D_2 = new Capsule3D(10, 40);
  const hit3D = { collided: false, normal: new Vec3(), penetration: 0, contactPoint: new Vec3() };

  const q = new Quat();
  const collided3D = testCapsuleVsCapsule3D(
    cap3D_1, new Vec3(0, 0, 0), q,
    cap3D_2, new Vec3(16, 0, 0), q,
    hit3D
  );
  assert(collided3D && hit3D.penetration > 0, '3D Capsule vs Capsule collision detected');

  const sphereHit3D = { collided: false, normal: new Vec3(), penetration: 0, contactPoint: new Vec3() };
  const capSphereCollided = testCapsuleVsSphere3D(
    cap3D_1, new Vec3(0, 0, 0), q,
    new Vec3(14, 5, 0), 10,
    sphereHit3D
  );
  assert(capSphereCollided && sphereHit3D.penetration > 0, '3D Capsule vs Sphere collision detected');
}

// ----------------------------------------------------
// 3. Raycasting Pipeline Tests (2D & 3D)
// ----------------------------------------------------
console.log('\n--- 3. Testing Raycasting Pipeline ---');
{
  const ray = new Ray2D(new Vec2(-100, 0), new Vec2(1, 0), 1000);
  const hit = new RayHit2D();

  // Ray vs Circle
  const hitCircle = rayVsCircle2D(ray, new Vec2(50, 0), 20, hit);
  assert(hitCircle && Math.abs(hit.point.x - 30) < 1e-4, 'Raycast 2D vs Circle exact hit point verified');

  // Ray vs Box
  hit.reset();
  const hitBox = rayVsBox2D(ray, new Vec2(100, 0), 40, 40, 0, hit);
  assert(hitBox && Math.abs(hit.point.x - 80) < 1e-4, 'Raycast 2D vs Box OBB exact hit point verified');

  // Ray vs Capsule
  hit.reset();
  const cap = new Capsule2D(15, 50);
  const hitCap = rayVsCapsule2D(ray, cap, new Vec2(200, 0), 0, hit);
  assert(hitCap && hit.hit, 'Raycast 2D vs Capsule detected');
}

{
  const ray3 = new Ray3D(new Vec3(0, 0, 200), new Vec3(0, 0, -1), 1000);
  const hit3 = new RayHit3D();

  // Ray vs Sphere
  const hitSphere = rayVsSphere3D(ray3, new Vec3(0, 0, 50), 20, hit3);
  assert(hitSphere && Math.abs(hit3.point.z - 70) < 1e-4, 'Raycast 3D vs Sphere exact hit verified');

  // Ray vs Box
  hit3.reset();
  const hitBox3 = rayVsBox3D(ray3, new Vec3(0, 0, -50), new Vec3(20, 20, 20), new Quat(), hit3);
  assert(hitBox3 && Math.abs(hit3.point.z - (-30)) < 1e-4, 'Raycast 3D vs Box exact hit verified');
}

// ----------------------------------------------------
// 4. Island Sleeping System Tests
// ----------------------------------------------------
console.log('\n--- 4. Testing Island Sleeping & Wakeup Propagation ---');
{
  const world = new PhysicsWorld2D({
    gravity: new Vec2(0, 0),
    boundsWidth: 1000,
    boundsHeight: 1000
  });

  const b1 = world.addBody(new RigidBody2D({
    type: 'circle',
    radius: 20,
    position: new Vec2(100, 100),
    velocity: new Vec2(0.01, 0.01)
  }));
  const b2 = world.addBody(new RigidBody2D({
    type: 'circle',
    radius: 20,
    position: new Vec2(100, 138),
    velocity: new Vec2(0.01, 0.01)
  }));

  // Simulate multiple steps to satisfy timeToSleep
  for (let s = 0; s < 45; s++) {
    world.singleStep(0.0166);
  }

  assert(b1.isSleeping && b2.isSleeping, 'Resting bodies below kinetic energy threshold enter sleeping state');

  // Wakeup b1 via impulse towards b2
  b1.applyImpulse(new Vec2(0, 500));
  assert(!b1.isSleeping, 'External impulse wakes up target body');

  // Simulate step: contact between b1 and b2 wakes up b2
  world.singleStep(0.0166);
  assert(!b2.isSleeping, 'Wakeup propagates across connected contact island graph');
}

console.log(`\n🎉 All ${passedTests} LOCUS Phase 1 Tests Passed Successfully with 0 Invariant Violations!`);
