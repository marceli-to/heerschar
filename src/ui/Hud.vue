<script setup lang="ts">
import { computed } from 'vue';
import type { HudState } from '../game/game';
import { STRINGS } from '../data/strings';
import AbilitySlot from './hud/AbilitySlot.vue';
import EdgeMarker from './hud/EdgeMarker.vue';
import SquadCard from './hud/SquadCard.vue';

const props = defineProps<{ hud: HudState }>();

const hpFrac = computed(() => Math.max(0, props.hud.heroHp / props.hud.heroMaxHp));
const lowHp = computed(() => hpFrac.value < 0.3);
const energyFrac = computed(() => Math.max(0, props.hud.energy / props.hud.maxEnergy));
const time = computed(() => {
  const s = Math.floor(props.hud.time);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 font-body select-none">
    <!-- Foes remaining and battle time -->
    <div class="hud-plate absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-5 rounded-sm px-5 py-1.5">
      <div class="flex items-baseline gap-2">
        <span class="font-display text-[11px] tracking-[0.25em] text-ink-soft uppercase">{{ STRINGS.foes }}</span>
        <span class="font-display text-xl font-bold text-blood">{{ hud.foes }}</span>
      </div>
      <div class="h-5 w-px bg-gold/60" />
      <div class="flex items-baseline gap-2">
        <span class="font-display text-[11px] tracking-[0.25em] text-ink-soft uppercase">{{ STRINGS.time }}</span>
        <span class="text-lg tabular-nums">{{ time }}</span>
      </div>
    </div>

    <!-- Bottom row: hero plate, abilities, squad panel -->
    <div class="absolute right-5 bottom-5 left-5 flex items-end gap-3">
      <div class="hud-plate w-72 shrink-0 rounded-sm px-4 pt-2 pb-3">
        <div class="flex items-baseline justify-between">
          <span class="font-display text-sm font-bold tracking-[0.18em]">{{ STRINGS.classes[hud.heroClass] }}</span>
          <span class="text-base tabular-nums text-ink-soft">{{ hud.heroHp }} / {{ hud.heroMaxHp }}</span>
        </div>
        <div class="mt-1 h-3.5 overflow-hidden rounded-[2px] border border-ink/70 bg-ink/25 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)]">
          <div
            class="h-full bg-gradient-to-b from-blood-light to-blood transition-[width] duration-150"
            :class="{ 'animate-pulse': lowHp }"
            :style="{ width: `${hpFrac * 100}%` }"
          />
        </div>
        <div class="mt-1.5 flex items-center gap-2">
          <div class="relative h-2.5 flex-1 overflow-hidden rounded-[2px] border border-ink/70 bg-ink/25 shadow-[inset_0_1px_3px_rgb(0_0_0/0.4)]">
            <div class="h-full bg-gradient-to-b from-energy-light to-energy transition-[width] duration-100" :style="{ width: `${energyFrac * 100}%` }" />
          </div>
          <span class="w-7 text-right text-sm tabular-nums text-ink-soft">{{ hud.energy }}</span>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <div class="relative h-2 w-20 overflow-hidden rounded-[2px] border border-ink/50 bg-ink/15">
            <div class="h-full bg-gold" :style="{ width: `${hud.dodgeReady * 100}%` }" />
          </div>
          <span
            class="font-display text-[10px] tracking-[0.22em] uppercase"
            :class="hud.dodgeReady >= 1 ? 'text-ink' : 'text-ink-soft/70'"
          >{{ STRINGS.dodge }} · Space</span>
        </div>
      </div>

      <div v-if="hud.abilities.length" class="flex shrink-0 gap-2 pb-0.5">
        <AbilitySlot v-for="a in hud.abilities" :key="a.id" :ability="a" />
      </div>

      <div v-if="hud.squad.length" class="ml-3 flex flex-wrap items-end gap-2">
        <SquadCard v-for="c in hud.squad" :key="c.id" :companion="c" />
      </div>
    </div>

    <!-- Edge markers: off-screen companions in danger and the marked enemy -->
    <EdgeMarker v-for="m in hud.edgeMarkers" :key="`${m.kind}-${m.id}`" :marker="m" />

    <!-- Countdown -->
    <div
      v-if="hud.phase === 'playing' && hud.countdown > 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span
        :key="hud.countdown"
        class="countdown font-display text-[120px] font-bold text-parchment"
        style="text-shadow: 0 0 2px #3a2717, 0 4px 18px rgb(0 0 0 / 0.6), 0 0 40px rgb(185 138 46 / 0.6)"
      >{{ hud.countdown }}</span>
    </div>
  </div>
</template>

<style scoped>
.countdown {
  animation: count 1s ease-out both;
}
@keyframes count {
  from {
    transform: scale(1.5);
    opacity: 0;
  }
  25% {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.9);
    opacity: 0.2;
  }
}
</style>
