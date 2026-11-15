import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Debug only (`?debug`): finds NaN / Infinity pixels in the HDR scene buffer before bloom smears them
 * into black boxes. Sits right after the RenderPass. Each frame it reduces the scene buffer to one
 * texel per 8×8 block ("does this block hold a bad pixel?") and reads that back. When bad pixels
 * show up it re-renders the scene with ever smaller sets of objects (via a probe layer) until it
 * has the objects that produce them, and logs those (also kept in `window.__nan`).
 */

const BLOCK = 8;
/** Camera layer used to render only a chosen set of objects. */
const PROBE_LAYER = 31;
/** Reports per battle, so a persistent NaN does not flood the console. */
const MAX_REPORTS = 6;

const MaskShader = new THREE.ShaderMaterial({
  uniforms: { tScene: { value: null } },
  vertexShader: /* glsl */ `
    void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tScene;
    // Exponent bits all set = NaN or Infinity; immune to compilers that fold "x != x" away.
    bool bad(float x) { return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
    void main() {
      ivec2 size = textureSize(tScene, 0);
      ivec2 base = ivec2(gl_FragCoord.xy) * ${BLOCK};
      float hit = 0.0;
      for (int y = 0; y < ${BLOCK}; y++) {
        for (int x = 0; x < ${BLOCK}; x++) {
          ivec2 p = min(base + ivec2(x, y), size - 1);
          vec4 c = texelFetch(tScene, p, 0);
          if (bad(c.r) || bad(c.g) || bad(c.b) || bad(c.a)) hit = 1.0;
        }
      }
      gl_FragColor = vec4(hit, 0.0, 0.0, 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
});

interface Culprit {
  name: string;
  type: string;
  path: string;
  material: string;
  geometry: string;
  scale: string;
  worldScale: string;
  determinant: number;
  position: string;
}

export interface NanReport {
  time: number;
  /** Bad 8×8 blocks and their bounding box in screen pixels (origin top left). */
  blocks: number;
  box: { x0: number; y0: number; x1: number; y1: number };
  culprits: Culprit[];
}

export class NanProbe extends Pass {
  readonly reports: NanReport[] = [];
  private readonly quad = new FullScreenQuad(MaskShader);
  private readonly mask = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  private readonly probe = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  private pixels = new Uint8Array(4);
  private searching = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
  ) {
    super();
    this.needsSwap = false;
    (window as unknown as { __nan: NanReport[] }).__nan = this.reports;
  }

  override setSize(w: number, h: number): void {
    this.mask.setSize(Math.ceil(w / BLOCK), Math.ceil(h / BLOCK));
    this.probe.setSize(w, h);
    this.pixels = new Uint8Array(this.mask.width * this.mask.height * 4);
  }

  override render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    if (this.searching || this.reports.length >= MAX_REPORTS) return;
    const hits = this.scan(renderer, read.texture);
    if (!hits) return;
    this.searching = true;
    try {
      this.report(renderer, hits, read.width, read.height);
    } finally {
      this.searching = false;
    }
  }

  override dispose(): void {
    this.quad.dispose();
    this.mask.dispose();
    this.probe.dispose();
  }

  /** Bad blocks in `tex` (count and bounding box in mask texels, GL origin bottom left), or null. */
  private scan(renderer: THREE.WebGLRenderer, tex: THREE.Texture): { n: number; x0: number; y0: number; x1: number; y1: number } | null {
    const prev = renderer.getRenderTarget();
    MaskShader.uniforms['tScene']!.value = tex;
    renderer.setRenderTarget(this.mask);
    this.quad.render(renderer);
    const { width: w, height: h } = this.mask;
    renderer.readRenderTargetPixels(this.mask, 0, 0, w, h, this.pixels);
    renderer.setRenderTarget(prev);
    let n = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.pixels[(y * w + x) * 4]! < 128) continue;
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    return n ? { n, x0, y0, x1, y1 } : null;
  }

  private report(renderer: THREE.WebGLRenderer, hits: { n: number; x0: number; y0: number; x1: number; y1: number }, w: number, h: number): void {
    const culprits = this.findCulprits(renderer).map(describe);
    // Screen pixels, origin top left (the mask is bottom-left based).
    const box = { x0: hits.x0 * BLOCK, x1: Math.min(w, (hits.x1 + 1) * BLOCK), y0: h - Math.min(h, (hits.y1 + 1) * BLOCK), y1: h - hits.y0 * BLOCK };
    const r: NanReport = { time: performance.now() / 1000, blocks: hits.n, box, culprits };
    this.reports.push(r);
    console.warn(
      `[nan] ${hits.n} bad 8x8 block(s) in the scene buffer, box ${box.x0},${box.y0} - ${box.x1},${box.y1} (drawing-buffer px, ${w}x${h}).`,
      culprits.length ? culprits.length === 1 ? 'Culprit:' : 'Culprit(s), possibly only together:' : 'No single object reproduces it on its own (shadow map, or a mix of objects).',
      culprits,
    );
  }

  /** Renders subsets of the visible renderables and narrows down which ones produce bad pixels. */
  private findCulprits(renderer: THREE.WebGLRenderer): THREE.Object3D[] {
    const renderables: THREE.Object3D[] = [];
    const others: THREE.Object3D[] = [];
    this.scene.traverseVisible((o) => {
      const r = o as THREE.Mesh;
      if (r.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite) renderables.push(o);
      else others.push(o); // lights, groups, cameras
    });
    const camLayers = this.camera.layers.mask;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    for (const o of others) o.layers.enable(PROBE_LAYER);
    this.camera.layers.set(PROBE_LAYER);
    // Keep the shadow map from this frame: re-rendering it per subset would change what is tested.
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = true;

    // Bad pixels can flicker from one render to the next, so a subset gets a few tries.
    const test = (set: THREE.Object3D[]): boolean => {
      for (const o of set) o.layers.enable(PROBE_LAYER);
      let hit = false;
      for (let i = 0; i < 3 && !hit; i++) {
        renderer.setRenderTarget(this.probe);
        renderer.render(this.scene, this.camera);
        hit = this.scan(renderer, this.probe.texture) !== null;
      }
      for (const o of set) o.layers.disable(PROBE_LAYER);
      return hit;
    };

    const found: THREE.Object3D[] = [];
    const bisect = (set: THREE.Object3D[]): void => {
      if (found.length >= 12) return;
      if (set.length === 1) {
        found.push(set[0]!);
        return;
      }
      const mid = set.length >> 1;
      const a = set.slice(0, mid);
      const b = set.slice(mid);
      const hitA = test(a);
      const hitB = test(b);
      if (hitA) bisect(a);
      if (hitB) bisect(b);
      // Neither half on its own: it takes objects together (or it flickers). Report the whole set.
      if (!hitA && !hitB) found.push(...set.slice(0, 12 - found.length));
    };
    try {
      if (renderables.length && test(renderables)) bisect(renderables);
    } finally {
      for (const o of others) o.layers.disable(PROBE_LAYER);
      this.camera.layers.mask = camLayers;
      renderer.shadowMap.autoUpdate = prevShadowAuto;
      renderer.autoClear = prevAutoClear;
      renderer.setRenderTarget(prevTarget);
    }
    return found;
  }
}

const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();

function describe(o: THREE.Object3D): Culprit {
  const path: string[] = [];
  for (let p: THREE.Object3D | null = o; p; p = p.parent) path.unshift(p.name || p.type);
  const m = (o as THREE.Mesh).material;
  const mats = (Array.isArray(m) ? m : m ? [m] : []).map((x) => `${x.type}${x.name ? ` "${x.name}"` : ''}`).join(', ');
  const g = (o as THREE.Mesh).geometry;
  o.matrixWorld.decompose(_p, _q, _s);
  const f = (v: THREE.Vector3): string => `${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)}`;
  return {
    name: o.name,
    type: o.type,
    path: path.join(' > '),
    material: mats,
    geometry: g ? `${g.type}${g.name ? ` "${g.name}"` : ''}` : '',
    scale: f(o.scale),
    worldScale: f(_s),
    determinant: o.matrixWorld.determinant(),
    position: f(_p),
  };
}
