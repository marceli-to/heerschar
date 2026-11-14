<script setup lang="ts">
import type { DebugStats } from '../game/game';

defineProps<{ stats: DebugStats }>();
</script>

<template>
  <div
    v-if="stats.visible"
    class="pointer-events-none absolute top-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-xs leading-5 text-white"
  >
    <div>fps {{ stats.fps }}</div>
    <div>tick {{ stats.tick }}</div>
    <div>units {{ stats.units }}</div>
    <div>zoom {{ stats.zoom }}</div>
    <div>energy {{ stats.energy }}</div>
    <div>{{ stats.abilities }}</div>
    <div>lock {{ stats.lock ?? '-' }} · mark {{ stats.mark ?? '-' }}</div>
    <div class="text-white/60">F3: hide</div>
  </div>
</template>
