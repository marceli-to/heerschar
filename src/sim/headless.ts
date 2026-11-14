import { DT, TICK_RATE } from './balance';
import { createBattle, step, type BattleSetup } from './battle';
import { botInput, createBot } from './bot';
import type { Battle, BattleEvent, Outcome } from './types';

export interface HeadlessResult {
  outcome: Outcome;
  /** Battle seconds, countdown included. */
  seconds: number;
  /** Damage dealt by the hero and by the whole player side (shield-absorbed points excluded). */
  heroDamage: number;
  playerDamage: number;
  battle: Battle;
  events: BattleEvent[];
}

/** Plays a battle with the bot hero until it ends or `maxSeconds` pass. */
export function playHeadless(setup: BattleSetup, maxSeconds = 180): HeadlessResult {
  const battle = createBattle(setup);
  const bot = createBot();
  const events: BattleEvent[] = [];
  const team = new Map(battle.units.map((u) => [u.id, u]));
  let heroDamage = 0;
  let playerDamage = 0;
  while (battle.outcome === 'running' && battle.tick < maxSeconds * TICK_RATE) {
    for (const e of step(battle, botInput(battle, bot), DT)) {
      events.push(e);
      if (e.type !== 'hit') continue;
      const attacker = team.get(e.attackerId);
      if (attacker?.team !== 'player') continue;
      playerDamage += e.amount;
      if (attacker.isHero) heroDamage += e.amount;
    }
  }
  return { outcome: battle.outcome, seconds: battle.tick / TICK_RATE, heroDamage, playerDamage, battle, events };
}
