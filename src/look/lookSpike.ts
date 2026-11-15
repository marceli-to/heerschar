import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from '../view/scene';
import { createArena } from '../view/arena';
import { MEADOW } from '../view/palette';
import { Actor, Dummy, type FigureSpec } from './actors';
import { FxWorld, SwingTrail, type Looks } from '../view/fx';
import { Post } from '../view/post';

/**
 * Look spike (?look): a KayKit Adventurers pair and a KayKit Skeletons pair on the meadow, each hitting a
 * training dummy on the same scripted 14 s loop, with the four candidate effects switchable
 * (1 glow, 2 impacts, 3 grade, 4 ground marks). Throwaway; the game never imports this.
 */

const BASE = import.meta.env.BASE_URL;

interface PackSpec {
  label: string;
  x: number;
  melee: FigureSpec;
  caster: FigureSpec;
}

const PACKS: PackSpec[] = [
  {
    label: 'KayKit Adventurers',
    x: -4.5,
    melee: {
      url: `${BASE}look/kaykit/Knight.glb`,
      hide: ['1H_Sword_Offhand', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '2H_Sword'],
      weapon: '1H_Sword',
      clips: {
        idle: 'Idle',
        walk: 'Walking_A',
        attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'],
        hit: 'Hit_A',
        death: 'Death_A',
        cast: 'Spellcast_Shoot',
        castRing: 'Spellcast_Raise',
      },
    },
    caster: {
      url: `${BASE}look/kaykit/Mage.glb`,
      hide: ['Spellbook', 'Spellbook_open', '1H_Wand'],
      weapon: '2H_Staff',
      clips: {
        idle: 'Idle',
        walk: 'Walking_A',
        attacks: ['2H_Melee_Attack_Stab'],
        hit: 'Hit_A',
        death: 'Death_A',
        cast: 'Spellcast_Shoot',
        castRing: 'Spellcast_Raise',
      },
    },
  },
  {
    label: 'KayKit Skeletons',
    x: 4.5,
    melee: {
      url: `${BASE}look/kaykit-skeletons/Skeleton_Warrior.glb`,
      hide: [],
      weapon: 'Skeleton_Blade',
      attach: [
        { url: `${BASE}look/kaykit-skeletons/Skeleton_Blade.gltf`, bone: 'handslot.r' },
        { url: `${BASE}look/kaykit-skeletons/Skeleton_Shield_Large_A.gltf`, bone: 'handslot.l' },
      ],
      clips: {
        idle: 'Idle_Combat',
        walk: 'Walking_D_Skeletons',
        attacks: ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal'],
        hit: 'Hit_B',
        death: 'Death_C_Skeletons',
        cast: 'Spellcast_Shoot',
        castRing: 'Spellcast_Raise',
        revive: 'Death_C_Skeletons_Resurrect',
      },
    },
    caster: {
      url: `${BASE}look/kaykit-skeletons/Skeleton_Mage.glb`,
      hide: [],
      weapon: 'Skeleton_Staff',
      attach: [{ url: `${BASE}look/kaykit-skeletons/Skeleton_Staff.gltf`, bone: 'handslot.r' }],
      clips: {
        idle: 'Idle',
        walk: 'Walking_D_Skeletons',
        attacks: ['2H_Melee_Attack_Stab'],
        hit: 'Hit_A',
        death: 'Death_A',
        cast: 'Spellcast_Shoot',
        castRing: 'Spellcast_Raise',
      },
    },
  },
];

const CYCLE = 14;

/** Camera presets (key V or ?view=1..4). */
const VIEWS: { pos: [number, number, number]; target: [number, number, number] }[] = [
  { pos: [0.6, 5.2, 13.8], target: [0.6, 0.9, -0.4] },
  { pos: [-5.0, 1.7, 2.1], target: [-5.1, 0.9, -2] },
  { pos: [4.0, 1.7, 2.1], target: [3.9, 0.9, -2] },
  { pos: [0, 15, 15], target: [0, 0, -1] },
];

interface Pair {
  spec: PackSpec;
  melee: Actor;
  caster: Actor;
  dummy: Dummy;
  trail: SwingTrail;
  meleeHome: THREE.Vector3;
  tipPrev: THREE.Vector3;
  shieldPulse: (() => void) | null;
  walk: { t: number; dur: number; step: number } | null;
}

export async function startLookSpike(host: HTMLElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const fxParam = params.get('fx') ?? '1111';
  const looks: Looks = {
    glow: fxParam[0] !== '0',
    impact: fxParam[1] !== '0',
    grade: fxParam[2] !== '0',
    marks: fxParam[3] !== '0',
  };

  document.body.style.margin = '0';
  document.body.style.background = '#000';
  document.body.style.overflow = 'hidden';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100vw;height:100vh';
  host.appendChild(canvas);
  const hud = createHud(host);

  const { renderer, scene, sun } = createScene(canvas);
  scene.add(createArena(44, 30));
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 600);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.6;
  let view = Math.max(0, Math.min(VIEWS.length - 1, Number(params.get('view') ?? 1) - 1));
  const applyView = (): void => {
    camera.position.set(...VIEWS[view]!.pos);
    controls.target.set(...VIEWS[view]!.target);
    controls.update();
  };
  applyView();

  const post = new Post(renderer, scene, camera);
  const fx = new FxWorld(looks);
  scene.add(fx.group);

  const resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  hud.status.textContent = 'Loading models…';
  const pairs: Pair[] = await Promise.all(
    PACKS.map(async (spec) => {
      const [melee, caster] = await Promise.all([Actor.load(spec.melee), Actor.load(spec.caster)]);
      const dummy = new Dummy();
      dummy.root.position.set(spec.x, 0, -2);
      const meleeHome = new THREE.Vector3(spec.x - 1.25, 0, -2);
      melee.root.position.copy(meleeHome);
      melee.faceTowards(spec.x, -2);
      caster.root.position.set(spec.x + 2.2, 0, 1.4);
      caster.faceTowards(spec.x, -2);
      scene.add(melee.root, caster.root, dummy.root);
      fx.lockRing(dummy.root);
      const trail = new SwingTrail(new THREE.Color('#fff4dc').multiplyScalar(1.6));
      scene.add(trail.mesh);
      return { spec, melee, caster, dummy, trail, meleeHome, tipPrev: new THREE.Vector3(), shieldPulse: null, walk: null };
    }),
  );
  hud.status.textContent = '';
  (window as unknown as { __look: unknown }).__look = { pairs, scene };

  // ---- looks that are scene settings rather than spawned effects
  const applyLooks = (): void => {
    post.bloom.enabled = looks.glow;
    post.grade.enabled = looks.grade;
    const fog = scene.fog as THREE.Fog;
    if (looks.grade) {
      fog.color.set('#e9dcc2');
      fog.near = 32;
      fog.far = 175;
      sun.shadow.radius = 7;
      sun.color.set('#ffe2b8');
    } else {
      fog.color.set(MEADOW.fog);
      fog.near = 70;
      fog.far = 190;
      sun.shadow.radius = 3;
      sun.color.set(MEADOW.sun);
    }
    hud.render(looks, view);
  };
  applyLooks();

  // ---- scripted loop
  type Ev = { at: number; run: () => void };
  let queue: Ev[] = [];
  let clock = Number(params.get('t') ?? 0);
  let cycleStart = -Infinity;
  // Events already in the past (start time jumped with ?t=) are dropped, not replayed at once.
  const at = (t: number, run: () => void): void => {
    if (t >= clock - 0.05) queue.push({ at: t, run });
  };

  const scheduleCycle = (t0: number): void => {
    for (const p of pairs) {
      const { melee, caster, dummy } = p;
      const dummyChest = (): THREE.Vector3 => dummy.root.position.clone().setY(1.2);
      const swing = (start: number, clip: string): void =>
        at(t0 + start, () => {
          const len = melee.once(clip);
          at(clock + len * 0.42, () => {
            const away = dummy.root.position.clone().sub(melee.root.position).setY(0).normalize();
            fx.hit(dummyChest().addScaledVector(away, -0.25), away.negate());
            dummy.strike(melee.root.position.x, melee.root.position.z);
          });
        });
      swing(0.4, melee.spec.clips.attacks[0]!);
      swing(1.7, melee.spec.clips.attacks[1] ?? melee.spec.clips.attacks[0]!);

      at(t0 + 2.8, () => {
        const len = caster.once(caster.spec.clips.cast);
        at(clock + len * 0.5, () => {
          const from = caster.weaponTip(new THREE.Vector3());
          fx.fireball(from, dummyChest(), () => dummy.strike(caster.root.position.x, caster.root.position.z, 1.4));
        });
      });

      at(t0 + 4.4, () => {
        p.shieldPulse = fx.shield(melee.root, 3);
      });
      at(t0 + 4.9, () => {
        melee.once(melee.spec.clips.hit);
        p.shieldPulse?.();
        const at3 = melee.root.position.clone().setY(1.3);
        fx.hit(at3, new THREE.Vector3(-1, 0.3, 0.4).normalize());
      });

      at(t0 + 5.9, () => {
        const len = caster.once(caster.spec.clips.castRing);
        at(clock + len * 0.55, () => {
          const c = caster.root.position.clone();
          fx.frostRing(c, 4.1);
          const reach = (dummy.root.position.distanceTo(c) / 4.1) * 0.45;
          at(clock + reach, () => {
            dummy.freeze();
            fx.frostPatch(dummy.root.position.x, dummy.root.position.z);
          });
        });
      });

      at(t0 + 7.6, () => {
        p.walk = { t: 0, dur: 2.6, step: 0 };
        melee.loop(melee.spec.clips.walk, 0.2);
      });
      at(t0 + 8.2, () => fx.holyLight(caster.root.position));

      at(t0 + 10.4, () => melee.once(melee.spec.clips.death, 0.15, true));
      at(t0 + (melee.spec.clips.revive ? 11.2 : 12.6), () => {
        const revive = melee.spec.clips.revive;
        if (revive) melee.once(revive, 0.1);
        else melee.loop(melee.spec.clips.idle, 0.35);
      });
    }
  };

  /** Melee figure walks a small loop out and back to its spot in front of the dummy. */
  const updateWalk = (p: Pair, dt: number): void => {
    const w = p.walk;
    if (!w) return;
    w.t += dt;
    const k = Math.min(1, w.t / w.dur);
    const a = k * Math.PI * 2;
    // A 1.4 m wide loop away from the dummy, starting and ending at home.
    const off = new THREE.Vector3(-Math.sin(a) * 0.9, 0, (1 - Math.cos(a)) * 0.7);
    const prev = p.melee.root.position.clone();
    p.melee.root.position.copy(p.meleeHome).add(off);
    const d = p.melee.root.position.clone().sub(prev);
    if (d.lengthSq() > 1e-8) p.melee.root.rotation.y = Math.atan2(d.x, d.z);
    w.step += dt;
    if (w.step > 0.42) {
      w.step = 0;
      fx.puff(p.melee.root.position.clone().setY(0.05), 0.35);
    }
    if (k >= 1) {
      p.walk = null;
      p.melee.root.position.copy(p.meleeHome);
      p.melee.faceTowards(p.dummy.root.position.x, p.dummy.root.position.z);
      p.melee.loop(p.melee.spec.clips.idle, 0.25);
    }
  };

  // ---- input
  let paused = params.has('pause');
  /** ?freeze=T pauses the loop once it reaches T seconds (for screenshots). */
  let freezeAt = params.has('freeze') ? Number(params.get('freeze')) : null;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === '1') looks.glow = !looks.glow;
    else if (k === '2') looks.impact = !looks.impact;
    else if (k === '3') looks.grade = !looks.grade;
    else if (k === '4') looks.marks = !looks.marks;
    else if (k === 'v') {
      view = (view + 1) % VIEWS.length;
      applyView();
    } else if (k === 'o') controls.autoRotate = !controls.autoRotate;
    else if (k === 'p') paused = !paused;
    else if (k === 'h') hud.root.style.display = hud.root.style.display === 'none' ? '' : 'none';
    else return;
    applyLooks();
  });

  // ---- frame loop
  const tip = new THREE.Vector3();
  const base = new THREE.Vector3();
  let last = performance.now();
  let fpsAcc = 0;
  let fpsFrames = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const frame = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAcc += frame;
    fpsFrames++;
    if (fpsAcc > 0.5) {
      hud.fps.textContent = `${Math.round(fpsFrames / fpsAcc)} fps`;
      fpsAcc = 0;
      fpsFrames = 0;
    }
    if (freezeAt !== null && clock >= freezeAt) {
      paused = true;
      freezeAt = null;
    }
    const dt = paused ? 0 : frame;

    clock += dt;
    if (clock - cycleStart >= CYCLE) {
      cycleStart = Math.floor(clock / CYCLE) * CYCLE;
      scheduleCycle(cycleStart);
    }
    queue.sort((a, b) => a.at - b.at);
    while (queue.length && queue[0]!.at <= clock) {
      const ev = queue.shift()!;
      ev.run();
    }

    for (const p of pairs) {
      p.melee.update(dt);
      p.caster.update(dt);
      updateWalk(p, dt);
      p.dummy.update(dt);
      p.melee.root.updateMatrixWorld(true);
      p.melee.weaponTip(tip);
      p.melee.weaponBase(base);
      const speed = dt > 0 ? tip.distanceTo(p.tipPrev) / dt : 0;
      p.tipPrev.copy(tip);
      const swinging = p.melee.spec.clips.attacks.includes(p.melee.playing ?? '') && speed > 5;
      if (dt > 0) p.trail.update(dt, looks.impact && swinging, base, tip);
    }
    fx.update(dt);
    controls.update();
    post.render(frame);
  });
}

interface Hud {
  root: HTMLDivElement;
  fps: HTMLDivElement;
  status: HTMLDivElement;
  render(looks: Looks, view: number): void;
}

function createHud(host: HTMLElement): Hud {
  const font = 'font:13px/1.45 ui-monospace,Menlo,monospace;color:#fff;text-shadow:0 1px 2px #000a';
  const root = document.createElement('div');
  root.style.cssText = `position:fixed;inset:0;pointer-events:none;${font}`;
  const labels = document.createElement('div');
  labels.style.cssText = 'position:absolute;top:14px;left:0;right:0;display:flex;justify-content:space-around;font-size:15px';
  for (const p of PACKS) {
    const l = document.createElement('div');
    l.textContent = p.label;
    labels.appendChild(l);
  }
  const keys = document.createElement('div');
  keys.style.cssText = 'position:absolute;left:14px;bottom:12px;background:#0006;padding:8px 10px;border-radius:6px';
  const fps = document.createElement('div');
  fps.style.cssText = 'position:absolute;right:14px;bottom:12px;background:#0006;padding:4px 8px;border-radius:6px';
  const status = document.createElement('div');
  status.style.cssText = 'position:absolute;top:50%;left:0;right:0;text-align:center;font-size:16px';
  root.append(labels, keys, fps, status);
  host.appendChild(root);
  const row = (key: string, name: string, on: boolean): string =>
    `<div>${key} ${on ? '■' : '□'} ${name}</div>`;
  return {
    root,
    fps,
    status,
    render(looks, view) {
      keys.innerHTML =
        row('1', 'glow on magic (bloom)', looks.glow) +
        row('2', 'hit sparks, dust, swing trail', looks.impact) +
        row('3', 'warm grade, haze, soft shadows', looks.grade) +
        row('4', 'ground marks (scorch, frost)', looks.marks) +
        `<div style="opacity:.7;margin-top:4px">V view ${view + 1}/4 · O orbit · P pause · H hide · drag to look</div>`;
    },
  };
}
