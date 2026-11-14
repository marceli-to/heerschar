<script setup lang="ts">
import { computed } from 'vue';
import { STRINGS } from '../../data/strings';
import { pathById, upgradeById } from '../../data/upgrades';
import { effectLines, upgradeTally } from '../../meta/describe';
import type { Character } from '../../meta/squad';
import PictogramTile from '../PictogramTile.vue';
import HoverNote from './HoverNote.vue';

/** A character's path (tile + name) and upgrades (small tiles, ×n badges), each with a hover note. */
const props = withDefaults(defineProps<{ character: Character; tile?: number }>(), { tile: 28 });

const T = STRINGS.squadStep;

const path = computed(() => {
  const id = props.character.path;
  if (!id) return null;
  return { icon: pathById(id).icon, name: STRINGS.paths[id].name, text: STRINGS.paths[id].text };
});

const upgrades = computed(() =>
  upgradeTally(props.character.upgrades).map(({ id, count }) => {
    const u = upgradeById(id);
    return { id, count, icon: u.icon, name: STRINGS.upgrades[id] ?? id, kind: STRINGS.upgradeKinds[u.kind], lines: effectLines(u.effect) };
  }),
);
</script>

<template>
  <div class="flex min-h-9 flex-wrap items-center gap-1.5">
    <HoverNote v-if="path" class="mr-2">
      <div class="flex items-center gap-2">
        <PictogramTile :name="path.icon" :size="tile + 6" />
        <span class="font-display text-sm tracking-[0.06em]">{{ path.name }}</span>
      </div>
      <template #note>
        <p class="font-display text-sm tracking-[0.06em]">{{ path.name }}</p>
        <p class="text-[11px] italic text-ink-soft">{{ T.pathNote }}</p>
        <p class="text-sm leading-snug">{{ path.text }}</p>
      </template>
    </HoverNote>
    <HoverNote v-for="u in upgrades" :key="u.id">
      <div class="relative">
        <PictogramTile :name="u.icon" :size="tile" />
        <span v-if="u.count > 1" class="badge absolute -right-1.5 -bottom-1.5 rounded-full px-1 font-display text-[10px] leading-4 tabular-nums">×{{ u.count }}</span>
      </div>
      <template #note>
        <p class="font-display text-sm tracking-[0.06em]">{{ u.name }}<template v-if="u.count > 1"> ×{{ u.count }}</template></p>
        <p class="text-[11px] italic text-ink-soft">{{ u.kind }}</p>
        <p v-for="l in u.lines" :key="l" class="text-sm leading-snug">{{ l }}<template v-if="u.count > 1"> ({{ T.each }})</template></p>
      </template>
    </HoverNote>
    <span v-if="!path && upgrades.length === 0" class="italic text-ink-soft/80">{{ T.noUpgrades }}</span>
  </div>
</template>

<style scoped>
.badge {
  color: var(--color-parchment);
  background: var(--color-ink);
  border: 1px solid var(--color-gold);
}
</style>
