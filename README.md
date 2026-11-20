# Heerschar (working title)

A 3D browser game: lead a small army as a hero you control directly. The full brief and the build stages are in `PLAN.md`.

## Run

```sh
npm install
npm run dev        # http://localhost:5190
npm test           # Vitest, simulation and loop tests (Node)
npm run typecheck  # vue-tsc
npm run build
```

## Deploy

`./deploy.sh` tests and builds the committed state (HEAD) in a clean copy and rsyncs `dist/` to https://heerschar.kimiyu.ch (Hostpoint, over SSH with your key). `./deploy.sh --dry-run` shows what would change. Uncommitted changes stop it.

URL parameters: `?seed=<n>` fixes the battle RNG, `?zoom=0..1` sets the starting camera zoom, `?debug` shows the debug overlay (F3 toggles it) and exposes `window.__game`, `?bot` lets the scripted bot play the hero.

Controls: click to take the field (pointer lock), W A S D move (camera-relative), mouse turns the camera, left click strikes (click again in time for the heavier second blow), Space dodges, wheel zooms, Esc pauses.

## Layout

- `src/sim/` pure TypeScript simulation: no Three.js, DOM or Vue, no `Math.random` / `Date.now` (enforced by `tests/sim/purity.test.ts`). Fixed ticks of 1/60 s, seeded RNG in the state.
- `src/view/` Three.js: reads battle state, never writes it.
- `src/input/` keyboard and mouse.
- `src/game/` glue: the fixed-timestep loop and the `Game` class wiring sim, input and view.
- `src/ui/` Vue + Tailwind overlay.

The RNG, loop and keyboard/mouse code are adapted from tin-wolf.

## Tuning

All sim numbers are in `src/sim/balance.ts` (hero speed, attack chain timings, reach, arcs, knockback, hit-stop, dodge, enemy windup, poise). The trial's raiders are in `src/data/encounters.ts`. Camera distances, curve, sensitivity and shake are in `src/view/camera.ts` (`CAMERA`).

## Status

- Stage 0 (scaffold) done: sunny meadow arena with stone ring, hills and trees, lit low-poly with sun shadows; fixed-timestep loop with interpolation; debug overlay.
- Stage 1 (the hero alone) built, waiting for the feel playtest: warrior hero with movement, two-hit chain, dodge; three raiders with a 0.6 s windup who take turns (at most two attack at once); hit-stop, flash, knockback, sparks, swing trails, camera shake; health bars, parchment HUD, countdown, pause, victory and defeat, restart.
