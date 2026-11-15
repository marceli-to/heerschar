import type { Battle, BattleEvent } from '../sim/types';
import type { RegionId } from '../data/campaign';
import { battleCues, type Cue, type CuePriority } from './battleCues';
import { audio } from './engine';

/** Level per priority (hero-focused mix, 6f decisions). */
const LEVEL: Record<CuePriority, number> = { hero: 1, always: 0.85, crowd: 0.4 };
/** Crowd sounds per tick, and per sound name per tick for any priority. */
const CROWD_PER_TICK = 2;
const SAME_PER_TICK = 2;

/**
 * Plays a tick's battle events: picks the cues, then thins the crowd so a dozen fighters do not
 * drown the hero (hero and `always` cues first; at most a few crowd cues per tick).
 */
export class BattleSound {
  constructor(private readonly region: RegionId) {}

  /** Exposed for tests: the cues a tick would play, in play order. */
  pick(battle: Battle, events: BattleEvent[]): Cue[] {
    const ctx = {
      unit: (id: number) => battle.units.find((u) => u.id === id),
      projectile: (id: number) => battle.projectiles.find((p) => p.id === id),
      region: this.region,
    };
    const all = events.flatMap((e) => battleCues(e, ctx));
    all.sort((a, b) => rank(a.priority) - rank(b.priority));
    const out: Cue[] = [];
    const same = new Map<string, number>();
    let crowd = 0;
    for (const cue of all) {
      const n = same.get(cue.sound) ?? 0;
      if (n >= SAME_PER_TICK) continue;
      if (cue.priority === 'crowd') {
        if (crowd >= CROWD_PER_TICK) continue;
        crowd++;
      }
      same.set(cue.sound, n + 1);
      out.push(cue);
    }
    return out;
  }

  play(battle: Battle, events: BattleEvent[]): void {
    for (const cue of this.pick(battle, events)) {
      audio.play(cue.sound, { gain: LEVEL[cue.priority] * (cue.gain ?? 1), rate: cue.rate, steal: cue.priority !== 'crowd' });
    }
  }
}

function rank(p: CuePriority): number {
  return p === 'hero' ? 0 : p === 'always' ? 1 : 2;
}
