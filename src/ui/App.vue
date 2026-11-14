<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Game } from '../game/game';
import DebugOverlay from './DebugOverlay.vue';

const canvas = ref<HTMLCanvasElement | null>(null);
const game = shallowRef<Game | null>(null);

onMounted(() => {
  if (!canvas.value) return;
  const params = new URLSearchParams(location.search);
  const seed = Number(params.get('seed')) || 1;
  const zoom = params.has('zoom') ? Number(params.get('zoom')) : undefined;
  const g = new Game(canvas.value, seed, zoom);
  g.start();
  game.value = g;
});

onBeforeUnmount(() => game.value?.dispose());
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <canvas ref="canvas" class="block h-full w-full" />
    <DebugOverlay v-if="game" :stats="game.debug" />
  </div>
</template>
