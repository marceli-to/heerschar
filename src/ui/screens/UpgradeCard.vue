<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { pathById, upgradeById, type PathId } from '../../data/upgrades';
import { effectLines } from '../../meta/describe';
import PictogramTile from '../PictogramTile.vue';

/**
 * An upgrade or path offer (approved Stage 4): parchment card with a pictogram tile on top, the
 * name in Cinzel, the kind in small italics, then what it does. Hover lifts.
 */
const props = defineProps<{ kind: 'upgrade' | 'path'; id: string }>();

const view = computed(() => {
  if (props.kind === 'path') {
    const p = pathById(props.id as PathId);
    const s = STRINGS.paths[p.id];
    return { icon: p.icon, name: s.name, kind: STRINGS.spoils.pathKind, text: s.text, lines: effectLines(p.signature) };
  }
  const u = upgradeById(props.id);
  return { icon: u.icon, name: STRINGS.upgrades[u.id] ?? u.id, kind: STRINGS.upgradeKinds[u.kind], text: null, lines: effectLines(u.effect) };
});
</script>

<template>
  <button class="card parchment flex w-64 flex-col items-center rounded-sm px-6 pt-7 pb-6 text-center">
    <PictogramTile :name="view.icon" :size="68" />
    <h3 class="mt-4 font-display text-xl leading-tight font-bold tracking-[0.06em]">{{ view.name }}</h3>
    <p class="text-sm text-ink-soft italic">{{ view.kind }}</p>
    <div class="rule my-3 w-3/4" />
    <p v-if="view.text" class="mb-2 text-base leading-snug italic">{{ view.text }}</p>
    <ul class="text-base leading-snug">
      <li v-for="l in view.lines" :key="l">{{ l }}</li>
    </ul>
  </button>
</template>

<style scoped>
.card {
  transition: transform 140ms, box-shadow 140ms;
}
.card:hover,
.card:focus-visible {
  transform: translateY(-6px);
  box-shadow:
    inset 0 0 28px rgb(120 80 30 / 0.35),
    0 18px 36px rgb(5 2 1 / 0.6);
}
</style>
