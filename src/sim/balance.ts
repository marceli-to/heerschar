/** Every tunable number of the simulation lives here. */

/** Simulation ticks per second. The sim always advances by exactly 1 / TICK_RATE. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/**
 * The arena is an ellipse that fits a 44 × 30 m rectangle: the formations
 * stand ~24 m apart along x, and the stone ring marks the bounds.
 */
export const ARENA = { width: 44, depth: 30 } as const;

export const COUNTDOWN = 3;

export const UNIT_RADIUS = 0.5;
/** Fraction of an overlap resolved per tick. */
export const SEPARATION_STRENGTH = 0.5;
/** Fraction of a bounds overshoot pushed back per tick. */
export const BOUNDS_STRENGTH = 0.25;
/** Knockback velocity decay, per second. */
export const KNOCKBACK_FRICTION = 10;
/**
 * Poise: light hits do not interrupt a windup (heavy ones do), and after a stagger
 * a unit cannot be staggered again for this long, so it cannot be stun-locked.
 */
export const STAGGER_IMMUNITY = 1.2;
/** ±fraction of random damage variance. */
export const DAMAGE_VARIANCE = 0.1;

export interface MeleeAttack {
  windup: number;
  recover: number;
  /** Damage multiplier on `power`. */
  multiplier: number;
  /** Reach beyond the attacker's centre, in metres (target radius is added). */
  reach: number;
  /** Full angle of the hit arc, radians. */
  arc: number;
  /** Knockback speed given to the target, m/s. */
  knockback: number;
  /** How long a hit target is stunned (staggered). 0 = no stagger. */
  stagger: number;
  /** Distance the attacker steps forward during the windup. */
  lunge: number;
  /** Freeze on attacker and target at the hit moment. */
  hitstop: number;
  heavy: boolean;
}

const DEG = Math.PI / 180;

export const HERO = {
  moveSpeed: 5.0,
  /** Radians per second the hero turns towards the movement direction. */
  turnRate: 16,
  /** Seconds a press is remembered while the hero is busy. */
  attackBuffer: 0.3,
  dodgeBuffer: 0.25,
  dodge: { distance: 4, duration: 0.35, invulnerable: 0.25, cooldown: 1.2 },
  /** Melee aim assist: snap the swing to an enemy this close and within this angle. */
  aimAssist: { range: 3.2, angle: 55 * DEG },
  /** Seconds into a recover after which a queued chain step starts. */
  chainOpen: 0.06,
  /** The warrior's two-hit chain. */
  chain: [
    { windup: 0.13, recover: 0.32, multiplier: 1.0, reach: 2.0, arc: 100 * DEG, knockback: 3, stagger: 0.22, lunge: 0.45, hitstop: 0.06, heavy: false },
    { windup: 0.18, recover: 0.48, multiplier: 1.6, reach: 2.2, arc: 140 * DEG, knockback: 4.5, stagger: 0.5, lunge: 0.8, hitstop: 0.1, heavy: true },
  ] satisfies MeleeAttack[],
} as const;

export const ENEMY = {
  /** Radians per second an enemy turns while closing in. */
  turnRate: 6,
  /** Turn rate while winding up, so the hero can sidestep the swing. */
  windupTurnRate: 2.2,
  /** Start swinging at this fraction of the reach. */
  engageFactor: 0.85,
  /** At most this many enemies attack the hero at once; the rest circle at a distance. */
  maxAttackers: 2,
  waitDistance: 4.5,
  /** Extra random delay added to attackInterval, seconds. */
  cooldownJitter: 0.6,
  attack: { windup: 0.6, recover: 0.55, multiplier: 1.0, reach: 1.8, arc: 90 * DEG, knockback: 4, stagger: 0, lunge: 0.3, hitstop: 0.06, heavy: false } satisfies MeleeAttack,
} as const;

/** The hero's attack for a chain step (falls back to the first). */
export function heroAttack(chain: number): MeleeAttack {
  const chainList: readonly MeleeAttack[] = HERO.chain;
  const a = chainList[chain] ?? chainList[0];
  if (!a) throw new Error('hero chain is empty');
  return a;
}
