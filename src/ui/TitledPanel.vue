<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="panel w-[min(520px,90vw)] px-10 pt-7 pb-8 text-center font-body">
    <h1 class="title-text font-display text-5xl leading-tight">{{ title }}</h1>
    <p v-if="subtitle" class="mt-1 text-sm font-extrabold tracking-[0.12em] text-ink-soft uppercase">{{ subtitle }}</p>
    <div class="rule mx-auto my-4 w-2/3" />
    <slot />
  </div>
</template>
