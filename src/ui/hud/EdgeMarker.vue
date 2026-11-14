<script setup lang="ts">
import type { HudEdgeMarker } from '../../game/game';
import ClassMedallion from './ClassMedallion.vue';

/** Off-screen pointer (approved 2e): the class medallion with an arrow tip pointing outwards. */
defineProps<{ marker: HudEdgeMarker }>();
</script>

<template>
  <div class="absolute" :style="{ left: `${marker.x}px`, top: `${marker.y}px` }">
    <!-- Arrow tip, rotated around the medallion centre. -->
    <div class="absolute top-0 left-0" :style="{ transform: `rotate(${marker.angle}rad)` }">
      <svg class="tip absolute" width="14" height="16" viewBox="0 0 14 16" style="left: 19px; top: -8px">
        <path d="M1 1 L13 8 L1 15 L4 8 Z" fill="#e0bf6a" stroke="#3a2717" stroke-width="1.2" stroke-linejoin="round" />
      </svg>
    </div>
    <ClassMedallion
      :class-id="marker.classId"
      :size="34"
      class="absolute -translate-x-1/2 -translate-y-1/2"
      :class="marker.kind === 'ally' ? 'ally' : ''"
    >
      <svg v-if="marker.kind === 'mark'" width="20" height="20" viewBox="0 0 20 20">
        <path d="M5 2 V18" stroke="#e0bf6a" stroke-width="1.6" stroke-linecap="round" />
        <path d="M5.5 3 H16 L13 7 L16 11 H5.5 Z" fill="#c9483a" stroke="#7a2117" stroke-width="0.8" stroke-linejoin="round" />
      </svg>
    </ClassMedallion>
  </div>
</template>

<style scoped>
.ally {
  animation: ally 0.9s ease-in-out infinite;
}
@keyframes ally {
  50% {
    border-color: var(--color-blood-light);
    box-shadow:
      0 0 0 1px rgb(58 39 23 / 0.8),
      0 0 14px 3px rgb(201 72 58 / 0.85);
  }
}
</style>
