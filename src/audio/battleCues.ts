import { heroAttack } from '../sim/balance';
import { isBossClass } from '../sim/body';
import type { BattleEvent, ClassId, Projectile, Unit } from '../sim/types';
import type { RegionId } from '../data/campaign';

/**
 * Which sounds a battle event makes (6f, hero-focused mix): what the hero does or suffers is
 * `hero` (loud, always heard); the rest of the fight is `crowd` (quieter, capped per tick);
 * deaths, area blasts and battle flow are `always`.
 */
export type CuePriority = 'hero' | 'crowd' | 'always';

export interface Cue {
  sound: string;
  priority: CuePriority;
  /** Gain on top of the priority's level (1 = default). */
  gain?: number;
  rate?: number;
}

export interface CueContext {
  unit(id: number): Unit | undefined;
  projectile(id: number): Projectile | undefined;
  region: RegionId;
}

const MELEE: ReadonlySet<ClassId> = new Set(['krieger', 'schildtraeger', 'berserker', 'kriegsherr', 'knochenkoenig']);
const ARMOURED: ReadonlySet<ClassId> = new Set(['krieger', 'schildtraeger', 'kriegsherr']);

/** Enemies drawn as skeletons: the Barrowlands' foes and the Bone King. */
export function isSkeleton(u: Unit, region: RegionId): boolean {
  if (u.classId === 'knochenkoenig') return true;
  return u.team === 'enemy' && region === 'barrowlands' && u.classId !== 'wolf' && !isBossClass(u.classId);
}

function involves(...units: (Unit | undefined)[]): CuePriority {
  return units.some((u) => u?.isHero) ? 'hero' : 'crowd';
}

/** The sound of a blow landing, by who struck it. */
function hitSound(attacker: Unit | undefined, heavy: boolean): string {
  if (!attacker) return 'hitBlade';
  if (attacker.classId === 'wolf') return 'hitPunch';
  if (attacker.classId === 'bogenschuetze') return 'hitArrow';
  if (attacker.classId === 'sumpfhexe') return 'hitHex';
  if (attacker.classId === 'magier') return 'hitFire';
  if (attacker.classId === 'heiler' || attacker.classId === 'schamane') return 'hitLight';
  return heavy ? 'hitHeavy' : 'hitBlade';
}

export function battleCues(e: BattleEvent, ctx: CueContext): Cue[] {
  switch (e.type) {
    case 'hit': {
      const attacker = ctx.unit(e.attackerId);
      const target = ctx.unit(e.targetId);
      const priority = involves(attacker, target);
      if (e.amount <= 0 && e.absorbed > 0) return [{ sound: 'hitShield', priority }];
      const cues: Cue[] = [{ sound: hitSound(attacker, e.heavy), priority }];
      const physical = !attacker || MELEE.has(attacker.classId) || attacker.classId === 'bogenschuetze' || attacker.classId === 'wolf';
      if (target && physical && isSkeleton(target, ctx.region)) cues.push({ sound: 'hitBone', priority, gain: 0.7 });
      if (e.heavy && priority === 'hero') cues.push({ sound: 'hitPunch', priority, gain: 0.6 });
      if (e.absorbed > 0) cues.push({ sound: 'hitShield', priority, gain: 0.6 });
      return cues;
    }
    case 'swing': {
      const u = ctx.unit(e.unitId);
      if (!u) return [];
      const heavy = u.isHero ? heroAttack(e.chain).heavy : isBossClass(u.classId);
      return [{ sound: heavy ? 'swingHeavy' : 'swing', priority: involves(u) }];
    }
    case 'shoot': {
      const p = ctx.projectile(e.projectileId);
      const priority = involves(p ? ctx.unit(p.ownerId) : undefined);
      switch (e.kind) {
        case 'arrow':
        case 'piercing':
          return [{ sound: 'crossbow', priority }];
        case 'bolt':
          return [{ sound: 'castLight', priority, gain: 0.6 }];
        case 'fireball':
          return [{ sound: 'castFire', priority }];
        case 'hex':
          return [{ sound: 'castHex', priority }];
      }
      return [];
    }
    case 'areaResolve':
      switch (e.kind) {
        case 'fireball':
          return [{ sound: 'explosion', priority: 'always' }];
        case 'frostNova':
        case 'frostring':
          return [{ sound: 'iceBlast', priority: 'always' }];
        case 'heilkreis':
          return [{ sound: 'healCircle', priority: 'always', gain: 0.6 }];
        case 'sweep':
          return [{ sound: 'swingHeavy', priority: 'always', rate: 0.8 }, { sound: 'hitHeavy', priority: 'always', gain: 0.7 }];
        case 'charge':
          return [{ sound: 'hitPunch', priority: 'always' }, { sound: 'fall', priority: 'always', gain: 0.7 }];
        case 'slam':
          return [{ sound: 'slam', priority: 'always' }];
        case 'poison':
          return [{ sound: 'poison', priority: 'always' }];
      }
      return [];
    case 'heal': {
      const priority = involves(ctx.unit(e.sourceId), ctx.unit(e.targetId));
      return [{ sound: 'heal', priority, gain: 0.5 }];
    }
    case 'status': {
      if (!e.on) return [];
      const u = ctx.unit(e.unitId);
      const priority = involves(u);
      if (e.kind === 'frozen') return [{ sound: 'freeze', priority }];
      if (e.kind === 'shielded') return [{ sound: 'ward', priority, gain: u?.team === 'player' ? 0.8 : 0.5 }];
      return [];
    }
    case 'action': {
      const u = ctx.unit(e.unitId);
      if (!u || u.isHero) return []; // the hero's abilities sound on release
      switch (e.action) {
        case 'taunt':
          return [{ sound: 'taunt', priority: 'crowd', gain: 1.2 }];
        case 'summon':
          return u.classId === 'sumpfhexe' ? [{ sound: 'howl', priority: 'always' }] : [{ sound: 'raise', priority: 'always' }];
        case 'mend':
          return [{ sound: 'castHex', priority: 'always', rate: 0.8 }];
        case 'raise':
          return [{ sound: 'raise', priority: 'always' }];
      }
      return [];
    }
    case 'release':
      switch (e.action) {
        case 'schildstoss':
          return [{ sound: 'taunt', priority: 'hero' }, { sound: 'swingHeavy', priority: 'hero' }];
        case 'wirbel':
          return [{ sound: 'swingHeavy', priority: 'hero', rate: 0.85 }, { sound: 'swing', priority: 'hero', rate: 0.9 }];
        case 'salve':
          return [{ sound: 'crossbow', priority: 'hero' }];
        case 'rueckzug':
          return [{ sound: 'dodge', priority: 'hero' }];
        case 'heilkreis':
        case 'segen':
          return [{ sound: 'castLight', priority: 'hero' }];
        case 'sammeln':
          return [{ sound: 'rally', priority: 'hero' }];
        case 'feuerball':
        case 'frostring':
          return []; // the projectile and the area carry the sound
      }
      return [];
    case 'dodge':
      return [{ sound: 'dodge', priority: involves(ctx.unit(e.unitId)) }];
    case 'death': {
      const u = ctx.unit(e.unitId);
      if (!u) return [];
      const cues: Cue[] = [{ sound: 'fall', priority: 'always', gain: 0.8 }];
      if (u.classId === 'wolf') cues.push({ sound: 'whimper', priority: 'always', gain: 0.7 });
      else if (isSkeleton(u, ctx.region)) cues.push({ sound: 'bones', priority: 'always' });
      else if (ARMOURED.has(u.classId)) cues.push({ sound: 'clatter', priority: 'always', gain: 0.7 });
      return cues;
    }
    case 'spawn': {
      const u = ctx.unit(e.unitId);
      return u?.classId === 'wolf' ? [{ sound: 'bark', priority: 'crowd' }] : [];
    }
    case 'raise':
      return [{ sound: 'bones', priority: 'always' }, { sound: 'raise', priority: 'always', gain: 0.6 }];
    case 'countdown':
      return e.value > 0 ? [{ sound: 'drum', priority: 'always' }] : [{ sound: 'bell', priority: 'always' }];
    case 'lock':
      return e.targetId === null ? [] : [{ sound: 'lock', priority: 'hero', gain: 0.6 }];
    case 'mark':
      return e.targetId === null ? [] : [{ sound: 'mark', priority: 'hero' }];
    case 'attackStart':
    case 'evade':
    case 'areaStart':
    case 'outcome':
      return [];
  }
}
