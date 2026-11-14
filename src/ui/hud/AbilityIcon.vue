<script setup lang="ts">
import { computed } from 'vue';
import type { HeroAbilityId } from '../../sim/types';

/** Gold line-art pictograms for the hero abilities (approved 2e), drawn on a 32 × 32 grid. */
const props = defineProps<{ id: HeroAbilityId }>();

/** An arrow from (x1, y1) to (x2, y2) with a head and fletching. */
function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const pt = (x: number, y: number, r: number, da: number) => `${(x + Math.cos(a + da) * r).toFixed(2)} ${(y + Math.sin(a + da) * r).toFixed(2)}`;
  const head = `M${pt(x2, y2, 4, Math.PI - 0.5)} L${x2} ${y2} L${pt(x2, y2, 4, Math.PI + 0.5)}`;
  const fletch = `M${pt(x1, y1, 3, -0.7)} L${x1} ${y1} L${pt(x1, y1, 3, 0.7)}`;
  return `M${x1} ${y1} L${x2} ${y2} ${head} ${fletch}`;
}

function snowflake(): string {
  let d = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    d += `M${16 - dx * 11} ${16 - dy * 11} L${16 + dx * 11} ${16 + dy * 11} `;
    for (const s of [-1, 1]) {
      const tx = 16 + s * dx * 7.5;
      const ty = 16 + s * dy * 7.5;
      for (const side of [-1, 1]) {
        const b = a + (s > 0 ? 0 : Math.PI) + side * 2.4;
        d += `M${tx} ${ty} L${(tx + Math.cos(b) * 3.5).toFixed(2)} ${(ty + Math.sin(b) * 3.5).toFixed(2)} `;
      }
    }
  }
  return d;
}

const PATHS: Record<HeroAbilityId, string> = {
  schildstoss: 'M13 6 L21 8.5 V15.5 C21 20.5 17.5 24 13 26 C8.5 24 5 20.5 5 15.5 V8.5 Z M13 11 V21 M25 10 L29 8 M26 16 L30 16 M25 22 L29 24',
  wirbel: 'M8.5 9 A10.5 10.5 0 1 1 6.5 21 M6.5 21 L5.5 15.8 M6.5 21 L11.5 19.5 M12 20 L20 12 M17.5 10.5 L21.5 14.5 M20 12 L22.5 9.5',
  salve: [arrow(6, 26, 14, 5), arrow(6, 26, 26, 6), arrow(6, 26, 27, 18)].join(' '),
  rueckzug: 'M27 23 Q18 4 7 17 M7 17 L7.5 11.5 M7 17 L12.5 16.5 M4 27 H28 M22 27 L20 24 M26 27 L24 24',
  heilkreis: 'M16 5 A11 11 0 1 1 15.99 5 M16 10.5 V21.5 M10.5 16 H21.5',
  segen: 'M5 25 A11 11 0 0 1 27 25 M3 25 H29 M16 11.5 V21 M12 15 H20',
  feuerball:
    'M16 4 C20 10 25 13 24 20 C23.5 25 20 28 16 28 C12 28 8.5 25 8 20 C7.5 15 11 13 12 8 C14 11 14 13 15.5 15 C17 12 17.5 8 16 4 Z M16 27 C13.5 27 12 25 12.5 22.5 C13 20.5 15 19.5 15.5 17.5 C17.5 19.5 20 21.5 19.5 24 C19 26 17.5 27 16 27',
  frostring: snowflake(),
  sammeln: 'M9 4 V28 M9 6 H25 L21 11 L25 16 H9 M6 28 H12',
};

const d = computed(() => PATHS[props.id]);
</script>

<template>
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path :d="d" />
  </svg>
</template>
