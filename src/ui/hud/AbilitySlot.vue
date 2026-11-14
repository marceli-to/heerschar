<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HudAbility } from '../../game/game';
import { STRINGS } from '../../data/strings';
import AbilityIcon from './AbilityIcon.vue';

/** One ability tile (approved 2e): pictogram, key bottom-left, cost bottom-right, clockwise cooldown sweep. */
const props = defineProps<{ ability: HudAbility }>();

const onCooldown = computed(() => props.ability.cooldown > 0);
const ready = computed(() => !onCooldown.value && props.ability.affordable);
/** The dark part still to go: it shrinks clockwise from 12 o'clock. */
const sweep = computed(() => `conic-gradient(transparent ${(1 - props.ability.cooldownFrac) * 360}deg, rgb(12 8 4 / 0.72) 0)`);
const seconds = computed(() => (props.ability.cooldown >= 1 ? Math.ceil(props.ability.cooldown) : props.ability.cooldown.toFixed(1)));

// A short gold flash when the ability becomes usable again.
const flash = ref(0);
watch(ready, (now, before) => {
  if (now && !before) flash.value++;
});
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div
      class="tile relative size-14 overflow-hidden rounded-[3px]"
      :class="{ 'is-active': ability.active, 'is-short': !ability.affordable && !onCooldown }"
      :title="STRINGS.abilities[ability.id]"
    >
      <AbilityIcon :id="ability.id" class="absolute inset-1.5 text-gold-light" :class="{ 'opacity-45 grayscale': !ready }" />
      <div v-if="onCooldown" class="absolute inset-0" :style="{ background: sweep }" />
      <span
        v-if="onCooldown"
        class="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-parchment tabular-nums"
        style="text-shadow: 0 1px 3px rgb(0 0 0 / 0.9)"
      >{{ seconds }}</span>
      <span class="absolute bottom-0 left-0.5 font-display text-[10px] font-bold text-parchment/85">{{ ability.key }}</span>
      <span
        class="absolute right-0.5 bottom-0 font-display text-[10px] font-bold tabular-nums"
        :class="ability.affordable ? 'text-energy-light' : 'text-blood-light'"
      >{{ ability.cost }}</span>
      <div v-if="flash" :key="flash" class="ready-flash absolute inset-0" />
    </div>
  </div>
</template>

<style scoped>
.tile {
  background: radial-gradient(circle at 50% 40%, #4a321c, #22170c 75%);
  border: 2px solid var(--color-gold);
  box-shadow:
    0 0 0 1px rgb(58 39 23 / 0.85),
    inset 0 0 8px rgb(0 0 0 / 0.6),
    0 3px 8px rgb(20 12 4 / 0.45);
  transition: box-shadow 120ms, border-color 120ms;
}
.tile.is-short {
  border-color: #7d6a4a;
}
.tile.is-active {
  border-color: var(--color-gold-light);
  box-shadow:
    0 0 0 1px rgb(58 39 23 / 0.85),
    inset 0 0 10px rgb(224 191 106 / 0.5),
    0 0 14px rgb(224 191 106 / 0.75);
}
.ready-flash {
  pointer-events: none;
  animation: ready 0.45s ease-out both;
}
@keyframes ready {
  from {
    box-shadow: inset 0 0 18px rgb(255 230 160 / 0.95);
    background: rgb(255 230 160 / 0.25);
  }
  to {
    box-shadow: inset 0 0 0 rgb(255 230 160 / 0);
    background: transparent;
  }
}
</style>
