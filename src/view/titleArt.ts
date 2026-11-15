import * as THREE from 'three';
import type { ClassId } from '../sim/types';
import { createArena } from './arena';
import { createScene } from './scene';
import { Post } from './post';
import { createUnitView } from './createView';
import type { AnimInput, UnitView } from './unitView';
import { loadModels } from './models/assets';
import { loadScenery } from './scenery/props';
import { REGION_LOOKS } from './scenery/looks';

/**
 * Dev scene (`?titleart`): the title-screen backdrop (Marcel 2026-11-15: the four heroes on a rise,
 * the Greenmarch farm with the windmill behind, rendered once as a still). Rendered by
 * `tools/titleart.mjs` into `public/title-bg.jpg`. URL (all optional, for framing):
 * `cam=x,y,z`, `look=x,y,z`, `at=x,z` (group centre), `face=radians`, `fov=deg`, `t=seconds` into the idle.
 */
const HEROES: ClassId[] = ['bogenschuetze', 'krieger', 'magier', 'heiler'];

export async function startTitleArt(host: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search);
  const nums = (key: string, fallback: [number, number, number]): [number, number, number] => {
    const v = q.get(key)?.split(',').map(Number);
    return v ? [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0] : fallback;
  };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100vw;height:100vh';
  host.appendChild(canvas);
  const parts = createScene(canvas, 'greenmarch');
  await Promise.all([loadModels(), loadScenery()]);
  const arena = createArena(44, 30, 'greenmarch');
  parts.scene.add(arena.group);

  // Inside the ring on the farm's side, facing the camera. -1.307 would put the windmill (about 64, 17)
  // straight behind them; -1.72 turns it out to the right, clear of the banner in the top-left corner
  // and of the centred buttons (Marcel's pick, 2026-11-15).
  const [cx, cz] = nums('at', [14.9, 4, 0]);
  const face = Number(q.get('face') ?? -1.72);
  // Two heroes either side, leaving the middle to the banner and buttons; turned a little inwards.
  // [sideways, forwards, turn]
  const slots: [number, number, number][] = [
    [-3.9, -0.5, -0.4],
    [-2.5, 0.3, -0.15],
    [2.5, 0.3, 0.15],
    [3.9, -0.5, 0.4],
  ];
  const views: UnitView[] = [];
  const side = { x: Math.cos(face), z: Math.sin(face) };
  const fwd = { x: Math.sin(face), z: -Math.cos(face) };
  HEROES.forEach((classId, i) => {
    const [s, f, turn] = slots[i]!;
    const v = createUnitView(classId, 'player', true, { region: 'greenmarch' });
    v.setPose(cx + side.x * s + fwd.x * f, cz + side.z * s + fwd.z * f, face + turn);
    parts.scene.add(v.root);
    views.push(v);
  });

  const camera = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 32), 16 / 9, 0.1, 1000);
  const dist = Number(q.get('dist') ?? 13);
  const [px, py, pz] = nums('cam', [cx + dist * fwd.x, Number(q.get('h') ?? 1.3), cz + dist * fwd.z]);
  camera.position.set(px, py, pz);
  const [lx, ly, lz] = nums('look', [cx, Number(q.get('ly') ?? 2.6), cz]);
  camera.lookAt(lx, ly, lz);

  const post = new Post(parts.renderer, parts.scene, camera);
  post.grade.uniforms['uAmount']!.value = REGION_LOOKS.greenmarch.grade;
  const resize = (): void => {
    parts.renderer.setSize(window.innerWidth, window.innerHeight, false);
    post.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  const idle = (t: number): AnimInput => ({ state: 'idle', stateTime: t, chain: 0, stunDuration: 0, isHero: true, action: null, windup: 0, recover: 0, speed: 0, frozen: false, shielded: false, dodgeBack: false, dodgeDuration: 0.35 });
  const t0 = Number(q.get('t') ?? 0.6);
  // Pose once at a fixed moment of the idle, then keep rendering still frames (arena flags still wave).
  views.forEach((v, i) => v.animate(idle(t0 + i * 0.37), t0 + i * 0.37));
  let frames = 0;
  const loop = (): void => {
    requestAnimationFrame(loop);
    arena.update(0);
    post.render(0);
    if (++frames === 30) (window as unknown as { __titleArtReady: boolean }).__titleArtReady = true;
  };
  requestAnimationFrame(loop);
}
