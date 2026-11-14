import type { BattleEvent } from './types';

/** What one unit did in a battle. Damage counts health lost (shield-absorbed points excluded); healing counts health restored. */
export interface LedgerEntry {
  dealt: number;
  taken: number;
  healed: number;
}

/** Per unit id. Units that never acted have no entry. */
export type Ledger = Map<number, LedgerEntry>;

function entry(ledger: Ledger, id: number): LedgerEntry {
  let e = ledger.get(id);
  if (!e) {
    e = { dealt: 0, taken: 0, healed: 0 };
    ledger.set(id, e);
  }
  return e;
}

/** Adds a tick's events to the ledger. */
export function tallyEvents(ledger: Ledger, events: readonly BattleEvent[]): void {
  for (const e of events) {
    if (e.type === 'hit') {
      entry(ledger, e.attackerId).dealt += e.amount;
      entry(ledger, e.targetId).taken += e.amount;
    } else if (e.type === 'heal') {
      entry(ledger, e.sourceId).healed += e.amount;
    }
  }
}

export function ledgerEntry(ledger: Ledger, id: number): LedgerEntry {
  return ledger.get(id) ?? { dealt: 0, taken: 0, healed: 0 };
}
