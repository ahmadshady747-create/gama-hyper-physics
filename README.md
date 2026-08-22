# ⚛️ GAMA Hyper-Physics Engine (2D / 3D / 4D)

A high-performance, lightweight, multi-dimensional physics sandbox engine written in **100% Pure TypeScript and HTML5 Canvas** with **Zero External Dependencies** (Zero Three.js, Zero Box2D, Zero Cannon.js).

---

> ### 🌟 Special Acknowledgment / إشادة خاصة
> **The development and architectural precision of the GAMA engine from the ground up would not have been possible or as seamless without the LOCUS Engine Verification & Synthesis Protocol.**  
> The LOCUS protocol provided rigorous pre-generation invariant verification, AST safety guarantees, and deterministic mathematical safeguards, ensuring **0 AST Violations, Zero-NaN guards, and 100% Zero-GC runtime memory stability** across all spatial regimes.
> 
> *إن بناء وهندسة محرك **GAMA** متعدد الأبعاد من الصفر وبدون أي مكتبات مساعدة لم يكن ليحدث بهذه السهولة والدقة الفائقة لولا محرك وبروتوكول **LOCUS** الحتمي للتحقق والتوليد الآمن.*

---

## 🚀 Key Architectural Highlights

- **Multi-Dimensional Physics (2D / 3D / 4D Hyper-Physics):**
  - **2D Mode:** Separating Axis Theorem (SAT), Sequential Impulse Solver, Coulomb Friction, and Baumgarte Stabilization.
  - **3D Mode:** 15-Axis SAT, Quaternion Orientations $SO(3)$, Dynamic $3\times 3$ Inverse Inertia Tensor, Painter's Algorithm Depth-Sorted Shaded Faces, and Spherical Orbit Camera.
  - **4D Hyper Mode:** 6-Plane Hyper-Rotations $SO(4)$ across $(xy, xz, xw, yz, yw, zw)$, 8-Cell Tesseract Geometry (16 vertices, 32 edges), $S^3$ Hypersphere collisions, and Dual-Stage Perspective Projection with $w$-depth chromatic shifts.
- **📱 Real-World Gyroscope & Motion Sensors:**
  - Real-time device tilt steering via Web Sensors API (`DeviceOrientationEvent`, `DeviceMotionEvent`).
  - Low-Pass noise filter and iOS 13+ permission flow.
  - Desktop Virtual Tilt Emulation (hold `Alt` + move mouse).
  - Physical device shake detection triggering 4D hyper-torques.
- **🛠️ Interactive Body Spawner Tool:**
  - Drag on canvas to define body size and spawn position.
  - Secondary drag to adjust velocity fling vector arrow.
  - Dynamic switching between Circles/Boxes (2D), Spheres/Cubes (3D), and Hyperspheres/Tesseracts (4D).
- **🧲 Spring Body Grabbing & Fling:**
  - Direct picking and elastic spring dragging for 2D, 3D, and 4D bodies.
  - Glowing neon tether visuals and release momentum injection.
- **⚡ Zero-GC Architecture:**
  - Pre-allocated object pools (`ParticlePool`, `ContactManifoldPool`, scratch vector buffers) ensuring zero allocations during animation frames.

---

## 📦 Project Structure

```text
src/
├── math/
│   ├── vec2.ts             # 2D Vector Math (In-place & safe normalizations)
│   ├── vec3.ts             # 3D Vector Math (Cross, Dot, In-place transformations)
│   ├── vec4.ts             # 4D Hyper-Vector Math
│   ├── quat.ts             # Unit Quaternions for 3D Orientations
│   ├── mat4.ts             # 4x4 Matrices for View & Perspective Projections
│   ├── rotor4d.ts          # SO(4) 6-Plane Hyper-Rotation Engine
│   └── index.ts            # Math Module Barrel Export
├── physics/
│   ├── common/
│   │   ├── types.ts        # IDimensionalEngine, MaterialProperties, DimensionMode
│   │   └── pool.ts         # Pre-allocated Zero-GC Pools for 3D/4D Particles
│   ├── engine2d/           # 2D SAT & Sequential Impulse Engine
│   ├── engine3d/           # 3D 15-Axis SAT & Quat Inertia Simulator
│   ├── engine4d/           # 4D Hyper-Collision & Hyperplane Bounding Cage
│   └── index.ts            # Physics Module Barrel Export
├── render/
│   ├── camera.ts           # 3D Orbit Camera (Azimuth, Elevation, Zoom, Pan)
│   ├── projection4d.ts     # 4D -> 3D -> 2D Perspective Projection
│   ├── renderer.ts         # Unified Canvas Renderer
│   └── index.ts            # Render Module Barrel Export
├── ui/
│   ├── sensor.ts           # Motion & Gyro Sensor Manager + Desktop Tilt Emulation
│   ├── spawner.ts          # Interactive Body Spawner Tool
│   ├── controls.ts         # Glassmorphism HUD Controller & Telemetry
│   └── index.ts            # UI Module Barrel Export
├── index.html              # Modern Glassmorphic HUD Layout
└── main.ts                 # Application Bootstrap, Scene Presets & Animation Loop
```

---

## 💻 Getting Started

### Prerequisites
- Node.js (version 18+ recommended)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/ahmadshady747-create/gama-hyper-physics.git

# Navigate to directory
cd gama-hyper-physics

# Install dependencies
npm install
```

### Running Locally
```bash
# Start Vite development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) or [http://localhost:3001](http://localhost:3001) in your browser.

### Building for Production
```bash
npm run build
```

---

## 🎮 Controls & Interactions

| Action | Control |
| :--- | :--- |
| **Switch Dimension** | Click `[ 2D Mode ]` \| `[ 3D Mode ]` \| `[ 4D Hyper ]` in HUD |
| **Grab & Fling Body** | Left Click + Drag on any body |
| **Orbit Camera (3D/4D)** | Left Click + Drag on empty canvas space |
| **Pan Camera (3D/4D)** | Right Click + Drag or `Shift` + Left Drag |
| **Zoom Camera** | Mouse Scroll Wheel |
| **Shockwave Blast** | Right Click on empty space or click `💥 Shockwave` |
| **Spawner Tool** | Click `🛠️ Spawner: ON` or `🧹 Clear World`, then drag to create bodies |
| **Motion Sensors** | Click `[ 📱 Enable Motion Sensor ]` (tilt phone or hold `Alt` on PC) |

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
