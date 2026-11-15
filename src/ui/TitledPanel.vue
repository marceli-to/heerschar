<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="panel w-[min(520px,90vw)] px-10 pt-7 pb-8 text-center font-body">
    <h1 class="heading-screen">{{ title }}</h1>
    <p v-if="subtitle" class="label mt-1">{{ subtitle }}</p>
    <div class="rule mx-auto my-4 w-2/3" />
    <slot />
  </div>
</template>
