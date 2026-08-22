import { Vec2 } from '../math/vec2';
import { Vec3 } from '../math/vec3';
import { Vec4 } from '../math/vec4';
import {
  PhysicsWorld2D,
  PhysicsWorld3D,
  RigidBody3D,
  PhysicsWorld4D,
  RigidBody4D
} from '../physics';
import { OrbitCamera } from './camera';
import { Projection4D } from './projection4d';

export interface DebugOptions {
  showVelocities: boolean;
  showContacts: boolean;
  showAABBs: boolean;
  showGrid: boolean;
}

export interface SpawnerRenderState {
  isActive: boolean;
  shape: string;
  startWorld: { x: number; y: number; z?: number; w?: number };
  currentWorld: { x: number; y: number; z?: number; w?: number };
  flingVelocity?: { x: number; y: number; z?: number; w?: number };
  color: string;
  size: number;
}

export interface MouseRenderState {
  isDragging: boolean;
  mousePos: Vec2;
  bodyPos: Vec2;
}

interface ShadedPolygon3D {
  points: [Vec2, Vec2, Vec2, Vec2];
  depth: number;
  color: string;
  edgeColor: string;
}

/**
 * Renderer - Unified Multi-Dimensional Hardware-Accelerated Canvas Engine.
 * Renders 2D, 3D (with Painter's Algorithm Depth Sort), and 4D Hyper-Physics with Chromatic Depth Shifts.
 */
export class Renderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public dpr: number = 1.0;
  public width: number = 1280;
  public height: number = 720;

  public camera: OrbitCamera = new OrbitCamera();
  public proj4D: Projection4D = new Projection4D(450);

  public debug: DebugOptions = {
    showVelocities: false,
    showContacts: true,
    showAABBs: false,
    showGrid: true
  };

  private scratchPolygonList: ShadedPolygon3D[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }
    this.ctx = context;
    this.updateDPR();

    // Pre-allocate shaded polygon buffer
    for (let i = 0; i < 512; i++) {
      this.scratchPolygonList?.push({
        points: [new Vec2(), new Vec2(), new Vec2(), new Vec2()],
        depth: 0,
        color: '',
        edgeColor: ''
      });
    }
  }

  public updateDPR(): void {
    this.dpr = window?.devicePixelRatio || 1.0;
  }

  public resize(displayWidth: number, displayHeight: number): void {
    this.updateDPR();
    this.width = Math.max(300, displayWidth);
    this.height = Math.max(300, displayHeight);

    const ratio = this.dpr;
    this.canvas.width = Math.floor(this.width * ratio);
    this.canvas.height = Math.floor(this.height * ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx?.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx?.scale(ratio, ratio);

    this.camera?.updateMatrices(this.width, this.height);
  }

  // ==========================================
  // 2D RENDER PIPELINE
  // ==========================================

  public render2D(
    world: PhysicsWorld2D,
    spawnerState?: SpawnerRenderState,
    mouseState?: MouseRenderState | null
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.renderBackground2D(ctx, w, h);

    const bodies = world.bodies;
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const b = bodies.at(i);
      if (!b) continue;

      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);

      if (b.type === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.isSleeping ? 'rgba(100, 116, 139, 0.7)' : (b.isStatic ? 'rgba(71, 85, 105, 0.9)' : b.color);
        ctx.fill();

        ctx.lineWidth = b.isStatic ? 2 : 2.5;
        ctx.strokeStyle = b.isSleeping ? '#64748b' : (b.isStatic ? '#94a3b8' : '#ffffff');
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(b.radius - 2, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (b.type === 'capsule') {
        const r = b.radius;
        const halfL = (b.length || 40) * 0.5;
        ctx.beginPath();
        ctx.arc(0, -halfL, r, Math.PI, 0, false);
        ctx.arc(0, halfL, r, 0, Math.PI, false);
        ctx.closePath();
        ctx.fillStyle = b.isSleeping ? 'rgba(100, 116, 139, 0.7)' : (b.isStatic ? 'rgba(71, 85, 105, 0.9)' : b.color);
        ctx.fill();

        ctx.lineWidth = b.isStatic ? 2 : 2.5;
        ctx.strokeStyle = b.isSleeping ? '#64748b' : (b.isStatic ? '#94a3b8' : '#ffffff');
        ctx.stroke();
      } else {
        const hw = b.halfExtents.x;
        const hh = b.halfExtents.y;
        ctx.beginPath();
        ctx.rect(-hw, -hh, b.width, b.height);
        ctx.fillStyle = b.isSleeping ? 'rgba(100, 116, 139, 0.7)' : (b.isStatic ? 'rgba(71, 85, 105, 0.9)' : b.color);
        ctx.fill();

        ctx.lineWidth = b.isStatic ? 2 : 2.5;
        ctx.strokeStyle = b.isSleeping ? '#64748b' : (b.isStatic ? '#94a3b8' : '#ffffff');
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(hw * 0.7, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render 2D Particles
    this.renderParticles2D(ctx, world);

    // Render Mouse Dragging Spring Line
    if (mouseState && mouseState.isDragging) {
      this.renderMouseJoint(ctx, mouseState);
    }

    // Render Mouse Spring Line in 4D
    if (mouseState && mouseState.isDragging) {
      this.renderMouseJoint(ctx, mouseState);
    }

    // Render Spawner Preview
    if (spawnerState && spawnerState.isActive) {
      this.renderSpawnerPreview2D(ctx, spawnerState);
    }
  }

  private renderBackground2D(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createRadialGradient(w * 0.5, h * 0.45, 40, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    grad?.addColorStop(0, 'rgba(30, 41, 59, 0.55)');
    grad?.addColorStop(1, 'rgba(9, 13, 22, 0.98)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    if (this.debug.showGrid) {
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gridSize = 50;
      for (let x = 0; x <= w; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    }
  }

  private renderParticles2D(ctx: CanvasRenderingContext2D, world: PhysicsWorld2D): void {
    const particles = world.particlePool.particles;
    const count = particles.length;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < count; i++) {
      const p = particles.at(i);
      if (!p || !p.active) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.position.x, p.position.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private renderSpawnerPreview2D(ctx: CanvasRenderingContext2D, sp: SpawnerRenderState): void {
    ctx.save();
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);

    const sx = sp.startWorld.x;
    const sy = sp.startWorld.y;
    const cx = sp.currentWorld.x;
    const cy = sp.currentWorld.y;

    const dx = cx - sx;
    const dy = cy - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.max(15, dist);

    if (sp.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const w = Math.max(20, Math.abs(dx) * 2);
      const h = Math.max(20, Math.abs(dy) * 2);
      ctx.strokeRect(sx - w * 0.5, sy - h * 0.5, w, h);
    }

    // Velocity Fling Vector
    if (sp.flingVelocity) {
      ctx.setLineDash([]);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + sp.flingVelocity.x * 0.5, sy + sp.flingVelocity.y * 0.5);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderMouseJoint(ctx: CanvasRenderingContext2D, mouseState: MouseRenderState): void {
    const mousePos = mouseState.mousePos;
    const bodyPos = mouseState.bodyPos;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(mousePos.x, mousePos.y);
    ctx.lineTo(bodyPos.x, bodyPos.y);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(mousePos.x, mousePos.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.restore();
  }

  // ==========================================
  // 3D RENDER PIPELINE (Shaded Faces + Depth Sort)
  // ==========================================

  public render3D(
    world: PhysicsWorld3D,
    spawnerState?: SpawnerRenderState,
    mouseState?: MouseRenderState | null
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.camera?.updateMatrices(w, h);

    // 1. Dark Modern Background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, w, h);

    // 2. 3D Perspective Ground Grid
    this.renderGroundGrid3D(ctx, world);

    // 3. 3D Bounding Cage
    this.renderBoundingCage3D(ctx, world);

    // 4. Collect & Depth-Sort 3D Polygons (Painter's Algorithm)
    let polyCount = 0;
    const bodies = world.bodies;
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const b = bodies.at(i);
      if (!b) continue;

      if (b.type === 'cube') {
        polyCount = this.collectCubePolygons(b, polyCount);
      }
    }

    // Sort polygons back-to-front (highest depth drawn first)
    const activePolys = this.scratchPolygonList.slice(0, polyCount);
    activePolys.sort((p1, p2) => p2.depth - p1.depth);

    // Render Shaded Faces
    for (let i = 0; i < activePolys.length; i++) {
      const poly = activePolys.at(i);
      if (!poly) continue;

      ctx.beginPath();
      ctx.moveTo(poly.points[0].x, poly.points[0].y);
      ctx.lineTo(poly.points[1].x, poly.points[1].y);
      ctx.lineTo(poly.points[2].x, poly.points[2].y);
      ctx.lineTo(poly.points[3].x, poly.points[3].y);
      ctx.closePath();

      ctx.fillStyle = poly.color;
      ctx.fill();

      ctx.strokeStyle = poly.edgeColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Render 3D Spheres & Capsules
    for (let i = 0; i < count; i++) {
      const b = bodies.at(i);
      if (!b) continue;
      if (b.type === 'sphere') {
        this.renderSphere3D(ctx, b);
      } else if (b.type === 'capsule') {
        this.renderCapsule3D(ctx, b);
      }
    }

    // Render 3D Particles
    this.renderParticles3D(ctx, world);

    // Render Mouse Dragging Spring Line in 3D
    if (mouseState && mouseState.isDragging) {
      this.renderMouseJoint(ctx, mouseState);
    }

    // Render Mouse Spring Line in 4D
    if (mouseState && mouseState.isDragging) {
      this.renderMouseJoint(ctx, mouseState);
    }

    // Render Spawner Preview
    if (spawnerState && spawnerState.isActive) {
      this.renderSpawnerPreview3D(ctx, spawnerState);
    }
  }

  private collectCubePolygons(b: RigidBody3D, offset: number): number {
    const v = b.vertices;
    const w = this.width;
    const h = this.height;

    // Project 8 vertices
    const pScreen: Vec2[] = [];
    const pDepths: number[] = [];

    for (let i = 0; i < 8; i++) {
      const pWorld = v.at(i) ?? b.position;
      const scr = new Vec2();
      const proj = this.camera.projectPoint(pWorld, w, h, scr);
      pScreen?.push(scr);
      pDepths?.push(proj.depth);
    }

    // 6 Cube Faces defined by vertex indices
    const faces = [
      [0, 1, 2, 3], // Back
      [4, 5, 6, 7], // Front
      [0, 1, 5, 4], // Bottom
      [2, 3, 7, 6], // Top
      [0, 3, 7, 4], // Left
      [1, 2, 6, 5]  // Right
    ];

    let currentIdx = offset;

    for (let f = 0; f < 6; f++) {
      if (currentIdx >= this.scratchPolygonList.length) break;

      const fIndices = faces.at(f) ?? [0, 1, 2, 3];
      const i0 = fIndices.at(0) ?? 0;
      const i1 = fIndices.at(1) ?? 1;
      const i2 = fIndices.at(2) ?? 2;
      const i3 = fIndices.at(3) ?? 3;

      const p0 = pScreen.at(i0) ?? new Vec2();
      const p1 = pScreen.at(i1) ?? new Vec2();
      const p2 = pScreen.at(i2) ?? new Vec2();
      const p3 = pScreen.at(i3) ?? new Vec2();

      const cross = (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x);
      if (cross <= 0) continue;

      const avgDepth = ((pDepths.at(i0) ?? 0) + (pDepths.at(i1) ?? 0) + (pDepths.at(i2) ?? 0) + (pDepths.at(i3) ?? 0)) * 0.25;

      const targetPoly = this.scratchPolygonList.at(currentIdx);
      if (targetPoly) {
        targetPoly.points[0]?.copy(p0);
        targetPoly.points[1]?.copy(p1);
        targetPoly.points[2]?.copy(p2);
        targetPoly.points[3]?.copy(p3);
        targetPoly.depth = avgDepth;

        targetPoly.color = b.isStatic ? 'rgba(71, 85, 105, 0.45)' : 'rgba(56, 189, 248, 0.25)';
        targetPoly.edgeColor = b.isStatic ? '#94a3b8' : b.color;
        currentIdx++;
      }
    }

    return currentIdx;
  }

  private renderSphere3D(ctx: CanvasRenderingContext2D, b: RigidBody3D): void {
    const w = this.width;
    const h = this.height;

    const centerScreen = new Vec2();
    const proj = this.camera.projectPoint(b.position, w, h, centerScreen);
    if (!proj.visible || proj.depth <= 0) return;

    const pEdge = new Vec3(b.position.x + b.radius, b.position.y, b.position.z);
    const edgeScreen = new Vec2();
    this.camera.projectPoint(pEdge, w, h, edgeScreen);
    const screenRadius = Math.max(4, Math.abs(edgeScreen.x - centerScreen.x));

    const grad = ctx.createRadialGradient(
      centerScreen.x - screenRadius * 0.3,
      centerScreen.y - screenRadius * 0.3,
      screenRadius * 0.1,
      centerScreen.x,
      centerScreen.y,
      screenRadius
    );
    grad?.addColorStop(0, '#ffffff');
    grad?.addColorStop(0.3, b.color);
    grad?.addColorStop(1, 'rgba(15, 23, 42, 0.85)');

    ctx.beginPath();
    ctx.arc(centerScreen.x, centerScreen.y, screenRadius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private renderCapsule3D(ctx: CanvasRenderingContext2D, b: RigidBody3D): void {
    const p1 = new Vec3(), p2 = new Vec3();
    const halfL = (b.length || 40) * 0.5;
    const localAxis = new Vec3(0, halfL, 0);
    const worldOffset = b.orientation.rotateVec3(localAxis);
    p1.set(b.position.x - worldOffset.x, b.position.y - worldOffset.y, b.position.z - worldOffset.z);
    p2.set(b.position.x + worldOffset.x, b.position.y + worldOffset.y, b.position.z + worldOffset.z);

    const s1 = new Vec2(), s2 = new Vec2();
    const pr1 = this.camera.projectPoint(p1, this.width, this.height, s1);
    const pr2 = this.camera.projectPoint(p2, this.width, this.height, s2);
    if (!pr1.visible && !pr2.visible) return;

    const scale1 = Math.max(0.1, 400.0 / (Math.max(1, pr1.depth) + 400.0));
    const r1 = Math.max(4, b.radius * scale1);
    const scale2 = Math.max(0.1, 400.0 / (Math.max(1, pr2.depth) + 400.0));
    const r2 = Math.max(4, b.radius * scale2);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s1.x, s1.y);
    ctx.lineTo(s2.x, s2.y);
    ctx.lineWidth = (r1 + r2);
    ctx.strokeStyle = b.isSleeping ? 'rgba(100, 116, 139, 0.6)' : b.color;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(s1.x, s1.y, r1, 0, Math.PI * 2);
    ctx.arc(s2.x, s2.y, r2, 0, Math.PI * 2);
    ctx.fillStyle = b.isSleeping ? 'rgba(100, 116, 139, 0.8)' : b.color;
    ctx.fill();
    ctx.restore();
  }

  private renderGroundGrid3D(ctx: CanvasRenderingContext2D, world: PhysicsWorld3D): void {
    const halfW = world.bounds.width * 0.5;
    const halfD = world.bounds.depth * 0.5;
    const step = 80;

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;

    const pA = new Vec3();
    const pB = new Vec3();
    const sA = new Vec2();
    const sB = new Vec2();

    for (let x = -halfW; x <= halfW; x += step) {
      pA.set(x, 0, -halfD);
      pB.set(x, 0, halfD);
      const prA = this.camera.projectPoint(pA, this.width, this.height, sA);
      const prB = this.camera.projectPoint(pB, this.width, this.height, sB);
      if (prA.visible || prB.visible) {
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();
      }
    }

    for (let z = -halfD; z <= halfD; z += step) {
      pA.set(-halfW, 0, z);
      pB.set(halfW, 0, z);
      const prA = this.camera.projectPoint(pA, this.width, this.height, sA);
      const prB = this.camera.projectPoint(pB, this.width, this.height, sB);
      if (prA.visible || prB.visible) {
        ctx.beginPath();
        ctx.moveTo(sA.x, sA.y);
        ctx.lineTo(sB.x, sB.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private renderBoundingCage3D(ctx: CanvasRenderingContext2D, world: PhysicsWorld3D): void {
    const halfW = world.bounds.width * 0.5;
    const halfD = world.bounds.depth * 0.5;
    const H = world.bounds.height;

    const corners = [
      new Vec3(-halfW, 0, -halfD), new Vec3(halfW, 0, -halfD),
      new Vec3(halfW, 0, halfD),   new Vec3(-halfW, 0, halfD),
      new Vec3(-halfW, H, -halfD), new Vec3(halfW, H, -halfD),
      new Vec3(halfW, H, halfD),   new Vec3(-halfW, H, halfD)
    ];

    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    const sA = new Vec2();
    const sB = new Vec2();

    for (let i = 0; i < edges.length; i++) {
      const e = edges.at(i) ?? [0, 1];
      const pA = corners.at(e[0]) ?? corners[0];
      const pB = corners.at(e[1]) ?? corners[1];

      this.camera.projectPoint(pA, this.width, this.height, sA);
      this.camera.projectPoint(pB, this.width, this.height, sB);

      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderParticles3D(ctx: CanvasRenderingContext2D, world: PhysicsWorld3D): void {
    const particles = world.particlePool.particles;
    const count = particles.length;
    const sPos = new Vec2();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < count; i++) {
      const p = particles.at(i);
      if (!p || !p.active) continue;

      const proj = this.camera.projectPoint(p.position, this.width, this.height, sPos);
      if (!proj.visible || proj.depth <= 0) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private renderSpawnerPreview3D(ctx: CanvasRenderingContext2D, sp: SpawnerRenderState): void {
    const pWorld = new Vec3(sp.startWorld.x, sp.startWorld.y, sp.startWorld.z ?? 0);
    const sPos = new Vec2();
    const proj = this.camera.projectPoint(pWorld, this.width, this.height, sPos);

    if (!proj.visible) return;

    ctx.save();
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, 25, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  // ==========================================
  // 4D HYPER-PHYSICS RENDER PIPELINE (SO(4) Wireframe & Chromatic Depth Cueing)
  // ==========================================

  public render4D(world: PhysicsWorld4D, spawnerState?: SpawnerRenderState, mouseState?: MouseRenderState | null): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    this.camera?.updateMatrices(w, h);

    // Deep Dark Ambient
    ctx.fillStyle = '#060911';
    ctx.fillRect(0, 0, w, h);

    // Render 4D Tech Floor Grid
    this.renderGroundGrid4D(ctx, world);

    // Render 4D Hyper-Bodies
    const bodies = world.bodies;
    const count = bodies.length;

    for (let i = 0; i < count; i++) {
      const b = bodies.at(i);
      if (!b) continue;

      if (b.type === 'tesseract') {
        this.renderTesseract4D(ctx, b);
      } else {
        this.renderHyperSphere4D(ctx, b);
      }
    }

    // Render 4D Particles
    this.renderParticles4D(ctx, world);

    // Render Mouse Spring Line in 4D
    if (mouseState && mouseState.isDragging) {
      this.renderMouseJoint(ctx, mouseState);
    }

    // Render Spawner Preview
    if (spawnerState && spawnerState.isActive) {
      this.renderSpawnerPreview4D(ctx, spawnerState);
    }
  }

  private renderTesseract4D(ctx: CanvasRenderingContext2D, b: RigidBody4D): void {
    const v4 = b.vertices;
    const p3: Vec3[] = [];
    const p2: Vec2[] = [];

    // Project 16 4D Vertices -> 3D -> 2D
    for (let i = 0; i < 16; i++) {
      const vert4 = v4.at(i) ?? b.position;
      const v3 = new Vec3();
      this.proj4D.project4DTo3D(vert4, v3);
      p3?.push(v3);

      const v2 = new Vec2();
      this.camera.projectPoint(v3, this.width, this.height, v2);
      p2?.push(v2);
    }

    // 32 Edges connecting vertices that differ by exactly 1 bit
    ctx.save();
    ctx.lineWidth = 2.0;

    for (let i = 0; i < 16; i++) {
      for (let bit = 0; bit < 4; bit++) {
        const j = i ^ (1 << bit);
        if (i < j) {
          const sA = p2.at(i) ?? p2[0];
          const sB = p2.at(j) ?? p2[1];
          const orig4A = v4.at(i) ?? b.position;

          ctx.strokeStyle = this.proj4D.getDepthCueColor(orig4A.w, 0.85);
          ctx.beginPath();
          ctx.moveTo(sA.x, sA.y);
          ctx.lineTo(sB.x, sB.y);
          ctx.stroke();
        }
      }
    }

    // Render 16 Vertex Glowing Nodes
    for (let i = 0; i < 16; i++) {
      const pt = p2.at(i);
      const orig4 = v4.at(i) ?? b.position;
      if (pt) {
        ctx.fillStyle = this.proj4D.getDepthCueColor(orig4.w, 1.0);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private renderHyperSphere4D(ctx: CanvasRenderingContext2D, b: RigidBody4D): void {
    const center3 = new Vec3();
    this.proj4D.project4DTo3D(b.position, center3);

    const center2 = new Vec2();
    const proj = this.camera.projectPoint(center3, this.width, this.height, center2);
    if (!proj.visible || proj.depth <= 0) return;

    const r = b.radius;
    const color = this.proj4D.getDepthCueColor(b.position.w, 0.9);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    for (let ring = 0; ring < 4; ring++) {
      const ringScale = 0.4 + ring * 0.22;
      ctx.beginPath();
      ctx.ellipse(center2.x, center2.y, r * ringScale * 1.5, r * ringScale, (ring * Math.PI) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = this.proj4D.getDepthCueColor(b.position.w, 0.3);
    ctx.beginPath();
    ctx.arc(center2.x, center2.y, r * 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private renderGroundGrid4D(ctx: CanvasRenderingContext2D, world: PhysicsWorld4D): void {
    const halfW = world.bounds.width * 0.5;
    const halfD = world.bounds.depth * 0.5;
    const step = 90;

    ctx.save();
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.15)';
    ctx.lineWidth = 1;

    const pA = new Vec3();
    const pB = new Vec3();
    const sA = new Vec2();
    const sB = new Vec2();

    for (let x = -halfW; x <= halfW; x += step) {
      pA.set(x, 0, -halfD);
      pB.set(x, 0, halfD);
      this.camera.projectPoint(pA, this.width, this.height, sA);
      this.camera.projectPoint(pB, this.width, this.height, sB);
      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.stroke();
    }

    for (let z = -halfD; z <= halfD; z += step) {
      pA.set(-halfW, 0, z);
      pB.set(halfW, 0, z);
      this.camera.projectPoint(pA, this.width, this.height, sA);
      this.camera.projectPoint(pB, this.width, this.height, sB);
      ctx.beginPath();
      ctx.moveTo(sA.x, sA.y);
      ctx.lineTo(sB.x, sB.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  private renderParticles4D(ctx: CanvasRenderingContext2D, world: PhysicsWorld4D): void {
    const particles = world.particlePool.particles;
    const count = particles.length;
    const p3 = new Vec3();
    const sPos = new Vec2();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < count; i++) {
      const p = particles.at(i);
      if (!p || !p.active) continue;

      this.proj4D.project4DTo3D(p.position, p3);
      const proj = this.camera.projectPoint(p3, this.width, this.height, sPos);
      if (!proj.visible || proj.depth <= 0) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private renderSpawnerPreview4D(ctx: CanvasRenderingContext2D, sp: SpawnerRenderState): void {
    const p4 = new Vec4(sp.startWorld.x, sp.startWorld.y, sp.startWorld.z ?? 0, sp.startWorld.w ?? 0);
    const p3 = new Vec3();
    this.proj4D.project4DTo3D(p4, p3);

    const sPos = new Vec2();
    const proj = this.camera.projectPoint(p3, this.width, this.height, sPos);
    if (!proj.visible) return;

    ctx.save();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);

    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, 30, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

