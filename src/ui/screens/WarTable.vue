<script setup lang="ts">
/** Backdrop of every 2D screen (approved 3): dark oak boards, warm candlelight, dark edges. */
</script>

<template>
  <div class="war-table fixed inset-0 overflow-auto font-body text-ink">
    <div class="candle pointer-events-none fixed inset-0" />
    <div class="vignette pointer-events-none fixed inset-0" />
    <div class="relative flex min-h-full items-center justify-center p-8">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.war-table {
  background-color: #2b190d;
  background-image:
    /* board seams every 150 px */
    repeating-linear-gradient(180deg, transparent 0 147px, rgb(10 5 2 / 0.75) 147px 149px, rgb(255 210 150 / 0.06) 149px 150px),
    /* wood grain: noise stretched along the boards */
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='2560' height='600'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.0035 0.11' numOctaves='3' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.06  0 0 0 0 0.02  0 0 0 1.1 -0.35'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>"),
    linear-gradient(180deg, #3a2213, #2a170b 60%, #24140a);
  background-size: auto, 2560px 600px, auto;
}
.candle {
  background: radial-gradient(ellipse 60% 55% at 50% 42%, rgb(255 168 72 / 0.2), rgb(255 140 50 / 0.06) 55%, transparent 75%);
  animation: flicker 5.3s infinite;
}
.vignette {
  background: radial-gradient(ellipse 85% 80% at 50% 45%, transparent 40%, rgb(6 3 1 / 0.88) 100%);
}
@keyframes flicker {
  0%, 100% { opacity: 1; }
  17% { opacity: 0.88; }
  23% { opacity: 0.97; }
  41% { opacity: 0.9; }
  58% { opacity: 1; }
  71% { opacity: 0.86; }
  79% { opacity: 0.95; }
}
@media (prefers-reduced-motion: reduce) {
  .candle { animation: none; }
}
</style>
