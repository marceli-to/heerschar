import { ENCOUNTERS, encounterById, type EncounterId } from '../data/encounters';
import { ITEMS, LOOT_ODDS, itemById, type ItemSlot, type LootTier, type Rarity } from '../data/items';
import { BENCH_SHARE, OFFER_SIZE } from '../data/progression';
import { newSquad } from '../data/roster';
import type { PathId } from '../data/upgrades';
import { int, nextFloat, seedState, type RngHolder } from '../sim/rng';
import type { PlayableClassId } from '../sim/types';
import { addXp, canEquip, isPathLevel, pathOptions, rollUpgradeOptions, takePath, takeUpgrade } from './progression';
import { isFielded, type Character, type SquadState } from './squad';

/** One character's experience from a battle, for the spoils page. */
export interface XpGain {
  characterId: number;
  amount: number;
  fromLevel: number;
  fromXp: number;
  toLevel: number;
  toXp: number;
}

/** A level-up waiting for the player's pick. Options are drawn when it comes up, then kept. */
export interface Choice {
  characterId: number;
  level: number;
  kind: 'upgrade' | 'path';
  options: string[] | null;
}

/** What a first win pays, kept in the save until the player has taken all of it. */
export interface Rewards {
  encounterId: EncounterId;
  xp: XpGain[];
  choices: Choice[];
  /** Item ids to pick one from; `null` once taken. */
  loot: string[] | null;
}

/** Everything that persists between battles (PLAN section 4). */
export interface GameState {
  version: number;
  seed: number;
  rngState: number;
  squad: SquadState;
  /** Item ids not equipped by anyone (repeats allowed). */
  inventory: string[];
  /** Encounters won at least once, in the order first won. */
  won: EncounterId[];
  rewards: Rewards | null;
  /** Battles fought and lost (for the ending summary). */
  battles: number;
  lost: number;
}

export const GAME_VERSION = 1;

export function newGame(heroClass: PlayableClassId, heroName: string, seed: number): GameState {
  return { version: GAME_VERSION, seed, rngState: seedState(seed), squad: newSquad(heroClass, heroName), inventory: [], won: [], rewards: null, battles: 0, lost: 0 };
}

export function characterOf(state: GameState, id: number): Character {
  const c = state.squad.roster.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character ${id}`);
  return c;
}

/** The battles are a chain: the first is open, each further one opens when the one before is won. */
export function isUnlocked(state: GameState, id: EncounterId): boolean {
  const i = ENCOUNTERS.findIndex((e) => e.id === id);
  if (i <= 0) return i === 0;
  return state.won.includes(ENCOUNTERS[i - 1]!.id);
}

// ---------------------------------------------------------------------------------------------
// After a battle

/**
 * Records a finished battle. A first win pays the encounter's experience (fielded characters
 * share it equally, fallen ones included; benched ones get half a share), queues a choice per
 * level reached and rolls the loot offer. Replays and losses pay nothing. Returns the rewards
 * (also kept on `state.rewards`), or `null` when nothing was paid.
 */
export function recordBattle(state: GameState, encounterId: EncounterId, won: boolean): Rewards | null {
  state.battles++;
  if (!won) {
    state.lost++;
    return null;
  }
  if (state.won.includes(encounterId)) return null;
  state.won.push(encounterId);
  const encounter = encounterById(encounterId);
  const share = encounter.xp / state.squad.fielded.length;
  const rewards: Rewards = { encounterId, xp: [], choices: [], loot: null };
  for (const c of state.squad.roster) {
    const amount = Math.floor(isFielded(state.squad, c.id) ? share : share * BENCH_SHARE);
    const gain: XpGain = { characterId: c.id, amount, fromLevel: c.level, fromXp: c.xp, toLevel: 0, toXp: 0 };
    for (const level of addXp(c, amount)) rewards.choices.push({ characterId: c.id, level, kind: isPathLevel(level) ? 'path' : 'upgrade', options: null });
    gain.toLevel = c.level;
    gain.toXp = c.xp;
    rewards.xp.push(gain);
  }
  rewards.loot = rollLoot(state, encounter.loot, state.squad.roster);
  state.rewards = rewards;
  return rewards;
}

/**
 * The level-up the player has to settle next, with its options. Upgrade options are drawn
 * lazily so a path chosen earlier in the queue opens its pool for the later picks; once drawn
 * they are stored, so a reload shows the same three.
 */
export function currentChoice(state: GameState): Choice | null {
  const choice = state.rewards?.choices[0];
  if (!choice) return null;
  if (!choice.options) {
    const c = characterOf(state, choice.characterId);
    choice.options = choice.kind === 'path' ? pathOptions(c) : rollUpgradeOptions(state, c);
  }
  return choice;
}

/** Settles the current choice with one of its options. */
export function choose(state: GameState, option: string): void {
  const choice = currentChoice(state);
  if (!choice?.options?.includes(option)) throw new Error(`${option} is not on offer`);
  const c = characterOf(state, choice.characterId);
  if (choice.kind === 'path') takePath(c, option as PathId);
  else takeUpgrade(c, option);
  state.rewards!.choices.shift();
  settleRewards(state);
}

/** Takes one item from the loot offer into the inventory (`null` = leave it all). */
export function takeLoot(state: GameState, itemId: string | null): void {
  const loot = state.rewards?.loot;
  if (!loot) throw new Error('no loot on offer');
  if (itemId !== null) {
    if (!loot.includes(itemId)) throw new Error(`${itemId} is not on offer`);
    state.inventory.push(itemId);
  }
  state.rewards!.loot = null;
  settleRewards(state);
}

/** Clears the rewards once every choice and the loot are settled. */
function settleRewards(state: GameState): void {
  const r = state.rewards;
  if (r && r.choices.length === 0 && r.loot === null) state.rewards = null;
}

// ---------------------------------------------------------------------------------------------
// Loot

const RARITIES: readonly Rarity[] = ['common', 'rare', 'epic'];

function rollRarity(rng: RngHolder, odds: Record<Rarity, number>, allowed: readonly Rarity[]): Rarity {
  const total = allowed.reduce((sum, r) => sum + odds[r], 0);
  if (total <= 0) return allowed[allowed.length - 1]!;
  let roll = nextFloat(rng) * total;
  for (const r of allowed) {
    roll -= odds[r];
    if (roll < 0) return r;
  }
  return allowed[allowed.length - 1]!;
}

/**
 * Three distinct items for a loot offer: trinkets and weapons for the classes in the roster,
 * each offer's rarity drawn from the tier's odds (among rarities that still have items left).
 */
export function rollLoot(rng: RngHolder, tier: LootTier, roster: readonly Character[]): string[] {
  const classes = new Set(roster.map((c) => c.classId));
  const pool = ITEMS.filter((i) => i.classId === null || classes.has(i.classId));
  const out: string[] = [];
  while (out.length < OFFER_SIZE) {
    const left = pool.filter((i) => !out.includes(i.id));
    if (left.length === 0) break;
    const allowed = RARITIES.filter((r) => left.some((i) => i.rarity === r));
    const rarity = rollRarity(rng, LOOT_ODDS[tier], allowed);
    const ofRarity = left.filter((i) => i.rarity === rarity);
    out.push(ofRarity[int(rng, ofRarity.length)]!.id);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Equipment

/**
 * Equips an item from the inventory; whatever the character wore in that slot goes back to the
 * inventory. Returns whether anything changed.
 */
export function equip(state: GameState, characterId: number, itemId: string): boolean {
  const c = characterOf(state, characterId);
  const item = itemById(itemId);
  const at = state.inventory.indexOf(itemId);
  if (at < 0 || !canEquip(c, item)) return false;
  state.inventory.splice(at, 1);
  const previous = c[item.slot];
  if (previous) state.inventory.push(previous);
  c[item.slot] = itemId;
  return true;
}

const RARITY_ORDER: Record<Rarity, number> = { epic: 0, rare: 1, common: 2 };

/** One kind of item in the baggage that fits a slot, with how many of it lie there. */
export interface BaggageEntry {
  id: string;
  count: number;
}

/** Inventory items `characterId` can wear in `slot`, one entry per kind: best rarity first, then item list order. */
export function fittingItems(state: GameState, characterId: number, slot: ItemSlot): BaggageEntry[] {
  const c = characterOf(state, characterId);
  const counts = new Map<string, number>();
  for (const id of state.inventory) {
    const item = itemById(id);
    if (item.slot === slot && canEquip(c, item)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const order = (id: string) => RARITY_ORDER[itemById(id).rarity] * ITEMS.length + ITEMS.findIndex((i) => i.id === id);
  return [...counts].map(([id, count]) => ({ id, count })).sort((a, b) => order(a.id) - order(b.id));
}

/** Takes a character's item off into the inventory. */
export function unequip(state: GameState, characterId: number, slot: ItemSlot): boolean {
  const c = characterOf(state, characterId);
  const previous = c[slot];
  if (!previous) return false;
  state.inventory.push(previous);
  c[slot] = null;
  return true;
}
