import { createApp } from 'vue';
import App from './ui/App.vue';
import { loadModels } from './view/models/assets';
import { loadScenery } from './view/scenery/props';
import { audio } from './audio/engine';
import { installUiSound } from './audio/uiSound';
import { music } from './audio/music';
import './style.css';

if (new URLSearchParams(location.search).has('lineup')) {
  // Dev scene: every unit body in a row (see `view/models/lineup.ts`).
  void import('./view/models/lineup').then((m) => m.startLineup(document.getElementById('app')!));
} else if (new URLSearchParams(location.search).has('titleart')) {
  // Dev scene: the title-screen backdrop, rendered once by tools/titleart.mjs.
  void import('./view/titleArt').then((m) => m.startTitleArt(document.getElementById('app')!));
} else if (new URLSearchParams(location.search).has('sounds')) {
  // Dev page: audition every sound effect.
  void import('./audio/soundBoard').then((m) => m.startSoundBoard(document.getElementById('app')!));
} else {
  void loadModels();
  void loadScenery();
  audio.installUnlock();
  installUiSound();
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __audio: { audio, music } });
  createApp(App).mount('#app');
}
