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
  <div class="hud-plate flex w-40 items-center gap-2 rounded-sm px-2 py-1.5" :class="{ 'opacity-55 grayscale': companion.dead, danger }">
    <ClassMedallion :class-id="companion.classId" :size="30" />
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline justify-between gap-1">
        <span class="truncate font-display text-xs font-bold tracking-[0.12em]">{{ companion.name }}</span>
        <span class="text-[11px] whitespace-nowrap text-ink-soft italic">{{ companion.dead ? STRINGS.fallen : STRINGS.classes[companion.classId] }}</span>
      </div>
      <div class="mt-0.5 h-2 overflow-hidden rounded-[2px] border border-ink/60 bg-ink/25">
        <div
          class="h-full bg-gradient-to-b from-blood-light to-blood transition-[width] duration-150"
          :class="{ 'animate-pulse': danger }"
          :style="{ width: `${frac * 100}%` }"
        />
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
    border-color: var(--color-blood-light);
    box-shadow:
      inset 0 0 12px rgb(155 45 32 / 0.45),
      0 0 12px rgb(201 72 58 / 0.7);
  }
}
</style>
