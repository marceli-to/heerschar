import { encounterById, trialSetup, type EncounterId } from '../data/encounters';
import { STRINGS } from '../data/strings';
import { battleSetupFor, fieldedCharacters, type SquadState } from '../meta/squad';
import type { PlayableClassId } from '../sim/types';
import type { BattleSpec } from './game';

/** A battle of the squad against an encounter. The squad is copied, so later edits don't leak in. */
export function encounterSpec(squad: SquadState, encounterId: EncounterId): BattleSpec {
  // JSON copy: the squad may be a Vue proxy, which structuredClone refuses.
  const snapshot = JSON.parse(JSON.stringify(squad)) as SquadState;
  const encounter = encounterById(encounterId);
  return {
    mode: 'squad',
    build: (seed) => battleSetupFor(snapshot, encounter, seed),
    names: fieldedCharacters(snapshot).map((c) => c.name),
    title: STRINGS.encounters[encounterId].name,
    intro: STRINGS.encounters[encounterId].intro,
  };
}

/** The Stage 1 feel test (`?trial`). */
export function trialSpec(heroClass: PlayableClassId, heroName: string): BattleSpec {
  return { mode: 'trial', build: (seed) => trialSetup(seed, heroClass), names: [heroName], title: STRINGS.trial.name, intro: STRINGS.trial.intro };
}
