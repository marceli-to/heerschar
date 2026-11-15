import { NODES, REGIONS, regionNodes, type CampId, type CampaignNode } from '../../src/data/campaign';
import type { EncounterId } from '../../src/data/encounters';
import { itemById } from '../../src/data/items';
import { campOffers, characterOf, choose, currentChoice, equip, isNodeOpen, newGame, passCamp, recordBattle, recruit, takeLoot, type GameState } from '../../src/meta/game';
import type { PlayableClassId } from '../../src/sim/types';

/**
 * Shared by the balance reports: how a player walks the campaign map. Nodes in map order (left to
 * right within each region, first open one first), camps take the offer rarest in the field, level-ups a
 * seeded pick, loot the rarest item, equipped on the first fielded character it improves.
 */

const RANK = { common: 0, rare: 1, epic: 2 } as const;

/** Settles pending rewards: level-up picks by `pick`, the rarest loot, equipped where it helps. */
export function settle(s: GameState, pick: number): void {
  for (let c = currentChoice(s), i = 0; c; c = currentChoice(s), i++) choose(s, c.options![(pick + i) % c.options!.length]!);
  const loot = s.rewards?.loot;
  if (!loot) return;
  const best = [...loot].sort((a, b) => RANK[itemById(b).rarity] - RANK[itemById(a).rarity])[0]!;
  takeLoot(s, best);
  const item = itemById(best);
  for (const id of s.squad.fielded) {
    const c = characterOf(s, id);
    const worn = c[item.slot];
    if ((item.classId === null || item.classId === c.classId) && (!worn || RANK[itemById(worn).rarity] < RANK[item.rarity])) {
      equip(s, id, best);
      return;
    }
  }
}

/** Every campaign node in walking order for one game: map order, the first open node next. */
export function nextNode(s: GameState, done: ReadonlySet<string>): CampaignNode | null {
  for (const region of REGIONS) {
    const todo = [...regionNodes(region)].sort((a, b) => a.x - b.x).filter((x) => !done.has(x.id));
    const open = todo.find((x) => isNodeOpen(s, x.id));
    if (open) return open;
    if (todo.length > 0) return null;
  }
  return null;
}

/**
 * Takes the offer whose class is rarest in the field, as a player keeping a mixed company would
 * (blind picks stacked three healers in some walks, which then stall against shamans); `pick`
 * breaks a tie.
 */
export function visitCamp(s: GameState, id: CampId, pick: number): void {
  const count = (k: string) => s.squad.fielded.filter((f) => characterOf(s, f).classId === k).length;
  const offers = campOffers(s, id);
  const a = count(offers[0]!.classId), b = count(offers[1]!.classId);
  if (!recruit(s, id, a === b ? pick % 2 : a < b ? 0 : 1)) passCamp(s, id);
}

/**
 * Walks the whole map winning every battle (no fighting), and returns a copy of the game right
 * before each battle: the squad a player who took every node once would bring there.
 */
export function snapshots(heroClass: PlayableClassId, walk: number): Map<EncounterId, GameState> {
  const s = newGame(heroClass, 'Hero', walk);
  const out = new Map<EncounterId, GameState>();
  const done = new Set<string>();
  let i = 0;
  for (let node = nextNode(s, done); node; node = nextNode(s, done)) {
    done.add(node.id);
    if (node.kind === 'camp') visitCamp(s, node.id as CampId, walk + i++);
    else {
      out.set(node.id as EncounterId, JSON.parse(JSON.stringify(s)) as GameState);
      recordBattle(s, node.id as EncounterId, true);
      settle(s, walk + i++);
    }
  }
  if (done.size !== NODES.length) throw new Error('walk did not reach every node');
  return out;
}
