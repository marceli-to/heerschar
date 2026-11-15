<script setup lang="ts">
import { computed, ref } from 'vue';
import { encounterById, type EncounterId, type EncounterUnit } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import type { GameState } from '../../meta/game';
import { canPlace, enemyViewCol, isFielded, occupantOf, placeCharacter, setFielded, type Character, type Slot, type SquadState } from '../../meta/squad';
import ClassMedallion from '../hud/ClassMedallion.vue';
import CharacterSheet from './CharacterSheet.vue';
import FieldToken from './FieldToken.vue';
import WarTable from './WarTable.vue';
import ScreenFrame from './ScreenFrame.vue';

/**
 * Preparation step 2 (approved 3d): an ink-drawn field map, the enemy formation at the top as
 * seen from behind the squad, the squad's 3 × 2 grid below, front rows meeting in the middle.
 * Drag units between slots (swap), from the bench onto a slot (swap in) or onto the bench.
 * Hovering an enemy shows its threat; clicking one of yours opens its sheet on the right.
 */
const props = defineProps<{ game: GameState; squad: SquadState; encounterId: EncounterId }>();
const emit = defineEmits<{ next: []; back: [] }>();

const T = STRINGS.formationStep;
const COLS = [0, 1, 2] as const;

const encounter = computed(() => encounterById(props.encounterId));
const bench = computed(() => props.squad.roster.filter((c) => !isFielded(props.squad, c.id)));

function character(id: number): Character {
  return props.squad.roster.find((c) => c.id === id)!;
}

/** The enemy standing at a screen column of a row, mirrored to the player's view. */
function enemyAt(row: 0 | 1, viewCol: 0 | 1 | 2): EncounterUnit | null {
  return encounter.value.enemies.find((e) => e.row === row && enemyViewCol(e.col) === viewCol) ?? null;
}

function ownAt(row: 0 | 1, col: 0 | 1 | 2): Character | null {
  const id = occupantOf(props.squad, { col, row });
  return id === null ? null : character(id);
}

const selectedId = ref(props.squad.fielded[0]!);
const selected = computed(() => character(selectedId.value));

// Enemy hover note: "row,col" of the hovered enemy.
const hoverEnemy = ref<string | null>(null);

// Drag and drop (native HTML5). Everyone can move on the grid; the hero never goes to the bench.
const dragId = ref<number | null>(null);
const dropTarget = ref<string | null>(null);

function onDragStart(e: DragEvent, c: Character): void {
  dragId.value = c.id;
  selectedId.value = c.id;
  e.dataTransfer?.setData('text/plain', String(c.id));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(): void {
  dragId.value = null;
  dropTarget.value = null;
}

type Target = Slot | 'bench';

function targetKey(t: Target): string {
  return t === 'bench' ? 'bench' : `${t.col},${t.row}`;
}

function accepts(t: Target): boolean {
  const id = dragId.value;
  if (id === null) return false;
  if (t === 'bench') return isFielded(props.squad, id) && !character(id).isHero;
  return canPlace(props.squad, id, t);
}

function onDragOver(e: DragEvent, t: Target): void {
  if (!accepts(t)) return;
  e.preventDefault();
  dropTarget.value = targetKey(t);
}

function onDragLeave(t: Target): void {
  if (dropTarget.value === targetKey(t)) dropTarget.value = null;
}

function onDrop(e: DragEvent, t: Target): void {
  const id = dragId.value;
  if (id === null || !accepts(t)) return;
  e.preventDefault();
  if (t === 'bench') setFielded(props.squad, id, false);
  else placeCharacter(props.squad, id, t);
  onDragEnd();
}

/** Map rows top to bottom: enemy back, enemy front, (midline), own front, own back. */
const ENEMY_ROWS = [1, 0] as const;
const OWN_ROWS = [0, 1] as const;
</script>

<template>
  <WarTable>
    <ScreenFrame class="w-[min(1160px,96vw)]" :title="`${STRINGS.encounters[encounterId].name} · ${T.title}`" :subtitle="T.hint">
      <div class="panel grid w-full grid-cols-[auto_minmax(0,1fr)] gap-10 px-8 pt-7 pb-6">
        <div class="flex flex-col">
          <div class="map p-3">
            <div class="grid grid-cols-[52px_repeat(3,112px)] items-center">
              <template v-for="row in ENEMY_ROWS" :key="`e${row}`">
                <span class="label side-label">{{ row === 0 ? T.front : T.back }}</span>
                <div v-for="col in COLS" :key="col" class="cell" @mouseenter="hoverEnemy = enemyAt(row, col) ? `${row},${col}` : null" @mouseleave="hoverEnemy = null">
                  <div class="ring is-enemy" :class="{ 'is-empty': !enemyAt(row, col) }" />
                  <template v-if="enemyAt(row, col)">
                    <FieldToken class="token" :class-id="enemyAt(row, col)!.classId" :label="STRINGS.classes[enemyAt(row, col)!.classId]" enemy />
                    <div v-if="hoverEnemy === `${row},${col}`" class="plate pointer-events-none absolute bottom-[calc(100%-6px)] left-1/2 z-10 w-56 -translate-x-1/2 px-4 py-3">
                      <div class="heading-3 text-lg text-blood">{{ STRINGS.classes[enemyAt(row, col)!.classId] }}</div>
                      <p class="note">{{ T.threats[enemyAt(row, col)!.classId] }}</p>
                    </div>
                  </template>
                </div>
              </template>

              <div class="midline col-span-4 my-1.5" />

              <template v-for="row in OWN_ROWS" :key="`o${row}`">
                <span class="label side-label">{{ row === 0 ? T.front : T.back }}</span>
                <div
                  v-for="col in COLS"
                  :key="col"
                  class="cell"
                  :class="{ 'is-target': dropTarget === `${col},${row}` }"
                  @dragover="onDragOver($event, { col, row })"
                  @dragleave="onDragLeave({ col, row })"
                  @drop="onDrop($event, { col, row })"
                >
                  <div class="ring" :class="{ 'is-empty': !ownAt(row, col) }" />
                  <FieldToken
                    v-if="ownAt(row, col)"
                    class="token cursor-grab"
                    :class="{ 'is-on': ownAt(row, col)!.id === selectedId, 'is-dragging': ownAt(row, col)!.id === dragId }"
                    :class-id="ownAt(row, col)!.classId"
                    :label="ownAt(row, col)!.name"
                    :hero="ownAt(row, col)!.isHero"
                    draggable="true"
                    @click="selectedId = ownAt(row, col)!.id"
                    @dragstart="onDragStart($event, ownAt(row, col)!)"
                    @dragend="onDragEnd"
                  />
                </div>
              </template>
            </div>
          </div>

          <div
            class="bench well mt-4 px-3 pt-2 pb-2.5"
            :class="{ 'is-target': dropTarget === 'bench' }"
            @dragover="onDragOver($event, 'bench')"
            @dragleave="onDragLeave('bench')"
            @drop="onDrop($event, 'bench')"
          >
            <div class="label mb-1.5">{{ T.bench }}</div>
            <div class="flex min-h-10 flex-wrap gap-x-4 gap-y-2">
              <div
                v-for="c in bench"
                :key="c.id"
                class="chip row-select flex cursor-grab items-center gap-2 py-0.5 pr-2.5 pl-0.5"
                :class="{ 'is-on': c.id === selectedId, 'is-dragging': c.id === dragId }"
                draggable="true"
                @click="selectedId = c.id"
                @dragstart="onDragStart($event, c)"
                @dragend="onDragEnd"
              >
                <ClassMedallion :class-id="c.classId" :size="34" class="opacity-80" />
                <span class="font-display text-base">{{ c.name }}</span>
              </div>
              <p v-if="bench.length === 0" class="note self-center">{{ T.benchEmpty }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-col justify-center">
          <CharacterSheet :character="selected" :game="game" />
        </div>
      </div>
      <template #back><button class="link link-light" @click="emit('back')">{{ STRINGS.prep.back }}</button></template>
      <template #action><button class="btn" @click="emit('next')">{{ T.fight }}</button></template>
    </ScreenFrame>
  </WarTable>
</template>

<style scoped>
/* The field map: a grassy board with an ink outline (6i). */
.map {
  border-radius: var(--radius-card);
  background: linear-gradient(#cfe39a, #a9cc6c); /* Greenmarch grass */
  border: 3px solid var(--color-ink);
  box-shadow: inset 0 3px 0 rgb(255 255 255 / 0.35), inset 0 -4px 0 rgb(0 0 0 / 0.1);
}
.side-label {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  justify-self: center;
}
.cell {
  position: relative;
  height: 92px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
  border-radius: var(--radius-control);
  transition: background-color 100ms;
}
/* Ink circle on the ground under each slot; dashed when empty. */
.ring {
  position: absolute;
  top: 4px;
  left: 50%;
  width: 62px;
  height: 62px;
  margin-left: -31px;
  border-radius: 9999px;
  border: 3px solid rgb(59 36 20 / 0.45);
  background: rgb(255 255 255 / 0.18);
}
.ring.is-empty {
  border-style: dashed;
}
.ring.is-enemy {
  border-color: rgb(210 50 36 / 0.55);
  background: rgb(210 50 36 / 0.1);
}
.ring.is-enemy.is-empty {
  opacity: 0.5;
}
.token {
  position: relative;
}
.token.is-on :deep(.medallion) {
  box-shadow:
    0 0 0 3px #fff4c0,
    0 0 16px 4px rgb(255 214 110 / 0.9);
}
.is-dragging {
  opacity: 0.4;
}
.midline {
  height: 0;
  border-top: 3px dashed rgb(59 36 20 / 0.35);
}

.chip {
  transition: background-color 100ms;
}

.cell.is-target,
.bench.is-target {
  background: rgb(210 50 36 / 0.15);
  box-shadow: inset 0 0 0 2px var(--color-blood);
}
</style>
