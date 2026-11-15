<script setup lang="ts">
import { keyLabel } from '../settings/settings';
import { settings } from '../settings/store';
import { computed } from 'vue';
import type { HudState } from '../game/game';
import { STRINGS } from '../data/strings';
import AbilitySlot from './hud/AbilitySlot.vue';
import ClassMedallion from './hud/ClassMedallion.vue';
import EdgeMarker from './hud/EdgeMarker.vue';
import SquadCard from './hud/SquadCard.vue';

const props = defineProps<{ hud: HudState }>();

const hpFrac = computed(() => Math.max(0, props.hud.heroHp / props.hud.heroMaxHp));
const lowHp = computed(() => hpFrac.value < 0.3);
const energyFrac = computed(() => Math.max(0, props.hud.energy / props.hud.maxEnergy));
const bossFrac = computed(() => (props.hud.boss ? Math.max(0, props.hud.boss.hp / props.hud.boss.maxHp) : 0));
const time = computed(() => {
  const s = Math.floor(props.hud.time);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
});
</script>

<template>
  <div class="pointer-events-none absolute inset-0 font-body select-none">
    <!-- Foes remaining and battle time -->
    <div class="plate absolute top-4 left-1/2 flex -translate-x-1/2 items-center gap-4 px-5 py-1">
      <div class="flex items-center gap-2">
        <span class="label">{{ STRINGS.foes }}</span>
        <span class="font-display text-[1.625rem] leading-none text-blood tabular-nums">{{ hud.foes }}</span>
      </div>
      <div class="h-6 w-[3px] rounded-full bg-ink/15" />
      <div class="flex items-center gap-2">
        <span class="label">{{ STRINGS.time }}</span>
        <span class="font-display text-[1.625rem] leading-none tabular-nums">{{ time }}</span>
      </div>
    </div>

    <!-- Boss bar: name, medallion and a long health bar under the foes plate -->
    <div
      v-if="hud.boss"
      class="plate absolute top-[74px] left-1/2 flex w-[min(560px,70vw)] -translate-x-1/2 items-center gap-3 px-4 py-2 transition-opacity duration-700"
      :class="{ 'opacity-0': hud.boss.dead }"
    >
      <ClassMedallion :class-id="hud.boss.classId" :size="42" />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between">
          <span class="heading-3 truncate">{{ STRINGS.bossTitle(STRINGS.classes[hud.boss.classId]) }}</span>
          <span class="font-display text-lg tabular-nums">{{ hud.boss.hp }} / {{ Math.ceil(hud.boss.maxHp) }}</span>
        </div>
        <div class="bar mt-1 h-5">
          <div class="fill fill-hp transition-[width] duration-150" :style="{ width: `${bossFrac * 100}%` }" />
        </div>
      </div>
    </div>

    <!-- Bottom row: hero plate, abilities, squad panel -->
    <div class="absolute right-5 bottom-5 left-5 flex items-end gap-3">
      <div class="plate w-72 shrink-0 px-4 pt-2 pb-3">
        <div class="flex items-baseline justify-between">
          <span class="min-w-0 truncate">
            <span class="heading-3">{{ hud.heroName || STRINGS.classes[hud.heroClass] }}</span>
            <span v-if="hud.heroName" class="label ml-1.5">{{ STRINGS.classes[hud.heroClass] }}</span>
          </span>
          <span class="font-display text-lg tabular-nums">{{ hud.heroHp }} / {{ hud.heroMaxHp }}</span>
        </div>
        <div class="bar mt-1 h-4.5">
          <div class="fill fill-hp transition-[width] duration-150" :class="{ 'animate-pulse': lowHp }" :style="{ width: `${hpFrac * 100}%` }" />
        </div>
        <div class="mt-1.5 flex items-center gap-2">
          <div class="bar bar-thin h-3.5 flex-1">
            <div class="fill fill-energy transition-[width] duration-100" :style="{ width: `${energyFrac * 100}%` }" />
          </div>
          <span class="w-7 text-right font-display text-lg tabular-nums text-energy">{{ hud.energy }}</span>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <div class="bar bar-thin h-3 w-20">
            <div class="fill fill-gold" :style="{ width: `${hud.dodgeReady * 100}%` }" />
          </div>
          <span class="label" :class="{ 'opacity-60': hud.dodgeReady < 1 }">{{ STRINGS.dodge }} · {{ keyLabel(settings.keys.dodge) }}</span>
        </div>
      </div>

      <div v-if="hud.abilities.length" class="flex shrink-0 gap-2.5 pb-1">
        <AbilitySlot v-for="a in hud.abilities" :key="a.id" :ability="a" />
      </div>

      <div v-if="hud.squad.length" class="ml-3 flex min-w-0 flex-1 items-end gap-2">
        <SquadCard v-for="c in hud.squad" :key="c.id" :companion="c" />
      </div>
    </div>

    <!-- Edge markers: off-screen companions in danger and the marked enemy -->
    <EdgeMarker v-for="m in hud.edgeMarkers" :key="`${m.kind}-${m.id}`" :marker="m" />

    <!-- Countdown -->
    <div
      v-if="hud.phase === 'playing' && hud.countdown > 0"
      class="absolute inset-0 flex items-center justify-center"
    >
      <span
        :key="hud.countdown"
        class="countdown heading-screen text-[8.75rem] [-webkit-text-stroke-width:6px] [text-shadow:0_8px_0_var(--color-ink),0_0_40px_rgb(255_200_90/0.6)]"
      >{{ hud.countdown }}</span>
    </div>
  </div>
</template>

<style scoped>
.countdown {
  animation: count 1s ease-out both;
}
@keyframes count {
  from {
    transform: scale(1.5);
    opacity: 0;
  }
  25% {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.9);
    opacity: 0.2;
  }
}
</style>
