# ⚛️ GAMA Hyper-Physics Engine (2D / 3D / 4D) & MCP Server

A high-performance, lightweight, multi-dimensional physics sandbox and **Model Context Protocol (MCP) Server** written in **100% Pure TypeScript and HTML5 Canvas** with **Zero External Dependencies** (Zero Three.js, Zero Box2D, Zero Cannon.js).

---

> ### 🌟 Special Acknowledgment / إشادة خاصة
> **The development and architectural precision of the GAMA engine from the ground up would not have been possible or as seamless without the [LOCUS Engine Verification & Synthesis Protocol](https://github.com/ahmadshady747-create/LOCUS).**  
> The LOCUS protocol provided rigorous pre-generation invariant verification, AST safety guarantees, and deterministic mathematical safeguards, ensuring **0 AST Violations, Zero-NaN guards, and 100% Zero-GC runtime memory stability** across all spatial regimes.
> 
> *إن بناء وهندسة محرك **GAMA** متعدد الأبعاد من الصفر وبدون أي مكتبات مساعدة لم يكن ليحدث بهذه السهولة والدقة الفائقة لولا محرك وبروتوكول [**LOCUS Engine**](https://github.com/ahmadshady747-create/LOCUS) الحتمي للتحقق والتوليد الآمن.*

---

## 🔌 Model Context Protocol (MCP) Server Integration

GAMA is equipped with a full-fledged **MCP Server (`src/mcp/server.ts`)** compliant with the standard **Model Context Protocol (JSON-RPC 2.0)**. It enables AI coding agents (such as Google Antigravity, Claude Desktop, Cursor, and Gemini CLI) to execute multi-dimensional physics calculations, simulate trajectories, and compute 4D hyper-rotations dynamically on-demand.

### 🛠️ Exposed MCP Tools

| MCP Tool Name | Spatial Regime | Description |
| :--- | :--- | :--- |
| **`gama_simulate_2d`** | 2D | Simulates arbitrary 2D bodies with SAT collision resolution, Baumgarte stabilization, and Coulomb friction. Returns body trajectories and contact manifolds. |
| **`gama_simulate_3d`** | 3D | Executes 3D rigid body simulation using 15-axis SAT, Unit Quaternions $SO(3)$, and dynamic $3\times 3$ Inverse Inertia Tensors. |
| **`gama_simulate_4d`** | 4D Hyper | Simulates 4D Hyper-Physics with 6-plane $SO(4)$ hyper-rotations, Tesseract 8-cell geometry, and $S^3$ Hyperspheres. |
| **`gama_rotate_4d_vector`** | 4D Math | Rotates 4D hyper-vectors $(x, y, z, w)$ across any of the 6 orthogonal planes $(xy, xz, xw, yz, yw, zw)$ by angle $\theta$ (radians). |
| **`gama_project_4d`** | 4D Projection | Computes dual-stage $4\text{D} \rightarrow 3\text{D} \rightarrow 2\text{D}$ perspective projection with singularity guards and $w$-depth chromatic shifts. |
| **`gama_benchmark`** | Performance | Runs a high-throughput Zero-GC physics simulation benchmark across 2D, 3D, and 4D regimes and reports FPS capacity and latency in milliseconds. |

### ⚙️ How to Configure in Antigravity, Claude, or Cursor

Add GAMA to your `mcp_config.json` (located in `.agents/mcp_config.json` or `~/.gemini/config/mcp_config.json`):

```json
{
  "mcpServers": {
    "gama": {
      "command": "npx",
      "args": ["tsx", "f:/GAMA/src/mcp/server.ts"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 🏃 Running MCP Server Standalone
```bash
npm run mcp
```

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
├── math/                   # 2D, 3D, 4D Vectors, Quaternions, 4x4 Matrices, SO(4) Rotors
├── mcp/
│   └── server.ts           # Model Context Protocol (MCP) Stdio JSON-RPC 2.0 Server
├── physics/
│   ├── common/             # Zero-GC Object Pools & Common Engine Interfaces
│   ├── engine2d/           # 2D SAT & Sequential Impulse Simulator
│   ├── engine3d/           # 3D 15-Axis SAT & Quaternion Inertia Simulator
│   └── engine4d/           # 4D Hyper-Collision & Hyperplane Bounding Cage
├── render/
│   ├── camera.ts           # 3D Spherical Orbit Camera
│   ├── projection4d.ts     # 4D -> 3D -> 2D Perspective Projection
│   └── renderer.ts         # Unified Multi-Dimensional Canvas Renderer
├── ui/
│   ├── sensor.ts           # Real-World Motion Sensor Manager & Desktop Tilt Emulation
│   ├── spawner.ts          # Interactive Body Spawner Tool
│   └── controls.ts         # Glassmorphic HUD Controller & Multi-Dimensional Grabbing
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
# Clone repository
git clone https://github.com/ahmadshady747-create/gama-hyper-physics.git

# Navigate to directory
cd gama-hyper-physics

# Install dependencies
npm install
```

### Running Locally (Interactive Canvas Sandbox)
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
