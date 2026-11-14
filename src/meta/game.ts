import { FINAL_BOSS, NODES, REGIONS, nodeById, regionBoss, regionStart, type CampId, type CampaignNode, type RegionId } from '../data/campaign';
import { encounterById, type EncounterId } from '../data/encounters';
import { ITEMS, LOOT_ODDS, itemById, type ItemSlot, type LootTier, type Rarity } from '../data/items';
import { BENCH_SHARE, OFFER_SIZE, PATH_LEVEL } from '../data/progression';
import { RECRUIT_NAMES, newCharacter, newSquad } from '../data/roster';
import type { PathId } from '../data/upgrades';
import { int, nextFloat, seedState, type RngHolder } from '../sim/rng';
import type { PlayableClassId } from '../sim/types';
import { addXp, canEquip, isPathLevel, pathOptions, rollUpgradeOptions, takePath, takeUpgrade } from './progression';
import { ROSTER_LIMIT, isFielded, setFielded, type Character, type SquadState } from './squad';

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

/** A camp once the player has looked in: the two recruits on offer, and whether it is done. */
export interface CampState {
  offers: Character[];
  /** Someone joined (or the player moved on); the camp then opens the roads behind it. */
  done: boolean;
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
  /** Camps visited, with their offers (drawn once, kept so a reload shows the same two). */
  camps: Partial<Record<CampId, CampState>>;
  /** Battles fought and lost (for the ending summary). */
  battles: number;
  lost: number;
  /** Time spent in the game past the title, in ms (for the ending summary). */
  playMs: number;
  /** The ending summary has been shown (it appears once, after the last boss). */
  endingSeen: boolean;
}

export const GAME_VERSION = 3;

export function newGame(heroClass: PlayableClassId, heroName: string, seed: number): GameState {
  return { version: GAME_VERSION, seed, rngState: seedState(seed), squad: newSquad(heroClass, heroName), inventory: [], won: [], rewards: null, camps: {}, battles: 0, lost: 0, playMs: 0, endingSeen: false };
}

export function characterOf(state: GameState, id: number): Character {
  const c = state.squad.roster.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character ${id}`);
  return c;
}

// ---------------------------------------------------------------------------------------------
// The campaign map

/** A battle node is done once won, a camp once someone joined (or the player moved on). */
export function isNodeDone(state: GameState, node: CampaignNode): boolean {
  return node.kind === 'camp' ? state.camps[node.id as CampId]?.done === true : state.won.includes(node.id as EncounterId);
}

/** The first region is open from the start, each further one once the boss before it falls. */
export function isRegionOpen(state: GameState, region: RegionId): boolean {
  const i = REGIONS.indexOf(region);
  return i === 0 || (i > 0 && state.won.includes(regionBoss(REGIONS[i - 1]!).id as EncounterId));
}

/**
 * A node can be entered when its region is open and it is the region's first node or a done
 * node leads to it. Done nodes stay open (won battles can be replayed for nothing), so the player
 * can go back and take the other roads too.
 */
export function isNodeOpen(state: GameState, id: string): boolean {
  const node = nodeById(id);
  if (!isRegionOpen(state, node.region)) return false;
  if (regionStart(node.region).id === id) return true;
  return NODES.some((p) => p.next.includes(node.id) && isNodeDone(state, p));
}

/** Kept for the screens that pick a battle: an encounter can be fought when its node is open. */
export function isUnlocked(state: GameState, id: EncounterId): boolean {
  return isNodeOpen(state, id);
}

/** The last boss has fallen. */
export function campaignWon(state: GameState): boolean {
  return state.won.includes(FINAL_BOSS);
}

/** The last boss has fallen, the spoils are settled and the summary has not been shown yet. */
export function endingDue(state: GameState): boolean {
  return campaignWon(state) && !state.endingSeen && state.rewards === null;
}

/** Adds play time (ignores negative or broken amounts). */
export function addPlayTime(state: GameState, ms: number): void {
  if (Number.isFinite(ms) && ms > 0) state.playMs += ms;
}

// ---------------------------------------------------------------------------------------------
// Camps

const RECRUIT_CLASSES: readonly PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

/** Recruits join at the roster's average level (rounded down), so they are useful at once. */
export function recruitLevel(state: GameState): number {
  const roster = state.squad.roster;
  return Math.max(1, Math.floor(roster.reduce((sum, c) => sum + c.level, 0) / roster.length));
}

/**
 * A recruit ready to join: a free name of its class and the roster level, with the path and the
 * upgrades of the levels below drawn for them (so the player compares two finished characters).
 */
function drawRecruit(state: GameState, classId: PlayableClassId, taken: readonly string[], level: number): Character {
  const pool = RECRUIT_NAMES[classId].filter((name) => !taken.includes(name));
  const name = pool.length > 0 ? pool[int(state, pool.length)]! : `${RECRUIT_NAMES[classId][0]} ${taken.length + 1}`;
  const c = newCharacter(0, name, classId);
  for (let l = 2; l <= level; l++) {
    c.level = l;
    if (l === PATH_LEVEL) {
      const paths = pathOptions(c);
      takePath(c, paths[int(state, paths.length)]!);
    } else {
      const options = rollUpgradeOptions(state, c);
      takeUpgrade(c, options[int(state, options.length)]!);
    }
  }
  return c;
}

/** The camp's two recruits, of different classes. Drawn on the first look, then kept. */
export function campOffers(state: GameState, campId: CampId): Character[] {
  const existing = state.camps[campId];
  if (existing) return existing.offers;
  const classes = [...RECRUIT_CLASSES];
  const level = recruitLevel(state);
  const taken = state.squad.roster.map((c) => c.name);
  const offers: Character[] = [];
  for (let i = 0; i < 2; i++) {
    const classId = classes.splice(int(state, classes.length), 1)[0]!;
    const recruit = drawRecruit(state, classId, taken, level);
    taken.push(recruit.name);
    offers.push(recruit);
  }
  state.camps[campId] = { offers, done: false };
  return offers;
}

/**
 * One of the camp's two joins the roster (fielded when there is room) and the camp is done.
 * Fails when the camp is done or the roster is full.
 */
export function recruit(state: GameState, campId: CampId, index: number): boolean {
  const offers = campOffers(state, campId);
  const camp = state.camps[campId]!;
  const chosen = offers[index];
  if (camp.done || !chosen || state.squad.roster.length >= ROSTER_LIMIT) return false;
  // A plain copy (the state may be a Vue proxy, which structuredClone refuses).
  const c: Character = { ...chosen, upgrades: [...chosen.upgrades], id: Math.max(...state.squad.roster.map((x) => x.id)) + 1 };
  state.squad.roster.push(c);
  setFielded(state.squad, c.id, true);
  camp.done = true;
  return true;
}

/** Leaves a camp without a recruit (e.g. with a full roster); its roads open all the same. */
export function passCamp(state: GameState, campId: CampId): void {
  campOffers(state, campId);
  state.camps[campId]!.done = true;
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
