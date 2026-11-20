# GAMA AI-Agent Game Engine (v5.0.0)

A complete **Agent-Oriented TypeScript Game Engine** built so AI coding agents can design, visually inspect, auto-playtest, balance, and export playable HTML5 games in a closed feedback loop — now with a **Godot 4.3 bridge** that carries the same agent workflow into real PBR 3D/2D Godot games.

## Full Agent Game-Dev Workflow (14 MCP Tools)

1. **Bootstrap a Game (`gama_create_archetype_game`):** Generate a complete, validated `GamaGameSpec` from 4 built-in genres (`tower_demolition`, `arena_survivor`, `physics_platformer`, `pinball_breakout`).
2. **Validate & Playtest (`gama_validate_game_spec`, `gama_auto_playtest`, `gama_check_tower_stability`):** Catch bad bounds, NaN physics explosions, and unstable towers headlessly in milliseconds.
3. **Auto-Balance (`gama_balance_sweep`):** Sweep multiple launch impulses/physics parameters automatically and get the optimal tuning.
4. **See the Game Headlessly (`gama_capture_svg_snapshot`):** Render any frame into a crisp zero-dependency SVG snapshot with entity labels and HUD so the AI agent can visually inspect layouts without launching Chrome.
5. **Drive Live Sessions (`gama_run_game_session`):** Boot `GamaGameRuntime` with HP, score, combos, events, and virtual inputs (`moveX`, `jump`, `launch`).
6. **Export Standalone Playable Game (`gama_export_playable_html`):** Compile any spec into a single offline `.html` game file with Canvas rendering, drag-to-launch controls, Auto-Juice screen shake, particles, and Web Audio SFX.

## Godot 4.3 Bridge (7 MCP Tools)

`godot_project/` is a pre-configured Godot 4.3+ project using the lightweight **GL Compatibility** renderer, with built-in Autoloads (`Juice` for screen shake/hitstop, `AudioSynth` for zero-asset procedural SFX), a starter 3D PBR scene (`scenes/main.tscn` with ACES tonemapping + Glow/Bloom), and a headless QA runner (`addons/gama_agent/agent_qa_runner.gd`).

1. **Inspect (`godot_inspect_project`):** Lists all `.tscn` scenes, `.gd` scripts, and `.glb`/`.png`/`.wav` assets.
2. **Generate Scenes (`godot_generate_scene_tscn`):** Generates valid Godot 4 `format=3` scenes from structured JSON.
3. **Write GDScript (`godot_write_gdscript`):** Audits for Godot 3 hallucinations (`KinematicBody2D`, `yield`, `export var`) before saving `.gd` files.
4. **Validate All Scripts (`godot_validate_all_scripts`):** Static audit across the entire Godot project.
5. **Headless QA (`godot_run_headless_qa`):** Launches `godot --headless` to verify scenes and return JSON telemetry.
6. **Export Builds (`godot_export_build`):** Triggers headless Android/Web/Windows release exports.
7. **List Autoloads (`godot_list_agent_autoloads`):** Exposes the `Juice` & `AudioSynth` one-line APIs.

Requires the Godot 4.3+ editor on your PATH (or `GODOT_BIN` set to its path) for headless QA and exports. Open `godot_project/project.godot` in Godot 4 to preview, edit, or export directly.

## Quickstart Commands

```bash
npm install
npm run typecheck      # Strict TypeScript check
npm test               # Run all 5 verification suites
npm run playtest       # Headless bot playtest QA
npm run snapshot       # Generate headless SVG snapshot (gama_snapshot.svg)
npm run export:demo    # Export standalone playable HTML5 game
npm run start:mcp      # Start 14-tool MCP server on stdio
npm run start:mcp:godot  # Start 7-tool Godot MCP server on stdio
npm run qa:godot       # Headless Godot QA on godot_project (needs godot 4.3+)
npm run dev            # Launch Vite browser sandbox
```

## License

MIT
