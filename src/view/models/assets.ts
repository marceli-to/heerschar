import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * The models the game uses (`public/models/`, copied and trimmed by `tools/kaykit.mjs` and
 * `tools/wolf.mjs`). Loaded once, then cloned per unit. Each pack shares one rig and one clip
 * set, kept only in its first file (`ANIM_SOURCE`); every body of that pack plays those clips.
 */
export type ModelId = 'GPG_Knight' | 'Knight' | 'Mage' | 'Rogue_Hooded' | 'Barbarian' | 'Skeleton_Warrior' | 'Skeleton_Minion' | 'Skeleton_Rogue' | 'Skeleton_Mage' | 'Wolf';
export type WeaponId =
  | 'Skeleton_Blade'
  | 'Skeleton_Axe'
  | 'Skeleton_Shield_Large_A'
  | 'Skeleton_Shield_Small_A'
  | 'Skeleton_Crossbow'
  | 'Skeleton_Staff'
  | 'axe_2handed'
  | 'sword_2handed';
export type Pack = 'adventurers' | 'skeletons' | 'quaternius' | 'gpg';

const DIR: Record<Pack, string> = { adventurers: 'kaykit', skeletons: 'kaykit-skeletons', quaternius: 'quaternius', gpg: 'gpg' };
/** Files not named after their id (game-pack-generator exports). */
const FILE: Partial<Record<ModelId, string>> = { GPG_Knight: 'character-knight-lowpoly.glb' };
export const MODEL_PACK: Record<ModelId, Pack> = {
  GPG_Knight: 'gpg',
  Knight: 'adventurers',
  Mage: 'adventurers',
  Rogue_Hooded: 'adventurers',
  Barbarian: 'adventurers',
  Skeleton_Warrior: 'skeletons',
  Skeleton_Minion: 'skeletons',
  Skeleton_Rogue: 'skeletons',
  Skeleton_Mage: 'skeletons',
  Wolf: 'quaternius',
};
// The gpg pack has no clip source of its own: its clips are built from the Adventurers' (`gpgClips`).
const ANIM_SOURCE: Record<Exclude<Pack, 'gpg'>, ModelId> = { adventurers: 'Knight', skeletons: 'Skeleton_Minion', quaternius: 'Wolf' };
export const WEAPON_PACK: Record<WeaponId, Pack> = {
  Skeleton_Blade: 'skeletons',
  Skeleton_Axe: 'skeletons',
  Skeleton_Shield_Large_A: 'skeletons',
  Skeleton_Shield_Small_A: 'skeletons',
  Skeleton_Crossbow: 'skeletons',
  Skeleton_Staff: 'skeletons',
  axe_2handed: 'adventurers',
  sword_2handed: 'adventurers',
};
const WEAPONS = Object.keys(WEAPON_PACK) as WeaponId[];

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
      Promise.all(ids.map((id) => loader.loadAsync(url(MODEL_PACK[id], FILE[id] ?? `${id}.glb`)))),
      Promise.all(WEAPONS.map((id) => loader.loadAsync(url(WEAPON_PACK[id], `${id}.gltf`)))),
    ]);
    const lib: Library = { models: new Map(), weapons: new Map(), clips: new Map() };
    ids.forEach((id, i) => {
      const gltf = models[i]!;
      lib.models.set(id, gltf.scene);
      const pack = MODEL_PACK[id];
      if (pack !== 'gpg' && ANIM_SOURCE[pack] === id) lib.clips.set(pack, new Map(gltf.animations.map((c) => [c.name, c])));
    });
    const adventurers = lib.clips.get('adventurers');
    if (adventurers) lib.clips.set('gpg', gpgClips(adventurers, lib.models.get('GPG_Knight')!));
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

/** Rest height of the hips: game-pack-generator chibi vs. KayKit Rig_Medium. */
const GPG_HIPS = 0.2795 / 0.4057;

/**
 * The gpg rig is KayKit's Rig_Medium without the IK / control bones, with shorter legs. The
 * Adventurers clips drive it once the absolute hips position is scaled to its hip height
 * (rotations stay), the other bones' position tracks are dropped (KayKit bone lengths), and so are
 * the tracks of bones it lacks (they would log binding errors).
 */
function gpgClips(src: Map<string, THREE.AnimationClip>, model: THREE.Object3D): Map<string, THREE.AnimationClip> {
  const bones = new Set<string>();
  model.traverse((o) => bones.add(o.name));
  const out = new Map<string, THREE.AnimationClip>();
  for (const [name, clip] of src) {
    const c = clip.clone();
    c.tracks = c.tracks.filter((t) => {
      const { nodeName, propertyName } = THREE.PropertyBinding.parseTrackName(t.name);
      // KayKit keys every bone's position at its own bone lengths; on the shorter gpg bones that
      // pulls the head and arms off the body. Only the hips move; the other bones keep their rest offsets.
      return bones.has(nodeName) && (propertyName !== 'position' || nodeName === 'hips');
    });
    for (const t of c.tracks) {
      if (t.name !== 'hips.position') continue;
      t.values = Float32Array.from(t.values, (v) => v * GPG_HIPS);
    }
    out.set(name, c);
  }
  return out;
}

/** GLTFLoader strips characters like '.' from node names; bone names must be matched the same way. */
export const nodeName = (n: string): string => THREE.PropertyBinding.sanitizeNodeName(n);
