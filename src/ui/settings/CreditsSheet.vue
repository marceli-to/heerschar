<script setup lang="ts">
import { ref } from 'vue';
import { STRINGS } from '../../data/strings';

/**
 * Credits (approved 6h, tabs 6i): panel sheet like Settings, opened from the title. Tabs Music · Art ·
 * Sound · Fonts, one group at a time so nothing scrolls. Each work is a row in a well: what it is used
 * for, the work in bold with its author and source beneath, and a licence chip on the right.
 */
const emit = defineEmits<{ done: [] }>();
const T = STRINGS.credits;
const tab = ref(0);
</script>

<template>
  <div class="panel flex max-h-[96vh] w-[min(720px,94vw)] flex-col overflow-y-auto px-10 py-6">
    <h1 class="heading-screen text-center">{{ T.title }}</h1>
    <nav class="mt-4 flex justify-center gap-2">
      <button
        v-for="(g, i) in T.tabs"
        :key="g.tab"
        class="cap px-4 py-1 font-display text-lg"
        :class="{ 'is-on': i === tab }"
        @click="tab = i"
      >
        {{ g.tab }}
      </button>
    </nav>

    <section class="min-h-[38.75rem] py-4">
      <div class="well divide-y-2 divide-ink/10 px-5 py-1">
        <div v-for="(l, i) in T.tabs[tab]!.lines" :key="i" class="grid grid-cols-[6.5rem_1fr_auto] items-start gap-x-4 py-2">
          <span class="label pt-0.5">{{ l.what }}</span>
          <div class="min-w-0">
            <div class="font-extrabold leading-snug">{{ l.work }}</div>
            <div class="text-sm leading-snug">by {{ l.by }}</div>
            <div v-for="part in l.source.split(' · ')" :key="part" class="note break-words leading-snug">{{ part }}</div>
          </div>
          <span class="chip mt-0.5" :class="{ free: l.licence === 'CC0' }">{{ l.licence }}</span>
        </div>
      </div>
      <p v-if="T.tabs[tab]!.note" class="note mt-3 text-center">{{ T.tabs[tab]!.note }}</p>
    </section>

    <div class="rule w-full" />
    <div class="mt-5 flex justify-end">
      <button class="btn" @click="emit('done')">{{ T.done }}</button>
    </div>
  </div>
</template>

<style scoped>
/* Licence chip: small outlined pill; gold for attribution licences, silver for CC0. */
.chip {
  white-space: nowrap;
  padding: 0.0625rem 0.625rem;
  font-family: var(--font-display);
  font-size: 0.875rem;
  color: var(--color-ink);
  background: linear-gradient(var(--color-gold-light), var(--color-gold));
  border: 2px solid var(--color-ink);
  border-radius: 999px;
  box-shadow: 0 2px 0 var(--color-ink);
}
.chip.free {
  background: linear-gradient(#e6edf4, var(--color-silver));
}
</style>
