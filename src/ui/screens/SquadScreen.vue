<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import { fieldedCharacters, isFielded, MAX_FIELDED, setFielded, swapIn, type Character, type SquadState } from '../../meta/squad';
import ClassMedallion from '../hud/ClassMedallion.vue';
import CharacterSheet from './CharacterSheet.vue';
import WarTable from './WarTable.vue';

/**
 * Preparation step 1 (approved 3c): roster on the left (in the field / bench), the selected
 * character's sheet on the right. Field or bench with the sheet's button or by dragging rows;
 * a benched character dropped onto a fielded companion swaps with it.
 */
const props = defineProps<{ squad: SquadState; encounterId: EncounterId }>();
const emit = defineEmits<{ next: []; back: [] }>();

const T = STRINGS.squadStep;

const field = computed(() => fieldedCharacters(props.squad));
const bench = computed(() => props.squad.roster.filter((c) => !isFielded(props.squad, c.id)));
const full = computed(() => props.squad.fielded.length >= MAX_FIELDED);

const selectedId = ref(field.value[0]?.id ?? props.squad.roster[0]!.id);
const selected = computed(() => props.squad.roster.find((c) => c.id === selectedId.value)!);
const selectedFielded = computed(() => isFielded(props.squad, selectedId.value));

function toggle(): void {
  setFielded(props.squad, selectedId.value, !selectedFielded.value);
}

// Drag and drop (native HTML5). The hero cannot be dragged.
const dragId = ref<number | null>(null);
const dropTarget = ref<string | null>(null);

function onDragStart(e: DragEvent, c: Character): void {
  if (c.isHero) return e.preventDefault();
  dragId.value = c.id;
  selectedId.value = c.id;
  e.dataTransfer?.setData('text/plain', String(c.id));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(): void {
  dragId.value = null;
  dropTarget.value = null;
}

/** Whether the dragged character may be dropped on `target` ('field', 'bench' or a fielded id). */
function accepts(target: 'field' | 'bench' | number): boolean {
  const id = dragId.value;
  if (id === null) return false;
  const fielded = isFielded(props.squad, id);
  if (target === 'bench') return fielded;
  if (target === 'field') return !fielded && !full.value;
  const onto = props.squad.roster.find((c) => c.id === target);
  return !fielded && !!onto && !onto.isHero;
}

function onDragOver(e: DragEvent, target: 'field' | 'bench' | number): void {
  if (!accepts(target)) return;
  e.preventDefault();
  e.stopPropagation();
  dropTarget.value = String(target);
}

function onDrop(e: DragEvent, target: 'field' | 'bench' | number): void {
  const id = dragId.value;
  if (id === null || !accepts(target)) return;
  e.preventDefault();
  e.stopPropagation();
  if (target === 'bench') setFielded(props.squad, id, false);
  else if (target === 'field') setFielded(props.squad, id, true);
  else swapIn(props.squad, id, target);
  onDragEnd();
}
</script>

<template>
  <WarTable>
    <div class="flex w-[min(1040px,96vw)] flex-col items-center">
      <h2 class="font-display text-sm tracking-[0.35em] text-gold-light uppercase">{{ STRINGS.encounters[encounterId].name }} · {{ T.title }}</h2>
      <p class="mt-1 mb-6 text-lg italic text-parchment/70">{{ T.dragHint }}</p>
      <div class="parchment grid w-full grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-8 rounded-sm px-8 pt-7 pb-6">
        <div class="flex flex-col">
          <div class="zone rounded-sm" :class="{ 'is-target': dropTarget === 'field' }" @dragover="onDragOver($event, 'field')" @dragleave="dropTarget = null" @drop="onDrop($event, 'field')">
            <div class="mb-1 flex items-baseline justify-between px-2">
              <span class="font-display text-xs tracking-[0.2em] text-ink-soft uppercase">{{ T.inField }}</span>
              <span class="font-display text-xs tabular-nums text-ink-soft">{{ field.length }} / {{ MAX_FIELDED }}</span>
            </div>
            <ul>
              <li
                v-for="c in field"
                :key="c.id"
                class="row flex items-center gap-3 rounded-sm px-2 py-1.5"
                :class="{ 'is-on': c.id === selectedId, 'is-target': dropTarget === String(c.id), 'cursor-grab': !c.isHero, 'is-dragging': c.id === dragId }"
                :draggable="!c.isHero"
                @click="selectedId = c.id"
                @dragstart="onDragStart($event, c)"
                @dragend="onDragEnd"
                @dragover="onDragOver($event, c.id)"
                @drop="onDrop($event, c.id)"
              >
                <ClassMedallion :class-id="c.classId" :size="34" />
                <span class="flex-1 truncate font-display text-lg tracking-[0.04em]">{{ c.name }}</span>
                <span class="text-sm italic text-ink-soft">{{ c.isHero ? T.hero : STRINGS.classes[c.classId] }}</span>
                <span class="w-8 text-right font-display text-xs tabular-nums text-ink-soft">{{ c.level }}</span>
              </li>
            </ul>
          </div>
          <div class="rule my-3 w-full" />
          <div class="zone min-h-24 rounded-sm" :class="{ 'is-target': dropTarget === 'bench' }" @dragover="onDragOver($event, 'bench')" @dragleave="dropTarget = null" @drop="onDrop($event, 'bench')">
            <div class="mb-1 px-2 font-display text-xs tracking-[0.2em] text-ink-soft uppercase">{{ T.bench }}</div>
            <ul>
              <li
                v-for="c in bench"
                :key="c.id"
                class="row flex cursor-grab items-center gap-3 rounded-sm px-2 py-1.5"
                :class="{ 'is-on': c.id === selectedId, 'is-dragging': c.id === dragId }"
                draggable="true"
                @click="selectedId = c.id"
                @dragstart="onDragStart($event, c)"
                @dragend="onDragEnd"
              >
                <ClassMedallion :class-id="c.classId" :size="34" class="opacity-80" />
                <span class="flex-1 truncate font-display text-lg tracking-[0.04em] text-ink-soft">{{ c.name }}</span>
                <span class="text-sm italic text-ink-soft">{{ STRINGS.classes[c.classId] }}</span>
                <span class="w-8 text-right font-display text-xs tabular-nums text-ink-soft">{{ c.level }}</span>
              </li>
            </ul>
            <p v-if="bench.length === 0" class="px-2 py-2 italic text-ink-soft/70">{{ T.benchEmpty }}</p>
          </div>
        </div>
        <div class="flex flex-col">
          <CharacterSheet :character="selected" />
          <div class="mt-4 flex min-h-10 items-center justify-end gap-4">
            <span v-if="selected.isHero" class="italic text-ink-soft">{{ T.heroAlwaysFights }}</span>
            <template v-else>
              <span v-if="!selectedFielded && full" class="text-right text-sm italic text-ink-soft">{{ T.fieldFull }}</span>
              <button class="btn-gold shrink-0 rounded-sm px-5 py-2 text-xs disabled:opacity-50" :disabled="!selectedFielded && full" @click="toggle">
                {{ selectedFielded ? T.toBench : T.toField }}
              </button>
            </template>
          </div>
        </div>
      </div>
      <div class="mt-6 flex w-full items-center justify-between px-2">
        <button class="font-display text-xs tracking-[0.15em] text-parchment/70 underline-offset-4 hover:underline" @click="emit('back')">{{ STRINGS.prep.back }}</button>
        <button class="btn-gold rounded-sm px-8 py-2.5 text-sm" @click="emit('next')">{{ STRINGS.prep.next }}</button>
      </div>
    </div>
  </WarTable>
</template>

<style scoped>
.row {
  transition: background-color 100ms;
}
.row:hover {
  background: rgb(120 80 30 / 0.1);
}
.row.is-on {
  background: rgb(185 138 46 / 0.2);
  box-shadow: inset 2px 0 0 var(--color-gold);
}
.row.is-dragging {
  opacity: 0.4;
}
.row.is-target,
.zone.is-target {
  background: rgb(155 45 32 / 0.12);
  box-shadow: inset 0 0 0 1px rgb(155 45 32 / 0.55);
}
</style>
