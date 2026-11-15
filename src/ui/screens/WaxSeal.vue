<script setup lang="ts">
import { computed, useId } from 'vue';

/**
 * A wax seal (approved 3, restyled 6i): an uneven blob with a thick ink outline, a pressed ring and a letter or a pictogram.
 * Map seals (approved 5c): red = battle (crossed swords), black = elite (sword and star),
 * green = camp (tent), larger red = boss (crown).
 */
export type SealWax = 'red' | 'black' | 'green';
export type SealIcon = 'swords' | 'elite' | 'tent' | 'crown';

const props = withDefaults(defineProps<{ size?: number; letter?: string; wax?: SealWax; icon?: SealIcon }>(), { size: 72, letter: 'H', wax: 'red', icon: undefined });

/** Wax colours: highlight, body, shadow, and the pressed-in mark (dark + light rim). */
const WAX: Record<SealWax, { hi: string; mid: string; lo: string; press: string; rim: string }> = {
  red: { hi: '#ff7a62', mid: '#e0392a', lo: '#a8231a', press: '#8e1c13', rim: '#ffb3a3' },
  black: { hi: '#7d7670', mid: '#4a443e', lo: '#2a2622', press: '#1f1b18', rim: '#d6ccc0' },
  green: { hi: '#a6d36a', mid: '#5fa53a', lo: '#3c7322', press: '#2f5c1a', rim: '#d4f0a8' },
};

const gid = `wax-${useId()}`;
const c = computed(() => WAX[props.wax]);

/** One upright sword on the seal's grid: blade, guard, grip, pommel. */
const SWORD = 'M45.5 22 L50 15 L54.5 22 L54.5 58 L45.5 58 Z M36 58 L64 58 L64 64 L36 64 Z M47 64 L53 64 L53 76 L47 76 Z M50 76 a4 4 0 1 0 0.01 0 Z';

/** Pictograms pressed into the wax, drawn on the seal's 100 × 100 grid; each part may be turned about the centre. */
const ICONS: Record<SealIcon, { d: string; turn?: number }[]> = {
  swords: [
    { d: SWORD, turn: 42 },
    { d: SWORD, turn: -42 },
  ],
  // A short sword under a five-pointed star.
  elite: [
    { d: 'M46 48 L50 42 L54 48 L54 70 L46 70 Z M38 70 L62 70 L62 75 L38 75 Z M47.5 75 L52.5 75 L52.5 84 L47.5 84 Z' },
    { d: 'M50 12 L53.5 22 L64 22.3 L55.7 28.7 L58.8 39 L50 33 L41.2 39 L44.3 28.7 L36 22.3 L46.5 22 Z' },
  ],
  // A tent: a wide triangle with its door flap open and a pole tip.
  tent: [{ d: 'M48 20 L52 20 L52 28 L78 74 L22 74 L48 28 Z M50 44 L39 74 L61 74 Z' }, { d: 'M18 74 L82 74 L82 79 L18 79 Z' }],
  // A crown: band with three points, a ball on each.
  crown: [{ d: 'M24 68 L76 68 L76 77 L24 77 Z M24 65 L21 33 L37 50 L50 26 L63 50 L79 33 L76 65 Z M21 25 a5 5 0 1 0 0.01 0 Z M50 17 a5 5 0 1 0 0.01 0 Z M79 25 a5 5 0 1 0 0.01 0 Z' }],
};

// A fixed uneven outline: radius wobbles around the circle.
const blob = (() => {
  const pts: string[] = [];
  const n = 28;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 46 + Math.sin(a * 5 + 1.3) * 2.2 + Math.sin(a * 9 + 0.4) * 1.4 + Math.sin(a * 3) * 1.2;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
})();
</script>

<template>
  <svg :width="size" :height="size" viewBox="-3 -3 106 106" class="drop-shadow-[0_3px_0_#3b2414]">
    <defs>
      <radialGradient :id="gid" cx="40%" cy="35%" r="70%">
        <stop offset="0" :stop-color="c.hi" />
        <stop offset="0.55" :stop-color="c.mid" />
        <stop offset="1" :stop-color="c.lo" />
      </radialGradient>
    </defs>
    <path :d="blob" :fill="`url(#${gid})`" stroke="#3b2414" stroke-width="5" stroke-linejoin="round" />
    <path :d="blob" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3" transform="translate(50 50) scale(0.88) translate(-50 -50)" stroke-dasharray="40 400" stroke-dashoffset="-150" stroke-linecap="round" />
    <circle cx="50" cy="50" r="33" fill="none" :stroke="c.lo" stroke-width="4" opacity="0.8" />
    <circle cx="50" cy="50" r="33" fill="none" :stroke="c.rim" stroke-width="1.5" opacity="0.5" transform="translate(-1 -1)" />
    <g v-if="icon" transform="translate(50 50) scale(0.8) translate(-50 -50)">
      <g v-for="(part, i) in ICONS[icon]" :key="i" :transform="part.turn ? `rotate(${part.turn} 50 50)` : undefined">
        <path :d="part.d" :fill="c.rim" opacity="0.6" transform="translate(-1.6 -1.6)" />
        <path :d="part.d" :fill="c.press" />
      </g>
    </g>
    <text
      v-else
      x="50"
      y="51"
      text-anchor="middle"
      dominant-baseline="central"
      font-family="Lilita One, sans-serif"
      font-size="40"
      :fill="c.press"
      :stroke="c.rim"
      stroke-width="0.6"
      stroke-opacity="0.5"
      >{{ letter }}</text
    >
  </svg>
</template>
