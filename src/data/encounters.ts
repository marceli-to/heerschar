import { CLASS_STATS } from './classes';
import type { LootTier } from './items';
import { statsAtLevel } from './progression';
import { formationSetup, type BattleSetup, type FormationSlot } from '../sim/battle';
import { SUMMONS } from '../sim/balance';
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
  /** Enemy level: their stats grow with it like the squad's (`LEVEL_GROWTH`). */
  level: number;
  /** Extra enemy health and power multiplier on top of level and squad scaling. */
  strength: number;
  /** Experience the first win pays, shared by the fielded characters (PLAN section 10). */
  xp: number;
  loot: LootTier;
  enemies: EncounterUnit[];
}

export type EncounterId =
  | 'raiders' | 'farmstead' | 'archerLine' | 'shieldWall' | 'ironWarlord'
  | 'skirmish' | 'berserkerRush' | 'shamansGrove' | 'wolfPack' | 'fenWitch'
  | 'ambush' | 'burningField' | 'graveWatch' | 'ironColumn' | 'boneLegion' | 'cryptRoad' | 'warband' | 'boneKing';

const E = (classId: ClassId, col: 0 | 1 | 2, row: 0 | 1): EncounterUnit => ({ classId, col, row });

/**
 * Every battle of the campaign, region by region (where each sits: `NODES` in `campaign.ts`).
 * Each asks something different of the squad:
 * - raiders: three to open with, for a squad of three.
 * - farmstead: a small band with a shaman; the first mark.
 * - archerLine: a thin front and a lot of ranged damage behind; close the gap or out-heal it.
 * - shieldWall (elite): armoured front with shamans behind; physical damage bounces off, bring magic.
 * - skirmish: the Stage 2 mixed band (also the dev battle and the Stage 2 tests' band).
 * - berserkerRush: fast frail divers that go for healers and the back row; guard them.
 * - shamansGrove: three shamans keep two shieldbearers standing; kill the shamans first.
 * - wolfPack (elite): four berserkers with a shaman; protect the healer.
 * - ambush: berserkers and mages; the back row gets jumped while fire falls.
 * - burningField: three mages behind a warrior wall; spread out.
 * - graveWatch: shieldbearers and archers holding a hill.
 * - ironColumn: six heavy and steady, a long fight.
 * - boneLegion (elite): a double wall of steel with a shaman in the middle.
 * - cryptRoad: berserkers and shamans in the dark.
 * - warband (elite): everything at once.
 * - ironWarlord / fenWitch / boneKing: the region bosses with a small escort. The Warlord leads
 *   from the front and calls raiders; the Witch stands in the back row behind berserkers and
 *   shamans and calls wolves and shamans; the Bone King leads a warrior line and raises the fallen.
 * Level follows the squad level expected there (~6 at the first boss, ~12 at the second, ~18 at
 * the last). Experience pools = per-character targets × the expected fielded count (3 at the
 * start, 6 from the end of the Greenmarch), checked by the campaign walk test; strength is tuned in 5f.
 */
export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'raiders', level: 1, strength: 1.2, xp: 540, loot: 'normal', enemies: [E('berserker', 0, 0), E('krieger', 1, 0), E('bogenschuetze', 1, 1)] },
  { id: 'farmstead', level: 2, strength: 1.2, xp: 880, loot: 'normal', enemies: [E('krieger', 0, 0), E('krieger', 2, 0), E('bogenschuetze', 0, 1), E('schamane', 2, 1)] },
  { id: 'archerLine', level: 3, strength: 1.3, xp: 1000, loot: 'normal', enemies: [E('krieger', 0, 0), E('krieger', 2, 0), E('bogenschuetze', 0, 1), E('magier', 1, 1), E('bogenschuetze', 2, 1)] },
  { id: 'shieldWall', level: 5, strength: 1.8, xp: 1500, loot: 'elite', enemies: [E('schildtraeger', 0, 0), E('schildtraeger', 1, 0), E('schildtraeger', 2, 0), E('schamane', 0, 1), E('schamane', 2, 1)] },
  { id: 'ironWarlord', level: 6, strength: 1.8, xp: 2700, loot: 'boss', enemies: [E('krieger', 0, 0), E('kriegsherr', 1, 0), E('krieger', 2, 0), E('bogenschuetze', 0, 1), E('bogenschuetze', 2, 1)] },

  { id: 'skirmish', level: 7, strength: 1.5, xp: 2700, loot: 'normal', enemies: [E('schildtraeger', 0, 0), E('krieger', 1, 0), E('berserker', 2, 0), E('bogenschuetze', 0, 1), E('schamane', 1, 1), E('magier', 2, 1)] },
  { id: 'berserkerRush', level: 8, strength: 1.5, xp: 2800, loot: 'normal', enemies: [E('berserker', 0, 0), E('berserker', 1, 0), E('berserker', 2, 0), E('bogenschuetze', 0, 1), E('bogenschuetze', 2, 1)] },
  { id: 'shamansGrove', level: 9, strength: 1.8, xp: 2900, loot: 'normal', enemies: [E('schildtraeger', 0, 0), E('schildtraeger', 2, 0), E('schamane', 0, 1), E('schamane', 1, 1), E('schamane', 2, 1)] },
  { id: 'wolfPack', level: 11, strength: 2.1, xp: 3300, loot: 'elite', enemies: [E('berserker', 0, 0), E('berserker', 1, 0), E('berserker', 2, 0), E('berserker', 0, 1), E('schamane', 2, 1)] },
  { id: 'fenWitch', level: 12, strength: 2.1, xp: 3300, loot: 'boss', enemies: [E('berserker', 0, 0), E('berserker', 2, 0), E('schamane', 0, 1), E('sumpfhexe', 1, 1), E('schamane', 2, 1)] },

  { id: 'ambush', level: 13, strength: 1.7, xp: 2700, loot: 'normal', enemies: [E('berserker', 0, 0), E('krieger', 1, 0), E('berserker', 2, 0), E('magier', 0, 1), E('magier', 2, 1)] },
  { id: 'burningField', level: 14, strength: 1.9, xp: 2800, loot: 'normal', enemies: [E('krieger', 0, 0), E('schildtraeger', 1, 0), E('krieger', 2, 0), E('magier', 0, 1), E('magier', 1, 1), E('magier', 2, 1)] },
  { id: 'graveWatch', level: 14, strength: 1.9, xp: 2800, loot: 'normal', enemies: [E('schildtraeger', 0, 0), E('schildtraeger', 2, 0), E('bogenschuetze', 0, 1), E('bogenschuetze', 1, 1), E('bogenschuetze', 2, 1)] },
  { id: 'ironColumn', level: 15, strength: 2.0, xp: 2900, loot: 'normal', enemies: [E('schildtraeger', 0, 0), E('krieger', 1, 0), E('schildtraeger', 2, 0), E('bogenschuetze', 0, 1), E('krieger', 1, 1), E('bogenschuetze', 2, 1)] },
  { id: 'boneLegion', level: 16, strength: 2.2, xp: 3300, loot: 'elite', enemies: [E('schildtraeger', 0, 0), E('krieger', 1, 0), E('schildtraeger', 2, 0), E('krieger', 0, 1), E('schamane', 1, 1), E('krieger', 2, 1)] },
  { id: 'cryptRoad', level: 17, strength: 2.1, xp: 2900, loot: 'normal', enemies: [E('berserker', 0, 0), E('berserker', 1, 0), E('berserker', 2, 0), E('schamane', 0, 1), E('schamane', 2, 1)] },
  { id: 'warband', level: 17, strength: 2.3, xp: 3400, loot: 'elite', enemies: [E('schildtraeger', 0, 0), E('krieger', 1, 0), E('berserker', 2, 0), E('bogenschuetze', 0, 1), E('schamane', 1, 1), E('magier', 2, 1)] },
  { id: 'boneKing', level: 18, strength: 2.3, xp: 0, loot: 'boss', enemies: [E('krieger', 0, 0), E('knochenkoenig', 1, 0), E('krieger', 2, 0), E('magier', 0, 1), E('schamane', 1, 1), E('magier', 2, 1)] },
];

export function encounterById(id: EncounterId): Encounter {
  const e = ENCOUNTERS.find((x) => x.id === id);
  if (!e) throw new Error(`unknown encounter ${id}`);
  return e;
}

/** A side of a battle in formation slots, with squad-battle scaling, level and strength applied. */
export function enemySlots(encounter: Encounter, strength = encounter.strength, level = encounter.level): FormationSlot[] {
  return encounter.enemies.map((e) => {
    const st = statsAtLevel(armyStats(CLASS_STATS[e.classId]), e.classId, level);
    return { classId: e.classId, col: e.col, row: e.row, stats: { ...st, maxHp: st.maxHp * strength, power: st.power * strength } };
  });
}

/** Summoned units come in weaker than the escort that began the battle. */
export const SUMMON_STRENGTH = 0.7;

/**
 * Stats of every unit the encounter's bosses may summon (`SUMMONS`), at the encounter's level
 * and strength × `SUMMON_STRENGTH`.
 */
export function enemyReserves(encounter: Encounter): Partial<Record<ClassId, Stats>> {
  const out: Partial<Record<ClassId, Stats>> = {};
  for (const e of encounter.enemies) {
    for (const group of SUMMONS[e.classId] ?? []) {
      for (const classId of group) {
        const st = statsAtLevel(armyStats(CLASS_STATS[classId]), classId, encounter.level);
        const k = encounter.strength * SUMMON_STRENGTH;
        out[classId] = { ...st, maxHp: st.maxHp * k, power: st.power * k };
      }
    }
  }
  return out;
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
    enemySlots(encounterById('skirmish'), 1, 1),
  );
}
