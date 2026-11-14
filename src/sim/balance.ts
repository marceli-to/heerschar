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

/** Status effect strengths (PLAN section 5). */
export const STATUS = {
  /** Frozen units take this much more physical damage. */
  frozenPhysical: 1.5,
  /** The marked enemy takes this much more damage. */
  marked: 1.15,
  /** Rallied units attack and move this much faster. */
  rallied: 1.25,
} as const;

/** Formations: 3 columns × 2 rows per side, front rows about 24 m apart. */
export const FORMATION = { frontX: 12, rowGap: 2.5, colGap: 3 } as const;

/**
 * AI actions. Every action has a windup (the tell, never under 0.35 s for anything aimed at the
 * player) and a recover. The strike is `ENEMY.attack`.
 */
export const ACTIONS = {
  taunt: { windup: 0.4, recover: 0.3, radius: 6, duration: 4, cooldown: 12 },
  shot: { windup: 0.5, recover: 0.3, multiplier: 1.0, speed: 24, radius: 0.3 },
  pierce: { windup: 0.8, recover: 0.4, multiplier: 1.6, speed: 28, radius: 0.35, cooldown: 10 },
  heal: { windup: 0.6, recover: 0.4, multiplier: 1.0 },
  groupHeal: { windup: 0.9, recover: 0.5, multiplier: 0.8, radius: 4.5, cooldown: 12, minHurt: 2, below: 0.75 },
  bolt: { windup: 0.5, recover: 0.4, multiplier: 0.5, speed: 18, radius: 0.3 },
  fireball: { windup: 0.8, recover: 0.4, multiplier: 1.1, radius: 2.2, speed: 11, minFlight: 0.8, maxFlight: 1.5, clusterRadius: 2.5 },
  frostNova: { windup: 0.4, recover: 0.5, multiplier: 0.4, radius: 3.5, delay: 0.8, freeze: 2, cooldown: 14, trigger: 3 },
} as const;

/** Companion and enemy behaviour by class. */
export const BEHAVIOUR = {
  /** Straight projectiles fly this multiple of the shooter's range before dropping. */
  projectileRangeFactor: 1.3,
  /** Krieger: intercept a foe heading for a back-row ally when it is this close to the krieger. */
  interceptRange: 14,
  /** Taunt is used when at least this many non-hero foes are inside its radius. */
  tauntMinFoes: 2,
  /** Ranged units back away from foes closer than this while their attack recharges. */
  fleeDistance: 4,
  /** Ranged units try to stay at least this far from the nearest foe. */
  rangedMinDistance: 7,
  /** Heiler: heal allies below this health fraction. */
  healBelow: 0.95,
  /** Heiler: idle position this far behind the allies' centre, away from the foes. */
  healerBehind: 3,
  /** Heiler: keep at least this far from the nearest foe. */
  healerSafeDistance: 7,
  /** Healers count the hero's fraction this much lower, so the hero wins ties. */
  heroTieBreak: 1e-6,
} as const;
