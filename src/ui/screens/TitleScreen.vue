<script setup lang="ts">
import { ref } from 'vue';
import { STRINGS } from '../../data/strings';
import WarTable from './WarTable.vue';
import WaxSeal from './WaxSeal.vue';
import SettingsSheet from '../settings/SettingsSheet.vue';
import CreditsSheet from '../settings/CreditsSheet.vue';

/**
 * Title (approved 3b): the name in gold on a hanging banner (restyled 6i), a wax seal, New Game.
 * With a save (approved 4): Continue above New Game; New Game asks before abandoning the save.
 * Settings (approved 6g) under them, opening the settings sheet over the table; Credits (6h) likewise.
 */
const props = defineProps<{ hasSave: boolean }>();
const emit = defineEmits<{ continue: []; newGame: [] }>();
const confirming = ref(false);
const showSettings = ref(false);
const showCredits = ref(false);

function newGame(): void {
  if (props.hasSave) confirming.value = true;
  else emit('newGame');
}
</script>

<template>
  <WarTable>
    <div class="flex flex-col items-center">
      <!-- rod with gold finials -->
      <div class="rod relative h-5 w-[min(620px,86vw)] rounded-full">
        <span class="finial left-[-14px]" />
        <span class="finial right-[-14px]" />
      </div>
      <div class="banner-wrap -mt-1.5 w-[min(540px,76vw)]">
        <div class="banner-ink p-[3px] pt-0">
          <div class="banner flex flex-col items-center px-10 pt-14 pb-28">
            <h1 class="title-gold text-[clamp(2.75rem,8vw,5.5rem)] leading-none">{{ STRINGS.title }}</h1>
          </div>
        </div>
      </div>
      <WaxSeal class="-mt-16" :size="96" />
      <div class="mt-6 flex flex-col items-center gap-4">
        <button v-if="hasSave" class="btn min-w-60" @click="emit('continue')">{{ STRINGS.prep.continue }}</button>
        <button v-if="hasSave" class="btn btn-sm btn-yellow min-w-60" @click="newGame">{{ STRINGS.prep.newGame }}</button>
        <button v-else class="btn min-w-60" @click="newGame">{{ STRINGS.prep.newGame }}</button>
        <div class="flex gap-3">
          <button class="btn btn-sm btn-yellow" @click="showSettings = true">{{ STRINGS.settings.open }}</button>
          <button class="btn btn-sm btn-yellow" @click="showCredits = true">{{ STRINGS.credits.open }}</button>
        </div>
      </div>
    </div>
    <div v-if="showSettings" class="fixed inset-0 z-20 flex items-center justify-center bg-black/55">
      <SettingsSheet @done="showSettings = false" />
    </div>
    <div v-if="showCredits" class="fixed inset-0 z-20 flex items-center justify-center bg-black/55" @click.self="showCredits = false">
      <CreditsSheet @done="showCredits = false" />
    </div>
    <div v-if="confirming" class="fixed inset-0 z-20 flex items-center justify-center bg-black/55" @click.self="confirming = false">
      <div class="panel flex w-[min(420px,86vw)] flex-col items-center px-10 py-8 text-center">
        <p class="heading-3 text-2xl text-balance">{{ STRINGS.prep.abandon }}</p>
        <div class="rule mt-4 w-2/3" />
        <button class="btn mt-6" @click="emit('newGame')">{{ STRINGS.prep.confirm }}</button>
        <button class="link mt-3" @click="confirming = false">{{ STRINGS.prep.back }}</button>
      </div>
    </div>
  </WarTable>
</template>

<style scoped>
.rod {
  background: linear-gradient(var(--color-wood-light), var(--color-wood));
  border: 3px solid var(--color-ink);
  box-shadow: inset 0 3px 0 rgb(255 255 255 / 0.18), 0 4px 0 var(--color-ink);
}
.finial {
  position: absolute;
  top: 50%;
  width: 30px;
  height: 30px;
  transform: translateY(-50%);
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #ffe9a0, var(--color-gold) 60%, #b07418);
  border: 3px solid var(--color-ink);
}
/* Cream banner with a swallow-tail bottom inside an ink copy of itself (the outline), with a hard drop shadow. */
.banner-ink {
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 84%, 0 100%);
  background: var(--color-ink);
}
.banner {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 4px), 50% calc(84% - 3px), 0 calc(100% - 4px));
  background: linear-gradient(var(--color-cream), var(--color-cream-dark));
}
.banner-wrap {
  filter: drop-shadow(0 6px 0 var(--color-ink));
}
</style>
