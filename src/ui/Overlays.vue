<script setup lang="ts">
import { computed } from 'vue';
import type { HudState } from '../game/game';
import { STRINGS } from '../data/strings';
import ParchmentPanel from './ParchmentPanel.vue';

const props = defineProps<{ hud: HudState }>();
const emit = defineEmits<{ takeControl: []; restart: [] }>();

const copy = computed(() => (props.hud.mode === 'trial' ? STRINGS.trial : STRINGS.squad));
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
    <ParchmentPanel v-if="hud.phase === 'intro'" :title="copy.name" :subtitle="STRINGS.title">
      <p class="text-lg leading-snug italic">{{ copy.intro }}</p>
      <table class="mx-auto mt-5 text-left text-base">
        <tr v-for="[key, action] in copy.controls" :key="key">
          <td class="pr-5 py-0.5 font-display text-xs tracking-[0.15em] whitespace-nowrap text-ink-soft">{{ key }}</td>
          <td class="py-0.5">{{ action }}</td>
        </tr>
      </table>
      <button class="btn-gold mt-6 rounded-sm px-7 py-2.5 text-sm" @click="emit('takeControl')">
        {{ copy.begin }}
      </button>
    </ParchmentPanel>

    <ParchmentPanel v-else-if="hud.phase === 'paused'" :title="STRINGS.paused">
      <button class="btn-gold rounded-sm px-7 py-2.5 text-sm" @click="emit('takeControl')">{{ STRINGS.resume }}</button>
    </ParchmentPanel>

    <ParchmentPanel
      v-else-if="hud.phase === 'ended'"
      :title="hud.outcome === 'won' ? STRINGS.victory : STRINGS.defeat"
      :subtitle="`${STRINGS.time} ${time}`"
    >
      <p class="text-lg italic">{{ endText }}</p>
      <button class="btn-gold mt-6 rounded-sm px-7 py-2.5 text-sm" @click="emit('restart')">{{ STRINGS.restart }}</button>
      <p class="mt-2 text-sm text-ink-soft italic">{{ STRINGS.restartHint }}</p>
    </ParchmentPanel>
  </div>
</template>
