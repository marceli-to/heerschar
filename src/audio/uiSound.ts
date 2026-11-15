import { watch } from 'vue';
import { session, type Screen } from '../ui/session';
import { audio } from './engine';

/** The sound of arriving on a screen: a page turned, the seal broken for a battle, coins for spoils. */
const ARRIVE: Partial<Record<Screen, string>> = { battle: 'uiSeal', spoils: 'uiCoins' };

/**
 * Interface sounds without touching every component: a click on any enabled button, and a sound
 * per screen change.
 */
export function installUiSound(): void {
  window.addEventListener(
    'click',
    (e) => {
      const button = (e.target as Element | null)?.closest?.('button');
      if (button && !button.disabled) audio.play('uiClick', { bus: 'ui', gain: 0.6, spread: 0.08 });
    },
    true,
  );
  watch(
    () => session.screen,
    (to, from) => {
      if (to === from) return;
      audio.play(ARRIVE[to] ?? 'uiPage', { bus: 'ui', gain: 0.8 });
    },
  );
}
