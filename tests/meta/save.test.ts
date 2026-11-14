import { describe, expect, it } from 'vitest';
import { choose, currentChoice, newGame, recordBattle, type GameState } from '../../src/meta/game';
import { clearSave, loadGame, parseSave, saveGame, SAVE_KEY, type SaveStorage } from '../../src/meta/save';
import { HERO_ID } from '../../src/meta/squad';

function memory(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function played(): GameState {
  const s = newGame('magier', 'Corvin', 42);
  recordBattle(s, 'skirmish', true);
  currentChoice(s);
  s.inventory.push('luckyCoin');
  return s;
}

describe('save', () => {
  it('round-trips a game with pending rewards', () => {
    const st = memory();
    const s = played();
    saveGame(st, s);
    const back = loadGame(st)!;
    expect(back).toEqual(s);
    // The drawn options survive, so a reload cannot reroll them.
    expect(currentChoice(back)!.options).toEqual(currentChoice(s)!.options);
    choose(back, currentChoice(back)!.options![0]!);
  });

  it('no save, cleared save, garbage and unknown versions give null without throwing', () => {
    const st = memory();
    expect(loadGame(st)).toBeNull();
    saveGame(st, played());
    clearSave(st);
    expect(loadGame(st)).toBeNull();
    for (const text of ['{', 'null', '[]', '42', '{"version":1}', JSON.stringify({ ...played(), version: 99 }), JSON.stringify({ ...played(), version: 0 })]) {
      st.data.set(SAVE_KEY, text);
      expect(loadGame(st)).toBeNull();
    }
    const throwing: SaveStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} };
    expect(loadGame(throwing)).toBeNull();
  });

  it('rejects broken content', () => {
    const breakers: ((g: GameState) => void)[] = [
      (g) => (g.squad.roster[0]!.classId = 'drache' as never),
      (g) => (g.squad.roster[0]!.weapon = 'excalibur'),
      (g) => (g.squad.roster[0]!.upgrades = ['nope']),
      (g) => (g.squad.roster[0]!.level = 99),
      (g) => (g.squad.fielded = g.squad.fielded.filter((id) => id !== HERO_ID)),
      (g) => (g.squad.formation[g.squad.fielded[1]!] = { ...g.squad.formation[g.squad.fielded[0]!]! }),
      (g) => (g.won = ['atlantis' as never]),
      (g) => (g.inventory = ['excalibur']),
      (g) => (g.rewards!.choices[0]!.options = ['nope']),
      (g) => ((g.squad as unknown as { roster: unknown }).roster = 'x'),
    ];
    for (const b of breakers) {
      const g = played();
      b(g);
      expect(parseSave(JSON.stringify(g))).toBeNull();
    }
  });
});
