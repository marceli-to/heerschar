<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { characterStats, xpToNext, type Character } from '../../meta/squad';
import FigurePreview from './FigurePreview.vue';
import ItemSlot from './ItemSlot.vue';

/** Character sheet (approved 3c): turning figure, the stats as fought, level and experience, item slots. */
const props = defineProps<{ character: Character }>();

const T = STRINGS.squadStep;

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits);
}

/** Ledger lines with the numbers the unit really has in battle. */
const lines = computed(() => {
  const c = props.character;
  const s = characterStats(c);
  const out: [string, string][] = [
    [T.stats.maxHp, fmt(s.maxHp)],
    [T.stats.power, fmt(s.power)],
    [T.stats.armor, fmt(s.armor)],
    [T.stats.resist, fmt(s.resist)],
    [T.stats.moveSpeed, `${fmt(s.moveSpeed, 1)} ${T.perSecond}`],
    [T.stats.range, s.range < 3 ? T.melee : `${fmt(s.range)} ${T.metres}`],
  ];
  // The hero attacks with the player's own chain, not on an interval.
  if (!c.isHero) out.push([T.stats.attackInterval, T.every(fmt(s.attackInterval, 1))]);
  return out;
});

const xpNeeded = computed(() => xpToNext(props.character.level));
</script>

<template>
  <div class="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6">
    <FigurePreview :class-id="character.classId" :hero="character.isHero" class="h-[340px]" />
    <div class="flex flex-col">
      <h3 class="font-display text-3xl font-bold tracking-[0.08em]">{{ character.name }}</h3>
      <p class="text-lg italic text-ink-soft">
        {{ STRINGS.classes[character.classId] }}<template v-if="character.isHero"> · {{ T.hero }}</template> · {{ T.level }} {{ character.level }}
      </p>
      <div class="rule my-3 w-full" />
      <dl class="grid min-h-[208px] grid-cols-[auto_1fr] content-start gap-x-6 gap-y-0.5 text-base">
        <template v-for="[label, value] in lines" :key="label">
          <dt class="font-display text-xs leading-7 tracking-[0.15em] text-ink-soft uppercase">{{ label }}</dt>
          <dd class="text-right tabular-nums">{{ value }}</dd>
        </template>
      </dl>
      <div class="mt-3">
        <div class="flex justify-between font-display text-xs tracking-[0.15em] text-ink-soft uppercase">
          <span>{{ T.xp }}</span>
          <span class="tabular-nums">{{ character.xp }} / {{ xpNeeded }}</span>
        </div>
        <div class="xp mt-1 h-1.5 rounded-full">
          <div class="h-full rounded-full bg-gold" :style="{ width: `${Math.min(100, (character.xp / xpNeeded) * 100)}%` }" />
        </div>
      </div>
      <div class="mt-4 flex justify-center gap-8">
        <ItemSlot kind="weapon" :item="character.weapon" />
        <ItemSlot kind="trinket" :item="character.trinket" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.xp {
  background: rgb(58 39 23 / 0.18);
  box-shadow: inset 0 0 0 1px rgb(58 39 23 / 0.25);
}
</style>
