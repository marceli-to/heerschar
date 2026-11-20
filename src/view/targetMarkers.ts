import * as THREE from 'three';
import { FX } from './palette';

/** Storybook (6i) ink outline colour, same as the over-head bars. */
const INK = '#3b2414';
const GOLD: [string, string] = ['#ffe07a', '#f0a92a'];
const RED: [string, string] = ['#ff6a52', FX.banner];

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Fills and outlines the current path: ink stroke under a gold / red gradient fill. */
function inked(c: CanvasRenderingContext2D, fill: string | CanvasGradient, line: number): void {
  c.lineJoin = 'round';
  c.lineWidth = line * 2;
  c.strokeStyle = INK;
  c.stroke();
  c.fillStyle = fill;
  c.fill();
}

/** Lock ring canvas: size in px for the full 2 m square. */
const RING_PX = 512;
const RING_M = 2;

function drawLockRing(c: CanvasRenderingContext2D): void {
  const s = RING_PX / RING_M; // px per metre
  const mid = RING_PX / 2;
  const line = 0.035 * s;
  const rIn = 0.7 * s;
  const rOut = 0.84 * s;
  const gold = c.createRadialGradient(mid, mid, rIn, mid, mid, rOut);
  gold.addColorStop(0, GOLD[1]);
  gold.addColorStop(1, GOLD[0]);
  // Fat band.
  c.beginPath();
  c.arc(mid, mid, rOut, 0, Math.PI * 2);
  c.arc(mid, mid, rIn, 0, Math.PI * 2, true);
  inked(c, gold, line);
  // Shine: a pale stripe along the outer half of the band.
  c.beginPath();
  c.arc(mid, mid, rOut - 0.035 * s, 0, Math.PI * 2);
  c.arc(mid, mid, rOut - 0.065 * s, 0, Math.PI * 2, true);
  c.fillStyle = 'rgb(255 255 255 / 0.45)';
  c.fill();
  // Four chunky triangles pointing in, their base over the band.
  for (let i = 0; i < 4; i++) {
    c.save();
    c.translate(mid, mid);
    c.rotate((i * Math.PI) / 2);
    c.beginPath();
    c.moveTo(0, -0.5 * s);
    c.lineTo(-0.16 * s, -0.94 * s);
    c.lineTo(0.16 * s, -0.94 * s);
    c.closePath();
    const g = c.createLinearGradient(0, -0.94 * s, 0, -0.5 * s);
    g.addColorStop(0, GOLD[0]);
    g.addColorStop(1, GOLD[1]);
    inked(c, g, line);
    c.restore();
  }
}

/** Lock-on (Storybook since 6i): a fat gold ground ring with an ink outline and four chunky inward ticks, slowly turning. */
export class LockRing {
  readonly group = new THREE.Group();
  private readonly spinner = new THREE.Group();
  private readonly tex = canvasTexture(RING_PX, RING_PX, drawLockRing);
  private readonly mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide });
  private readonly geo = new THREE.PlaneGeometry(RING_M, RING_M).rotateX(-Math.PI / 2);
  private time = 0;

  constructor() {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.renderOrder = 4;
    this.spinner.add(mesh);
    this.group.add(this.spinner);
    this.group.visible = false;
  }

  update(x: number, z: number, visible: boolean, frameTime: number): void {
    this.group.visible = visible;
    if (!visible) return;
    this.time += frameTime;
    this.group.position.set(x, 0.07, z);
    this.spinner.rotation.y = this.time * 0.9;
    const pulse = 1 + Math.sin(this.time * 4) * 0.03;
    this.spinner.scale.setScalar(pulse);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

/** Banner canvases: px per metre. */
const BANNER_PX = 400;
const POLE_W = 0.16;
const POLE_H = 0.86;
const FLAG_W = 0.56;
const FLAG_H = 0.4;

function drawPole(c: CanvasRenderingContext2D): void {
  const s = BANNER_PX;
  const line = 0.022 * s;
  const cx = (POLE_W / 2) * s;
  const top = 0.08 * s;
  // Shaft.
  c.beginPath();
  c.roundRect(cx - 0.025 * s, top, 0.05 * s, POLE_H * s - top - line, 0.02 * s);
  const g = c.createLinearGradient(cx - 0.025 * s, 0, cx + 0.025 * s, 0);
  g.addColorStop(0, GOLD[0]);
  g.addColorStop(1, GOLD[1]);
  inked(c, g, line);
  // Coin knob on top.
  c.beginPath();
  c.arc(cx, top, 0.05 * s, 0, Math.PI * 2);
  inked(c, GOLD[0], line);
  c.beginPath();
  c.arc(cx - 0.015 * s, top - 0.015 * s, 0.016 * s, 0, Math.PI * 2);
  c.fillStyle = 'rgb(255 255 255 / 0.6)';
  c.fill();
}

function drawFlag(c: CanvasRenderingContext2D): void {
  const s = BANNER_PX;
  const line = 0.022 * s;
  const p = line; // keep the outline inside the canvas
  const w = FLAG_W * s - p;
  const h = FLAG_H * s - p;
  const cloth = (): void => {
    c.beginPath();
    c.moveTo(p, p);
    c.lineTo(w, p);
    c.lineTo(w - 0.15 * s, (p + h) / 2);
    c.lineTo(w, h);
    c.lineTo(p, h);
    c.closePath();
  };
  cloth();
  const g = c.createLinearGradient(0, p, 0, h);
  g.addColorStop(0, RED[0]);
  g.addColorStop(1, RED[1]);
  inked(c, g, line);
  // Gold trim along the top, clipped to the cloth.
  c.save();
  cloth();
  c.clip();
  c.fillStyle = GOLD[0];
  c.fillRect(0, p + line * 0.5, w, 0.05 * s);
  c.fillStyle = INK;
  c.fillRect(0, p + line * 0.5 + 0.05 * s, w, line * 0.6);
  // Shine stripe below the trim.
  c.fillStyle = 'rgb(255 255 255 / 0.3)';
  c.fillRect(0.04 * s, p + 0.1 * s, w - 0.24 * s, 0.03 * s);
  c.restore();
}

/** Mark (Storybook since 6i): a red swallow-tail banner with ink outline and gold trim on a gold pole, waving, seen through figures. */
export class MarkBanner {
  readonly group = new THREE.Group();
  private readonly flag = new THREE.Group();
  private readonly texs = [canvasTexture(POLE_W * BANNER_PX, POLE_H * BANNER_PX, drawPole), canvasTexture(FLAG_W * BANNER_PX, FLAG_H * BANNER_PX, drawFlag)];
  private readonly mats = this.texs.map(
    (map) => new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, depthTest: false, depthWrite: false, fog: false, toneMapped: false, transparent: true }),
  );
  private readonly geos = [
    new THREE.PlaneGeometry(POLE_W, POLE_H).translate(0, POLE_H / 2, 0),
    // Cloth hangs from its top-left corner (the pole) and points to +x.
    new THREE.PlaneGeometry(FLAG_W, FLAG_H).translate(FLAG_W / 2, -FLAG_H / 2, 0.001),
  ];
  private time = 0;

  constructor() {
    const pole = new THREE.Mesh(this.geos[0], this.mats[0]);
    const cloth = new THREE.Mesh(this.geos[1], this.mats[1]);
    pole.renderOrder = 11;
    cloth.renderOrder = 12;
    this.flag.position.set(0.0, POLE_H - 0.13, 0);
    this.flag.add(cloth);
    this.group.add(pole, this.flag);
    this.group.visible = false;
  }

  update(x: number, y: number, z: number, visible: boolean, camera: THREE.Camera, frameTime: number): void {
    this.group.visible = visible;
    if (!visible) return;
    this.time += frameTime;
    this.group.position.set(x, y + Math.sin(this.time * 2.2) * 0.04, z);
    // Turn with the camera so the cloth always reads side-on.
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.group.rotation.set(0, e.y, 0);
    this.flag.rotation.y = Math.sin(this.time * 3.1) * 0.35;
    this.flag.rotation.z = Math.sin(this.time * 4.3) * 0.05;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
  }
}

/** Hero ring canvas: px for the full square, and its size in metres. */
const HERO_PX = 256;
const HERO_M = 1.3;

function drawHeroRing(c: CanvasRenderingContext2D): void {
  const s = HERO_PX / HERO_M;
  const mid = HERO_PX / 2;
  // A thin cream band with an ink outline, softer than the lock ring: no ticks, no gold.
  c.beginPath();
  c.arc(mid, mid, 0.6 * s, 0, Math.PI * 2);
  c.arc(mid, mid, 0.53 * s, 0, Math.PI * 2, true);
  c.globalAlpha = 0.85;
  inked(c, '#fff2c4', 0.012 * s);
}

let heroRingParts: { geo: THREE.PlaneGeometry; mat: THREE.MeshBasicMaterial } | null = null;

/**
 * The hero's own ground ring, under the feet of the unit the player controls (the gpg figures carry no
 * hero trim). Thin, cream and still, so it never reads as the gold lock ring. Shared by every view; never disposed.
 */
export function heroRingMesh(): THREE.Mesh {
  heroRingParts ??= {
    geo: new THREE.PlaneGeometry(HERO_M, HERO_M).rotateX(-Math.PI / 2),
    mat: new THREE.MeshBasicMaterial({ map: canvasTexture(HERO_PX, HERO_PX, drawHeroRing), transparent: true, depthWrite: false, fog: false, toneMapped: false }),
  };
  const mesh = new THREE.Mesh(heroRingParts.geo, heroRingParts.mat);
  mesh.position.y = 0.05;
  mesh.renderOrder = 3;
  return mesh;
}
