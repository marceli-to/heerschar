import type { ClassId, Stats } from '../sim/types';

/**
 * Progression numbers (PLAN section 10). Tunable; the campaign targets (level ~6 at the first
 * boss, ~12 at the second, ~18 at the last) are tuned in Stage 5.
 */
export const LEVEL_CAP = 20;
/** The level at which a character chooses a path instead of an upgrade. */
export const PATH_LEVEL = 5;
/** Benched characters get this fraction of a fielded share of experience. */
export const BENCH_SHARE = 0.5;
/** Upgrade and loot offers: pick one of this many. */
export const OFFER_SIZE = 3;

/** Experience needed to go from `level` to the next. */
export function xpToNext(level: number): number {
  return 100 + 40 * (level - 1);
}

/** Per-level stat growth: fractions of the level 1 health and power, flat armour and resist. */
export interface Growth {
  hp: number;
  power: number;
  armor: number;
  resist: number;
}

/** Each level raises the base stats slightly, by class. Enemies grow the same way. */
export const LEVEL_GROWTH: Record<ClassId, Growth> = {
  krieger: { hp: 0.07, power: 0.04, armor: 3, resist: 1 },
  bogenschuetze: { hp: 0.05, power: 0.06, armor: 1, resist: 1 },
  heiler: { hp: 0.05, power: 0.05, armor: 1, resist: 2 },
  magier: { hp: 0.045, power: 0.065, armor: 0.5, resist: 2 },
  schildtraeger: { hp: 0.07, power: 0.04, armor: 4, resist: 0.5 },
  berserker: { hp: 0.05, power: 0.06, armor: 1, resist: 0.5 },
  schamane: { hp: 0.05, power: 0.05, armor: 1, resist: 2 },
};

/** Stats at a level: level 1 stats plus the class growth per level above 1. */
export function statsAtLevel(base: Stats, classId: ClassId, level: number): Stats {
  const g = LEVEL_GROWTH[classId];
  const n = Math.max(0, level - 1);
  return {
    ...base,
    maxHp: base.maxHp * (1 + g.hp * n),
    power: base.power * (1 + g.power * n),
    armor: base.armor + g.armor * n,
    resist: base.resist + g.resist * n,
  };
}

/**
 * What an upgrade, a path or an item does. Every field is optional and effects add up: fractions
 * (`hp`, `power`, `speed`, `haste`, `damage`, `healing`, `area`) add as percentages, `toughness`
 * and `cooldown` reduce what they name, the rest are flat amounts.
 */
export interface Effect {
  /** + fraction of max health. */
  hp?: number;
  /** + fraction of power (damage or healing). */
  power?: number;
  armor?: number;
  resist?: number;
  /** + fraction of move speed. */
  speed?: number;
  /** + fraction of attack speed (attack interval divided by 1 + haste). */
  haste?: number;
  /** + metres of range (ranged classes). */
  range?: number;
  /** + fraction of damage dealt. */
  damage?: number;
  /** Fraction less damage taken. */
  toughness?: number;
  /** + fraction of heals and shields given. */
  healing?: number;
  /** Fraction shorter ability cooldowns. */
  cooldown?: number;
  /** Fraction of damage dealt healed back. */
  lifesteal?: number;
  /** + seconds on taunts, stuns, freezes and slows applied. */
  control?: number;
  /** Seconds of slow on foes hit by arrows. */
  slowOnHit?: number;
  /** + fraction of ground circle radius. */
  area?: number;
  /** Taunt / Shield Bash shields the unit itself for this many × power. */
  guardShield?: number;
  /** Chance of a critical hit. */
  crit?: number;
  /** Taunt / Whirlwind rallies the unit itself for this many seconds. */
  selfRally?: number;
}

export type EffectKey = keyof Effect;

/** Every effect key in display order. */
export const EFFECT_KEYS: readonly EffectKey[] = [
  'hp',
  'power',
  'armor',
  'resist',
  'speed',
  'haste',
  'range',
  'damage',
  'toughness',
  'healing',
  'cooldown',
  'lifesteal',
  'crit',
  'control',
  'slowOnHit',
  'area',
  'guardShield',
  'selfRally',
];

/** Caps so stacked effects stay sane. */
export const EFFECT_CAPS = { toughness: 0.5, cooldown: 0.5, crit: 0.5, lifesteal: 0.4 } as const;

export function sumEffects(list: readonly Effect[]): Effect {
  const out: Effect = {};
  for (const e of list) {
    for (const k of EFFECT_KEYS) {
      const v = e[k];
      if (v !== undefined) out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}
