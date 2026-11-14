<script setup lang="ts">
import { ENCOUNTERS, type EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import { isUnlocked, type GameState } from '../../meta/game';
import ClassMedallion from '../hud/ClassMedallion.vue';
import HoverNote from './HoverNote.vue';
import WarTable from './WarTable.vue';
import WaxSeal from './WaxSeal.vue';

/**
 * The ten-battle chain as sealed orders (approved 3b, 4e): five by two small parchment notes,
 * unlocked in sequence. Open: seal on top, name, level in small caps, enemy medallions, intro on
 * hover. Won: gold tick and "Replay: no spoils". Locked: folded, darker, seal intact, "Sealed".
 */
const props = defineProps<{ game: GameState }>();
const emit = defineEmits<{ fight: [id: EncounterId]; back: [] }>();

/** A slight tilt per note so they look laid on the table. */
const TILT = [-1.6, 1.1, 0.8, -1.2, 1.4, -0.7, 1.6, -1.3, 0.6, -0.9];

/** Enemy rows as the player sees them across the field: back row on top, front row below. */
function rows(id: EncounterId) {
  const e = ENCOUNTERS.find((x) => x.id === id)!;
  return [1, 0].map((row) => e.enemies.filter((u) => u.row === row).sort((a, b) => b.col - a.col));
}

const open = (id: EncounterId) => isUnlocked(props.game, id);
const won = (id: EncounterId) => props.game.won.includes(id);
</script>

<template>
  <WarTable>
    <div class="flex w-[min(1180px,96vw)] flex-col items-center">
      <h2 class="font-display text-sm tracking-[0.35em] text-gold-light uppercase">{{ STRINGS.prep.orders }}</h2>
      <p class="mt-1 mb-9 text-lg italic text-parchment/70">{{ STRINGS.prep.ordersHint }}</p>
      <div class="grid w-full grid-cols-5 gap-x-6 gap-y-12">
        <HoverNote v-for="(e, i) in ENCOUNTERS" :key="e.id" :disabled="!open(e.id)" :style="{ '--tilt': `${TILT[i % TILT.length]}deg` }" class="slot">
          <button
            v-if="open(e.id)"
            class="note parchment relative flex h-48 w-full flex-col items-center rounded-sm px-3 pt-7 pb-3"
            @click="emit('fight', e.id)"
          >
            <WaxSeal class="absolute -top-6 left-1/2 -translate-x-1/2" :size="42" />
            <span v-if="won(e.id)" class="tick absolute top-1.5 right-2 font-display text-[10px] tracking-[0.12em] text-gold uppercase">✓ {{ STRINGS.prep.won }}</span>
            <h3 class="text-center font-display text-base leading-tight font-bold tracking-[0.05em]">{{ STRINGS.encounters[e.id].name }}</h3>
            <p class="level mt-0.5 font-display text-[10px] tracking-[0.2em] uppercase">{{ STRINGS.prep.level }} {{ e.level }}</p>
            <div class="rule my-2 w-3/4" />
            <div class="flex flex-col items-center gap-1">
              <div v-for="(row, r) in rows(e.id)" :key="r" class="flex gap-1">
                <ClassMedallion v-for="(u, k) in row" :key="k" :class-id="u.classId" :size="22" :title="STRINGS.classes[u.classId]" />
              </div>
            </div>
            <p v-if="won(e.id)" class="mt-auto text-xs italic text-ink-soft">{{ STRINGS.prep.replay }}</p>
          </button>
          <div v-else class="note folded parchment relative flex h-48 w-full flex-col items-center justify-center rounded-sm" :aria-label="STRINGS.prep.sealed">
            <WaxSeal :size="46" />
            <p class="mt-2 font-display text-[11px] tracking-[0.2em] text-parchment/60 uppercase">{{ STRINGS.prep.sealed }}</p>
          </div>
          <template #note>
            <p class="max-w-52 text-sm leading-snug italic">{{ STRINGS.encounters[e.id].intro }}</p>
          </template>
        </HoverNote>
      </div>
      <button class="mt-10 font-display text-xs tracking-[0.15em] text-parchment/70 underline-offset-4 hover:underline" @click="emit('back')">{{ STRINGS.prep.back }}</button>
    </div>
  </WarTable>
</template>

<style scoped>
.slot > .note {
  transform: rotate(var(--tilt));
  transition: transform 140ms, box-shadow 140ms;
}
.slot:hover > button.note {
  transform: rotate(0deg) translateY(-4px);
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 16px 34px rgb(5 2 1 / 0.6);
}
.level {
  color: #8a6a2c;
}
.tick {
  text-shadow: 0 0 6px rgb(224 191 106 / 0.5);
}
/* Locked: a folded, darker sheet with a crease across the middle; the seal stays whole. */
.folded::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, transparent 48.5%, rgb(50 28 10 / 0.45) 50%, rgb(255 240 210 / 0.25) 51%, transparent 53%),
    linear-gradient(180deg, rgb(45 24 8 / 0.5), rgb(45 24 8 / 0.62) 50%, rgb(45 24 8 / 0.5));
}
.folded > * {
  position: relative;
  z-index: 1;
}
</style>
