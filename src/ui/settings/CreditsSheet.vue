<script setup lang="ts">
import { STRINGS } from '../../data/strings';

/**
 * Credits (approved 6h, restyled 6i): panel sheet like Settings, opened from the title. Lilita section
 * headings, one EB Garamond line per work with its licence beneath; scrolls when the window is short.
 */
const emit = defineEmits<{ done: [] }>();
const T = STRINGS.credits;
</script>

<template>
  <div class="panel flex max-h-[92vh] w-[min(720px,94vw)] flex-col px-10 pt-7 pb-7 font-body">
    <h1 class="title-text text-center font-display text-5xl">{{ T.title }}</h1>
    <div class="rule mt-4 w-full" />
    <div class="credits-scroll -mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section v-for="s in T.sections" :key="s.heading" class="mt-3 first:mt-0">
        <h2 class="mb-2 text-center font-display text-xl">{{ s.heading }}</h2>
        <div v-for="[what, work, licence] in s.lines" :key="work" class="grid grid-cols-[7.5rem_1fr] gap-x-4 py-0.5">
          <span class="text-right text-sm text-ink-soft">{{ what }}</span>
          <div>
            <div class="text-base leading-snug">{{ work }}</div>
            <div class="text-xs leading-snug font-semibold text-ink-soft">{{ licence }}</div>
          </div>
        </div>
        <p v-if="s.note" class="mt-1 text-center text-xs text-ink-soft">{{ s.note }}</p>
      </section>
    </div>
    <div class="rule w-full" />
    <div class="mt-5 flex justify-end">
      <button class="btn px-8 py-2.5 text-lg" @click="emit('done')">{{ T.done }}</button>
    </div>
  </div>
</template>

<style scoped>
.credits-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--color-ink-soft) transparent;
}
</style>
