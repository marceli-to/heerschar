<script setup lang="ts">
import type { ItemIcon } from '../data/items';
import type { UpgradeIcon } from '../data/upgrades';
import Pictogram from './Pictogram.vue';

/** A pictogram on the dark-brown, gold-rimmed square tile of the ability slots (approved 2e). */
withDefaults(defineProps<{ name: UpgradeIcon | ItemIcon; size?: number }>(), { size: 64 });
</script>

<template>
  <div class="tile relative shrink-0 rounded-[3px]" :style="{ width: `${size}px`, height: `${size}px` }">
    <Pictogram :name="name" class="absolute inset-[12%] text-gold-light" />
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
}
</style>
