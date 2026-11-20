import type { RegionId } from '../../data/campaign';
import type { ClassId, Team } from '../../sim/types';
import { BOSS_SCALE } from '../figures';
import { BOSS_COLORS, FX, MODEL_COLORS } from '../palette';
import type { ModelId, WeaponId } from './assets';
import type { ExtraId } from './props';
import type { Swap } from './recolor';

/** How a body fights, which picks its clips (see `clips.ts`). `2h`: boss with a two-handed weapon; `bite`: the wolf. */
export type BodyStyle = 'sword' | 'dual' | 'crossbow' | 'staff' | 'orb' | '2h' | 'bite';

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
  /** The main-hand blade whose swing leaves a trail (melee bodies only). */
  blade?: string;
  /** Size relative to a normal unit (bosses, `BOSS_SCALE`). */
  scale?: number;
  /** Props built in code (`props.ts`); staff props sit on `staff` (a rig prop or attached weapon). */
  extras?: readonly ExtraId[];
  staff?: string;
  /** Plain colours by material name, for models without a swatch atlas (the wolf). */
  tints?: Readonly<Record<string, string>>;
  /** Skeleton eyes that glow in this colour (the Bone King). */
  glowEyes?: string;
}

/** Where a battle takes place, as far as the look of its units goes. */
export interface ViewLook {
  region: RegionId;
}

// Prop meshes bundled on each Adventurers rig.
const KNIGHT_PROPS = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'];
const MAGE_PROPS = ['Spellbook', 'Spellbook_open', '1H_Wand', '2H_Staff'];

/** game-pack-generator figures carry their team colour on palette cell 17 (column 1, row 2 of 8). */
const team17 = (color: string): Swap => ({ cell: [1, 2], rows: 8, color });

const except = (all: string[], keep: string[]): string[] => all.filter((n) => !keep.includes(n));

/**
 * The model, kit and colours of a unit (6a and 6c decisions); `null` keeps the code figure.
 */
export function bodyFor(classId: ClassId, team: Team, _hero: boolean, look: ViewLook): BodySpec | null {
  const c = MODEL_COLORS[team];
  const boss = bossBody(classId);
  if (boss) return boss;
  const skeletons = team === 'enemy' && look.region === 'barrowlands';
  if (skeletons) return skeletonBody(classId);
  switch (classId) {
    case 'krieger':
      // Visual test (branch test/gpg-squad): the game-pack-generator knight, both teams. Tabard and
      // shield sit on palette cell 17 (team colour). Sword and shield are part of the skinned mesh
      // and not on a hand slot, so there is no swing trail yet.
      return { model: 'GPG_Knight', hide: [], attach: [], swaps: [team17(c.main)], style: 'sword', skeleton: false };
    case 'schildtraeger':
      // Visual test: the gpg shieldbearer with his sword and tower shield as separate props (KayKit
      // frame, no turn). Tabard and the shield's board are on cell 17; the swap reaches the shield
      // too, since it samples the same palette layout.
      return {
        model: 'GPG_Shieldbearer',
        hide: [],
        attach: [{ weapon: 'GPG_Sword', bone: 'handslot.r' }, { weapon: 'GPG_TowerShield', bone: 'handslot.l' }],
        blade: 'GPG_Sword',
        swaps: [team17(c.main)],
        style: 'sword',
        skeleton: false,
      };
    case 'berserker':
      // Visual test: the gpg berserker with one axe per hand (the left file's blade faces the other
      // way, as KayKit's offhand axe). Kilt and war paint are on cell 17.
      return {
        model: 'GPG_Berserker',
        hide: [],
        attach: [{ weapon: 'GPG_Axe_R', bone: 'handslot.r' }, { weapon: 'GPG_Axe_L', bone: 'handslot.l' }],
        blade: 'GPG_Axe_R',
        swaps: [team17(c.main)],
        style: 'dual',
        skeleton: false,
      };
    case 'bogenschuetze':
      // Visual test (branch test/gpg-squad): the game-pack-generator archer, both teams. Hood and
      // capelet sit on palette cell 17 (column 1, row 2), repainted in the team colour; the crossbow
      // is its own prop with a `muzzle` marker.
      return {
        model: 'GPG_Archer',
        hide: [],
        attach: [{ weapon: 'GPG_Crossbow', bone: 'handslot.r' }],
        swaps: [team17(c.main)],
        style: 'crossbow',
        skeleton: false,
      };
    case 'magier':
      // Visual test (branch test/gpg-squad): the gpg wizard, both teams; robe, sleeves and hat on cell 17.
      // The staff is part of the skinned mesh, weighted to the right hand slot: its tip is measured from those vertices.
      return { model: 'GPG_Wizard', hide: [], attach: [], swaps: [team17(c.main)], style: 'staff', skeleton: false, staff: 'handslot.r' };
    case 'heiler':
      // Visual test (branch test/gpg-squad): the game-pack-generator healer, both teams; the stole
      // sits on palette cell 17 (team colour). The orb is added in code as before.
      return { model: 'GPG_Healer', hide: [], attach: [], swaps: [team17(c.main)], style: 'orb', skeleton: false };
    case 'schamane':
      // A Mage without the hat: bone mask with antlers, a totem on the staff (6c decisions).
      return {
        model: 'Mage',
        hide: [...except(MAGE_PROPS, ['2H_Staff']), 'Mage_Hat'],
        attach: [],
        swaps: [{ cell: [0, 1], color: c.deep }, { cell: [1, 1], color: c.deep }, { cell: [2, 1], color: c.main }, { cell: [5, 0], color: c.trim }],
        style: 'staff',
        skeleton: false,
        extras: ['mask', 'totem'],
        staff: '2H_Staff',
      };
    case 'wolf':
      return { model: 'Wolf', hide: [], attach: [], swaps: [], style: 'bite', skeleton: false, tints: { Main: BOSS_COLORS.wolfFur, Main_Light: BOSS_COLORS.wolfFurLight } };
    default:
      return null;
  }
}

/** The three bosses: scaled KayKit bodies with their signature props (6c decisions). */
function bossBody(classId: ClassId): BodySpec | null {
  const k = BOSS_COLORS;
  const scale = BOSS_SCALE[classId];
  switch (classId) {
    case 'kriegsherr':
      // Knight in dark iron plate, horns on the helmet, the Barbarian's two-handed axe.
      return {
        model: 'Knight',
        hide: KNIGHT_PROPS,
        attach: [{ weapon: 'axe_2handed', bone: 'handslot.r' }],
        blade: 'axe_2handed',
        swaps: [
          ...([[3, 0], [7, 0], [2, 1], [3, 1], [7, 1]] as const).map((cell) => ({ cell, color: k.ironEdge })),
          { cell: [1, 1], color: k.steel },
          { cell: [0, 1], color: MODEL_COLORS.enemy.deep },
          { cell: [6, 0], color: k.ironDark },
        ],
        style: '2h',
        skeleton: false,
        scale,
        extras: ['horns'],
      };
    case 'sumpfhexe':
      // Mage hat and robe in ragged greens, hag skin, rags at the waist, green glow on the staff.
      return {
        model: 'Mage',
        hide: except(MAGE_PROPS, ['2H_Staff']),
        attach: [],
        swaps: [
          { cell: [0, 1], color: k.rag },
          { cell: [1, 1], color: k.ragDark },
          { cell: [2, 1], color: k.ragLight },
          // Hat band and staff wood: dull rust instead of the Mage's bright orange.
          { cell: [5, 0], color: k.rustDark },
          { cell: [0, 0], color: k.hag },
        ],
        style: 'staff',
        skeleton: false,
        scale,
        extras: ['rags', 'witchGlow'],
        staff: '2H_Staff',
      };
    case 'knochenkoenig':
      // Skeleton Warrior without the helmet: rusty crown, greatsword, glowing blue eyes.
      return {
        model: 'Skeleton_Warrior',
        hide: ['Skeleton_Warrior_Helmet'],
        attach: [{ weapon: 'sword_2handed', bone: 'handslot.r' }],
        blade: 'sword_2handed',
        swaps: [{ cell: [2, 2], color: MODEL_COLORS.enemy.deep }],
        style: '2h',
        skeleton: true,
        scale,
        extras: ['crown'],
        glowEyes: FX.boneGlow,
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
      return { ...base, model: 'Skeleton_Warrior', attach: [{ weapon: 'Skeleton_Blade', bone: 'handslot.r' }, { weapon: 'Skeleton_Shield_Large_A', bone: 'handslot.l' }], swaps: cloak([2, 2]), style: 'sword', blade: 'Skeleton_Blade' };
    case 'krieger':
      return { ...base, model: 'Skeleton_Warrior', attach: [{ weapon: 'Skeleton_Blade', bone: 'handslot.r' }, { weapon: 'Skeleton_Shield_Small_A', bone: 'handslot.l' }], swaps: cloak([2, 2]), style: 'sword', blade: 'Skeleton_Blade' };
    case 'berserker':
      return { ...base, model: 'Skeleton_Minion', attach: [{ weapon: 'Skeleton_Axe', bone: 'handslot.r' }, { weapon: 'Skeleton_Axe', bone: 'handslot.l' }], swaps: cloak([5, 0]), style: 'dual', blade: 'Skeleton_Axe' };
    case 'bogenschuetze':
      return { ...base, model: 'Skeleton_Rogue', attach: [{ weapon: 'Skeleton_Crossbow', bone: 'handslot.r' }], swaps: cloak([2, 2]), style: 'crossbow' };
    case 'magier':
      return { ...base, model: 'Skeleton_Mage', attach: [{ weapon: 'Skeleton_Staff', bone: 'handslot.r' }], swaps: cloak([2, 2]), style: 'staff' };
    case 'heiler':
      return { ...base, model: 'Skeleton_Mage', attach: [], swaps: [{ cell: [2, 2], color: c.robe }], style: 'orb' };
    case 'schamane':
      return {
        ...base,
        model: 'Skeleton_Mage',
        hide: ['Skeleton_Mage_Hat'],
        attach: [{ weapon: 'Skeleton_Staff', bone: 'handslot.r' }],
        swaps: cloak([2, 2]),
        style: 'staff',
        extras: ['mask', 'totem'],
        staff: 'Skeleton_Staff',
      };
    case 'wolf':
      return bodyFor('wolf', 'enemy', false, { region: 'greenmarch' });
    default:
      return null;
  }
}
