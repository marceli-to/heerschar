<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { pathById, upgradeById, type PathId } from '../../data/upgrades';
import { effectChanges, effectLines } from '../../meta/describe';
import type { Character } from '../../meta/squad';
import PictogramTile from '../PictogramTile.vue';

/**
 * An upgrade or path offer (Spoils redesign A, Marcel 2026-11-15): pictogram tile, name, kind with
 * how many of it the character has, the effect as the big line, then what it changes for this
 * character ("Range 9 → 11 m"). A number key picks it. Hover lifts.
 */
const props = defineProps<{ kind: 'upgrade' | 'path'; id: string; character: Character; hotkey: number }>();

const view = computed(() => {
  const c = props.character;
  if (props.kind === 'path') {
    const p = pathById(props.id as PathId);
    const s = STRINGS.paths[p.id];
    return { icon: p.icon, name: s.name, kind: STRINGS.spoils.pathKind, stack: null, text: s.text, lines: effectLines(p.signature), changes: effectChanges(c, p.signature) };
  }
  const u = upgradeById(props.id);
  const taken = c.upgrades.filter((x) => x === u.id).length;
  const stack = u.max > 1 ? STRINGS.spoils.stack(taken, u.max) : null;
  return { icon: u.icon, name: STRINGS.upgrades[u.id] ?? u.id, kind: STRINGS.upgradeKinds[u.kind], stack, text: null, lines: effectLines(u.effect), changes: effectChanges(c, u.effect) };
});
</script>

<template>
  <button class="card panel relative flex w-60 flex-col items-center px-5 pt-6 pb-7 text-center">
    <PictogramTile :name="view.icon" :size="64" />
    <h3 class="heading-3 mt-3 text-balance">{{ view.name }}</h3>
    <p class="label">
      {{ view.kind }}<template v-if="view.stack"> · {{ view.stack }}</template>
    </p>
    <ul role="list" class="mt-3 flex flex-col gap-0.5">
      <li v-for="l in view.lines" :key="l" class="font-display text-xl leading-tight text-balance text-ink">{{ l }}</li>
    </ul>
    <p v-if="view.text" class="note mt-2 text-pretty">{{ view.text }}</p>
    <div class="min-h-4 flex-1" />
    <dl v-if="view.changes.length" class="well mt-auto grid w-full grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left">
      <template v-for="ch in view.changes" :key="ch.label">
        <dt class="label">{{ ch.label }}</dt>
        <dd class="text-right font-display tabular-nums">
          <span class="text-ink-soft">{{ ch.from }}</span>
          <span class="mx-1 text-ink-soft">→</span>
          <span class="text-leaf">{{ ch.to }}</span>
        </dd>
      </template>
    </dl>
    <span class="key coin absolute -bottom-3.5 left-1/2 -translate-x-1/2 font-display text-base text-ink" aria-hidden="true">{{ hotkey }}</span>
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
    inset 0 2px 0 var(--color-cream-hi),
    inset 0 -4px 0 var(--color-cream-lo),
    0 10px 0 var(--color-ink),
    0 22px 30px rgb(20 10 4 / 0.45);
}
.key {
  min-width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  line-height: 1;
}
</style>
