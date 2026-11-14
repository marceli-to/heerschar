import { describe, expect, it } from 'vitest';
import { encounterById } from '../../src/data/encounters';
import { SANDBOX_COMPANIONS, newSquad } from '../../src/data/roster';
import { battleSetupFor } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import { ledgerEntry, tallyEvents, type Ledger } from '../../src/sim/ledger';

describe('battle ledger', () => {
  it('credits hits to attacker and target, heals to the source', () => {
    const ledger: Ledger = new Map();
    tallyEvents(ledger, [
      { type: 'hit', attackerId: 1, targetId: 7, amount: 12, absorbed: 5, heavy: false, x: 0, z: 0 },
      { type: 'hit', attackerId: 1, targetId: 8, amount: 3, absorbed: 0, heavy: true, x: 0, z: 0 },
      { type: 'heal', sourceId: 4, targetId: 1, amount: 9, x: 0, z: 0 },
      { type: 'countdown', seconds: 2 } as never,
    ]);
    expect(ledgerEntry(ledger, 1)).toEqual({ dealt: 15, taken: 0, healed: 0 });
    expect(ledgerEntry(ledger, 7)).toEqual({ dealt: 0, taken: 12, healed: 0 });
    expect(ledgerEntry(ledger, 4)).toEqual({ dealt: 0, taken: 0, healed: 9 });
    expect(ledgerEntry(ledger, 99)).toEqual({ dealt: 0, taken: 0, healed: 0 });
  });

  it('matches a whole battle: player damage dealt equals enemy damage taken', () => {
    const setup = battleSetupFor(newSquad('heiler', 'Hero', SANDBOX_COMPANIONS), encounterById('skirmish'), 3);
    const r = playHeadless(setup);
    const ledger: Ledger = new Map();
    tallyEvents(ledger, r.events);
    const sum = (team: 'player' | 'enemy', key: 'dealt' | 'taken' | 'healed') =>
      r.battle.units.filter((u) => u.team === team).reduce((s, u) => s + ledgerEntry(ledger, u.id)[key], 0);
    expect(sum('player', 'dealt')).toBeCloseTo(r.playerDamage, 6);
    expect(sum('enemy', 'taken')).toBeCloseTo(r.playerDamage, 6);
    expect(sum('player', 'healed')).toBeGreaterThan(0);
  });
});
