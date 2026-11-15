<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { STRINGS } from '../../data/strings';
import { ACTIONS, CAMERA_RANGE, QUALITIES, VOLUMES, keyLabel, mouseCode, rebind, type Action } from '../../settings/settings';
import { restoreDefaults, settings } from '../../settings/store';
import InkSlider from './InkSlider.vue';

/**
 * Settings (approved 6g): one panel sheet with four tabs (Sound · Controls · Camera · Graphics),
 * one section at a time, Done at the bottom. Opened from the title and the pause panel; every change
 * applies and saves at once.
 */
const emit = defineEmits<{ done: [] }>();

type Tab = keyof typeof STRINGS.settings.tabs;
const TABS: Tab[] = ['sound', 'controls', 'camera', 'graphics'];
const tab = ref<Tab>('sound');
const T = STRINGS.settings;

const SECTION = { sound: 'volume', controls: 'keys', camera: 'camera', graphics: 'quality' } as const;

/** The action waiting for a key, if any. */
const capturing = ref<Action | null>(null);
let swallowClick = false;

function startCapture(a: Action): void {
  capturing.value = a;
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', onMouse, true);
}

function stopCapture(): void {
  capturing.value = null;
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('mousedown', onMouse, true);
}

function bind(code: string): void {
  const a = capturing.value;
  if (a) settings.keys = rebind(settings.keys, a, code);
  stopCapture();
}

function onKey(e: KeyboardEvent): void {
  e.preventDefault();
  e.stopImmediatePropagation();
  if (e.repeat) return;
  if (e.code === 'Escape') stopCapture();
  else bind(e.code);
}

function onMouse(e: MouseEvent): void {
  e.preventDefault();
  e.stopImmediatePropagation();
  // The click that follows this press must not also press whatever button is under the pointer.
  swallowClick = true;
  bind(mouseCode(e.button));
}

function onClickCapture(e: MouseEvent): void {
  if (!swallowClick) return;
  swallowClick = false;
  e.preventDefault();
  e.stopPropagation();
}

window.addEventListener('click', onClickCapture, true);
onBeforeUnmount(() => {
  stopCapture();
  window.removeEventListener('click', onClickCapture, true);
});

function pickTab(t: Tab): void {
  stopCapture();
  tab.value = t;
}

const times = (v: number): string => `${v.toFixed(2).replace(/0$/, '')}×`;
</script>

<template>
  <div class="panel flex w-[min(680px,94vw)] flex-col px-10 pt-7 pb-7 font-body">
    <h1 class="text-center font-display text-3xl font-bold tracking-[0.12em]">{{ T.title }}</h1>
    <nav class="mt-4 flex justify-center gap-8 border-b border-ink-soft/30">
      <button
        v-for="t in TABS"
        :key="t"
        class="tab -mb-px border-b-2 px-1 pb-2 font-display text-sm tracking-[0.2em] uppercase"
        :class="t === tab ? 'border-gold text-ink' : 'border-transparent text-ink-soft hover:text-ink'"
        @click="pickTab(t)"
      >
        {{ T.tabs[t] }}
      </button>
    </nav>

    <section class="min-h-[330px] py-6">
      <div v-if="tab === 'sound'" class="space-y-5 pt-4">
        <InkSlider v-for="v in VOLUMES" :key="v" v-model="settings.volume[v]" :label="T.volume[v]" :min="0" :max="100" :step="1" />
      </div>

      <div v-else-if="tab === 'controls'">
        <div class="grid grid-cols-2 gap-x-10 gap-y-1.5">
          <div v-for="a in ACTIONS" :key="a" class="flex items-center justify-between gap-3">
            <span class="text-base">{{ T.actions[a] }}</span>
            <button class="keycap min-w-[5.5rem] rounded-[3px] px-2 py-1 font-display text-xs tracking-[0.06em]" :class="{ 'is-capturing': capturing === a }" @click="startCapture(a)">
              <span v-if="capturing === a" class="font-body text-sm italic tracking-normal">{{ T.pressKey }}</span>
              <span v-else>{{ keyLabel(settings.keys[a]) }}</span>
            </button>
          </div>
          <div v-for="[key, what] in T.fixed" :key="key" class="flex items-center justify-between gap-3 text-ink-soft">
            <span class="text-base">{{ what }}</span>
            <span class="min-w-[5.5rem] px-2 py-1 text-center font-display text-xs tracking-[0.06em]">{{ key }}</span>
          </div>
        </div>
        <p class="mt-4 text-center text-sm text-ink-soft italic">{{ T.swapHint }}</p>
      </div>

      <div v-else-if="tab === 'camera'" class="space-y-5 pt-4">
        <InkSlider v-model="settings.camera.turn" :label="T.camera.turn" :min="CAMERA_RANGE.min" :max="CAMERA_RANGE.max" :step="CAMERA_RANGE.step" :format="times" />
        <InkSlider v-model="settings.camera.zoom" :label="T.camera.zoom" :min="CAMERA_RANGE.min" :max="CAMERA_RANGE.max" :step="CAMERA_RANGE.step" :format="times" />
      </div>

      <div v-else class="pt-4">
        <div class="flex items-center gap-6">
          <span class="w-[9rem] text-lg">{{ T.quality.label }}</span>
          <div class="flex gap-3">
            <button
              v-for="q in QUALITIES"
              :key="q"
              class="keycap min-w-[6rem] rounded-[3px] px-4 py-2 font-display text-sm tracking-[0.12em]"
              :class="{ 'is-on': settings.quality === q }"
              @click="settings.quality = q"
            >
              {{ T.quality.names[q] }}
            </button>
          </div>
        </div>
        <p class="mt-5 pl-[calc(9rem+1.5rem)] text-base text-ink-soft italic">{{ T.quality.notes[settings.quality] }}</p>
      </div>
    </section>

    <div class="rule w-full" />
    <div class="mt-5 flex items-center justify-between">
      <button class="font-display text-xs tracking-[0.15em] text-ink-soft underline-offset-4 hover:underline" @click="restoreDefaults(SECTION[tab])">{{ T.restore }}</button>
      <button class="btn px-8 py-2.5 text-sm" @click="emit('done')">{{ T.done }}</button>
    </div>
  </div>
</template>

<style scoped>
.keycap {
  color: var(--color-ink);
  background: linear-gradient(var(--color-cream), var(--color-cream-dark));
  border: 1px solid var(--color-gold);
  box-shadow: 0 0 0 1px rgb(58 39 23 / 0.55), 0 2px 0 rgb(58 39 23 / 0.45);
  transition: box-shadow 120ms, transform 120ms;
}
.keycap:hover {
  box-shadow: 0 0 0 1px rgb(58 39 23 / 0.75), 0 2px 0 rgb(58 39 23 / 0.45), 0 0 8px rgb(224 191 106 / 0.5);
}
.keycap.is-capturing,
.keycap.is-on {
  border-color: var(--color-gold-light);
  box-shadow: 0 0 0 1px var(--color-ink), 0 0 12px rgb(224 191 106 / 0.75);
}
.keycap.is-on {
  background: linear-gradient(#f6e7bf, #e6cf96);
  font-weight: 700;
}
</style>
