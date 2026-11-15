<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HudAbility } from '../../game/game';
import { STRINGS } from '../../data/strings';
import AbilityIcon from './AbilityIcon.vue';
import { keyShort } from '../../settings/settings';
import { settings } from '../../settings/store';

/** One ability tile (approved 2e, restyled 6i): wood tile with a gold ring, pictogram, round key badge, cost bottom-right, clockwise cooldown sweep. */
const props = defineProps<{ ability: HudAbility }>();

const keyName = computed(() => keyShort(settings.keys[props.ability.key]));
const onCooldown = computed(() => props.ability.cooldown > 0);
const ready = computed(() => !onCooldown.value && props.ability.affordable);
/** The dark part still to go: it shrinks clockwise from 12 o'clock. */
const sweep = computed(() => `conic-gradient(transparent ${(1 - props.ability.cooldownFrac) * 360}deg, rgb(30 18 10 / 0.68) 0)`);
const seconds = computed(() => (props.ability.cooldown >= 1 ? Math.ceil(props.ability.cooldown) : (Math.ceil(props.ability.cooldown * 10) / 10).toFixed(1)));

// A short gold flash when the ability becomes usable again.
const flash = ref(0);
watch(ready, (now, before) => {
  if (now && !before) flash.value++;
});
</script>

<template>
  <div class="relative">
    <div
      class="tile relative size-15 overflow-hidden"
      :class="{ 'is-active': ability.active, 'is-short': !ability.affordable && !onCooldown }"
      :title="STRINGS.abilities[ability.id]"
    >
      <AbilityIcon :id="ability.id" class="absolute inset-2.5 text-cream" :class="{ 'opacity-45 grayscale': !ready }" />
      <div v-if="onCooldown" class="absolute inset-0" :style="{ background: sweep }" />
      <span v-if="onCooldown" class="shade absolute inset-0 flex items-center justify-center font-display text-2xl text-white tabular-nums">{{ seconds }}</span>
      <span class="shade absolute right-1.5 bottom-0.5 font-display text-[0.8125rem] tabular-nums" :class="ability.affordable ? 'text-energy-light' : 'text-blood-light'">{{ ability.cost }}</span>
      <div v-if="flash" :key="flash" class="ready-flash absolute inset-0" />
    </div>
    <span class="key coin absolute -bottom-1.5 -left-1.5 font-display text-xs text-ink">{{ keyName }}</span>
  </div>
</template>

<style scoped>
.tile {
  border-radius: var(--radius-card);
  background: linear-gradient(var(--color-wood-light), var(--color-wood));
  border: 3px solid var(--color-ink);
  box-shadow:
    inset 0 0 0 2px var(--color-gold-light),
    inset 0 3px 0 3px rgb(255 255 255 / 0.12),
    0 4px 0 var(--color-ink);
  transition: box-shadow 120ms, filter 120ms;
}
.tile.is-short {
  box-shadow:
    inset 0 0 0 2px #9a8a6a,
    0 4px 0 var(--color-ink);
}
.tile.is-active {
  box-shadow:
    inset 0 0 0 2px #fff1b0,
    inset 0 0 14px rgb(255 220 120 / 0.7),
    0 4px 0 var(--color-ink),
    0 0 16px 2px rgb(255 210 90 / 0.8);
}
.shade {
  text-shadow: 0 2px 0 var(--color-ink);
}
.key {
  min-width: 22px;
  height: 22px;
  padding: 1px 5px 0;
  display: grid;
  place-items: center;
  border-width: 2px;
  line-height: 1;
  white-space: nowrap;
}
.ready-flash {
  pointer-events: none;
  animation: ready 0.45s ease-out both;
}
@keyframes ready {
  from {
    box-shadow: inset 0 0 20px rgb(255 240 170 / 1);
    background: rgb(255 230 160 / 0.25);
  }
  to {
    box-shadow: inset 0 0 0 rgb(255 230 160 / 0);
    background: transparent;
  }
}
</style>
