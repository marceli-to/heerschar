import { CLASS_STATS } from './classes';
import { formationSetup, type BattleSetup, type FormationSlot } from '../sim/battle';
import type { ClassId, Stats } from '../sim/types';

/**
 * Squad battles are tougher than the bare class lines (approved by Marcel in 2f): everyone has
 * more health and companions and enemies hit harder, so the hero cannot win alone and battles
 * last longer. The hero's own damage stays as tuned in Stage 1.
 */
export const SQUAD_SCALE = { hp: 1.5, armyPower: 1.2 } as const;

function heroStats(s: Stats): Stats {
  return { ...s, maxHp: s.maxHp * SQUAD_SCALE.hp };
}

function armyStats(s: Stats): Stats {
  return { ...s, maxHp: s.maxHp * SQUAD_SCALE.hp, power: s.power * SQUAD_SCALE.armyPower };
}

/** Stage 1 feel test: the hero (warrior by default) alone against three melee raiders. */
export function trialSetup(seed: number, heroClass: ClassId = 'krieger'): BattleSetup {
  const raider = { ...CLASS_STATS.krieger, maxHp: 170, power: 18, armor: 30 };
  return {
    seed,
    units: [
      { team: 'player', classId: heroClass, isHero: true, stats: { ...CLASS_STATS[heroClass] }, x: -8, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: -3 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 9, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: 3 },
    ],
  };
}

/** A unit in an encounter's formation. Col 0..2 left to right as that side sees it, row 0 = front. */
export interface EncounterUnit {
  classId: ClassId;
  col: 0 | 1 | 2;
  row: 0 | 1;
}

/** A battle defined in data. Names and intros live in `STRINGS.encounters[id]`. */
export interface Encounter {
  id: EncounterId;
  /** Enemy health and power multiplier on top of the squad scaling. Stands in for enemy levels until Stage 4. */
  strength: number;
  enemies: EncounterUnit[];
}

export type EncounterId = 'skirmish' | 'shieldWall' | 'berserkerRush' | 'archerLine';

/**
 * Stage 3 sandbox battles, each asking something different of the squad:
 * - skirmish: the Stage 2 mixed band.
 * - shieldWall: armoured front with healers behind; physical damage bounces off, bring magic.
 * - berserkerRush: fast frail divers that go for healers and the back row; guard them.
 * - archerLine: a thin front and a lot of ranged damage behind; close the gap or out-heal it.
 */
export const ENCOUNTERS: readonly Encounter[] = [
  {
    id: 'skirmish',
    strength: 1.5,
    enemies: [
      { classId: 'schildtraeger', col: 0, row: 0 },
      { classId: 'krieger', col: 1, row: 0 },
      { classId: 'berserker', col: 2, row: 0 },
      { classId: 'bogenschuetze', col: 0, row: 1 },
      { classId: 'schamane', col: 1, row: 1 },
      { classId: 'magier', col: 2, row: 1 },
    ],
  },
  {
    id: 'shieldWall',
    strength: 2,
    enemies: [
      { classId: 'schildtraeger', col: 0, row: 0 },
      { classId: 'schildtraeger', col: 1, row: 0 },
      { classId: 'schildtraeger', col: 2, row: 0 },
      { classId: 'schamane', col: 0, row: 1 },
      { classId: 'schamane', col: 2, row: 1 },
    ],
  },
  {
    id: 'berserkerRush',
    strength: 1.5,
    enemies: [
      { classId: 'berserker', col: 0, row: 0 },
      { classId: 'berserker', col: 1, row: 0 },
      { classId: 'berserker', col: 2, row: 0 },
      { classId: 'bogenschuetze', col: 0, row: 1 },
      { classId: 'bogenschuetze', col: 2, row: 1 },
    ],
  },
  {
    id: 'archerLine',
    strength: 1.3,
    enemies: [
      { classId: 'krieger', col: 0, row: 0 },
      { classId: 'krieger', col: 2, row: 0 },
      { classId: 'bogenschuetze', col: 0, row: 1 },
      { classId: 'magier', col: 1, row: 1 },
      { classId: 'bogenschuetze', col: 2, row: 1 },
    ],
  },
];

export function encounterById(id: EncounterId): Encounter {
  const e = ENCOUNTERS.find((x) => x.id === id);
  if (!e) throw new Error(`unknown encounter ${id}`);
  return e;
}

/** A side of a battle in formation slots, with squad-battle scaling applied. */
export function enemySlots(encounter: Encounter, strength = encounter.strength): FormationSlot[] {
  return encounter.enemies.map((e) => {
    const st = armyStats(CLASS_STATS[e.classId]);
    return { classId: e.classId, col: e.col, row: e.row, stats: { ...st, maxHp: st.maxHp * strength, power: st.power * strength } };
  });
}

/** Player slot stats: the hero keeps its own damage, companions get the army scaling. */
export function playerSlotStats(classId: ClassId, isHero: boolean): Stats {
  return isHero ? heroStats(CLASS_STATS[classId]) : armyStats(CLASS_STATS[classId]);
}

/**
 * Stage 2 squad battle (kept for tests and the bare game): the hero and four companions
 * (Krieger front, Bogenschuetze, Heiler, Magier behind) against the skirmish band at Stage 2 strength.
 */
export function squadSetup(seed: number, heroClass: ClassId = 'krieger'): BattleSetup {
  return formationSetup(
    seed,
    [
      { classId: heroClass, col: 1, row: 0, isHero: true, stats: playerSlotStats(heroClass, true) },
      { classId: 'krieger', col: 0, row: 0, stats: playerSlotStats('krieger', false) },
      { classId: 'bogenschuetze', col: 0, row: 1, stats: playerSlotStats('bogenschuetze', false) },
      { classId: 'heiler', col: 1, row: 1, stats: playerSlotStats('heiler', false) },
      { classId: 'magier', col: 2, row: 1, stats: playerSlotStats('magier', false) },
    ],
    enemySlots(encounterById('skirmish'), 1),
  );
}
