import { HERO_ID, setFielded, type Character, type SquadState } from '../meta/squad';
import type { PlayableClassId } from '../sim/types';

/**
 * The Stage 3 sandbox roster (approved by Marcel): seven companions, so five take the field and
 * two wait on the bench. Replaced by the campaign start (hero + two) and camps in Stage 5.
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
  return { id, name, classId, isHero, level: 1, xp: 0, weapon: null, trinket: null };
}

/** A fresh squad: the hero plus the sandbox companions, the first five fielded in default slots. */
export function newSquad(heroClass: PlayableClassId, heroName: string): SquadState {
  const roster = [character(HERO_ID, heroName, heroClass, true), ...SANDBOX_COMPANIONS.map((c, i) => character(HERO_ID + 1 + i, c.name, c.classId, false))];
  const state: SquadState = { roster, fielded: [], formation: {} };
  for (const c of roster) setFielded(state, c.id, true);
  return state;
}
