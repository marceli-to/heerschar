<script setup lang="ts">
import { computed } from 'vue';
import { itemById } from '../../data/items';
import { STRINGS } from '../../data/strings';
import { effectLines } from '../../meta/describe';
import PictogramTile from '../PictogramTile.vue';

/**
 * An item offer (approved Stage 4): pictogram tile, name, rarity word in small caps, who can use
 * it and what it does. Frames by rarity: ink, silver, gold (epic with a soft glow). Hover lifts.
 */
const props = defineProps<{ id: string }>();

const item = computed(() => itemById(props.id));
const fits = computed(() => (item.value.classId ? STRINGS.spoils.weapon(STRINGS.classes[item.value.classId]) : STRINGS.spoils.trinket));
</script>

<template>
  <button class="card panel flex w-64 flex-col items-center px-6 pt-7 pb-6 text-center" :class="item.rarity">
    <PictogramTile :name="item.icon" :size="68" />
    <h3 class="mt-4 font-display text-xl leading-tight">{{ STRINGS.items[item.id] ?? item.id }}</h3>
    <p class="rarity font-black text-[11px] tracking-[0.12em] uppercase">{{ STRINGS.rarities[item.rarity] }}</p>
    <p class="mt-1 text-sm text-ink-soft italic">{{ fits }}</p>
    <div class="rule my-3 w-3/4" />
    <ul class="text-base leading-snug">
      <li v-for="l in effectLines(item.effect)" :key="l">{{ l }}</li>
    </ul>
  </button>
</template>

<style scoped>
/* Rarity = inner ring: none / silver / gold with a soft glow (approved 4, restyled 6i). */
.card {
  transition: transform 140ms, box-shadow 140ms;
}
.card.common .rarity {
  color: var(--color-ink-soft);
}
.card.rare {
  box-shadow:
    inset 0 0 0 5px #c4d0dd,
    inset 0 -4px 0 #d9b77a,
    0 6px 0 var(--color-ink),
    0 14px 28px rgb(20 10 4 / 0.4);
}
.card.rare .rarity {
  color: #5a6f86;
}
.card.epic {
  box-shadow:
    inset 0 0 0 5px var(--color-gold-light),
    inset 0 0 24px rgb(255 200 80 / 0.35),
    0 6px 0 var(--color-ink),
    0 0 26px 4px rgb(255 214 110 / 0.55);
}
.card.epic .rarity {
  color: #c47a00;
}
.card:hover,
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow:
    inset 0 2px 0 #fffbe9,
    inset 0 -4px 0 #d9b77a,
    0 10px 0 var(--color-ink),
    0 22px 30px rgb(20 10 4 / 0.45);
}
.card.epic:hover,
.card.epic:focus-visible {
  box-shadow:
    inset 0 0 0 5px var(--color-gold-light),
    inset 0 0 24px rgb(255 200 80 / 0.35),
    0 10px 0 var(--color-ink),
    0 0 30px 6px rgb(255 214 110 / 0.65);
}
</style>
