# GAMA AI-Agent Game Engine (v5.19.0)

A complete **Agent-Oriented TypeScript Game Engine** built so AI coding agents can design, visually inspect, auto-playtest, balance, and export playable HTML5 games in a closed feedback loop — now with a **Godot 4.3 bridge** that carries the same agent workflow into real PBR 3D/2D Godot games, with 5 playable Godot archetypes, 35 scenes, and a 23-tool MCP server.

## Full Agent Game-Dev Workflow (14 MCP Tools)

1. **Bootstrap a Game (`gama_create_archetype_game`):** Generate a complete, validated `GamaGameSpec` from 4 built-in genres (`tower_demolition`, `arena_survivor`, `physics_platformer`, `pinball_breakout`).
2. **Validate & Playtest (`gama_validate_game_spec`, `gama_auto_playtest`, `gama_check_tower_stability`):** Catch bad bounds, NaN physics explosions, and unstable towers headlessly in milliseconds.
3. **Auto-Balance (`gama_balance_sweep`):** Sweep multiple launch impulses/physics parameters automatically and get the optimal tuning.
4. **See the Game Headlessly (`gama_capture_svg_snapshot`):** Render any frame into a crisp zero-dependency SVG snapshot with entity labels and HUD so the AI agent can visually inspect layouts without launching Chrome.
5. **Drive Live Sessions (`gama_run_game_session`):** Boot `GamaGameRuntime` with HP, score, combos, events, and virtual inputs (`moveX`, `jump`, `launch`).
6. **Export Standalone Playable Game (`gama_export_playable_html`):** Compile any spec into a single offline `.html` game file with Canvas rendering, drag-to-launch controls, Auto-Juice screen shake, particles, and Web Audio SFX.

## Godot 4.3 Bridge (23 MCP Tools)

`godot_project/` is a pre-configured Godot 4.3+ project using the lightweight **GL Compatibility** renderer, with 12 built-in Autoloads (`Juice` for screen shake/hitstop, `AudioSynth` for zero-asset procedural SFX, `GameState` for multi-stage campaigns and saves, `CinemaDirector` for cutscene cameras, plus combat, dialogue, quests, inventory, localization, object pooling, procedural VFX, and performance monitoring), 5 playable game archetypes (2D platformer, top-down arena, twin-stick cyber, 3D collectathon, 3D hover racer), 35 `.tscn` scenes, and audited Web/Windows/Android export presets.

1. **Inspect (`godot_inspect_project`, `godot_inspect_scene_tree`):** Lists all scenes, scripts, and assets, and statically parses any scene's node tree with ExtResource checks.
2. **Generate (`godot_generate_scene_tscn`, `godot_generate_grid_level`, `godot_generate_shader_gdshader`, `godot_generate_theme_tres`):** Builds valid Godot 4 `format=3` scenes, ASCII-grid levels, shaders, and UI themes from structured input.
3. **Archetypes & Flows (`godot_list_archetypes`, `godot_scaffold_archetype`, `godot_compose_full_game_flow`):** Scaffolds complete playable games and composes full game loops with HUD, enemies, pickups, and checkpoints.
4. **Audit & Heal (`godot_validate_all_scripts`, `godot_audit_project_health`, `godot_autofix_gdscript`):** A 28-rule GDScript 4 static auditor (Godot 3 hallucinations, signals, types, performance) with an auto-healer, plus full project health checks.
5. **Balance & Configure (`godot_balance_gameplay_parameters`, `godot_configure_input_action`):** Tunes gameplay controllers across difficulties and wires InputMap actions.
6. **Run & Capture (`godot_run_headless_qa`, `godot_run_playtest_bot`, `godot_capture_screenshot`, `godot_check_environment`):** Headless QA telemetry, automated playtest bots, pixel-diagnostic screenshots, and engine checks.
7. **Write & Export (`godot_write_gdscript`, `godot_export_build`, `godot_list_agent_autoloads`):** Audited script writing, headless Android/Web/Windows release exports, and the Autoload APIs.

Requires the Godot 4.3+ editor on your PATH (or `GODOT_BIN` set to its path) for headless QA, playtests, screenshots, and exports. Open `godot_project/project.godot` in Godot 4 to preview, edit, or export directly. See `CHANGELOG.md` for the full cycle history from 5.0 to 5.19.

## Quickstart Commands

```bash
npm install
npm run typecheck      # Strict TypeScript check
npm test               # Run all 5 verification suites
npm run playtest       # Headless bot playtest QA
npm run snapshot       # Generate headless SVG snapshot (gama_snapshot.svg)
npm run export:demo    # Export standalone playable HTML5 game
npm run start:mcp      # Start 14-tool MCP server on stdio
npm run start:mcp:godot  # Start 23-tool Godot MCP server on stdio
npm run audit:gd       # Audit all GDScript files (28 rules) & export presets
npm run qa:godot       # Headless Godot QA on godot_project (needs godot 4.3+)
npm run playtest:godot # Headless Godot playtest bot (needs godot 4.3+)
npm run dev            # Launch Vite browser sandbox
```

## License

MIT
