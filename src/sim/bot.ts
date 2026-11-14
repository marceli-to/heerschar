import { HERO_ABILITIES, heroAttack } from './balance';
import { actionTiming, meleeAttackOf } from './ai';
import { isAlive } from './combat';
import { abilityReady } from './heroControl';
import { heroKit, isRangedHero } from './heroAbilities';
import { lockTarget } from './heroTargeting';
import { angleDiff, angleTo, dist } from './math';
import { emptyInput, type Battle, type ClassId, type HeroAbilityId, type HeroInput, type Unit } from './types';

/**
 * Scripted hero for headless tests (PLAN section 13): marks the Schamane or the healer first,
 * attacks the marked or nearest enemy, dodges enemy swings and area warnings aimed at it, and
 * uses its abilities when affordable and useful. Ranged hero classes keep their distance.
 * It only produces `HeroInput`, like a player would.
 */
export interface BotState {
  /** Ticks to wait before the next attack press, so presses are not spammed every tick. */
  pressDelay: number;
  /** Ticks to wait before the next ability press. */
  abilityDelay: number;
}

export function createBot(): BotState {
  return { pressDelay: 0, abilityDelay: 0 };
}

/** Who the bot marks first, most wanted first. */
const MARK_PRIORITY: readonly ClassId[] = ['schamane', 'heiler'];
/** Prefer the marked enemy over the nearest one while it is at most this much farther away. */
const MARK_PREFERENCE = 4;
/** Ranged hero classes try to stay this far from the nearest enemy. */
const KITE_DISTANCE = 6;

function foes(battle: Battle, hero: Unit): Unit[] {
  return battle.units.filter((u) => u.team !== hero.team && isAlive(u));
}

function nearest(hero: Unit, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  for (const u of units) if (!best || dist(hero.pos, u.pos) < dist(hero.pos, best.pos)) best = u;
  return best;
}

function moveTowards(input: HeroInput, angle: number): void {
  input.moveX = Math.sin(angle);
  input.moveZ = -Math.cos(angle);
}

/** An enemy swing about to land on the hero. */
function swingThreat(battle: Battle, hero: Unit): Unit | null {
  for (const u of battle.units) {
    if (u.team === hero.team || u.state !== 'windup' || u.targetId !== hero.id) continue;
    if (u.action !== null && u.action !== 'strike') continue;
    const a = meleeAttackOf(u);
    if (actionTiming(u).windup - u.stateTime > 0.2) continue;
    if (dist(u.pos, hero.pos) > a.reach + 1.2) continue;
    if (Math.abs(angleDiff(u.facing, angleTo(u.pos, hero.pos))) > a.arc / 2 + 0.3) continue;
    return u;
  }
  return null;
}

/** The centre of an enemy area warning about to go off under the hero. */
function areaThreat(battle: Battle, hero: Unit): { x: number; z: number } | null {
  for (const a of battle.areas) {
    if (a.team === hero.team || a.heal) continue;
    if (a.delay - a.time > 0.35) continue;
    if (dist(a.pos, hero.pos) > a.radius + 0.6) continue;
    return a.pos;
  }
  return null;
}

/** The enemy the bot wants marked: the first of `MARK_PRIORITY` still alive. */
function wantedMark(enemies: Unit[]): Unit | null {
  for (const c of MARK_PRIORITY) {
    const u = enemies.find((e) => e.classId === c);
    if (u) return u;
  }
  return null;
}

/**
 * Marks need a lock (the free pick by view angle may land on someone else), so the bot cycles
 * the lock until it sits on the wanted enemy, marks it, and releases the lock again.
 * Returns true while it is busy with that.
 */
function handleMark(battle: Battle, hero: Unit, enemies: Unit[], input: HeroInput): boolean {
  const wanted = wantedMark(enemies);
  const lock = lockTarget(battle);
  if (!wanted || battle.markTargetId === wanted.id) {
    if (lock) input.unlock = true;
    return false;
  }
  if (dist(hero.pos, wanted.pos) > 28) return false;
  if (lock?.id === wanted.id) input.mark = true;
  else {
    input.aimAngle = angleTo(hero.pos, wanted.pos);
    input.lock = true;
  }
  return true;
}

function countWithin(hero: Unit, units: Unit[], radius: number): number {
  return units.filter((u) => dist(hero.pos, u.pos) <= radius).length;
}

/** Whether an ability is worth casting now. */
function worthCasting(battle: Battle, hero: Unit, id: HeroAbilityId, target: Unit, enemies: Unit[]): boolean {
  const d = dist(hero.pos, target.pos);
  const allies = battle.units.filter((u) => u.team === hero.team && isAlive(u));
  switch (id) {
    case 'schildstoss':
      return d <= HERO_ABILITIES.schildstoss.reach;
    case 'wirbel':
      return countWithin(hero, enemies, HERO_ABILITIES.wirbel.reach) >= 2;
    case 'salve':
      return d <= hero.stats.range;
    case 'rueckzug':
      return d <= HERO_ABILITIES.rueckzug.reach - 0.5;
    case 'heilkreis':
      return allies.filter((u) => dist(u.pos, hero.pos) <= HERO_ABILITIES.heilkreis.radius && u.hp < u.stats.maxHp * 0.75).length >= 2;
    case 'segen':
      return allies.some((u) => dist(u.pos, hero.pos) <= HERO_ABILITIES.segen.range && u.hp < u.stats.maxHp * 0.6);
    case 'feuerball':
      return d <= HERO_ABILITIES.feuerball.range;
    case 'frostring':
      return countWithin(hero, enemies, HERO_ABILITIES.frostring.radius) >= 2 || d <= 2.5;
    case 'sammeln':
      return allies.length >= 3 && d <= 12;
  }
}

/** Escape abilities: when enemies are this close, the bot saves energy for them. */
const ESCAPES: readonly HeroAbilityId[] = ['rueckzug', 'frostring'];
const SAVE_FOR_ESCAPE_WITHIN = 8;

function pickAbility(battle: Battle, hero: Unit, target: Unit, enemies: Unit[], input: HeroInput): boolean {
  const kit = heroKit(hero);
  const slots = [
    ['ability2', kit.ability2],
    ['ability1', kit.ability1],
    ['leader', kit.leader],
  ] as const;
  const escape = slots.find(([, id]) => ESCAPES.includes(id) && (hero.abilityCooldowns[id] ?? 0) <= 0)?.[1];
  const threatened = enemies.some((u) => dist(u.pos, hero.pos) <= SAVE_FOR_ESCAPE_WITHIN);
  for (const [key, id] of slots) {
    if (!abilityReady(hero, id) || !worthCasting(battle, hero, id, target, enemies)) continue;
    if (escape && id !== escape && threatened && hero.energy - HERO_ABILITIES[id].cost < HERO_ABILITIES[escape].cost) continue;
    input[key] = true;
    return true;
  }
  return false;
}

export function botInput(battle: Battle, bot: BotState): HeroInput {
  const input = emptyInput();
  const hero = battle.units.find((u) => u.isHero);
  if (!hero || !isAlive(hero)) return input;
  const enemies = foes(battle, hero);
  const close = nearest(hero, enemies);
  if (!close) return input;
  bot.pressDelay = Math.max(0, bot.pressDelay - 1);
  bot.abilityDelay = Math.max(0, bot.abilityDelay - 1);

  const marked = enemies.find((u) => u.id === battle.markTargetId) ?? null;
  const target = marked && dist(hero.pos, marked.pos) <= dist(hero.pos, close.pos) + MARK_PREFERENCE ? marked : close;
  const toTarget = angleTo(hero.pos, target.pos);
  input.aimAngle = toTarget;

  const swing = swingThreat(battle, hero);
  const area = areaThreat(battle, hero);
  if ((swing || area) && hero.dodgeCooldown <= 0) {
    if (swing) moveTowards(input, angleTo(swing.pos, hero.pos) + Math.PI / 2); // sidestep
    else if (area) moveTowards(input, dist(area, hero.pos) > 0.01 ? angleTo(area, hero.pos) : toTarget + Math.PI);
    input.dodge = true;
    return input;
  }

  if (handleMark(battle, hero, enemies, input)) return input;
  if (battle.countdown > 0) return input;

  if (bot.abilityDelay === 0 && pickAbility(battle, hero, target, enemies, input)) {
    bot.abilityDelay = 20;
    return input;
  }

  const ranged = isRangedHero(hero);
  const reach = ranged ? hero.stats.range : heroAttack(0).reach;
  const d = dist(hero.pos, target.pos);
  if (ranged && dist(hero.pos, close.pos) < KITE_DISTANCE) {
    moveTowards(input, angleTo(close.pos, hero.pos));
  } else if (d > reach) {
    moveTowards(input, toTarget);
  } else if (bot.pressDelay === 0) {
    input.attack = true;
    bot.pressDelay = 8;
  }
  return input;
}
