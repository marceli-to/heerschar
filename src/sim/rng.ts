/**
 * Seeded PRNG (mulberry32). All simulation randomness goes through this.
 * The state lives on the owner (`Battle.rngState`, later `GameState.rngState`)
 * so a snapshot of the owner is a snapshot of the random sequence.
 */
export interface RngHolder {
  rngState: number;
}

export function seedState(seed: number): number {
  return seed >>> 0;
}

/** Uniform float in [0, 1). Advances the holder's state. */
export function nextFloat(h: RngHolder): number {
  h.rngState = (h.rngState + 0x6d2b79f5) >>> 0;
  let t = h.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(h: RngHolder, min: number, max: number): number {
  return min + (max - min) * nextFloat(h);
}

/** Integer in [0, n). */
export function int(h: RngHolder, n: number): number {
  return Math.floor(nextFloat(h) * n);
}

/** Uniform pick from a non-empty list. */
export function pick<T>(h: RngHolder, items: readonly T[]): T {
  const item = items[int(h, items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
}
