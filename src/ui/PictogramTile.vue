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
/* Wood tile (6i); the ring colour shows the rarity: wood / silver / gold with a glow. */
.tile {
  border-radius: 12px;
  background: linear-gradient(var(--color-wood-light), var(--color-wood));
  border: 3px solid var(--color-ink);
  box-shadow:
    inset 0 0 0 2px #c9a27a,
    inset 0 3px 0 3px rgb(255 255 255 / 0.1),
    0 3px 0 var(--color-ink);
}
.tile.rare {
  box-shadow:
    inset 0 0 0 3px #dce4ee,
    inset 0 3px 0 3px rgb(255 255 255 / 0.1),
    0 3px 0 var(--color-ink);
}
.tile.epic {
  box-shadow:
    inset 0 0 0 3px var(--color-gold-light),
    inset 0 0 12px rgb(255 214 110 / 0.45),
    0 3px 0 var(--color-ink),
    0 0 16px 2px rgb(255 214 110 / 0.6);
}
</style>
