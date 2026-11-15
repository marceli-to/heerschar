import type { RegionId } from '../../data/campaign';
import { nextFloat, range, type RngHolder } from '../../sim/rng';

/** Radii of the stone ring, just outside the 44 × 30 m playable ellipse. */
export const RING_RX = 22.9;
export const RING_RZ = 15.9;

/** A prop on the ground: `x`, `z` in metres, height taken from the ground by the arena. */
export interface Placement {
  prop: string;
  x: number;
  z: number;
  rot: number;
  scale: number;
  /** How far to sink it into the ground (m), so flat bases sit on slopes. */
  sink?: number;
  /** Height above the ground instead of on it (clouds). */
  lift?: number;
  /** Extra vertical scale (grain fields are flattened to waist height). */
  squash?: number;
}

/** A barrow: a long grassy mound with a stone door facing `rot`. */
export interface Mound {
  x: number;
  z: number;
  rot: number;
  length: number;
  width: number;
  height: number;
}

/** A standing stone. */
export interface Menhir {
  x: number;
  z: number;
  rot: number;
  height: number;
  lean: number;
}

export interface Layout {
  props: Placement[];
  mounds: Mound[];
  menhirs: Menhir[];
}

/** Medieval Hexagon props are miniatures on hex tiles; these scales bring them to the characters' size. */
const HEX = { building: 7, tree: 5.6, rock: 3.6, small: 5, fence: 2.6, flag: 8, cloud: 16 } as const;
/** Halloween Bits are already in character units; the characters are scaled by 0.82. */
const HAL = 0.82;

/** Point at angle `a` (0 = -z, π/2 = +x: beyond the enemy side, where the camera starts looking) and elliptical distance `e` from the centre (1 = the ring). */
export function at(a: number, e: number): { x: number; z: number } {
  return { x: Math.sin(a) * RING_RX * e, z: -Math.cos(a) * RING_RZ * e };
}

/** Rotation that turns a prop's front (+z) towards the arena centre. */
const facingCentre = (x: number, z: number): number => Math.atan2(-x, -z);

const pick = <T>(rng: RngHolder, list: readonly T[]): T => list[Math.floor(nextFloat(rng) * list.length)]!;

interface Keepout {
  x: number;
  z: number;
  r: number;
}
const clear = (keepouts: Keepout[], x: number, z: number, pad = 0): boolean => keepouts.every((k) => Math.hypot(x - k.x, z - k.z) > k.r + pad);

/** The fixed layout of a region's arena (seeded, the same every battle). */
export function layoutFor(region: RegionId): Layout {
  const rng: RngHolder = { rngState: region === 'greenmarch' ? 0x5eed : region === 'darkwood' ? 0xda4c : 0xb0ae };
  if (region === 'darkwood') return darkwood(rng);
  if (region === 'barrowlands') return barrowlands(rng);
  return greenmarch(rng);
}

function greenmarch(rng: RngHolder): Layout {
  const props: Placement[] = [];
  const keepouts: Keepout[] = [];
  const put = (prop: string, x: number, z: number, rot: number, scale: number, extra: Partial<Placement> = {}): void => {
    props.push({ prop, x, z, rot, scale, ...extra });
  };

  // The farm beyond the enemy side: windmill on the rise, two houses, a well, three grain fields with a fence.
  const farmA = Math.PI / 2 + 0.32;
  const mill = at(farmA + 0.05, 3.0);
  put('building_windmill_red', mill.x, mill.z, facingCentre(mill.x, mill.z), HEX.building * 1.25, { sink: 0.4 });
  keepouts.push({ ...mill, r: 9 });
  const homes: [number, number, string][] = [[farmA - 0.2, 2.6, 'building_home_B_red'], [farmA + 0.28, 2.45, 'building_home_A_red'], [farmA + 0.48, 2.8, 'building_home_B_red']];
  for (const [a, e, id] of homes) {
    const p = at(a, e);
    put(id, p.x, p.z, facingCentre(p.x, p.z) + range(rng, -0.3, 0.3), HEX.building, { sink: 0.3 });
    keepouts.push({ ...p, r: 7 });
  }
  const well = at(farmA + 0.1, 2.35);
  put('building_well_red', well.x, well.z, 0, HEX.building * 0.9, { sink: 0.2 });
  keepouts.push({ ...well, r: 3 });
  for (let i = 0; i < 9; i++) {
    const p = at(farmA + range(rng, -0.25, 0.55), range(rng, 2.25, 2.7));
    if (!clear(keepouts, p.x, p.z, -2)) continue;
    put(pick(rng, ['barrel', 'crate_A_big', 'sack', 'resource_lumber']), p.x, p.z, range(rng, 0, Math.PI * 2), HEX.small);
  }
  // Fields between the ring and the farm, each turned to face the arena, a fence along their near edge.
  for (const [a, e] of [[farmA - 0.55, 1.75], [farmA - 0.3, 1.8], [farmA - 0.05, 1.82]] as const) {
    const p = at(a, e);
    const rot = facingCentre(p.x, p.z);
    put('building_grain', p.x, p.z, rot, HEX.building, { sink: 0.05, squash: 0.4 });
    keepouts.push({ ...p, r: 8.5 });
    // Fence of four segments across the field's near side (segments run along the prop's z axis).
    const nx = Math.sin(rot);
    const nz = Math.cos(rot);
    for (let k = -2; k < 2; k++) {
      const off = (k + 0.5) * 3;
      const fx = p.x + nx * 7.2 + nz * off;
      const fz = p.z + nz * 7.2 - nx * off;
      if (nextFloat(rng) < 0.15) continue;
      put('fence_wood_straight', fx, fz, rot + Math.PI / 2 + range(rng, -0.04, 0.04), HEX.fence, { sink: 0.05 });
    }
  }

  // A small farmstead behind the player side.
  const backA = -Math.PI / 2 - 0.45;
  for (const [a, e, id, s] of [[backA, 2.7, 'building_home_A_red', HEX.building], [backA + 0.16, 2.5, 'building_well_red', HEX.building * 0.9]] as const) {
    const p = at(a, e);
    put(id, p.x, p.z, facingCentre(p.x, p.z), s, { sink: 0.3 });
    keepouts.push({ ...p, r: 7 });
  }

  // The war band's camp on the near side: tents, a weapon rack, supplies.
  const campA = Math.PI + 0.35;
  for (let i = 0; i < 3; i++) {
    const p = at(campA + (i - 1) * 0.22, 1.55 + (i % 2) * 0.18);
    put('tent', p.x, p.z, facingCentre(p.x, p.z), HEX.small * 1.3);
    keepouts.push({ ...p, r: 4 });
  }
  for (const id of ['weaponrack', 'barrel', 'crate_A_big', 'barrel']) {
    const p = at(campA + range(rng, -0.35, 0.35), range(rng, 1.3, 1.42));
    put(id, p.x, p.z, facingCentre(p.x, p.z) + range(rng, -0.4, 0.4), HEX.small);
  }

  // Red banners by every other big ring stone.
  for (let i = 0; i < 12; i += 2) {
    const p = at((i / 12) * Math.PI * 2 + 0.03, 1.07);
    put('flag_red', p.x, p.z, facingCentre(p.x, p.z) + Math.PI / 2, HEX.flag);
  }

  trees(rng, props, keepouts, { count: 130, eMin: 1.7, eMax: 7.5, ids: ['tree_single_A', 'tree_single_B'], scale: [0.9, 1.35].map((s) => s * HEX.tree) as [number, number] });
  for (let i = 0; i < 14; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 3, 7));
    if (!clear(keepouts, p.x, p.z, 6)) continue;
    put(pick(rng, ['trees_A_medium', 'trees_B_medium']), p.x, p.z, range(rng, 0, Math.PI * 2), HEX.tree * 1.1);
  }
  rocks(rng, props, keepouts, 26, 1.12, 1.9, HEX.rock);
  clouds(rng, props);
  return { props, mounds: [], menhirs: [] };
}

function darkwood(rng: RngHolder): Layout {
  const props: Placement[] = [];
  const keepouts: Keepout[] = [];
  // The forest wall: tall pines close in all round, thinning nowhere.
  trees(rng, props, keepouts, {
    count: 300,
    eMin: 1.6,
    eMax: 6.5,
    ids: ['tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_orange_large'],
    scale: [0.95 * HAL, 1.55 * HAL],
    clumped: false,
  });
  // Young trees and pine clusters at the edge of the clearing.
  trees(rng, props, keepouts, { count: 40, eMin: 1.15, eMax: 1.45, ids: ['tree_single_B', 'tree_pine_orange_small'], scale: [0.9 * HEX.tree, 1.2 * HEX.tree], clumped: false, perId: { tree_pine_orange_small: [1.0 * HAL, 1.4 * HAL] } });
  for (let i = 0; i < 30; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.6, 4.5));
    props.push({ prop: 'trees_B_large', ...p, rot: range(rng, 0, Math.PI * 2), scale: HEX.tree * range(rng, 1.1, 1.4) });
  }
  // Dead trees, stumps, fallen logs and mossy rocks around the clearing.
  for (let i = 0; i < 12; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.15, 2.2));
    props.push({ prop: pick(rng, ['tree_dead_large', 'tree_dead_medium']), ...p, rot: range(rng, 0, Math.PI * 2), scale: HAL * range(rng, 1.1, 1.5) });
  }
  for (let i = 0; i < 16; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.06, 1.45));
    props.push({ prop: pick(rng, ['tree_single_A_cut', 'tree_single_B_cut']), ...p, rot: range(rng, 0, Math.PI * 2), scale: range(rng, 3, 4) });
  }
  for (let i = 0; i < 9; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.08, 1.5));
    props.push({ prop: 'resource_lumber', ...p, rot: range(rng, 0, Math.PI * 2), scale: range(rng, 3, 3.8), sink: 0.15 });
  }
  rocks(rng, props, keepouts, 30, 1.08, 2.4, HEX.rock * 1.2);
  return { props, mounds: [], menhirs: [] };
}

function barrowlands(rng: RngHolder): Layout {
  const props: Placement[] = [];
  const keepouts: Keepout[] = [];
  const put = (prop: string, p: { x: number; z: number }, rot: number, scale: number, extra: Partial<Placement> = {}): void => {
    props.push({ prop, x: p.x, z: p.z, rot, scale, ...extra });
  };

  // The graveyard beyond the enemy side: rows of graves behind an iron fence with a gate, the crypt at the back.
  const yardA = Math.PI / 2;
  const crypt = at(yardA + 0.08, 2.95);
  put('crypt', crypt, facingCentre(crypt.x, crypt.z), HAL * 1.25, { sink: 0.2 });
  keepouts.push({ ...crypt, r: 10 });
  const graves = ['grave_A', 'grave_B', 'gravestone', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'grave_A_destroyed'];
  for (let row = 0; row < 4; row++) {
    for (let k = 0; k < 9; k++) {
      if (nextFloat(rng) < 0.2) continue;
      const a = yardA + (k - 4) * 0.09 + range(rng, -0.01, 0.01);
      const e = 1.55 + row * 0.22 + range(rng, -0.03, 0.03);
      const p = at(a, e);
      put(pick(rng, graves), p, facingCentre(p.x, p.z) + range(rng, -0.15, 0.15), HAL * range(rng, 0.95, 1.15), { sink: 0.05 });
    }
  }
  // Fence along the near side of the yard: gate in the middle, some segments broken or missing.
  const fenceE = 1.36;
  // Segments are ~3.1 m; along this stretch of the ellipse 1 rad is ~21.6 m.
  const step = 0.144;
  for (let k = -3; k <= 3; k++) {
    const a = yardA + k * step;
    const p = at(a, fenceE);
    const tangent = facingCentre(p.x, p.z) + Math.PI;
    if (k === 0) {
      put('arch_gate', p, tangent, HAL * 1.05);
      continue;
    }
    const r = nextFloat(rng);
    if (r < 0.12) continue;
    put(r < 0.4 ? 'fence_broken' : 'fence', p, tangent, HAL * 0.95);
    const q = at(a + step / 2, fenceE);
    put(nextFloat(rng) < 0.3 ? 'fence_pillar_broken' : 'fence_pillar', q, tangent, HAL);
  }
  for (const k of [-1, 1]) {
    const p = at(yardA + k * 0.5, 1.4);
    put('post_lantern', p, facingCentre(p.x, p.z) + Math.PI / 2, HAL);
  }
  keepouts.push({ ...at(yardA, 1.9), r: 16 });

  // Lanterns on the ring road and by a few barrows; scattered graves on the moor.
  for (const a of [Math.PI + 0.5, Math.PI - 0.6, -0.4, 0.5]) {
    const p = at(a, 1.12);
    put('post_lantern', p, facingCentre(p.x, p.z) + Math.PI / 2, HAL);
  }
  for (let i = 0; i < 14; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.25, 2.6));
    if (!clear(keepouts, p.x, p.z)) continue;
    put(pick(rng, ['gravemarker_A', 'gravemarker_B', 'gravestone', 'grave_A_destroyed']), p, range(rng, 0, Math.PI * 2), HAL * range(rng, 0.9, 1.1), { sink: 0.05 });
  }
  // Bones by the ring.
  for (let i = 0; i < 16; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.06, 1.35));
    put(pick(rng, ['skull', 'bone_A', 'bone_C', 'bone_A', 'ribcage']), p, range(rng, 0, Math.PI * 2), HAL * range(rng, 0.8, 1.1), { sink: 0.08 });
  }

  // Barrows around the moor, doors towards the arena.
  const mounds: Mound[] = [];
  for (const [a, e, len] of [[Math.PI + 0.2, 2.2, 16], [Math.PI - 0.75, 2.6, 13], [-0.3, 2.3, 18], [0.55, 3.2, 14], [-Math.PI / 2 - 0.1, 2.9, 20], [Math.PI / 2 + 1.1, 3.4, 15], [Math.PI / 2 - 1.0, 3.6, 12]] as const) {
    const p = at(a, e);
    mounds.push({ ...p, rot: facingCentre(p.x, p.z), length: len, width: len * 0.55, height: len * 0.22 });
    keepouts.push({ ...p, r: len * 0.6 });
  }
  // Two stone circles and stray standing stones.
  const menhirs: Menhir[] = [];
  for (const [a, e, n, r] of [[Math.PI + 0.95, 3.0, 7, 6], [-0.95, 3.3, 6, 5]] as const) {
    const c = at(a, e);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      if (nextFloat(rng) < 0.15) continue;
      menhirs.push({ x: c.x + Math.sin(t) * r, z: c.z + Math.cos(t) * r, rot: t, height: range(rng, 2.2, 3.4), lean: range(rng, -0.12, 0.12) });
    }
    keepouts.push({ ...c, r: r + 3 });
  }
  for (let i = 0; i < 10; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, 1.5, 5));
    if (!clear(keepouts, p.x, p.z)) continue;
    menhirs.push({ ...p, rot: range(rng, 0, Math.PI * 2), height: range(rng, 1.8, 3.2), lean: range(rng, -0.2, 0.2) });
  }

  // Dead trees across the moor.
  trees(rng, props, keepouts, { count: 46, eMin: 1.3, eMax: 6.5, ids: ['tree_dead_large', 'tree_dead_medium', 'tree_dead_small'], scale: [1.2 * HAL, 1.9 * HAL] });
  rocks(rng, props, keepouts, 22, 1.1, 2.2, HEX.rock);
  return { props, mounds, menhirs };
}

interface TreeOpts {
  count: number;
  eMin: number;
  eMax: number;
  ids: readonly string[];
  scale: [number, number];
  /** Gather into groves with open ground between (default on). */
  clumped?: boolean;
  /** Scale range per id where it differs. */
  perId?: Record<string, [number, number]>;
}

function trees(rng: RngHolder, props: Placement[], keepouts: Keepout[], o: TreeOpts): void {
  let placed = 0;
  let guard = 0;
  while (placed < o.count && guard++ < o.count * 20) {
    const a = nextFloat(rng) * Math.PI * 2;
    const e = range(rng, o.eMin, o.eMax);
    if (o.clumped !== false && Math.sin(a * 5 + e * 1.3) < -0.25) continue;
    const p = at(a, e);
    if (Math.abs(p.x) > 200 || Math.abs(p.z) > 200) continue;
    if (!clear(keepouts, p.x, p.z)) continue;
    const id = pick(rng, o.ids);
    const [lo, hi] = o.perId?.[id] ?? o.scale;
    props.push({ prop: id, ...p, rot: range(rng, 0, Math.PI * 2), scale: range(rng, lo, hi), sink: 0.1 });
    placed++;
  }
}

function rocks(rng: RngHolder, props: Placement[], keepouts: Keepout[], count: number, eMin: number, eMax: number, scale: number): void {
  for (let i = 0; i < count; i++) {
    const p = at(range(rng, 0, Math.PI * 2), range(rng, eMin, eMax));
    if (!clear(keepouts, p.x, p.z)) continue;
    props.push({ prop: pick(rng, ['rock_single_A', 'rock_single_C', 'rock_single_E']), ...p, rot: range(rng, 0, Math.PI * 2), scale: scale * range(rng, 0.8, 1.6), sink: 0.05 });
  }
}

function clouds(rng: RngHolder, props: Placement[]): void {
  for (let i = 0; i < 12; i++) {
    const a = range(rng, 0, Math.PI * 2);
    const d = range(rng, 150, 230);
    props.push({ prop: pick(rng, ['cloud_big', 'cloud_small']), x: Math.sin(a) * d, z: -Math.cos(a) * d, rot: range(rng, 0, Math.PI * 2), scale: HEX.cloud * range(rng, 1, 1.8), lift: range(rng, 55, 85) });
  }
}
