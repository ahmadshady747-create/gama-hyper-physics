import { Vec2, Vec3, Vec4 } from './math';
import {
  DimensionMode,
  PhysicsWorld2D,
  RigidBody2D,
  PhysicsWorld3D,
  RigidBody3D,
  PhysicsWorld4D,
  RigidBody4D
} from './physics';
import { Renderer } from './render';
import { MotionSensorManager, InteractiveSpawner, UIControls } from './ui';

const NEON_PALETTE = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#34d399', '#fbbf24', '#f87171'];

function getRandomNeonColor(): string {
  const idx = Math.floor(Math.random() * NEON_PALETTE.length);
  return NEON_PALETTE.at(idx) ?? '#38bdf8';
}

export function initApp(): void {
  const canvas = document.getElementById('physics-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    console.error('Canvas element #physics-canvas not found!');
    return;
  }

  const initialWidth = window?.innerWidth || 1280;
  const initialHeight = window?.innerHeight || 720;

  // Initialize Dimensional Physics Worlds
  const world2D = new PhysicsWorld2D({
    gravity: new Vec2(0, 980),
    wind: new Vec2(0, 0),
    boundsWidth: initialWidth,
    boundsHeight: initialHeight,
    solverIterations: 8
  });

  const world3D = new PhysicsWorld3D({
    gravity: new Vec3(0, -980, 0),
    wind: new Vec3(0, 0, 0),
    boundsWidth: 900,
    boundsHeight: 700,
    boundsDepth: 900,
    solverIterations: 8
  });

  const world4D = new PhysicsWorld4D({
    gravity: new Vec4(0, -980, 0, 0),
    boundsWidth: 800,
    boundsHeight: 650,
    boundsDepth: 800,
    boundsHyperDepth: 800,
    solverIterations: 8
  });

  // Renderer & Subsystems
  const renderer = new Renderer(canvas);
  const sensor = new MotionSensorManager();
  const spawner = new InteractiveSpawner();

  let activeDimension: DimensionMode = '2d';

  // Resize Handler
  const handleResize = () => {
    const w = window?.innerWidth || 1280;
    const h = window?.innerHeight || 720;
    renderer?.resize(w, h);
    world2D?.resizeBounds(w, h);
    world3D?.resizeBounds(w * 0.75, h * 0.85, w * 0.75);
    world4D?.resizeBounds(w * 0.7, h * 0.8, w * 0.7, w * 0.7);
  };

  window.addEventListener('resize', handleResize);
  handleResize();

  // ==========================================
  // 2D SCENE PRESETS
  // ==========================================

  const spawnPyramid2D = () => {
    world2D?.clearBodies();
    const w = world2D.bounds.width;
    const h = world2D.bounds.height;
    const cx = w * 0.5;
    const groundY = h - 40;

    // Ground Platform
    world2D?.addBody(new RigidBody2D({
      type: 'box',
      position: new Vec2(cx, groundY),
      width: Math.min(w * 0.9, 1000),
      height: 30,
      isStatic: true,
      color: '#475569',
      friction: 0.6
    }));

    const boxW = 44;
    const boxH = 38;
    const rows = 6;
    const startY = groundY - 15 - boxH * 0.5;

    for (let r = 0; r < rows; r++) {
      const countInRow = rows - r;
      const rowStartX = cx - (countInRow - 1) * (boxW + 4) * 0.5;
      const rowY = startY - r * (boxH + 2);

      for (let c = 0; c < countInRow; c++) {
        const x = rowStartX + c * (boxW + 4);
        world2D?.addBody(new RigidBody2D({
          type: 'box',
          position: new Vec2(x, rowY),
          width: boxW,
          height: boxH,
          mass: 3.0,
          friction: 0.5,
          restitution: 0.15,
          color: NEON_PALETTE.at(r % NEON_PALETTE.length) ?? '#38bdf8'
        }));
      }
    }
  };

  const spawnDominoes2D = () => {
    world2D?.clearBodies();
    const w = world2D.bounds.width;
    const h = world2D.bounds.height;
    const groundY = h - 40;

    world2D?.addBody(new RigidBody2D({
      type: 'box',
      position: new Vec2(w * 0.5, groundY),
      width: w * 0.9,
      height: 30,
      isStatic: true,
      color: '#475569',
      friction: 0.6
    }));

    const dominoW = 12;
    const dominoH = 65;
    const dominoCount = 12;
    const startX = w * 0.2;

    for (let i = 0; i < dominoCount; i++) {
      world2D?.addBody(new RigidBody2D({
        type: 'box',
        position: new Vec2(startX + i * 36, groundY - 15 - dominoH * 0.5),
        width: dominoW,
        height: dominoH,
        mass: 1.5,
        friction: 0.4,
        restitution: 0.15,
        color: '#38bdf8'
      }));
    }

    // Heavy Trigger Ball
    world2D?.addBody(new RigidBody2D({
      type: 'circle',
      position: new Vec2(startX - 60, groundY - 15 - 25),
      velocity: new Vec2(360, 0),
      radius: 25,
      mass: 12.0,
      restitution: 0.2,
      friction: 0.3,
      color: '#f43f5e'
    }));

    // Crate stacks
    const stackX = startX + dominoCount * 36 + 60;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 5; row++) {
        world2D?.addBody(new RigidBody2D({
          type: 'box',
          position: new Vec2(stackX + col * 46, groundY - 15 - 20 - row * 42),
          width: 40,
          height: 40,
          mass: 2.0,
          friction: 0.4,
          restitution: 0.1,
          color: getRandomNeonColor()
        }));
      }
    }
  };

  const spawnCircles2D = () => {
    world2D?.clearBodies();
    const w = world2D.bounds.width;
    const h = world2D.bounds.height;

    for (let i = 0; i < 40; i++) {
      const radius = 14 + Math.random() * 20;
      const x = w * 0.15 + Math.random() * (w * 0.7);
      const y = 80 + Math.random() * (h * 0.5);
      const vx = (Math.random() - 0.5) * 350;
      const vy = (Math.random() - 0.5) * 250;

      world2D?.addBody(new RigidBody2D({
        type: 'circle',
        position: new Vec2(x, y),
        velocity: new Vec2(vx, vy),
        radius,
        mass: radius * radius * 0.005,
        restitution: 0.8,
        friction: 0.2,
        color: getRandomNeonColor()
      }));
    }
  };

  const spawnCradle2D = () => {
    world2D?.clearBodies();
    const cx = world2D.bounds.width * 0.5;
    const cy = world2D.bounds.height * 0.45;
    const ballRadius = 26;
    const count = 6;
    const startX = cx - (count - 1) * ballRadius;

    world2D?.addBody(new RigidBody2D({
      type: 'box',
      position: new Vec2(cx, world2D.bounds.height - 30),
      width: world2D.bounds.width * 0.9,
      height: 30,
      isStatic: true,
      color: '#475569'
    }));

    for (let i = 0; i < count; i++) {
      const x = startX + i * (ballRadius * 2);
      const isLeft = i === 0;

      world2D?.addBody(new RigidBody2D({
        type: 'circle',
        position: new Vec2(isLeft ? x - 160 : x, isLeft ? cy - 80 : cy),
        velocity: new Vec2(isLeft ? 500 : 0, isLeft ? 100 : 0),
        radius: ballRadius,
        mass: 5.0,
        restitution: 0.98,
        friction: 0.05,
        color: isLeft ? '#f43f5e' : '#38bdf8'
      }));
    }
  };

  const spawnChaos2D = () => {
    world2D?.clearBodies();
    const w = world2D.bounds.width;
    const h = world2D.bounds.height;

    world2D?.addBody(new RigidBody2D({
      type: 'box',
      position: new Vec2(w * 0.3, h * 0.35),
      angle: Math.PI * 0.12,
      width: 320,
      height: 20,
      isStatic: true,
      color: '#64748b',
      friction: 0.2
    }));

    world2D?.addBody(new RigidBody2D({
      type: 'box',
      position: new Vec2(w * 0.7, h * 0.55),
      angle: -Math.PI * 0.14,
      width: 340,
      height: 20,
      isStatic: true,
      color: '#64748b',
      friction: 0.2
    }));

    for (let i = 0; i < 25; i++) {
      const isCircle = i % 2 === 0;
      world2D?.addBody(new RigidBody2D({
        type: isCircle ? 'circle' : 'box',
        position: new Vec2(w * 0.2 + (i * 26) % (w * 0.6), 40 + i * 18),
        radius: 16 + Math.random() * 10,
        width: 32 + Math.random() * 14,
        height: 32 + Math.random() * 14,
        mass: 2.0,
        restitution: 0.6,
        friction: 0.3,
        color: getRandomNeonColor()
      }));
    }
  };

  // ==========================================
  // 3D SCENE PRESETS
  // ==========================================

  const spawnCubeMatrix3D = () => {
    world3D?.clearBodies();
    const size = 38;
    const gap = 12;
    const dim = 3;
    const startX = -(dim - 1) * (size + gap) * 0.5;
    const startZ = -(dim - 1) * (size + gap) * 0.5;
    const startY = 120;

    for (let y = 0; y < dim; y++) {
      for (let x = 0; x < dim; x++) {
        for (let z = 0; z < dim; z++) {
          world3D?.addBody(new RigidBody3D({
            type: 'cube',
            position: new Vec3(startX + x * (size + gap), startY + y * (size + gap), startZ + z * (size + gap)),
            width: size,
            height: size,
            depth: size,
            mass: 2.5,
            restitution: 0.2,
            friction: 0.4,
            color: NEON_PALETTE.at((x + y + z) % NEON_PALETTE.length) ?? '#38bdf8'
          }));
        }
      }
    }
  };

  const spawnOrbitalSpheres3D = () => {
    world3D?.clearBodies();

    // Central heavy sphere
    world3D?.addBody(new RigidBody3D({
      type: 'sphere',
      position: new Vec3(0, 200, 0),
      radius: 45,
      mass: 20.0,
      restitution: 0.7,
      friction: 0.2,
      color: '#f43f5e'
    }));

    // Orbiting Spheres
    const count = 14;
    const orbitRad = 200;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const x = Math.cos(theta) * orbitRad;
      const z = Math.sin(theta) * orbitRad;
      const vx = -Math.sin(theta) * 280;
      const vz = Math.cos(theta) * 280;

      world3D?.addBody(new RigidBody3D({
        type: 'sphere',
        position: new Vec3(x, 200 + (Math.random() - 0.5) * 60, z),
        velocity: new Vec3(vx, (Math.random() - 0.5) * 50, vz),
        radius: 18 + Math.random() * 8,
        mass: 3.0,
        restitution: 0.75,
        friction: 0.15,
        color: getRandomNeonColor()
      }));
    }
  };

  const spawnStackTower3D = () => {
    world3D?.clearBodies();
    const boxW = 50;
    const boxH = 26;
    const boxD = 50;
    const layers = 10;

    for (let l = 0; l < layers; l++) {
      world3D?.addBody(new RigidBody3D({
        type: 'cube',
        position: new Vec3(0, 15 + l * (boxH + 2), 0),
        width: boxW,
        height: boxH,
        depth: boxD,
        mass: 3.0,
        restitution: 0.1,
        friction: 0.5,
        color: NEON_PALETTE.at(l % NEON_PALETTE.length) ?? '#38bdf8'
      }));
    }
  };

  const spawnChaos3D = () => {
    world3D?.clearBodies();
    for (let i = 0; i < 28; i++) {
      const isSphere = i % 2 === 0;
      const x = (Math.random() - 0.5) * 400;
      const y = 80 + Math.random() * 300;
      const z = (Math.random() - 0.5) * 400;

      world3D?.addBody(new RigidBody3D({
        type: isSphere ? 'sphere' : 'cube',
        position: new Vec3(x, y, z),
        velocity: new Vec3((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200),
        radius: 20 + Math.random() * 8,
        width: 36,
        height: 36,
        depth: 36,
        mass: 2.5,
        restitution: 0.65,
        friction: 0.3,
        color: getRandomNeonColor()
      }));
    }
  };

  // ==========================================
  // 4D HYPER-PHYSICS SCENE PRESETS
  // ==========================================

  const spawnRotatingTesseract4D = () => {
    world4D?.clearBodies();

    // Central 8-Cell Tesseract rotating across xw and zw
    const centralTesseract = new RigidBody4D({
      type: 'tesseract',
      position: new Vec4(0, 260, 0, 0),
      width: 70,
      height: 70,
      depth: 70,
      hyperDepth: 70,
      mass: 8.0,
      restitution: 0.6,
      friction: 0.2,
      color: '#c084fc'
    });
    centralTesseract.angularVelocityXW = 1.2;
    centralTesseract.angularVelocityZW = 0.9;
    centralTesseract.angularVelocityYZ = 0.6;
    world4D?.addBody(centralTesseract);

    // Colliding Hyperspheres
    const count = 8;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const dist = 180;
      const x = Math.cos(theta) * dist;
      const z = Math.sin(theta) * dist;
      const w = ((i % 2 === 0) ? 1 : -1) * 60;

      const hs = new RigidBody4D({
        type: 'hypersphere',
        position: new Vec4(x, 260 + (i % 3) * 30, z, w),
        velocity: new Vec4(-x * 0.8, (Math.random() - 0.5) * 50, -z * 0.8, -w * 0.5),
        radius: 22,
        mass: 3.5,
        restitution: 0.75,
        friction: 0.15,
        color: getRandomNeonColor()
      });
      world4D?.addBody(hs);
    }
  };

  const spawnHyperSphereCascade4D = () => {
    world4D?.clearBodies();
    for (let i = 0; i < 18; i++) {
      const x = (Math.random() - 0.5) * 320;
      const y = 100 + Math.random() * 250;
      const z = (Math.random() - 0.5) * 320;
      const w = (Math.random() - 0.5) * 200;

      world4D?.addBody(new RigidBody4D({
        type: 'hypersphere',
        position: new Vec4(x, y, z, w),
        velocity: new Vec4((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 150, (Math.random() - 0.5) * 150),
        radius: 18 + Math.random() * 10,
        mass: 3.0,
        restitution: 0.7,
        friction: 0.2,
        color: getRandomNeonColor()
      }));
    }
  };

  const spawnChaos4D = () => {
    world4D?.clearBodies();
    for (let i = 0; i < 14; i++) {
      const isTesseract = i % 2 === 0;
      const x = (Math.random() - 0.5) * 300;
      const y = 80 + Math.random() * 260;
      const z = (Math.random() - 0.5) * 300;
      const w = (Math.random() - 0.5) * 220;

      const body = new RigidBody4D({
        type: isTesseract ? 'tesseract' : 'hypersphere',
        position: new Vec4(x, y, z, w),
        velocity: new Vec4((Math.random() - 0.5) * 200, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200),
        radius: 24,
        width: 48,
        height: 48,
        depth: 48,
        hyperDepth: 48,
        mass: 4.0,
        restitution: 0.6,
        friction: 0.25,
        color: getRandomNeonColor()
      });
      body.angularVelocityXW = (Math.random() - 0.5) * 2.0;
      body.angularVelocityZW = (Math.random() - 0.5) * 2.0;
      world4D?.addBody(body);
    }
  };

  // Clear World
  const clearWorld = () => {
    if (activeDimension === '2d') {
      world2D?.clearBodies();
      world2D?.addBody(new RigidBody2D({
        type: 'box',
        position: new Vec2(world2D.bounds.width * 0.5, world2D.bounds.height - 30),
        width: world2D.bounds.width * 0.95,
        height: 30,
        isStatic: true,
        color: '#475569',
        friction: 0.5
      }));
    } else if (activeDimension === '3d') {
      world3D?.clearBodies();
    } else if (activeDimension === '4d') {
      world4D?.clearBodies();
    }
  };

  // Connect HUD Controls
  const controls = new UIControls(canvas, renderer, sensor, spawner, {
    spawnPyramid2D,
    spawnDominoes2D,
    spawnCircles2D,
    spawnCradle2D,
    spawnChaos2D,
    spawnCubeMatrix3D,
    spawnOrbitalSpheres3D,
    spawnStackTower3D,
    spawnChaos3D,
    spawnRotatingTesseract4D,
    spawnHyperSphereCascade4D,
    spawnChaos4D,
    clearWorld
  });

  controls.setWorlds(world2D, world3D, world4D);

  // Initialize Default Scene
  spawnPyramid2D();

  // Animation Loop
  let lastTime = performance.now();

  const frameStep = (now: number) => {
    const rawDt = (now - lastTime) * 0.001;
    lastTime = now;

    controls?.updateMousePhysics();
    activeDimension = controls.activeDimension;
    const mouseState = controls.getMouseRenderState();

    // Update Real-World Gyroscope & Motion Sensor Gravity
    if (activeDimension === '2d') {
      sensor.updateDimensionalGravity('2d', world2D, 980);
      world2D?.update(rawDt);
      const spawnerState = spawner.getRenderState();
      renderer?.render2D(world2D, spawnerState, mouseState);
    } else if (activeDimension === '3d') {
      sensor.updateDimensionalGravity('3d', world3D, 980);
      world3D?.update(rawDt);
      const spawnerState = spawner.getRenderState();
      renderer?.render3D(world3D, spawnerState, mouseState);
    } else if (activeDimension === '4d') {
      sensor.updateDimensionalGravity('4d', world4D, 980);
      world4D?.update(rawDt);
      const spawnerState = spawner.getRenderState();
      renderer?.render4D(world4D, spawnerState, mouseState);
    }

    // Telemetry Update
    controls?.updateTelemetry();

    requestAnimationFrame(frameStep);
  };

  requestAnimationFrame(frameStep);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}



