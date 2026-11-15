import type { RegionId } from '../../data/campaign';
import type { ClassId, Team } from '../../sim/types';
import { MODEL_COLORS } from '../palette';
import type { ModelId, WeaponId } from './assets';
import type { Swap } from './recolor';

/** How a body fights, which picks its clips (see `clips.ts`). */
export type BodyStyle = 'sword' | 'dual' | 'crossbow' | 'staff' | 'orb';

export interface BodySpec {
  model: ModelId;
  /** Prop meshes the pack bundles on the rig that this body does not carry. */
  hide: readonly string[];
  /** Separate weapon files parented to a hand slot (the Skeletons pack ships weapons apart). */
  attach: readonly { weapon: WeaponId; bone: 'handslot.r' | 'handslot.l' }[];
  swaps: Swap[];
  style: BodyStyle;
  /** Skeletons fall apart when they die and taunt instead of cheering. */
  skeleton: boolean;
}

/** Where a battle takes place, as far as the look of its units goes. */
export interface ViewLook {
  region: RegionId;
}

// Prop meshes bundled on each Adventurers rig.
const KNIGHT_PROPS = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'];
const MAGE_PROPS = ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'];
const ROGUE_PROPS = ['Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Knife', 'Throwable'];
const BARBARIAN_PROPS = ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', '2H_Axe', 'Mug'];

const except = (all: string[], keep: string[]): string[] => all.filter((n) => !keep.includes(n));

/**
 * The model, kit and colours of a unit (6a decisions). Bosses, the Shaman and wolves have no
 * model yet (6c) and keep their code figures: `null`.
 */
export function bodyFor(classId: ClassId, team: Team, hero: boolean, look: ViewLook): BodySpec | null {
  const c = MODEL_COLORS[team];
  const trim = hero ? MODEL_COLORS.heroTrim : c.trim;
  const skeletons = team === 'enemy' && look.region === 'barrowlands';
  if (skeletons) return skeletonBody(classId);
  switch (classId) {
    case 'krieger':
      // Player warriors carry the badge shield, enemy warriors the round one.
      return {
        model: 'Knight',
        hide: except(KNIGHT_PROPS, ['1H_Sword', team === 'player' ? 'Badge_Shield' : 'Round_Shield']),
        attach: [],
        swaps: [{ cell: [0, 1], color: c.main }, { cell: [6, 0], color: trim }],
        style: 'sword',
        skeleton: false,
      };
    case 'schildtraeger':
      return {
        model: 'Knight',
        hide: except(KNIGHT_PROPS, ['1H_Sword', 'Rectangle_Shield']),
        attach: [],
        swaps: [{ cell: [0, 1], color: c.deep }, { cell: [6, 0], color: c.trim }],
        style: 'sword',
        skeleton: false,
      };
    case 'berserker':
      return {
        model: 'Barbarian',
        hide: except(BARBARIAN_PROPS, ['1H_Axe', '1H_Axe_Offhand']),
        attach: [],
        swaps: [{ cell: [0, 1], color: c.main }, { cell: [1, 1], color: c.main }, { cell: [6, 0], color: c.trim }],
        style: 'dual',
        skeleton: false,
      };
    case 'bogenschuetze':
      return {
        model: 'Rogue_Hooded',
        hide: except(ROGUE_PROPS, ['2H_Crossbow']),
        attach: [],
        swaps: [{ cell: [1, 1], color: c.main }, { cell: [0, 1], color: c.deep }, { cell: [6, 0], color: trim }],
        style: 'crossbow',
        skeleton: false,
      };
    case 'magier':
      return {
        model: 'Mage',
        hide: except(MAGE_PROPS, ['2H_Staff']),
        attach: [],
        swaps: [{ cell: [0, 1], color: c.deep }, { cell: [1, 1], color: c.deep }, { cell: [2, 1], color: c.main }, { cell: [5, 0], color: trim }],
        style: 'staff',
        skeleton: false,
      };
    case 'heiler':
      // The recoloured Mage in light robes with a glowing orb (Stage 6 decisions).
      return {
        model: 'Mage',
        hide: MAGE_PROPS,
        attach: [],
        swaps: [{ cell: [0, 1], color: c.robe }, { cell: [1, 1], color: c.robe }, { cell: [2, 1], color: c.main }, { cell: [5, 0], color: trim }],
        style: 'orb',
        skeleton: false,
      };
    default:
      return null;
  }
}

/** Barrowlands enemies: KayKit Skeletons with cold cloaks. */
function skeletonBody(classId: ClassId): BodySpec | null {
  const c = MODEL_COLORS.enemy;
  const cloak = (cell: readonly [number, number]): Swap[] => [{ cell, color: c.main }];
  const base = { hide: [], skeleton: true } as const;
  switch (classId) {
    case 'schildtraeger':
      return { ...base, model: 'Skeleton_Warrior', attach: [{ weapon: 'Skeleton_Blade', bone: 'handslot.r' }, { weapon: 'Skeleton_Shield_Large_A', bone: 'handslot.l' }], swaps: cloak([2, 2]), style: 'sword' };
    case 'krieger':
      return { ...base, model: 'Skeleton_Warrior', attach: [{ weapon: 'Skeleton_Blade', bone: 'handslot.r' }, { weapon: 'Skeleton_Shield_Small_A', bone: 'handslot.l' }], swaps: cloak([2, 2]), style: 'sword' };
    case 'berserker':
      return { ...base, model: 'Skeleton_Minion', attach: [{ weapon: 'Skeleton_Axe', bone: 'handslot.r' }, { weapon: 'Skeleton_Axe', bone: 'handslot.l' }], swaps: cloak([5, 0]), style: 'dual' };
    case 'bogenschuetze':
      return { ...base, model: 'Skeleton_Rogue', attach: [{ weapon: 'Skeleton_Crossbow', bone: 'handslot.r' }], swaps: cloak([2, 2]), style: 'crossbow' };
    case 'magier':
      return { ...base, model: 'Skeleton_Mage', attach: [{ weapon: 'Skeleton_Staff', bone: 'handslot.r' }], swaps: cloak([2, 2]), style: 'staff' };
    case 'heiler':
      return { ...base, model: 'Skeleton_Mage', attach: [], swaps: [{ cell: [2, 2], color: c.robe }], style: 'orb' };
    default:
      return null;
  }
}
