<script setup lang="ts">
import { computed } from 'vue';
import { ENCOUNTERS, type EncounterId } from '../data/encounters';
import { REGIONS, type CampId } from '../data/campaign';
import { STRINGS } from '../data/strings';
import { encounterSpec, trialSpec } from '../game/specs';
import { heroOfSquad } from '../meta/squad';
import { isNodeOpen, isUnlocked } from '../meta/game';
import type { PlayableClassId } from '../sim/types';
import BattleView from './BattleView.vue';
import CampScreen from './screens/CampScreen.vue';
import ClassSelect from './screens/ClassSelect.vue';
import EndingScreen from './screens/EndingScreen.vue';
import FormationScreen from './screens/FormationScreen.vue';
import MapScreen from './screens/MapScreen.vue';
import SquadScreen from './screens/SquadScreen.vue';
import SpoilsScreen from './screens/SpoilsScreen.vue';
import TitleScreen from './screens/TitleScreen.vue';
import { battleEnded, continueGame, endingDone, goTo, leaveBattle, openCamp, prepare, session, spoilsDone, startBattle, startDevGame, startNewGame } from './session';

const HERO_CLASSES: readonly PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

const params = new URLSearchParams(location.search);
const heroParam = HERO_CLASSES.find((c) => c === params.get('hero'));
const battleParam = ENCOUNTERS.find((e) => e.id === params.get('battle'))?.id;
const trial = params.has('trial');
/** Dev: `?region=` shows any battle in another region's arena. */
const regionParam = REGIONS.find((r) => r === params.get('region'));
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
    const t = trialSpec(hero.classId, hero.name);
    return regionParam ? { ...t, region: regionParam } : t;
  }
  const e = encounterSpec(squad, session.encounterId);
  return regionParam ? { ...e, region: regionParam } : e;
});

/** `?seed=` fixes the first battle's seed; otherwise every battle gets a fresh one. */
const seed = computed(() => (fixedSeed !== null && session.battleRun <= 1 ? fixedSeed : (Date.now() + session.battleRun * 7919) >>> 0));

function ended(won: boolean): void {
  if (!trial) battleEnded(won);
}

function camp(id: CampId): void {
  const g = session.game;
  if (g && isNodeOpen(g, id) && !g.camps[id]?.done) openCamp(id);
}

function fight(id: EncounterId): void {
  if (session.game && isUnlocked(session.game, id)) prepare(id);
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-black select-none">
    <TitleScreen v-if="session.screen === 'title'" :has-save="session.hasSave" @continue="continueGame" @new-game="goTo('classSelect')" />
    <ClassSelect v-else-if="session.screen === 'classSelect'" @choose="startNewGame" @back="goTo('title')" />
    <MapScreen v-else-if="session.screen === 'map' && session.game" :game="session.game" :last-node="session.encounterId" @fight="fight" @camp="camp" @back="goTo('title')" />
    <CampScreen v-else-if="session.screen === 'camp' && session.game" :key="session.campId" :game="session.game" :camp-id="session.campId" @done="goTo('map')" @back="goTo('map')" />
    <SquadScreen
      v-else-if="session.screen === 'squad' && session.game"
      :game="session.game"
      :squad="session.game.squad"
      :encounter-id="session.encounterId"
      @next="goTo('formation')"
      @back="goTo('map')"
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
      @leave="leaveBattle('map')"
      @change-squad="leaveBattle('squad')"
    />
    <SpoilsScreen v-else-if="session.screen === 'spoils' && session.game" :game="session.game" @done="spoilsDone()" />
    <EndingScreen v-else-if="session.screen === 'ending' && session.game" :game="session.game" @done="endingDone" />
  </div>
</template>
