<script setup lang="ts">
import { computed } from 'vue';

/** Slider (approved 6g): thin ink line, the filled part in gold, round gold knob with a dark rim, value in Cinzel. */
const props = defineProps<{ label: string; min: number; max: number; step: number; format?: (v: number) => string }>();
const model = defineModel<number>({ required: true });

const fill = computed(() => `${((model.value - props.min) / (props.max - props.min)) * 100}%`);
const shown = computed(() => (props.format ? props.format(model.value) : String(Math.round(model.value))));
</script>

<template>
  <label class="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-4">
    <span class="text-lg">{{ label }}</span>
    <input v-model.number="model" type="range" class="ink-slider" :min="min" :max="max" :step="step" :style="{ '--fill': fill }" />
    <span class="text-right font-display text-sm tabular-nums text-ink-soft">{{ shown }}</span>
  </label>
</template>

<style scoped>
.ink-slider {
  appearance: none;
  height: 18px;
  background: transparent;
  cursor: pointer;
}
.ink-slider::-webkit-slider-runnable-track {
  height: 2px;
  background: linear-gradient(90deg, var(--color-gold) var(--fill), var(--color-ink) var(--fill));
}
.ink-slider::-moz-range-track {
  height: 2px;
  background: var(--color-ink);
}
.ink-slider::-moz-range-progress {
  height: 2px;
  background: var(--color-gold);
}
.ink-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -7px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--color-gold-light), var(--color-gold) 60%, #6b4a14);
  border: 1.5px solid var(--color-ink);
  box-shadow: 0 1px 2px rgb(5 2 1 / 0.5);
}
.ink-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--color-gold-light), var(--color-gold) 60%, #6b4a14);
  border: 1.5px solid var(--color-ink);
}
.ink-slider:hover::-webkit-slider-thumb,
.ink-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px rgb(224 191 106 / 0.45);
}
.ink-slider:focus {
  outline: none;
}
</style>
