import type { PlayableClassId } from '../sim/types';
import type { Effect } from './progression';

/** Pictograms for upgrade cards (drawn in the UI). */
export type UpgradeIcon =
  | 'heart'
  | 'fist'
  | 'shield'
  | 'horn'
  | 'drop'
  | 'boot'
  | 'eye'
  | 'arrow'
  | 'bow'
  | 'cross'
  | 'sun'
  | 'hourglass'
  | 'flame'
  | 'snow'
  | 'star'
  | 'burst';

export type UpgradeKind = 'stat' | 'ability' | 'passive';

export type PathId = 'waechter' | 'berserker' | 'scharfschuetze' | 'jaeger' | 'priester' | 'kampfmoench' | 'feuer' | 'eis';

/** A specialisation chosen at `PATH_LEVEL`: changes one ability (the signature) and opens a second upgrade pool. */
export interface Path {
  id: PathId;
  classId: PlayableClassId;
  icon: UpgradeIcon;
  signature: Effect;
}

export interface Upgrade {
  id: string;
  /** `null` = any class (the filler). */
  classId: PlayableClassId | null;
  /** Only offered after choosing this path. */
  path: PathId | null;
  kind: UpgradeKind;
  icon: UpgradeIcon;
  /** How often it can be taken. */
  max: number;
  effect: Effect;
}

/** The two paths per class (PLAN section 10). Names in `STRINGS.paths`. */
export const PATHS: readonly Path[] = [
  { id: 'waechter', classId: 'krieger', icon: 'shield', signature: { guardShield: 1.5 } },
  { id: 'berserker', classId: 'krieger', icon: 'horn', signature: { selfRally: 4, damage: 0.08 } },
  { id: 'scharfschuetze', classId: 'bogenschuetze', icon: 'eye', signature: { crit: 0.2 } },
  { id: 'jaeger', classId: 'bogenschuetze', icon: 'boot', signature: { slowOnHit: 2, speed: 0.1 } },
  { id: 'priester', classId: 'heiler', icon: 'sun', signature: { healing: 0.25, area: 0.25 } },
  { id: 'kampfmoench', classId: 'heiler', icon: 'fist', signature: { damage: 0.4, lifesteal: 0.15 } },
  { id: 'feuer', classId: 'magier', icon: 'flame', signature: { area: 0.3, damage: 0.1 } },
  { id: 'eis', classId: 'magier', icon: 'snow', signature: { control: 1.5 } },
];

const u = (id: string, classId: PlayableClassId | null, path: PathId | null, kind: UpgradeKind, icon: UpgradeIcon, max: number, effect: Effect): Upgrade => ({ id, classId, path, kind, icon, max, effect });

/**
 * Upgrade pools: a base pool per class and one per path. Every level-up offers three from what
 * the character can still take. Names in `STRINGS.upgrades`.
 */
export const UPGRADES: readonly Upgrade[] = [
  // Krieger
  u('stout', 'krieger', null, 'stat', 'heart', 4, { hp: 0.12 }),
  u('heavyHand', 'krieger', null, 'stat', 'fist', 4, { power: 0.1 }),
  u('ironSkin', 'krieger', null, 'stat', 'shield', 2, { armor: 12, resist: 6 }),
  u('bellow', 'krieger', null, 'ability', 'horn', 2, { control: 1 }),
  u('secondWind', 'krieger', null, 'passive', 'drop', 2, { lifesteal: 0.08 }),
  u('bulwark', 'krieger', 'waechter', 'stat', 'shield', 3, { toughness: 0.08 }),
  u('unyielding', 'krieger', 'waechter', 'ability', 'shield', 1, { guardShield: 1 }),
  u('steadfast', 'krieger', 'waechter', 'ability', 'hourglass', 1, { cooldown: 0.15 }),
  u('bloodlust', 'krieger', 'berserker', 'passive', 'drop', 1, { lifesteal: 0.1 }),
  u('savageBlows', 'krieger', 'berserker', 'stat', 'fist', 3, { damage: 0.1 }),
  u('killerInstinct', 'krieger', 'berserker', 'passive', 'burst', 1, { crit: 0.15 }),
  // Bogenschuetze
  u('keenEye', 'bogenschuetze', null, 'stat', 'eye', 4, { power: 0.1 }),
  u('lightFeet', 'bogenschuetze', null, 'stat', 'boot', 3, { speed: 0.08, hp: 0.06 }),
  u('quickDraw', 'bogenschuetze', null, 'stat', 'bow', 3, { haste: 0.1 }),
  u('longbow', 'bogenschuetze', null, 'stat', 'bow', 1, { range: 2 }),
  u('cripplingArrows', 'bogenschuetze', null, 'passive', 'arrow', 1, { slowOnHit: 1.5 }),
  u('deadeye', 'bogenschuetze', 'scharfschuetze', 'passive', 'burst', 1, { crit: 0.1 }),
  u('steadyAim', 'bogenschuetze', 'scharfschuetze', 'stat', 'eye', 3, { power: 0.12 }),
  u('headhunter', 'bogenschuetze', 'scharfschuetze', 'passive', 'arrow', 1, { damage: 0.1 }),
  u('fleet', 'bogenschuetze', 'jaeger', 'stat', 'boot', 3, { speed: 0.1, haste: 0.05 }),
  u('snare', 'bogenschuetze', 'jaeger', 'ability', 'arrow', 1, { control: 1 }),
  u('skirmisher', 'bogenschuetze', 'jaeger', 'stat', 'bow', 1, { haste: 0.12 }),
  // Heiler
  u('devotion', 'heiler', null, 'stat', 'sun', 4, { healing: 0.12 }),
  u('resilience', 'heiler', null, 'stat', 'heart', 3, { hp: 0.12 }),
  u('serenity', 'heiler', null, 'ability', 'hourglass', 2, { cooldown: 0.12 }),
  u('wardingLight', 'heiler', null, 'stat', 'shield', 2, { resist: 15, armor: 8 }),
  u('longReach', 'heiler', null, 'stat', 'cross', 1, { range: 2 }),
  u('sanctuary', 'heiler', 'priester', 'ability', 'sun', 1, { area: 0.2 }),
  u('grace', 'heiler', 'priester', 'stat', 'cross', 3, { healing: 0.1 }),
  u('martyr', 'heiler', 'priester', 'passive', 'shield', 1, { toughness: 0.1 }),
  u('ironFist', 'heiler', 'kampfmoench', 'stat', 'fist', 3, { power: 0.1 }),
  u('flurry', 'heiler', 'kampfmoench', 'stat', 'burst', 1, { haste: 0.12 }),
  u('innerFire', 'heiler', 'kampfmoench', 'passive', 'drop', 1, { lifesteal: 0.1 }),
  // Magier
  u('arcanePower', 'magier', null, 'stat', 'star', 4, { power: 0.1 }),
  u('focus', 'magier', null, 'ability', 'hourglass', 2, { cooldown: 0.12 }),
  u('mageArmour', 'magier', null, 'stat', 'shield', 3, { hp: 0.1, resist: 10 }),
  u('wideBlast', 'magier', null, 'ability', 'burst', 2, { area: 0.15 }),
  u('quickCast', 'magier', null, 'stat', 'star', 2, { haste: 0.1 }),
  u('inferno', 'magier', 'feuer', 'stat', 'flame', 3, { damage: 0.1 }),
  u('wildfire', 'magier', 'feuer', 'passive', 'burst', 1, { crit: 0.15 }),
  u('kindling', 'magier', 'feuer', 'ability', 'flame', 1, { area: 0.15 }),
  u('deepFreeze', 'magier', 'eis', 'ability', 'snow', 2, { control: 0.5 }),
  u('iceArmour', 'magier', 'eis', 'stat', 'shield', 2, { toughness: 0.1, hp: 0.1 }),
  u('chill', 'magier', 'eis', 'ability', 'hourglass', 1, { cooldown: 0.15 }),
  // Filler, offered when a character's pools run dry.
  u('seasoned', null, null, 'stat', 'star', Infinity, { hp: 0.05, power: 0.05 }),
];

export const FILLER_UPGRADE = 'seasoned';

export function upgradeById(id: string): Upgrade {
  const x = UPGRADES.find((u) => u.id === id);
  if (!x) throw new Error(`unknown upgrade ${id}`);
  return x;
}

export function pathById(id: PathId): Path {
  const x = PATHS.find((p) => p.id === id);
  if (!x) throw new Error(`unknown path ${id}`);
  return x;
}

export function pathsOf(classId: PlayableClassId): [Path, Path] {
  const list = PATHS.filter((p) => p.classId === classId);
  if (list.length !== 2) throw new Error(`class ${classId} needs two paths`);
  return [list[0]!, list[1]!];
}
