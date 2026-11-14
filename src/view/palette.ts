/** Colours of the "sunny meadow" look (approved 2026-11-14). View only. */
export const MEADOW = {
  skyZenith: '#4f9be0',
  skyHorizon: '#d9eefc',
  fog: '#cfe6f7',
  sun: '#fff1d8',
  hemiSky: '#cfe8ff',
  hemiGround: '#5f7d34',
  grass: '#6fa63f',
  grassDark: '#5a9035',
  grassLight: '#82b84a',
  arenaGround: '#9fb860',
  arenaGroundWorn: '#b7b77a',
  stone: '#9a978f',
  stoneDark: '#7c7a74',
  hill: '#6a9d3c',
  trunk: '#6b4a2f',
  leaves: '#3f7a32',
  leavesLight: '#4f8d3a',
} as const;

/** Team colours for the code-built figures: player side warm, enemies cold. */
export interface FigureColors {
  tunic: string;
  trim: string;
  legs: string;
  skin: string;
  metal: string;
  leather: string;
  shield: string;
}

export const PLAYER_COLORS: FigureColors = {
  tunic: '#a63a2a',
  trim: '#d4a338',
  legs: '#5a3a28',
  skin: '#e0b48c',
  metal: '#c4c8cf',
  leather: '#6b4528',
  shield: '#b8472f',
};

export const ENEMY_COLORS: FigureColors = {
  tunic: '#35557d',
  trim: '#9fb4c8',
  legs: '#2c3342',
  skin: '#c9a588',
  metal: '#8d96a3',
  leather: '#3b3530',
  shield: '#2f4a6b',
};
