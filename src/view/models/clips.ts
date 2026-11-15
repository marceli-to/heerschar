import type { ActionId } from '../../sim/types';
import type { Pack } from './assets';
import type { BodyStyle } from './bodies';

/**
 * A stretch of a clip, played over a sim phase: `from` at the phase start, `to` at its end.
 * Actions split their clip at the hit frame (the peak hand speed, measured per clip), so the
 * blow lands on screen exactly when the sim resolves it at the end of the windup.
 */
export interface Segment {
  clip: string;
  from: number;
  to: number;
  /** Times past the clip's end wrap round (a looping clip played more than once). */
  wrap?: boolean;
  /** Slow down towards `to` instead of running at an even pace. */
  easeOut?: boolean;
}

export interface ActionAnim {
  windup: Segment;
  recover: Segment;
}

const split = (clip: string, start: number, hit: number, end: number): ActionAnim => ({
  windup: { clip, from: start, to: hit },
  recover: { clip, from: hit, to: end },
});

/** Clip, start, hit frame, end (seconds into the clip). */
const ANIMS = {
  slashLight: split('1H_Melee_Attack_Slice_Diagonal', 0.12, 0.36, 1.0),
  slashHeavy: split('1H_Melee_Attack_Chop', 0.2, 0.6, 1.07),
  chop: split('1H_Melee_Attack_Chop', 0, 0.6, 1.07),
  dualChop: split('Dualwield_Melee_Attack_Chop', 0, 0.55, 1.27),
  bash: split('Block_Attack', 0.05, 0.35, 1.07),
  // Whirlwind: the clip is one full turn (0.67 s); two turns, the blow lands after the first.
  spin: {
    windup: { clip: '2H_Melee_Attack_Spinning', from: 0, to: 0.67 },
    recover: { clip: '2H_Melee_Attack_Spinning', from: 0.67, to: 1.34, wrap: true, easeOut: true },
  },
  cheer: split('Cheer', 0, 0.45, 1.3),
  taunt: split('Taunt', 0, 0.45, 1.03),
  shoot: { windup: { clip: '2H_Ranged_Aiming', from: 0, to: 0.1 }, recover: { clip: '2H_Ranged_Shoot', from: 0.08, to: 1.07 } },
  cast: split('Spellcast_Shoot', 0, 0.3, 0.93),
  slam: split('2H_Melee_Attack_Chop', 0.1, 0.8, 1.63),
  raise: split('Spellcast_Raise', 0, 0.5, 2.1),
  hopBack: split('Dodge_Backward', 0, 0.1, 0.4),
  // Bosses with two-handed weapons (hit frames measured like the others).
  greatSweep: split('2H_Melee_Attack_Slice', 0, 0.38, 1.1),
  greatChop: split('2H_Melee_Attack_Chop', 0.1, 0.72, 1.63),
  // The wolf (Quaternius): crouch and lunge, the head peaks at the bite.
  bite: split('Attack', 0.35, 0.95, 1.33),
} satisfies Record<string, ActionAnim>;

/** Clips for the non-action states. */
export interface BaseClips {
  idle: string;
  walk: string;
  run: string;
  dodge: string;
  dodgeBack: string;
  staggerLight: string;
  staggerHeavy: string;
  death: string;
  deathSkeleton: string;
}

const KAYKIT_BASE: BaseClips = {
  idle: 'Idle',
  walk: 'Walking_A',
  run: 'Running_A',
  dodge: 'Dodge_Forward',
  dodgeBack: 'Dodge_Backward',
  staggerLight: 'Hit_A',
  staggerHeavy: 'Hit_B',
  death: 'Death_A',
  deathSkeleton: 'Death_C_Skeletons',
};

export const BASE_CLIPS: Record<Pack, BaseClips> = {
  adventurers: KAYKIT_BASE,
  skeletons: KAYKIT_BASE,
  // Wolves never dodge; the gallop stands in.
  quaternius: {
    idle: 'Idle',
    walk: 'Walk',
    run: 'Gallop',
    dodge: 'Gallop',
    dodgeBack: 'Gallop',
    staggerLight: 'Idle_HitReact_Left',
    staggerHeavy: 'Idle_HitReact_Right',
    death: 'Death',
    deathSkeleton: 'Death',
  },
};

/**
 * The animation of an action for a body. `action` null is the basic attack (the hero's chain
 * step `chain`, or an AI unit's strike / shot / bolt).
 */
export function actionAnim(style: BodyStyle, action: ActionId | null, chain: number, hero: boolean, skeleton: boolean): ActionAnim {
  const roar = skeleton ? ANIMS.taunt : ANIMS.cheer;
  if (style === 'bite') return ANIMS.bite;
  if (style === '2h') {
    if (action === 'sweep') return ANIMS.greatSweep;
    if (action === 'summon') return roar;
    if (action === 'raise') return ANIMS.raise;
    if (action !== 'charge') return ANIMS.greatChop;
  }
  switch (action) {
    case 'wirbel':
      return ANIMS.spin;
    case 'schildstoss':
    case 'charge':
      return ANIMS.bash;
    case 'rueckzug':
      return ANIMS.hopBack;
    case 'taunt':
      return roar;
    case 'sammeln':
    case 'summon':
    case 'raise':
      return style === 'staff' || style === 'orb' ? ANIMS.raise : roar;
    case 'groupHeal':
    case 'frostNova':
    case 'frostring':
    case 'heilkreis':
    case 'mend':
    case 'poison':
    case 'slam':
      return style === 'staff' || style === 'orb' ? ANIMS.slam : ANIMS.chop;
    default:
      break;
  }
  switch (style) {
    case 'sword':
      if (hero && action === null) return chain === 1 ? ANIMS.slashHeavy : ANIMS.slashLight;
      return ANIMS.chop;
    case 'dual':
      return ANIMS.dualChop;
    case 'crossbow':
      return ANIMS.shoot;
    case 'staff':
    case 'orb':
      return ANIMS.cast;
    case '2h':
      return ANIMS.greatChop;
  }
}
