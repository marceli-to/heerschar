import * as THREE from 'three';
import type { AreaEffect, Battle } from '../sim/types';
import { FX } from './palette';

const Y = 0.04;

interface Item {
  group: THREE.Group;
  base: THREE.Mesh;
  rim: THREE.Mesh;
  fill: THREE.Mesh;
  heal: boolean;
}

function flatMat(color: string, opacity: number, additive = false): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/**
 * Ground circles for area effects. Damage areas are warnings (approved 2026-11-14): a translucent
 * red-orange disc with a bright rim and an inner disc that grows to the edge as the timer runs
 * out. Healing circles glow green with a pulse growing towards each heal.
 */
export class AreaLayer {
  readonly group = new THREE.Group();
  private items = new Map<number, Item>();
  private disc = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2);
  /** Rim geometry per radius, so the rim stays ~0.12 m wide on every circle. */
  private rims = new Map<number, THREE.BufferGeometry>();
  private time = 0;

  sync(battle: Battle, frameTime: number): void {
    this.time += frameTime;
    const alive = new Set<number>();
    for (const a of battle.areas) {
      alive.add(a.id);
      let it = this.items.get(a.id);
      if (!it) {
        it = this.build(a);
        this.items.set(a.id, it);
        this.group.add(it.group);
      }
      it.group.position.set(a.pos.x, Y, a.pos.z);
      it.group.scale.setScalar(a.radius);
      if (it.heal) {
        // Progress towards the next pulse.
        const start = a.delay - (a.interval || a.delay);
        const k = Math.min(1, Math.max(0, (a.time - start) / Math.max(0.01, a.delay - start)));
        it.fill.scale.setScalar(Math.max(0.001, k));
        (it.fill.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - k * 0.6);
        (it.base.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(this.time * 5) * 0.03;
      } else {
        const k = Math.min(1, a.time / Math.max(0.01, a.delay));
        it.fill.scale.setScalar(Math.max(0.001, k));
        // The rim brightens as the blow gets close.
        (it.rim.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * k;
      }
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      this.group.remove(it.group);
      for (const m of [it.base, it.rim, it.fill]) (m.material as THREE.Material).dispose();
      this.items.delete(id);
    }
  }

  private build(a: AreaEffect): Item {
    const group = new THREE.Group();
    const heal = a.heal;
    const base = new THREE.Mesh(this.disc, flatMat(heal ? FX.heal : FX.warning, heal ? 0.16 : 0.2));
    const fill = new THREE.Mesh(this.disc, flatMat(heal ? FX.healCore : FX.warning, heal ? 0.25 : 0.32));
    fill.position.y = 0.005;
    const rim = new THREE.Mesh(this.rimGeometry(a.radius), flatMat(heal ? FX.heal : FX.warningRim, 0.8));
    rim.position.y = 0.01;
    for (const [m, order] of [[base, 1], [fill, 2], [rim, 3]] as const) m.renderOrder = order;
    group.add(base, fill, rim);
    return { group, base, rim, fill, heal };
  }

  private rimGeometry(radius: number): THREE.BufferGeometry {
    const key = Math.round(radius * 100);
    let g = this.rims.get(key);
    if (!g) {
      g = new THREE.RingGeometry(1 - 0.12 / Math.max(0.5, radius), 1, 64, 1).rotateX(-Math.PI / 2);
      this.rims.set(key, g);
    }
    return g;
  }

  dispose(): void {
    for (const it of this.items.values()) this.group.remove(it.group);
    this.items.clear();
    this.disc.dispose();
    for (const g of this.rims.values()) g.dispose();
    this.rims.clear();
  }
}
