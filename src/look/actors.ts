import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Clip names per role; each pack names its animations differently. */
export interface ClipMap {
  idle: string;
  walk: string;
  attacks: string[];
  hit: string;
  death: string;
  cast: string;
  castRing: string;
  /** Optional clip that gets back up after death (skeletons reassemble). */
  revive?: string;
}

export interface FigureSpec {
  url: string;
  /** Meshes to hide (spare weapons the pack bundles on the rig). Names as in the file. */
  hide: string[];
  /** The weapon mesh that draws the swing trail or emits spells. */
  weapon: string;
  clips: ClipMap;
  /** Separate weapon files to parent to a bone (KayKit Skeletons ship weapons apart). */
  attach?: { url: string; bone: string }[];
}

const HEIGHT = 1.8;
const loader = new GLTFLoader();

/** GLTFLoader strips characters like '.' from node names; match it. */
const sanitize = (n: string): string => THREE.PropertyBinding.sanitizeNodeName(n);

/**
 * One animated pack figure: scaled to 1.8 m, shadows on, one-shot clips fall back to idle.
 * `weaponTip` / `weaponBase` give world points on the weapon for trails and spell origins.
 */
export class Actor {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private weapon: THREE.Object3D | null;
  private tipLocal = new THREE.Vector3();
  private baseLocal = new THREE.Vector3();
  /** Seconds since the current one-shot started, and its length; -1 when looping. */
  private oneShotT = -1;
  private oneShotLen = 0;
  private holdPose = false;

  constructor(
    gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] },
    readonly spec: FigureSpec,
  ) {
    const model = gltf.scene;
    const hidden = new Set(spec.hide.map(sanitize));
    model.traverse((o) => {
      if (hidden.has(o.name)) o.visible = false;
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false;
      }
    });
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.mixer.addEventListener('finished', () => {
      if (!this.holdPose) this.loop(this.spec.clips.idle, 0.25);
    });

    this.weapon = model.getObjectByName(sanitize(spec.weapon)) ?? null;
    if (this.weapon && (this.weapon as THREE.Mesh).isMesh) {
      // Grip sits near the bone origin; the tip is the far end of the longest bounding-box axis.
      const geo = (this.weapon as THREE.Mesh).geometry;
      geo.computeBoundingBox();
      const b = geo.boundingBox!;
      const size = b.getSize(new THREE.Vector3());
      const axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : size.y > size.z ? 'y' : 'z';
      const far = Math.abs(b.max[axis]) > Math.abs(b.min[axis]) ? b.max[axis] : b.min[axis];
      this.tipLocal.set(0, 0, 0)[axis] = far;
      this.baseLocal.set(0, 0, 0)[axis] = far * 0.65;
    }

    // Normalise to 1.8 m, measured on the visible body (not weapons) in the idle pose.
    this.loop(spec.clips.idle, 0);
    this.mixer.update(0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh || !o.visible || o === this.weapon) return;
      if (m.isSkinnedMesh) {
        m.skeleton.update();
        m.computeBoundingBox();
      }
      else m.geometry.computeBoundingBox();
      const bb = (m.isSkinnedMesh ? m.boundingBox : m.geometry.boundingBox)!.clone();
      box.union(bb.applyMatrix4(m.matrixWorld));
    });
    const h = box.max.y - Math.min(0, box.min.y);
    model.scale.setScalar(HEIGHT / h);
    this.root.add(model);
  }

  static async load(spec: FigureSpec): Promise<Actor> {
    const [gltf, ...parts] = (await Promise.all([spec.url, ...(spec.attach ?? []).map((a) => a.url)].map((u) => loader.loadAsync(u)))) as [Awaited<ReturnType<GLTFLoader['loadAsync']>>, ...Awaited<ReturnType<GLTFLoader['loadAsync']>>[]];
    (spec.attach ?? []).forEach((a, i) => {
      const bone = gltf.scene.getObjectByName(sanitize(a.bone));
      const part = parts[i]!.scene.children[0];
      if (bone && part) bone.add(part);
    });
    return new Actor(gltf, spec);
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  loop(name: string, fade = 0.25): void {
    const a = this.actions.get(name);
    if (!a || a === this.current) return;
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1).fadeIn(fade).play();
    this.current?.fadeOut(fade);
    this.current = a;
    this.oneShotT = -1;
    this.holdPose = false;
  }

  /** Plays a clip once; returns its length in seconds. `hold` keeps the last frame (death). */
  once(name: string, fade = 0.12, hold = false): number {
    const a = this.actions.get(name);
    if (!a) return 0;
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = hold;
    a.setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current && this.current !== a) this.current.fadeOut(fade);
    this.current = a;
    this.oneShotT = 0;
    this.oneShotLen = a.getClip().duration;
    this.holdPose = hold;
    return this.oneShotLen;
  }

  /** 0..1 progress of the running one-shot, or -1. */
  get oneShotProgress(): number {
    return this.oneShotT < 0 ? -1 : Math.min(1, this.oneShotT / this.oneShotLen);
  }

  get playing(): string | null {
    return this.current?.getClip().name ?? null;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (this.oneShotT >= 0) this.oneShotT += dt;
  }

  weaponTip(out: THREE.Vector3): THREE.Vector3 {
    if (!this.weapon) return this.root.getWorldPosition(out).setY(1.4);
    return this.weapon.localToWorld(out.copy(this.tipLocal));
  }

  weaponBase(out: THREE.Vector3): THREE.Vector3 {
    if (!this.weapon) return this.root.getWorldPosition(out).setY(1.1);
    return this.weapon.localToWorld(out.copy(this.baseLocal));
  }

  faceTowards(x: number, z: number): void {
    const p = this.root.position;
    this.root.rotation.y = Math.atan2(x - p.x, z - p.z);
  }
}

/** Code-built training dummy: post, crossbar, straw body, sack head. Wobbles when struck. */
export class Dummy {
  readonly root = new THREE.Group();
  private pivot = new THREE.Group();
  private tilt = 0;
  private tiltVel = 0;
  private tiltDir = new THREE.Vector3(1, 0, 0);
  private frost = 0;
  private strawMats: THREE.MeshLambertMaterial[] = [];

  constructor() {
    const wood = new THREE.MeshLambertMaterial({ color: '#6b4a2f', flatShading: true });
    const straw = new THREE.MeshLambertMaterial({ color: '#c9a95a', flatShading: true });
    const sack = new THREE.MeshLambertMaterial({ color: '#b59a6a', flatShading: true });
    const rope = new THREE.MeshLambertMaterial({ color: '#7a5a34', flatShading: true });
    this.strawMats = [straw, sack];

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.9, 7), wood);
    post.position.y = 0.95;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), wood);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 1.35;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.75, 8), straw);
    body.position.y = 1.15;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.06, 8), rope);
    band.position.y = 1.0;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.19, 0), sack);
    head.position.y = 1.68;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.12, 8), wood);
    base.position.y = 0.06;
    for (const m of [post, bar, body, band, head, base]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    this.pivot.add(post, bar, body, band, head);
    this.root.add(this.pivot, base);
  }

  /** Knocks the dummy away from `from` (world xz). */
  strike(fromX: number, fromZ: number, power = 1): void {
    const p = this.root.position;
    this.tiltDir.set(p.x - fromX, 0, p.z - fromZ).normalize();
    this.tiltVel += 2.6 * power;
  }

  freeze(): void {
    this.frost = 1;
  }

  update(dt: number): void {
    // Damped spring back to upright.
    this.tiltVel += (-60 * this.tilt - 7 * this.tiltVel) * dt;
    this.tilt += this.tiltVel * dt;
    const axis = new THREE.Vector3(this.tiltDir.z, 0, -this.tiltDir.x);
    this.pivot.quaternion.setFromAxisAngle(axis, this.tilt * 0.35);
    this.frost = Math.max(0, this.frost - dt * 0.35);
    for (const m of this.strawMats) m.emissive.setRGB(0.1 * this.frost, 0.25 * this.frost, 0.4 * this.frost);
  }
}
