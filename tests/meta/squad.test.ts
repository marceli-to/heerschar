import { describe, expect, it } from 'vitest';
import { ENCOUNTERS, encounterById } from '../../src/data/encounters';
import { newSquad } from '../../src/data/roster';
import { battleSetupFor, canPlace, characterStats, enemyViewCol, HERO_ID, swapIn, isFielded, MAX_FIELDED, occupantOf, placeCharacter, setFielded, slotKey } from '../../src/meta/squad';
import { slotPosition } from '../../src/sim/battle';

describe('squad rules', () => {
  it('a new squad fields the hero and five companions in distinct slots', () => {
    const s = newSquad('krieger', 'Aldric');
    expect(s.roster).toHaveLength(8);
    expect(s.fielded).toHaveLength(MAX_FIELDED);
    expect(s.fielded).toContain(HERO_ID);
    const keys = s.fielded.map((id) => slotKey(s.formation[id]!));
    expect(new Set(keys).size).toBe(MAX_FIELDED);
    // Warriors in front, the rest behind.
    for (const id of s.fielded) {
      const c = s.roster.find((x) => x.id === id)!;
      expect(s.formation[id]!.row).toBe(c.classId === 'krieger' ? 0 : 1);
    }
  });

  it('never benches the hero and refuses a seventh fighter', () => {
    const s = newSquad('magier', 'Aldric');
    expect(setFielded(s, HERO_ID, false)).toBe(false);
    const benched = s.roster.find((c) => !isFielded(s, c.id))!;
    expect(setFielded(s, benched.id, true)).toBe(false);
  });

  it('benching frees the slot, fielding takes a free one', () => {
    const s = newSquad('krieger', 'Aldric');
    const out = s.fielded.find((id) => id !== HERO_ID)!;
    const slot = s.formation[out]!;
    expect(setFielded(s, out, false)).toBe(true);
    expect(s.formation[out]).toBeUndefined();
    expect(occupantOf(s, slot)).toBeNull();
    const benched = s.roster.find((c) => !isFielded(s, c.id) && c.id !== out)!;
    expect(setFielded(s, benched.id, true)).toBe(true);
    expect(s.formation[benched.id]).toBeDefined();
  });

  it('placing a fielded character swaps with the occupant', () => {
    const s = newSquad('krieger', 'Aldric');
    const [a, b] = s.fielded.filter((id) => id !== HERO_ID);
    const sa = s.formation[a!]!;
    const sb = s.formation[b!]!;
    expect(placeCharacter(s, a!, sb)).toBe(true);
    expect(s.formation[a!]).toEqual(sb);
    expect(s.formation[b!]).toEqual(sa);
  });

  it('placing a benched character on a companion benches the companion, never the hero', () => {
    const s = newSquad('krieger', 'Aldric');
    const benched = s.roster.find((c) => !isFielded(s, c.id))!;
    expect(placeCharacter(s, benched.id, s.formation[HERO_ID]!)).toBe(false);
    const victim = s.fielded.find((id) => id !== HERO_ID)!;
    const slot = s.formation[victim]!;
    expect(placeCharacter(s, benched.id, slot)).toBe(true);
    expect(isFielded(s, victim)).toBe(false);
    expect(occupantOf(s, slot)).toBe(benched.id);
  });

  it('builds a battle with the hero first and units on their slots', () => {
    const s = newSquad('bogenschuetze', 'Aldric');
    for (const enc of ENCOUNTERS) {
      const setup = battleSetupFor(s, enc, 1);
      expect(setup.units[0]!.isHero).toBe(true);
      expect(setup.units[0]!.classId).toBe('bogenschuetze');
      expect(setup.units.filter((u) => u.team === 'player')).toHaveLength(MAX_FIELDED);
      expect(setup.units.filter((u) => u.team === 'enemy')).toHaveLength(enc.enemies.length);
    }
    const setup = battleSetupFor(s, encounterById('skirmish'), 1);
    const heroSlot = s.formation[HERO_ID]!;
    expect({ x: setup.units[0]!.x, z: setup.units[0]!.z }).toEqual(slotPosition('player', heroSlot.col, heroSlot.row));
  });
});

describe('squad screen helpers', () => {
  it('swapIn benches the companion and gives its slot to the newcomer, never replacing the hero', () => {

    const s = newSquad('krieger', 'Aldric');
    const benched = s.roster.find((c) => !isFielded(s, c.id))!;
    const companion = s.fielded.find((id) => id !== HERO_ID)!;
    const slot = { ...s.formation[companion]! };
    expect(swapIn(s, benched.id, HERO_ID)).toBe(false);
    expect(swapIn(s, benched.id, companion)).toBe(true);
    expect(isFielded(s, companion)).toBe(false);
    expect(s.formation[benched.id]).toEqual(slot);
    expect(s.fielded).toHaveLength(MAX_FIELDED);
    // The sheet shows the stats the unit fights with.
    const setup = battleSetupFor(s, encounterById('skirmish'), 1);
    const hero = s.roster.find((c) => c.isHero)!;
    expect(characterStats(hero)).toEqual(setup.units.find((u) => u.isHero)!.stats);
  });
});

describe('formation screen helpers', () => {
  it('canPlace agrees with placeCharacter for every character and slot', () => {
    const base = newSquad('krieger', 'Aldric');
    setFielded(base, base.fielded.find((id) => id !== HERO_ID)!, false); // leave one slot empty
    for (const c of base.roster) {
      for (const row of [0, 1] as const) {
        for (const col of [0, 1, 2] as const) {
          const s = structuredClone(base);
          const expected = canPlace(s, c.id, { col, row });
          expect(placeCharacter(s, c.id, { col, row })).toBe(expected);
          expect(s).toEqual(expected ? s : base); // a refused placement changes nothing
        }
      }
    }
  });

  it('enemyViewCol puts each enemy opposite the player column it faces', () => {
    for (const col of [0, 1, 2] as const) {
      expect(slotPosition('enemy', col, 0).z).toBeCloseTo(slotPosition('player', enemyViewCol(col), 0).z);
    }
  });
});
