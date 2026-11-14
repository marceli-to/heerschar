<script setup lang="ts">
import { computed } from 'vue';
import { itemById } from '../../data/items';
import { STRINGS } from '../../data/strings';
import { effectLines } from '../../meta/describe';
import PictogramTile from '../PictogramTile.vue';
import HoverNote from './HoverNote.vue';

/**
 * An equipment slot (approved 3c / 4d). Empty: dashed frame with a faint sword or amulet.
 * Filled: the item's pictogram tile with its rarity rim, the name below, effect lines on hover.
 * Clicking it opens the baggage (handled by the sheet).
 */
const props = defineProps<{ kind: 'weapon' | 'trinket'; item: string | null; open?: boolean }>();

const ICONS = {
  // sword pointing up: blade, guard, grip, pommel
  weapon: 'M16 3 L18 6 V19 H14 V6 Z M9 19 H23 M16 19 V26 M16 28.5 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
  // amulet on a chain
  trinket: 'M7 4 Q16 16 25 4 M16 13 V15 M16 15 L22.5 21.5 L16 28 L9.5 21.5 Z M16 18.5 L19 21.5 L16 24.5 L13 21.5 Z',
} as const;

const worn = computed(() => (props.item ? itemById(props.item) : null));
</script>

<template>
  <div class="flex w-[150px] flex-col items-center gap-1">
    <HoverNote :disabled="!worn || open">
      <button class="slot-btn block rounded-[3px]" :class="{ 'is-open': open }">
        <PictogramTile v-if="worn" :name="worn.icon" :rarity="worn.rarity" :size="56" />
        <div v-else class="slot flex size-14 items-center justify-center rounded-[3px]">
          <svg viewBox="0 0 32 32" class="size-9 opacity-35" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
            <path :d="ICONS[kind]" />
          </svg>
        </div>
      </button>
      <template v-if="worn" #note>
        <p class="font-display text-sm tracking-[0.06em]">{{ STRINGS.items[worn.id] ?? worn.id }}</p>
        <p class="font-display text-[10px] tracking-[0.2em] text-ink-soft uppercase">{{ STRINGS.rarities[worn.rarity] }}</p>
        <p v-for="l in effectLines(worn.effect)" :key="l" class="text-sm leading-snug">{{ l }}</p>
      </template>
    </HoverNote>
    <span class="font-display text-[10px] tracking-[0.2em] text-ink-soft uppercase">{{ STRINGS.squadStep[kind] }}</span>
    <span class="-mt-1 max-w-full truncate text-center text-sm leading-tight" :class="worn ? 'font-display tracking-[0.04em]' : 'italic text-ink-soft/80'">
      {{ worn ? (STRINGS.items[worn.id] ?? worn.id) : STRINGS.squadStep.empty }}
    </span>
  </div>
</template>

<style scoped>
.slot {
  color: var(--color-ink-soft);
  border: 1.5px dashed rgb(185 138 46 / 0.75);
  background: rgb(120 80 30 / 0.08);
  transition: background-color 120ms;
}
.slot-btn {
  transition: transform 120ms;
}
.slot-btn:hover,
.slot-btn.is-open {
  transform: translateY(-2px);
}
.slot-btn:hover .slot,
.slot-btn.is-open .slot {
  background: rgb(185 138 46 / 0.2);
}
.slot-btn:focus-visible {
  outline: 2px solid var(--color-gold);
  outline-offset: 3px;
}
</style>
