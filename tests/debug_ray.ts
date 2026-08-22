import { PhysicsWorld2D, RigidBody2D, Ray2D, RayHit2D } from '../src/physics';
import { Vec2 } from '../src/math';

const world = new PhysicsWorld2D({ gravity: new Vec2(0, 0) });
world.addBody(new RigidBody2D({
  type: 'box',
  position: new Vec2(300, 500),
  width: 600,
  height: 40,
  isStatic: true
}));

const ray = new Ray2D(new Vec2(200, 464), new Vec2(0, 1), 20);
const hit = new RayHit2D();
const result = world.raycast(ray, hit);
console.log('Raycast from 464 result:', result, 'hit.distance:', hit.distance, 'hit.point:', hit.point, 'hit.normal:', hit.normal);
