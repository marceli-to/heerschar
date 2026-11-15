<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HudState } from '../game/game';
import { STRINGS } from '../data/strings';
import EndLedger from './EndLedger.vue';
import ParchmentPanel from './ParchmentPanel.vue';
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
    class="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgb(20_12_4/0.25),rgb(20_12_4/0.65))]"
  >
    <ParchmentPanel v-if="hud.phase === 'intro'" :title="hud.title" :subtitle="STRINGS.title">
      <p class="text-lg leading-snug italic">{{ hud.intro }}</p>
      <table class="mx-auto mt-5 text-left text-base">
        <tr v-for="[key, action] in controls" :key="key">
          <td class="pr-5 py-0.5 font-display text-xs tracking-[0.15em] whitespace-nowrap text-ink-soft">{{ key }}</td>
          <td class="py-0.5">{{ action }}</td>
        </tr>
      </table>
      <button class="btn-gold mt-6 rounded-sm px-7 py-2.5 text-sm" @click="emit('takeControl')">
        {{ copy.begin }}
      </button>
    </ParchmentPanel>

    <SettingsSheet v-else-if="hud.phase === 'paused' && showSettings" @done="showSettings = false" />

    <ParchmentPanel v-else-if="hud.phase === 'paused'" :title="STRINGS.paused">
      <button class="btn-gold rounded-sm px-7 py-2.5 text-sm" @click="emit('takeControl')">{{ STRINGS.resume }}</button>
      <button class="btn-gold mt-4 block mx-auto rounded-sm px-6 py-2 text-xs" @click="showSettings = true">{{ STRINGS.settings.open }}</button>
      <button v-if="canLeave" class="mt-4 block w-full font-display text-xs tracking-[0.15em] text-ink-soft underline-offset-4 hover:underline" @click="emit('leave')">{{ STRINGS.prep.leave }}</button>
    </ParchmentPanel>

    <ParchmentPanel
      v-else-if="hud.phase === 'ended'"
      :title="hud.outcome === 'won' ? STRINGS.victory : STRINGS.defeat"
      :subtitle="`${STRINGS.time} ${time}`"
    >
      <p class="text-lg italic">{{ endText }}</p>
      <EndLedger v-if="hud.mode === 'squad' && hud.ledger.length" :rows="hud.ledger" class="mt-4" />
      <button class="btn-gold mt-6 rounded-sm px-7 py-2.5 text-sm" @click="emit('restart')">{{ STRINGS.restart }}</button>
      <p class="mt-2 text-sm text-ink-soft italic">{{ STRINGS.restartHint }}</p>
      <div v-if="canLeave" class="mt-5 flex justify-center gap-3">
        <button class="btn-gold rounded-sm px-5 py-2.5 text-sm whitespace-nowrap" @click="emit('changeSquad')">{{ STRINGS.prep.changeSquad }}</button>
        <button class="btn-gold rounded-sm px-5 py-2.5 text-sm whitespace-nowrap" @click="emit('leave')">{{ STRINGS.prep.leave }}</button>
      </div>
    </ParchmentPanel>
  </div>
</template>
