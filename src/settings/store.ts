import { reactive, watch } from 'vue';
import { audio } from '../audio/engine';
import { VOLUMES, defaultSettings, parseSettings, type Settings } from './settings';

/** The live settings: read by the game every frame, edited by the settings sheet, saved on every change. */
const KEY = 'heerschar.settings';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function load(): Settings {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? parseSettings(JSON.parse(raw)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export const settings: Settings = reactive(load());

function applyAudio(): void {
  for (const k of VOLUMES) audio.volume[k] = settings.volume[k] / 100;
  audio.applyVolumes();
}

applyAudio();

watch(
  settings,
  () => {
    applyAudio();
    try {
      storage()?.setItem(KEY, JSON.stringify(settings));
    } catch {
      // Storage full or refused: the settings still hold for this visit.
    }
  },
  { deep: true },
);

/** Puts one section (or everything) back to the defaults. */
export function restoreDefaults(section: 'volume' | 'keys' | 'camera' | 'quality'): void {
  const d = defaultSettings();
  if (section === 'quality') settings.quality = d.quality;
  else Object.assign(settings[section], d[section]);
}
