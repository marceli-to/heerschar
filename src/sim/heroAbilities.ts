import { BEHAVIOUR, HERO, HERO_ABILITIES, HERO_KIT, HERO_RANGED, HERO_SELF_HEAL, RANGED_AIM_ASSIST, heroAttack, type MeleeAttack, type RangedAttack } from './balance';
import { inArc, isAlive, resolveMelee } from './combat';
import { lockTarget } from './heroTargeting';
import { angleDiff, angleTo, dirFromAngle, dist, type Vec2 } from './math';
import { fireStraight, lob, placeArea } from './projectiles';
import { addStatus, guardAndRally } from './statuses';
import type { ActionId, Battle, BattleEvent, ClassId, HeroAbilityId, HeroInput, Unit } from './types';

const DODGE_OPTS = { invulnerableTime: HERO.dodge.invulnerable };

const HERO_ABILITY_IDS = Object.keys(HERO_ABILITIES) as HeroAbilityId[];

export function isHeroAbility(action: ActionId | null): action is HeroAbilityId {
  return action !== null && (HERO_ABILITY_IDS as readonly string[]).includes(action);
}

type RangedClass = keyof typeof HERO_RANGED;

function isRangedClass(c: ClassId): c is RangedClass {
  return c in HERO_RANGED;
}

/** Ranged hero classes shoot their basic attack along the aim; the Krieger swings. */
export function isRangedHero(hero: Unit): boolean {
  return isRangedClass(hero.classId);
}

/** The ranged basic attack for a chain step (falls back to the first). */
export function heroRangedAttack(hero: Unit, chain: number): RangedAttack {
  const list: readonly RangedAttack[] = isRangedClass(hero.classId) ? HERO_RANGED[hero.classId] : HERO_RANGED.bogenschuetze;
  const a = list[chain] ?? list[0];
  if (!a) throw new Error('ranged chain is empty');
  return a;
}

/** Steps in the hero's basic attack chain. */
export function chainLength(hero: Unit): number {
  return isRangedClass(hero.classId) ? HERO_RANGED[hero.classId].length : HERO.chain.length;
}

/** Windup and recover of the hero's current action: an ability or a basic attack chain step. */
export function heroActionTiming(hero: Unit): { windup: number; recover: number } {
  if (isHeroAbility(hero.action)) return HERO_ABILITIES[hero.action];
  return isRangedHero(hero) ? heroRangedAttack(hero, hero.chain) : heroAttack(hero.chain);
}

/** The hero's Q / E / R abilities. */
export function heroKit(hero: Unit): { ability1: HeroAbilityId; ability2: HeroAbilityId; leader: HeroAbilityId } {
  const kit = (HERO_KIT as Partial<Record<ClassId, readonly [HeroAbilityId, HeroAbilityId]>>)[hero.classId] ?? HERO_KIT.krieger;
  return { ability1: kit[0], ability2: kit[1], leader: 'sammeln' };
}

// ---------------------------------------------------------------------------------------------
// Aiming

function moveAngle(input: HeroInput): number | null {
  return Math.hypot(input.moveX, input.moveZ) > 0.1 ? Math.atan2(input.moveX, -input.moveZ) : null;
}

/** Melee aim assist: the nearest living enemy close to the intended swing direction. */
function meleeAssist(battle: Battle, hero: Unit, angle: number): number {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of battle.units) {
    if (u.team === hero.team || !isAlive(u)) continue;
    const d = dist(hero.pos, u.pos);
    if (d > HERO.aimAssist.range || d >= bestDist) continue;
    if (Math.abs(angleDiff(angle, angleTo(hero.pos, u.pos))) > HERO.aimAssist.angle) continue;
    best = u;
    bestDist = d;
  }
  return best ? angleTo(hero.pos, best.pos) : angle;
}

/** Melee direction: the lock target, else the movement direction (or the camera) with aim assist. */
export function meleeAim(battle: Battle, hero: Unit, input: HeroInput): number {
  const lock = lockTarget(battle);
  if (lock) return angleTo(hero.pos, lock.pos);
  return meleeAssist(battle, hero, moveAngle(input) ?? input.aimAngle);
}

/** Ranged aim target: the lock target, else the enemy in range closest to the camera's aim line. */
function rangedTarget(battle: Battle, hero: Unit, input: HeroInput, reach: number): Unit | null {
  const lock = lockTarget(battle);
  if (lock) return lock;
  let best: Unit | null = null;
  let bestOff = Infinity;
  for (const u of battle.units) {
    if (u.team === hero.team || !isAlive(u) || dist(hero.pos, u.pos) > reach) continue;
    const off = Math.abs(angleDiff(input.aimAngle, angleTo(hero.pos, u.pos)));
    if (off <= RANGED_AIM_ASSIST && off < bestOff) {
      best = u;
      bestOff = off;
    }
  }
  return best;
}

/** Ranged direction: along the camera's aim, snapped to a target when there is one. */
export function rangedAim(battle: Battle, hero: Unit, input: HeroInput): number {
  const t = rangedTarget(battle, hero, input, hero.stats.range * BEHAVIOUR.projectileRangeFactor);
  return t ? angleTo(hero.pos, t.pos) : input.aimAngle;
}

/** Facing for an ability when its windup starts. */
export function abilityAim(battle: Battle, hero: Unit, input: HeroInput, id: HeroAbilityId): number {
  switch (id) {
    case 'schildstoss':
    case 'wirbel':
      return meleeAim(battle, hero, input);
    case 'salve':
    case 'rueckzug':
      return rangedAim(battle, hero, input);
    case 'feuerball': {
      const t = rangedTarget(battle, hero, input, HERO_ABILITIES.feuerball.range);
      return t ? angleTo(hero.pos, t.pos) : input.aimAngle;
    }
    case 'heilkreis':
    case 'segen':
    case 'frostring':
    case 'sammeln':
      return hero.facing;
  }
}

function ahead(hero: Unit, angle: number, distance: number): Vec2 {
  const d = dirFromAngle(angle);
  return { x: hero.pos.x + d.x * distance, z: hero.pos.z + d.z * distance };
}

// ---------------------------------------------------------------------------------------------
// Basic ranged attack and ability effects

/** Fires the ranged basic attack along the hero's facing. */
export function fireBasic(battle: Battle, hero: Unit, events: BattleEvent[]): void {
  const a = heroRangedAttack(hero, hero.chain);
  const reach = hero.stats.range * BEHAVIOUR.projectileRangeFactor;
  const arrow = hero.classId === 'bogenschuetze';
  fireStraight(
    battle,
    hero,
    {
      kind: arrow ? 'arrow' : 'bolt',
      at: ahead(hero, hero.facing, reach),
      speed: a.speed,
      radius: a.radius,
      range: reach,
      multiplier: a.multiplier,
      damageType: arrow ? 'physical' : 'magic',
      pierce: false,
      basic: true,
    },
    events,
  );
}

function abilityMelee(id: 'schildstoss' | 'wirbel'): MeleeAttack {
  const a = HERO_ABILITIES[id];
  return {
    windup: a.windup,
    recover: a.recover,
    multiplier: a.multiplier,
    reach: a.reach,
    arc: a.arc,
    knockback: a.knockback,
    stagger: id === 'schildstoss' ? HERO_ABILITIES.schildstoss.stun : HERO_ABILITIES.wirbel.stagger,
    lunge: a.lunge,
    hitstop: a.hitstop,
    heavy: true,
  };
}

/** The ally (the hero included) with the lowest health fraction within `range`; companions win ties. */
function weakestAlly(battle: Battle, hero: Unit, range: number): Unit | null {
  let best: Unit | null = null;
  let bestFrac = Infinity;
  for (const u of battle.units) {
    if (u.team !== hero.team || !isAlive(u) || dist(u.pos, hero.pos) > range) continue;
    const frac = u.hp / u.stats.maxHp + (u.isHero ? 1e-6 : 0);
    if (frac < bestFrac) {
      best = u;
      bestFrac = frac;
    }
  }
  return best;
}

/**
 * Resolves an ability when its windup completes. Returns true when the hero goes into a leap
 * (Rueckzug) instead of the recover.
 */
export function releaseAbility(battle: Battle, hero: Unit, id: HeroAbilityId, input: HeroInput, events: BattleEvent[]): boolean {
  events.push({ type: 'release', unitId: hero.id, action: id });
  switch (id) {
    case 'schildstoss':
      resolveMelee(battle, hero, abilityMelee(id), { ...DODGE_OPTS, stun: true }, events);
      guardAndRally(hero, events, true, false);
      return false;
    case 'wirbel':
      resolveMelee(battle, hero, abilityMelee(id), DODGE_OPTS, events);
      guardAndRally(hero, events, false, true);
      return false;
    case 'salve': {
      const s = HERO_ABILITIES.salve;
      const reach = hero.stats.range * BEHAVIOUR.projectileRangeFactor;
      for (let i = 0; i < s.arrows; i++) {
        const angle = hero.facing + (i - (s.arrows - 1) / 2) * s.spread;
        fireStraight(battle, hero, { kind: 'arrow', at: ahead(hero, angle, reach), speed: s.speed, radius: s.radius, range: reach, multiplier: s.multiplier, damageType: 'physical', pierce: false }, events);
      }
      return false;
    }
    case 'rueckzug': {
      const r = HERO_ABILITIES.rueckzug;
      const cone = { reach: r.reach, arc: r.arc } as MeleeAttack;
      for (const u of battle.units) {
        if (u.team !== hero.team && isAlive(u) && inArc(hero, u, cone)) addStatus(u, 'slowed', r.slow + hero.mods.control, events);
      }
      return true;
    }
    case 'heilkreis': {
      const h = HERO_ABILITIES.heilkreis;
      placeArea(battle, hero, { kind: 'heilkreis', at: hero.pos, radius: h.radius, delay: h.interval, multiplier: h.multiplier, damageType: 'magic', freeze: 0, heal: true, pulses: h.pulses, interval: h.interval }, events);
      return false;
    }
    case 'segen': {
      const s = HERO_ABILITIES.segen;
      const ally = weakestAlly(battle, hero, s.range);
      if (ally) addStatus(ally, 'shielded', s.duration, events, hero.stats.power * s.shield * hero.mods.healing * (ally === hero ? HERO_SELF_HEAL : 1), hero.id);
      return false;
    }
    case 'feuerball': {
      const f = HERO_ABILITIES.feuerball;
      const lock = lockTarget(battle);
      const t = lock && dist(lock.pos, hero.pos) <= f.range ? lock : rangedTarget(battle, hero, { ...input, aimAngle: hero.facing }, f.range);
      const at = t ? t.pos : ahead(hero, hero.facing, f.fallback);
      lob(battle, hero, 'fireball', at, f.speed, f.minFlight, f.maxFlight, { kind: 'fireball', radius: f.radius, multiplier: f.multiplier, damageType: 'magic', freeze: 0 }, events);
      return false;
    }
    case 'frostring': {
      const f = HERO_ABILITIES.frostring;
      placeArea(battle, hero, { kind: 'frostring', at: hero.pos, radius: f.radius, delay: 0, multiplier: f.multiplier, damageType: 'magic', freeze: f.freeze }, events);
      return false;
    }
    case 'sammeln': {
      for (const u of battle.units) {
        if (u.team === hero.team && !u.isHero && isAlive(u)) addStatus(u, 'rallied', HERO_ABILITIES.sammeln.duration, events, 0, hero.id);
      }
      return false;
    }
  }
}
