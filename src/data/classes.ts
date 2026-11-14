import type { ClassId, Stats } from '../sim/types';

/** Level 1 base stats per class (PLAN section 6). */
export const CLASS_STATS: Record<ClassId, Stats> = {
  krieger: { maxHp: 140, power: 14, armor: 40, resist: 10, moveSpeed: 4.0, attackInterval: 1.2, range: 1.8 },
  bogenschuetze: { maxHp: 80, power: 12, armor: 10, resist: 10, moveSpeed: 4.2, attackInterval: 1.4, range: 14 },
  heiler: { maxHp: 75, power: 16, armor: 10, resist: 30, moveSpeed: 4.0, attackInterval: 2.0, range: 10 },
  magier: { maxHp: 70, power: 20, armor: 5, resist: 30, moveSpeed: 3.8, attackInterval: 2.4, range: 12 },
};
