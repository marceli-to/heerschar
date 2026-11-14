<script setup lang="ts">
import { computed } from 'vue';
import type { ItemIcon } from '../data/items';
import type { UpgradeIcon } from '../data/upgrades';

/**
 * Gold line-art pictograms for upgrades, paths and items, in the style of the ability tiles
 * (approved 2e / Stage 4), drawn on a 32 × 32 grid.
 */
const props = defineProps<{ name: UpgradeIcon | ItemIcon }>();

const f = (n: number) => n.toFixed(2);

/** A circle as a path. */
function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)} ${f(cy)} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 `;
}

/** A closed star with `n` points alternating between radius `r1` and `r2`. */
function star(cx: number, cy: number, n: number, r1: number, r2: number, turn = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = turn + (i * Math.PI) / n;
    const r = i % 2 ? r2 : r1;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)} `;
  }
  return `${d}Z `;
}

/** Rays around a centre, from radius `r1` to `r2`. */
function rays(cx: number, cy: number, n: number, r1: number, r2: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    d += `M${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)} L${f(cx + Math.cos(a) * r2)} ${f(cy + Math.sin(a) * r2)} `;
  }
  return d;
}

/** An arrow from (x1, y1) to (x2, y2) with a head and fletching (as on the ability tiles). */
function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const pt = (x: number, y: number, r: number, da: number) => `${f(x + Math.cos(a + da) * r)} ${f(y + Math.sin(a + da) * r)}`;
  return `M${x1} ${y1} L${x2} ${y2} M${pt(x2, y2, 4.5, Math.PI - 0.5)} L${x2} ${y2} L${pt(x2, y2, 4.5, Math.PI + 0.5)} M${pt(x1, y1, 3.5, -0.7)} L${x1} ${y1} L${pt(x1, y1, 3.5, 0.7)}`;
}

function snowflake(): string {
  let d = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    d += `M${f(16 - dx * 11)} ${f(16 - dy * 11)} L${f(16 + dx * 11)} ${f(16 + dy * 11)} `;
    for (const s of [-1, 1]) {
      const tx = 16 + s * dx * 7.5;
      const ty = 16 + s * dy * 7.5;
      for (const side of [-1, 1]) {
        const b = a + (s > 0 ? 0 : Math.PI) + side * 2.4;
        d += `M${f(tx)} ${f(ty)} L${f(tx + Math.cos(b) * 3.5)} ${f(ty + Math.sin(b) * 3.5)} `;
      }
    }
  }
  return d;
}

const PATHS: Record<UpgradeIcon | ItemIcon, string> = {
  heart: 'M16 27 C7 20.5 4 15 4 10.8 C4 7.2 6.6 5 9.6 5 C12.4 5 14.6 6.8 16 9.4 C17.4 6.8 19.6 5 22.4 5 C25.4 5 28 7.2 28 10.8 C28 15 25 20.5 16 27 Z',
  // a clenched gauntlet: four knuckles, thumb across, cuff below
  fist: 'M9 13 C9 10.5 10.5 9.5 12.5 10 V14 M12.5 10 C12.5 7.5 16 7.5 16 10 V14 M16 10 C16 7.5 19.5 7.5 19.5 10 V14 M19.5 10.5 C19.5 8.5 23 8.5 23 11 V18 C23 21.5 21 23.5 17.5 23.5 H14 C11 23.5 9 21.5 9 18.5 Z M9 16 H15.5 C17 16 17.5 18 16 18.5 M11.5 23.5 V28 H20.5 V23.5',
  shield: 'M16 4 L26 7.5 V15 C26 21 22 25.5 16 28 C10 25.5 6 21 6 15 V7.5 Z M16 8.5 V24 M10 13.5 H22',
  // a curved war horn with its mouth and sound
  horn: 'M4 8.5 L5.5 5 C14 6.5 22.5 12 28.5 20.5 L22 27 C18.5 18.5 12.5 11.5 4 8.5 Z M10.5 6.8 L9 10.6 M18 10.5 L15.2 14.6 M22 27 C24 28.5 29.5 23 28.5 20.5',
  drop: 'M16 4 C16 4 7 15 7 20 C7 25 11 28 16 28 C21 28 25 25 25 20 C25 15 16 4 16 4 Z M11.5 20.5 C11.5 22.5 12.8 24 14.8 24.6',
  boot: 'M10 4 H17.5 V17 L24.5 19.5 C26.8 20.3 28 22.2 28 24.5 V27 H8 V22.5 L10 19.5 Z M8 23 H28 M10 8.5 H17.5 M17.5 12.5 L20 12.5',
  eye: `M3 16 C8 8 24 8 29 16 C24 24 8 24 3 16 Z ${circle(16, 16, 4.5)}${circle(16, 16, 1.2)}`,
  arrow: arrow(5, 27, 27, 5),
  bow: 'M10 4 Q27 16 10 28 M10 4 V28 M7 16 H25 M25 16 L21.5 13 M25 16 L21.5 19 M7 16 L5 13.5 M7 16 L5 18.5',
  cross: 'M13 5 H19 V13 H27 V19 H19 V27 H13 V19 H5 V13 H13 Z',
  sun: `${circle(16, 16, 5.5)}${rays(16, 16, 8, 8.5, 13)}`,
  hourglass: 'M8 4 H24 M8 28 H24 M10 4 C10 11 15.5 13 15.5 16 C15.5 19 10 21 10 28 M22 4 C22 11 16.5 13 16.5 16 C16.5 19 22 21 22 28 M12.5 25.5 Q16 21.5 19.5 25.5 Z M13 9 H19',
  flame:
    'M16 4 C20 10 25 13 24 20 C23.5 25 20 28 16 28 C12 28 8.5 25 8 20 C7.5 15 11 13 12 8 C14 11 14 13 15.5 15 C17 12 17.5 8 16 4 Z M16 27 C13.5 27 12 25 12.5 22.5 C13 20.5 15 19.5 15.5 17.5 C17.5 19.5 20 21.5 19.5 24 C19 26 17.5 27 16 27',
  snow: snowflake(),
  star: star(16, 16.5, 5, 12, 5),
  burst: `${star(16, 16, 8, 13, 6, -Math.PI / 2)}${circle(16, 16, 2.5)}`,
  // items
  sword: `M16 3 L18.5 6 V19.5 H13.5 V6 Z M16 7.5 V17 M9 19.5 H23 M16 19.5 V25.5 ${circle(16, 27.5, 1.8)}`,
  staff: `M9 29 L18.5 10.5 ${circle(20.5, 7, 3.8)}M13 22 L16.5 23.5 M17 7 C14.5 9 14.5 11.5 16 13`,
  wand: 'M6 27 L19 14 M8 29 L4 25 M17.5 12.5 L20.5 15.5 M24 4 V12 M20 8 H28 M21.2 5.2 L26.8 10.8 M26.8 5.2 L21.2 10.8',
  ring: `${circle(16, 20, 8)}${circle(16, 20, 5.5)}M12.5 12.5 L14 8 H18 L19.5 12.5 L16 14.5 Z M14 8 L16 10.5 L18 8`,
  amulet: 'M7 4 Q16 16 25 4 M16 13 V15 M16 15 L22.5 21.5 L16 28 L9.5 21.5 Z M16 18.5 L19 21.5 L16 24.5 L13 21.5 Z',
  // a fang on a cord
  charm: 'M7 4 Q16 13 25 4 M16 9 V12 M12 12 H20 C20 19 18.5 24 16 28.5 C13.5 24 12 19 12 12 Z M14 16 C14.5 20 15 22 16 24',
  coin: `${circle(16, 16, 12)}${circle(16, 16, 9)}${star(16, 16.5, 5, 5.5, 2.3)}`,
  feather: 'M25 4 C13 7 8 17 8 26 M25 4 C27 14 19 22 8 26 M8 26 L4.5 29.5 M12 19.5 L17 18 M10.5 23 L15 22.5 M15 13.5 L20.5 11.5 M19 8.5 L23 7.5',
};

const d = computed(() => PATHS[props.name]);
</script>

<template>
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <path :d="d" />
  </svg>
</template>
