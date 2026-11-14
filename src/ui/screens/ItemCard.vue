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
  <button class="card parchment flex w-64 flex-col items-center rounded-sm px-6 pt-7 pb-6 text-center" :class="item.rarity">
    <PictogramTile :name="item.icon" :size="68" />
    <h3 class="mt-4 font-display text-xl leading-tight font-bold tracking-[0.06em]">{{ STRINGS.items[item.id] ?? item.id }}</h3>
    <p class="rarity font-display text-[11px] tracking-[0.25em] uppercase">{{ STRINGS.rarities[item.rarity] }}</p>
    <p class="mt-1 text-sm text-ink-soft italic">{{ fits }}</p>
    <div class="rule my-3 w-3/4" />
    <ul class="text-base leading-snug">
      <li v-for="l in effectLines(item.effect)" :key="l">{{ l }}</li>
    </ul>
  </button>
</template>

<style scoped>
.card {
  border-width: 2px;
  transition: transform 140ms, box-shadow 140ms;
}
.card.common {
  border-color: var(--color-ink);
  outline-color: rgb(58 39 23 / 0.8);
}
.card.common .rarity {
  color: var(--color-ink-soft);
}
.card.rare {
  border-color: #a7aeb6;
  outline-color: #5d6670;
}
.card.rare .rarity {
  color: #5d6670;
}
.card.epic {
  border-color: var(--color-gold-light);
  outline-color: var(--color-gold);
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 0 22px rgb(224 191 106 / 0.45),
    0 10px 30px rgb(20 12 4 / 0.45);
}
.card.epic .rarity {
  color: var(--color-gold);
}
.card:hover,
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 18px 36px rgb(5 2 1 / 0.6);
}
.card.epic:hover,
.card.epic:focus-visible {
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 0 26px rgb(224 191 106 / 0.6),
    0 18px 36px rgb(5 2 1 / 0.6);
}
</style>
