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
  /** Archer hood and cloak. */
  hood: string;
  /** Healer robe (light). */
  robe: string;
  /** Mage robe and hat (deep). */
  mageRobe: string;
  fur: string;
  wood: string;
  hair: string;
}

export const PLAYER_COLORS: FigureColors = {
  tunic: '#a63a2a',
  trim: '#d4a338',
  legs: '#5a3a28',
  skin: '#e0b48c',
  metal: '#c4c8cf',
  leather: '#6b4528',
  shield: '#b8472f',
  hood: '#7a3b24',
  robe: '#efe3c8',
  mageRobe: '#8c2f2a',
  fur: '#8a6a48',
  wood: '#7a5634',
  hair: '#6b3f22',
};

export const ENEMY_COLORS: FigureColors = {
  tunic: '#35557d',
  trim: '#9fb4c8',
  legs: '#2c3342',
  skin: '#c9a588',
  metal: '#8d96a3',
  leather: '#3b3530',
  shield: '#2f4a6b',
  hood: '#2e4256',
  robe: '#c9d3dc',
  mageRobe: '#2b3a66',
  fur: '#6d6a66',
  wood: '#4f4740',
  hair: '#2a2622',
};

/** Effect colours (approved 2026-11-14: classic elemental). */
export const FX = {
  fire: '#ff8a2a',
  fireCore: '#ffd36b',
  ember: '#ff5a1f',
  holy: '#fff2c4',
  holyCore: '#ffffff',
  frost: '#7fe3ff',
  frostCore: '#e6fbff',
  frozenTint: '#9fd8ff',
  heal: '#6fe08a',
  healCore: '#d8ffd8',
  shieldPlayer: '#ffd36b',
  shieldEnemy: '#a9d4ff',
  arrowStreak: '#fffaf0',
  warning: '#ff6a2a',
  warningRim: '#ffd27a',
  lock: '#e0bf6a',
  banner: '#b8281e',
  bannerTrim: '#e0bf6a',
  rally: '#ffd36b',
  /** Fen Witch: sickly green poison (approved) and her staff's glow. */
  poison: '#9ccc2e',
  poisonCore: '#e2ff8a',
  poisonRim: '#d4f25a',
  /** Bone King: the glow of his eyes and of the raised. */
  boneGlow: '#7fc8ff',
} as const;

/**
 * Boss and wolf colours (Stage 5 decisions: Iron Warlord dark iron plate and horned helm; Fen
 * Witch hooded robe of rags; Bone King pale bone, rusty crown, glowing blue eyes; wolves grey).
 * Bosses always fight on the enemy side, so they have their own colours instead of team tints.
 */
export const BOSS_COLORS = {
  iron: '#3d4149',
  ironDark: '#25272c',
  ironEdge: '#6d727c',
  horn: '#d8ccb0',
  rag: '#4f5538',
  ragDark: '#363a28',
  ragLight: '#6a6a48',
  hag: '#9aa58a',
  bone: '#e2dbc4',
  boneShadow: '#b5aa8e',
  rust: '#9a5a2a',
  rustDark: '#6e3c1c',
  steel: '#a9adb3',
  wolf: '#7d7a76',
  wolfDark: '#55524e',
  wolfLight: '#a8a49c',
} as const;
