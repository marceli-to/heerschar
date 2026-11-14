import { reactive, toRaw, watch } from 'vue';
import type { EncounterId } from '../data/encounters';
import { newGame, recordBattle, type GameState } from '../meta/game';
import { clearSave, loadGame, saveGame, type SaveStorage } from '../meta/save';
import type { PlayableClassId } from '../sim/types';

export type Screen = 'title' | 'classSelect' | 'orders' | 'squad' | 'formation' | 'battle';

/** The state between battles. `game` is what the save holds; the rest is navigation. */
export interface Session {
  screen: Screen;
  game: GameState | null;
  encounterId: EncounterId;
  /** Bumped per battle so the battle view remounts fresh. */
  battleRun: number;
  /** Whether changes go to the save (off for the dev shortcut games). */
  persist: boolean;
  /** A usable save exists (Continue on the title). */
  hasSave: boolean;
}

/** `localStorage`, or nothing when the browser refuses it (the game then just does not save). */
function storage(): SaveStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

const store = storage();

export const session: Session = reactive({ screen: 'title', game: null, encounterId: 'skirmish', battleRun: 0, persist: false, hasSave: store ? loadGame(store) !== null : false });

/**
 * Autosave (PLAN section 12): every change to the game state is written. The game state only
 * changes on the preparation screens and when a battle ends, never during one, so quitting
 * mid-battle counts as not fought.
 */
watch(
  () => session.game,
  (g) => {
    if (!g || !session.persist || !store) return;
    try {
      saveGame(store, toRaw(g));
      session.hasSave = true;
    } catch {
      // Storage full or denied: keep playing without saving.
    }
  },
  { deep: true },
);

export function goTo(screen: Screen): void {
  session.screen = screen;
}

/** Starts a new company (replacing any save) and opens the orders. */
export function startNewGame(heroClass: PlayableClassId, heroName: string): void {
  if (store) clearSave(store);
  session.persist = true;
  session.game = newGame(heroClass, heroName, (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  session.screen = 'orders';
}

/** Loads the save; a save that cannot be used leaves the player on the title. */
export function continueGame(): void {
  const g = store ? loadGame(store) : null;
  if (!g) {
    session.hasSave = false;
    return;
  }
  session.persist = true;
  session.game = g;
  session.screen = 'orders';
}

/** Dev shortcuts (`?bot`, `?hero=` …): a game that is never saved. */
export function startDevGame(heroClass: PlayableClassId, heroName: string): void {
  session.persist = false;
  session.game = newGame(heroClass, heroName, 1);
}

/** Opens the preparation steps (squad, then formation) for a battle from the orders. */
export function prepare(encounterId: EncounterId): void {
  session.encounterId = encounterId;
  session.screen = 'squad';
}

export function startBattle(encounterId: EncounterId): void {
  session.encounterId = encounterId;
  session.battleRun++;
  session.screen = 'battle';
}

/** A battle ended: pays a first win (and autosaves through the watch). */
export function battleEnded(won: boolean): void {
  if (session.game) recordBattle(session.game, session.encounterId, won);
}
