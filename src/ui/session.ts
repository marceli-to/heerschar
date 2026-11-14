import { reactive, toRaw, watch } from 'vue';
import type { EncounterId } from '../data/encounters';
import { SANDBOX_COMPANIONS, newSquad } from '../data/roster';
import { newGame, recordBattle, type GameState } from '../meta/game';
import { clearSave, loadGame, saveGame, type SaveStorage } from '../meta/save';
import type { PlayableClassId } from '../sim/types';

export type Screen = 'title' | 'classSelect' | 'map' | 'squad' | 'formation' | 'battle' | 'spoils';

/** Where the player goes once the spoils are settled. */
export type AfterSpoils = 'map' | 'squad';

/** The state between battles. `game` is what the save holds; the rest is navigation. */
export interface Session {
  screen: Screen;
  game: GameState | null;
  encounterId: EncounterId;
  /** Bumped per battle so the battle view remounts fresh. */
  battleRun: number;
  /** Where the spoils page leads when it is done. */
  afterSpoils: AfterSpoils;
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

export const session: Session = reactive({ screen: 'title', game: null, encounterId: 'skirmish', battleRun: 0, afterSpoils: 'map', persist: false, hasSave: store ? loadGame(store) !== null : false });

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

/** Starts a new company (replacing any save) and opens the map. */
export function startNewGame(heroClass: PlayableClassId, heroName: string): void {
  if (store) clearSave(store);
  session.persist = true;
  session.game = newGame(heroClass, heroName, (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0);
  session.screen = 'map';
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
  session.screen = 'map';
  if (g.rewards) openSpoils('map');
}

/** Dev shortcuts (`?bot`, `?hero=` …): a game that is never saved, with the full sandbox roster. */
export function startDevGame(heroClass: PlayableClassId, heroName: string): void {
  session.persist = false;
  session.game = newGame(heroClass, heroName, 1);
  session.game.squad = newSquad(heroClass, heroName, SANDBOX_COMPANIONS);
}

/** Opens the preparation steps (squad, then formation) for a battle from the map. */
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

/** Pending rewards are settled on the spoils page before the player goes anywhere else. */
function openSpoils(then: AfterSpoils): void {
  session.afterSpoils = then;
  session.screen = 'spoils';
}

/** Leaves a battle for the map or the squad step, through the spoils page when a first win paid out. */
export function leaveBattle(to: AfterSpoils): void {
  if (session.game?.rewards) openSpoils(to);
  else spoilsDone(to);
}

/** The spoils are settled (or there were none): on to where the player was heading. */
export function spoilsDone(to: AfterSpoils = session.afterSpoils): void {
  if (to === 'squad') prepare(session.encounterId);
  else goTo('map');
}
