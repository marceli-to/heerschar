import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * The KayKit models the game uses (`public/models/`, copied and trimmed by `tools/kaykit.mjs`).
 * Loaded once, then cloned per unit. Each pack shares one rig and one clip set, kept only in its
 * first file (`ANIM_SOURCE`); every body of that pack plays those clips.
 */
export type ModelId = 'Knight' | 'Mage' | 'Rogue_Hooded' | 'Barbarian' | 'Skeleton_Warrior' | 'Skeleton_Minion' | 'Skeleton_Rogue' | 'Skeleton_Mage';
export type WeaponId = 'Skeleton_Blade' | 'Skeleton_Axe' | 'Skeleton_Shield_Large_A' | 'Skeleton_Shield_Small_A' | 'Skeleton_Crossbow' | 'Skeleton_Staff';
export type Pack = 'adventurers' | 'skeletons';

const DIR: Record<Pack, string> = { adventurers: 'kaykit', skeletons: 'kaykit-skeletons' };
export const MODEL_PACK: Record<ModelId, Pack> = {
  Knight: 'adventurers',
  Mage: 'adventurers',
  Rogue_Hooded: 'adventurers',
  Barbarian: 'adventurers',
  Skeleton_Warrior: 'skeletons',
  Skeleton_Minion: 'skeletons',
  Skeleton_Rogue: 'skeletons',
  Skeleton_Mage: 'skeletons',
};
const ANIM_SOURCE: Record<Pack, ModelId> = { adventurers: 'Knight', skeletons: 'Skeleton_Minion' };
const WEAPONS: WeaponId[] = ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Shield_Large_A', 'Skeleton_Shield_Small_A', 'Skeleton_Crossbow', 'Skeleton_Staff'];

interface Library {
  models: Map<ModelId, THREE.Group>;
  weapons: Map<WeaponId, THREE.Object3D>;
  clips: Map<Pack, Map<string, THREE.AnimationClip>>;
}

let library: Library | null = null;
let loading: Promise<void> | null = null;

const url = (pack: Pack, file: string): string => `${import.meta.env.BASE_URL}models/${DIR[pack]}/${file}`;

/** Starts loading every model (once); resolves when all are ready. Failing loads leave the code figures in place. */
export function loadModels(): Promise<void> {
  loading ??= (async () => {
    const loader = new GLTFLoader();
    const ids = Object.keys(MODEL_PACK) as ModelId[];
    const [models, weapons] = await Promise.all([
      Promise.all(ids.map((id) => loader.loadAsync(url(MODEL_PACK[id], `${id}.glb`)))),
      Promise.all(WEAPONS.map((id) => loader.loadAsync(url('skeletons', `${id}.gltf`)))),
    ]);
    const lib: Library = { models: new Map(), weapons: new Map(), clips: new Map() };
    ids.forEach((id, i) => {
      const gltf = models[i]!;
      lib.models.set(id, gltf.scene);
      if (ANIM_SOURCE[MODEL_PACK[id]] === id) lib.clips.set(MODEL_PACK[id], new Map(gltf.animations.map((c) => [c.name, c])));
    });
    WEAPONS.forEach((id, i) => {
      const part = weapons[i]!.scene.children[0];
      if (part) lib.weapons.set(id, part);
    });
    library = lib;
  })().catch((err: unknown) => {
    console.error('Models failed to load; using code figures.', err);
  });
  return loading;
}

export function modelsReady(): boolean {
  return library !== null;
}

export function modelTemplate(id: ModelId): THREE.Group {
  const m = library?.models.get(id);
  if (!m) throw new Error(`model ${id} not loaded`);
  return m;
}

export function weaponTemplate(id: WeaponId): THREE.Object3D {
  const w = library?.weapons.get(id);
  if (!w) throw new Error(`weapon ${id} not loaded`);
  return w;
}

export function packClips(pack: Pack): Map<string, THREE.AnimationClip> {
  const c = library?.clips.get(pack);
  if (!c) throw new Error(`clips of ${pack} not loaded`);
  return c;
}

/** GLTFLoader strips characters like '.' from node names; bone names must be matched the same way. */
export const nodeName = (n: string): string => THREE.PropertyBinding.sanitizeNodeName(n);
