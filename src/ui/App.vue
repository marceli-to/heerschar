<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Game } from '../game/game';
import { createBot } from '../sim/bot';
import type { ClassId } from '../sim/types';
import DebugOverlay from './DebugOverlay.vue';
import Hud from './Hud.vue';
import Overlays from './Overlays.vue';

const canvas = ref<HTMLCanvasElement | null>(null);
const HERO_CLASSES: readonly ClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

function parseHeroClass(v: string | null): ClassId | undefined {
  return HERO_CLASSES.find((c) => c === v);
}
const game = shallowRef<Game | null>(null);

onMounted(() => {
  if (!canvas.value) return;
  const params = new URLSearchParams(location.search);
  const g = new Game(canvas.value, {
    seed: Number(params.get('seed')) || (Date.now() >>> 0),
    zoom: params.has('zoom') ? Number(params.get('zoom')) : undefined,
    debug: params.has('debug'),
    peaceful: params.has('peaceful'),
    heroClass: parseHeroClass(params.get('hero')),
  });
  if (params.has('bot')) {
    g.bot = createBot();
    g.hud.phase = 'playing';
  }
  g.start();
  game.value = g;
  if (params.has('debug')) (window as unknown as { __game: Game }).__game = g;
});

onBeforeUnmount(() => game.value?.dispose());
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <canvas ref="canvas" class="block h-full w-full" />
    <template v-if="game">
      <Hud :hud="game.hud" />
      <Overlays :hud="game.hud" @take-control="game.takeControl()" @restart="game.restart()" />
      <DebugOverlay :stats="game.debug" />
    </template>
  </div>
</template>
