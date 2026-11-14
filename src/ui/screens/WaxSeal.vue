<script setup lang="ts">
/** A red wax seal (approved 3): an uneven blob with a pressed ring and a letter. */
withDefaults(defineProps<{ size?: number; letter?: string }>(), { size: 72, letter: 'H' });

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
  <svg :width="size" :height="size" viewBox="0 0 100 100" class="drop-shadow-[0_3px_3px_rgb(10_5_2/0.6)]">
    <defs>
      <radialGradient id="wax" cx="40%" cy="35%" r="70%">
        <stop offset="0" stop-color="#c9483a" />
        <stop offset="0.55" stop-color="#9b2d20" />
        <stop offset="1" stop-color="#5e170f" />
      </radialGradient>
    </defs>
    <path :d="blob" fill="url(#wax)" />
    <circle cx="50" cy="50" r="33" fill="none" stroke="#5e170f" stroke-width="3" opacity="0.7" />
    <circle cx="50" cy="50" r="33" fill="none" stroke="#e0705f" stroke-width="1" opacity="0.45" transform="translate(-0.8 -0.8)" />
    <text x="50" y="51" text-anchor="middle" dominant-baseline="central" font-family="Cinzel, serif" font-weight="700" font-size="34" fill="#6e1a11" stroke="#d65a49" stroke-width="0.6" stroke-opacity="0.5">{{ letter }}</text>
  </svg>
</template>
