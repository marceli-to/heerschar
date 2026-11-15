<script setup lang="ts">
import type { ClassId } from '../../sim/types';
import { STRINGS } from '../../data/strings';

/** Class icon (approved 2d, restyled 6i): a monogram on a round gold coin with a thick ink outline. The default slot replaces the letter. */
withDefaults(defineProps<{ classId: ClassId; size?: number }>(), { size: 30 });
</script>

<template>
  <div
    class="medallion coin flex shrink-0 items-center justify-center font-display text-ink"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.46}px`, borderWidth: `${size >= 28 ? 3 : 2.5}px` }"
  >
    <slot>{{ STRINGS.monograms[classId] }}</slot>
  </div>
</template>

<style scoped>
.medallion {
  box-shadow: inset 0 -2px 0 rgb(0 0 0 / 0.2), inset 0 2px 0 rgb(255 255 255 / 0.35);
  line-height: 1;
  padding-top: 0.06em;
}
</style>
