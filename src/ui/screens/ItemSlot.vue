<script setup lang="ts">
import { STRINGS } from '../../data/strings';

/** An equipment slot (approved 3c): dashed frame with a faint sword or amulet. Items arrive in Stage 4. */
defineProps<{ kind: 'weapon' | 'trinket'; item: string | null }>();

const ICONS = {
  // sword pointing up: blade, guard, grip, pommel
  weapon: 'M16 3 L18 6 V19 H14 V6 Z M9 19 H23 M16 19 V26 M16 28.5 m-1.6 0 a1.6 1.6 0 1 0 3.2 0 a1.6 1.6 0 1 0 -3.2 0',
  // amulet on a chain
  trinket: 'M7 4 Q16 16 25 4 M16 13 V15 M16 15 L22.5 21.5 L16 28 L9.5 21.5 Z M16 18.5 L19 21.5 L16 24.5 L13 21.5 Z',
} as const;
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div class="slot flex size-14 items-center justify-center rounded-[3px]">
      <svg v-if="!item" viewBox="0 0 32 32" class="size-9 opacity-35" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">
        <path :d="ICONS[kind]" />
      </svg>
    </div>
    <span class="font-display text-[10px] tracking-[0.2em] text-ink-soft uppercase">{{ STRINGS.squadStep[kind] }}</span>
    <span class="-mt-1 text-sm italic text-ink-soft/80">{{ item ?? STRINGS.squadStep.empty }}</span>
  </div>
</template>

<style scoped>
.slot {
  color: var(--color-ink-soft);
  border: 1.5px dashed rgb(185 138 46 / 0.75);
  background: rgb(120 80 30 / 0.08);
}
</style>
