<script setup lang="ts">
import { computed } from 'vue';
import { itemById, type ItemSlot } from '../../data/items';
import { STRINGS } from '../../data/strings';
import { effectLines } from '../../meta/describe';
import { characterOf, fittingItems, type GameState } from '../../meta/game';
import PictogramTile from '../PictogramTile.vue';

/**
 * The baggage under an equipment slot (approved 4d): a panel popover with one row per item
 * that fits, and "Take off" on top when something is worn. Hovering a row asks the sheet to
 * preview the stats (`preview(id)`; `null` = the slot empty, `undefined` = no preview).
 */
const props = defineProps<{ game: GameState; characterId: number; slot: ItemSlot }>();
const emit = defineEmits<{ equip: [id: string]; takeOff: []; preview: [id: string | null | undefined] }>();

const T = STRINGS.squadStep;

const worn = computed(() => characterOf(props.game, props.characterId)[props.slot]);
const entries = computed(() => fittingItems(props.game, props.characterId, props.slot).map((e) => ({ ...e, item: itemById(e.id) })));
</script>

<template>
  <div class="picker panel w-80 p-1.5 text-left" @mouseleave="emit('preview', undefined)">
    <template v-if="worn">
      <button class="row-select flex w-full items-baseline gap-2 px-3 py-2 text-left" @mouseenter="emit('preview', null)" @click="emit('takeOff')">
        <span class="label text-blood">{{ T.takeOff }}</span>
        <span class="note truncate">{{ STRINGS.items[worn] ?? worn }}</span>
      </button>
      <div class="rule mx-3" />
    </template>
    <ul v-if="entries.length" class="max-h-72 overflow-y-auto">
      <li v-for="e in entries" :key="e.id">
        <button class="row-select flex w-full items-start gap-3 px-3 py-2 text-left" @mouseenter="emit('preview', e.id)" @focus="emit('preview', e.id)" @click="emit('equip', e.id)">
          <PictogramTile :name="e.item.icon" :rarity="e.item.rarity" :size="40" />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="heading-3 truncate text-lg">
                {{ STRINGS.items[e.id] ?? e.id }}<span v-if="e.count > 1" class="ml-1 text-ink-soft tabular-nums">×{{ e.count }}</span>
              </span>
              <span class="label rarity shrink-0" :class="e.item.rarity">{{ STRINGS.rarities[e.item.rarity] }}</span>
            </span>
            <span v-for="l in effectLines(e.item.effect)" :key="l" class="note block">{{ l }}</span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="note px-4 py-2">{{ T.baggageEmpty }}</p>
  </div>
</template>

<style scoped>
.row-select:focus-visible {
  background: rgb(246 196 83 / 0.4);
  outline: none;
}
.rarity.common {
  color: var(--color-ink-soft);
}
.rarity.rare {
  color: var(--color-silver-ink);
}
.rarity.epic {
  color: var(--color-amber);
}
</style>
