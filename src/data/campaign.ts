import type { EncounterId } from './encounters';

/**
 * The campaign (PLAN section 10, Stage 5 decisions): three regions, each a small branching graph
 * fixed in data and ending in a boss. Region names approved by Marcel; node layout and which
 * battle sits where are first numbers, tuned in 5f.
 */
export type RegionId = 'greenmarch' | 'darkwood' | 'barrowlands';

export const REGIONS: readonly RegionId[] = ['greenmarch', 'darkwood', 'barrowlands'];

/** battle / elite (harder, better loot) / camp (recruit one of two) / boss (ends the region). */
export type NodeKind = 'battle' | 'elite' | 'camp' | 'boss';

export type CampId = 'campGreen1' | 'campGreen2' | 'campGreen3' | 'campDark1' | 'campDark2' | 'campDark3';

/** One stop on a region map. Fights use their encounter id as node id, camps their camp id. */
export interface CampaignNode {
  id: EncounterId | CampId;
  region: RegionId;
  kind: NodeKind;
  /** Position on the region map sheet, 0..100 both ways, left to right toward the boss. */
  x: number;
  y: number;
  /** Nodes this one opens once done. */
  next: readonly (EncounterId | CampId)[];
}

const n = (id: EncounterId | CampId, region: RegionId, kind: NodeKind, x: number, y: number, next: (EncounterId | CampId)[] = []): CampaignNode => ({ id, region, kind, x, y, next });

/**
 * Every region has the same shape: a first battle that forks; the upper road holds the elite
 * (optional, better loot), the lower road the camps; both roads meet at the boss. Greenmarch and
 * Darkwood hold three camps each, which brings the roster (hero + two) to its limit of eight
 * companions; the Barrowlands are all fighting.
 */
export const NODES: readonly CampaignNode[] = [
  n('raiders', 'greenmarch', 'battle', 8, 52, ['campGreen1', 'farmstead']),
  n('campGreen1', 'greenmarch', 'camp', 27, 26, ['archerLine']),
  n('farmstead', 'greenmarch', 'battle', 27, 76, ['campGreen2']),
  n('archerLine', 'greenmarch', 'battle', 47, 34, ['shieldWall', 'campGreen3']),
  n('campGreen2', 'greenmarch', 'camp', 47, 80, ['campGreen3']),
  n('shieldWall', 'greenmarch', 'elite', 68, 22, ['ironWarlord']),
  n('campGreen3', 'greenmarch', 'camp', 68, 64, ['ironWarlord']),
  n('ironWarlord', 'greenmarch', 'boss', 90, 44),

  n('skirmish', 'darkwood', 'battle', 8, 48, ['campDark1', 'berserkerRush']),
  n('campDark1', 'darkwood', 'camp', 27, 24, ['shamansGrove']),
  n('berserkerRush', 'darkwood', 'battle', 27, 74, ['campDark2']),
  n('shamansGrove', 'darkwood', 'battle', 48, 32, ['wolfPack', 'campDark3']),
  n('campDark2', 'darkwood', 'camp', 47, 80, ['campDark3']),
  n('wolfPack', 'darkwood', 'elite', 69, 20, ['fenWitch']),
  n('campDark3', 'darkwood', 'camp', 68, 62, ['fenWitch']),
  n('fenWitch', 'darkwood', 'boss', 90, 46),

  n('ambush', 'barrowlands', 'battle', 8, 50, ['burningField', 'graveWatch']),
  n('burningField', 'barrowlands', 'battle', 27, 26, ['ironColumn']),
  n('graveWatch', 'barrowlands', 'battle', 27, 76, ['boneLegion']),
  n('ironColumn', 'barrowlands', 'battle', 48, 30, ['warband', 'cryptRoad']),
  n('boneLegion', 'barrowlands', 'elite', 48, 74, ['cryptRoad']),
  n('warband', 'barrowlands', 'elite', 70, 22, ['boneKing']),
  n('cryptRoad', 'barrowlands', 'battle', 70, 66, ['boneKing']),
  n('boneKing', 'barrowlands', 'boss', 91, 46),
];

export function nodeById(id: string): CampaignNode {
  const node = NODES.find((x) => x.id === id);
  if (!node) throw new Error(`unknown campaign node ${id}`);
  return node;
}

export function regionNodes(region: RegionId): CampaignNode[] {
  return NODES.filter((x) => x.region === region);
}

/** The node a region begins at (nothing leads to it). */
export function regionStart(region: RegionId): CampaignNode {
  const nodes = regionNodes(region);
  const start = nodes.find((x) => !nodes.some((y) => y.next.includes(x.id)));
  if (!start) throw new Error(`region ${region} has no start`);
  return start;
}

export function regionBoss(region: RegionId): CampaignNode {
  const boss = regionNodes(region).find((x) => x.kind === 'boss');
  if (!boss) throw new Error(`region ${region} has no boss`);
  return boss;
}

/** The boss whose defeat ends the campaign. */
export const FINAL_BOSS = 'boneKing' satisfies EncounterId;

export function isCampId(id: string): id is CampId {
  return NODES.some((x) => x.id === id && x.kind === 'camp');
}
