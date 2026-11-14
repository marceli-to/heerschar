/**
 * Fixed-timestep accumulator (after tin-wolf's core/loop). `advanceLoop` is pure so it can be
 * unit-tested without timers; `startLoop` drives it from requestAnimationFrame.
 */
export interface LoopState {
  accumulator: number;
}

export interface LoopAdvance {
  steps: number;
  /** 0..1, how far real time has moved past the last tick, for interpolation. */
  alpha: number;
}

/** Long frames (debugger, slow device) are clamped so the sim never spirals. */
export const MAX_FRAME_TIME = 0.25;

export function advanceLoop(state: LoopState, frameTime: number, dt: number): LoopAdvance {
  state.accumulator += Math.min(Math.max(frameTime, 0), MAX_FRAME_TIME);
  let steps = 0;
  // The epsilon absorbs float drift so 0.5 dt + 0.5 dt reliably yields a step.
  while (state.accumulator >= dt - 1e-9) {
    state.accumulator -= dt;
    steps++;
  }
  if (state.accumulator < 0) state.accumulator = 0;
  return { steps, alpha: state.accumulator / dt };
}

export interface LoopCallbacks {
  /** Once per animation frame, before any ticks. */
  frameStart(frameTime: number): void;
  tick(): void;
  render(alpha: number, frameTime: number): void;
}

export interface RunningLoop {
  stop(): void;
}

export function startLoop(dt: number, cb: LoopCallbacks): RunningLoop {
  const state: LoopState = { accumulator: 0 };
  let last = performance.now();
  let handle = 0;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    const frameTime = Math.max(0, (now - last) / 1000);
    last = now;
    cb.frameStart(frameTime);
    const { steps, alpha } = advanceLoop(state, frameTime, dt);
    for (let i = 0; i < steps; i++) cb.tick();
    cb.render(alpha, frameTime);
    handle = requestAnimationFrame(frame);
  };
  // A backgrounded tab gets no frames. On return, restart the clock instead of
  // catching up, so the battle simply resumes where it was.
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      last = performance.now();
      state.accumulator = 0;
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  handle = requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
