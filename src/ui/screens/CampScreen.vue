<script setup lang="ts">
import { computed, ref } from 'vue';
import type { CampId } from '../../data/campaign';
import { STRINGS } from '../../data/strings';
import { campOffers, passCamp, recruit, type GameState } from '../../meta/game';
import { ROSTER_LIMIT } from '../../meta/squad';
import ClassMedallion from '../hud/ClassMedallion.vue';
import RecruitCard from './RecruitCard.vue';
import WarTable from './WarTable.vue';

/**
 * A camp (approved 5d): two recruit cards side by side on the war table, select one, then confirm.
 * The company sits underneath as a row of medallions. With a full roster nobody can join and the
 * player moves on (`passCamp`); otherwise one must be picked to open the camp's roads.
 */
const props = defineProps<{ game: GameState; campId: CampId }>();
const emit = defineEmits<{ done: []; back: [] }>();

const T = STRINGS.camp;

/** Drawn on the first visit and kept in the save, so a reload shows the same two. */
const offers = campOffers(props.game, props.campId);
const selected = ref<number | null>(null);

const roster = computed(() => props.game.squad.roster);
const full = computed(() => roster.value.length >= ROSTER_LIMIT);

function take(): void {
  if (selected.value === null) return;
  if (recruit(props.game, props.campId, selected.value)) emit('done');
}

function moveOn(): void {
  passCamp(props.game, props.campId);
  emit('done');
}
</script>

<template>
  <WarTable>
    <div class="flex flex-col items-center">
      <h2 class="table-title font-display text-3xl">{{ T.title }}</h2>
      <p class="mt-1 mb-5 max-w-xl text-center text-lg table-sub italic">{{ full ? T.full : T.hint }}</p>

      <div class="flex flex-wrap justify-center gap-10">
        <RecruitCard
          v-for="(c, i) in offers"
          :key="c.name"
          :character="c"
          :selected="selected === i"
          :disabled="full"
          @select="selected = selected === i ? null : i"
        />
      </div>

      <div class="mt-6 flex h-12 items-center">
        <button v-if="full" class="btn px-7 py-2.5 text-lg" @click="moveOn">{{ T.moveOn }}</button>
        <button v-else class="btn px-7 py-2.5 text-lg disabled:cursor-default disabled:opacity-50 disabled:filter-none" :disabled="selected === null" @click="take">
          {{ selected === null ? T.chooseFirst : T.take }}
        </button>
      </div>

      <div class="mt-3 flex flex-col items-center">
        <p class="font-black text-xs tracking-[0.12em] text-cream/60 uppercase">
          {{ T.company }} <span class="tabular-nums">({{ roster.length }} / {{ ROSTER_LIMIT }})</span>
        </p>
        <ul class="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-3">
          <li v-for="c in roster" :key="c.id" class="flex w-16 flex-col items-center gap-1">
            <ClassMedallion :class-id="c.classId" :size="34" />
            <span class="w-full truncate text-center text-sm text-cream/80" :class="{ 'font-bold': c.isHero }">{{ c.name }}</span>
          </li>
        </ul>
      </div>

      <button class="mt-4 link link-light text-lg" @click="emit('back')">
        {{ STRINGS.prep.back }}
      </button>
    </div>
  </WarTable>
</template>
