<script setup lang="ts">
import { ref } from 'vue';
import { STRINGS } from '../../data/strings';
import WarTable from './WarTable.vue';
import WaxSeal from './WaxSeal.vue';

/**
 * Title (approved 3b): the name in gold on a hanging parchment banner, a wax seal, New Game.
 * With a save (approved 4): Continue above New Game; New Game asks before abandoning the save.
 */
const props = defineProps<{ hasSave: boolean }>();
const emit = defineEmits<{ continue: []; newGame: [] }>();
const confirming = ref(false);

function newGame(): void {
  if (props.hasSave) confirming.value = true;
  else emit('newGame');
}
</script>

<template>
  <WarTable>
    <div class="flex flex-col items-center">
      <!-- rod with gold finials -->
      <div class="relative h-3.5 w-[min(620px,86vw)] rounded-full bg-[linear-gradient(#5a3a22,#2a170b)] shadow-[0_4px_8px_rgb(5_2_1/0.6)]">
        <span class="finial left-[-14px]" />
        <span class="finial right-[-14px]" />
      </div>
      <div class="banner parchment -mt-1 flex w-[min(540px,76vw)] flex-col items-center px-10 pt-14 pb-28">
        <h1 class="title-gold font-display text-[clamp(36px,6vw,64px)] leading-none font-bold tracking-[0.08em]">{{ STRINGS.title }}</h1>
        <div class="rule mt-6 w-2/3" />
      </div>
      <WaxSeal class="-mt-16" :size="96" />
      <button v-if="hasSave" class="btn-gold mt-8 rounded-sm px-10 py-3 text-base" @click="emit('continue')">{{ STRINGS.prep.continue }}</button>
      <button v-if="hasSave" class="btn-gold mt-4 rounded-sm px-8 py-2.5 text-sm" @click="newGame">{{ STRINGS.prep.newGame }}</button>
      <button v-else class="btn-gold mt-8 rounded-sm px-10 py-3 text-base" @click="newGame">{{ STRINGS.prep.newGame }}</button>
    </div>
    <div v-if="confirming" class="fixed inset-0 z-20 flex items-center justify-center bg-black/55" @click.self="confirming = false">
      <div class="parchment flex w-[min(420px,86vw)] flex-col items-center rounded-sm px-10 py-8 text-center">
        <p class="font-display text-lg">{{ STRINGS.prep.abandon }}</p>
        <div class="rule mt-4 w-2/3" />
        <button class="btn-gold mt-6 rounded-sm px-8 py-2.5 text-sm" @click="emit('newGame')">{{ STRINGS.prep.confirm }}</button>
        <button class="mt-4 font-display text-xs tracking-[0.15em] text-ink-soft underline-offset-4 hover:underline" @click="confirming = false">{{ STRINGS.prep.back }}</button>
      </div>
    </div>
  </WarTable>
</template>

<style scoped>
.finial {
  position: absolute;
  top: 50%;
  width: 24px;
  height: 24px;
  transform: translateY(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--color-gold-light), var(--color-gold) 55%, #6b4a14);
  box-shadow: 0 2px 4px rgb(5 2 1 / 0.6);
}
.banner {
  /* swallow-tail bottom */
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%);
  border: none;
  outline: none;
  filter: drop-shadow(0 10px 18px rgb(5 2 1 / 0.6));
}
.title-gold {
  background: linear-gradient(180deg, #f3d98c 0%, #d4a338 45%, #9a6e1e 70%, #e0bf6a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 rgb(58 39 23 / 0.9)) drop-shadow(0 0 1px rgb(58 39 23 / 0.8));
}
</style>
