import { enemySlots, playerSlotStats, type Encounter } from '../data/encounters';
import { formationSetup, type BattleSetup, type FormationSlot } from '../sim/battle';
import type { PlayableClassId } from '../sim/types';

/** A persistent character outside battles (PLAN section 4). Levels, upgrades and items come in Stage 4. */
export interface Character {
  id: number;
  name: string;
  classId: PlayableClassId;
  isHero: boolean;
  level: number;
  xp: number;
  weapon: string | null;
  trinket: string | null;
}

export interface Slot {
  /** 0..2, left to right as seen from the player side. */
  col: 0 | 1 | 2;
  /** 0 = front, 1 = back. */
  row: 0 | 1;
}

/** The squad part of the game state: who exists, who fights, where they stand. */
export interface SquadState {
  roster: Character[];
  /** Fielded character ids, the hero always included. Every fielded id has a formation slot. */
  fielded: number[];
  formation: Record<number, Slot>;
}

/** The hero plus up to five companions take the field. */
export const MAX_FIELDED = 6;
export const HERO_ID = 1;

/** Melee classes prefer the front row, everyone else the back. */
const PREFERS_FRONT: Record<PlayableClassId, boolean> = { krieger: true, bogenschuetze: false, heiler: false, magier: false };

/** Every slot, front row first, centre column first. */
const SLOTS: readonly Slot[] = [0, 1].flatMap((row) => [1, 0, 2].map((col) => ({ col, row }) as Slot));

export function slotKey(s: Slot): string {
  return `${s.col},${s.row}`;
}

export function heroOfSquad(state: SquadState): Character {
  const hero = state.roster.find((c) => c.isHero);
  if (!hero) throw new Error('squad has no hero');
  return hero;
}

export function isFielded(state: SquadState, id: number): boolean {
  return state.fielded.includes(id);
}

/** The fielded character standing in a slot, if any. */
export function occupantOf(state: SquadState, slot: Slot): number | null {
  for (const id of state.fielded) {
    const s = state.formation[id];
    if (s && s.col === slot.col && s.row === slot.row) return id;
  }
  return null;
}

/** A free slot for a class: its preferred row first, centre column first, then anything free. */
export function freeSlotFor(state: SquadState, classId: PlayableClassId): Slot | null {
  const preferredRow = PREFERS_FRONT[classId] ? 0 : 1;
  const ordered = [...SLOTS.filter((s) => s.row === preferredRow), ...SLOTS.filter((s) => s.row !== preferredRow)];
  return ordered.find((s) => occupantOf(state, s) === null) ?? null;
}

function characterById(state: SquadState, id: number): Character {
  const c = state.roster.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character ${id}`);
  return c;
}

/**
 * Fields or benches a character. The hero is never benched; fielding fails when the field is
 * full. Returns whether anything changed. Mutates `state`.
 */
export function setFielded(state: SquadState, id: number, fielded: boolean): boolean {
  const c = characterById(state, id);
  if (fielded === isFielded(state, id)) return false;
  if (!fielded) {
    if (c.isHero) return false;
    state.fielded = state.fielded.filter((x) => x !== id);
    delete state.formation[id];
    return true;
  }
  if (state.fielded.length >= MAX_FIELDED) return false;
  const slot = freeSlotFor(state, c.classId);
  if (!slot) return false;
  state.fielded.push(id);
  state.formation[id] = slot;
  return true;
}

/**
 * Puts a character into a slot. A fielded character swaps places with the occupant. A benched
 * one takes the slot and the occupant goes to the bench (never the hero); into an empty slot it
 * is fielded if there is room. Returns whether anything changed. Mutates `state`.
 */
export function placeCharacter(state: SquadState, id: number, slot: Slot): boolean {
  characterById(state, id);
  const occupant = occupantOf(state, slot);
  if (occupant === id) return false;
  if (isFielded(state, id)) {
    const from = state.formation[id];
    if (occupant !== null && from) state.formation[occupant] = from;
    state.formation[id] = { ...slot };
    return true;
  }
  if (occupant !== null) {
    if (characterById(state, occupant).isHero) return false;
    state.fielded = state.fielded.map((x) => (x === occupant ? id : x));
    delete state.formation[occupant];
    state.formation[id] = { ...slot };
    return true;
  }
  if (state.fielded.length >= MAX_FIELDED) return false;
  state.fielded.push(id);
  state.formation[id] = { ...slot };
  return true;
}

/**
 * The fielded characters in battle order: the hero first (unit id 1, as in every other setup),
 * then companions in fielding order. `battleSetupFor` places the player units in this order.
 */
export function fieldedCharacters(state: SquadState): Character[] {
  const list = state.fielded.map((id) => characterById(state, id));
  return [...list.filter((c) => c.isHero), ...list.filter((c) => !c.isHero)];
}

/** Turns the squad and an encounter into a battle setup. */
export function battleSetupFor(state: SquadState, encounter: Encounter, seed: number): BattleSetup {
  const player: FormationSlot[] = fieldedCharacters(state).map((c) => {
    const slot = state.formation[c.id];
    if (!slot) throw new Error(`fielded character ${c.id} has no slot`);
    return { classId: c.classId, col: slot.col, row: slot.row, isHero: c.isHero, stats: playerSlotStats(c.classId, c.isHero) };
  });
  return formationSetup(seed, player, enemySlots(encounter));
}
