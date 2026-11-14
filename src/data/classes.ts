import type { ClassId, Stats } from '../sim/types';

/** Level 1 base stats per class (PLAN section 6). */
export const CLASS_STATS: Record<ClassId, Stats> = {
  krieger: { maxHp: 140, power: 14, armor: 40, resist: 10, moveSpeed: 4.0, attackInterval: 1.2, range: 1.8 },
  bogenschuetze: { maxHp: 80, power: 12, armor: 10, resist: 10, moveSpeed: 4.2, attackInterval: 1.4, range: 14 },
  heiler: { maxHp: 75, power: 16, armor: 10, resist: 30, moveSpeed: 4.0, attackInterval: 2.0, range: 10 },
  magier: { maxHp: 70, power: 20, armor: 5, resist: 30, moveSpeed: 3.8, attackInterval: 2.4, range: 12 },
  // Enemy types (first numbers, tune in 2f).
  /** Very high armor, almost no resist, slow: punishes squads without magic. */
  schildtraeger: { maxHp: 170, power: 13, armor: 110, resist: 0, moveSpeed: 3.0, attackInterval: 1.6, range: 1.8 },
  /** Fast and frail, swings often, heads for the back row. */
  berserker: { maxHp: 95, power: 15, armor: 15, resist: 5, moveSpeed: 5.4, attackInterval: 0.9, range: 1.8 },
  /** Heals and shields its allies from the back. */
  schamane: { maxHp: 80, power: 14, armor: 10, resist: 25, moveSpeed: 3.8, attackInterval: 2.0, range: 10 },
};
