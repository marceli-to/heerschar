import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { RegionId } from '../../data/campaign';
import { recolored } from '../models/recolor';
import { REGION_LOOKS } from './looks';

/**
 * Scenery props from two CC0 KayKit packs (`public/models/scenery/`, packed by `tools/scenery.mjs`):
 * Medieval Hexagon (trees, rocks, farm buildings, fences, flags, clouds) and Halloween Bits (pines,
 * dead trees, graves, fences, crypt, lanterns, bones). Every prop is baked into one geometry so the
 * arena can draw each kind as a single instanced mesh.
 */
export type ScenePack = 'medieval' | 'halloween';

export interface PropTemplate {
  pack: ScenePack;
  geometry: THREE.BufferGeometry;
  /** A part that turns (the windmill's sails): its geometry around its own pivot, and the pivot's place in the prop. */
  spinner?: { geometry: THREE.BufferGeometry; pivot: THREE.Matrix4; axis: THREE.Vector3 };
  /** Where lantern glass sits (prop space), for the glow added on top. */
  glow: THREE.Vector3[];
}

/** Swatch cell of the lantern glass in the Halloween texture. */
const GLASS_CELL = [2, 3] as const;

interface Library {
  props: Map<string, PropTemplate>;
  textures: Record<ScenePack, THREE.Texture>;
}

let library: Library | null = null;
let loading: Promise<void> | null = null;
const materials = new Map<string, THREE.MeshLambertMaterial>();

/** Starts loading the scenery (once). On failure the arenas keep their code-built parts only. */
export function loadScenery(): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    const packs: ScenePack[] = ['medieval', 'halloween'];
    const gltfs = await Promise.all(packs.map((p) => loader.loadAsync(`${import.meta.env.BASE_URL}models/scenery/${p}.glb`)));
    const lib: Library = { props: new Map(), textures: {} as Record<ScenePack, THREE.Texture> };
    packs.forEach((pack, i) => {
      const scene = gltfs[i]!.scene;
      scene.updateMatrixWorld(true);
      for (const root of scene.children) lib.props.set(root.name, bake(root, pack));
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.map && !lib.textures[pack]) lib.textures[pack] = m.map;
      });
    });
    library = lib;
  })().catch((err: unknown) => {
    console.error('Scenery failed to load; arenas use code-built parts only.', err);
  });
  return loading;
}

export function sceneryReady(): boolean {
  return library !== null;
}

export function propTemplate(id: string): PropTemplate {
  const p = library?.props.get(id);
  if (!p) throw new Error(`scenery prop ${id} not loaded`);
  return p;
}

/** The pack's material in the region's colours (shared by every arena of that region). */
export function sceneryMaterial(pack: ScenePack, region: RegionId): THREE.MeshLambertMaterial {
  const key = `${pack}:${region}`;
  let m = materials.get(key);
  if (!m) {
    const src = library!.textures[pack];
    m = new THREE.MeshLambertMaterial({ map: recolored(src, REGION_LOOKS[region].swaps[pack], `scenery:${key}`) });
    materials.set(key, m);
  }
  return m;
}

/** Bakes every mesh under a prop root into one geometry in the root's frame; splits off the sails. */
function bake(root: THREE.Object3D, pack: ScenePack): PropTemplate {
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const parts: THREE.BufferGeometry[] = [];
  const glow: THREE.Vector3[] = [];
  let spinner: PropTemplate['spinner'];
  const take = (mesh: THREE.Mesh, toProp: THREE.Matrix4): THREE.BufferGeometry => {
    const g = new THREE.BufferGeometry();
    const src = mesh.geometry;
    for (const name of ['position', 'normal', 'uv'] as const) g.setAttribute(name, src.getAttribute(name).clone());
    if (src.index) g.setIndex(src.index.clone());
    return g.applyMatrix4(toProp);
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const toProp = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    if (/fan/i.test(mesh.name) || /fan/i.test(mesh.parent?.name ?? '')) {
      // Sails: geometry stays in its own frame so it can turn about its pivot.
      spinner = { geometry: take(mesh, new THREE.Matrix4()), pivot: toProp, axis: new THREE.Vector3(0, 0, 1) };
      return;
    }
    const g = take(mesh, toProp);
    if (pack === 'halloween') glow.push(...glassSpots(g));
    parts.push(g);
  });
  const geometry = parts.length === 1 ? parts[0]! : mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  geometry.computeBoundingSphere();
  return { pack, geometry, spinner, glow };
}

/** Centre of the vertices painted with the lantern-glass swatch (one spot per lantern). */
function glassSpots(g: THREE.BufferGeometry): THREE.Vector3[] {
  const uv = g.getAttribute('uv');
  const pos = g.getAttribute('position');
  const c = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < uv.count; i++) {
    if (Math.floor(uv.getX(i) * 8) !== GLASS_CELL[0] || Math.floor(uv.getY(i) * 4) !== GLASS_CELL[1]) continue;
    c.x += pos.getX(i);
    c.y += pos.getY(i);
    c.z += pos.getZ(i);
    n++;
  }
  return n > 0 ? [c.divideScalar(n)] : [];
}
