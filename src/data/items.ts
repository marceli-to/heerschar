import type { PlayableClassId } from '../sim/types';
import type { Effect } from './progression';

export type Rarity = 'common' | 'rare' | 'epic';
export type ItemSlot = 'weapon' | 'trinket';
/** Pictograms for item cards and slots (drawn in the UI). */
export type ItemIcon = 'sword' | 'bow' | 'staff' | 'wand' | 'ring' | 'amulet' | 'charm' | 'coin' | 'feather' | 'hourglass';

export interface Item {
  id: string;
  slot: ItemSlot;
  /** Weapons fit one class; trinkets (`null`) fit anyone. */
  classId: PlayableClassId | null;
  rarity: Rarity;
  icon: ItemIcon;
  effect: Effect;
}

/** How good a battle's loot is (PLAN section 10). */
export type LootTier = 'normal' | 'elite' | 'boss';

/** Rarity odds per loot tier (weights). */
export const LOOT_ODDS: Record<LootTier, Record<Rarity, number>> = {
  normal: { common: 60, rare: 35, epic: 5 },
  elite: { common: 10, rare: 60, epic: 30 },
  boss: { common: 0, rare: 40, epic: 60 },
};

const w = (id: string, classId: PlayableClassId, rarity: Rarity, icon: ItemIcon, effect: Effect): Item => ({ id, slot: 'weapon', classId, rarity, icon, effect });
const t = (id: string, rarity: Rarity, icon: ItemIcon, effect: Effect): Item => ({ id, slot: 'trinket', classId: null, rarity, icon, effect });

/** Every item. Names in `STRINGS.items`. */
export const ITEMS: readonly Item[] = [
  w('ironSword', 'krieger', 'common', 'sword', { power: 0.08 }),
  w('knightsBlade', 'krieger', 'rare', 'sword', { power: 0.12, armor: 8 }),
  w('oathkeeper', 'krieger', 'epic', 'sword', { power: 0.15, lifesteal: 0.06 }),
  w('huntingBow', 'bogenschuetze', 'common', 'bow', { power: 0.08 }),
  w('yewLongbow', 'bogenschuetze', 'rare', 'bow', { power: 0.1, range: 2 }),
  w('windstring', 'bogenschuetze', 'epic', 'bow', { power: 0.12, haste: 0.12 }),
  w('pilgrimsStaff', 'heiler', 'common', 'staff', { healing: 0.1 }),
  w('blessedStaff', 'heiler', 'rare', 'staff', { healing: 0.15, resist: 8 }),
  w('staffOfDawn', 'heiler', 'epic', 'staff', { healing: 0.2, cooldown: 0.1 }),
  w('apprenticeWand', 'magier', 'common', 'wand', { power: 0.08 }),
  w('emberRod', 'magier', 'rare', 'wand', { power: 0.12, area: 0.1 }),
  w('frostbrand', 'magier', 'epic', 'staff', { power: 0.15, control: 0.5 }),
  t('copperRing', 'common', 'ring', { hp: 0.06 }),
  t('boneCharm', 'common', 'charm', { armor: 8 }),
  t('luckyCoin', 'common', 'coin', { crit: 0.05 }),
  t('garnetRing', 'rare', 'ring', { power: 0.08, hp: 0.05 }),
  t('amuletOfWarding', 'rare', 'amulet', { resist: 15 }),
  t('travellersCharm', 'rare', 'charm', { speed: 0.1 }),
  t('phoenixFeather', 'epic', 'feather', { lifesteal: 0.08, hp: 0.08 }),
  t('hourglassPendant', 'epic', 'hourglass', { cooldown: 0.15 }),
];

export function itemById(id: string): Item {
  const x = ITEMS.find((i) => i.id === id);
  if (!x) throw new Error(`unknown item ${id}`);
  return x;
}
