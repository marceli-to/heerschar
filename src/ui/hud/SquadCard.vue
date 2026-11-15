<script setup lang="ts">
import { computed } from 'vue';
import type { HudCompanion } from '../../game/game';
import { STRINGS } from '../../data/strings';
import ClassMedallion from './ClassMedallion.vue';

/** One companion in the squad panel (approved 2d): name, class medallion, health bar; fallen = grey, < 30 % pulses. */
const props = defineProps<{ companion: HudCompanion }>();

const frac = computed(() => Math.max(0, props.companion.hp / props.companion.maxHp));
const danger = computed(() => !props.companion.dead && frac.value < 0.3);
</script>

<template>
  <div class="plate @container flex max-w-40 min-w-0 flex-1 basis-40 items-center gap-2 px-2 py-1.5" :class="{ 'opacity-60 grayscale': companion.dead, danger }">
    <ClassMedallion :class-id="companion.classId" :size="32" />
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline justify-between gap-1">
        <span class="shrink-0 font-display text-[15px]">{{ companion.name }}</span>
        <span class="hidden min-w-0 truncate text-[11px] font-extrabold text-ink-soft @[148px]:inline">{{ companion.dead ? STRINGS.fallen : STRINGS.classes[companion.classId] }}</span>
      </div>
      <div class="bar bar-thin mt-0.5 h-3.5">
        <div class="fill fill-hp transition-[width] duration-150" :class="{ 'animate-pulse': danger }" :style="{ width: `${frac * 100}%` }" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.danger {
  animation: danger 0.9s ease-in-out infinite;
}
@keyframes danger {
  50% {
    background: linear-gradient(#ffd9cf, #ffb4a2);
    box-shadow:
      0 4px 0 var(--color-ink),
      0 0 14px 3px rgb(255 90 68 / 0.75);
  }
}
</style>
