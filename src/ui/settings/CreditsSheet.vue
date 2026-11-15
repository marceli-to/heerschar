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
  <div class="panel flex max-h-[92vh] w-[min(720px,94vw)] flex-col px-10 py-7">
    <h1 class="heading-screen text-center">{{ T.title }}</h1>
    <div class="rule mt-4 w-full" />
    <div class="credits-scroll -mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section v-for="s in T.sections" :key="s.heading" class="mt-3 first:mt-0">
        <h2 class="heading-3 mb-2 text-center">{{ s.heading }}</h2>
        <div v-for="[what, work, licence] in s.lines" :key="work" class="grid grid-cols-[8rem_1fr] gap-x-4 py-1">
          <span class="label text-right">{{ what }}</span>
          <div>
            <div>{{ work }}</div>
            <div class="note">{{ licence }}</div>
          </div>
        </div>
        <p v-if="s.note" class="note mt-1 text-center">{{ s.note }}</p>
      </section>
    </div>
    <div class="rule w-full" />
    <div class="mt-5 flex justify-end">
      <button class="btn" @click="emit('done')">{{ T.done }}</button>
    </div>
  </div>
</template>

<style scoped>
.credits-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--color-ink-soft) transparent;
}
</style>
