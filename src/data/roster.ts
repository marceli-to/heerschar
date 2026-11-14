import { HERO_ID, setFielded, type Character, type SquadState } from '../meta/squad';
import type { PlayableClassId } from '../sim/types';

/**
 * The Stage 3 sandbox roster (approved by Marcel): seven companions, so five take the field and
 * two wait on the bench. Since Stage 5 only the dev shortcut games use it (`?bot`, `?battle=` …).
 * Order = default fielding order.
 */
export const SANDBOX_COMPANIONS: readonly { name: string; classId: PlayableClassId }[] = [
  { name: 'Bran', classId: 'krieger' },
  { name: 'Hilde', classId: 'bogenschuetze' },
  { name: 'Maren', classId: 'heiler' },
  { name: 'Osric', classId: 'magier' },
  { name: 'Edda', classId: 'krieger' },
  { name: 'Wulf', classId: 'bogenschuetze' },
  { name: 'Ansel', classId: 'magier' },
];

function character(id: number, name: string, classId: PlayableClassId, isHero: boolean): Character {
  return { id, name, classId, isHero, level: 1, xp: 0, upgrades: [], path: null, weapon: null, trinket: null };
}

/** The campaign start (Stage 5, approved): the hero sets out with a warrior and a healer. */
export const START_COMPANIONS: readonly { name: string; classId: PlayableClassId }[] = [
  { name: 'Bran', classId: 'krieger' },
  { name: 'Maren', classId: 'heiler' },
];

/**
 * Names camps draw recruits from, per class (the sandbox names first). A recruit never shares a
 * name with anyone already in the roster. Draft names, not yet approved by Marcel.
 */
export const RECRUIT_NAMES: Record<PlayableClassId, readonly string[]> = {
  krieger: ['Edda', 'Gunnar', 'Sigrun', 'Torvald', 'Hrolf', 'Brynja'],
  bogenschuetze: ['Hilde', 'Wulf', 'Leofric', 'Aelis', 'Garrick', 'Tamsin'],
  heiler: ['Elske', 'Anselm', 'Brigid', 'Oswin', 'Mathild', 'Cuthbert'],
  magier: ['Osric', 'Ansel', 'Morwen', 'Elric', 'Ysolde', 'Thorne'],
};

export function newCharacter(id: number, name: string, classId: PlayableClassId, isHero = false): Character {
  return character(id, name, classId, isHero);
}

/**
 * A fresh squad: the hero plus `companions` (the campaign start by default; the dev shortcuts
 * pass the sandbox roster), the first five fielded in default slots.
 */
export function newSquad(heroClass: PlayableClassId, heroName: string, companions: readonly { name: string; classId: PlayableClassId }[] = START_COMPANIONS): SquadState {
  const roster = [character(HERO_ID, heroName, heroClass, true), ...companions.map((c, i) => character(HERO_ID + 1 + i, c.name, c.classId, false))];
  const state: SquadState = { roster, fielded: [], formation: {} };
  for (const c of roster) setFielded(state, c.id, true);
  return state;
}
