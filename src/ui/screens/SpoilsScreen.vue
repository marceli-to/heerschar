<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { STRINGS } from '../../data/strings';
import { xpAt } from '../../meta/describe';
import { characterOf, choose, currentChoice, takeLoot, type Choice, type GameState } from '../../meta/game';
import { isFielded } from '../../meta/squad';
import ClassMedallion from '../hud/ClassMedallion.vue';
import ItemCard from './ItemCard.vue';
import UpgradeCard from './UpgradeCard.vue';
import WarTable from './WarTable.vue';
import ScreenFrame from './ScreenFrame.vue';

/**
 * Spoils on the war table after a first win (approved Stage 4): experience bars fill, then a
 * pick page per level reached (upgrade, or the path at level 5), then the loot. Every pick goes
 * straight into the game state (and the save), so a reload resumes at the open pick.
 */
const props = defineProps<{ game: GameState }>();
const emit = defineEmits<{ done: [] }>();

const T = STRINGS.spoils;

type Page = 'xp' | 'choice' | 'loot';
const page = ref<Page>('xp');
const choice = ref<Choice | null>(null);
/** Picks owed when the spoils opened, for "Pick n of m". */
const totalPicks = props.game.rewards?.choices.length ?? 0;

const rewards = computed(() => props.game.rewards);
const encounterName = computed(() => (rewards.value ? STRINGS.encounters[rewards.value.encounterId].name : ''));

// ---------------------------------------------------------------------------------------------
// Experience

/** Fielded first (in field order), then the bench. */
const gains = computed(() => {
  const r = rewards.value;
  if (!r) return [];
  const squad = props.game.squad;
  const rank = (id: number) => (isFielded(squad, id) ? squad.fielded.indexOf(id) : 100 + id);
  return [...r.xp].sort((a, b) => rank(a.characterId) - rank(b.characterId)).map((g) => ({ gain: g, character: characterOf(props.game, g.characterId), bench: !isFielded(squad, g.characterId) }));
});

const t = ref(0);
let raf = 0;
const FILL_SECONDS = 1.6;
const DELAY_SECONDS = 0.35;

onMounted(() => {
  if (!rewards.value) {
    emit('done');
    return;
  }
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    t.value = 1;
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    const s = (now - start) / 1000 - DELAY_SECONDS;
    // ease out so the bars settle
    const x = Math.min(1, Math.max(0, s / FILL_SECONDS));
    t.value = 1 - (1 - x) ** 3;
    if (x < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
});
onBeforeUnmount(() => cancelAnimationFrame(raf));

// ---------------------------------------------------------------------------------------------
// Picks

/** Moves on to whatever is still owed: the next pick, the loot, or out. */
function advance(): void {
  t.value = 1;
  cancelAnimationFrame(raf);
  choice.value = currentChoice(props.game);
  if (choice.value) page.value = 'choice';
  else if (props.game.rewards?.loot) page.value = 'loot';
  else emit('done');
}

const picker = computed(() => (choice.value ? characterOf(props.game, choice.value.characterId) : null));
const pickNumber = computed(() => totalPicks - (props.game.rewards?.choices.length ?? 0) + 1);

/** `from` is the choice the card was drawn for: clicks on a card still fading out (or a double click) are ignored. */
function pick(from: Choice, option: string): void {
  if (props.game.rewards?.choices[0] !== from) return;
  choose(props.game, option);
  advance();
}

function keep(itemId: string): void {
  if (!props.game.rewards?.loot?.includes(itemId)) return;
  takeLoot(props.game, itemId);
  advance();
}
</script>

<template>
  <WarTable>
    <Transition name="page" mode="out-in">
      <!-- Experience -->
      <ScreenFrame v-if="page === 'xp'" key="xp" class="w-[min(640px,94vw)]" :title="T.title" :subtitle="encounterName">
        <div class="panel w-full px-9 pt-6 pb-5">
          <p class="mb-3 text-center text-lg text-ink-soft">{{ T.xpHint }}</p>
          <ul class="flex flex-col">
            <li
              v-for="{ gain, character, bench } in gains"
              :key="gain.characterId"
              class="grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 border-t-2 border-ink/10 py-1.5"
              :class="{ 'opacity-70': bench }"
            >
              <ClassMedallion :class-id="character.classId" :size="34" />
              <div class="min-w-0">
                <div class="flex items-baseline gap-2">
                  <span class="heading-3 truncate" :class="{ 'text-blood': character.isHero }">{{ character.name }}</span>
                  <span v-if="bench" class="note">{{ T.bench }}</span>
                  <span v-if="xpAt(gain, t).level > gain.fromLevel" class="level-up label ml-auto text-amber">{{ T.levelUp }}</span>
                </div>
                <div class="bar bar-thin mt-0.5 h-3.5">
                  <div class="fill fill-xp" :style="{ width: `${Math.min(100, (xpAt(gain, t).xp / xpAt(gain, t).needed) * 100)}%` }" />
                </div>
              </div>
              <div class="w-24 text-right">
                <div class="font-display text-lg tabular-nums">{{ T.level }} {{ xpAt(gain, t).level }}</div>
                <div class="label text-leaf tabular-nums">+{{ Math.round(gain.amount * t) }} XP</div>
              </div>
            </li>
          </ul>
        </div>
        <template #action><button class="btn" @click="advance">{{ T.next }}</button></template>
      </ScreenFrame>

      <!-- Upgrade or path pick -->
      <ScreenFrame v-else-if="page === 'choice' && choice && picker" :key="`choice-${pickNumber}`" :title="T.title" :subtitle="T.pickCount(pickNumber, totalPicks)">
        <div class="flex items-center gap-4">
          <ClassMedallion :class-id="picker.classId" :size="52" />
          <div>
            <h3 class="heading-screen text-left">{{ picker.name }}</h3>
            <p class="table-text text-lg">{{ STRINGS.classes[picker.classId] }} · {{ T.level }} {{ choice.level }}</p>
          </div>
        </div>
        <p class="table-text font-display text-2xl">{{ choice.kind === 'path' ? T.choosePath : T.chooseUpgrade }}</p>
        <div class="mt-2 flex flex-wrap justify-center gap-8">
          <UpgradeCard v-for="id in choice.options" :key="id" :kind="choice.kind" :id="id" @click="pick(choice, id)" />
        </div>
      </ScreenFrame>

      <!-- Loot -->
      <ScreenFrame v-else-if="page === 'loot' && rewards?.loot" key="loot" :title="T.title" :subtitle="T.lootHint">
        <div class="mt-2 flex flex-wrap justify-center gap-8">
          <ItemCard v-for="id in rewards.loot" :key="id" :id="id" @click="keep(id)" />
        </div>
      </ScreenFrame>
    </Transition>
  </WarTable>
</template>

<style scoped>
.level-up {
  text-shadow: 0 2px 0 rgb(255 255 255 / 0.6);
  animation: pop 0.35s ease-out both;
}
@keyframes pop {
  from {
    transform: scale(1.6);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
.page-enter-active,
.page-leave-active {
  transition: opacity 180ms, transform 180ms;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.page-leave-to {
  opacity: 0;
}
</style>
