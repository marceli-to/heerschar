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
      <svg class="tip absolute" width="18" height="20" viewBox="0 0 18 20" style="left: 18px; top: -10px">
        <path d="M2 2 L16 10 L2 18 L5.5 10 Z" fill="#f6c453" stroke="#3b2414" stroke-width="2.5" stroke-linejoin="round" />
      </svg>
    </div>
    <ClassMedallion
      :class-id="marker.classId"
      :size="34"
      class="absolute -translate-x-1/2 -translate-y-1/2"
      :class="marker.kind === 'ally' ? 'ally' : ''"
    >
      <svg v-if="marker.kind === 'mark'" width="20" height="20" viewBox="0 0 20 20">
        <path d="M5 2 V18" stroke="#3b2414" stroke-width="2.4" stroke-linecap="round" />
        <path d="M5.5 3 H16 L13 7 L16 11 H5.5 Z" fill="#ff5a44" stroke="#3b2414" stroke-width="1.6" stroke-linejoin="round" />
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
    background: radial-gradient(circle at 35% 30%, #ffb0a0, #ff5a44 60%, #c0281a);
    box-shadow: 0 0 14px 4px rgb(255 90 68 / 0.85);
  }
}
</style>
