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

URL parameters: `?seed=<n>` fixes the battle RNG, `?zoom=0..1` sets the starting camera zoom.

Controls so far: click the canvas for mouse look (Esc releases), mouse wheel zooms, F3 toggles the debug overlay.

## Layout

- `src/sim/` pure TypeScript simulation: no Three.js, DOM or Vue, no `Math.random` / `Date.now` (enforced by `tests/sim/purity.test.ts`). Fixed ticks of 1/60 s, seeded RNG in the state.
- `src/view/` Three.js: reads battle state, never writes it.
- `src/input/` keyboard and mouse.
- `src/game/` glue: the fixed-timestep loop and the `Game` class wiring sim, input and view.
- `src/ui/` Vue + Tailwind overlay.

The RNG, loop and keyboard/mouse code are adapted from tin-wolf.

## Status

Stage 0 (scaffold) done: sunny meadow arena with stone ring, hills and trees, lit low-poly with sun shadows; fixed-timestep loop with interpolation hook; debug overlay.
