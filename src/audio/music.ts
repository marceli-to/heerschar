import type { RegionId } from '../data/campaign';
import { audio } from './engine';

/** Loops: the war table (title and every screen between battles) and one per region. */
export type MusicLoop = 'table' | RegionId;
export type MusicSting = 'victory' | 'defeat';

const FADE = 1.5;
const STING_DUCK = 0.6;
const BASE = `${import.meta.env.BASE_URL}audio/music/`;

interface Track {
  el: HTMLAudioElement;
  gain: GainNode;
}

/**
 * Streams music from media elements (long tracks are not decoded into memory) through the music
 * bus. One loop plays at a time, crossfading on change; a sting fades the loop out and plays once.
 * Until the first user gesture nothing is audible: the wanted loop starts on `resume()`.
 */
export class Music {
  private tracks = new Map<string, Track>();
  private current: string | null = null;
  /** The loop that should be playing (kept while audio is still locked). */
  private wanted: MusicLoop | null = null;

  /** Plays a loop (crossfading from the current one); `null` fades to silence. */
  play(loop: MusicLoop | null): void {
    this.wanted = loop;
    if (loop === this.current) return;
    if (!this.running()) return;
    this.switchTo(loop);
  }

  /** A one-shot after a battle: the loop fades out, the sting plays, then silence. */
  sting(name: MusicSting): void {
    this.wanted = null;
    if (!this.running()) return;
    this.switchTo(null, STING_DUCK);
    const t = this.track(name, false);
    if (!t) return;
    t.el.currentTime = 0;
    this.ramp(t, 1, 0.01);
    void t.el.play().catch(() => {});
  }

  /** Called once the audio context runs (first gesture): starts what was asked for meanwhile. */
  resume(): void {
    if (this.wanted !== this.current) this.switchTo(this.wanted);
  }

  private running(): boolean {
    return audio.context()?.state === 'running';
  }

  private switchTo(loop: MusicLoop | null, fade = FADE): void {
    if (this.current) {
      const old = this.tracks.get(this.current);
      if (old) {
        this.ramp(old, 0, fade);
        const el = old.el;
        window.setTimeout(() => {
          if (this.current !== el.dataset['name']) el.pause();
        }, fade * 1000 + 100);
      }
    }
    this.current = loop;
    if (!loop) return;
    const t = this.track(loop, true);
    if (!t) return;
    if (t.el.paused) t.el.currentTime = 0;
    this.ramp(t, 1, fade);
    void t.el.play().catch(() => {});
  }

  private track(name: string, loop: boolean): Track | null {
    const known = this.tracks.get(name);
    if (known) return known;
    const ctx = audio.context();
    const bus = audio.bus('music');
    if (!ctx || !bus) return null;
    const el = new Audio(`${BASE}${name}.m4a`);
    el.loop = loop;
    el.preload = 'auto';
    el.dataset['name'] = name;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(bus);
    const t = { el, gain };
    this.tracks.set(name, t);
    return t;
  }

  private ramp(t: Track, to: number, seconds: number): void {
    const ctx = audio.context();
    if (!ctx) return;
    const g = t.gain.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setValueAtTime(g.value, ctx.currentTime);
    g.linearRampToValueAtTime(to, ctx.currentTime + seconds);
  }
}

export const music = new Music();
