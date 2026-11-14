<script setup lang="ts">
/** A small parchment note above its element while hovered (names and effect lines on the sheet). */
defineProps<{ disabled?: boolean }>();
</script>

<template>
  <div class="has-note relative">
    <slot />
    <div v-if="!disabled" class="note parchment pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-64 rounded-sm px-3 py-2 text-center">
      <slot name="note" />
    </div>
  </div>
</template>

<style scoped>
.note {
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 120ms, transform 120ms;
  outline: none;
  box-shadow:
    inset 0 0 14px rgb(120 80 30 / 0.3),
    0 6px 18px rgb(20 12 4 / 0.45);
}
.has-note:hover > .note {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
