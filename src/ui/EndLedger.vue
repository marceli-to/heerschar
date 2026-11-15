<script setup lang="ts">
import { computed } from 'vue';
import type { HudLedgerRow } from '../game/game';
import { STRINGS } from '../data/strings';
import ClassMedallion from './hud/ClassMedallion.vue';

/**
 * End panel ledger (approved 3e): one row per squad member with damage dealt, taken and healing
 * done; fallen ones greyed; the biggest number per column in gold (restyled 6i).
 */
const props = defineProps<{ rows: HudLedgerRow[] }>();

type Column = 'dealt' | 'taken' | 'healed';
const COLUMNS: readonly Column[] = ['dealt', 'taken', 'healed'];

const best = computed(() => {
  const top = { dealt: 0, taken: 0, healed: 0 };
  for (const r of props.rows) for (const c of COLUMNS) top[c] = Math.max(top[c], r[c]);
  return top;
});

const isBest = (r: HudLedgerRow, c: Column) => r[c] > 0 && r[c] === best.value[c];
</script>

<template>
  <table class="mx-auto w-full text-left">
    <thead>
      <tr class="label">
        <th class="pb-1.5" colspan="2" />
        <th v-for="c in COLUMNS" :key="c" class="w-20 pb-1.5 text-right font-normal">{{ STRINGS.ledger[c] }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r.id" class="border-t-2 border-ink/10">
        <td class="w-8 py-1" :class="{ 'opacity-45 grayscale': r.fallen }">
          <ClassMedallion :class-id="r.classId" :size="24" />
        </td>
        <td class="py-1 pl-1" :class="{ 'opacity-45': r.fallen }">
          <span class="font-display text-lg" :class="{ 'text-blood': r.hero }">{{ r.name }}</span>
          <span v-if="r.fallen" class="note ml-2">{{ STRINGS.ledger.fallen }}</span>
        </td>
        <td
          v-for="c in COLUMNS"
          :key="c"
          class="py-1 text-right font-display text-lg tabular-nums"
          :class="isBest(r, c) ? 'text-amber' : r[c] === 0 ? 'text-ink-soft/50' : ''"
        >{{ r[c] }}</td>
      </tr>
    </tbody>
  </table>
</template>
