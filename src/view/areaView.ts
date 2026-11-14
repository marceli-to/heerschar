import * as THREE from 'three';
import type { AreaEffect, Battle } from '../sim/types';
import { FX } from './palette';

const Y = 0.04;
/** Width of the bright rim, metres. */
const RIM = 0.12;
/** Seconds the Fen Witch's poison stays on the ground after it hits, fading out. */
const POISON_LINGER = 1.6;

interface Item {
  group: THREE.Group;
  base: THREE.Mesh;
  rim: THREE.Mesh;
  fill: THREE.Mesh;
  heal: boolean;
  shape: AreaEffect['shape'];
  /** Geometry built for this item alone (arcs and lanes), disposed with it. */
  own: THREE.BufferGeometry[];
  /** Poison only: seconds left on the ground after it resolved (`null` = still pending). */
  linger: number | null;
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

/** Colours of a warning by kind: the Witch's poison is sickly green, every other blow red-orange. */
function colours(a: AreaEffect): { base: string; fill: string; rim: string } {
  if (a.heal) return { base: FX.heal, fill: FX.healCore, rim: FX.heal };
  if (a.kind === 'poison') return { base: FX.poison, fill: FX.poison, rim: FX.poisonRim };
  return { base: FX.warning, fill: FX.warning, rim: FX.warningRim };
}

/**
 * Ground warnings for area effects (approved 2026-11-14): a translucent red-orange shape with a
 * bright rim and an inner fill that grows to the edge as the timer runs out. Circles fill from the
 * centre, boss sweeps are filling arcs, charges filling lanes (from the boss outward). The Fen
 * Witch's poison circles are sickly green and linger briefly after they hit. Healing circles glow
 * green with a pulse growing towards each heal.
 *
 * Shapes are built pointing along facing 0 (-z) and turned by the area's angle.
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
      if (it.heal) {
        // Progress towards the next pulse.
        const start = a.delay - (a.interval || a.delay);
        const k = Math.min(1, Math.max(0, (a.time - start) / Math.max(0.01, a.delay - start)));
        it.fill.scale.setScalar(Math.max(0.001, k));
        (it.fill.material as THREE.MeshBasicMaterial).opacity = 0.25 * (1 - k * 0.6);
        (it.base.material as THREE.MeshBasicMaterial).opacity = 0.16 + Math.sin(this.time * 5) * 0.03;
      } else {
        const k = Math.max(0.001, Math.min(1, a.time / Math.max(0.01, a.delay)));
        // Lanes fill from the boss outward; circles and arcs from the centre.
        if (it.shape === 'lane') it.fill.scale.set(1, 1, k);
        else it.fill.scale.setScalar(k);
        // The rim brightens as the blow gets close.
        (it.rim.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.4 * k;
      }
    }
    for (const [id, it] of this.items) {
      if (alive.has(id)) continue;
      if (it.linger !== null) {
        if (it.linger === Infinity) {
          // Just hit: the puddle stays full and fades out.
          it.linger = POISON_LINGER;
          it.fill.scale.setScalar(1);
        }
        it.linger -= frameTime;
        const f = Math.max(0, it.linger / POISON_LINGER);
        (it.base.material as THREE.MeshBasicMaterial).opacity = 0.3 * f;
        (it.fill.material as THREE.MeshBasicMaterial).opacity = 0.35 * f * (0.85 + Math.sin(this.time * 9) * 0.15);
        (it.rim.material as THREE.MeshBasicMaterial).opacity = 0.7 * f;
        if (it.linger > 0) continue;
      }
      this.group.remove(it.group);
      for (const m of [it.base, it.rim, it.fill]) (m.material as THREE.Material).dispose();
      for (const g of it.own) g.dispose();
      this.items.delete(id);
    }
  }

  private build(a: AreaEffect): Item {
    const group = new THREE.Group();
    const c = colours(a);
    const own: THREE.BufferGeometry[] = [];
    let disc: THREE.BufferGeometry;
    let rimGeo: THREE.BufferGeometry;
    if (a.shape === 'circle') {
      disc = this.disc;
      rimGeo = this.rimGeometry(a.radius);
      group.scale.setScalar(a.radius);
    } else if (a.shape === 'arc') {
      // A pie slice centred on -z.
      const start = Math.PI / 2 - a.arc / 2;
      disc = new THREE.CircleGeometry(a.radius, 40, start, a.arc).rotateX(-Math.PI / 2);
      rimGeo = arcOutline(a.radius, start, a.arc);
      own.push(disc, rimGeo);
      group.rotation.y = -a.angle;
    } else {
      // A strip from the origin along -z, `length` long and `radius` to either side.
      disc = new THREE.PlaneGeometry(a.radius * 2, a.length).rotateX(-Math.PI / 2).translate(0, 0, -a.length / 2);
      rimGeo = laneOutline(a.radius, a.length);
      own.push(disc, rimGeo);
      group.rotation.y = -a.angle;
    }
    const heal = a.heal;
    const base = new THREE.Mesh(disc, flatMat(c.base, heal ? 0.16 : 0.2));
    const fill = new THREE.Mesh(disc, flatMat(c.fill, heal ? 0.25 : 0.32));
    fill.position.y = 0.005;
    const rim = new THREE.Mesh(rimGeo, flatMat(c.rim, 0.8));
    rim.position.y = 0.01;
    for (const [m, order] of [[base, 1], [fill, 2], [rim, 3]] as const) m.renderOrder = order;
    group.add(base, fill, rim);
    return { group, base, rim, fill, heal, shape: a.shape, own, linger: a.kind === 'poison' ? Infinity : null };
  }

  private rimGeometry(radius: number): THREE.BufferGeometry {
    const key = Math.round(radius * 100);
    let g = this.rims.get(key);
    if (!g) {
      g = new THREE.RingGeometry(1 - RIM / Math.max(0.5, radius), 1, 64, 1).rotateX(-Math.PI / 2);
      this.rims.set(key, g);
    }
    return g;
  }

  dispose(): void {
    for (const it of this.items.values()) {
      this.group.remove(it.group);
      for (const g of it.own) g.dispose();
    }
    this.items.clear();
    this.disc.dispose();
    for (const g of this.rims.values()) g.dispose();
    this.rims.clear();
  }
}

/** Outline of a pie slice in metres: the outer arc plus both straight edges, flat on the ground. */
function arcOutline(radius: number, start: number, length: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.RingGeometry(radius - RIM, radius, 40, 1, start, length)];
  for (const t of [start, start + length]) {
    const edge = new THREE.PlaneGeometry(radius, RIM).translate(radius / 2, 0, 0).rotateZ(t);
    // The edge on the far side sits inside the slice too.
    edge.translate(Math.cos(t + (t === start ? Math.PI / 2 : -Math.PI / 2)) * (RIM / 2), Math.sin(t + (t === start ? Math.PI / 2 : -Math.PI / 2)) * (RIM / 2), 0);
    parts.push(edge);
  }
  const merged = mergeFlat(parts);
  return merged.rotateX(-Math.PI / 2);
}

/** Outline of a lane in metres, built along -z from the origin. */
function laneOutline(half: number, length: number): THREE.BufferGeometry {
  const sides = [
    new THREE.PlaneGeometry(RIM, length).translate(-half + RIM / 2, length / 2, 0),
    new THREE.PlaneGeometry(RIM, length).translate(half - RIM / 2, length / 2, 0),
    new THREE.PlaneGeometry(half * 2, RIM).translate(0, length - RIM / 2, 0),
  ];
  // Built in XY with +y forward; rotateX(-PI/2) turns +y into -z.
  return mergeFlat(sides).rotateX(-Math.PI / 2);
}

/** Merges non-indexed copies of flat XY geometries into one (positions only). */
function mergeFlat(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const arrays: number[] = [];
  for (const p of parts) {
    const g = p.index ? p.toNonIndexed() : p;
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) arrays.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (g !== p) g.dispose();
    p.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(arrays, 3));
  return out;
}
