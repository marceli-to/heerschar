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
  <div class="picker panel w-80 py-1.5 text-left" @mouseleave="emit('preview', undefined)">
    <template v-if="worn">
      <button class="row flex w-full text-left items-baseline gap-2 px-4 py-2" @mouseenter="emit('preview', null)" @click="emit('takeOff')">
        <span class="font-black text-xs tracking-[0.12em] text-blood uppercase">{{ T.takeOff }}</span>
        <span class="truncate italic text-ink-soft">{{ STRINGS.items[worn] ?? worn }}</span>
      </button>
      <div class="rule mx-3" />
    </template>
    <ul v-if="entries.length" class="max-h-72 overflow-y-auto">
      <li v-for="e in entries" :key="e.id">
        <button class="row flex w-full text-left items-start gap-3 px-3 py-2" @mouseenter="emit('preview', e.id)" @focus="emit('preview', e.id)" @click="emit('equip', e.id)">
          <PictogramTile :name="e.item.icon" :rarity="e.item.rarity" :size="40" />
          <span class="min-w-0 flex-1">
            <span class="flex items-baseline justify-between gap-2">
              <span class="truncate font-display text-base leading-tight">
                {{ STRINGS.items[e.id] ?? e.id }}<span v-if="e.count > 1" class="ml-1 text-sm text-ink-soft tabular-nums">×{{ e.count }}</span>
              </span>
              <span class="rarity shrink-0 font-black text-[11px] tracking-[0.12em] uppercase" :class="e.item.rarity">{{ STRINGS.rarities[e.item.rarity] }}</span>
            </span>
            <span v-for="l in effectLines(e.item.effect)" :key="l" class="block text-sm leading-snug text-ink-soft">{{ l }}</span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="px-4 py-2 italic text-ink-soft">{{ T.baggageEmpty }}</p>
  </div>
</template>

<style scoped>
.picker {
  outline-offset: 2px;
}
.row {
  transition: background-color 100ms;
}
.row {
  border-radius: 10px;
}
.row:hover,
.row:focus-visible {
  background: rgb(246 196 83 / 0.4);
  outline: none;
}
.rarity.common {
  color: var(--color-ink-soft);
}
.rarity.rare {
  color: #5a6f86;
}
.rarity.epic {
  color: #c47a00;
}
</style>
