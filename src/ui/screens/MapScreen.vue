<script setup lang="ts">
import { computed, ref } from 'vue';
import { NODES, REGIONS, isCampId, nodeById, regionBoss, regionNodes, type CampId, type CampaignNode, type RegionId } from '../../data/campaign';
import { ENCOUNTERS, type EncounterId } from '../../data/encounters';
import { STRINGS } from '../../data/strings';
import { isNodeDone, isNodeOpen, isRegionOpen, type GameState } from '../../meta/game';
import ClassMedallion from '../hud/ClassMedallion.vue';
import HoverNote from './HoverNote.vue';
import WarTable from './WarTable.vue';
import WaxSeal, { type SealIcon, type SealWax } from './WaxSeal.vue';
import { CARTOUCHE, COMPASS, GLYPHS, SHEET_H, SHEET_W, regionMarks, regionRoads, toSheet } from './mapSketch';

/**
 * The campaign map (approved 5c): one panel sheet per region on the war table, bookmark
 * ribbons on top to switch region (locked ones greyed with a lock), light ink sketches of the
 * land, dotted roads, wax-seal nodes (red battle, black elite, green camp, large red boss).
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
    <div class="flex w-[min(1120px,94vw,calc((100vh-190px)*5/3))] flex-col items-center">
      <p class="mb-10 text-lg italic text-cream/70">
        {{ STRINGS.map.hint }}
      </p>

      <div class="relative w-full">
        <!-- Bookmark ribbons hanging over the top edge of the sheet. -->
        <div class="absolute -top-7 left-12 z-10 flex gap-4">
          <HoverNote v-for="r in REGIONS" :key="r" :disabled="isRegionOpen(game, r)" below>
            <button
              class="ribbon relative flex w-44 items-start justify-center pt-3 font-display text-[11px] font-bold tracking-[0.14em] uppercase"
              :class="[r === region ? 'active' : '', isRegionOpen(game, r) ? 'cursor-pointer' : 'locked cursor-default']"
              :aria-pressed="r === region"
              :disabled="!isRegionOpen(game, r)"
              @click="selectRegion(r)"
            >
              <svg v-if="!isRegionOpen(game, r)" class="mr-1.5 -mt-px" width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
                <path d="M2.5 6 V4 a3 3 0 0 1 6 0 V6" fill="none" stroke="currentColor" stroke-width="1.4" />
                <rect x="1" y="6" width="9" height="6.5" rx="1" fill="currentColor" />
              </svg>
              {{ STRINGS.regions[r] }}
            </button>
            <template #note>
              <p class="text-sm italic">{{ STRINGS.map.regionLocked }}: {{ STRINGS.regions[REGIONS[regionIndex(r) - 1]!] }}.</p>
            </template>
          </HoverNote>
        </div>

        <!-- The region sheet. -->
        <div class="sheet panel relative w-full" :class="region">
          <div class="wash pointer-events-none absolute inset-0" />
          <svg class="absolute inset-0 h-full w-full" :viewBox="`0 0 ${SHEET_W} ${SHEET_H}`" aria-hidden="true">
            <!-- Ink sketches of the land. -->
            <g class="ink" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <g v-for="(m, i) in marks" :key="i" :transform="`translate(${m.x.toFixed(1)} ${m.y.toFixed(1)}) scale(${(m.flip ? -m.scale : m.scale).toFixed(2)} ${m.scale.toFixed(2)})`">
                <path :d="GLYPHS[m.glyph].ink" stroke-width="1.3" />
                <path v-if="GLYPHS[m.glyph].shade" :d="GLYPHS[m.glyph].shade" stroke-width="0.8" />
              </g>
            </g>

            <!-- Dotted roads. -->
            <g fill="none" stroke-linecap="round">
              <path v-for="road in roads" :key="`${road.from}-${road.to}`" :d="road.d" class="road" :class="{ walked: walked(road.from) }" stroke-width="3.6" stroke-dasharray="0.1 9" />
            </g>

            <!-- Compass rose. -->
            <g class="ink" :transform="`translate(${COMPASS.x} ${COMPASS.y})`">
              <circle :r="COMPASS.r * 0.62" fill="none" stroke-width="1" />
              <circle :r="COMPASS.r * 0.56" fill="none" stroke-width="0.6" />
              <path :d="`M0 ${-COMPASS.r} L5 -5 L${COMPASS.r} 0 L5 5 L0 ${COMPASS.r} L-5 5 L${-COMPASS.r} 0 L-5 -5 Z`" fill="none" stroke-width="1.2" />
              <path :d="`M0 ${-COMPASS.r} L5 -5 L0 0 Z M${COMPASS.r} 0 L5 5 L0 0 Z M0 ${COMPASS.r} L-5 5 L0 0 Z M${-COMPASS.r} 0 L-5 -5 L0 0 Z`" class="ink-fill" />
              <text :y="-COMPASS.r - 7" text-anchor="middle" font-family="Cinzel, serif" font-size="13" font-weight="700" class="ink-fill" stroke="none">N</text>
            </g>

            <!-- Cartouche with the region name. -->
            <g class="ink" :transform="`translate(${CARTOUCHE.x} ${CARTOUCHE.y})`">
              <rect :width="CARTOUCHE.w" :height="CARTOUCHE.h" fill="rgb(255 248 225 / 0.45)" stroke-width="1.4" />
              <rect x="5" y="5" :width="CARTOUCHE.w - 10" :height="CARTOUCHE.h - 10" fill="none" stroke-width="0.7" />
              <path
                :d="`M-8 6 C-14 14 -14 ${CARTOUCHE.h - 14} -8 ${CARTOUCHE.h - 6} M${CARTOUCHE.w + 8} 6 C${CARTOUCHE.w + 14} 14 ${CARTOUCHE.w + 14} ${CARTOUCHE.h - 14} ${CARTOUCHE.w + 8} ${CARTOUCHE.h - 6}`"
                fill="none"
                stroke-width="1.2"
              />
              <text
                :x="CARTOUCHE.w / 2"
                :y="CARTOUCHE.h / 2 + 1"
                text-anchor="middle"
                dominant-baseline="central"
                font-family="Cinzel, serif"
                font-size="21"
                font-weight="700"
                letter-spacing="1.5"
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
                <span v-if="done(n)" class="tick absolute -top-1 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[12px] leading-none font-bold">✓</span>
              </button>
              <template #note>
                <template v-if="n.kind === 'camp'">
                  <h3 class="font-display text-base leading-tight font-bold tracking-[0.05em]">
                    {{ STRINGS.map.camp }}
                  </h3>
                  <div class="rule mx-auto my-1.5 w-3/4" />
                  <p class="max-w-52 text-sm leading-snug italic">
                    {{ STRINGS.map.campIntro }}
                  </p>
                  <p v-if="done(n)" class="mt-1 text-xs italic text-ink-soft">
                    {{ STRINGS.map.campDone }}
                  </p>
                </template>
                <template v-else>
                  <h3 class="font-display text-base leading-tight font-bold tracking-[0.05em]">
                    {{ STRINGS.encounters[n.id as EncounterId].name }}
                  </h3>
                  <p class="level mt-0.5 font-display text-[10px] tracking-[0.2em] uppercase">
                    {{ STRINGS.prep.level }} {{ encounter(n).level }}<template v-if="n.kind === 'elite'"> · {{ STRINGS.map.elite }}</template
                    ><template v-if="n.kind === 'boss'"> · {{ STRINGS.map.boss }}</template>
                  </p>
                  <div class="rule mx-auto my-1.5 w-3/4" />
                  <div class="flex flex-col items-center gap-1">
                    <div v-for="(row, r) in rows(n)" :key="r" class="flex gap-1">
                      <ClassMedallion v-for="(u, k) in row" :key="k" :class-id="u.classId" :size="22" :title="STRINGS.classes[u.classId]" />
                    </div>
                  </div>
                  <p class="mt-1.5 max-w-52 text-sm leading-snug italic">
                    {{ STRINGS.encounters[n.id as EncounterId].intro }}
                  </p>
                  <p v-if="done(n)" class="mt-1 text-xs italic text-ink-soft">
                    {{ STRINGS.prep.replay }}
                  </p>
                </template>
                <p v-if="!open(n)" class="mt-1 font-display text-[10px] tracking-[0.18em] text-ink-soft uppercase">
                  {{ STRINGS.map.notReached }}
                </p>
              </template>
            </HoverNote>
          </div>
        </div>
      </div>

      <button class="mt-8 font-display text-xs tracking-[0.15em] text-cream/70 underline-offset-4 hover:underline" @click="emit('back')">
        {{ STRINGS.prep.back }}
      </button>
    </div>
  </WarTable>
</template>

<style scoped>
.sheet {
  aspect-ratio: 5 / 3;
}
/* A faint wash of colour per region, under the ink. */
.wash {
  mix-blend-mode: multiply;
}
.greenmarch .wash {
  background: radial-gradient(ellipse 40% 35% at 30% 65%, rgb(150 170 90 / 0.18), transparent 70%), radial-gradient(ellipse 35% 30% at 70% 30%, rgb(150 170 90 / 0.14), transparent 70%);
}
.darkwood .wash {
  background: radial-gradient(ellipse 50% 45% at 45% 50%, rgb(70 100 60 / 0.22), transparent 75%), radial-gradient(ellipse 30% 30% at 85% 45%, rgb(60 80 50 / 0.18), transparent 70%);
}
.barrowlands .wash {
  background: radial-gradient(ellipse 50% 45% at 50% 50%, rgb(110 105 110 / 0.2), transparent 75%), radial-gradient(ellipse 25% 30% at 90% 45%, rgb(80 80 100 / 0.2), transparent 70%);
}
.ink {
  stroke: rgb(70 46 26 / 0.62);
}
.ink-fill {
  fill: rgb(70 46 26 / 0.75);
}
.road {
  stroke: rgb(70 46 26 / 0.32);
}
.road.walked {
  stroke: rgb(70 46 26 / 0.85);
}

/* Ribbons: cloth bookmarks with a swallow-tail end, tucked behind the sheet's top edge. */
.ribbon {
  height: 58px;
  color: var(--color-gold-light);
  background: linear-gradient(90deg, #6e1d14, #8f2a1d 30%, #9b2d20 60%, #6e1d14);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%);
  box-shadow: inset 0 10px 8px -6px rgb(10 5 2 / 0.6);
  filter: drop-shadow(0 3px 3px rgb(10 5 2 / 0.5)) brightness(0.78);
  transition:
    height 140ms,
    filter 140ms;
}
.ribbon:not(.locked):hover {
  filter: drop-shadow(0 3px 3px rgb(10 5 2 / 0.5)) brightness(0.92);
}
.ribbon.active {
  height: 72px;
  filter: drop-shadow(0 3px 3px rgb(10 5 2 / 0.5));
  text-shadow: 0 1px 0 rgb(30 10 5 / 0.6);
}
.ribbon.locked {
  color: rgb(241 228 195 / 0.45);
  background: linear-gradient(90deg, #3f362c, #564a3c 40%, #4a4034 70%, #3f362c);
  filter: drop-shadow(0 3px 3px rgb(10 5 2 / 0.5)) brightness(0.85);
}

.seal {
  transition: transform 140ms;
}
.seal.live:hover {
  transform: translateY(-3px) scale(1.06);
}
/* Unreachable: washed out toward the panel but opaque, so the roads stay under the seal. */
.seal.faded {
  filter: grayscale(0.75) sepia(0.35) brightness(1.55) contrast(0.45);
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
  color: #fff6d8;
  background: radial-gradient(circle at 40% 35%, #f0d27a, #b98a2e 70%);
  border: 1px solid #6b4d18;
  box-shadow: 0 0 6px rgb(224 191 106 / 0.7);
}
.level {
  color: #8a6a2c;
}
@media (prefers-reduced-motion: reduce) {
  .glow {
    animation: none;
  }
}
</style>
