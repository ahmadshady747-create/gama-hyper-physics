# Changelog — GAMA-Godot4 AI Studio

All notable changes across development cycles are documented here.

## [5.19.0] — Cycle 19 (2026-11-22) — 3D Cutscene Camera Focus & Orbit Sweep, Multi-Oscillator Procedural AudioSynth, Checkpoint3D Beacon Prefab & 28-Rule GDScript 4 Auditor
### Added & Improved
- **3D Cutscene Focus & Orbital Camera Sweeps in `CinemaDirector` (`godot_project/addons/gama_agent/cinema_director.gd`):**
  - Added `focus_target_3d(world_pos, camera_offset, hold_sec)` (with automatic letterbox framing), `orbit_sweep_3d(center_pos, radius, height, duration_sec)`, and `cutscene_started` / `cutscene_finished` signals.
- **Multi-Oscillator Chords, Frequency Sweeps & Semantic SFX Presets in `AudioSynth` (`godot_project/addons/gama_agent/audio_synth.gd`):**
  - Added `play_sweep()`, `play_chord()`, `play_coin_chime()`, `play_laser_pew()`, `play_powerup_fanfare()`, and `play_explosion_rumble()` with strict GDScript 4 type annotations.
- **New `Checkpoint3D` Respawn Beacon Prefab (`godot_project/scenes/checkpoint_3d.tscn`, `godot_project/scripts/checkpoint_3d.gd`):**
  - Added 3D checkpoint beacon (`Area3D` with rotating `TorusMesh` halo ring) wired to `GameState.set_checkpoint_3d()`, `AudioSynth.play_powerup_fanfare()`, and `CinemaDirector.focus_target_3d()`, and connected symbol `K` in 3D ASCII grid generation (`src/godot/level_grid_generator.ts`) to spawn `res://scenes/checkpoint_3d.tscn` (bringing total scenes to **35 `.tscn` scenes** and **47 GDScript 4 files**).
- **28-Rule GDScript 4 Static Auditor & Auto-Healer (`src/godot/gdscript_auditor.ts`):**
  - Expanded static validation from 25 to **28 rules** (`GD3_STR2VAR` for `str2var`/`var2str`/`bytes2var`/`var2bytes` with auto-healing to `str_to_var`/`var_to_str`/`bytes_to_var`/`var_to_bytes`, `GD3_DIRECTORY_API` for `Directory.new()`, and `GD4_AWAIT_CONNECT` for mistakenly awaiting `.connect()`).

## [5.18.0] — Cycle 18 (2026-11-22) — Multi-Stage Campaign Scene Manager, GoalPortal2D & 3D Grid Boss Arena Scenes, 25-Rule GDScript 4 Auditor & 9-Controller Balancer
### Added & Improved
- Added multi-stage campaign playlist management in `GameState`, added `goal_portal_2d.tscn` and `grid_arena_3d.tscn`, expanded `level_grid_generator.ts` to 11 symbols, expanded `gdscript_auditor.ts` to 25 rules, and expanded `gameplay_balancer.ts` to 9 controllers.

## [5.17.0] — Cycle 17 (2026-11-22) — New 2D Twin-Stick & 3D Hover-Racer Game Archetypes, Pixel-Diagnostic Screenshot Capture & Audited Web/Windows/Android Export Presets
### Added & Improved
- Added `twin_stick_cyber_2d` and `hover_racer_3d` game archetypes, upgraded `agent_screenshot.gd` with pixel-level visual health diagnostics, and added `auditExportPresets()`.

## [5.16.0] — Cycle 16 (2026-11-22) — 22-Rule GDScript 4 Performance/Signal/Type Auditor, Multi-Slot Save & Scene Manager, CinemaDirector Letterbox/Shake & Expanded CI
### Added & Improved
- Expanded `gdscript_auditor.ts` to 22 rules, upgraded `GameState` with multi-slot SHA-256 saves & fade transitions, upgraded `CinemaDirector` with letterbox bars, hit-stop, and 2D/3D camera shakes, and expanded GitHub Actions CI to a Node 20/22 matrix.

## [5.15.0] — Cycle 15 (2026-11-22) — Deep Cross-System Integration & Refinement
### Changed & Improved
- Connected `GameHUD`, `TitleMenu`, and `GameOverScreen` to `LocalizationSystem` and `CombatSystem`, wired `composeFullGameFlow()` end-to-end, and upgraded headless QA telemetry.

## [5.14.0] — Cycle 14 (2026-11-22)
### Added
- Added `generateGdShaderPreset()`, `godot_generate_shader_gdshader`, `localization_system.gd`, `mobile_touch_controls.tscn`, and `boss_sentinel_3d.tscn`.

## [5.13.0] — Cycle 13 (2026-11-22)
### Added
- Added `generateThemeResource()`, `godot_generate_theme_tres`, `inventory_system.gd`, `loot_chest_2d.tscn`, and `key_door_3d.tscn`.

## [5.12.0] — Cycle 12 (2026-11-22)
### Added
- Added `generateProceduralGridLevel()`, `godot_generate_grid_level`, `quest_system.gd`, `boss_guardian_2d.tscn`, and `health_pack_3d.tscn`.

## [5.11.0] — Cycle 11 (2026-11-22)
### Added
- Added `configureInputAction()`, `godot_configure_input_action`, `perf_monitor.gd`, `dialogue_trigger_2d.tscn`, and `jump_pad_3d.tscn`.

## [5.10.0] — Cycle 10 (2026-11-22)
### Added
- Added `balanceGameplayParameters()`, `godot_balance_gameplay_parameters`, `object_pool.gd`, `powerup_boost_2d.tscn`, and `turret_3d.tscn`.

## [5.9.0] — Cycle 9 (2026-11-22)
### Added
- Added `composeFullGameFlow()`, `godot_compose_full_game_flow`, `dialogue_system.gd`, `hazard_spikes_2d.tscn`, and `moving_platform_3d.tscn`.

## [5.8.0] — Cycle 8 (2026-11-22)
### Added
- Added `auditProjectHealth()`, `godot_audit_project_health`, `checkpoint_2d.tscn`, and `goal_portal_3d.tscn`.

## [5.7.0] — Cycle 7 (2026-11-22)
### Added
- Added `autoFixGdScript()`, `godot_autofix_gdscript`, `title_menu.tscn`, and `game_over.tscn`.

## [5.6.0] — Cycle 6 (2026-11-22)
### Added
- Added `agent_playtest_bot.gd`, `godot_run_playtest_bot`, `projectile_2d.tscn`, and `projectile_3d.tscn`.

## [5.5.0] — Cycle 5 (2026-11-22)
### Added
- Added `procedural_vfx.gd`, `pickup_coin_2d.tscn`, `pickup_crystal_3d.tscn`, `src/godot/tscn_inspector.ts`, and `godot_inspect_scene_tree`.

## [5.4.0] — Cycle 4 (2026-11-22)
### Added
- Added `combat_system.gd`, `enemy_chaser_2d.tscn`, `enemy_chaser_3d.tscn`, `godot_inject_enemy_spawner`, and `src/cli.ts`.

## [5.3.0] — Cycle 3 (2026-11-22)
### Added
- Added `cinema_director.gd`, `ui_hud.tscn`, `game_hud.gd`, `wave_spawner.gd`, `godot_attach_hud_to_scene`, and `PackedScene` instancing in `generateTscn()`.

## [5.2.0] — Cycle 2 (2026-11-22)
### Added
- Added `platformer_2d`, `topdown_arena_2d`, `collectathon_3d`, `game_state.gd`, `export_presets.cfg`, and 14-rule GDScript 4 auditor.

## [5.1.0] — Cycle 1 (2026-11-21)
### Added
- Added `agent_screenshot.gd`, `godot_capture_screenshot`, `godot_check_environment`, and `.github/workflows/ci.yml`.

## [5.0.0] — Initial Godot 4 Pivot (2026-11-20)
- Replaced custom TypeScript physics engine with clean Godot 4.3+ starter project and 7-tool MCP server.
