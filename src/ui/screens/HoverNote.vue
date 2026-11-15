<script setup lang="ts">
/** A small panel note above (or below) its element while hovered (names and effect lines on the sheet). */
defineProps<{ disabled?: boolean; below?: boolean }>();
</script>

<template>
  <div class="has-note relative">
    <slot />
    <div
      v-if="!disabled"
      class="tip plate pointer-events-none absolute left-1/2 z-20 w-max max-w-64 px-3 py-2 text-center"
      :class="below ? 'top-full mt-2' : 'bottom-full mb-2'"
    >
      <slot name="note" />
    </div>
  </div>
</template>

<style scoped>
.tip {
  opacity: 0;
  transform: translate(-50%, 4px);
  transition: opacity 120ms, transform 120ms;
  outline: none;
}
.has-note:hover > .tip {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
