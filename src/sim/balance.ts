/** Every tunable number of the simulation lives here. */

/** Simulation ticks per second. The sim always advances by exactly 1 / TICK_RATE. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/**
 * The arena is an ellipse that fits a 44 × 30 m rectangle: the formations
 * stand ~24 m apart along x, and the stone ring marks the bounds.
 */
export const ARENA = { width: 44, depth: 30 } as const;
