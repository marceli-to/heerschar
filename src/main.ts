import { createApp } from 'vue';
import App from './ui/App.vue';
import './style.css';

if (new URLSearchParams(location.search).has('look')) {
  // Look spike: separate throwaway scene, loaded only behind the flag.
  void import('./look/lookSpike').then((m) => m.startLookSpike(document.getElementById('app')!));
} else {
  createApp(App).mount('#app');
}
