<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { formatPlayTime } from '../../meta/describe';
import type { GameState } from '../../meta/game';
import ClassMedallion from '../hud/ClassMedallion.vue';
import WarTable from './WarTable.vue';
import WaxSeal from './WaxSeal.vue';

/**
 * The ending (approved 5e): a victory scroll on the war table after the Bone King falls. Heading,
 * play time and battles, then the company (hero first) with class and level. Shown once; the
 * save stays and can be continued to finish the remaining nodes.
 */
const props = defineProps<{ game: GameState }>();
const emit = defineEmits<{ done: [] }>();

const T = STRINGS.ending;

const company = computed(() => [...props.game.squad.roster].sort((a, b) => Number(b.isHero) - Number(a.isHero)));
const stats = computed(() => [
  { label: T.time, value: formatPlayTime(props.game.playMs) },
  { label: T.won, value: String(props.game.battles - props.game.lost) },
  { label: T.lost, value: String(props.game.lost) },
]);
</script>

<template>
  <WarTable>
    <div class="flex flex-col items-center">
      <div class="parchment flex w-[min(720px,92vw)] flex-col items-center rounded-sm px-12 pt-10 pb-14 text-center">
        <h1 class="title-gold font-display text-[clamp(26px,3.6vw,40px)] leading-tight font-bold tracking-[0.06em]">{{ T.title }}</h1>
        <p class="mt-2 text-lg italic text-ink-soft">{{ T.subtitle }}</p>
        <div class="rule mt-5 w-3/4" />

        <dl class="mt-5 flex justify-center gap-12">
          <div v-for="s in stats" :key="s.label" class="flex flex-col items-center">
            <dt class="font-display text-xs tracking-[0.2em] text-ink-soft uppercase">{{ s.label }}</dt>
            <dd class="mt-1 font-display text-2xl tabular-nums">{{ s.value }}</dd>
          </div>
        </dl>

        <p class="mt-8 font-display text-xs tracking-[0.25em] text-ink-soft uppercase">{{ T.company }}</p>
        <ul class="mt-3 grid w-full gap-x-10 gap-y-1.5 text-left" :class="company.length > 5 ? 'grid-cols-2' : 'mx-auto max-w-sm grid-cols-1'">
          <li v-for="c in company" :key="c.id" class="flex items-center gap-3 border-b border-ink/10 py-1.5">
            <ClassMedallion :class-id="c.classId" :size="34" />
            <span class="flex-1 truncate font-display text-lg tracking-[0.04em]" :class="{ 'font-bold': c.isHero }">{{ c.name }}</span>
            <span class="text-sm italic text-ink-soft">{{ c.isHero ? `${T.hero} · ${STRINGS.classes[c.classId]}` : STRINGS.classes[c.classId] }}</span>
            <span class="w-16 text-right font-display text-xs tabular-nums text-ink-soft">{{ T.level }} {{ c.level }}</span>
          </li>
        </ul>
      </div>
      <WaxSeal class="-mt-12" :size="88" icon="crown" />
      <button class="btn-gold mt-8 rounded-sm px-10 py-3 text-base" @click="emit('done')">{{ T.toTitle }}</button>
    </div>
  </WarTable>
</template>

<style scoped>
.title-gold {
  background: linear-gradient(180deg, #f3d98c 0%, #d4a338 45%, #9a6e1e 70%, #e0bf6a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 rgb(58 39 23 / 0.9)) drop-shadow(0 0 1px rgb(58 39 23 / 0.8));
}
</style>
