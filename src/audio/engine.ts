/**
 * Web Audio playback for the game's sound effects and music. Effects are short CC0 samples built
 * by `tools/audio.mjs` into `public/audio/sfx/` (`index.json` lists each sound's variant count);
 * every play picks a random variant with a slight pitch spread. Music streams from media elements
 * so long tracks are not decoded into memory.
 *
 * Browsers keep audio silent until a user gesture: `installUnlock()` resumes the context on the
 * first key or pointer press.
 */
export type Bus = 'sfx' | 'ui' | 'music';

export interface PlayOptions {
  /** Linear gain on top of the bus (1 = as built, the samples are peak-normalised). */
  gain?: number;
  /** Playback rate before the random spread (pitch and speed). */
  rate?: number;
  /** Random rate spread, ± this fraction (default 0.05). */
  spread?: number;
  bus?: Bus;
  /** May cut the oldest voice of the same sound when its cap is reached (else the new one is dropped). */
  steal?: boolean;
}

interface Voice {
  src: AudioBufferSourceNode;
  started: number;
}

/** Most voices of one sound at once, and of all effects together. */
const PER_SOUND = 3;
const TOTAL = 24;

const BASE = `${import.meta.env.BASE_URL}audio/`;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<Bus | 'master', GainNode>> = {};
  private buffers = new Map<string, AudioBuffer[]>();
  private voices = new Map<string, Voice[]>();
  private total = 0;
  private loading: Promise<void> | null = null;
  private unlockListeners: (() => void)[] = [];
  /** Bus volumes, 0..1 (the settings screen in 6g will set these). */
  readonly volume: Record<Bus | 'master', number> = { master: 0.8, sfx: 0.9, ui: 0.7, music: 0.5 };

  /** The audio context, created on first use (`null` where Web Audio is missing). */
  context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const master = ctx.createGain();
    master.connect(ctx.destination);
    this.buses.master = master;
    for (const bus of ['sfx', 'ui', 'music'] as const) {
      const g = ctx.createGain();
      g.connect(master);
      this.buses[bus] = g;
    }
    this.ctx = ctx;
    this.applyVolumes();
    return ctx;
  }

  bus(name: Bus): GainNode | null {
    this.context();
    return this.buses[name] ?? null;
  }

  applyVolumes(): void {
    for (const [k, v] of Object.entries(this.volume)) {
      const g = this.buses[k as Bus | 'master'];
      if (g) g.gain.value = v;
    }
  }

  /** Resumes the context on the first gesture (and again after the browser suspends it). */
  installUnlock(): void {
    const resume = (): void => {
      const ctx = this.context();
      if (!ctx) return;
      const ran = ctx.state === 'running';
      void (ran ? Promise.resolve() : ctx.resume()).then(() => {
        if (!ran) for (const f of this.unlockListeners) f();
      });
      void this.load();
    };
    window.addEventListener('pointerdown', resume, true);
    window.addEventListener('keydown', resume, true);
  }

  /** Runs `f` whenever a gesture brings the context (back) to running. */
  onUnlock(f: () => void): void {
    this.unlockListeners.push(f);
  }

  /** Fetches and decodes every effect once. Safe to call repeatedly. */
  load(): Promise<void> {
    if (this.loading) return this.loading;
    const ctx = this.context();
    if (!ctx) return Promise.resolve();
    this.loading = (async () => {
      const index = (await (await fetch(`${BASE}sfx/index.json`)).json()) as Record<string, number>;
      await Promise.all(
        Object.entries(index).map(async ([name, count]) => {
          const list: AudioBuffer[] = [];
          for (let i = 0; i < count; i++) {
            try {
              const data = await (await fetch(`${BASE}sfx/${name}-${i}.m4a`)).arrayBuffer();
              list.push(await ctx.decodeAudioData(data));
            } catch {
              // A file the browser cannot decode: play the other variants.
            }
          }
          this.buffers.set(name, list);
        }),
      );
    })().catch(() => {
      // Offline or blocked: the game runs silent.
    });
    return this.loading;
  }

  /** Sound names that are loaded (for the sound board). */
  names(): string[] {
    return [...this.buffers.keys()].sort();
  }

  play(name: string, opts: PlayOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const list = this.buffers.get(name);
    if (!list || list.length === 0) return;
    const active = this.voices.get(name) ?? [];
    if (active.length >= PER_SOUND || this.total >= TOTAL) {
      if (!opts.steal || active.length === 0) return;
      active[0]!.src.stop();
    }
    const buffer = list[Math.floor(Math.random() * list.length)]!;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const spread = opts.spread ?? 0.05;
    src.playbackRate.value = (opts.rate ?? 1) * (1 + (Math.random() * 2 - 1) * spread);
    const gain = ctx.createGain();
    gain.gain.value = opts.gain ?? 1;
    src.connect(gain).connect(this.buses[opts.bus ?? 'sfx']!);
    const voice: Voice = { src, started: ctx.currentTime };
    active.push(voice);
    this.voices.set(name, active);
    this.total++;
    src.onended = () => {
      const i = active.indexOf(voice);
      if (i >= 0) active.splice(i, 1);
      this.total--;
      gain.disconnect();
    };
    src.start();
  }
}

export const audio = new AudioEngine();
