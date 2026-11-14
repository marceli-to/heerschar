import { reactive } from 'vue';
import type { EncounterId } from '../data/encounters';
import type { SquadState } from '../meta/squad';

export type Screen = 'title' | 'classSelect' | 'orders' | 'battle';

/** The state between battles. Saving arrives in Stage 4; until then a reload starts over. */
export interface Session {
  screen: Screen;
  squad: SquadState | null;
  encounterId: EncounterId;
  /** Battles won at least once (gold tick on the orders). */
  won: EncounterId[];
  /** Bumped per battle so the battle view remounts fresh. */
  battleRun: number;
}

export const session: Session = reactive({ screen: 'title', squad: null, encounterId: 'skirmish', won: [], battleRun: 0 });

export function goTo(screen: Screen): void {
  session.screen = screen;
}

export function startBattle(encounterId: EncounterId): void {
  session.encounterId = encounterId;
  session.battleRun++;
  session.screen = 'battle';
}

export function markWon(encounterId: EncounterId): void {
  if (!session.won.includes(encounterId)) session.won.push(encounterId);
}
