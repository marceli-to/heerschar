<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { characterStats } from '../../meta/progression';
import type { Character } from '../../meta/squad';
import FigurePreview from './FigurePreview.vue';
import PathUpgrades from './PathUpgrades.vue';

/**
 * A recruit at a camp (approved 5d): tall panel card with the turning figure, name, class and
 * level, path and upgrades, and the stats as fought. Clicking selects it (gold frame); the camp
 * screen confirms.
 */
const props = defineProps<{ character: Character; selected: boolean; disabled?: boolean }>();
const emit = defineEmits<{ select: [] }>();

const T = STRINGS.squadStep;

const lines = computed(() => {
  const s = characterStats(props.character);
  return [
    { label: T.stats.maxHp, value: s.maxHp.toFixed(0) },
    { label: T.stats.power, value: s.power.toFixed(0) },
    { label: T.stats.armor, value: s.armor.toFixed(0) },
    { label: T.stats.resist, value: s.resist.toFixed(0) },
    { label: T.stats.range, value: s.range < 3 ? T.melee : `${s.range.toFixed(0)} ${T.metres}` },
    { label: T.stats.attackInterval, value: T.every(s.attackInterval.toFixed(1)) },
  ];
});
</script>

<template>
  <div
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-pressed="selected"
    :aria-disabled="disabled"
    class="card panel flex w-80 flex-col items-center px-7 pt-2 pb-5 text-center"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    @click="!disabled && emit('select')"
    @keydown.enter.prevent="!disabled && emit('select')"
    @keydown.space.prevent="!disabled && emit('select')"
  >
    <FigurePreview :class-id="character.classId" :hero="false" class="h-32 w-full" />
    <h3 class="heading-2">{{ character.name }}</h3>
    <p class="text-lg text-ink-soft">{{ STRINGS.classes[character.classId] }} · {{ T.level }} {{ character.level }}</p>
    <div class="rule my-3 w-full" />
    <PathUpgrades :character="character" class="justify-center" />
    <dl class="mt-auto grid w-full grid-cols-[auto_1fr] gap-x-6 pt-3 text-base">
      <template v-for="l in lines" :key="l.label">
        <dt class="label text-left leading-6">{{ l.label }}</dt>
        <dd class="text-right font-display text-lg leading-6 tabular-nums">{{ l.value }}</dd>
      </template>
    </dl>
  </div>
</template>

<style scoped>
.card {
  cursor: pointer;
  transition: transform 140ms, box-shadow 140ms;
}
.card:hover:not(.is-disabled),
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow:
    inset 0 2px 0 var(--color-cream-hi),
    inset 0 -4px 0 var(--color-cream-lo),
    0 10px 0 var(--color-ink),
    0 22px 30px rgb(20 10 4 / 0.45);
}
.card.is-selected {
  transform: translateY(-6px);
  background: linear-gradient(#fff3c4, #f6cf73);
  box-shadow:
    inset 0 0 0 3px var(--color-gold-light),
    0 10px 0 var(--color-ink),
    0 0 0 6px rgb(255 214 110 / 0.5),
    0 22px 30px rgb(20 10 4 / 0.45);
}
.card.is-disabled {
  cursor: default;
  opacity: 0.7;
}
</style>
