import * as THREE from 'three';

/** Colours approved 2026-11-14. */
export const NUMBER_COLORS = {
  dealt: '#fff4dc',
  taken: '#ff4a3a',
  heal: '#7dff8a',
  absorbed: '#a9d4ff',
} as const;

export type NumberKind = keyof typeof NUMBER_COLORS;

interface Num {
  el: HTMLDivElement;
  x: number;
  y: number;
  z: number;
  /** Screen-space drift in px. */
  dx: number;
  age: number;
  life: number;
}

const LIFE = 0.95;
const MAX = 80;
const _v = new THREE.Vector3();

/**
 * Bold, punchy floating numbers (approved 2026-11-14): pop in large, bounce, rise and fade.
 * DOM elements over the canvas, projected from world positions every frame.
 */
export class DamageNumbers {
  private readonly root: HTMLDivElement;
  private live: Num[] = [];
  private free: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    parent.appendChild(this.root);
  }

  /** `size` scales the base font: heavy hits and the hero's own hits are bigger. */
  spawn(kind: NumberKind, value: number, x: number, y: number, z: number, size = 1): void {
    const shown = Math.round(value);
    if (shown <= 0) return;
    if (this.live.length >= MAX) this.recycle(this.live.shift()!);
    // Stack on numbers that just popped at the same spot, so a flurry stays readable.
    let stack = 0;
    for (const n of this.live) if (n.age < 0.25 && Math.abs(n.x - x) < 0.6 && Math.abs(n.z - z) < 0.6) stack++;
    y += stack * 0.32;
    const el = this.free.pop() ?? this.make();
    el.textContent = kind === 'heal' ? `+${shown}` : String(shown);
    el.style.color = NUMBER_COLORS[kind];
    const base = kind === 'absorbed' ? 15 : 22;
    el.style.fontSize = `${Math.round(base * size)}px`;
    el.style.display = 'block';
    this.live.push({ el, x, y, z, dx: (Math.random() - 0.5) * 40, age: 0, life: LIFE });
  }

  private make(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'font-family:Cinzel, serif',
      'font-weight:700',
      'line-height:1',
      'white-space:nowrap',
      'will-change:transform,opacity',
      'text-shadow:0 0 3px #1b130c, 0 2px 0 #1b130c, 1px 1px 0 #1b130c, -1px -1px 0 #1b130c, 1px -1px 0 #1b130c, -1px 1px 0 #1b130c',
    ].join(';');
    this.root.appendChild(el);
    return el;
  }

  private recycle(n: Num): void {
    n.el.style.display = 'none';
    this.free.push(n.el);
  }

  update(camera: THREE.Camera, width: number, height: number, frameTime: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const n = this.live[i]!;
      n.age += frameTime;
      if (n.age >= n.life) {
        this.live.splice(i, 1);
        this.recycle(n);
        continue;
      }
      _v.set(n.x, n.y, n.z).project(camera);
      if (_v.z > 1) {
        n.el.style.opacity = '0';
        continue;
      }
      const t = n.age / n.life;
      // Pop: overshoot to 1.5, settle to 1 by 0.18 s. Hop up quickly, then drift.
      const pop = n.age < 0.08 ? 0.4 + (n.age / 0.08) * 1.1 : n.age < 0.18 ? 1.5 - ((n.age - 0.08) / 0.1) * 0.5 : 1;
      const rise = 30 * (1 - Math.pow(1 - Math.min(1, n.age / 0.35), 3)) + 18 * t;
      const sx = (_v.x * 0.5 + 0.5) * width + n.dx * Math.min(1, n.age / 0.3);
      const sy = (-_v.y * 0.5 + 0.5) * height - rise;
      n.el.style.opacity = String(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      n.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${pop.toFixed(3)})`;
    }
  }

  clear(): void {
    for (const n of this.live) this.recycle(n);
    this.live = [];
  }

  dispose(): void {
    this.root.remove();
  }
}
