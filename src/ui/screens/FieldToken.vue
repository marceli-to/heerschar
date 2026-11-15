<script setup lang="ts">
import type { ClassId } from '../../sim/types';
import ClassMedallion from '../hud/ClassMedallion.vue';

/**
 * A unit on the formation map (approved 3d): class medallion with a name below. The hero gets
 * a second gold ring and a small star on top, echoing the helmet crest.
 */
withDefaults(defineProps<{ classId: ClassId; label: string; hero?: boolean; enemy?: boolean; size?: number }>(), {
  hero: false,
  enemy: false,
  size: 50,
});
</script>

<template>
  <div class="flex flex-col items-center">
    <div class="flex h-[62px] items-center justify-center">
      <div class="relative" :class="{ crest: hero }">
        <svg v-if="hero" viewBox="0 0 20 20" class="star absolute -top-3 left-1/2 size-4 -translate-x-1/2">
          <path d="M10 1.5 L12.4 7.3 L18.6 7.6 L13.8 11.5 L15.4 17.6 L10 14.2 L4.6 17.6 L6.2 11.5 L1.4 7.6 L7.6 7.3 Z" />
        </svg>
        <ClassMedallion :class-id="classId" :size="hero ? size + 2 : size" />
      </div>
    </div>
    <span
      class="mt-1.5 max-w-26 truncate px-1 text-center"
      :class="enemy ? 'label text-blood' : 'font-display text-base'"
    >{{ label }}</span>
  </div>
</template>

<style scoped>
.crest {
  border-radius: 9999px;
  padding: 3px;
  background: var(--color-gold-light);
  box-shadow:
    0 0 0 3px var(--color-ink),
    0 0 12px 2px rgb(255 214 110 / 0.7);
}
.star {
  fill: var(--color-gold-light);
  stroke: var(--color-ink);
  stroke-width: 2;
  stroke-linejoin: round;
  filter: drop-shadow(0 1px 1px rgb(20 12 4 / 0.5));
}
</style>
