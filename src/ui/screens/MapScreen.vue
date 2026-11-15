<script setup lang="ts">
import { computed, ref } from 'vue';
import { NODES, REGIONS, isCampId, nodeById, regionBoss, regionNodes, type CampId, type CampaignNode, type RegionId } from '../../data/campaign';
import { ENCOUNTERS, type EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import { isNodeDone, isNodeOpen, isRegionOpen, type GameState } from '../../meta/game';
import ClassMedallion from '../hud/ClassMedallion.vue';
import HoverNote from './HoverNote.vue';
import WarTable from './WarTable.vue';
import ScreenFrame from './ScreenFrame.vue';
import WaxSeal, { type SealIcon, type SealWax } from './WaxSeal.vue';
import { CARTOUCHE, COMPASS, GLYPHS, LAND, SHEET_H, SHEET_W, regionMarks, regionPatches, regionRoads, toSheet } from './mapSketch';

/**
 * The campaign map (approved 5c, painted in 6i): one sheet per region on the war table, bookmark
 * ribbons on top to switch region (locked ones greyed with a lock), region-coloured land with
 * filled, ink-outlined marks, sandy roads (dashed until walked), wax-seal nodes (red battle,
 * black elite, green camp, large red boss).
 * Open seals glow softly, done ones carry the gold tick, unreachable ones are faded. Hovering a
 * seal shows a note (name, level, enemies, intro); clicking an open one goes.
 */
const props = defineProps<{ game: GameState; lastNode?: string }>();
const emit = defineEmits<{
  fight: [id: EncounterId];
  camp: [id: CampId];
  back: [];
}>();

/** The sheet to show first: the last node's region while its boss stands, else the furthest open one. */
function firstRegion(): RegionId {
  const last = props.lastNode && NODES.some((n) => n.id === props.lastNode) ? nodeById(props.lastNode).region : null;
  if (last && isRegionOpen(props.game, last) && !props.game.won.includes(regionBoss(last).id as EncounterId)) return last;
  return [...REGIONS].reverse().find((r) => isRegionOpen(props.game, r)) ?? REGIONS[0]!;
}

const region = ref<RegionId>(firstRegion());
const nodes = computed(() => regionNodes(region.value));
const roads = computed(() => regionRoads(region.value));
const marks = computed(() => regionMarks(region.value));
const patches = computed(() => regionPatches(region.value));
const land = computed(() => LAND[region.value]);

const SEAL: Record<CampaignNode['kind'], { wax: SealWax; icon: SealIcon; size: number }> = {
  battle: { wax: 'red', icon: 'swords', size: 54 },
  elite: { wax: 'black', icon: 'elite', size: 56 },
  camp: { wax: 'green', icon: 'tent', size: 54 },
  boss: { wax: 'red', icon: 'crown', size: 74 },
};

const open = (n: CampaignNode) => isNodeOpen(props.game, n.id);
const done = (n: CampaignNode) => isNodeDone(props.game, n);
const encounter = (n: CampaignNode) => ENCOUNTERS.find((e) => e.id === n.id)!;

/** Enemy rows as the player sees them across the field: back row on top, front row below. */
function rows(n: CampaignNode) {
  const e = encounter(n);
  return [1, 0].map((row) => e.enemies.filter((u) => u.row === row).sort((a, b) => b.col - a.col));
}

/** A road is walked (dark) once the node it leaves is done, else faint. */
const walked = (from: string) => isNodeDone(props.game, nodeById(from));

function enter(n: CampaignNode): void {
  if (!open(n)) return;
  if (isCampId(n.id)) {
    if (!done(n)) emit('camp', n.id);
  } else emit('fight', n.id as EncounterId);
}

function selectRegion(r: RegionId): void {
  if (isRegionOpen(props.game, r)) region.value = r;
}

const regionIndex = (r: RegionId) => REGIONS.indexOf(r);
</script>

<template>
  <WarTable>
    <ScreenFrame class="w-[min(1120px,94vw,calc((100dvh-240px)*5/3))]" :title="STRINGS.map.hint">
      <div class="relative mt-6 w-full">
        <!-- Bookmark ribbons hanging over the top edge of the sheet. -->
        <div class="absolute -top-7 left-12 z-10 flex gap-4">
          <HoverNote v-for="r in REGIONS" :key="r" :disabled="isRegionOpen(game, r)" below>
            <button
              class="ribbon relative block w-44"
              :class="[r === region ? 'active' : '', isRegionOpen(game, r) ? 'cursor-pointer' : 'locked cursor-default']"
              :aria-pressed="r === region"
              :disabled="!isRegionOpen(game, r)"
              @click="selectRegion(r)"
            >
              <span class="face absolute inset-x-[3px] top-0 bottom-[3px] flex items-start justify-center pt-3 font-display text-lg">
                <svg v-if="!isRegionOpen(game, r)" class="mt-0.5 mr-1.5" width="12" height="14" viewBox="0 0 11 13" aria-hidden="true">
                  <path d="M2.5 6 V4 a3 3 0 0 1 6 0 V6" fill="none" stroke="currentColor" stroke-width="1.8" />
                  <rect x="1" y="6" width="9" height="6.5" rx="1.5" fill="currentColor" />
                </svg>
                {{ STRINGS.regions[r] }}
              </span>
            </button>
            <template #note>
              <p class="text-sm">{{ STRINGS.map.regionLocked }}: {{ STRINGS.regions[REGIONS[regionIndex(r) - 1]!] }}.</p>
            </template>
          </HoverNote>
        </div>

        <!-- The region sheet. -->
        <div class="sheet panel relative w-full" :class="region">
          <svg class="absolute inset-0 h-full w-full overflow-hidden rounded-[calc(var(--radius-sheet)-3px)]" :viewBox="`0 0 ${SHEET_W} ${SHEET_H}`" preserveAspectRatio="none" aria-hidden="true">
            <!-- Land and its patches. -->
            <rect :width="SHEET_W" :height="SHEET_H" :fill="land.base" />
            <ellipse v-for="(p, i) in patches" :key="`p${i}`" :cx="p.x" :cy="p.y" :rx="p.rx" :ry="p.ry" :fill="land[p.tone]" />

            <!-- Marks. -->
            <g class="ink" stroke-linecap="round" stroke-linejoin="round">
              <g v-for="(m, i) in marks" :key="i" :transform="`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${(m.flip ? -m.scale : m.scale).toFixed(2)} ${m.scale.toFixed(2)})`">
                <path v-for="(part, k) in GLYPHS[m.glyph]" :key="k" :d="part.d" :fill="part.fill === 'hill' ? land.hill : (part.fill ?? 'none')" :stroke-width="part.thin ? 1.4 : 2.2" />
              </g>
            </g>

            <!-- Roads: an ink edge under a sandy path; dashed until walked. -->
            <g fill="none" stroke-linecap="round">
              <template v-for="road in roads" :key="`${road.from}-${road.to}`">
                <path v-if="walked(road.from)" :d="road.d" class="road-edge" stroke-width="12" />
                <path :d="road.d" class="road" :class="{ walked: walked(road.from) }" :stroke-width="walked(road.from) ? 7 : 5" :stroke-dasharray="walked(road.from) ? undefined : '0.1 11'" />
              </template>
            </g>

            <!-- Compass rose. -->
            <g class="ink" stroke-linejoin="round" :transform="`translate(${COMPASS.x} ${COMPASS.y})`">
              <circle :r="COMPASS.r * 0.6" fill="#fff6dc" stroke-width="3" />
              <path :d="`M0 ${-COMPASS.r} L7 -7 L${COMPASS.r} 0 L7 7 L0 ${COMPASS.r} L-7 7 L${-COMPASS.r} 0 L-7 -7 Z`" fill="#f6c453" stroke-width="3" />
              <path :d="`M0 ${-COMPASS.r} L7 -7 L0 0 Z M${COMPASS.r} 0 L7 7 L0 0 Z M0 ${COMPASS.r} L-7 7 L0 0 Z M${-COMPASS.r} 0 L-7 -7 L0 0 Z`" fill="#c47a00" stroke="none" />
              <text :y="-COMPASS.r - 8" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="20" fill="#fff4d4" stroke-width="5" paint-order="stroke">N</text>
            </g>

            <!-- Cartouche with the region name. -->
            <g class="ink" :transform="`translate(${CARTOUCHE.x} ${CARTOUCHE.y})`">
              <rect y="5" :width="CARTOUCHE.w" :height="CARTOUCHE.h" rx="14" class="ink-fill" stroke="none" />
              <rect :width="CARTOUCHE.w" :height="CARTOUCHE.h" rx="14" fill="#fff6dc" stroke-width="3" />
              <text
                :x="CARTOUCHE.w / 2"
                :y="CARTOUCHE.h / 2 + 1"
                text-anchor="middle"
                dominant-baseline="central"
                font-family="Lilita One, sans-serif"
                font-size="26"
                class="ink-fill"
                stroke="none"
              >
                {{ STRINGS.regions[region] }}
              </text>
            </g>
          </svg>

          <!-- Seals. -->
          <div
            v-for="n in nodes"
            :key="n.id"
            class="absolute z-[1] -translate-x-1/2 -translate-y-1/2 hover:z-[2]"
            :style="{
              left: `${(toSheet(n).x / SHEET_W) * 100}%`,
              top: `${(toSheet(n).y / SHEET_H) * 100}%`,
            }"
          >
            <HoverNote :below="n.y < 40">
              <button class="seal relative block" :class="{ faded: !open(n), live: open(n) && !done(n) }" :disabled="!open(n) || (isCampId(n.id) && done(n))" @click="enter(n)">
                <span v-if="open(n) && !done(n)" class="glow pointer-events-none absolute inset-[-40%] rounded-full" />
                <WaxSeal class="relative" :size="SEAL[n.kind].size" :wax="SEAL[n.kind].wax" :icon="SEAL[n.kind].icon" />
                <span v-if="done(n)" class="tick coin absolute -top-1.5 -right-2 flex size-6 items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true"><path d="M2 7 L5.2 10 L11 3" fill="none" stroke="#3b2414" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </span>
              </button>
              <template #note>
                <template v-if="n.kind === 'camp'">
                  <h3 class="heading-3 text-lg">
                    {{ STRINGS.map.camp }}
                  </h3>
                  <div class="rule mx-auto my-1.5 w-3/4" />
                  <p class="max-w-52 text-sm text-pretty">
                    {{ STRINGS.map.campIntro }}
                  </p>
                  <p v-if="done(n)" class="note mt-1">
                    {{ STRINGS.map.campDone }}
                  </p>
                </template>
                <template v-else>
                  <h3 class="heading-3 text-lg">
                    {{ STRINGS.encounters[n.id as EncounterId].name }}
                  </h3>
                  <p class="label mt-0.5">
                    {{ STRINGS.prep.level }} {{ encounter(n).level }}<template v-if="n.kind === 'elite'"> · {{ STRINGS.map.elite }}</template
                    ><template v-if="n.kind === 'boss'"> · {{ STRINGS.map.boss }}</template>
                  </p>
                  <div class="rule mx-auto my-1.5 w-3/4" />
                  <div class="flex flex-col items-center gap-1">
                    <div v-for="(row, r) in rows(n)" :key="r" class="flex gap-1">
                      <ClassMedallion v-for="(u, k) in row" :key="k" :class-id="u.classId" :size="22" :title="STRINGS.classes[u.classId]" />
                    </div>
                  </div>
                  <p class="mt-1.5 max-w-52 text-sm text-pretty">
                    {{ STRINGS.encounters[n.id as EncounterId].intro }}
                  </p>
                  <p v-if="done(n)" class="note mt-1">
                    {{ STRINGS.prep.replay }}
                  </p>
                </template>
                <p v-if="!open(n)" class="label mt-1">
                  {{ STRINGS.map.notReached }}
                </p>
              </template>
            </HoverNote>
          </div>
        </div>
      </div>

      <template #back><button class="link link-light" @click="emit('back')">{{ STRINGS.prep.back }}</button></template>
    </ScreenFrame>
  </WarTable>
</template>

<style scoped>
.sheet {
  aspect-ratio: 5 / 3;
}
.ink {
  stroke: var(--color-ink);
}
.ink-fill {
  fill: var(--color-ink);
}
.road {
  stroke: rgb(59 36 20 / 0.45);
}
.road-edge {
  stroke: var(--color-ink);
}
.road.walked {
  stroke: #ecd29a;
}

/* Ribbons: cloth bookmarks with a swallow-tail end; an ink copy behind the face is the outline. */
.ribbon {
  height: 62px;
  background: var(--color-ink);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
  filter: brightness(0.82);
  transition:
    height 140ms,
    filter 140ms;
}
.ribbon .face {
  color: #fff;
  text-shadow: 0 2px 0 rgb(80 20 10 / 0.8);
  background: linear-gradient(var(--color-blood-light), var(--color-blood));
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(80% - 3px), 0 100%);
  box-shadow: inset 0 14px 10px -8px rgb(40 10 4 / 0.45);
}
.ribbon:not(.locked):hover {
  filter: brightness(0.95);
}
.ribbon.active {
  height: 76px;
  filter: none;
}
.ribbon.locked .face {
  color: rgb(255 246 220 / 0.6);
  text-shadow: none;
  background: linear-gradient(#8a7f74, #635a51);
}

.seal {
  transition: transform 140ms;
}
.seal.live:hover {
  transform: translateY(-3px) scale(1.06);
}
/* Unreachable: washed out but opaque, so the roads stay under the seal. */
.seal.faded {
  filter: grayscale(0.85) brightness(1.2) contrast(0.6);
}
.glow {
  background: radial-gradient(circle, rgb(255 210 110 / 0.75), rgb(255 190 80 / 0.25) 45%, transparent 70%);
  animation: glow 2.4s ease-in-out infinite;
}
@keyframes glow {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}
.tick {
  border-width: 2.5px;
}
@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
