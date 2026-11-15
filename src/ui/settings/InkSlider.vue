<script setup lang="ts">
import { computed } from 'vue';

/** Slider (approved 6g, restyled 6i): a fat outlined track filled in gold, a round gold knob with an ink rim, value in Lilita. */
const props = defineProps<{ label: string; min: number; max: number; step: number; format?: (v: number) => string }>();
const model = defineModel<number>({ required: true });

const fill = computed(() => `${((model.value - props.min) / (props.max - props.min)) * 100}%`);
const shown = computed(() => (props.format ? props.format(model.value) : String(Math.round(model.value))));
</script>

<template>
  <label class="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-4">
    <span>{{ label }}</span>
    <input v-model.number="model" type="range" class="ink-slider" :min="min" :max="max" :step="step" :style="{ '--fill': fill }" />
    <span class="text-right font-display text-xl tabular-nums">{{ shown }}</span>
  </label>
</template>

<style scoped>
.ink-slider {
  appearance: none;
  height: 28px;
  background: transparent;
  cursor: pointer;
}
.ink-slider::-webkit-slider-runnable-track {
  height: 16px;
  border: 3px solid var(--color-ink);
  border-radius: 99px;
  background: linear-gradient(90deg, var(--color-gold-light) var(--fill), var(--color-track) var(--fill));
  box-shadow: inset 0 3px 0 rgb(255 255 255 / 0.3);
}
.ink-slider::-moz-range-track {
  height: 10px;
  border: 3px solid var(--color-ink);
  border-radius: 99px;
  background: var(--color-track);
}
.ink-slider::-moz-range-progress {
  height: 10px;
  border-radius: 99px;
  background: var(--color-gold-light);
}
.ink-slider::-webkit-slider-thumb {
  appearance: none;
  width: 26px;
  height: 26px;
  margin-top: -8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a0, var(--color-gold) 60%, #b07418);
  border: 3px solid var(--color-ink);
  box-shadow: 0 2px 0 var(--color-ink);
}
.ink-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a0, var(--color-gold) 60%, #b07418);
  border: 3px solid var(--color-ink);
}
.ink-slider:hover::-webkit-slider-thumb,
.ink-slider:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 2px 0 var(--color-ink), 0 0 0 4px rgb(255 214 110 / 0.55);
}
.ink-slider:focus {
  outline: none;
}
</style>
