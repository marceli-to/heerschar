import type { BossId, ClassId } from './types';

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
  abilityBuffer: 0.3,
  dodge: { distance: 4, duration: 0.35, invulnerable: 0.25, cooldown: 1.2 },
  /**
   * Ranged heroes (Archer, Mage, Healer) dodge farther, to get out of reach (Marcel, 2026-11-15).
   * The Warrior keeps the short dodge: he is meant to stay in the fight, and a long one makes the
   * squad's composition and formation matter less (tests/meta/prepMatters).
   */
  rangedDodge: { distance: 6, duration: 0.4 },
  /**
   * Dodging through enemies grazes them: each enemy the hero's body passes is hit once per dodge
   * for `multiplier` × power, pushed aside, stunned for `stun` seconds (Marcel, 2026-11-15; not
   * bosses, not frozen enemies), and gives the hero `energy`. `contact` is added to both body radii.
   */
  dodgeStrike: { multiplier: 0.5, contact: 0.2, knockback: 3, hitstop: 0.04, energy: 8, stun: 0.3 },
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
  /** Slowed units move this much slower (attack speed is unaffected). */
  slowed: 0.6,
} as const;

/** A critical hit (from upgrades and items, `UnitMods.crit`) deals this much more. */
export const CRIT_MULTIPLIER = 1.5;
/** Seconds the Warden's guard shield (`UnitMods.guardShield`) lasts. */
export const GUARD_SHIELD_TIME = 6;

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
  /** Schamane: shields an ally under attack for `shield × power` points. */
  ward: { windup: 0.5, recover: 0.3, shield: 2.5, duration: 8, cooldown: 9 },
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
  /** Schamane: an ally counts as under attack when a foe targeting it is this close. */
  wardThreat: 4,
} as const;

// ---------------------------------------------------------------------------------------------
// Hero kit (PLAN section 7)

/** Energy pays for hero abilities. */
export const ENERGY = { max: 100, start: 30, perSecond: 4, perBasicHit: 5 } as const;

/** A basic attack that fires a projectile along the aim (ranged hero classes). */
export interface RangedAttack {
  windup: number;
  recover: number;
  multiplier: number;
  speed: number;
  radius: number;
  heavy: boolean;
}

/** Two-shot chains for the ranged hero classes. Bogenschuetze shoots arrows, the casters bolts. */
export const HERO_RANGED = {
  bogenschuetze: [
    { windup: 0.16, recover: 0.26, multiplier: 1.0, speed: 30, radius: 0.3, heavy: false },
    { windup: 0.24, recover: 0.4, multiplier: 1.5, speed: 34, radius: 0.35, heavy: true },
  ],
  heiler: [
    { windup: 0.2, recover: 0.3, multiplier: 0.6, speed: 20, radius: 0.35, heavy: false },
    { windup: 0.26, recover: 0.42, multiplier: 0.9, speed: 22, radius: 0.4, heavy: true },
  ],
  magier: [
    { windup: 0.2, recover: 0.3, multiplier: 0.7, speed: 20, radius: 0.35, heavy: false },
    { windup: 0.26, recover: 0.42, multiplier: 1.05, speed: 22, radius: 0.4, heavy: true },
  ],
} as const satisfies Record<'bogenschuetze' | 'heiler' | 'magier', readonly RangedAttack[]>;

/** Aim assist for ranged hero attacks: snap to an enemy in range within this angle of the aim. */
export const RANGED_AIM_ASSIST = 12 * DEG;

/** Healing the hero gives himself (Heiler class only) is scaled by this. */
export const HERO_SELF_HEAL = 0.5;

/**
 * Hero abilities. Every one has an energy cost, a cooldown, a windup and a recover. Energy and
 * cooldown are paid when the windup completes, so an interrupted cast costs nothing.
 */
export const HERO_ABILITIES = {
  /** Krieger: shield bash, stuns everyone in a cone (ignores poise). */
  schildstoss: { cost: 30, cooldown: 6, windup: 0.22, recover: 0.38, multiplier: 1.5, reach: 2.6, arc: 110 * DEG, knockback: 8, stun: 1.2, lunge: 0.5, hitstop: 0.12 },
  /** Krieger: spin, damages and staggers everyone around. */
  wirbel: { cost: 45, cooldown: 9, windup: 0.28, recover: 0.45, multiplier: 2.5, reach: 2.6, arc: 2 * Math.PI, knockback: 8, stagger: 0.4, lunge: 0, hitstop: 0.14 },
  /** Bogenschuetze: three arrows in a fan that pass through everyone in their way. */
  salve: { cost: 30, cooldown: 5, windup: 0.3, recover: 0.35, multiplier: 1.5, arrows: 3, spread: 12 * DEG, speed: 30, radius: 0.3 },
  /** Bogenschuetze: slows enemies in front, then leaps back (invulnerable like a dodge). */
  rueckzug: { cost: 35, cooldown: 8, windup: 0.12, recover: 0.2, reach: 4.5, arc: 100 * DEG, slow: 3, distance: 5, duration: 0.35 },
  /** Heiler: a ground circle at the hero's feet that heals allies inside over time. */
  heilkreis: { cost: 40, cooldown: 12, windup: 0.4, recover: 0.35, radius: 4, multiplier: 0.25, pulses: 10, interval: 0.5 },
  /** Heiler: shields the ally with the lowest health fraction in range. */
  segen: { cost: 30, cooldown: 6, windup: 0.3, recover: 0.3, range: 12, shield: 2.5, duration: 8 },
  /** Magier: arcing fireball, damage in a circle where it lands. */
  feuerball: { cost: 40, cooldown: 6, windup: 0.4, recover: 0.35, multiplier: 2.5, radius: 2.5, speed: 14, minFlight: 0.5, maxFlight: 1.1, range: 14, fallback: 10 },
  /** Magier: freezes and lightly damages everyone around the hero. */
  frostring: { cost: 45, cooldown: 12, windup: 0.25, recover: 0.35, multiplier: 1.0, radius: 4, freeze: 2.5 },
  /** Leader ability, every class: all companions are rallied. */
  sammeln: { cost: 50, cooldown: 20, windup: 0.3, recover: 0.3, duration: 6 },
} as const;

/** The hero's two class abilities (Q, E). The leader ability (R) is always `sammeln`. */
export const HERO_KIT = {
  krieger: ['schildstoss', 'wirbel'],
  bogenschuetze: ['salve', 'rueckzug'],
  heiler: ['heilkreis', 'segen'],
  magier: ['feuerball', 'frostring'],
} as const;

/** Lock-on: candidates within `range`; the first pick weighs view angle against distance. */
export const LOCK = { range: 30, metresPerRadian: 12 } as const;

// ---------------------------------------------------------------------------------------------
// Bosses (PLAN sections 6 and 10, Stage 5 decisions)

/** The region bosses: large, telegraphed, immune to stun and freeze. */
export const BOSSES: readonly BossId[] = ['kriegsherr', 'sumpfhexe', 'knochenkoenig'];

/** Body radius by class where it differs from `UNIT_RADIUS` (bosses are big, wolves small). */
export const BODY_RADIUS: Partial<Record<ClassId, number>> = {
  kriegsherr: 0.85,
  sumpfhexe: 0.7,
  knochenkoenig: 0.95,
  wolf: 0.4,
};

/** Bosses: knockback is scaled by this, and they push others aside this many times harder. */
export const BOSS_BODY = { knockback: 0.15, mass: 6 } as const;

/** Boss basic swing (Iron Warlord, Bone King): slow, long, heavy. Reach is from the boss's centre. */
export const BOSS_STRIKE = { windup: 0.75, recover: 0.6, multiplier: 1.2, reach: 2.9, arc: 110 * DEG, knockback: 5, stagger: 0.3, lunge: 0.4, hitstop: 0.08, heavy: true } satisfies MeleeAttack;

/**
 * Boss actions. Telegraphed ones place their warning when the windup starts and resolve when it
 * ends (`windup` = warning time). Cooldowns in seconds; a boss also waits its attack interval
 * between any two actions.
 */
export const BOSS_ACTIONS = {
  /** A wide swing in front: a filling arc. */
  sweep: { windup: 1.1, recover: 0.6, multiplier: 1.7, radius: 4.4, arc: 160 * DEG, knockback: 7, cooldown: 8 },
  /** A run along a lane at a far foe: a filling lane, then the dash; everyone in the way is hit. */
  charge: { windup: 1.2, recover: 0.8, dash: 0.4, multiplier: 1.5, halfWidth: 1.3, maxLength: 14, minRange: 6, knockback: 9, cooldown: 12 },
  /** Ground slam: a circle around the boss and one under up to `targets` foes. */
  slam: { windup: 1.3, recover: 0.7, multiplier: 1.3, radius: 3.4, targetRadius: 2.2, targets: 3, range: 12, knockback: 4, cooldown: 11 },
  /** Fen Witch: poison circles under up to `targets` foes (sickly green, linger in the view). */
  poison: { windup: 1.2, recover: 0.5, multiplier: 1.1, radius: 2.2, targets: 4, range: 16, cooldown: 8 },
  /** Fen Witch basic attack: a magic bolt. */
  hex: { windup: 0.6, recover: 0.4, multiplier: 0.9, speed: 16, radius: 0.4 },
  /** Calls more units (`SUMMONS`), at most `maxAlive` of hers at once; first only below `firstBelow` health. */
  summon: { windup: 1.1, recover: 0.6, cooldown: 16, maxAlive: 3, firstBelow: 0.85, edgeX: 19 },
  /** Fen Witch: heals every ally within `radius` when one of them is below `below`. */
  mend: { windup: 0.9, recover: 0.5, multiplier: 1.0, radius: 14, below: 0.7, cooldown: 10 },
  /** Bone King: raises up to `count` fallen allies (each once) at `hp` of their health. */
  raise: { windup: 1.4, recover: 0.6, count: 2, hp: 0.5, cooldown: 14 },
} as const;

/** What each boss calls, cycling through the groups summon by summon. */
export const SUMMONS: Partial<Record<ClassId, readonly (readonly ClassId[])[]>> = {
  kriegsherr: [['krieger', 'berserker']],
  sumpfhexe: [['wolf', 'wolf', 'wolf'], ['schamane']],
};
