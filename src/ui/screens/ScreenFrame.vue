<script setup lang="ts">
/**
 * Shared layout of every war-table screen (6i): outlined title, light subtitle, the content, and a
 * footer with Back (a text link) on the left and the screen's one main action on the right.
 * Spacing is the same everywhere; the width comes from the caller's class.
 */
defineProps<{ title?: string; subtitle?: string }>();
</script>

<template>
  <div class="flex flex-col items-center gap-5">
    <header v-if="title || subtitle" class="flex flex-col items-center gap-1 text-center">
      <h2 v-if="title" class="heading-screen">{{ title }}</h2>
      <p v-if="subtitle" class="table-text max-w-[72ch] text-lg">{{ subtitle }}</p>
    </header>
    <slot />
    <footer v-if="$slots.back || $slots.action" class="flex min-h-14 w-full items-center justify-between gap-6 px-2">
      <div><slot name="back" /></div>
      <div class="flex items-center gap-4"><slot name="action" /></div>
    </footer>
  </div>
</template>
