import { COUNTDOWN, DT } from '../sim/balance';
import { clamp, lerp } from '../sim/math';

/**
 * Camera moments (6e). Final blow: game speed drops to `scale` within `easeIn` seconds, holds,
 * and eases back to 1 over the last `easeOut` seconds of `duration` (all wall-clock seconds);
 * then the end screen shows. `closeIn`: seconds for the camera's ease in on the victim.
 */
export const FINALE = { duration: 1.5, scale: 0.25, easeIn: 0.08, easeOut: 0.4, closeIn: 0.6 } as const;

function smooth(x: number): number {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Game speed `t` wall-clock seconds after the final blow. */
export function finaleTimeScale(t: number): number {
  const { duration, scale, easeIn, easeOut } = FINALE;
  if (t >= duration) return 1;
  if (t < easeIn) return lerp(1, scale, smooth(t / easeIn));
  const out = duration - easeOut;
  if (t > out) return lerp(scale, 1, smooth((t - out) / easeOut));
  return scale;
}

/** 0..1 close-in of the camera `t` seconds after the final blow. */
export function finaleCloseIn(t: number): number {
  return smooth(t / FINALE.closeIn);
}

/**
 * 0..1 through the countdown. `alpha` is the loop's interpolation fraction (only while ticks run),
 * so the sweep moves every frame, not every tick.
 */
export function orbitProgress(countdown: number, alpha: number): number {
  return clamp(1 - Math.max(0, countdown - alpha * DT) / COUNTDOWN, 0, 1);
}

/** Mouse travel (px) during the countdown that counts as "the player wants control". */
export const ORBIT_SKIP_MOUSE = 4;
