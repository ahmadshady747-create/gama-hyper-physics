# GAMA AI-Agent Game Engine (v4.0.0)

A complete **Agent-Oriented TypeScript Game Engine** built so AI coding agents can design, visually inspect, auto-playtest, balance, and export playable HTML5 games in a closed feedback loop.

## Full Agent Game-Dev Workflow (14 MCP Tools)

1. **Bootstrap a Game (`gama_create_archetype_game`):** Generate a complete, validated `GamaGameSpec` from 4 built-in genres (`tower_demolition`, `arena_survivor`, `physics_platformer`, `pinball_breakout`).
2. **Validate & Playtest (`gama_validate_game_spec`, `gama_auto_playtest`, `gama_check_tower_stability`):** Catch bad bounds, NaN physics explosions, and unstable towers headlessly in milliseconds.
3. **Auto-Balance (`gama_balance_sweep`):** Sweep multiple launch impulses/physics parameters automatically and get the optimal tuning.
4. **See the Game Headlessly (`gama_capture_svg_snapshot`):** Render any frame into a crisp zero-dependency SVG snapshot with entity labels and HUD so the AI agent can visually inspect layouts without launching Chrome.
5. **Drive Live Sessions (`gama_run_game_session`):** Boot `GamaGameRuntime` with HP, score, combos, events, and virtual inputs (`moveX`, `jump`, `launch`).
6. **Export Standalone Playable Game (`gama_export_playable_html`):** Compile any spec into a single offline `.html` game file with Canvas rendering, drag-to-launch controls, Auto-Juice screen shake, particles, and Web Audio SFX.

## Quickstart Commands

```bash
npm install
npm run typecheck      # Strict TypeScript check
npm test               # Run all 4 verification suites
npm run playtest       # Headless bot playtest QA
npm run snapshot       # Generate headless SVG snapshot (gama_snapshot.svg)
npm run export:demo    # Export standalone playable HTML5 game
npm run start:mcp      # Start 14-tool MCP server on stdio
npm run dev            # Launch Vite browser sandbox
```

## License

MIT
