import { reactive } from 'vue';
import { describe, expect, it } from 'vitest';
import { NODES, REGIONS, nodeById, regionBoss, regionNodes, regionStart, type CampId, type CampaignNode } from '../../src/data/campaign';
import { ENCOUNTERS, encounterById, type EncounterId } from '../../src/data/encounters';
import { RECRUIT_NAMES } from '../../src/data/roster';
import { STRINGS } from '../../src/data/strings';
import {
  addPlayTime,
  campaignWon,
  endingDue,
  campOffers,
  choose,
  currentChoice,
  isNodeDone,
  isNodeOpen,
  isRegionOpen,
  newGame,
  passCamp,
  recordBattle,
  recruit,
  recruitLevel,
  takeLoot,
  type GameState,
} from '../../src/meta/game';
import { parseSave } from '../../src/meta/save';
import { HERO_ID, MAX_FIELDED, ROSTER_LIMIT, heroOfSquad } from '../../src/meta/squad';

function settle(s: GameState): void {
  for (let c = currentChoice(s); c; c = currentChoice(s)) choose(s, c.options![0]!);
  if (s.rewards?.loot) takeLoot(s, s.rewards.loot[0]!);
}

/** Wins / visits a node the way a player would (camps: first offer). */
function visit(s: GameState, node: CampaignNode): void {
  if (node.kind === 'camp') {
    if (!recruit(s, node.id as CampId, 0)) passCamp(s, node.id as CampId);
  } else {
    recordBattle(s, node.id as EncounterId, true);
    settle(s);
  }
}

/** Every node of the campaign once, in map order (left to right within each region). */
function walkAll(s: GameState, onBoss?: (node: CampaignNode, s: GameState) => void): void {
  for (const region of REGIONS) {
    const todo = [...regionNodes(region)].sort((a, b) => a.x - b.x);
    while (todo.length > 0) {
      const i = todo.findIndex((x) => isNodeOpen(s, x.id));
      expect(i, `nothing open in ${region}`).toBeGreaterThanOrEqual(0);
      const node = todo.splice(i, 1)[0]!;
      if (node.kind === 'boss') onBoss?.(node, s);
      visit(s, node);
    }
  }
}

describe('campaign data', () => {
  it('every region: one start, one boss, every node reachable from the start, all roads end at the boss', () => {
    for (const region of REGIONS) {
      const nodes = regionNodes(region);
      expect(nodes.filter((x) => x.kind === 'boss')).toHaveLength(1);
      const reach = new Set<string>([regionStart(region).id]);
      for (let changed = true; changed; ) {
        changed = false;
        for (const x of nodes) if (reach.has(x.id)) for (const y of x.next) if (!reach.has(y)) (reach.add(y), (changed = true));
      }
      expect(reach.size).toBe(nodes.length);
      for (const x of nodes) {
        for (const y of x.next) expect(nodeById(y).region).toBe(region);
        if (x.kind !== 'boss') expect(x.next.length).toBeGreaterThan(0);
      }
      expect(regionBoss(region).next).toHaveLength(0);
    }
  });

  it('every encounter sits on the map exactly once, with loot to match its node', () => {
    const fights = NODES.filter((x) => x.kind !== 'camp');
    expect(fights.map((x) => x.id).sort()).toEqual(ENCOUNTERS.map((e) => e.id).sort());
    expect(new Set(NODES.map((x) => x.id)).size).toBe(NODES.length);
    for (const x of fights) {
      const e = encounterById(x.id as EncounterId);
      expect(e.loot).toBe(x.kind === 'battle' ? 'normal' : x.kind);
      expect(STRINGS.encounters[e.id].name).toBeTruthy();
    }
  });

  it('camps bring hero + two to the roster limit over the first two regions', () => {
    const camps = NODES.filter((x) => x.kind === 'camp');
    expect(1 + 2 + camps.length).toBe(ROSTER_LIMIT);
    expect(camps.every((x) => x.region !== 'barrowlands')).toBe(true);
  });
});

describe('unlocking', () => {
  it('only the first node is open at the start; doing a node opens the ones after it', () => {
    const s = newGame('krieger', 'Hero', 3);
    const open = () => NODES.filter((x) => isNodeOpen(s, x.id)).map((x) => x.id);
    expect(open()).toEqual(['raiders']);
    recordBattle(s, 'raiders', true);
    expect(open()).toEqual(['raiders', 'campGreen1', 'farmstead']);
    // A lost battle opens nothing.
    recordBattle(s, 'farmstead', false);
    expect(isNodeOpen(s, 'campGreen2')).toBe(false);
    recruit(s, 'campGreen1', 1);
    expect(isNodeOpen(s, 'archerLine')).toBe(true);
    expect(isRegionOpen(s, 'darkwood')).toBe(false);
    expect(isNodeOpen(s, 'skirmish')).toBe(false);
  });

  it('a region opens when the boss before it falls; the last boss ends the campaign', () => {
    const s = newGame('magier', 'Hero', 5);
    recordBattle(s, 'ironWarlord', true);
    expect(isRegionOpen(s, 'darkwood')).toBe(true);
    expect(isNodeOpen(s, 'skirmish')).toBe(true);
    expect(isNodeOpen(s, 'ambush')).toBe(false);
    expect(campaignWon(s)).toBe(false);
    recordBattle(s, 'boneKing', true);
    expect(campaignWon(s)).toBe(true);
  });
});

describe('camps', () => {
  it('two recruits of different classes, free names, at the roster level, kept once drawn', () => {
    const s = newGame('heiler', 'Maren', 11);
    for (const c of s.squad.roster) c.level = 6;
    s.squad.roster[1]!.level = 4;
    const level = recruitLevel(s);
    expect(level).toBe(Math.floor((6 + 4 + 6) / 3));
    const offers = campOffers(s, 'campGreen1');
    expect(offers).toHaveLength(2);
    expect(offers[0]!.classId).not.toBe(offers[1]!.classId);
    const names = s.squad.roster.map((c) => c.name);
    for (const o of offers) {
      expect(RECRUIT_NAMES[o.classId]).toContain(o.name);
      expect(names).not.toContain(o.name);
      expect(o.level).toBe(level);
      expect(o.path).not.toBeNull();
      expect(o.upgrades).toHaveLength(level - 2);
    }
    expect(offers[0]!.name).not.toBe(offers[1]!.name);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(campOffers(copy, 'campGreen1')).toEqual(offers);
  });

  it('recruiting adds and fields the chosen one once; the camp is then done', () => {
    const s = newGame('krieger', 'Hero', 2);
    const offers = campOffers(s, 'campGreen1');
    expect(isNodeDone(s, nodeById('campGreen1'))).toBe(false);
    expect(recruit(s, 'campGreen1', 1)).toBe(true);
    const joined = s.squad.roster[s.squad.roster.length - 1]!;
    expect(joined.name).toBe(offers[1]!.name);
    expect(joined.id).toBe(HERO_ID + 3);
    expect(s.squad.fielded).toContain(joined.id);
    expect(isNodeDone(s, nodeById('campGreen1'))).toBe(true);
    expect(recruit(s, 'campGreen1', 0)).toBe(false);
    expect(s.squad.roster).toHaveLength(4);
  });

  it('recruiting works on the reactive state the screens hold, and the recruit is its own copy', () => {
    const s = reactive(newGame('krieger', 'Hero', 2)) as GameState;
    const offer = campOffers(s, 'campGreen1')[0]!;
    expect(recruit(s, 'campGreen1', 0)).toBe(true);
    const joined = s.squad.roster[s.squad.roster.length - 1]!;
    expect(joined.upgrades).toEqual(offer.upgrades);
    joined.upgrades.push('x');
    expect(offer.upgrades).not.toContain('x');
  });

  it('a full roster takes no one; passing the camp still opens its roads', () => {
    const s = newGame('krieger', 'Hero', 2);
    const camps: CampId[] = ['campGreen1', 'campGreen2', 'campGreen3', 'campDark1', 'campDark2', 'campDark3'];
    for (const c of camps) expect(recruit(s, c, 0)).toBe(true);
    expect(s.squad.roster).toHaveLength(ROSTER_LIMIT);
    expect(s.squad.fielded).toHaveLength(MAX_FIELDED);
    s.camps.campDark3 = undefined;
    delete s.camps.campDark3;
    expect(recruit(s, 'campDark3', 0)).toBe(false);
    passCamp(s, 'campDark3');
    expect(isNodeDone(s, nodeById('campDark3'))).toBe(true);
  });
});

describe('the whole campaign', () => {
  it('can be walked start to finish; the hero reaches about level 6, 12 and 18 at the bosses', () => {
    const s = newGame('krieger', 'Hero', 9);
    const atBoss: number[] = [];
    walkAll(s, (_, g) => atBoss.push(heroOfSquad(g.squad).level));
    expect(campaignWon(s)).toBe(true);
    expect(s.squad.roster).toHaveLength(ROSTER_LIMIT);
    const targets = [6, 12, 18];
    for (const [i, level] of atBoss.entries()) expect(Math.abs(level - targets[i]!), `boss ${i + 1}: level ${level}`).toBeLessThanOrEqual(1);
  });
});

describe('save migration', () => {
  it('a version 1 save (the battle chain) loads with its wins and no camps', () => {
    const s = newGame('krieger', 'Hero', 4);
    recordBattle(s, 'skirmish', true);
    settle(s);
    const v1 = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete v1.camps;
    v1.version = 1;
    const back = parseSave(JSON.stringify(v1))!;
    expect(back).not.toBeNull();
    expect(back.camps).toEqual({});
    expect(back.won).toEqual(['skirmish']);
  });

  it('rejects unknown camps and broken offers', () => {
    const s = newGame('krieger', 'Hero', 4);
    campOffers(s, 'campGreen1');
    expect(parseSave(JSON.stringify(s))).not.toBeNull();
    expect(parseSave(JSON.stringify({ ...s, camps: { atlantis: { offers: [], done: true } } }))).toBeNull();
    expect(parseSave(JSON.stringify({ ...s, camps: { campGreen1: { offers: [{ name: 'x' }], done: false } } }))).toBeNull();
  });
});

describe('ending', () => {
  it('is due once the last boss falls and the spoils are settled, until seen', () => {
    const s = newGame('krieger', 'Aldric', 5);
    expect(endingDue(s)).toBe(false);
    recordBattle(s, 'boneKing', true);
    expect(s.rewards).not.toBeNull();
    expect(endingDue(s)).toBe(false);
    s.rewards = null;
    expect(endingDue(s)).toBe(true);
    s.endingSeen = true;
    expect(endingDue(s)).toBe(false);
  });

  it('play time only grows', () => {
    const s = newGame('krieger', 'Aldric', 5);
    addPlayTime(s, 1500);
    addPlayTime(s, -20);
    addPlayTime(s, Number.NaN);
    expect(s.playMs).toBe(1500);
  });
});
