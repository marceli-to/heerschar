<script setup lang="ts">
import type { ClassId } from '../../sim/types';
import { STRINGS } from '../../data/strings';

/** Class icon (approved 2d): a Cinzel monogram in a gold-rimmed medallion. The default slot replaces the letter. */
withDefaults(defineProps<{ classId: ClassId; size?: number }>(), { size: 30 });
</script>

<template>
  <div
    class="medallion flex shrink-0 items-center justify-center rounded-full font-display font-bold text-gold-light"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.46}px` }"
  >
    <slot>{{ STRINGS.monograms[classId] }}</slot>
  </div>
</template>

<style scoped>
.medallion {
  background: radial-gradient(circle at 40% 35%, #5a3d22, #2a1c10 70%);
  border: 2px solid var(--color-gold);
  box-shadow:
    0 0 0 1px rgb(58 39 23 / 0.8),
    inset 0 0 0 1px rgb(224 191 106 / 0.35),
    0 2px 5px rgb(20 12 4 / 0.45);
  line-height: 1;
  letter-spacing: -0.02em;
}
</style>
