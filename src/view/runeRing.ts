import * as THREE from 'three';
import type { Battle } from '../sim/types';
import { FX, hdr } from './palette';

const Y = 0.05;
/** Seconds the ring takes to draw itself round. */
const DRAW = 0.45;
/** Seconds it fades after the circle ends. */
const FADE = 0.4;
/** Pulse brightness decay per second. */
const PULSE_DECAY = 4;

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  x: number;
  z: number;
  radius: number;
  age: number;
  /** Seconds left fading out once the area is gone (null while it lasts). */
  fading: number | null;
  pulse: number;
}

/**
 * Healing Circle: a golden ring of runes that draws itself round on the ground, turns slowly,
 * and flares on every heal tick. Replaces the green heal disc for the hero's circle only.
 */
export class RuneRings {
  readonly group = new THREE.Group();
  private rings = new Map<number, Ring>();
  private geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private tex = runeTexture();

  sync(battle: Battle, frameTime: number): void {
    const alive = new Set<number>();
    for (const a of battle.areas) {
      if (a.kind !== 'heilkreis') continue;
      alive.add(a.id);
      let r = this.rings.get(a.id);
      if (!r) {
        const mat = runeMaterial(this.tex);
        const mesh = new THREE.Mesh(this.geo, mat);
        mesh.renderOrder = 2;
        this.group.add(mesh);
        r = { mesh, mat, x: a.pos.x, z: a.pos.z, radius: a.radius, age: 0, fading: null, pulse: 0 };
        this.rings.set(a.id, r);
      }
      r.x = a.pos.x;
      r.z = a.pos.z;
    }
    for (const [id, r] of this.rings) {
      if (!alive.has(id) && r.fading === null) r.fading = FADE;
      r.age += frameTime;
      r.pulse = Math.max(0, r.pulse - frameTime * PULSE_DECAY);
      let fade = 1;
      if (r.fading !== null) {
        r.fading -= frameTime;
        fade = Math.max(0, r.fading / FADE);
        if (r.fading <= 0) {
          this.group.remove(r.mesh);
          r.mat.dispose();
          this.rings.delete(id);
          continue;
        }
      }
      const k = Math.min(1, r.age / DRAW);
      r.mesh.position.set(r.x, Y, r.z);
      r.mesh.rotation.y = r.age * 0.25;
      const u = r.mat.uniforms;
      u.reveal!.value = 1 - (1 - k) * (1 - k);
      u.opacity!.value = fade * (0.75 + r.pulse * 0.6);
      r.mesh.scale.setScalar(r.radius * (1 + r.pulse * 0.04));
    }
  }

  /** A heal tick: the ring nearest to (x, z) flares. */
  pulse(x: number, z: number): void {
    let best: Ring | null = null;
    let bestD = Infinity;
    for (const r of this.rings.values()) {
      const d = Math.hypot(r.x - x, r.z - z);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    if (best && bestD < 1) best.pulse = 1;
  }

  clear(): void {
    for (const r of this.rings.values()) {
      this.group.remove(r.mesh);
      r.mat.dispose();
    }
    this.rings.clear();
  }

  dispose(): void {
    this.clear();
    this.geo.dispose();
    this.tex.dispose();
  }
}

function runeMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, color: { value: hdr(FX.rally, 2.2) }, reveal: { value: 0 }, opacity: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 color; uniform float reveal; uniform float opacity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float a = atan(p.y, p.x) / 6.2831853 + 0.5;
        if (a > reveal) discard;
        // The drawing tip glows brighter as it runs round.
        float tip = reveal < 1.0 ? smoothstep(0.08, 0.0, reveal - a) * 0.8 : 0.0;
        float t = texture2D(map, vUv).a;
        gl_FragColor = vec4(color * (1.0 + tip), t * opacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
  });
}

/** Two thin circles with a band of angular runes between them (white on clear; tinted in the shader). */
function runeTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const mid = size / 2;
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const circle = (r: number, w: number): void => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(mid, mid, r, 0, Math.PI * 2);
    g.stroke();
  };
  circle(mid * 0.97, 7);
  circle(mid * 0.78, 4);
  // Runes: each a few straight strokes on a small grid, placed round the band.
  const runes: [number, number, number, number][][] = [
    [[0, -1, 0, 1], [0, -1, 0.6, -0.4], [0, -0.2, 0.6, 0.4]],
    [[0, -1, 0, 1], [0, -1, 0.6, -0.5], [0.6, -0.5, 0, 0], [0, 0, 0.6, 1]],
    [[0, -1, 0, 1], [-0.6, -1, 0, -0.3], [0.6, -1, 0, -0.3]],
    [[-0.5, -1, 0.5, 1], [0.5, -1, -0.5, 1]],
    [[0, -1, 0, 1], [0, -0.4, 0.6, -1], [0, 0.2, 0.6, -0.4]],
    [[-0.5, 1, 0, -1], [0, -1, 0.5, 1], [-0.25, 0.1, 0.25, 0.1]],
    [[0, -1, 0.6, 0], [0.6, 0, 0, 1], [0, 1, -0.6, 0], [-0.6, 0, 0, -1]],
    [[-0.5, -1, -0.5, 1], [0.5, -1, 0.5, 1], [-0.5, -0.6, 0.5, 0.6]],
  ];
  const count = 16;
  const r = mid * 0.875;
  const s = mid * 0.065;
  g.lineWidth = 6;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    g.save();
    g.translate(mid + Math.cos(ang) * r, mid + Math.sin(ang) * r);
    g.rotate(ang + Math.PI / 2);
    g.beginPath();
    for (const [x1, y1, x2, y2] of runes[i % runes.length]!) {
      g.moveTo(x1 * s, y1 * s);
      g.lineTo(x2 * s, y2 * s);
    }
    g.stroke();
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}
