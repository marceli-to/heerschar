import { regionNodes, type CampaignNode, type RegionId } from '../../data/campaign';
import { nextFloat, seedState, type RngHolder } from '../../sim/rng';

/**
 * Light ink sketches for the region map sheets (approved 5c): sparse hand-drawn marks in the gaps
 * between the roads. Everything is drawn on a 1000 × 600 sheet; node x / y (0..100) scale onto it.
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

/**
 * Glyph outlines, anchored at their foot (0, 0), roughly 30 units across. `ink` = stroked lines,
 * `shade` = thinner hatching on the shadow side.
 */
export const GLYPHS: Record<Glyph, { ink: string; shade?: string }> = {
  field: {
    ink: 'M-20 0 L-12 -16 L22 -16 L16 0 Z',
    shade: 'M-16 -4 L18 -4 M-14 -8 L19 -8 M-12 -12 L21 -12',
  },
  tuft: { ink: 'M-4 0 L-6 -6 M0 0 L0 -8 M4 0 L6 -6 M10 0 L11 -4' },
  tree: {
    ink: 'M0 0 L0 -7 M-7 -12 C-10 -20 -2 -26 2 -22 C8 -25 11 -16 7 -11 C6 -6 -5 -6 -7 -12 Z',
    shade: 'M4 -18 L6 -15 M3 -14 L5 -11 M6 -13 L8 -10',
  },
  pine: {
    ink: 'M0 2 L0 -2 M0 -24 L-8 -2 L8 -2 Z',
    shade: 'M1 -18 L4 -14 M1 -12 L5 -7 M1 -6 L6 -3',
  },
  hill: {
    ink: 'M-26 0 C-16 -16 -6 -20 4 -18 C14 -16 20 -8 26 0',
    shade: 'M8 -14 L4 -8 M14 -11 L10 -5 M19 -7 L16 -2',
  },
  cottage: {
    ink: 'M-8 0 L-8 -10 L8 -10 L8 0 Z M-11 -9 L0 -19 L11 -9 M4 -16 L4 -20 L7 -20 L7 -13 M-2 0 L-2 -5 L2 -5 L2 0',
  },
  mound: {
    ink: 'M-20 0 C-14 -14 14 -14 20 0 M-24 0 L24 0',
    shade: 'M6 -8 L10 -2 M11 -7 L14 -2 M1 -9 L5 -2',
  },
  cross: { ink: 'M0 0 L0 -15 M-5 -11 L5 -11 M-4 0 L4 0' },
  stone: {
    ink: 'M-5 0 L-6 -14 C-5 -18 4 -18 5 -14 L5 0 Z',
    shade: 'M2 -12 L4 -10 M2 -7 L4 -5',
  },
  deadTree: { ink: 'M0 0 L0 -18 M0 -10 L-6 -16 L-8 -15 M0 -14 L5 -20 M0 -7 L5 -10 L8 -9 M-6 -16 L-6 -20' },
};
