<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { STRINGS } from '../../data/strings';
import { HERO_KIT } from '../../sim/balance';
import type { PlayableClassId } from '../../sim/types';
import AbilityIcon from '../hud/AbilityIcon.vue';
import ClassMedallion from '../hud/ClassMedallion.vue';
import FigurePreview from './FigurePreview.vue';
import WarTable from './WarTable.vue';
import { keyLabel } from '../../settings/settings';
import { settings } from '../../settings/store';

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
      <h2 class="mb-5 table-title font-display text-3xl">{{ STRINGS.prep.chooseHero }}</h2>
      <div class="mb-[-22px] flex gap-6">
        <button v-for="c in CLASSES" :key="c" class="tab relative z-10 rounded-full" :class="{ 'is-on': c === selected }" :title="STRINGS.classes[c]" @click="selected = c">
          <ClassMedallion :class-id="c" :size="60" />
        </button>
      </div>
      <div class="panel grid w-full grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 px-10 pt-12 pb-9">
        <FigurePreview :class-id="selected" class="h-[400px]" />
        <div class="flex flex-col justify-center">
          <h1 class="font-display text-4xl">{{ STRINGS.classes[selected] }}</h1>
          <p class="mt-1 text-xl text-ink-soft">{{ STRINGS.roles[selected] }}</p>
          <div class="rule my-5 w-full" />
          <ul class="space-y-3">
            <li v-for="(id, i) in abilities" :key="id" class="flex items-center gap-3">
              <div class="wood-tile relative size-12 shrink-0">
                <AbilityIcon :id="id" class="absolute inset-1.5" />
              </div>
              <span class="min-w-5 font-display text-base text-ink-soft">{{ keyLabel(i === 0 ? settings.keys.ability1 : settings.keys.ability2) }}</span>
              <span class="font-display text-xl">{{ STRINGS.abilities[id] }}</span>
            </li>
          </ul>
          <div class="rule my-5 w-full" />
          <label class="flex items-center gap-4">
            <span class="font-black text-xs tracking-[0.12em] text-ink-soft uppercase">{{ STRINGS.prep.name }}</span>
            <input
              v-model="name"
              maxlength="16"
              class="field min-w-0 flex-1 px-3 py-1 font-display text-2xl"
              @keydown.enter="choose"
            />
          </label>
          <div class="mt-7 flex items-center justify-between">
            <button class="link text-lg" @click="emit('back')">{{ STRINGS.prep.back }}</button>
            <button class="btn px-8 py-2.5 text-lg disabled:opacity-50" :disabled="!name.trim()" @click="choose">{{ STRINGS.prep.choose }}</button>
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
  border-radius: 99px;
  box-shadow: 0 0 20px 4px rgb(255 214 110 / 0.7);
}

</style>
