import * as THREE from 'three';
import { BOSS_COLORS, FX, hdr } from '../palette';
import { nodeName } from './assets';

/**
 * Props the packs do not have, built in code and fixed to a bone (6c decisions): the Iron
 * Warlord's horns, the Bone King's crown, the Fen Witch's rags and staff glow, the Shaman's
 * bone mask, antlers and totem. Sizes are in rig units (a KayKit head spans y 1.2..2.3, the
 * face looks along +z) and placed in the model's bind pose, then re-parented to the bone.
 */
export type ExtraId = 'horns' | 'crown' | 'rags' | 'mask' | 'witchGlow' | 'totem';

const BONE_COLOR = BOSS_COLORS.bone;
const DARK = '#1a1612';

function mat(color: string, emissive?: THREE.Color): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  if (emissive) m.emissive.copy(emissive);
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

/** A tapering limb from `from` to `to` (horn segment, antler tine). */
function limb(from: THREE.Vector3, to: THREE.Vector3, r0: number, r1: number, m: THREE.Material): THREE.Mesh {
  const len = from.distanceTo(to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 6), m);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
  return mesh;
}

/** A chain of limbs through `pts`, thinning from `r0` to `r1`. */
function chain(pts: [number, number, number][], r0: number, r1: number, m: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const v = pts.map((p) => new THREE.Vector3(...p));
  for (let i = 1; i < v.length; i++) {
    const a = r0 + ((r1 - r0) * (i - 1)) / (v.length - 1);
    const b = r0 + ((r1 - r0) * i) / (v.length - 1);
    g.add(limb(v[i - 1]!, v[i]!, a, b, m));
  }
  return g;
}

function glowOrb(color: string, core: string, r: number): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshBasicMaterial({ color: hdr(core, 3) })));
  const halo = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r * 1.7, 1),
    new THREE.MeshBasicMaterial({ color: hdr(color, 1.6), transparent: true, opacity: 0.35, depthWrite: false }),
  );
  g.add(halo);
  return g;
}

/** Iron horns curving out of the helmet's sides, then up and forward. */
function horns(): THREE.Group {
  const g = new THREE.Group();
  const m = mat(BOSS_COLORS.horn);
  for (const s of [-1, 1]) {
    g.add(chain([[s * 0.5, 2.0, 0.05], [s * 0.85, 2.12, 0.05], [s * 1.05, 2.42, 0.12], [s * 1.02, 2.78, 0.25]], 0.13, 0.025, m));
  }
  return g;
}

/** A rusty crown sitting on the bare skull: a band with six points. */
function crown(): THREE.Group {
  const g = new THREE.Group();
  const m = mat(BOSS_COLORS.crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.45, 0.18, 12, 1, true), m);
  band.material.side = THREE.DoubleSide;
  band.position.y = 2.1;
  g.add(band);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.26, 4), m);
    spike.position.set(Math.sin(a) * 0.46, 2.32, Math.cos(a) * 0.46);
    g.add(spike);
  }
  // A dull red stone in front.
  g.add(box(0.1, 0.1, 0.05, mat(BOSS_COLORS.rust), 0, 2.1, 0.48));
  return g;
}

/** A tattered skirt of rags flaring from the waist: narrow strips of uneven length, frayed tips. */
function rags(): THREE.Group {
  const g = new THREE.Group();
  const shades = [mat(BOSS_COLORS.rag), mat(BOSS_COLORS.ragDark), mat(BOSS_COLORS.ragLight)];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = 0.42 + ((i * 7) % 5) * 0.07;
    const w = 0.13 + ((i * 3) % 3) * 0.03;
    const m = shades[(i * 5) % 3]!;
    // Pivot at the waist so the strip flares out like a skirt.
    const pivot = new THREE.Group();
    pivot.position.set(Math.sin(a) * 0.48, 0.86, Math.cos(a) * 0.48);
    pivot.rotation.y = a;
    pivot.rotation.x = 0.32 + ((i * 2) % 3) * 0.06;
    pivot.add(box(w, len, 0.02, m, 0, -len / 2, 0));
    // A frayed tip: a narrower piece hanging a little lower on one side.
    pivot.add(box(w * 0.45, 0.12, 0.02, m, (i % 2 ? 1 : -1) * w * 0.25, -len - 0.05, 0));
    g.add(pivot);
  }
  return g;
}

/** A bone mask over the face with dark eye holes, and antlers rising from the brow. */
function mask(): THREE.Group {
  const g = new THREE.Group();
  const bone = mat(BONE_COLOR);
  const dark = mat(DARK);
  // A curved plate around the front of the face (a slice of a cylinder), with a chin piece.
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.46, 0.68, 10, 1, true, -0.95, 1.9), mat(BONE_COLOR));
  (plate.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  plate.position.set(0, 1.68, 0.06);
  g.add(plate);
  g.add(box(0.42, 0.16, 0.12, bone, 0, 1.3, 0.48));
  for (const s of [-1, 1]) {
    g.add(box(0.15, 0.1, 0.06, dark, s * 0.17, 1.76, 0.57));
    // War paint: a red stripe down from each eye.
    g.add(box(0.05, 0.26, 0.05, mat(BOSS_COLORS.paint), s * 0.17, 1.55, 0.565));
  }
  g.add(box(0.05, 0.16, 0.05, dark, 0, 1.58, 0.58));
  const antler = mat(BOSS_COLORS.antler);
  for (const s of [-1, 1]) {
    g.add(chain([[s * 0.25, 2.1, 0.15], [s * 0.45, 2.45, 0.1], [s * 0.55, 2.85, 0.0], [s * 0.5, 3.15, -0.05]], 0.07, 0.025, antler));
    g.add(chain([[s * 0.45, 2.45, 0.1], [s * 0.78, 2.62, 0.18]], 0.045, 0.02, antler));
    g.add(chain([[s * 0.55, 2.85, 0.0], [s * 0.85, 3.0, 0.08]], 0.04, 0.02, antler));
  }
  return g;
}

/** Things fixed to the staff's tip (in the staff's own space, `tip` = its far end). */
function witchGlow(tip: THREE.Vector3): THREE.Object3D {
  const g = glowOrb(FX.poison, FX.poisonCore, 0.12);
  g.position.copy(tip);
  return g;
}

function totem(tip: THREE.Vector3): THREE.Object3D {
  const g = new THREE.Group();
  const bone = mat(BONE_COLOR);
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), bone));
  g.add(box(0.2, 0.08, 0.18, bone, 0, -0.17, 0.02));
  for (const s of [-1, 1]) g.add(box(0.06, 0.06, 0.04, mat(DARK), s * 0.07, 0.02, 0.18));
  const crystal = glowOrb(FX.holy, FX.holyCore, 0.09);
  crystal.position.y = 0.32;
  g.add(crystal);
  // Two feathers hanging off the skull.
  for (const s of [-1, 1]) {
    const f = box(0.06, 0.32, 0.015, mat(BOSS_COLORS.feather), s * 0.18, -0.2, 0);
    f.rotation.z = s * 0.3;
    g.add(f);
  }
  g.position.copy(tip);
  return g;
}

/** The far end of a prop along its longest axis, in its own space. */
export function farEnd(obj: THREE.Object3D): THREE.Vector3 {
  obj.updateMatrixWorld(true);
  const inv = obj.matrixWorld.clone().invert();
  const box3 = new THREE.Box3();
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    box3.union(m.geometry.boundingBox!.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
  });
  const tip = new THREE.Vector3();
  if (box3.isEmpty()) return tip;
  const size = box3.getSize(new THREE.Vector3());
  const axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : size.y > size.z ? 'y' : 'z';
  tip[axis] = Math.abs(box3.max[axis]) > Math.abs(box3.min[axis]) ? box3.max[axis] : box3.min[axis];
  return tip;
}

/**
 * Adds an extra to a freshly cloned model (still at its bind pose, identity transform). Head
 * props are built in model space and moved into the head bone's space; staff props sit at the
 * far end of the named staff. Returns the prop (its geometry belongs to this unit).
 */
export function addExtra(model: THREE.Object3D, id: ExtraId, staff: THREE.Object3D | null): THREE.Object3D | null {
  if (id === 'witchGlow' || id === 'totem') {
    if (!staff) return null;
    const prop = (id === 'witchGlow' ? witchGlow : totem)(farEnd(staff));
    staff.add(prop);
    return prop;
  }
  const boneName = id === 'rags' ? 'hips' : 'head';
  const bone = model.getObjectByName(nodeName(boneName));
  if (!bone) return null;
  const prop = id === 'horns' ? horns() : id === 'crown' ? crown() : id === 'rags' ? rags() : mask();
  model.updateMatrixWorld(true);
  prop.applyMatrix4(bone.matrixWorld.clone().invert());
  bone.add(prop);
  return prop;
}
