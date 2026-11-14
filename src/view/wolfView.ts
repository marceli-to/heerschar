import * as THREE from 'three';
import { clamp, lerp } from '../sim/math';
import { BOSS_COLORS, FX } from './palette';
import type { AnimInput, UnitView } from './unitView';

const FLASH_TIME = 0.14;
const FROZEN_MIX = 0.6;
const HIP_Y = 0.5;
const ICE = new THREE.Color(FX.frozenTint);

function ease(t: number): number {
  const c = clamp(t, 0, 1);
  return 1 - (1 - c) * (1 - c);
}

/**
 * The Fen Witch's wolf (Stage 5 decision: small, fast, simple primitive wolf, grey fur). Its own
 * view because the humanoid rig and poses do not fit four legs: it trots, crouches on the windup,
 * lunges with the bite, staggers when stunned and rolls onto its side when it falls.
 * Built facing -z like the figures.
 */
export class WolfView implements UnitView {
  readonly root = new THREE.Group();
  readonly barY = 1.35;
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly materials: THREE.MeshLambertMaterial[] = [];
  private readonly baseColors: THREE.Color[];
  private walkPhase = 0;
  private idleTime = 0;
  private flash = 0;
  private flashStrength = 1;
  private frost = 0;

  constructor() {
    const k = BOSS_COLORS;
    const mat = (color: string) => {
      const m = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.push(m);
      return m;
    };
    const fur = mat(k.wolf);
    const dark = mat(k.wolfDark);
    const light = mat(k.wolfLight);
    const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      return mesh;
    };

    this.root.rotation.order = 'YXZ';
    this.root.scale.setScalar(1.25);
    this.body.position.y = HIP_Y;
    this.root.add(this.body);
    // Body: a deep chest tapering to the hips, a lighter belly, a ruff at the neck.
    this.body.add(box(0.3, 0.3, 0.75, fur, 0, 0.12, 0), box(0.24, 0.08, 0.6, light, 0, -0.04, 0), box(0.36, 0.34, 0.2, dark, 0, 0.16, -0.3));

    this.head.position.set(0, 0.24, -0.42);
    const snout = box(0.12, 0.1, 0.2, light, 0, -0.03, -0.17);
    const nose = box(0.05, 0.04, 0.04, mat('#1d1b19'), 0, 0, -0.28);
    this.head.add(box(0.2, 0.18, 0.2, fur, 0, 0, 0), snout, nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), dark);
      ear.position.set(s * 0.06, 0.13, 0.03);
      ear.castShadow = true;
      this.head.add(ear);
    }
    this.body.add(this.head);

    this.tail.position.set(0, 0.2, 0.37);
    const tailMesh = box(0.08, 0.08, 0.34, dark, 0, 0, 0.16);
    this.tail.add(tailMesh);
    this.tail.rotation.x = -0.5;
    this.body.add(this.tail);

    // Front legs, then hind legs; each pivots at the shoulder / hip.
    for (const [x, z] of [[-0.1, -0.26], [0.1, -0.26], [-0.1, 0.27], [0.1, 0.27]] as const) {
      const leg = new THREE.Group();
      leg.position.set(x, 0, z);
      leg.add(box(0.08, HIP_Y, 0.09, fur, 0, -HIP_Y / 2, 0), box(0.09, 0.05, 0.12, dark, 0, -HIP_Y + 0.025, -0.02));
      this.body.add(leg);
      this.legs.push(leg);
    }
    this.baseColors = this.materials.map((m) => m.color.clone());
  }

  setPose(x: number, z: number, facing: number): void {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = -facing;
  }

  flashHit(heavy: boolean): void {
    this.flash = FLASH_TIME;
    this.flashStrength = heavy ? 0.55 : 0.38;
  }

  animate(a: AnimInput, frameTime: number): void {
    this.updateTint(a, frameTime);
    const t = a.frozen ? 0 : frameTime;
    this.idleTime += t;
    this.reset();
    switch (a.state) {
      case 'idle':
      case 'moving':
      case 'dodging':
        this.trot(a.speed, t);
        break;
      case 'windup': {
        // Crouch back with the head low.
        const p = ease(a.stateTime / Math.max(0.01, a.windup));
        this.body.position.z = 0.12 * p;
        this.body.position.y = HIP_Y - 0.08 * p;
        this.body.rotation.x = 0.12 * p;
        this.head.rotation.x = 0.35 * p;
        break;
      }
      case 'recover': {
        // The bite: a snap forward, then settle.
        const strike = ease(a.stateTime / 0.08);
        const back = ease((a.stateTime - 0.1) / Math.max(0.05, a.recover - 0.1));
        const k = strike * (1 - back);
        this.body.position.z = lerp(0.12, -0.3, k) * (1 - back);
        this.body.rotation.x = -0.15 * k;
        this.head.rotation.x = -0.4 * k;
        this.legs[0]!.rotation.x = 0.7 * k;
        this.legs[1]!.rotation.x = 0.7 * k;
        break;
      }
      case 'stunned': {
        const p = a.stateTime / Math.max(0.05, a.stunDuration);
        this.body.rotation.z = Math.sin(p * Math.PI * 4) * 0.12 * (1 - p);
        this.head.rotation.x = 0.3;
        break;
      }
      case 'dead': {
        // Rolls onto its side.
        const p = ease(a.stateTime / 0.5);
        this.root.rotation.z = (Math.PI / 2) * p;
        this.root.position.y = 0;
        this.body.position.y = lerp(HIP_Y, 0.2, p);
        for (const leg of this.legs) leg.rotation.x = 0.3 * p;
        break;
      }
    }
  }

  private reset(): void {
    this.root.rotation.z = 0;
    this.body.position.set(0, HIP_Y, 0);
    this.body.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    for (const leg of this.legs) leg.rotation.set(0, 0, 0);
    this.tail.rotation.set(-0.5 + Math.sin(this.idleTime * 3) * 0.08, Math.sin(this.idleTime * 5) * 0.2, 0);
  }

  /** A trot: diagonal leg pairs swing together, a little body bob. */
  private trot(speed: number, frameTime: number): void {
    const s = clamp(speed / 6, 0, 1);
    this.walkPhase += frameTime * (4 + speed * 2.2);
    const w = Math.sin(this.walkPhase) * 0.7 * s;
    const [fl, fr, hl, hr] = this.legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
    fl.rotation.x = w;
    hr.rotation.x = w;
    fr.rotation.x = -w;
    hl.rotation.x = -w;
    this.body.position.y = HIP_Y + Math.abs(Math.cos(this.walkPhase)) * 0.04 * s + Math.sin(this.idleTime * 2) * 0.006;
    this.head.rotation.x = 0.1 * s;
  }

  private updateTint(a: AnimInput, frameTime: number): void {
    this.flash = Math.max(0, this.flash - frameTime);
    this.frost += ((a.frozen ? 1 : 0) - this.frost) * Math.min(1, frameTime * 10);
    const f = (this.flash / FLASH_TIME) * this.flashStrength;
    this.materials.forEach((m, i) => {
      const base = this.baseColors[i]!;
      m.color.copy(base).lerp(ICE, this.frost * FROZEN_MIX);
      m.emissive.setRGB(f, f, f);
    });
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}
