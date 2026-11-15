import { HERO_DAMAGE, HERO_GUARD, playerSlotStats } from '../data/encounters';
import { itemById, type Item, type ItemSlot } from '../data/items';
import { EFFECT_CAPS, LEVEL_CAP, OFFER_SIZE, PATH_LEVEL, statsAtLevel, sumEffects, xpToNext, type Effect } from '../data/progression';
import { FILLER_UPGRADE, pathById, pathsOf, upgradeById, UPGRADES, type PathId, type Upgrade } from '../data/upgrades';
import { int, type RngHolder } from '../sim/rng';
import { NEUTRAL_MODS, type Stats, type UnitMods } from '../sim/types';
import type { Character } from './squad';

/** Classes whose range an effect may lengthen (melee reach is part of the attack, not the stat). */
const MIN_RANGED = 3;

/** Everything a character's upgrades, path signature and equipped items add up to. */
export function characterEffect(c: Character): Effect {
  const list: Effect[] = c.upgrades.map((id) => upgradeById(id).effect);
  if (c.path) list.push(pathById(c.path).signature);
  for (const id of [c.weapon, c.trinket]) if (id) list.push(itemById(id).effect);
  return sumEffects(list);
}

/** Applies an effect's stat part to stats. */
export function applyEffectToStats(s: Stats, e: Effect): Stats {
  return {
    maxHp: s.maxHp * (1 + (e.hp ?? 0)),
    power: s.power * (1 + (e.power ?? 0)),
    armor: s.armor + (e.armor ?? 0),
    resist: s.resist + (e.resist ?? 0),
    moveSpeed: s.moveSpeed * (1 + (e.speed ?? 0)),
    attackInterval: s.attackInterval / (1 + (e.haste ?? 0)),
    range: s.range >= MIN_RANGED ? s.range + (e.range ?? 0) : s.range,
  };
}

/** Turns an effect's battle part into unit mods. */
export function effectMods(e: Effect): UnitMods {
  return {
    ...NEUTRAL_MODS,
    damage: 1 + (e.damage ?? 0),
    damageTaken: 1 - Math.min(EFFECT_CAPS.toughness, e.toughness ?? 0),
    healing: 1 + (e.healing ?? 0),
    cooldown: 1 - Math.min(EFFECT_CAPS.cooldown, e.cooldown ?? 0),
    lifesteal: Math.min(EFFECT_CAPS.lifesteal, e.lifesteal ?? 0),
    control: e.control ?? 0,
    slowOnHit: e.slowOnHit ?? 0,
    area: 1 + (e.area ?? 0),
    guardShield: e.guardShield ?? 0,
    crit: Math.min(EFFECT_CAPS.crit, e.crit ?? 0),
    selfRally: e.selfRally ?? 0,
  };
}

/** The stats a character takes into battle (what the character sheet shows). */
export function characterStats(c: Character): Stats {
  return applyEffectToStats(statsAtLevel(playerSlotStats(c.classId, c.isHero, c.level), c.classId, c.level), characterEffect(c));
}

/** The battle mods a character takes into battle. */
export function characterMods(c: Character): UnitMods {
  const mods = effectMods(characterEffect(c));
  return c.isHero ? { ...mods, damage: mods.damage * HERO_DAMAGE, damageTaken: mods.damageTaken * HERO_GUARD[c.classId] } : mods;
}

// ---------------------------------------------------------------------------------------------
// Experience

/**
 * Adds experience and levels up as far as it reaches. At the cap the rest is dropped. Returns
 * the levels reached (in order), each of which owes the player a choice.
 */
export function addXp(c: Character, amount: number): number[] {
  const reached: number[] = [];
  c.xp += amount;
  while (c.level < LEVEL_CAP && c.xp >= xpToNext(c.level)) {
    c.xp -= xpToNext(c.level);
    c.level++;
    reached.push(c.level);
  }
  if (c.level >= LEVEL_CAP) c.xp = 0;
  return reached;
}

// ---------------------------------------------------------------------------------------------
// Upgrades and paths

/** Whether a level-up asks for a path instead of an upgrade. */
export function isPathLevel(level: number): boolean {
  return level === PATH_LEVEL;
}

function timesTaken(c: Character, id: string): number {
  return c.upgrades.filter((x) => x === id).length;
}

/** The upgrades a character could take now: own class, base pool or own path, not maxed. */
export function availableUpgrades(c: Character): Upgrade[] {
  return UPGRADES.filter((u) => u.classId === c.classId && (u.path === null || u.path === c.path) && timesTaken(c, u.id) < u.max);
}

/** Draws distinct items from a list with the seeded RNG. */
function drawDistinct<T>(rng: RngHolder, list: readonly T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length > 0) out.push(pool.splice(int(rng, pool.length), 1)[0]!);
  return out;
}

/** Three upgrade options for a level-up; the filler tops up a dry pool. */
export function rollUpgradeOptions(rng: RngHolder, c: Character): string[] {
  const ids = drawDistinct(rng, availableUpgrades(c), OFFER_SIZE).map((u) => u.id);
  if (ids.length < OFFER_SIZE) ids.push(FILLER_UPGRADE);
  return ids;
}

export function pathOptions(c: Character): PathId[] {
  return pathsOf(c.classId).map((p) => p.id);
}

/** Takes an upgrade. Throws when it does not fit the character. */
export function takeUpgrade(c: Character, id: string): void {
  const u = upgradeById(id);
  if (u.classId !== null && u.classId !== c.classId) throw new Error(`${id} is not for ${c.classId}`);
  if (u.path !== null && u.path !== c.path) throw new Error(`${id} needs the ${u.path} path`);
  if (timesTaken(c, id) >= u.max) throw new Error(`${id} is maxed`);
  c.upgrades.push(id);
}

export function takePath(c: Character, id: PathId): void {
  if (c.path !== null) throw new Error(`${c.name} already has a path`);
  if (pathById(id).classId !== c.classId) throw new Error(`${id} is not for ${c.classId}`);
  c.path = id;
}

// ---------------------------------------------------------------------------------------------
// Items

export function canEquip(c: Character, item: Item): boolean {
  return item.classId === null || item.classId === c.classId;
}

/** The stats a character would fight with wearing `itemId` (or nothing) in `slot` (for the sheet's preview). */
export function statsWithItem(c: Character, slot: ItemSlot, itemId: string | null): Stats {
  return characterStats({ ...c, [slot]: itemId });
}
