<script setup lang="ts">
import { ENCOUNTERS, type EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import ClassMedallion from '../hud/ClassMedallion.vue';
import WarTable from './WarTable.vue';
import WaxSeal from './WaxSeal.vue';

/** Battle list as sealed orders (approved 3b): parchment notes, enemy medallions, a wax seal, a gold tick once won. */
defineProps<{ won: EncounterId[] }>();
const emit = defineEmits<{ fight: [id: EncounterId]; back: [] }>();

/** A slight tilt per note so they look laid on the table. */
const TILT = [-1.6, 1.1, 0.8, -1.2];

/** Enemy rows as the player sees them across the field: back row on top, front row below. */
function rows(id: EncounterId) {
  const e = ENCOUNTERS.find((x) => x.id === id)!;
  return [1, 0].map((row) => e.enemies.filter((u) => u.row === row).sort((a, b) => b.col - a.col));
}
</script>

<template>
  <WarTable>
    <div class="flex w-[min(940px,94vw)] flex-col items-center">
      <h2 class="font-display text-sm tracking-[0.35em] text-gold-light uppercase">{{ STRINGS.prep.orders }}</h2>
      <p class="mt-1 mb-10 text-lg italic text-parchment/70">{{ STRINGS.prep.ordersHint }}</p>
      <div class="grid w-full grid-cols-2 gap-x-10 gap-y-14">
        <button
          v-for="(e, i) in ENCOUNTERS"
          :key="e.id"
          class="note parchment relative rounded-sm px-8 pt-10 pb-6 text-left"
          :style="{ '--tilt': `${TILT[i % TILT.length]}deg` }"
          @click="emit('fight', e.id)"
        >
          <WaxSeal class="absolute -top-8 left-1/2 -translate-x-1/2" :size="58" />
          <span v-if="won.includes(e.id)" class="tick absolute top-3 right-4 font-display text-xs tracking-[0.15em] text-gold uppercase">✓ {{ STRINGS.prep.won }}</span>
          <h3 class="text-center font-display text-2xl font-bold tracking-[0.08em]">{{ STRINGS.encounters[e.id].name }}</h3>
          <p class="mt-2 min-h-[3.2em] text-center text-base leading-snug italic text-ink-soft">{{ STRINGS.encounters[e.id].intro }}</p>
          <div class="rule mx-auto my-4 w-3/4" />
          <div class="flex flex-col items-center gap-1.5">
            <div v-for="(row, r) in rows(e.id)" :key="r" class="flex gap-2">
              <ClassMedallion v-for="(u, k) in row" :key="k" :class-id="u.classId" :size="32" :title="STRINGS.classes[u.classId]" class="enemy" />
            </div>
          </div>
        </button>
      </div>
      <button class="mt-10 font-display text-xs tracking-[0.15em] text-parchment/70 underline-offset-4 hover:underline" @click="emit('back')">{{ STRINGS.prep.back }}</button>
    </div>
  </WarTable>
</template>

<style scoped>
.note {
  transform: rotate(var(--tilt));
  transition: transform 140ms, box-shadow 140ms;
}
.note:hover {
  transform: rotate(0deg) translateY(-4px);
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 16px 34px rgb(5 2 1 / 0.6);
}
.tick {
  text-shadow: 0 0 6px rgb(224 191 106 / 0.5);
}
</style>
