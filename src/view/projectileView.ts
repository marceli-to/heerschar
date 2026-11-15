import * as THREE from 'three';
import { lerp } from '../sim/math';
import type { Battle, Projectile } from '../sim/types';
import type { Effects } from './effects';
import { FX, hdr } from './palette';

const SHOT_Y = 1.35;
const ARC = { fromY: 1.9, toY: 0.25, apex: 2.4 } as const;

type Look = 'arrow' | 'piercing' | 'volley' | 'fire' | 'holy' | 'fireball' | 'hex';

interface Item {
  obj: THREE.Group;
  look: Look;
  prevX: number;
  prevZ: number;
  trailTimer: number;
  /** Where a straight shot started: its streak grows over the first metres, never poking out behind the shooter. */
  startX: number;
  startZ: number;
  /** The arrow's streak, if it has one, and its full length. */
  streak: THREE.Object3D | null;
  streakLen: number;
}

/**
 * Projectiles on screen: wooden arrows with a pale streak, glowing bolts (fire for the Magier,
 * golden-white light for Heiler and Schamane, sickly green for the Fen Witch's hex) and arcing
 * fireballs, all leaving trails.
 * Synced to `battle.projectiles` by id and interpolated between ticks.
 */
export class ProjectileLayer {
  readonly group = new THREE.Group();
  private items = new Map<number, Item>();
  /** One template per look; projectiles are clones sharing geometry and materials. */
  private templates = new Map<Look, THREE.Group>();
  private shared = {
    shaft: new THREE.MeshLambertMaterial({ color: '#7a5634', flatShading: true }),
    head: new THREE.MeshLambertMaterial({ color: '#c4c8cf', flatShading: true }),
    fletch: new THREE.MeshBasicMaterial({ color: '#efe8d8' }),
    streak: new THREE.MeshBasicMaterial({ color: FX.arrowStreak, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    streakStrong: new THREE.MeshBasicMaterial({ color: hdr(FX.holy, 2), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
    streakVolley: new THREE.MeshBasicMaterial({ color: hdr(FX.arrowStreak, 1.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  };

  constructor(private readonly effects: Effects) {}

  /** Remember where every projectile was before the tick, for interpolation. */
  capture(battle: Battle): void {
    for (const p of battle.projectiles) {
      const it = this.items.get(p.id);
      if (it) {
        it.prevX = p.pos.x;
        it.prevZ = p.pos.z;
      }
    }
  }

  sync(battle: Battle, alpha: number, frameTime: number): void {
    const alive = new Set<number>();
    for (const p of battle.projectiles) {
      alive.add(p.id);
      let it = this.items.get(p.id);
      if (!it) {
        const owner = battle.units.find((u) => u.id === p.ownerId);
        const look = lookOf(p, owner?.classId === 'magier');
        const start = p.arc ? p.from : p.pos;
        const obj = this.template(look).clone();
        const streak = obj.getObjectByName('streak') ?? null;
        it = { obj, look, prevX: start.x, prevZ: start.z, trailTimer: 0, startX: start.x, startZ: start.z, streak, streakLen: streak ? (streak.userData.len as number) : 0 };
        this.items.set(p.id, it);
        this.group.add(it.obj);
      }
      const x = lerp(it.prevX, p.pos.x, alpha);
      const z = lerp(it.prevZ, p.pos.z, alpha);
      const y = p.arc ? arcHeight(p, x, z) : SHOT_Y;
      // Face along the flight: a little ahead on the same path.
      const ahead = p.arc ? arcAhead(p, x, z) : { x: x + p.dir.x, y, z: z + p.dir.z };
      it.obj.position.set(x, y, z);
      it.obj.lookAt(ahead.x, ahead.y, ahead.z);
      if (it.streak) {
        const k = Math.max(0.02, Math.min(1, Math.hypot(x - it.startX, z - it.startZ) / (it.streakLen * it.obj.scale.z)));
        it.streak.scale.z = k;
        it.streak.position.z = -0.3 - (it.streakLen * k) / 2;
      }
      this.emitTrail(it, x, y, z, frameTime);
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      this.group.remove(it.obj);
      this.items.delete(id);
    }
  }

  private emitTrail(it: Item, x: number, y: number, z: number, frameTime: number): void {
    if (frameTime <= 0) return;
    it.trailTimer -= frameTime;
    if (it.trailTimer > 0) return;
    switch (it.look) {
      case 'arrow':
        return;
      case 'piercing':
        it.trailTimer = 0.02;
        this.effects.trail(x, y, z, FX.holy, 0.05, 0.25);
        return;
      case 'volley':
        it.trailTimer = 0.016;
        this.effects.trail(x, y, z, FX.arrowStreak, 0.06, 0.22);
        return;
      case 'fire':
        it.trailTimer = 0.016;
        this.effects.trail(x, y, z, Math.random() < 0.5 ? FX.fire : FX.ember, 0.08, 0.28, 0.6);
        return;
      case 'holy':
        it.trailTimer = 0.016;
        this.effects.trail(x, y, z, Math.random() < 0.5 ? FX.holy : FX.holyCore, 0.06, 0.25, 0.3);
        return;
      case 'hex':
        it.trailTimer = 0.016;
        this.effects.trail(x, y, z, Math.random() < 0.6 ? FX.poison : FX.poisonCore, 0.08, 0.3, 0.4);
        return;
      case 'fireball':
        it.trailTimer = 0.012;
        this.effects.trail(x, y, z, Math.random() < 0.35 ? FX.fireCore : Math.random() < 0.6 ? FX.fire : FX.ember, 0.13, 0.4, 0.8);
        if (Math.random() < 0.2) this.effects.trail(x, y + 0.1, z, '#9a9088', 0.1, 0.35, 0.5);
        return;
    }
  }

  private template(look: Look): THREE.Group {
    let t = this.templates.get(look);
    if (!t) {
      t = this.build(look);
      this.templates.set(look, t);
    }
    return t;
  }

  /** Every projectile is built along +z, so `lookAt` points it along the flight. */
  private build(look: Look): THREE.Group {
    const g = new THREE.Group();
    const m = this.shared;
    if (look === 'arrow' || look === 'piercing' || look === 'volley') {
      const strong = look !== 'arrow';
      const scale = strong ? 1.3 : 1;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.8), m.shaft);
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4).rotateX(Math.PI / 2), m.head);
      head.position.z = 0.45;
      const fletch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.07, 0.14), m.fletch);
      fletch.position.z = -0.33;
      const streakLen = strong ? 2.4 : 1.4;
      const streakMat = look === 'volley' ? m.streakVolley : look === 'piercing' ? m.streakStrong : m.streak;
      const streak = new THREE.Mesh(new THREE.BoxGeometry(strong ? 0.06 : 0.05, strong ? 0.06 : 0.05, streakLen), streakMat);
      streak.position.z = -0.3 - streakLen / 2;
      streak.name = 'streak';
      streak.userData.len = streakLen;
      g.add(shaft, head, fletch, streak);
      g.scale.setScalar(scale);
      return g;
    }
    const size = look === 'fireball' ? 0.24 : look === 'hex' ? 0.16 : 0.13;
    const [halo, core] = look === 'holy' ? [FX.holy, FX.holyCore] : look === 'hex' ? [FX.poison, FX.poisonCore] : [FX.fire, FX.fireCore];
    const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), new THREE.MeshBasicMaterial({ color: hdr(core, 4) }));
    const outer = new THREE.Mesh(
      new THREE.IcosahedronGeometry(size * 1.8, 1),
      new THREE.MeshBasicMaterial({ color: hdr(halo, 1.5), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    g.add(inner, outer);
    return g;
  }

  dispose(): void {
    for (const it of this.items.values()) this.group.remove(it.obj);
    this.items.clear();
    for (const t of this.templates.values()) {
      t.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
    }
    this.templates.clear();
  }
}

function lookOf(p: Projectile, mage: boolean): Look {
  switch (p.kind) {
    case 'arrow':
      // The hero's Volley: bolts that pass through everyone, a bright white streak.
      return p.pierce ? 'volley' : 'arrow';
    case 'piercing':
      return 'piercing';
    case 'fireball':
      return 'fireball';
    case 'bolt':
      return mage ? 'fire' : 'holy';
    case 'hex':
      return 'hex';
  }
}

/** 0..1 progress along an arc's ground path. */
function arcProgress(p: Projectile, x: number, z: number): number {
  const total = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
  if (total < 1e-4) return Math.min(1, p.time / Math.max(0.01, p.duration));
  return Math.min(1, Math.hypot(x - p.from.x, z - p.from.z) / total);
}

function heightAt(f: number): number {
  return lerp(ARC.fromY, ARC.toY, f) + 4 * ARC.apex * f * (1 - f);
}

function arcHeight(p: Projectile, x: number, z: number): number {
  return heightAt(arcProgress(p, x, z));
}

function arcAhead(p: Projectile, x: number, z: number): { x: number; y: number; z: number } {
  const f = Math.min(1, arcProgress(p, x, z) + 0.05);
  return { x: lerp(p.from.x, p.to.x, f) + (p.to.x - p.from.x) * 1e-3, y: heightAt(f), z: lerp(p.from.z, p.to.z, f) + (p.to.z - p.from.z) * 1e-3 };
}
