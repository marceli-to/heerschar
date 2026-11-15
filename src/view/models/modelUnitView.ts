import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { HERO } from '../../sim/balance';
import { clamp, lerp } from '../../sim/math';
import type { Team } from '../../sim/types';
import { FX, MODEL_COLORS } from '../palette';
import { ShieldBubble } from '../shieldBubble';
import type { AnimInput, UnitView } from '../unitView';
import { MODEL_PACK, modelTemplate, nodeName, packClips, weaponTemplate } from './assets';
import type { BodySpec } from './bodies';
import { actionAnim, BASE_CLIPS, type Segment } from './clips';
import { recolored } from './recolor';

/**
 * Every KayKit body shares one rig whose head tops out at ~2.2 units; one scale for all keeps
 * hats and helmets on top instead of shrinking their wearers.
 */
const MODEL_SCALE = 0.82;
const BAR_Y = 2.15;
/** Ground speed (m/s) of the walk and run clips at normal rate, after scaling (planted-foot speed, measured). */
const WALK_SPEED = 0.72;
const RUN_SPEED = 3.7;
const RUN_FROM = 1.3;
const IDLE_BELOW = 0.35;
/** Cross-fade between animations, seconds (shorter into an attack so the tell starts at once). */
const FADE = 0.14;
const FADE_ACTION = 0.06;
const FLASH_TIME = 0.14;
const FROZEN_MIX = 0.6;
/** Light hits nudge an idle or moving body with a little of the hit clip. */
const NUDGE_TIME = 0.3;
const NUDGE_WEIGHT = 0.45;

interface Pose {
  clip: string;
  time: number;
}

/**
 * A rigged KayKit model behind `UnitView` (Stage 6). Like the code figures it is posed from the
 * sim state every frame: an action's clip time is a function of time in state, so hit-stop and
 * pause freeze it, and the hit frame of each clip lands on the end of the windup.
 */
export class ModelUnitView implements UnitView {
  readonly root = new THREE.Group();
  readonly barY = BAR_Y;
  private readonly model: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly clips: Map<string, THREE.AnimationClip>;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly materials: THREE.MeshStandardMaterial[] = [];
  private readonly baseColors: THREE.Color[] = [];
  private readonly baseEmissive: THREE.Color[] = [];
  private readonly bubble: ShieldBubble;
  private readonly orb: THREE.Mesh | null = null;
  /** The swinging blade and its edge (base, tip) in the blade's own space, for the swing trail. */
  private readonly blade: THREE.Object3D | null = null;
  private readonly edgeBase = new THREE.Vector3();
  private readonly edgeTip = new THREE.Vector3();

  private cur: Pose = { clip: BASE_CLIPS.idle, time: 0 };
  private prev: Pose | null = null;
  private fade = 0;
  private fadeLen = FADE;
  private key = '';
  /** Phase 0..1 of the looping clip (idle / walk / run), kept across switches between them. */
  private loopPhase = 0;
  private time = 0;
  private flash = 0;
  private flashStrength = 1;
  private nudge = 0;
  private frost = 0;

  constructor(private readonly body: BodySpec, team: Team) {
    this.model = cloneSkinned(modelTemplate(body.model));
    this.model.scale.setScalar(MODEL_SCALE);
    // KayKit faces +z; unit views face -z.
    this.model.rotation.y = Math.PI;
    for (const a of body.attach) {
      const bone = this.model.getObjectByName(nodeName(a.bone));
      const weapon = weaponTemplate(a.weapon).clone();
      bone?.add(weapon);
      if (a.weapon === body.blade && a.bone === 'handslot.r') this.blade = weapon;
    }
    if (body.blade && !this.blade) this.blade = this.model.getObjectByName(nodeName(body.blade)) ?? null;
    if (this.blade) this.measureBlade(this.blade);
    if (body.style === 'orb') {
      this.orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 2),
        new THREE.MeshStandardMaterial({ color: MODEL_COLORS.healerOrb, emissive: MODEL_COLORS.healerOrb, emissiveIntensity: 2.2, roughness: 0.3 }),
      );
      this.orb.position.set(0, 0.12, 0);
      this.model.getObjectByName(nodeName('handslot.r'))?.add(this.orb);
    }
    this.prepareMeshes(body);
    this.root.add(this.model);

    this.clips = packClips(MODEL_PACK[body.model]);
    this.mixer = new THREE.AnimationMixer(this.model);

    this.bubble = new ShieldBubble(team, { x: 0.8, y: 1.05, z: 0.8 }, 0.95);
    this.root.add(this.bubble.mesh);
    this.applyPose(1, 0);
  }

  /**
   * The edge runs along the blade's longest axis: the tip at its far end, the trail's inner edge
   * a third of the way back towards the grip (the grip sits near the hand slot's origin).
   */
  private measureBlade(blade: THREE.Object3D): void {
    blade.updateMatrixWorld(true);
    const inv = blade.matrixWorld.clone().invert();
    const box = new THREE.Box3();
    blade.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingBox();
      box.union(m.geometry.boundingBox!.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
    });
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const axis = size.x > size.y ? (size.x > size.z ? 'x' : 'z') : size.y > size.z ? 'y' : 'z';
    const far = Math.abs(box.max[axis]) > Math.abs(box.min[axis]) ? box.max[axis] : box.min[axis];
    this.edgeTip.set(0, 0, 0)[axis] = far;
    this.edgeBase.set(0, 0, 0)[axis] = far * 0.65;
  }

  weaponEdge(base: THREE.Vector3, tip: THREE.Vector3): boolean {
    if (!this.blade) return false;
    this.root.updateMatrixWorld(true);
    this.blade.localToWorld(base.copy(this.edgeBase));
    this.blade.localToWorld(tip.copy(this.edgeTip));
    return true;
  }

  /** Hides unused props, turns on shadows, gives the unit its own (recoloured) materials. */
  private prepareMeshes(body: BodySpec): void {
    const hidden = new Set(body.hide.map(nodeName));
    const own = new Map<THREE.Material, THREE.MeshStandardMaterial>();
    const swapKey = `${body.model}:${body.swaps.map((s) => `${s.cell.join('.')}=${s.color}`).join(',')}`;
    this.model.traverse((o) => {
      if (hidden.has(o.name)) {
        o.visible = false;
        return;
      }
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // Skinned bounds follow the bind pose; animated limbs would pop out of view.
      mesh.frustumCulled = false;
      const src = mesh.material as THREE.MeshStandardMaterial;
      if (mesh === this.orb) return;
      let mat = own.get(src);
      if (!mat) {
        mat = src.clone();
        // Body, bundled props and the Skeletons' weapons all sample the pack's one swatch atlas.
        if (src.map) mat.map = recolored(src.map, body.swaps, swapKey);
        own.set(src, mat);
        this.materials.push(mat);
        this.baseColors.push(mat.color.clone());
        this.baseEmissive.push(mat.emissive.clone());
      }
      mesh.material = mat;
    });
  }

  setPose(x: number, z: number, facing: number): void {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = -facing;
  }

  flashHit(heavy: boolean): void {
    this.flash = FLASH_TIME;
    this.flashStrength = heavy ? 0.55 : 0.38;
    this.nudge = NUDGE_TIME;
  }

  animate(a: AnimInput, frameTime: number): void {
    this.time += frameTime;
    this.updateTint(a, frameTime);
    this.bubble.update(a.shielded && a.state !== 'dead', frameTime, this.time);
    // A frozen unit is a statue: the pose holds until the ice breaks.
    if (a.frozen && a.state !== 'dead') return;

    const { pose, key, fade } = this.target(a, frameTime);
    if (key !== this.key) {
      // Windup into recover of the same clip is one continuous motion: no blend at the seam.
      const seam = this.key.startsWith('w|') && key === `r|${this.key.slice(2)}` && pose.clip === this.cur.clip;
      if (!seam && this.key !== '') {
        this.prev = { ...this.cur };
        this.fade = fade;
        this.fadeLen = fade;
      }
      this.key = key;
    }
    this.cur = pose;
    this.fade = Math.max(0, this.fade - frameTime);
    if (this.fade === 0) this.prev = null;
    this.nudge = Math.max(0, this.nudge - frameTime);
    const nudge = a.state === 'idle' || a.state === 'moving' ? (this.nudge / NUDGE_TIME) * NUDGE_WEIGHT : 0;
    this.applyPose(this.fadeLen > 0 ? 1 - this.fade / this.fadeLen : 1, nudge);
  }

  /** The clip and time the sim state asks for, a key that changes when the animation does, and the blend into it. */
  private target(a: AnimInput, frameTime: number): { pose: Pose; key: string; fade: number } {
    const b = this.body;
    switch (a.state) {
      case 'idle':
      case 'moving': {
        const clip = a.speed < IDLE_BELOW ? BASE_CLIPS.idle : a.speed < RUN_FROM ? BASE_CLIPS.walk : BASE_CLIPS.run;
        const len = this.clipLength(clip);
        const rate = clip === BASE_CLIPS.idle ? 1 : clamp(a.speed / (clip === BASE_CLIPS.walk ? WALK_SPEED : RUN_SPEED), 0.6, 1.8);
        this.loopPhase = (this.loopPhase + (frameTime * rate) / len) % 1;
        return { pose: { clip, time: this.loopPhase * len }, key: `loop|${clip}`, fade: FADE };
      }
      case 'windup':
      case 'recover': {
        const anim = actionAnim(b.style, a.action, a.chain, a.isHero, b.skeleton);
        const windup = a.state === 'windup';
        const seg = windup ? anim.windup : anim.recover;
        const dur = windup ? a.windup : a.recover;
        return { pose: segmentPose(seg, a.stateTime / Math.max(0.01, dur)), key: `${windup ? 'w' : 'r'}|${a.action ?? 'basic'}|${a.chain}`, fade: windup ? FADE_ACTION : FADE };
      }
      case 'dodging': {
        const clip = a.dodgeBack ? BASE_CLIPS.dodgeBack : BASE_CLIPS.dodge;
        return { pose: { clip, time: clamp(a.stateTime / HERO.dodge.duration, 0, 1) * this.clipLength(clip) }, key: `dodge|${clip}`, fade: FADE_ACTION };
      }
      case 'stunned': {
        const clip = a.stunDuration <= 0.6 ? BASE_CLIPS.staggerLight : BASE_CLIPS.staggerHeavy;
        return { pose: { clip, time: clamp(a.stateTime / Math.max(0.05, a.stunDuration), 0, 1) * this.clipLength(clip) }, key: `stun|${clip}`, fade: FADE_ACTION };
      }
      case 'dead': {
        const clip = b.skeleton ? BASE_CLIPS.deathSkeleton : BASE_CLIPS.death;
        return { pose: { clip, time: Math.min(a.stateTime, this.clipLength(clip)) }, key: 'dead', fade: FADE };
      }
    }
  }

  private clipLength(name: string): number {
    return this.clips.get(name)?.duration ?? 1;
  }

  private action(name: string): THREE.AnimationAction | null {
    let act = this.actions.get(name);
    if (!act) {
      const clip = this.clips.get(name);
      if (!clip) return null;
      act = this.mixer.clipAction(clip);
      // Times are set by hand every frame; repeat mode keeps the mixer from disabling a finished clip.
      act.setLoop(THREE.LoopRepeat, Infinity);
      act.play();
      this.actions.set(name, act);
    }
    return act;
  }

  /** Blends prev -> cur by `w`, with an optional hit nudge on top, and evaluates the rig. */
  private applyPose(w: number, nudge: number): void {
    const layers: [Pose, number][] = [[this.cur, w * (1 - nudge)]];
    if (this.prev && w < 1) layers.push([this.prev, (1 - w) * (1 - nudge)]);
    if (nudge > 0) layers.push([{ clip: BASE_CLIPS.staggerLight, time: (1 - this.nudge / NUDGE_TIME) * 0.3 }, nudge]);
    const weights = new Map<string, [number, number]>();
    for (const [p, weight] of layers) {
      const had = weights.get(p.clip);
      // The same clip at two times cannot be blended with one action; the heavier layer wins.
      if (!had || had[1] < weight) weights.set(p.clip, [p.time, (had?.[1] ?? 0) + weight]);
      else had[1] += weight;
    }
    for (const [name, act] of this.actions) if (!weights.has(name)) act.setEffectiveWeight(0);
    for (const [name, [time, weight]] of weights) {
      const act = this.action(name);
      if (!act) continue;
      act.time = clamp(time, 0, act.getClip().duration - 1e-3);
      act.setEffectiveWeight(weight);
    }
    this.mixer.update(0);
  }

  private updateTint(a: AnimInput, frameTime: number): void {
    const frostTarget = a.frozen && a.state !== 'dead' ? 1 : 0;
    const prevFrost = this.frost;
    this.frost += (frostTarget - this.frost) * Math.min(1, frameTime * 12);
    if (Math.abs(this.frost - frostTarget) < 0.01) this.frost = frostTarget;
    if (this.frost !== prevFrost) {
      const ice = new THREE.Color(FX.frozenTint);
      this.materials.forEach((m, i) => m.color.copy(this.baseColors[i]!).lerp(ice, this.frost * FROZEN_MIX));
    }
    if (this.flash > 0 || this.frost > 0 || prevFrost > 0) {
      this.flash = Math.max(0, this.flash - frameTime);
      const k = (this.flash / FLASH_TIME) * this.flashStrength;
      const f = this.frost * 0.18;
      this.materials.forEach((m, i) => m.emissive.copy(this.baseEmissive[i]!).add(_flash.setRGB(k + f * 0.3, k * 0.92 + f * 0.75, k * 0.85 + f)));
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
    for (const m of this.materials) m.dispose();
    this.bubble.dispose();
    if (this.orb) {
      this.orb.geometry.dispose();
      (this.orb.material as THREE.Material).dispose();
    }
  }
}

const _flash = new THREE.Color();

function segmentPose(seg: Segment, p: number): Pose {
  return { clip: seg.clip, time: lerp(seg.from, seg.to, clamp(p, 0, 1)) };
}
