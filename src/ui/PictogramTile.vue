<script setup lang="ts">
import type { ItemIcon, Rarity } from '../data/items';
import type { UpgradeIcon } from '../data/upgrades';
import Pictogram from './Pictogram.vue';

/**
 * A pictogram on the dark-brown, gold-rimmed square tile of the ability slots (approved 2e).
 * With `rarity` the rim takes the item frame (approved 4d): ink, silver, gold with a soft glow.
 */
withDefaults(defineProps<{ name: UpgradeIcon | ItemIcon; size?: number; rarity?: Rarity }>(), { size: 64 });
</script>

<template>
  <div class="tile relative shrink-0 rounded-[3px]" :class="rarity" :style="{ width: `${size}px`, height: `${size}px` }">
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
.tile.common {
  border-color: var(--color-ink);
}
.tile.rare {
  border-color: #a7aeb6;
  box-shadow:
    0 0 0 1px #5d6670,
    inset 0 0 8px rgb(0 0 0 / 0.6),
    0 3px 8px rgb(20 12 4 / 0.45);
}
.tile.epic {
  border-color: var(--color-gold-light);
  box-shadow:
    0 0 0 1px var(--color-gold),
    inset 0 0 8px rgb(0 0 0 / 0.6),
    0 0 14px rgb(224 191 106 / 0.55),
    0 3px 8px rgb(20 12 4 / 0.45);
}
</style>
