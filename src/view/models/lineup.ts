import * as THREE from 'three';
import type { ActionId, ClassId, Team, UnitState } from '../../sim/types';
import type { RegionId } from '../../data/campaign';
import { createArena } from '../arena';
import { createScene } from '../scene';
import { Post } from '../post';
import { createUnitView } from '../createView';
import type { AnimInput, UnitView } from '../unitView';
import { loadModels } from './assets';

/**
 * Dev scene (`?lineup`): every unit body in a row on the meadow, for screenshots and for checking
 * clips at exact sim moments. URL: `row=player|enemy|barrow|boss` (default all four rows),
 * `state=idle|moving|windup|recover|stunned|dead|dodging`, `p=0..1` (fraction of the phase),
 * `action=<ActionId>`, `chain=0|1`, `speed=m/s`, `cam=front|side|game`, `frozen`, `shielded`,
 * `only=<ClassId>` (one body, close up).
 */
export async function startLineup(host: HTMLElement): Promise<void> {
  const q = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100vw;height:100vh';
  host.appendChild(canvas);
  const parts = createScene(canvas);
  parts.scene.add(createArena(44, 30).group);
  await loadModels();

  type Row = { team: Team; region: RegionId; z: number; units: [ClassId, boolean][] };
  const playable: [ClassId, boolean][] = [['krieger', true], ['krieger', false], ['bogenschuetze', true], ['bogenschuetze', false], ['magier', true], ['magier', false], ['heiler', true], ['heiler', false]];
  const enemies: [ClassId, boolean][] = [['schildtraeger', false], ['berserker', false], ['krieger', false], ['bogenschuetze', false], ['magier', false], ['heiler', false], ['schamane', false], ['wolf', false]];
  const rows: Record<string, Row> = {
    player: { team: 'player', region: 'greenmarch', z: 0, units: playable },
    enemy: { team: 'enemy', region: 'greenmarch', z: -4, units: enemies },
    barrow: { team: 'enemy', region: 'barrowlands', z: -8, units: enemies },
    boss: { team: 'enemy', region: 'darkwood', z: -13, units: [['kriegsherr', false], ['sumpfhexe', false], ['knochenkoenig', false], ['wolf', false]] },
  };
  const pick = q.get('row');
  const chosen = pick ? [rows[pick]!] : Object.values(rows);
  // `only=<ClassId>` keeps one body of the chosen rows, for close-ups.
  const only = q.get('only');
  if (only) for (const r of chosen) r.units = r.units.filter(([c]) => c === only);
  if (pick) chosen[0]!.z = 0;

  const views: UnitView[] = [];
  for (const row of chosen) {
    row.units.forEach(([classId, hero], i) => {
      const v = createUnitView(classId, row.team, hero, { region: row.region });
      const gap = row === rows.boss ? 3.4 : 1.9;
      v.setPose((i - (row.units.length - 1) / 2) * gap, row.z, Math.PI);
      parts.scene.add(v.root);
      views.push(v);
    });
  }

  const state = (q.get('state') ?? 'idle') as UnitState;
  const p = Number(q.get('p') ?? 0.5);
  const windup = 0.6;
  const recover = 0.6;
  const input = (t: number): AnimInput => ({
    state,
    stateTime: state === 'windup' ? p * windup : state === 'recover' ? p * recover : state === 'stunned' ? p * 1 : state === 'dodging' ? p * 0.3 : state === 'dead' ? p * 2.5 : t,
    chain: Number(q.get('chain') ?? 0),
    stunDuration: 1,
    isHero: true,
    action: (q.get('action') as ActionId | null) ?? null,
    windup,
    recover,
    speed: Number(q.get('speed') ?? (state === 'moving' ? 5 : 0)),
    frozen: q.has('frozen'),
    shielded: q.has('shielded'),
    dodgeBack: false,
  });

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
  const post = new Post(parts.renderer, parts.scene, camera);
  const cam = q.get('cam') ?? 'front';
  const depth = chosen.length > 1 ? -6 : 0;
  if (cam === 'side') camera.position.set(9, 2.2, depth + 2);
  else if (cam === 'game') camera.position.set(0, 9, depth + 16);
  else camera.position.set(0, pick === 'boss' ? 3 : 2.4, depth + (chosen.length > 1 ? 25 : only ? 7 : pick === 'boss' ? 16 : 13));
  camera.lookAt(0, cam === 'game' ? 0 : 0.9, depth);
  const resize = (): void => {
    parts.renderer.setSize(window.innerWidth, window.innerHeight, false);
    post.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now();
  let t = 0;
  const loop = (now: number): void => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    for (const v of views) v.animate(input(t), q.has('still') ? 0 : dt);
    post.render(0);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __lineupReady: boolean }).__lineupReady = true;
}
