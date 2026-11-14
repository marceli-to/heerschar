<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Game, type BattleSpec } from '../game/game';
import { createBot } from '../sim/bot';
import DebugOverlay from './DebugOverlay.vue';
import Hud from './Hud.vue';
import Overlays from './Overlays.vue';

/** One battle: mounts a Game on its own canvas and disposes it when the battle is left. */
const props = defineProps<{ spec: BattleSpec; seed: number; zoom?: number; debug: boolean; peaceful: boolean; bot: boolean; canLeave: boolean }>();
const emit = defineEmits<{ ended: [won: boolean]; leave: []; changeSquad: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const game = shallowRef<Game | null>(null);

onMounted(() => {
  if (!canvas.value) return;
  const g = new Game(canvas.value, { spec: props.spec, seed: props.seed, zoom: props.zoom, debug: props.debug, peaceful: props.peaceful });
  if (props.bot) {
    g.bot = createBot();
    g.hud.phase = 'playing';
  }
  g.start();
  game.value = g;
  if (props.debug) (window as unknown as { __game: Game }).__game = g;
  watch(
    () => g.hud.outcome,
    (o) => {
      if (o !== 'running') emit('ended', o === 'won');
    },
  );
});

onBeforeUnmount(() => {
  if (document.pointerLockElement) document.exitPointerLock();
  game.value?.dispose();
});
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <canvas ref="canvas" class="block h-full w-full" />
    <template v-if="game">
      <Hud :hud="game.hud" />
      <Overlays :hud="game.hud" :can-leave="canLeave" @take-control="game.takeControl()" @restart="game.restart()" @leave="emit('leave')" @change-squad="emit('changeSquad')" />
      <DebugOverlay :stats="game.debug" />
    </template>
  </div>
</template>
