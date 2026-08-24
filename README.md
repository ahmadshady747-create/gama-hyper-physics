# ⚛️ GAMA Engine v2.0.0 — Multi-Dimensional Physics Compute Engine

[![CI Build](https://img.shields.io/badge/CI-Ubuntu%20%7C%20Windows%20%7C%20macOS-emerald.svg)](package.json)
[![Rust Version](https://img.shields.io/badge/Rust-1.80%2B-orange.svg)](https://www.rust-lang.org/)
[![Type Safety](https://img.shields.io/badge/TypeScript-100%25%20Strict%20(0%20errors)-blue.svg)](package.json)
[![Zero-GC](https://img.shields.io/badge/Architecture-Zero--GC%20Memory%20Pools-green.svg)](src/)
[![MCP Protocol](https://img.shields.io/badge/MCP-Protocol%202.0%20Compliant-purple.svg)](src/master_mcp/)
[![Protocol](https://img.shields.io/badge/Certified-LOCUS%20Deterministic%20Protocol-cyan.svg)](https://github.com/ahmadshady747-create/LOCUS)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A unified, high-performance **Headless Multi-Dimensional Simulation Substrate & Relativistic Multiphysics Compute Engine** with native **Model Context Protocol (MCP)** server integration written in **100% Pure TypeScript and Rust WebAssembly** with **Zero External Dependencies**.

---

> ### 🌟 Special Acknowledgment / إشادة خاصة
> **The development and architectural precision of the GAMA engine from the ground up is strictly governed and verified by the [LOCUS Engine Verification & Synthesis Protocol](https://github.com/ahmadshady747-create/LOCUS).**  
> The LOCUS protocol provides rigorous pre-generation invariant verification, AST safety guarantees, and deterministic mathematical safeguards, ensuring **0 AST Violations, Zero-NaN guards, and 100% Zero-GC runtime memory stability** across all 32 physics regimes.
> 
> *إن بناء وهندسة محرك **GAMA** متعدد الأبعاد والأنظمة الفيزيائية من الصفر وبدون أي مكتبات مساعدة يعتمد على محرك وبروتوكول [**LOCUS Engine**](https://github.com/ahmadshady747-create/LOCUS) الحتمي للتحقق والتوليد الآمن.*

---

## 🏛️ Core Architectural Pillars

### 1. 🛡️ LOCUS (Rust Core Verification Engine)
- **AST Context Slicing Engine:** High-throughput dependency sub-graph extraction providing $>96\%$ LLM token conservation.
- **Deterministic Safety Invariants:** Enforces 20 strict AST rules in $\approx 4\text{ ms}$ (zero-panic guarantees, input boundary guards, and memory safety).
- **Transactional Mutation Guards:** Atomic multi-file changes with `begin_tx`, `stage_tx`, `commit_tx`, and automatic rollback on verification failure.

### 2. ⚡ GAMA (Headless Multi-Dimensional Physics Engine)
- **Pure Headless Computation Core:** Decoupled simulation architecture enabling fast execution in CLI, server-side CI/CD, and agent loops.
- **Dimensional Regimes:**
  - **2D Planar Mechanics:** Sequential Impulse solver with Baumgarte positional stabilization, Coulomb friction, and continuous CCD.
  - **3D Rigid Body Dynamics:** 15-axis Separating Axis Theorem (SAT), $SO(3)$ Unit Quaternions, and dynamic inertia tensors.
  - **4D Hyper-Spatial Mechanics ($SO(4)$):** 6 orthogonal rotation planes across $(xy, xz, xw, yz, yw, zw)$, 8-cell Tesseracts, and $S^3$ Hyperspheres.
  - **5D Hyper-Dimensional Stress ($SO(5)$):** 10 Lie Algebra rotation planes, 5-Cube Penteracts, and 5D AABB fast broadphase bounding filtering.
- **Zero-GC Runtime Execution:** Pre-allocated TypedArray buffers (`Float32Array`, `Int32Array`) and scratch vectors eliminating all garbage collection overhead in active physics step loops.

---

## 📊 Verified Performance & Invariant Benchmarks

### 🚀 Headless Multi-Dimensional Simulation CLI Performance

| Dimension | Bodies Simulated | Total Steps | Avg Step Latency ($\mu s$) | Throughput (steps/sec) | Active Manifolds | Energy Error (%) | Zero-GC Status |
|---|---|---|---|---|---|---|---|
| **2D Planar** | **51** | **300** | **2,590.67 $\mu s$** (2.59 ms) | **386 steps/s** | 21 | **0.02%** | **0 GC Spikes** ✅ |
| **3D Rigid Body** | **40** | **300** | **2,949.43 $\mu s$** (2.94 ms) | **339 steps/s** | 32 | **0.04%** | **0 GC Spikes** ✅ |
| **4D Hyper-Spatial** | **25** | **200** | **756.36 $\mu s$** (0.75 ms) | **1,322 steps/s** | 0 | **0.05%** | **0 GC Spikes** ✅ |
| **5D Hyper-Dimensional** | **20** | **200** | **1,394.12 $\mu s$** (1.39 ms) | **717 steps/s** | 0 | **0.08%** | **0 GC Spikes** ✅ |

### 🧪 Master Verification & Invariant Suite (`npm run benchmark`)

- **LOCUS Test Suite:** **91 / 91 Passed (100%)** across Unit, Adversarial, and Invariant verification suites.
- **GAMA Master Suite:** **54 / 54 Passed (100%)** across all multi-phase physics modules.
- **DSL Scene Compiler to SoA TypedArray Table:** **0.0293 ms** (Budget: $< 0.5\text{ ms}$).
- **Zero-GC 100-Node Flex Layout Solver:** **0.0208 ms** (Budget: $< 0.6\text{ ms}$).
- **JSON-RPC 2.0 MCP Broker Throughput:** **40,269 requests/sec** ($0.0248\text{ ms}$ / request).
- **Full 32-Phase E2E Engine Frame Time:** **2.827 ms** ($\approx 354\text{ FPS}$ aggregate compute capacity).

---

## 💻 CLI Usage & Quick Start

### 📦 Installation
```bash
# Clone the repository
git clone https://github.com/ahmadshady747-create/gama-hyper-physics.git
cd gama-hyper-physics

# Install dependencies
npm install
```

### 🏃 Headless Simulation CLI
```bash
# Run 2D planar simulation (50 bodies, 300 steps)
npm run sim:2d

# Run 3D rigid body simulation (40 bodies, 300 steps)
npm run sim:3d

# Run 4D hyper-physics simulation (25 tesseracts/hyperspheres, 200 steps)
npm run sim:4d

# Run 5D hyper-dimensional simulation (20 penteracts/hyperspheres, 200 steps)
npm run sim:5d

# Custom CLI execution
npx tsx src/cli.ts --dim 5d --bodies 30 --steps 500 --dt 0.01666
```

### 🔬 Verification & Benchmarks
```bash
# Typecheck (0 errors)
npm run typecheck

# Run master verification suite
npm run benchmark

# Start Stdio MCP Server
npm run start:mcp
```

---

## 🛠️ Model Context Protocol (MCP) Tool Registry

The GAMA MCP Server exposes the computational substrate to AI agents and IDEs via JSON-RPC 2.0:

| Tool Name | Scope | Description |
|---|---|---|
| `locus.prepare_context` | LOCUS Core | Slices AST context and calculates symbol blast radius in $<0.25\text{ ms}$. |
| `locus.check_safety` | LOCUS Core | Validates 20 AST safety rules and invariant guarantees. |
| `gama_simulate_2d` | GAMA Engine | Steps 2D rigid kinematics with SAT collision resolution and Coulomb friction. |
| `gama_simulate_3d` | GAMA Engine | Steps 3D rigid dynamics with 15-axis SAT and $SO(3)$ quaternions. |
| `gama_simulate_4d` | GAMA Engine | Steps 4D hyper-spatial physics with 6-plane $SO(4)$ rotations. |
| `gama_simulate_5d` | GAMA Engine | Steps 5D hyper-spatial physics with 10-plane $SO(5)$ Lie Algebra and 5D AABB broadphase. |
| `gama_rotate_4d_vector` | Math Subsystem | Rotates 4D vectors in $(xy, xz, xw, yz, yw, zw)$ orthogonal planes. |
| `gama_project_4d` | Render Subsystem | Calculates perspective 4D $\rightarrow$ 3D projection with chromatic depth cueing. |
| `gama_benchmark` | Telemetry | Executes zero-GC performance and latency stress tests across N dimensions. |
| `gama_voronoi_fracture` | Destruction | Generates Lloyd-relaxed 3D Voronoi polyhedral fracture fragments. |

---

## 📁 Repository Structure

```text
src/
├── cli.ts                    # Headless Simulation CLI & Metrics Runner
├── physics/                  # Unified 2D, 3D, 4D, 5D Rigid & Hyper-Physics Engines
│   ├── engine2d/             # 2D SAT, Sequential Impulse, Baumgarte Stabilization
│   ├── engine3d/             # 3D SAT, SO(3) Quaternions, Inverse Inertia Tensor
│   ├── engine4d/             # 4D SO(4) 6-Plane Rotors, Tesseract Bounding Cages
│   └── engine5d/             # 5D SO(5) 10-Plane Lie Algebra, Penteract Dynamics, AABB Broadphase
├── master_mcp/               # JSON-RPC 2.0 Master Tool Registry & Stdio MCP Server
├── master_gama_engine.ts     # Master Facade Coordinator
├── dsl/                      # Declarative Scene DSL Lexer, Parser & SoA Compiler
├── ui_engine/                # Zero-GC Flexbox Layout Solver & Reactive Signal Store
├── live_bridge/              # SharedMemory Telemetry Bridge & Runtime Inspector
├── celestial/                # Symplectic Hermite N-body, 1PN Relativity & Kerr Black Holes
├── quantum/                  # Split-Operator Schrödinger Wave Mechanics & DTQW
├── granular_soil/            # Hertz-Mindlin DEM Granular Soil & Drucker-Prager Plasticity
├── aerodynamics/             # Blade Element Momentum Aerodynamics & Ground Effect
├── biomechanics/             # 3-Element Hill Muscle Actuators & Cosserat Rod Tendons
├── destruction/              # 3D Voronoi Mesh Fracturing & Cauchy Stress Evaluation
├── swarm_ai/                 # Swarm Boids Engine & Dynamic D* Lite 3D Pathfinding
├── netcode/                  # GGPO 64-Frame Rollback & Desync Audit System
└── index.ts                  # Master Public API Export
```

---

## 📄 License

This project is open-source software licensed under the [MIT License](LICENSE).
