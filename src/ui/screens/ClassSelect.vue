<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { STRINGS } from '../../data/strings';
import { HERO_KIT } from '../../sim/balance';
import type { PlayableClassId } from '../../sim/types';
import AbilityIcon from '../hud/AbilityIcon.vue';
import ClassMedallion from '../hud/ClassMedallion.vue';
import FigurePreview from './FigurePreview.vue';
import WarTable from './WarTable.vue';

/** Hero class select (approved 3b): medallion tabs, turning figure, role, abilities, name. */
const emit = defineEmits<{ choose: [heroClass: PlayableClassId, name: string]; back: [] }>();

const CLASSES: readonly PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];
const selected = ref<PlayableClassId>('krieger');
const name = ref<string>(STRINGS.heroNames.krieger);
const abilities = computed(() => HERO_KIT[selected.value]);

// Keep a typed name; replace the suggestion when the class changes.
watch(selected, (now, before) => {
  if (name.value.trim() === '' || name.value === STRINGS.heroNames[before]) name.value = STRINGS.heroNames[now];
});

function choose(): void {
  const n = name.value.trim();
  if (n) emit('choose', selected.value, n);
}
</script>

<template>
  <WarTable>
    <div class="flex w-[min(880px,94vw)] flex-col items-center">
      <h2 class="mb-5 font-display text-sm tracking-[0.35em] text-gold-light uppercase">{{ STRINGS.prep.chooseHero }}</h2>
      <div class="mb-[-22px] flex gap-6">
        <button v-for="c in CLASSES" :key="c" class="tab relative z-10 rounded-full" :class="{ 'is-on': c === selected }" :title="STRINGS.classes[c]" @click="selected = c">
          <ClassMedallion :class-id="c" :size="60" />
        </button>
      </div>
      <div class="parchment grid w-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 rounded-sm px-10 pt-12 pb-9">
        <FigurePreview :class-id="selected" class="h-[400px]" />
        <div class="flex flex-col justify-center">
          <h1 class="font-display text-4xl font-bold tracking-[0.12em]">{{ STRINGS.classes[selected] }}</h1>
          <p class="mt-2 text-xl italic text-ink-soft">{{ STRINGS.roles[selected] }}</p>
          <div class="rule my-5 w-full" />
          <ul class="space-y-3">
            <li v-for="(id, i) in abilities" :key="id" class="flex items-center gap-3">
              <div class="icon-tile relative size-11 shrink-0 rounded-[3px]">
                <AbilityIcon :id="id" class="absolute inset-1 text-gold-light" />
              </div>
              <span class="w-4 font-display text-xs text-ink-soft">{{ i === 0 ? 'Q' : 'E' }}</span>
              <span class="text-lg">{{ STRINGS.abilities[id] }}</span>
            </li>
          </ul>
          <div class="rule my-5 w-full" />
          <label class="flex items-baseline gap-4">
            <span class="font-display text-xs tracking-[0.2em] text-ink-soft uppercase">{{ STRINGS.prep.name }}</span>
            <input
              v-model="name"
              maxlength="16"
              class="min-w-0 flex-1 border-b border-ink-soft/60 bg-transparent pb-0.5 font-display text-2xl tracking-[0.06em] outline-none focus:border-gold"
              @keydown.enter="choose"
            />
          </label>
          <div class="mt-7 flex items-center justify-between">
            <button class="font-display text-xs tracking-[0.15em] text-ink-soft underline-offset-4 hover:underline" @click="emit('back')">{{ STRINGS.prep.back }}</button>
            <button class="btn-gold rounded-sm px-8 py-2.5 text-sm disabled:opacity-50" :disabled="!name.trim()" @click="choose">{{ STRINGS.prep.choose }}</button>
          </div>
        </div>
      </div>
    </div>
  </WarTable>
</template>

<style scoped>
.tab {
  transition: transform 120ms, filter 120ms;
  filter: brightness(0.7) saturate(0.7);
}
.tab:hover {
  filter: brightness(0.9);
}
.tab.is-on {
  transform: translateY(-4px) scale(1.08);
  filter: none;
  box-shadow: 0 0 18px rgb(224 191 106 / 0.6);
}
.icon-tile {
  background: radial-gradient(circle at 40% 35%, #4a321c, #24170c 75%);
  border: 1px solid var(--color-gold);
  box-shadow: 0 0 0 1px rgb(58 39 23 / 0.85);
}
</style>
