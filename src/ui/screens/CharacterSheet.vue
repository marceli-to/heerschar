<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { ItemSlot as Slot } from '../../data/items';
import { xpToNext } from '../../data/progression';
import { STRINGS } from '../../data/strings';
import { pathById, upgradeById } from '../../data/upgrades';
import { effectLines, upgradeTally } from '../../meta/describe';
import { equip, unequip, type GameState } from '../../meta/game';
import { characterStats, statsWithItem } from '../../meta/progression';
import type { Character } from '../../meta/squad';
import type { Stats } from '../../sim/types';
import PictogramTile from '../PictogramTile.vue';
import FigurePreview from './FigurePreview.vue';
import HoverNote from './HoverNote.vue';
import ItemPicker from './ItemPicker.vue';
import ItemSlot from './ItemSlot.vue';

/**
 * Character sheet (approved 3c, 4d): turning figure, the stats as fought, level and experience,
 * path and upgrades as small tiles, and the item slots. Clicking a slot opens the baggage under
 * it; hovering an item there previews the stats with gold / red deltas.
 */
const props = defineProps<{ character: Character; game: GameState }>();

const T = STRINGS.squadStep;

function fmt(n: number, digits = 0): string {
  return n.toFixed(digits);
}

// --- Equipment -------------------------------------------------------------------------------

const openSlot = ref<Slot | null>(null);
/** Item previewed in the open slot: an id, `null` = taken off, `undefined` = no preview. */
const preview = ref<string | null | undefined>(undefined);
const slotsEl = ref<HTMLElement | null>(null);
const pickerEl = ref<HTMLElement | null>(null);
/** Opens to the left of the slots (over the figure) when there is no room below; keeps the ledger visible. */
const aside = ref(false);
const setPicker = (el: unknown) => (pickerEl.value = el as HTMLElement | null);

function close(): void {
  openSlot.value = null;
  preview.value = undefined;
}

async function toggleSlot(slot: Slot): Promise<void> {
  if (openSlot.value === slot) return close();
  openSlot.value = slot;
  preview.value = undefined;
  aside.value = false;
  await nextTick();
  const r = pickerEl.value?.getBoundingClientRect();
  if (r && r.bottom > window.innerHeight - 8) aside.value = true;
}

function onEquip(id: string): void {
  equip(props.game, props.character.id, id);
  close();
}

function onTakeOff(): void {
  if (openSlot.value) unequip(props.game, props.character.id, openSlot.value);
  close();
}

function onPointerDown(e: PointerEvent): void {
  if (openSlot.value && !slotsEl.value?.contains(e.target as Node)) close();
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') close();
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('keydown', onKey);
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('keydown', onKey);
});
watch(() => props.character.id, close);

// --- Ledger ----------------------------------------------------------------------------------

interface Line {
  label: string;
  value: string;
  /** Change under the preview, formatted, or null. */
  delta: string | null;
  better: boolean;
}

/** One ledger line; `lowerIsBetter` for the attack interval. */
function line(label: string, now: number, then: number, digits: number, show: (v: string) => string, lowerIsBetter = false): Line {
  // Compare the shown (rounded) numbers, so a delta never appears between two equal values.
  const d = Number(fmt(then, digits)) - Number(fmt(now, digits));
  const delta = d === 0 ? null : `${d > 0 ? '+' : '−'}${fmt(Math.abs(d), digits)}`;
  return { label, value: show(fmt(then, digits)), delta, better: lowerIsBetter ? d < 0 : d > 0 };
}

/** Ledger lines with the numbers the unit really has in battle, or would have with the previewed item. */
const lines = computed<Line[]>(() => {
  const c = props.character;
  const now = characterStats(c);
  const then: Stats = openSlot.value && preview.value !== undefined ? statsWithItem(c, openSlot.value, preview.value) : now;
  const id = (v: string) => v;
  const out: Line[] = [
    line(T.stats.maxHp, now.maxHp, then.maxHp, 0, id),
    line(T.stats.power, now.power, then.power, 0, id),
    line(T.stats.armor, now.armor, then.armor, 0, id),
    line(T.stats.resist, now.resist, then.resist, 0, id),
    line(T.stats.moveSpeed, now.moveSpeed, then.moveSpeed, 1, (v) => `${v} ${T.perSecond}`),
    then.range < 3 ? { label: T.stats.range, value: T.melee, delta: null, better: false } : line(T.stats.range, now.range, then.range, 0, (v) => `${v} ${T.metres}`),
  ];
  // The hero attacks with the player's own chain, not on an interval.
  if (!c.isHero) out.push(line(T.stats.attackInterval, now.attackInterval, then.attackInterval, 1, T.every, true));
  return out;
});

const xpNeeded = computed(() => xpToNext(props.character.level));

// --- Path and upgrades -----------------------------------------------------------------------

const path = computed(() => {
  const id = props.character.path;
  if (!id) return null;
  return { icon: pathById(id).icon, name: STRINGS.paths[id].name, text: STRINGS.paths[id].text };
});

const upgrades = computed(() =>
  upgradeTally(props.character.upgrades).map(({ id, count }) => {
    const u = upgradeById(id);
    return { id, count, icon: u.icon, name: STRINGS.upgrades[id] ?? id, kind: STRINGS.upgradeKinds[u.kind], lines: effectLines(u.effect) };
  }),
);
</script>

<template>
  <div class="grid grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6">
    <FigurePreview :class-id="character.classId" :hero="character.isHero" class="h-[340px]" />
    <div class="flex flex-col">
      <h3 class="font-display text-3xl font-bold tracking-[0.08em]">{{ character.name }}</h3>
      <p class="text-lg italic text-ink-soft">
        {{ STRINGS.classes[character.classId] }}<template v-if="character.isHero"> · {{ T.hero }}</template> · {{ T.level }} {{ character.level }}
      </p>
      <div class="rule my-3 w-full" />
      <dl class="grid min-h-[196px] grid-cols-[auto_1fr] content-start gap-x-6 gap-y-0 text-base">
        <template v-for="l in lines" :key="l.label">
          <dt class="font-display text-xs leading-7 tracking-[0.15em] text-ink-soft uppercase">{{ l.label }}</dt>
          <dd class="text-right tabular-nums">
            <span v-if="l.delta" class="delta mr-2 font-display text-xs" :class="l.better ? 'is-better' : 'is-worse'">{{ l.delta }}</span>{{ l.value }}
          </dd>
        </template>
      </dl>
      <div class="mt-3">
        <div class="flex justify-between font-display text-xs tracking-[0.15em] text-ink-soft uppercase">
          <span>{{ T.xp }}</span>
          <span class="tabular-nums">{{ character.xp }} / {{ xpNeeded }}</span>
        </div>
        <div class="xp mt-1 h-1.5 rounded-full">
          <div class="h-full rounded-full bg-gold" :style="{ width: `${Math.min(100, (character.xp / xpNeeded) * 100)}%` }" />
        </div>
      </div>
      <div class="mt-3">
        <div class="font-display text-xs tracking-[0.15em] text-ink-soft uppercase">{{ T.pathAndUpgrades }}</div>
        <div class="mt-1.5 flex min-h-9 flex-wrap items-center gap-1.5">
          <HoverNote v-if="path" class="mr-2">
            <div class="flex items-center gap-2">
              <PictogramTile :name="path.icon" :size="34" />
              <span class="font-display text-sm tracking-[0.06em]">{{ path.name }}</span>
            </div>
            <template #note>
              <p class="font-display text-sm tracking-[0.06em]">{{ path.name }}</p>
              <p class="text-[11px] italic text-ink-soft">{{ T.pathNote }}</p>
              <p class="text-sm leading-snug">{{ path.text }}</p>
            </template>
          </HoverNote>
          <HoverNote v-for="u in upgrades" :key="u.id">
            <div class="relative">
              <PictogramTile :name="u.icon" :size="28" />
              <span v-if="u.count > 1" class="badge absolute -right-1.5 -bottom-1.5 rounded-full px-1 font-display text-[10px] leading-4 tabular-nums">×{{ u.count }}</span>
            </div>
            <template #note>
              <p class="font-display text-sm tracking-[0.06em]">{{ u.name }}<template v-if="u.count > 1"> ×{{ u.count }}</template></p>
              <p class="text-[11px] italic text-ink-soft">{{ u.kind }}</p>
              <p v-for="l in u.lines" :key="l" class="text-sm leading-snug">{{ l }}<template v-if="u.count > 1"> ({{ T.each }})</template></p>
            </template>
          </HoverNote>
          <span v-if="!path && upgrades.length === 0" class="italic text-ink-soft/80">{{ T.noUpgrades }}</span>
        </div>
      </div>
      <div ref="slotsEl" class="mt-3 flex justify-center gap-1">
        <div v-for="slot in ['weapon', 'trinket'] as const" :key="slot" class="relative">
          <ItemSlot :kind="slot" :item="character[slot]" :open="openSlot === slot" @click="toggleSlot(slot)" />
          <div
            v-if="openSlot === slot"
            :ref="setPicker"
            class="absolute z-30"
            :class="aside ? 'right-full bottom-0 mr-3' : 'top-[68px] left-1/2 mt-1 -translate-x-1/2'"
          >
            <ItemPicker :game="game" :character-id="character.id" :slot="slot" @equip="onEquip" @take-off="onTakeOff" @preview="preview = $event" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.xp {
  background: rgb(58 39 23 / 0.18);
  box-shadow: inset 0 0 0 1px rgb(58 39 23 / 0.25);
}
.delta.is-better {
  color: var(--color-gold);
}
.delta.is-worse {
  color: var(--color-blood);
}
.badge {
  color: var(--color-parchment);
  background: var(--color-ink);
  border: 1px solid var(--color-gold);
}
</style>
