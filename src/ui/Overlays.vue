<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HudState } from '../game/game';
import { STRINGS } from '../data/strings';
import EndLedger from './EndLedger.vue';
import TitledPanel from './TitledPanel.vue';
import SettingsSheet from './settings/SettingsSheet.vue';
import { controlKeys } from '../settings/settings';
import { settings } from '../settings/store';

const props = defineProps<{ hud: HudState; canLeave?: boolean }>();
const emit = defineEmits<{ takeControl: []; restart: []; leave: []; changeSquad: [] }>();

const copy = computed(() => (props.hud.mode === 'trial' ? STRINGS.trial : STRINGS.squad));
/** The controls with the current key bindings, and the hero's own ability names on the abilities row. */
const controls = computed(() => {
  const [q, e] = props.hud.mode === 'squad' ? props.hud.abilities : [];
  return copy.value.controls.map(([row, action]) => [
    controlKeys(row, settings.keys),
    row === 'abilities' && q && e ? `${STRINGS.abilities[q.id]} · ${STRINGS.abilities[e.id]}` : action,
  ]);
});
const showSettings = ref(false);

// The sheet closes when the battle resumes (it only opens from the pause panel).
watch(
  () => props.hud.phase,
  (p) => {
    if (p !== 'paused') showSettings.value = false;
  },
);

const endText = computed(() => {
  if (props.hud.mode === 'trial') return props.hud.outcome === 'won' ? STRINGS.victoryText : STRINGS.defeatText;
  return props.hud.outcome === 'won' ? STRINGS.squad.victoryText : STRINGS.squad.defeatText;
});

const time = computed(() => {
  const s = Math.floor(props.hud.time);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
</script>

<template>
  <div
    v-if="hud.phase !== 'playing'"
    class="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(20_10_4/0.3),rgb(20_10_4/0.65))]"
  >
    <TitledPanel v-if="hud.phase === 'intro'" :title="hud.title" :subtitle="STRINGS.title">
      <p class="text-lg leading-snug font-bold text-ink-soft">{{ hud.intro }}</p>
      <table class="mx-auto mt-5 text-left text-base">
        <tr v-for="[key, action] in controls" :key="key">
          <td class="pr-5 py-0.5 font-display text-sm whitespace-nowrap text-ink-soft">{{ key }}</td>
          <td class="py-0.5 font-bold">{{ action }}</td>
        </tr>
      </table>
      <button class="btn mt-6 px-8 py-2.5 text-xl" @click="emit('takeControl')">
        {{ copy.begin }}
      </button>
    </TitledPanel>

    <SettingsSheet v-else-if="hud.phase === 'paused' && showSettings" @done="showSettings = false" />

    <TitledPanel v-else-if="hud.phase === 'paused'" :title="STRINGS.paused">
      <div class="flex flex-col items-center gap-3">
        <button class="btn w-60 py-2.5 text-xl" @click="emit('takeControl')">{{ STRINGS.resume }}</button>
        <button class="btn btn-yellow w-60 py-2 text-lg" @click="showSettings = true">{{ STRINGS.settings.open }}</button>
        <button v-if="canLeave" class="btn btn-blue w-60 py-2 text-lg" @click="emit('leave')">{{ STRINGS.prep.leave }}</button>
      </div>
    </TitledPanel>

    <TitledPanel
      v-else-if="hud.phase === 'ended'"
      :title="hud.outcome === 'won' ? STRINGS.victory : STRINGS.defeat"
      :subtitle="`${STRINGS.time} ${time}`"
    >
      <p class="text-lg font-bold text-ink-soft">{{ endText }}</p>
      <EndLedger v-if="hud.mode === 'squad' && hud.ledger.length" :rows="hud.ledger" class="mt-4" />
      <button class="btn mt-6 px-8 py-2.5 text-xl" @click="emit('restart')">{{ STRINGS.restart }}</button>
      <p class="mt-2 text-sm text-ink-soft">{{ STRINGS.restartHint }}</p>
      <div v-if="canLeave" class="mt-5 flex justify-center gap-3">
        <button class="btn btn-yellow px-5 py-2 text-base whitespace-nowrap" @click="emit('changeSquad')">{{ STRINGS.prep.changeSquad }}</button>
        <button class="btn btn-blue px-5 py-2 text-base whitespace-nowrap" @click="emit('leave')">{{ STRINGS.prep.leave }}</button>
      </div>
    </TitledPanel>
  </div>
</template>
