import { regionNodes, type CampaignNode, type RegionId } from '../../data/campaign';
import { nextFloat, seedState, type RngHolder } from '../../sim/rng';

/**
 * Marks for the region map sheets (approved 5c, painted in 6i): sparse filled shapes with an ink
 * outline in the gaps between the roads, on region-coloured land with a few flat patches. Everything is drawn on a 1000 × 600 sheet; node x / y (0..100) scale onto it.
 * Placement is seeded per region, so a sheet always looks the same.
 */
export const SHEET_W = 1000;
export const SHEET_H = 600;

export const toSheet = (n: CampaignNode) => ({ x: (n.x / 100) * SHEET_W, y: (n.y / 100) * SHEET_H });

export type Glyph = 'field' | 'tuft' | 'tree' | 'pine' | 'hill' | 'cottage' | 'mound' | 'cross' | 'stone' | 'deadTree';

export interface Mark {
  glyph: Glyph;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
}

export interface Road {
  from: string;
  to: string;
  /** Quadratic curve from one node to the next. */
  d: string;
}

/** Places reserved for the region cartouche (bottom left) and the compass (top right). */
export const CARTOUCHE = { x: 24, y: 516, w: 250, h: 60 };
export const COMPASS = { x: 935, y: 80, r: 38 };
/** The region ribbons hang over the top left of the sheet. */
const RIBBONS = { x: 620, y: 80 };

/** How often each mark appears per region (relative weights). */
const WEIGHTS: Record<RegionId, Partial<Record<Glyph, number>>> = {
  greenmarch: { field: 3, tuft: 2.5, tree: 2, hill: 1.2, cottage: 0.8, pine: 0.2 },
  darkwood: { pine: 6, tree: 2, tuft: 0.8, hill: 0.5 },
  barrowlands: { mound: 2, cross: 1.8, stone: 1, deadTree: 1.4, tuft: 1.4, hill: 1 },
};

/** Share of grid spots that get a mark at all. */
const DENSITY: Record<RegionId, number> = { greenmarch: 0.5, darkwood: 0.7, barrowlands: 0.5 };

const SEED: Record<RegionId, number> = { greenmarch: 11, darkwood: 23, barrowlands: 37 };

function pick(rng: RngHolder, weights: Partial<Record<Glyph, number>>): Glyph {
  const entries = Object.entries(weights) as [Glyph, number][];
  let roll = nextFloat(rng) * entries.reduce((s, [, w]) => s + w, 0);
  for (const [g, w] of entries) {
    roll -= w;
    if (roll <= 0) return g;
  }
  return entries[entries.length - 1]![0];
}

/** Distance from a point to a segment. */
function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** The roads of a region: a gentle seeded bend per road so they look drawn by hand. */
export function regionRoads(region: RegionId): Road[] {
  const rng = { rngState: seedState(SEED[region] * 7) };
  const nodes = regionNodes(region);
  const roads: Road[] = [];
  for (const a of nodes) {
    for (const id of a.next) {
      const b = nodes.find((n) => n.id === id)!;
      const pa = toSheet(a);
      const pb = toSheet(b);
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      const bend = (nextFloat(rng) - 0.5) * 0.24 * len;
      const cx = (pa.x + pb.x) / 2 + (-(pb.y - pa.y) / len) * bend;
      const cy = (pa.y + pb.y) / 2 + ((pb.x - pa.x) / len) * bend;
      roads.push({ from: a.id, to: b.id, d: `M${pa.x.toFixed(1)} ${pa.y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${pb.x.toFixed(1)} ${pb.y.toFixed(1)}` });
    }
  }
  return roads;
}

/** The ink marks of a region: a jittered grid, kept clear of seals, roads, cartouche and compass. */
export function regionMarks(region: RegionId): Mark[] {
  const rng = { rngState: seedState(SEED[region]) };
  const nodes = regionNodes(region).map(toSheet);
  const segments = regionNodes(region).flatMap((a) => a.next.map((id) => [toSheet(a), toSheet(regionNodes(region).find((n) => n.id === id)!)] as const));
  const marks: Mark[] = [];
  const step = 46;
  for (let gy = 40; gy < SHEET_H - 20; gy += step * 0.85) {
    for (let gx = 30; gx < SHEET_W - 20; gx += step) {
      const x = gx + (nextFloat(rng) - 0.5) * step * 0.8;
      const y = gy + (nextFloat(rng) - 0.5) * step * 0.6;
      const keep = nextFloat(rng) < DENSITY[region];
      const glyph = pick(rng, WEIGHTS[region]);
      const scale = 0.85 + nextFloat(rng) * 0.4;
      const flip = nextFloat(rng) < 0.5;
      if (!keep) continue;
      const clearance = glyph === 'field' || glyph === 'hill' ? 34 : 24;
      if (x < 24 || x > SHEET_W - 24 || y < 30 || y > SHEET_H - 16) continue;
      if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 58)) continue;
      if (segments.some(([a, b]) => segmentDistance(x, y, a.x, a.y, b.x, b.y) < clearance + 14)) continue;
      if (x > CARTOUCHE.x - 20 && x < CARTOUCHE.x + CARTOUCHE.w + 20 && y > CARTOUCHE.y - 24 && y < CARTOUCHE.y + CARTOUCHE.h + 20) continue;
      if (Math.hypot(x - COMPASS.x, y - COMPASS.y) < COMPASS.r + 26) continue;
      if (x < RIBBONS.x && y < RIBBONS.y) continue;
      marks.push({ glyph, x, y, scale, flip });
    }
  }
  // Draw from back (top) to front (bottom), so lower marks overlap the ones behind them.
  return marks.sort((a, b) => a.y - b.y);
}

/** One part of a glyph: a path, its fill (none = line only; 'hill' = the region's hill colour) and a thinner stroke. */
export interface GlyphPart {
  d: string;
  fill?: string;
  thin?: boolean;
}

/** Glyphs anchored at their foot (0, 0), roughly 30 units across: filled shapes with an ink outline. */
export const GLYPHS: Record<Glyph, GlyphPart[]> = {
  field: [
    { d: 'M-20 0 L-12 -16 L22 -16 L16 0 Z', fill: '#f2cf5b' },
    { d: 'M-15 -5 L18 -5 M-12 -10 L20 -10', thin: true },
  ],
  tuft: [{ d: 'M-4 0 L-6 -7 M0 0 L0 -9 M4 0 L6 -7' }],
  tree: [
    { d: 'M0 0 L0 -8' },
    { d: 'M-8 -12 C-11 -21 -2 -27 2 -23 C9 -26 12 -16 8 -11 C6 -6 -6 -6 -8 -12 Z', fill: '#6fbf4a' },
  ],
  pine: [
    { d: 'M0 2 L0 -2' },
    { d: 'M0 -26 L-9 -2 L9 -2 Z', fill: '#3f8f46' },
  ],
  hill: [{ d: 'M-26 0 C-16 -16 -6 -20 4 -18 C14 -16 20 -8 26 0 Z', fill: 'hill' }],
  cottage: [
    { d: 'M-8 0 L-8 -10 L8 -10 L8 0 Z', fill: '#fff1d0' },
    { d: 'M-11 -9 L0 -20 L11 -9 Z', fill: '#e0392a' },
    { d: 'M-2 0 L-2 -5 L2 -5 L2 0', fill: '#7a4a28' },
  ],
  mound: [{ d: 'M-20 0 C-14 -15 14 -15 20 0 Z', fill: '#a3a88a' }],
  cross: [{ d: 'M0 0 L0 -16 M-5 -11 L5 -11' }],
  stone: [{ d: 'M-5 0 L-6 -14 C-5 -18 4 -18 5 -14 L5 0 Z', fill: '#9e978f' }],
  deadTree: [{ d: 'M0 0 L0 -18 M0 -10 L-6 -16 L-8 -15 M0 -14 L5 -20 M0 -7 L5 -10 L8 -9 M-6 -16 L-6 -20' }],
};

/** Region land colours: base and the lighter / darker patch tones. */
export const LAND: Record<RegionId, { base: string; light: string; dark: string; hill: string }> = {
  greenmarch: { base: '#cfe39a', light: '#e2efb4', dark: '#b6d47e', hill: '#9fcf63' },
  darkwood: { base: '#a9c98a', light: '#bdd8a0', dark: '#8fb672', hill: '#7fb35a' },
  barrowlands: { base: '#cdc8c2', light: '#dcd8d0', dark: '#b6b0b4', hill: '#a29a8e' },
};

export interface Patch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  tone: 'light' | 'dark';
}

/** A few flat patches of lighter and darker land, seeded per region. */
export function regionPatches(region: RegionId): Patch[] {
  const rng = { rngState: seedState(SEED[region] * 13) };
  const patches: Patch[] = [];
  for (let i = 0; i < 9; i++) {
    patches.push({
      x: nextFloat(rng) * SHEET_W,
      y: nextFloat(rng) * SHEET_H,
      rx: 80 + nextFloat(rng) * 140,
      ry: 40 + nextFloat(rng) * 70,
      tone: i % 2 === 0 ? 'light' : 'dark',
    });
  }
  return patches;
}
