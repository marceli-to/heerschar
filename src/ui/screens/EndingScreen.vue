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
      <div class="panel flex w-[min(720px,92vw)] flex-col items-center px-12 pt-10 pb-14 text-center">
        <h1 class="title-gold text-[clamp(2rem,4.6vw,3.25rem)] text-balance">{{ T.title }}</h1>
        <p class="mt-3 text-lg text-ink-soft">{{ T.subtitle }}</p>
        <div class="rule mt-5 w-3/4" />

        <dl class="mt-5 flex justify-center gap-12">
          <div v-for="s in stats" :key="s.label" class="flex flex-col items-center">
            <dt class="label">{{ s.label }}</dt>
            <dd class="mt-1 font-display text-3xl tabular-nums">{{ s.value }}</dd>
          </div>
        </dl>

        <p class="label mt-8">{{ T.company }}</p>
        <ul role="list" class="mt-3 grid w-full gap-x-10 gap-y-1.5 text-left" :class="company.length > 5 ? 'grid-cols-2' : 'mx-auto max-w-sm grid-cols-1'">
          <li v-for="c in company" :key="c.id" class="flex items-center gap-3 border-b-2 border-ink/10 py-1.5">
            <ClassMedallion :class-id="c.classId" :size="34" />
            <span class="heading-3 flex-1 truncate" :class="{ 'text-blood': c.isHero }">{{ c.name }}</span>
            <span class="note">{{ c.isHero ? `${T.hero} · ${STRINGS.classes[c.classId]}` : STRINGS.classes[c.classId] }}</span>
            <span class="label w-16 text-right tabular-nums">{{ T.level }} {{ c.level }}</span>
          </li>
        </ul>
      </div>
      <WaxSeal class="-mt-12" :size="88" icon="crown" />
      <button class="btn mt-8" @click="emit('done')">{{ T.toTitle }}</button>
    </div>
  </WarTable>
</template>
