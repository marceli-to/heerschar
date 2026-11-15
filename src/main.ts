import { createApp } from 'vue';
import App from './ui/App.vue';
import { loadModels } from './view/models/assets';
import './style.css';

if (new URLSearchParams(location.search).has('look')) {
  // Look spike: separate throwaway scene, loaded only behind the flag.
  void import('./look/lookSpike').then((m) => m.startLookSpike(document.getElementById('app')!));
} else if (new URLSearchParams(location.search).has('lineup')) {
  // Dev scene: every unit body in a row (see `view/models/lineup.ts`).
  void import('./view/models/lineup').then((m) => m.startLineup(document.getElementById('app')!));
} else {
  void loadModels();
  createApp(App).mount('#app');
}
