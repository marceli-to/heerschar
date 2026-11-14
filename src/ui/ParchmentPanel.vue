<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="parchment w-[min(520px,90vw)] rounded-sm px-10 pt-8 pb-7 text-center font-body">
    <h1 class="font-display text-4xl font-bold tracking-[0.12em] text-ink">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1 font-display text-xs tracking-[0.3em] text-ink-soft uppercase">{{ subtitle }}</p>
    <div class="rule mx-auto my-4 w-3/4" />
    <slot />
  </div>
</template>
