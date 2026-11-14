<script setup lang="ts">
import { computed } from 'vue';
import { ENCOUNTERS, type EncounterId } from '../data/encounters';
import { newSquad } from '../data/roster';
import { STRINGS } from '../data/strings';
import { encounterSpec, trialSpec } from '../game/specs';
import { heroOfSquad } from '../meta/squad';
import type { PlayableClassId } from '../sim/types';
import BattleView from './BattleView.vue';
import ClassSelect from './screens/ClassSelect.vue';
import FormationScreen from './screens/FormationScreen.vue';
import OrdersScreen from './screens/OrdersScreen.vue';
import SquadScreen from './screens/SquadScreen.vue';
import TitleScreen from './screens/TitleScreen.vue';
import { goTo, markWon, prepare, session, startBattle } from './session';

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
  session.squad = newSquad(heroClass, STRINGS.heroNames[heroClass]);
  startBattle(battleParam ?? 'skirmish');
}

const spec = computed(() => {
  const squad = session.squad;
  if (!squad) return null;
  if (trial) {
    const hero = heroOfSquad(squad);
    return trialSpec(hero.classId, hero.name);
  }
  return encounterSpec(squad, session.encounterId);
});

/** `?seed=` fixes the first battle's seed; otherwise every battle gets a fresh one. */
const seed = computed(() => (fixedSeed !== null && session.battleRun <= 1 ? fixedSeed : (Date.now() + session.battleRun * 7919) >>> 0));

function chooseHero(heroClass: PlayableClassId, name: string): void {
  session.squad = newSquad(heroClass, name);
  session.won = [];
  goTo('orders');
}

function won(): void {
  if (!trial) markWon(session.encounterId);
}

function fight(id: EncounterId): void {
  prepare(id);
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <TitleScreen v-if="session.screen === 'title'" @new-game="goTo('classSelect')" />
    <ClassSelect v-else-if="session.screen === 'classSelect'" @choose="chooseHero" @back="goTo('title')" />
    <OrdersScreen v-else-if="session.screen === 'orders'" :won="session.won" @fight="fight" @back="goTo('classSelect')" />
    <SquadScreen
      v-else-if="session.screen === 'squad' && session.squad"
      :squad="session.squad"
      :encounter-id="session.encounterId"
      @next="goTo('formation')"
      @back="goTo('orders')"
    />
    <FormationScreen
      v-else-if="session.screen === 'formation' && session.squad"
      :squad="session.squad"
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
      @won="won"
      @leave="goTo('orders')"
    />
  </div>
</template>
