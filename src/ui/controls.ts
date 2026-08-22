import { Vec2, Vec3 } from '../math';
import {
  DimensionMode,
  PhysicsWorld2D,
  RigidBody2D,
  PhysicsWorld3D,
  RigidBody3D,
  PhysicsWorld4D,
  RigidBody4D
} from '../physics';
import { Renderer, MouseRenderState } from '../render';
import { MotionSensorManager } from './sensor';
import { InteractiveSpawner } from './spawner';

export interface ScenePresetCallbacks {
  // 2D Presets
  spawnPyramid2D: () => void;
  spawnDominoes2D: () => void;
  spawnCircles2D: () => void;
  spawnCradle2D: () => void;
  spawnChaos2D: () => void;

  // 3D Presets
  spawnCubeMatrix3D: () => void;
  spawnOrbitalSpheres3D: () => void;
  spawnStackTower3D: () => void;
  spawnChaos3D: () => void;

  // 4D Presets
  spawnRotatingTesseract4D: () => void;
  spawnHyperSphereCascade4D: () => void;
  spawnChaos4D: () => void;

  // Clear World
  clearWorld: () => void;
}

/**
 * UIControls - Manages HUD, Dimension Switching, Motion Sensor, Spawner, and Multi-Dimensional Grabbing.
 */
export class UIControls {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private sensor: MotionSensorManager;
  public spawner: InteractiveSpawner;
  private callbacks: ScenePresetCallbacks;

  public activeDimension: DimensionMode = '2d';

  // Active World References
  public world2D?: PhysicsWorld2D;
  public world3D?: PhysicsWorld3D;
  public world4D?: PhysicsWorld4D;

  // Pointer & Grabbing State
  private isPointerDown: boolean = false;
  private pointerButton: number = 0;
  private lastPointerPos: Vec2 = new Vec2();

  public isGrabbingBody: boolean = false;
  public selectedBody2D: RigidBody2D | null = null;
  public selectedBody3D: RigidBody3D | null = null;
  public selectedBody4D: RigidBody4D | null = null;
  public mouseWorld: Vec2 = new Vec2();
  public mouseVelocity: Vec2 = new Vec2();

  // Telemetry
  private lastFpsUpdate: number = performance.now();
  private frameCount: number = 0;
  public currentFps: number = 60;

  constructor(
    canvas: HTMLCanvasElement,
    renderer: Renderer,
    sensor: MotionSensorManager,
    spawner: InteractiveSpawner,
    callbacks: ScenePresetCallbacks
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.sensor = sensor;
    this.spawner = spawner;
    this.callbacks = callbacks;

    this.initPointerListeners();
    this.bindDomElements();
  }

  public setWorlds(w2d: PhysicsWorld2D, w3d: PhysicsWorld3D, w4d: PhysicsWorld4D): void {
    this.world2D = w2d;
    this.world3D = w3d;
    this.world4D = w4d;
  }

  public setDimension(dim: DimensionMode): void {
    this.activeDimension = dim;
    this.spawner?.setDimension(dim);
    this.updatePresetButtonsVisibility();

    // Reset grabbed state
    this.isGrabbingBody = false;
    this.selectedBody2D = null;
    this.selectedBody3D = null;
    this.selectedBody4D = null;

    // Update active HUD button styles
    const btn2D = document.getElementById('btn-dim-2d');
    const btn3D = document.getElementById('btn-dim-3d');
    const btn4D = document.getElementById('btn-dim-4d');

    btn2D?.classList.toggle('active', dim === '2d');
    btn3D?.classList.toggle('active', dim === '3d');
    btn4D?.classList.toggle('active', dim === '4d');

    const badgeDim = document.getElementById('stat-dim');
    if (badgeDim) {
      badgeDim.textContent = dim.toUpperCase();
    }
  }

  private initPointerListeners(): void {
    const canvas = this.canvas;

    const getCanvasCoords = (clientX: number, clientY: number): Vec2 => {
      const rect = canvas.getBoundingClientRect();
      return new Vec2(clientX - rect.left, clientY - rect.top);
    };

    // Mouse Down
    canvas.addEventListener('mousedown', (evt: MouseEvent) => {
      const pos = getCanvasCoords(evt.clientX, evt.clientY);
      this.isPointerDown = true;
      this.pointerButton = evt.button;
      this.lastPointerPos?.copy(pos);
      this.mouseWorld?.copy(pos);
      this.mouseVelocity?.set(0, 0);

      // Right Click -> Shockwave Blast (if not holding Shift)
      if (evt.button === 2 && !evt.shiftKey) {
        evt.preventDefault();
        this.triggerShockwave(pos);
        return;
      }

      // Left Click -> Check Spawner or Body Grabbing
      if (evt.button === 0) {
        if (this.spawner.enabled) {
          this.spawner.onPointerDown(pos.x, pos.y, pos.x, pos.y, 0, 0);
          return;
        }

        // 2D Body Picking
        if (this.activeDimension === '2d' && this.world2D) {
          const body = this.world2D.getBodyAt(pos);
          if (body && !body.isStatic) {
            this.isGrabbingBody = true;
            this.selectedBody2D = body;
            return;
          }
        }

        // 3D Body Picking
        if (this.activeDimension === '3d' && this.world3D) {
          let hitBody: RigidBody3D | null = null;
          let closestDist = 55;
          const sPos = new Vec2();

          const bodies = this.world3D.bodies;
          const count = bodies.length;
          const w = this.renderer.width;
          const h = this.renderer.height;

          for (let i = 0; i < count; i++) {
            const b = bodies.at(i);
            if (!b || b.isStatic) continue;

            const proj = this.renderer.camera.projectPoint(b.position, w, h, sPos);
            if (proj.visible && proj.depth > 0) {
              const d = sPos.dist(pos);
              if (d < closestDist) {
                closestDist = d;
                hitBody = b;
              }
            }
          }

          if (hitBody) {
            this.isGrabbingBody = true;
            this.selectedBody3D = hitBody;
            return;
          }
        }

        // 4D Body Picking
        if (this.activeDimension === '4d' && this.world4D) {
          let hitBody: RigidBody4D | null = null;
          let closestDist = 65;
          const v3 = new Vec3();
          const sPos = new Vec2();

          const bodies = this.world4D.bodies;
          const count = bodies.length;
          const w = this.renderer.width;
          const h = this.renderer.height;

          for (let i = 0; i < count; i++) {
            const b = bodies.at(i);
            if (!b || b.isStatic) continue;

            this.renderer.proj4D.project4DTo3D(b.position, v3);
            const proj = this.renderer.camera.projectPoint(v3, w, h, sPos);
            if (proj.visible && proj.depth > 0) {
              const d = sPos.dist(pos);
              if (d < closestDist) {
                closestDist = d;
                hitBody = b;
              }
            }
          }

          if (hitBody) {
            this.isGrabbingBody = true;
            this.selectedBody4D = hitBody;
            return;
          }
        }
      }
    });

    canvas.addEventListener('contextmenu', (evt: MouseEvent) => {
      evt.preventDefault();
    });

    // Mouse Move
    window.addEventListener('mousemove', (evt: MouseEvent) => {
      const pos = getCanvasCoords(evt.clientX, evt.clientY);
      const deltaX = pos.x - this.lastPointerPos.x;
      const deltaY = pos.y - this.lastPointerPos.y;

      this.mouseVelocity?.set(pos.x - this.mouseWorld.x, pos.y - this.mouseWorld.y);
      this.mouseWorld?.copy(pos);
      this.lastPointerPos?.copy(pos);

      if (!this.isPointerDown) return;

      if (this.spawner.enabled && this.spawner.isDragging) {
        this.spawner.onPointerMove(pos.x, pos.y, pos.x, pos.y, 0, 0);
        return;
      }

      // If dragging a 3D/4D body, do not orbit camera
      if (this.isGrabbingBody) {
        return;
      }

      // Camera Orbit / Pan (3D & 4D)
      if (this.activeDimension !== '2d') {
        if (this.pointerButton === 0) {
          this.renderer.camera.orbit(deltaX * 0.006, deltaY * 0.006);
        } else if (this.pointerButton === 2 || evt.shiftKey) {
          this.renderer.camera.pan(deltaX, deltaY);
        }
      }
    });

    // Mouse Up
    window.addEventListener('mouseup', () => {
      if (this.isPointerDown) {
        if (this.spawner.enabled && this.spawner.isDragging) {
          this.spawner.onPointerUp(this.world2D, this.world3D, this.world4D);
        } else if (this.isGrabbingBody) {
          // Fling on release
          if (this.selectedBody2D) {
            this.selectedBody2D.velocity?.addScaledInPlace(this.mouseVelocity, 12);
          }
          if (this.selectedBody3D) {
            const cosAz = Math.cos(this.renderer.camera.azimuth);
            const sinAz = Math.sin(this.renderer.camera.azimuth);
            const rightX = cosAz, rightZ = -sinAz;
            this.selectedBody3D.velocity.x += (this.mouseVelocity.x * rightX) * 14;
            this.selectedBody3D.velocity.z += (this.mouseVelocity.x * rightZ) * 14;
            this.selectedBody3D.velocity.y += (-this.mouseVelocity.y) * 14;
          }
          if (this.selectedBody4D) {
            const cosAz = Math.cos(this.renderer.camera.azimuth);
            const sinAz = Math.sin(this.renderer.camera.azimuth);
            const rightX = cosAz, rightZ = -sinAz;
            this.selectedBody4D.velocity.x += (this.mouseVelocity.x * rightX) * 14;
            this.selectedBody4D.velocity.z += (this.mouseVelocity.x * rightZ) * 14;
            this.selectedBody4D.velocity.y += (-this.mouseVelocity.y) * 14;
          }
        }
      }
      this.isPointerDown = false;
      this.isGrabbingBody = false;
      this.selectedBody2D = null;
      this.selectedBody3D = null;
      this.selectedBody4D = null;
    });

    // Wheel Zoom
    canvas.addEventListener('wheel', (evt: WheelEvent) => {
      evt.preventDefault();
      if (this.activeDimension !== '2d') {
        this.renderer.camera.zoom(evt.deltaY * 1.5);
      }
    }, { passive: false });

    // Touch Listeners
    canvas.addEventListener('touchstart', (evt: TouchEvent) => {
      const touch = evt.touches.item(0);
      if (!touch) return;
      const pos = getCanvasCoords(touch.clientX, touch.clientY);
      this.isPointerDown = true;
      this.lastPointerPos?.copy(pos);
      this.mouseWorld?.copy(pos);

      if (this.spawner.enabled) {
        this.spawner.onPointerDown(pos.x, pos.y, pos.x, pos.y, 0, 0);
      } else if (this.activeDimension === '2d' && this.world2D) {
        const body = this.world2D.getBodyAt(pos);
        if (body && !body.isStatic) {
          this.isGrabbingBody = true;
          this.selectedBody2D = body;
        }
      }
    }, { passive: true });

    window.addEventListener('touchmove', (evt: TouchEvent) => {
      const touch = evt.touches.item(0);
      if (!touch || !this.isPointerDown) return;
      const pos = getCanvasCoords(touch.clientX, touch.clientY);
      const deltaX = pos.x - this.lastPointerPos.x;
      const deltaY = pos.y - this.lastPointerPos.y;

      this.mouseVelocity?.set(pos.x - this.mouseWorld.x, pos.y - this.mouseWorld.y);
      this.mouseWorld?.copy(pos);
      this.lastPointerPos?.copy(pos);

      if (this.spawner.enabled && this.spawner.isDragging) {
        this.spawner.onPointerMove(pos.x, pos.y, pos.x, pos.y, 0, 0);
      } else if (!this.isGrabbingBody && this.activeDimension !== '2d') {
        this.renderer.camera.orbit(deltaX * 0.006, deltaY * 0.006);
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (this.isPointerDown) {
        if (this.spawner.enabled && this.spawner.isDragging) {
          this.spawner.onPointerUp(this.world2D, this.world3D, this.world4D);
        } else if (this.isGrabbingBody && this.selectedBody2D) {
          this.selectedBody2D.velocity?.addScaledInPlace(this.mouseVelocity, 12);
        }
      }
      this.isPointerDown = false;
      this.isGrabbingBody = false;
      this.selectedBody2D = null;
      this.selectedBody3D = null;
      this.selectedBody4D = null;
    });
  }

  /**
   * Smooth physics spring pull update for grabbed bodies in 2D, 3D, and 4D.
   */
  public updateMousePhysics(): void {
    if (!this.isGrabbingBody) return;

    if (this.activeDimension === '2d' && this.selectedBody2D) {
      const b = this.selectedBody2D;
      const dx = this.mouseWorld.x - b.position.x;
      const dy = this.mouseWorld.y - b.position.y;
      b.velocity.x = (b.velocity.x + dx * 38.0 * (1.0 / 60.0)) * 0.85;
      b.velocity.y = (b.velocity.y + dy * 38.0 * (1.0 / 60.0)) * 0.85;
    } else if (this.activeDimension === '3d' && this.selectedBody3D) {
      const b = this.selectedBody3D;
      const cosAz = Math.cos(this.renderer.camera.azimuth);
      const sinAz = Math.sin(this.renderer.camera.azimuth);
      const rightX = cosAz, rightZ = -sinAz;

      const pullX = (this.mouseVelocity.x * rightX) * 22.0;
      const pullZ = (this.mouseVelocity.x * rightZ) * 22.0;
      const pullY = (-this.mouseVelocity.y) * 22.0;

      b.velocity.x = (b.velocity.x + pullX * 0.4) * 0.88;
      b.velocity.y = (b.velocity.y + pullY * 0.4) * 0.88;
      b.velocity.z = (b.velocity.z + pullZ * 0.4) * 0.88;
    } else if (this.activeDimension === '4d' && this.selectedBody4D) {
      const b = this.selectedBody4D;
      const cosAz = Math.cos(this.renderer.camera.azimuth);
      const sinAz = Math.sin(this.renderer.camera.azimuth);
      const rightX = cosAz, rightZ = -sinAz;

      const pullX = (this.mouseVelocity.x * rightX) * 22.0;
      const pullZ = (this.mouseVelocity.x * rightZ) * 22.0;
      const pullY = (-this.mouseVelocity.y) * 22.0;

      b.velocity.x = (b.velocity.x + pullX * 0.4) * 0.88;
      b.velocity.y = (b.velocity.y + pullY * 0.4) * 0.88;
      b.velocity.z = (b.velocity.z + pullZ * 0.4) * 0.88;
    }
  }

  private triggerShockwave(pos: Vec2): void {
    if (this.activeDimension === '2d' && this.world2D) {
      this.world2D.applyExplosion(pos, 280, 1000);
    } else if (this.activeDimension === '3d' && this.world3D) {
      this.world3D.applyExplosion({ x: 0, y: 150, z: 0 }, 350, 1200);
    } else if (this.activeDimension === '4d' && this.world4D) {
      this.world4D.applyExplosion({ x: 0, y: 150, z: 0, w: 0 }, 400, 1400);
    }
  }

  private bindDomElements(): void {
    // Dimension Switcher Buttons
    document.getElementById('btn-dim-2d')?.addEventListener('click', () => {
      this.setDimension('2d');
      this.callbacks.spawnPyramid2D();
    });
    document.getElementById('btn-dim-3d')?.addEventListener('click', () => {
      this.setDimension('3d');
      this.callbacks.spawnCubeMatrix3D();
    });
    document.getElementById('btn-dim-4d')?.addEventListener('click', () => {
      this.setDimension('4d');
      this.callbacks.spawnRotatingTesseract4D();
    });

    // Real-World Motion Sensor Toggle Button
    const btnSensor = document.getElementById('btn-sensor-toggle');
    if (btnSensor) {
      btnSensor.addEventListener('click', async () => {
        const isNowActive = await this.sensor.toggle();
        btnSensor.textContent = isNowActive ? '📱 Motion Sensor Active' : '📱 Enable Motion Sensor';
        btnSensor.classList.toggle('btn-primary', isNowActive);
      });
    }

    // Spawner Mode Toggle Button
    const btnSpawnerToggle = document.getElementById('btn-spawner-toggle');
    if (btnSpawnerToggle) {
      btnSpawnerToggle.addEventListener('click', () => {
        this.spawner.enabled = !this.spawner.enabled;
        btnSpawnerToggle.textContent = this.spawner.enabled ? '🛠️ Spawner: ON' : '🛠️ Spawner: OFF';
        btnSpawnerToggle.classList.toggle('btn-primary', this.spawner.enabled);
      });
    }

    // Spawner Shape Buttons
    const shapeButtons = document.querySelectorAll('[data-shape]');
    shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const shp = btn.getAttribute('data-shape') || 'circle';
        this.spawner.setShape(shp);
        shapeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Gravity Slider
    const gravSlider = document.getElementById('slider-gravity') as HTMLInputElement | null;
    const gravVal = document.getElementById('val-gravity');
    gravSlider?.addEventListener('input', () => {
      const val = parseFloat(gravSlider.value);
      this.sensor.baseMagnitude = val;
      if (this.world2D) this.world2D.setGravity(0, val);
      if (this.world3D) this.world3D.setGravity(0, -val, 0);
      if (this.world4D) this.world4D.setGravity(0, -val, 0, 0);
      if (gravVal) gravVal.textContent = `${val.toFixed(0)} px·s⁻²`;
    });

    // Restitution Slider
    const restSlider = document.getElementById('slider-restitution') as HTMLInputElement | null;
    const restVal = document.getElementById('val-restitution');
    restSlider?.addEventListener('input', () => {
      const val = parseFloat(restSlider.value);
      this.world2D?.setGlobalRestitution(val);
      this.world3D?.setGlobalRestitution(val);
      this.world4D?.setGlobalRestitution(val);
      this.spawner.material.restitution = val;
      if (restVal) restVal.textContent = val.toFixed(2);
    });

    // Friction Slider
    const fricSlider = document.getElementById('slider-friction') as HTMLInputElement | null;
    const fricVal = document.getElementById('val-friction');
    fricSlider?.addEventListener('input', () => {
      const val = parseFloat(fricSlider.value);
      this.world2D?.setGlobalFriction(val);
      this.world3D?.setGlobalFriction(val);
      this.world4D?.setGlobalFriction(val);
      this.spawner.material.friction = val;
      if (fricVal) fricVal.textContent = val.toFixed(2);
    });

    // 4D XW Hyper-Spin Slider
    const sliderXW = document.getElementById('slider-hyper-xw') as HTMLInputElement | null;
    const valXW = document.getElementById('val-hyper-xw');
    sliderXW?.addEventListener('input', () => {
      const val = parseFloat(sliderXW.value);
      if (this.world4D) this.world4D.hyperSpinXW = val;
      if (valXW) valXW.textContent = `${val.toFixed(1)} rad/s`;
    });

    // 4D ZW Hyper-Spin Slider
    const sliderZW = document.getElementById('slider-hyper-zw') as HTMLInputElement | null;
    const valZW = document.getElementById('val-hyper-zw');
    sliderZW?.addEventListener('input', () => {
      const val = parseFloat(sliderZW.value);
      if (this.world4D) this.world4D.hyperSpinZW = val;
      if (valZW) valZW.textContent = `${val.toFixed(1)} rad/s`;
    });

    // 2D Presets
    document.getElementById('btn-preset-2d-pyramid')?.addEventListener('click', () => this.callbacks.spawnPyramid2D());
    document.getElementById('btn-preset-2d-dominoes')?.addEventListener('click', () => this.callbacks.spawnDominoes2D());
    document.getElementById('btn-preset-2d-circles')?.addEventListener('click', () => this.callbacks.spawnCircles2D());
    document.getElementById('btn-preset-2d-cradle')?.addEventListener('click', () => this.callbacks.spawnCradle2D());
    document.getElementById('btn-preset-2d-chaos')?.addEventListener('click', () => this.callbacks.spawnChaos2D());

    // 3D Presets
    document.getElementById('btn-preset-3d-matrix')?.addEventListener('click', () => this.callbacks.spawnCubeMatrix3D());
    document.getElementById('btn-preset-3d-orbital')?.addEventListener('click', () => this.callbacks.spawnOrbitalSpheres3D());
    document.getElementById('btn-preset-3d-tower')?.addEventListener('click', () => this.callbacks.spawnStackTower3D());
    document.getElementById('btn-preset-3d-chaos')?.addEventListener('click', () => this.callbacks.spawnChaos3D());

    // 4D Presets
    document.getElementById('btn-preset-4d-tesseract')?.addEventListener('click', () => this.callbacks.spawnRotatingTesseract4D());
    document.getElementById('btn-preset-4d-hyperspheres')?.addEventListener('click', () => this.callbacks.spawnHyperSphereCascade4D());
    document.getElementById('btn-preset-4d-chaos')?.addEventListener('click', () => this.callbacks.spawnChaos4D());

    // Clear World
    document.getElementById('btn-clear-world')?.addEventListener('click', () => {
      this.callbacks.clearWorld();
      this.spawner.enabled = true;
      if (btnSpawnerToggle) {
        btnSpawnerToggle.textContent = '🛠️ Spawner: ON';
        btnSpawnerToggle.classList.add('btn-primary');
      }
    });

    // Pause / Play
    const btnPause = document.getElementById('btn-pause');
    btnPause?.addEventListener('click', () => {
      const isPaused = !this.world2D?.isPaused;
      this.world2D?.setPaused(isPaused);
      this.world3D?.setPaused(isPaused);
      this.world4D?.setPaused(isPaused);
      if (btnPause) btnPause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
    });

    // Shockwave Button
    document.getElementById('btn-blast')?.addEventListener('click', () => {
      const cx = this.canvas.width * 0.5;
      const cy = this.canvas.height * 0.5;
      this.triggerShockwave(new Vec2(cx, cy));
    });
  }

  private updatePresetButtonsVisibility(): void {
    const p2d = document.getElementById('presets-2d');
    const p3d = document.getElementById('presets-3d');
    const p4d = document.getElementById('presets-4d');
    const panel4d = document.getElementById('controls-4d-hyper');

    if (p2d) p2d.style.display = this.activeDimension === '2d' ? 'grid' : 'none';
    if (p3d) p3d.style.display = this.activeDimension === '3d' ? 'grid' : 'none';
    if (p4d) p4d.style.display = this.activeDimension === '4d' ? 'grid' : 'none';
    if (panel4d) panel4d.style.display = this.activeDimension === '4d' ? 'block' : 'none';
  }

  public getMouseRenderState(): MouseRenderState | null {
    if (this.isGrabbingBody) {
      if (this.activeDimension === '2d' && this.selectedBody2D) {
        return {
          isDragging: true,
          mousePos: this.mouseWorld,
          bodyPos: this.selectedBody2D.position
        };
      }
      if (this.activeDimension === '3d' && this.selectedBody3D) {
        const sPos = new Vec2();
        this.renderer.camera.projectPoint(
          this.selectedBody3D.position,
          this.renderer.width,
          this.renderer.height,
          sPos
        );
        return {
          isDragging: true,
          mousePos: this.mouseWorld,
          bodyPos: sPos
        };
      }
      if (this.activeDimension === '4d' && this.selectedBody4D) {
        const v3 = new Vec3();
        const sPos = new Vec2();
        this.renderer.proj4D.project4DTo3D(this.selectedBody4D.position, v3);
        this.renderer.camera.projectPoint(
          v3,
          this.renderer.width,
          this.renderer.height,
          sPos
        );
        return {
          isDragging: true,
          mousePos: this.mouseWorld,
          bodyPos: sPos
        };
      }
    }
    return null;
  }

  public updateTelemetry(): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;

    if (elapsed >= 500) {
      if (elapsed != 0) {
        this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      }
      this.frameCount = 0;
      this.lastFpsUpdate = now;

      let bodyCount = 0;
      let contactCount = 0;
      let particleCount = 0;

      if (this.activeDimension === '2d' && this.world2D) {
        bodyCount = this.world2D.getBodyCount();
        contactCount = this.world2D.getContactCount();
        particleCount = this.world2D.getParticleCount();
      } else if (this.activeDimension === '3d' && this.world3D) {
        bodyCount = this.world3D.getBodyCount();
        contactCount = this.world3D.getContactCount();
        particleCount = this.world3D.getParticleCount();
      } else if (this.activeDimension === '4d' && this.world4D) {
        bodyCount = this.world4D.getBodyCount();
        contactCount = this.world4D.getContactCount();
        particleCount = this.world4D.getParticleCount();
      }

      const elFps = document.getElementById('stat-fps');
      const elBodies = document.getElementById('stat-bodies');
      const elParticles = document.getElementById('stat-particles');
      const elContacts = document.getElementById('stat-contacts');

      if (elFps) elFps.textContent = `${this.currentFps} FPS`;
      if (elBodies) elBodies.textContent = `${bodyCount}`;
      if (elParticles) elParticles.textContent = `${particleCount}`;
      if (elContacts) elContacts.textContent = `${contactCount}`;
    }
  }
}
