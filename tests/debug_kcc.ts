import { PhysicsWorld2D, RigidBody2D, KinematicCharacterController2D } from '../src/physics';
import { Vec2 } from '../src/math';

const world = new PhysicsWorld2D({ gravity: new Vec2(0, 0) });

world.addBody(new RigidBody2D({
  type: 'box',
  position: new Vec2(300, 500),
  width: 600,
  height: 40,
  isStatic: true
}));

const kcc = new KinematicCharacterController2D({ radius: 16, height: 48, gravity: 980 });
kcc.setPosition(200, 400);

for (let s = 0; s < 30; s++) {
  kcc.moveAndSlide(new Vec2(0, 0), 0.0166, world);
  console.log(`Step ${s}: pos=${kcc.position.y.toFixed(2)} isGrounded=${kcc.isGrounded} velY=${kcc.velocity.y.toFixed(1)}`);
}
