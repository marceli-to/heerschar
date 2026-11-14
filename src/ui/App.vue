<script setup lang="ts">
import { computed } from 'vue';
import { ENCOUNTERS, type EncounterId } from '../data/encounters';
import { STRINGS } from '../data/strings';
import { encounterSpec, trialSpec } from '../game/specs';
import { heroOfSquad } from '../meta/squad';
import { isUnlocked } from '../meta/game';
import type { PlayableClassId } from '../sim/types';
import BattleView from './BattleView.vue';
import ClassSelect from './screens/ClassSelect.vue';
import FormationScreen from './screens/FormationScreen.vue';
import OrdersScreen from './screens/OrdersScreen.vue';
import SquadScreen from './screens/SquadScreen.vue';
import SpoilsScreen from './screens/SpoilsScreen.vue';
import TitleScreen from './screens/TitleScreen.vue';
import { battleEnded, continueGame, goTo, leaveBattle, prepare, session, spoilsDone, startBattle, startDevGame, startNewGame } from './session';

const HERO_CLASSES: readonly PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

const params = new URLSearchParams(location.search);
const heroParam = HERO_CLASSES.find((c) => c === params.get('hero'));
const battleParam = ENCOUNTERS.find((e) => e.id === params.get('battle'))?.id;
const trial = params.has('trial');
const flags = {
  debug: params.has('debug'),
  peaceful: params.has('peaceful'),
  bot: params.has('bot'),
  zoom: params.has('zoom') ? Number(params.get('zoom')) : undefined,
};
const fixedSeed = Number(params.get('seed')) || null;

// Dev shortcut: any battle parameter skips the screens and goes straight into a battle.
if (trial || flags.bot || heroParam || battleParam || flags.peaceful) {
  const heroClass = heroParam ?? 'krieger';
  startDevGame(heroClass, STRINGS.heroNames[heroClass]);
  startBattle(battleParam ?? 'skirmish');
}

const spec = computed(() => {
  const squad = session.game?.squad;
  if (!squad) return null;
  if (trial) {
    const hero = heroOfSquad(squad);
    return trialSpec(hero.classId, hero.name);
  }
  return encounterSpec(squad, session.encounterId);
});

/** `?seed=` fixes the first battle's seed; otherwise every battle gets a fresh one. */
const seed = computed(() => (fixedSeed !== null && session.battleRun <= 1 ? fixedSeed : (Date.now() + session.battleRun * 7919) >>> 0));

function ended(won: boolean): void {
  if (!trial) battleEnded(won);
}

function fight(id: EncounterId): void {
  if (session.game && isUnlocked(session.game, id)) prepare(id);
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <TitleScreen v-if="session.screen === 'title'" :has-save="session.hasSave" @continue="continueGame" @new-game="goTo('classSelect')" />
    <ClassSelect v-else-if="session.screen === 'classSelect'" @choose="startNewGame" @back="goTo('title')" />
    <OrdersScreen v-else-if="session.screen === 'orders' && session.game" :game="session.game" @fight="fight" @back="goTo('title')" />
    <SquadScreen
      v-else-if="session.screen === 'squad' && session.game"
      :game="session.game"
      :squad="session.game.squad"
      :encounter-id="session.encounterId"
      @next="goTo('formation')"
      @back="goTo('orders')"
    />
    <FormationScreen
      v-else-if="session.screen === 'formation' && session.game"
      :game="session.game"
      :squad="session.game.squad"
      :encounter-id="session.encounterId"
      @next="startBattle(session.encounterId)"
      @back="goTo('squad')"
    />
    <BattleView
      v-else-if="session.screen === 'battle' && spec"
      :key="session.battleRun"
      :spec="spec"
      :seed="seed"
      v-bind="flags"
      :can-leave="!trial"
      @ended="ended"
      @leave="leaveBattle('orders')"
      @change-squad="leaveBattle('squad')"
    />
    <SpoilsScreen v-else-if="session.screen === 'spoils' && session.game" :game="session.game" @done="spoilsDone()" />
  </div>
</template>
