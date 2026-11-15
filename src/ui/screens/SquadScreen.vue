<script setup lang="ts">
import { computed, ref } from 'vue';
import type { EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import type { GameState } from '../../meta/game';
import { fieldedCharacters, isFielded, MAX_FIELDED, setFielded, swapIn, type Character, type SquadState } from '../../meta/squad';
import ClassMedallion from '../hud/ClassMedallion.vue';
import CharacterSheet from './CharacterSheet.vue';
import WarTable from './WarTable.vue';
import ScreenFrame from './ScreenFrame.vue';

/**
 * Preparation step 1 (approved 3c): roster on the left (in the field / bench), the selected
 * character's sheet on the right. Field or bench with the sheet's button or by dragging rows;
 * a benched character dropped onto a fielded companion swaps with it.
 */
const props = defineProps<{ game: GameState; squad: SquadState; encounterId: EncounterId }>();
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
    <ScreenFrame class="w-[min(1040px,96vw)]" :title="`${STRINGS.encounters[encounterId].name} · ${T.title}`" :subtitle="T.dragHint">
      <div class="panel grid w-full grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-8 px-8 pt-5 pb-5">
        <div class="flex flex-col">
          <div class="zone" :class="{ 'is-target': dropTarget === 'field' }" @dragover="onDragOver($event, 'field')" @dragleave="dropTarget = null" @drop="onDrop($event, 'field')">
            <div class="mb-1 flex items-baseline justify-between px-2">
              <span class="label">{{ T.inField }}</span>
              <span class="font-display text-base tabular-nums text-ink-soft">{{ field.length }} / {{ MAX_FIELDED }}</span>
            </div>
            <ul>
              <li
                v-for="c in field"
                :key="c.id"
                class="row-select flex items-center gap-3 px-2 py-1"
                :class="{ 'is-on': c.id === selectedId, 'is-target': dropTarget === String(c.id), 'cursor-grab': !c.isHero, 'is-dragging': c.id === dragId }"
                :draggable="!c.isHero"
                @click="selectedId = c.id"
                @dragstart="onDragStart($event, c)"
                @dragend="onDragEnd"
                @dragover="onDragOver($event, c.id)"
                @drop="onDrop($event, c.id)"
              >
                <ClassMedallion :class-id="c.classId" :size="34" />
                <span class="heading-3 flex-1 truncate">{{ c.name }}</span>
                <span class="note">{{ c.isHero ? T.hero : STRINGS.classes[c.classId] }}</span>
                <span class="w-8 text-right font-display text-base tabular-nums text-ink-soft">{{ c.level }}</span>
              </li>
            </ul>
          </div>
          <div class="rule my-3 w-full" />
          <div class="zone min-h-24" :class="{ 'is-target': dropTarget === 'bench' }" @dragover="onDragOver($event, 'bench')" @dragleave="dropTarget = null" @drop="onDrop($event, 'bench')">
            <div class="label mb-1 px-2">{{ T.bench }}</div>
            <ul>
              <li
                v-for="c in bench"
                :key="c.id"
                class="row-select flex cursor-grab items-center gap-3 px-2 py-1"
                :class="{ 'is-on': c.id === selectedId, 'is-dragging': c.id === dragId }"
                draggable="true"
                @click="selectedId = c.id"
                @dragstart="onDragStart($event, c)"
                @dragend="onDragEnd"
              >
                <ClassMedallion :class-id="c.classId" :size="34" class="opacity-80" />
                <span class="heading-3 flex-1 truncate text-ink-soft">{{ c.name }}</span>
                <span class="note">{{ STRINGS.classes[c.classId] }}</span>
                <span class="w-8 text-right font-display text-base tabular-nums text-ink-soft">{{ c.level }}</span>
              </li>
            </ul>
            <p v-if="bench.length === 0" class="note px-2 py-2">{{ T.benchEmpty }}</p>
          </div>
        </div>
        <div class="flex flex-col">
          <CharacterSheet :character="selected" :game="game" />
          <div class="mt-4 flex min-h-10 items-center justify-end gap-4">
            <span v-if="selected.isHero" class="note">{{ T.heroAlwaysFights }}</span>
            <template v-else>
              <span v-if="!selectedFielded && full" class="note text-right">{{ T.fieldFull }}</span>
              <button class="btn btn-sm btn-yellow shrink-0" :disabled="!selectedFielded && full" @click="toggle">
                {{ selectedFielded ? T.toBench : T.toField }}
              </button>
            </template>
          </div>
        </div>
      </div>
      <template #back><button class="link link-light" @click="emit('back')">{{ STRINGS.prep.back }}</button></template>
      <template #action><button class="btn" @click="emit('next')">{{ STRINGS.prep.next }}</button></template>
    </ScreenFrame>
  </WarTable>
</template>

<style scoped>
.row-select.is-dragging {
  opacity: 0.4;
}
.row-select.is-target,
.zone.is-target {
  border-radius: var(--radius-control);
  background: rgb(210 50 36 / 0.12);
  box-shadow: inset 0 0 0 2px var(--color-blood);
}
</style>
