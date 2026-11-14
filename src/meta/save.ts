import { FINAL_BOSS, NODES } from '../data/campaign';
import { ENCOUNTERS } from '../data/encounters';
import { ITEMS } from '../data/items';
import { LEVEL_CAP } from '../data/progression';
import { PATHS, UPGRADES } from '../data/upgrades';
import { GAME_VERSION, type GameState } from './game';
import { MAX_FIELDED, ROSTER_LIMIT } from './squad';

/**
 * One save slot in `localStorage` (PLAN section 12). The save carries a `version`; older ones
 * run through `MIGRATIONS`, newer or broken ones are rejected so the game falls back to the
 * title instead of crashing.
 */
export const SAVE_KEY = 'heerschar.save';

/** The part of `Storage` the save needs (tests pass a plain object). */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** `MIGRATIONS[n]` turns a version n save into version n + 1. */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2 (Stage 5): the battle chain became the campaign map. Won battles keep their ids and
  // open the map nodes after them; no camps visited yet.
  1: (raw) => ({ ...raw, camps: {} }),
  // 2 → 3 (5e): play time starts counting now; a campaign already won has had its ending.
  2: (raw) => ({ ...raw, playMs: 0, endingSeen: Array.isArray(raw.won) && raw.won.includes(FINAL_BOSS) }),
};

export function saveGame(storage: SaveStorage, state: GameState): void {
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearSave(storage: SaveStorage): void {
  storage.removeItem(SAVE_KEY);
}

/** The saved game, or `null` when there is none or it cannot be used. Never throws. */
export function loadGame(storage: SaveStorage): GameState | null {
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return null;
    return parseSave(text);
  } catch {
    return null;
  }
}

/** Parses, migrates and checks a save. Returns `null` for anything unusable. */
export function parseSave(text: string): GameState | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || typeof raw.version !== 'number') return null;
  let data = raw;
  for (let v = raw.version; v < GAME_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return null;
    data = { ...step(data), version: v + 1 };
  }
  if (data.version !== GAME_VERSION) return null;
  return isValidGame(data) ? data : null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

const isInt = (x: unknown): x is number => Number.isInteger(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const ITEM_IDS = new Set(ITEMS.map((i) => i.id));
const UPGRADE_IDS = new Set(UPGRADES.map((u) => u.id));
const PATH_IDS = new Set<string>(PATHS.map((p) => p.id));
const ENCOUNTER_IDS = new Set<string>(ENCOUNTERS.map((e) => e.id));
const CAMP_IDS = new Set<string>(NODES.filter((x) => x.kind === 'camp').map((x) => x.id));
const CLASS_IDS = new Set(['krieger', 'bogenschuetze', 'heiler', 'magier']);

function isValidCharacter(c: unknown): boolean {
  if (!isRecord(c)) return false;
  return (
    isInt(c.id) &&
    typeof c.name === 'string' &&
    CLASS_IDS.has(c.classId as string) &&
    typeof c.isHero === 'boolean' &&
    isInt(c.level) &&
    c.level >= 1 &&
    c.level <= LEVEL_CAP &&
    isNum(c.xp) &&
    Array.isArray(c.upgrades) &&
    c.upgrades.every((u) => UPGRADE_IDS.has(u as string)) &&
    (c.path === null || PATH_IDS.has(c.path as string)) &&
    (c.weapon === null || ITEM_IDS.has(c.weapon as string)) &&
    (c.trinket === null || ITEM_IDS.has(c.trinket as string))
  );
}

function isValidSlot(s: unknown): boolean {
  return isRecord(s) && [0, 1, 2].includes(s.col as number) && [0, 1].includes(s.row as number);
}

/** Structural check of a current-version save: ids exist, the squad rules hold. */
function isValidGame(g: Record<string, unknown>): g is Record<string, unknown> & GameState {
  if (!isNum(g.seed) || !isInt(g.rngState) || !isInt(g.battles) || !isInt(g.lost)) return false;
  if (!isNum(g.playMs) || g.playMs < 0 || typeof g.endingSeen !== 'boolean') return false;
  if (!Array.isArray(g.inventory) || !g.inventory.every((i) => ITEM_IDS.has(i as string))) return false;
  if (!Array.isArray(g.won) || !g.won.every((e) => ENCOUNTER_IDS.has(e as string))) return false;
  const squad = g.squad;
  if (!isRecord(squad) || !Array.isArray(squad.roster) || !Array.isArray(squad.fielded) || !isRecord(squad.formation)) return false;
  if (squad.roster.length > ROSTER_LIMIT || !squad.roster.every(isValidCharacter)) return false;
  if (!isRecord(g.camps) || !Object.entries(g.camps).every(([id, c]) => CAMP_IDS.has(id) && isValidCamp(c))) return false;
  const roster = squad.roster as { id: number; isHero: boolean }[];
  const ids = new Set(roster.map((c) => c.id));
  if (ids.size !== roster.length || roster.filter((c) => c.isHero).length !== 1) return false;
  const fielded = squad.fielded as unknown[];
  if (fielded.length > MAX_FIELDED || new Set(fielded).size !== fielded.length || !fielded.every((id) => ids.has(id as number))) return false;
  const hero = roster.find((c) => c.isHero)!;
  if (!fielded.includes(hero.id)) return false;
  const formation = squad.formation;
  const taken = new Set<string>();
  for (const id of fielded) {
    const slot = formation[String(id)];
    if (!isValidSlot(slot)) return false;
    const key = `${(slot as { col: number }).col},${(slot as { row: number }).row}`;
    if (taken.has(key)) return false;
    taken.add(key);
  }
  return g.rewards === null || isValidRewards(g.rewards, ids);
}

function isValidCamp(c: unknown): boolean {
  return isRecord(c) && typeof c.done === 'boolean' && Array.isArray(c.offers) && c.offers.every(isValidCharacter);
}

function isValidRewards(r: unknown, ids: Set<number>): boolean {
  if (!isRecord(r) || !ENCOUNTER_IDS.has(r.encounterId as string) || !Array.isArray(r.xp) || !Array.isArray(r.choices)) return false;
  if (!(r.loot === null || (Array.isArray(r.loot) && r.loot.every((i) => ITEM_IDS.has(i as string))))) return false;
  return r.choices.every(
    (c) =>
      isRecord(c) &&
      ids.has(c.characterId as number) &&
      isInt(c.level) &&
      (c.kind === 'upgrade' || c.kind === 'path') &&
      (c.options === null || (Array.isArray(c.options) && c.options.every((o) => (c.kind === 'path' ? PATH_IDS : UPGRADE_IDS).has(o as string)))),
  );
}
