import * as THREE from 'three';
import { FX, hdr } from './palette';

/** Which of the four looks are on (spike keys 1–4; later a quality setting). */
export interface Looks {
  glow: boolean;
  impact: boolean;
  grade: boolean;
  marks: boolean;
}


function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Tiny deterministic noise so textures look the same every load. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const softDot = canvasTexture(64, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
});

const dustTex = canvasTexture(128, (g, s) => {
  const rnd = seeded(7);
  for (let i = 0; i < 14; i++) {
    const x = s / 2 + (rnd() - 0.5) * s * 0.35;
    const y = s / 2 + (rnd() - 0.5) * s * 0.35;
    const rad = s * (0.18 + rnd() * 0.16);
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(255,255,255,0.35)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }
});

/** Burnt patch: dark core, ragged brown edge, a few soot streaks. */
const scorchTex = canvasTexture(256, (g, s) => {
  const rnd = seeded(31);
  const c = s / 2;
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * s * 0.16;
    const x = c + Math.cos(a) * d;
    const y = c + Math.sin(a) * d;
    const rad = s * (0.14 + rnd() * 0.2);
    const r = g.createRadialGradient(x, y, 0, x, y, rad);
    r.addColorStop(0, 'rgba(20,14,10,0.55)');
    r.addColorStop(0.6, 'rgba(45,30,18,0.25)');
    r.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, s, s);
  }
  g.strokeStyle = 'rgba(15,10,8,0.5)';
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = s * 0.08;
    const r1 = s * (0.25 + rnd() * 0.2);
    g.lineWidth = 2 + rnd() * 5;
    g.beginPath();
    g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
    g.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    g.stroke();
  }
});

/** Hoarfrost: pale blotches plus little six-armed crystals, densest in a band (for rings). */
function frostTexture(ring: boolean): THREE.Texture {
  return canvasTexture(512, (g, s) => {
    const rnd = seeded(ring ? 53 : 59);
    const c = s / 2;
    const radius = (): number => (ring ? s * (0.37 + (rnd() - 0.5) * 0.12) : rnd() * s * 0.4);
    for (let i = 0; i < 40; i++) {
      const a = rnd() * Math.PI * 2;
      const d = radius();
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      const rad = s * (0.03 + rnd() * 0.06);
      const r = g.createRadialGradient(x, y, 0, x, y, rad);
      r.addColorStop(0, 'rgba(235,248,255,0.3)');
      r.addColorStop(1, 'rgba(200,235,255,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, s, s);
    }
    g.strokeStyle = 'rgba(245,252,255,0.8)';
    g.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const d = radius();
      const x = c + Math.cos(a) * d;
      const y = c + Math.sin(a) * d;
      const len = 2 + rnd() * 3.5;
      const rot = rnd() * Math.PI;
      g.beginPath();
      for (let k = 0; k < 3; k++) {
        const t = rot + (k * Math.PI) / 3;
        g.moveTo(x - Math.cos(t) * len, y - Math.sin(t) * len);
        g.lineTo(x + Math.cos(t) * len, y + Math.sin(t) * len);
      }
      g.stroke();
    }
  });
}
const frostRingTex = frostTexture(true);
const frostPatchTex = frostTexture(false);

/* ------------------------------------------------------------------ particles */

interface Spark {
  p: THREE.Vector3;
  v: THREE.Vector3;
  life: number;
  max: number;
  c: THREE.Color;
}

/** Short bright streaks that fly out and fall (hit sparks, fire sparks). */
class SparkLayer {
  readonly mesh: THREE.LineSegments;
  private sparks: Spark[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private static MAX = 500;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(SparkLayer.MAX * 6);
    this.col = new Float32Array(SparkLayer.MAX * 6);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }),
    );
    this.mesh.frustumCulled = false;
  }

  /** Share of particles actually spawned (graphics quality). */
  density = 1;

  burst(at: THREE.Vector3, n: number, color: THREE.Color, speed: number, dir?: THREE.Vector3, life = 0.45): void {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n && this.sparks.length < SparkLayer.MAX; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      if (dir) v.addScaledVector(dir, 1.2).normalize();
      v.multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      const max = life * (0.5 + Math.random() * 0.8);
      this.sparks.push({ p: at.clone(), v, life: max, max, c: color });
    }
  }

  clear(): void {
    this.sparks = [];
    this.update(0);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  update(dt: number): void {
    let n = 0;
    this.sparks = this.sparks.filter((s) => (s.life -= dt) > 0);
    for (const s of this.sparks) {
      s.v.y -= 9 * dt;
      s.v.multiplyScalar(1 - 1.5 * dt);
      s.p.addScaledVector(s.v, dt);
      const k = s.life / s.max;
      const tail = s.p.clone().addScaledVector(s.v, -0.035);
      s.p.toArray(this.pos, n * 6);
      tail.toArray(this.pos, n * 6 + 3);
      for (let j = 0; j < 2; j++) {
        this.col[n * 6 + j * 3] = s.c.r * k * (j ? 0.4 : 1);
        this.col[n * 6 + j * 3 + 1] = s.c.g * k * (j ? 0.4 : 1);
        this.col[n * 6 + j * 3 + 2] = s.c.b * k * (j ? 0.4 : 1);
      }
      n++;
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, n * 2);
    g.attributes.position!.needsUpdate = true;
    g.attributes.color!.needsUpdate = true;
  }
}

/** Soft glowing dots: embers, holy motes, frost glitter. */
class MoteLayer {
  readonly mesh: THREE.Points;
  private motes: Spark[] = [];
  private pos: Float32Array;
  private col: Float32Array;
  private static MAX = 800;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(MoteLayer.MAX * 3);
    this.col = new Float32Array(MoteLayer.MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.16,
        map: softDot,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  /** Share of particles actually spawned (graphics quality). */
  density = 1;

  emit(at: THREE.Vector3, n: number, color: THREE.Color, speed: number, life: number, spread = 0.1, lift = 0): void {
    n = Math.max(1, Math.round(n * this.density));
    for (let i = 0; i < n && this.motes.length < MoteLayer.MAX; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(speed * Math.random());
      v.y += lift;
      const p = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread));
      const max = life * (0.6 + Math.random() * 0.6);
      this.motes.push({ p, v, life: max, max, c: color });
    }
  }

  clear(): void {
    this.motes = [];
    this.update(0);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  update(dt: number): void {
    this.motes = this.motes.filter((m) => (m.life -= dt) > 0);
    let n = 0;
    for (const m of this.motes) {
      m.v.multiplyScalar(1 - 2 * dt);
      m.p.addScaledVector(m.v, dt);
      const k = m.life / m.max;
      m.p.toArray(this.pos, n * 3);
      this.col[n * 3] = m.c.r * k;
      this.col[n * 3 + 1] = m.c.g * k;
      this.col[n * 3 + 2] = m.c.b * k;
      n++;
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, n);
    g.attributes.position!.needsUpdate = true;
    g.attributes.color!.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ swing trail */

/** Ribbon between weapon base and tip over the last few frames; additive, fades with age. */
export class SwingTrail {
  readonly mesh: THREE.Mesh;
  private samples: { a: THREE.Vector3; b: THREE.Vector3; age: number }[] = [];
  private pos: Float32Array;
  private alpha: Float32Array;
  private static MAX = 28;
  private static LIFE = 0.16;

  constructor(color: THREE.Color) {
    const n = SwingTrail.MAX;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.alpha = new Float32Array(n * 2);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color } },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying float vAlpha;
          void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          varying float vAlpha;
          void main() { gl_FragColor = vec4(uColor * vAlpha, vAlpha); }`,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  /** Call every frame; `active` adds a new sample, old ones always age out. */
  update(dt: number, active: boolean, base: THREE.Vector3, tip: THREE.Vector3): void {
    for (const s of this.samples) s.age += dt;
    this.samples = this.samples.filter((s) => s.age < SwingTrail.LIFE);
    if (active) {
      this.samples.unshift({ a: base.clone(), b: tip.clone(), age: 0 });
      if (this.samples.length > SwingTrail.MAX) this.samples.length = SwingTrail.MAX;
    }
    const n = this.samples.length;
    this.samples.forEach((s, i) => {
      s.a.toArray(this.pos, i * 6);
      s.b.toArray(this.pos, i * 6 + 3);
      const k = (1 - s.age / SwingTrail.LIFE) * (1 - i / SwingTrail.MAX);
      this.alpha[i * 2] = k * 0.05;
      this.alpha[i * 2 + 1] = k * 0.7;
    });
    const g = this.mesh.geometry;
    g.setDrawRange(0, n > 1 ? (n - 1) * 6 : 0);
    g.attributes.position!.needsUpdate = true;
    (g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ whirl ring */

/**
 * Whirlwind: a closed ring of light at blade height whose bright head rides the blade and whose
 * tail fades round the full circle behind it. Driven every frame while the spin lasts.
 */
export class WhirlRing {
  readonly mesh: THREE.Mesh;
  private level = 0;
  private lastAngle: number | null = null;

  constructor(color: string, radius: number) {
    const geo = new THREE.RingGeometry(radius * 0.4, radius, 72, 1);
    const pos = geo.attributes.position!;
    const alpha = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      let t = Math.atan2(y, x);
      if (t < 0) t += Math.PI * 2;
      const along = 1 - t / (Math.PI * 2);
      const outer = Math.hypot(x, y) > radius * 0.7 ? 1 : 0.15;
      alpha[i] = along * along * along * outer;
    }
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: hdr(color, 2.2) }, uLevel: { value: 0 } },
        vertexShader: /* glsl */ `
          attribute float aAlpha;
          varying float vAlpha;
          void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uLevel;
          varying float vAlpha;
          void main() { float a = vAlpha * uLevel; gl_FragColor = vec4(uColor * a, a); }`,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /**
   * `angle` = where the blade points, measured like the ring's own angle (atan2(-dz, dx)).
   * The tail always trails the way the blade came from.
   */
  update(dt: number, active: boolean, x: number, y: number, z: number, angle: number): void {
    this.level = active ? Math.min(1, this.level + dt * 10) : Math.max(0, this.level - dt * 6);
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uLevel!.value = this.level * 0.85;
    this.mesh.visible = this.level > 0;
    if (!active) {
      this.lastAngle = null;
      return;
    }
    if (this.lastAngle !== null) {
      let d = angle - this.lastAngle;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) > 1e-3) this.mesh.scale.z = d < 0 ? 1 : -1;
    }
    this.lastAngle = angle;
    this.mesh.position.set(x, y, z);
    this.mesh.rotation.y = this.mesh.scale.z > 0 ? angle : -angle;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/* ------------------------------------------------------------------ transient effects */

interface Transient {
  update(dt: number): boolean;
  dispose(): void;
}

const fresnelVertex = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;

/**
 * Everything the spike spawns: magic (fireball, frost ring, holy light, shields),
 * impacts (sparks, dust, trails), ground marks and a small pool of flash lights.
 * Light count is fixed up front so adding a flash never recompiles shaders.
 */
export class FxWorld {
  readonly group = new THREE.Group();
  private sparks = new SparkLayer();
  private motes = new MoteLayer();
  private transients: Transient[] = [];
  private marks: { mesh: THREE.Mesh; life: number; max: number; peak: number }[] = [];
  private lights: { light: THREE.PointLight; life: number; max: number; peak: number }[] = [];
  private puffs: { s: THREE.Sprite; life: number; max: number; v: THREE.Vector3; grow: number }[] = [];
  private markY = 0.05;

  private particleShare = 1;

  constructor(readonly looks: Looks) {
    this.group.add(this.sparks.mesh, this.motes.mesh);
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight('#ffffff', 0, 9, 1.6);
      this.group.add(light);
      this.lights.push({ light, life: 0, max: 1, peak: 0 });
    }
  }

  /** Share of sparks, motes and dust puffs spawned, 0..1 (graphics quality). */
  set density(v: number) {
    this.particleShare = v;
    this.sparks.density = v;
    this.motes.density = v;
  }

  flash(at: THREE.Vector3, color: string, peak: number, dur: number): void {
    const slot = this.lights.reduce((a, b) => (a.life <= b.life ? a : b));
    slot.light.position.copy(at);
    slot.light.color.set(color);
    slot.life = slot.max = dur;
    slot.peak = peak;
  }

  /** A sword hit: sparks out of the contact point, a puff of dust at the feet. */
  hit(at: THREE.Vector3, away: THREE.Vector3, heavy = true): void {
    if (!this.looks.impact) return;
    this.sparks.burst(at, heavy ? 26 : 14, hdr('#ffe6a8', 5), heavy ? 7 : 5.5, away, 0.4);
    this.motes.emit(at, heavy ? 8 : 4, hdr('#ffd38a', 2.5), 2.5, 0.25, 0.05);
    this.flash(at, '#ffd9a0', heavy ? 3 : 1.8, 0.12);
    const feet = at.clone().setY(0.15);
    for (let i = 0; i < (heavy ? 3 : 1); i++) this.puff(feet, 0.5 + Math.random() * 0.3);
  }

  /** Dust kicked up at the feet (dodges, deaths, spawns); `amount` ~ the old particle count. */
  dust(x: number, z: number, amount: number): void {
    const at = new THREE.Vector3(x, 0.12, z);
    const n = Math.max(1, Math.round(amount / 4));
    for (let i = 0; i < n; i++) this.puff(at, 0.5 + Math.random() * 0.4 + amount * 0.02);
  }

  /** A puff ring blown outward from the feet to `radius` (Whirlwind). */
  dustRing(x: number, z: number, radius: number, count = 14): void {
    if (!this.looks.impact) return;
    const at = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      if (Math.random() > this.particleShare) continue;
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      at.set(x + dx * 0.6, 0.15, z + dz * 0.6);
      const mat = new THREE.SpriteMaterial({ map: dustTex, color: '#cdb991', transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.position.copy(at);
      this.group.add(s);
      const speed = ((radius - 0.6) / 0.55) * (0.85 + Math.random() * 0.3);
      this.puffs.push({ s, life: 0.7, max: 0.7, v: new THREE.Vector3(dx * speed, 0.3, dz * speed), grow: 1.3 + Math.random() * 0.4 });
    }
  }

  /**
   * A glowing band racing out over the ground in front of a blow (Shield Bash): an arc of `arc`
   * radians round `facing`, from close by to `reach`.
   */
  shockArc(x: number, z: number, facing: number, reach: number, arc: number, color: string): void {
    const geo = new THREE.RingGeometry(0.78, 1, 32, 1, Math.PI / 2 - arc / 2, arc).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: hdr(color, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(geo, mat);
    const low = mesh.clone();
    low.material = mat;
    mesh.position.set(x, 0.75, z);
    low.position.set(x, 0.08, z);
    mesh.rotation.y = low.rotation.y = -facing;
    this.group.add(mesh, low);
    const dur = 0.3;
    let t = 0;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        const grow = 1 - (1 - k) * (1 - k) * (1 - k);
        const r = 0.5 + (reach * 1.05 - 0.5) * grow;
        mesh.scale.set(r, 1, r);
        low.scale.set(r * 0.92, 1, r * 0.92);
        mat.opacity = (1 - k) * 0.9;
        return k < 1;
      },
      dispose: () => {
        this.group.remove(mesh, low);
        geo.dispose();
        mat.dispose();
      },
    });
  }

  /** A short golden glint (Shield Bash: the shield face lights up as it lands). */
  glint(at: THREE.Vector3, color: string, size: number): void {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: hdr(color, 3), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(at);
    this.group.add(s);
    this.sparks.burst(at, 16, hdr(color, 4), 6, undefined, 0.35);
    this.flash(at, color, 3.5, 0.16);
    const dur = 0.22;
    let t = 0;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        s.scale.setScalar(size * (0.6 + k * 0.8));
        s.material.opacity = 1 - k;
        return k < 1;
      },
      dispose: () => {
        this.group.remove(s);
        s.material.dispose();
      },
    });
  }

  /** Fire landing at `at`: flash, a glowing shell, embers, sparks, dust and a scorch mark, sized to `radius`. */
  fireBlast(x: number, z: number, radius: number): void {
    this.explode(new THREE.Vector3(x, 0.5, z), radius);
  }

  /** A footstep / landing puff. */
  puff(at: THREE.Vector3, size: number): void {
    if (!this.looks.impact || Math.random() > this.particleShare) return;
    const mat = new THREE.SpriteMaterial({ map: dustTex, color: '#cdb991', transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(mat);
    s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, 0, (Math.random() - 0.5) * 0.4));
    s.scale.setScalar(size * 0.5);
    this.group.add(s);
    const v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.8);
    this.puffs.push({ s, life: 0.9, max: 0.9, v, grow: size * 1.8 });
  }

  /** Fireball from `from` to `to`; `onHit` fires when it lands. */
  fireball(from: THREE.Vector3, to: THREE.Vector3, onHit: () => void): void {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: hdr(FX.fireCore, 4) }));
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: softDot, color: hdr(FX.fire, 1.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    glow.scale.setScalar(0.8);
    core.add(glow);
    this.group.add(core);
    const light = this.lights.reduce((a, b) => (a.life <= b.life ? a : b));
    light.light.color.set(FX.fire);
    const dur = 0.5;
    let t = 0;
    const p = new THREE.Vector3();
    this.transients.push({
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / dur);
        p.lerpVectors(from, to, k);
        p.y += Math.sin(k * Math.PI) * 0.6;
        core.position.copy(p);
        core.rotation.x += dt * 9;
        glow.scale.setScalar(0.8 + Math.sin(t * 40) * 0.08);
        light.light.position.copy(p);
        light.life = light.max = 0.05;
        light.peak = 5;
        this.motes.emit(p, 5, hdr(FX.ember, 3), 0.8, 0.45, 0.15, 0.4);
        if (k >= 1) {
          this.explode(to, 1);
          onHit();
          return false;
        }
        return true;
      },
      dispose: () => {
        this.group.remove(core);
        core.geometry.dispose();
      },
    });
  }

  private explode(at: THREE.Vector3, radius: number): void {
    const k0 = Math.max(1, radius * 0.55);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 2),
      new THREE.MeshBasicMaterial({ color: hdr(FX.fire, 1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    shell.position.copy(at);
    this.group.add(shell);
    let t = 0;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const k = t / 0.3;
        shell.scale.setScalar((0.25 + Math.sqrt(k) * 0.85) * k0);
        (shell.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - k) ** 2;
        return k < 1;
      },
      dispose: () => {
        this.group.remove(shell);
        shell.geometry.dispose();
      },
    });
    this.flash(at, FX.fire, 10, 0.45);
    this.motes.emit(at, 60, hdr(FX.ember, 3.5), 4 * k0, 0.8, 0.3, 1.2);
    if (this.looks.impact) {
      this.sparks.burst(at, 40, hdr(FX.fireCore, 5), 8 * k0, undefined, 0.6);
      for (let i = 0; i < 5; i++) this.puff(at.clone().setY(0.2), (0.9 + Math.random() * 0.5) * k0);
    }
    this.mark(scorchTex, at.x, at.z, 2.2 * k0, 0.95, Math.random() * Math.PI * 2);
  }

  /** Expanding ring of frost around `center`, ice shards pop up where it passes. */
  frostRing(center: THREE.Vector3, radius: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({ color: hdr(FX.frost, 1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.06, center.z);
    this.group.add(ring);

    const shardMat = new THREE.MeshLambertMaterial({ color: '#d8f4ff', emissive: hdr(FX.frost, 0.9), flatShading: true, transparent: true, opacity: 0.92 });
    const shards: { m: THREE.Mesh; d: number; h: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.2;
      const d = radius * (0.75 + Math.random() * 0.3);
      const h = 0.35 + Math.random() * 0.5;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.09 + Math.random() * 0.05, 1, 4), shardMat);
      m.position.set(center.x + Math.cos(a) * d, 0, center.z + Math.sin(a) * d);
      m.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (Math.random() - 0.5) * 0.6);
      m.scale.set(1, 0.001, 1);
      m.castShadow = true;
      this.group.add(m);
      shards.push({ m, d, h });
    }
    this.flash(center.clone().setY(1), FX.frost, 4, 0.5);
    let t = 0;
    const expand = 0.45;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const r = radius * Math.min(1, t / expand);
        ring.scale.setScalar(Math.max(0.01, r));
        (ring.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - Math.max(0, t - expand) / 0.5);
        for (const s of shards) {
          const born = (s.d / radius) * expand;
          const age = t - born;
          if (age < 0) continue;
          const up = Math.min(1, age / 0.12);
          const melt = Math.max(0, (age - 1.4) / 0.6);
          s.m.scale.y = Math.max(0.001, s.h * up * (1 - melt));
          s.m.position.y = (s.m.scale.y / 2) * 0.9;
          if (age < dt + 0.001) this.motes.emit(s.m.position.clone().setY(0.3), 4, hdr(FX.frostCore, 2.5), 1.2, 0.7, 0.2, 0.6);
        }
        return t < expand + 2.2;
      },
      dispose: () => {
        this.group.remove(ring);
        ring.geometry.dispose();
        for (const s of shards) {
          this.group.remove(s.m);
          s.m.geometry.dispose();
        }
      },
    });
    this.mark(frostRingTex, center.x, center.z, radius * 2.7, 0.75, Math.random() * Math.PI * 2);
  }

  /** Column of golden light from above with rising motes (Healing Circle / Blessing). */
  holyLight(at: THREE.Vector3): void {
    const geo = new THREE.CylinderGeometry(0.55, 0.7, 7, 32, 1, true);
    geo.translate(0, 3.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: hdr(FX.holy, 1.3) }, uFade: { value: 0 } },
      vertexShader: /* glsl */ `
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vH = position.y / 7.0;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade;
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          float edge = 1.0 - abs(dot(vN, vV));
          float a = pow(1.0 - vH, 2.2) * (0.08 + edge * 0.5) * uFade;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const beam = new THREE.Mesh(geo, mat);
    beam.position.set(at.x, 0, at.z);
    this.group.add(beam);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ map: softDot, color: hdr(FX.holy, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(at.x, 0.04, at.z);
    this.group.add(disc);
    this.flash(at.clone().setY(1.6), FX.holy, 6, 1.4);
    let t = 0;
    const dur = 1.6;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const f = Math.min(1, t / 0.15) * Math.min(1, (dur - t) / 0.6);
        mat.uniforms.uFade!.value = Math.max(0, f);
        (disc.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f);
        disc.scale.setScalar(1.2 + Math.sin(t * 6) * 0.05);
        if (t < dur - 0.5) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * 0.7;
          this.motes.emit(new THREE.Vector3(at.x + Math.cos(a) * r, 0.2, at.z + Math.sin(a) * r), 2, hdr(FX.holyCore, 2.2), 0.2, 1.2, 0.05, 1.8);
        }
        return t < dur;
      },
      dispose: () => {
        this.group.remove(beam, disc);
        geo.dispose();
      },
    });
  }

  /** Golden bubble around a figure for `dur` seconds; returns a pulse() to call on hits. */
  shield(target: THREE.Object3D, dur: number): () => void {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: hdr(FX.shieldPlayer, 2.2) }, uFade: { value: 0 }, uPulse: { value: 0 } },
      vertexShader: fresnelVertex,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uFade; uniform float uPulse;
        varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
          float a = (0.06 + rim * 0.9 + uPulse * 0.35) * uFade;
          gl_FragColor = vec4(uColor * a, a);
        }`,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 4), mat);
    bubble.position.y = 0.95;
    bubble.scale.set(0.9, 1, 0.9);
    target.add(bubble);
    let t = 0;
    this.transients.push({
      update: (dt) => {
        t += dt;
        const pop = Math.min(1, t / 0.18);
        mat.uniforms.uFade!.value = pop * Math.min(1, Math.max(0, (dur - t) / 0.4));
        mat.uniforms.uPulse!.value = Math.max(0, mat.uniforms.uPulse!.value - dt * 3);
        bubble.scale.setScalar(0.6 + pop * 0.4 + mat.uniforms.uPulse!.value * 0.05);
        bubble.rotation.y += dt * 0.6;
        return t < dur;
      },
      dispose: () => {
        target.remove(bubble);
        bubble.geometry.dispose();
      },
    });
    return () => {
      mat.uniforms.uPulse!.value = 1;
    };
  }

  private mark(tex: THREE.Texture, x: number, z: number, size: number, peak: number, rot: number): void {
    if (!this.looks.marks) return;
    const mat = new THREE.MeshLambertMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      opacity: peak,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    mesh.rotation.set(-Math.PI / 2, 0, rot);
    // Each new mark sits a hair above the last so overlaps never z-fight.
    this.markY = this.markY > 0.07 ? 0.05 : this.markY + 0.002;
    mesh.position.set(x, this.markY, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.marks.push({ mesh, life: 11, max: 11, peak });
  }

  /** Small frost patch under a frozen figure. */
  frostPatch(x: number, z: number): void {
    this.mark(frostPatchTex, x, z, 1.6, 0.85, Math.random() * Math.PI * 2);
  }

  /** Drops every running effect and mark (battle restart). */
  clear(): void {
    for (const t of this.transients) t.dispose();
    this.transients = [];
    for (const m of this.marks) {
      this.group.remove(m.mesh);
      m.mesh.geometry.dispose();
      (m.mesh.material as THREE.Material).dispose();
    }
    this.marks = [];
    for (const d of this.puffs) {
      this.group.remove(d.s);
      d.s.material.dispose();
    }
    this.puffs = [];
    this.sparks.clear();
    this.motes.clear();
    for (const l of this.lights) l.life = 0;
  }

  dispose(): void {
    this.clear();
    this.sparks.dispose();
    this.motes.dispose();
  }

  update(dt: number): void {
    this.sparks.update(dt);
    this.motes.update(dt);
    // Effects may spawn others while updating (fireball -> explosion), so collect those separately.
    const running = this.transients;
    this.transients = [];
    const alive = running.filter((t) => {
      const keep = t.update(dt);
      if (!keep) t.dispose();
      return keep;
    });
    this.transients = alive.concat(this.transients);
    for (const l of this.lights) {
      l.life = Math.max(0, l.life - dt);
      l.light.intensity = l.peak * (l.life / l.max);
    }
    this.puffs = this.puffs.filter((d) => {
      d.life -= dt;
      const k = 1 - d.life / d.max;
      d.s.position.addScaledVector(d.v, dt);
      d.s.scale.setScalar(d.grow * (0.35 + k * 0.65));
      d.s.material.opacity = Math.min(1, k * 6) * (1 - k) * 0.75;
      if (d.life <= 0) {
        this.group.remove(d.s);
        d.s.material.dispose();
        return false;
      }
      return true;
    });
    this.marks = this.marks.filter((m) => {
      m.life -= dt;
      const mat = m.mesh.material as THREE.MeshLambertMaterial;
      mat.opacity = m.peak * Math.min(1, m.life / 3);
      if (m.life <= 0 || !this.looks.marks) {
        this.group.remove(m.mesh);
        m.mesh.geometry.dispose();
        mat.dispose();
        return false;
      }
      return true;
    });
  }
}
