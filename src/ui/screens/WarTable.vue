<script setup lang="ts">
/** Backdrop of every 2D screen (approved 3, restyled 6i): a flat, chunky war table — bold planks, simple shading, warm light. */
</script>

<template>
  <div class="war-table fixed inset-0 overflow-auto font-body text-ink">
    <div class="candle pointer-events-none fixed inset-0" />
    <div class="vignette pointer-events-none fixed inset-0" />
    <div class="relative flex min-h-full items-center justify-center p-6">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.war-table {
  background-color: #7a4626;
  background-image:
    /* plank seams every 120 px: dark gap, then a light top edge */
    repeating-linear-gradient(180deg, #3b2414 0 4px, #a8693d 4px 7px, transparent 7px 120px),
    /* alternate planks a shade darker */
    repeating-linear-gradient(180deg, transparent 0 120px, rgb(40 18 6 / 0.14) 120px 240px),
    /* a few flat grain strokes */
    repeating-linear-gradient(180deg, transparent 0 38px, rgb(59 36 20 / 0.12) 38px 41px, transparent 41px 83px, rgb(59 36 20 / 0.08) 83px 85px, transparent 85px 120px),
    linear-gradient(180deg, #84502c, #6e3f21);
}
.candle {
  background: radial-gradient(ellipse 60% 55% at 50% 42%, rgb(255 200 110 / 0.22), rgb(255 170 80 / 0.06) 55%, transparent 75%);
  animation: flicker 5.3s infinite;
}
.vignette {
  background: radial-gradient(ellipse 90% 85% at 50% 45%, transparent 50%, rgb(40 18 6 / 0.6) 100%);
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
