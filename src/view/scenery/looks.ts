import type { RegionId } from '../../data/campaign';
import { GRADE, MEADOW } from '../palette';
import type { Swap } from '../models/recolor';

/**
 * One look per region (6d, moods approved by Marcel 2026-11-15): Greenmarch = sunny farmland,
 * Darkwood = misty forest clearing, Barrowlands = cold dusk moor. Sky, haze, light and the code-built
 * ground live here; the props (trees, farms, graves) are placed by `layouts.ts`.
 */
export interface RegionLook {
  sky: { zenith: string; horizon: string };
  fog: { color: string; near: number; far: number };
  sun: { color: string; intensity: number; position: readonly [number, number, number] };
  hemi: { sky: string; ground: string; intensity: number };
  exposure: number;
  /** Strength of the warm grade pass (1 = the look spike's). */
  grade: number;
  ground: {
    grass: string;
    grassDark: string;
    grassLight: string;
    hill: string;
    arena: string;
    arenaWorn: string;
    /** Height scale of the rolling ground outside the ring. */
    hills: number;
  };
  stone: { light: string; dark: string };
  /** Swatch swaps of the two prop packs' textures (cells as in `recolor.ts`). */
  swaps: { medieval: readonly Swap[]; halloween: readonly Swap[] };
}

export const REGION_LOOKS: Record<RegionId, RegionLook> = {
  greenmarch: {
    sky: { zenith: MEADOW.skyZenith, horizon: MEADOW.skyHorizon },
    fog: { color: GRADE.fog, near: GRADE.fogNear, far: GRADE.fogFar },
    sun: { color: GRADE.sun, intensity: 2.4, position: [-28, 42, 22] },
    hemi: { sky: MEADOW.hemiSky, ground: MEADOW.hemiGround, intensity: 1.1 },
    exposure: 1.05,
    grade: 1,
    ground: {
      grass: MEADOW.grass,
      grassDark: MEADOW.grassDark,
      grassLight: MEADOW.grassLight,
      hill: MEADOW.hill,
      arena: MEADOW.arenaGround,
      arenaWorn: MEADOW.arenaGroundWorn,
      hills: 1,
    },
    stone: { light: MEADOW.stone, dark: MEADOW.stoneDark },
    swaps: { medieval: [], halloween: [] },
  },
  darkwood: {
    sky: { zenith: '#7f9a98', horizon: '#c9d3c4' },
    fog: { color: '#a3b0a0', near: 16, far: 95 },
    // Muted, slightly green-white light falling high through the canopy.
    sun: { color: '#eef2d8', intensity: 1.55, position: [-18, 48, 14] },
    hemi: { sky: '#b4c8b8', ground: '#33421f', intensity: 1.05 },
    exposure: 1.0,
    grade: 0.55,
    ground: {
      grass: '#4b6a2e',
      grassDark: '#3d5a27',
      grassLight: '#587a34',
      hill: '#425f2a',
      arena: '#5f6a3a',
      arenaWorn: '#6e6446',
      hills: 0.7,
    },
    stone: { light: '#8a907c', dark: '#5f6b4e' },
    swaps: {
      // Darker pine green for the forest wall; mossy rocks.
      medieval: [
        { cell: [1, 2], color: '#2f5a33' },
        { cell: [2, 2], color: '#7d8670' },
        // Bark and cut wood: dark and damp instead of the pack's warm orange.
        { cell: [5, 0], color: '#6a4c36' },
        { cell: [6, 0], color: '#54402f' },
      ],
      halloween: [{ cell: [0, 1], color: '#2c5236' }],
    },
  },
  barrowlands: {
    sky: { zenith: '#2c3358', horizon: '#a8899c' },
    fog: { color: '#6f7690', near: 22, far: 125 },
    // Low cold-rose dusk sun from the west: long shadows, still enough light to read the fight.
    sun: { color: '#ffc8b0', intensity: 1.7, position: [-46, 22, -12] },
    hemi: { sky: '#9aa6d2', ground: '#45443f', intensity: 1.45 },
    exposure: 1.02,
    grade: 0.3,
    ground: {
      grass: '#6c7060',
      grassDark: '#5f6455',
      grassLight: '#787a66',
      hill: '#666c5e',
      arena: '#86847a',
      arenaWorn: '#939083',
      hills: 0.55,
    },
    stone: { light: '#8e939c', dark: '#646a75' },
    swaps: {
      medieval: [{ cell: [2, 2], color: '#7f848e' }],
      // Cold grave lights in the lanterns.
      halloween: [{ cell: [2, 3], color: '#7fd8e6' }],
    },
  },
};
