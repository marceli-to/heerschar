import * as THREE from 'three';
import type { RegionId } from '../data/campaign';
import { nextFloat, range, type RngHolder } from '../sim/rng';
import { hdr, MEADOW } from './palette';
import { layoutFor, RING_RX, RING_RZ, type Layout, type Placement } from './scenery/layouts';
import { REGION_LOOKS, type RegionLook } from './scenery/looks';
import { loadScenery, propTemplate, sceneryMaterial, sceneryReady } from './scenery/props';

/**
 * The arena of a region (6d): flat playable ellipse, stone ring, rolling ground outside, and the
 * region's scenery. Ground, ring, barrows and standing stones are built in code at once; the KayKit
 * props (trees, farm, graves ...) are added as instanced meshes when they have loaded. Everything
 * is placed from fixed seeds, so an arena looks the same every battle and never touches the
 * battle's RNG.
 */
export class Arena {
  readonly group = new THREE.Group();
  private readonly look: RegionLook;
  private readonly layout: Layout;
  /** Windmill sails: turned slowly every frame. */
  private spinners: { mesh: THREE.Object3D; axis: THREE.Vector3 }[] = [];
  private owned: { dispose(): void }[] = [];
  private codeTrees: THREE.Group | null = null;
  private disposed = false;

  constructor(
    width: number,
    depth: number,
    private readonly region: RegionId = 'greenmarch',
  ) {
    this.look = REGION_LOOKS[region];
    this.layout = layoutFor(region);
    const rng: RngHolder = { rngState: 0x5eed };
    this.add(createOuterGround(rng, this.look));
    this.add(createArenaFloor(width / 2, depth / 2, rng, this.look));
    this.add(createStoneRing(rng, this.look));
    if (this.layout.mounds.length) this.add(createMounds(this.layout, this.look));
    if (this.layout.menhirs.length) this.add(createMenhirs(this.layout, this.look));
    if (sceneryReady()) this.addProps();
    else {
      // Until (or if never) the props load, the old code trees stand in.
      this.codeTrees = createTrees(rng, this.look);
      this.group.add(this.codeTrees);
      void loadScenery().then(() => {
        if (this.disposed || !sceneryReady()) return;
        if (this.codeTrees) {
          this.group.remove(this.codeTrees);
          disposeTree(this.codeTrees);
          this.codeTrees = null;
        }
        this.addProps();
      });
    }
  }

  ground(x: number, z: number): number {
    return groundHeight(x, z, this.look.ground.hills);
  }

  update(dt: number): void {
    for (const s of this.spinners) s.mesh.rotateOnAxis(s.axis, dt * 0.35);
  }

  dispose(): void {
    this.disposed = true;
    for (const o of this.owned) o.dispose();
    if (this.codeTrees) disposeTree(this.codeTrees);
    this.group.clear();
  }

  private add(mesh: THREE.Mesh): void {
    this.group.add(mesh);
    this.owned.push(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    this.owned.push(...mats);
  }

  private addProps(): void {
    const byProp = new Map<string, Placement[]>();
    for (const p of this.layout.props) {
      const list = byProp.get(p.prop) ?? [];
      list.push(p);
      byProp.set(p.prop, list);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const pos = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const glows: THREE.Vector3[] = [];
    for (const [id, list] of byProp) {
      const t = propTemplate(id);
      let material: THREE.Material = sceneryMaterial(t.pack, this.region);
      const cloud = id.startsWith('cloud');
      if (cloud) {
        material = new THREE.MeshLambertMaterial({ color: '#ffffff', fog: false, emissive: '#d8e6f2', emissiveIntensity: 0.35 });
        this.owned.push(material);
      }
      const mesh = new THREE.InstancedMesh(t.geometry, material, list.length);
      list.forEach((p, i) => {
        pos.set(p.x, p.lift ?? this.ground(p.x, p.z) - (p.sink ?? 0), p.z);
        q.setFromAxisAngle(up, p.rot);
        s.set(p.scale, p.scale * (p.squash ?? 1), p.scale);
        m.compose(pos, q, s);
        mesh.setMatrixAt(i, m);
        for (const g of t.glow) glows.push(g.clone().applyMatrix4(m));
        if (t.spinner) {
          const sail = new THREE.Mesh(t.spinner.geometry, material);
          sail.matrixAutoUpdate = true;
          new THREE.Matrix4().multiplyMatrices(m, t.spinner.pivot).decompose(sail.position, sail.quaternion, sail.scale);
          sail.castShadow = true;
          this.group.add(sail);
          this.spinners.push({ mesh: sail, axis: t.spinner.axis });
        }
      });
      mesh.computeBoundingSphere();
      mesh.castShadow = !cloud;
      mesh.receiveShadow = !cloud;
      this.group.add(mesh);
      this.owned.push({ dispose: () => mesh.dispose() });
    }
    if (glows.length) this.addGlows(glows);
  }

  /** Small glowing cores in the lantern glass (bloom picks them up). */
  private addGlows(spots: THREE.Vector3[]): void {
    const colour = this.look.swaps.halloween.find((sw) => sw.cell[0] === 2 && sw.cell[1] === 3)?.color ?? '#ffb347';
    const geo = new THREE.SphereGeometry(0.13, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: hdr(colour, 3) });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    spots.forEach((p, i) => mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    mesh.computeBoundingSphere();
    this.group.add(mesh);
    this.owned.push(geo, mat, { dispose: () => mesh.dispose() });
  }
}

export function createArena(width: number, depth: number, region: RegionId = 'greenmarch'): Arena {
  return new Arena(width, depth, region);
}

/** Height of the outer ground: flat around the arena, rolling into hills further out (`hills` scales them). */
export function groundHeight(x: number, z: number, hills = 1): number {
  // Normalised elliptical distance from the arena edge.
  const e = Math.hypot(x / RING_RX, z / RING_RZ);
  const outside = Math.max(0, e - 1.35);
  const ramp = Math.min(1, outside / 1.6);
  const rolling =
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.4) * 4.5 +
    Math.sin(x * 0.11 - z * 0.07) * 1.6 +
    Math.cos(x * 0.021 + z * 0.033) * 6;
  return ramp * ramp * Math.max(-1, rolling + 4 + outside * 2.2) * hills;
}

function createOuterGround(rng: RngHolder, look: RegionLook): THREE.Mesh {
  const size = 420;
  const seg = 84;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i), look.ground.hills) - 0.02);
  }
  const grass = new THREE.Color(look.ground.grass);
  const dark = new THREE.Color(look.ground.grassDark);
  const light = new THREE.Color(look.ground.grassLight);
  const hill = new THREE.Color(look.ground.hill);
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let f = 0; f < pos.count; f += 3) {
    const r = nextFloat(rng);
    c.copy(grass).lerp(r < 0.5 ? dark : light, Math.abs(r - 0.5) * 1.2);
    const y = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    c.lerp(hill, Math.min(1, Math.max(0, y / 12)) * 0.5);
    for (let k = 0; k < 3; k++) c.toArray(colors, (f + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function createArenaFloor(rx: number, rz: number, rng: RngHolder, look: RegionLook): THREE.Mesh {
  // A jittered grid clipped to the ellipse: even low-poly facets without a radial star in the middle.
  const cell = 1.1;
  const ex = rx + 1.2;
  const ez = rz + 1.2;
  const nx = Math.ceil((ex * 2) / cell);
  const nz = Math.ceil((ez * 2) / cell);
  const vx: number[] = [];
  const vz: number[] = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const edge = i === 0 || j === 0 || i === nx || j === nz;
      const jitter = edge ? 0 : cell * 0.3;
      vx.push(-ex + i * cell + range(rng, -jitter, jitter));
      vz.push(-ez + j * cell + range(rng, -jitter, jitter));
    }
  }
  const base = new THREE.Color(look.ground.arena);
  const worn = new THREE.Color(look.ground.arenaWorn);
  const edgeColor = new THREE.Color(look.ground.grass);
  const positions: number[] = [];
  const colors: number[] = [];
  const c = new THREE.Color();
  const tri = (a: number, b: number, d: number): void => {
    const ids = [a, b, d];
    let cx = 0;
    let cz = 0;
    for (const id of ids) {
      cx += vx[id]! / 3;
      cz += vz[id]! / 3;
    }
    const e = Math.hypot(cx / (rx + 0.6), cz / (rz + 0.6));
    if (e > 1) return;
    // Trodden in the middle, blending back into grass towards the stones.
    c.copy(base).lerp(worn, Math.max(0, 0.75 - e) * 0.9);
    c.lerp(edgeColor, Math.min(1, Math.max(0, e - 0.85) * 5));
    c.offsetHSL(0, 0, range(rng, -0.025, 0.025));
    for (const id of ids) {
      positions.push(vx[id]!, 0, vz[id]!);
      colors.push(c.r, c.g, c.b);
    }
  };
  const at = (i: number, j: number): number => j * (nx + 1) + i;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const flip = nextFloat(rng) < 0.5;
      if (flip) {
        tri(at(i, j), at(i, j + 1), at(i + 1, j));
        tri(at(i + 1, j), at(i, j + 1), at(i + 1, j + 1));
      } else {
        tri(at(i, j), at(i, j + 1), at(i + 1, j + 1));
        tri(at(i, j), at(i + 1, j + 1), at(i + 1, j));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function createStoneRing(rng: RngHolder, look: RegionLook): THREE.InstancedMesh {
  const count = 96;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const stone = new THREE.Color(look.stone.light);
  const dark = new THREE.Color(look.stone.dark);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + range(rng, -0.012, 0.012);
    const big = i % 8 === 0;
    p.set(Math.sin(a) * RING_RX, 0, -Math.cos(a) * RING_RZ);
    s.set(range(rng, 0.35, 0.6), range(rng, 0.25, 0.45), range(rng, 0.35, 0.55)).multiplyScalar(big ? 1.6 : 1);
    p.y = s.y * 0.45;
    e.set(range(rng, -0.3, 0.3), range(rng, 0, Math.PI * 2), range(rng, -0.3, 0.3));
    q.setFromEuler(e);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(stone).lerp(dark, nextFloat(rng)));
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Barrows: long low mounds of moor grass, a dark stone door (two posts, a lintel) at the end facing the arena. */
function createMounds(layout: Layout, look: RegionLook): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [];
  const grass = new THREE.Color(look.ground.hill);
  const stone = new THREE.Color(look.stone.dark);
  const dark = new THREE.Color('#1c1a22');
  const paint = (g: THREE.BufferGeometry, c: THREE.Color): THREE.BufferGeometry => {
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(col, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  };
  const m = new THREE.Matrix4();
  for (const b of layout.mounds) {
    const place = new THREE.Matrix4().compose(new THREE.Vector3(b.x, groundHeight(b.x, b.z, look.ground.hills) - 0.3, b.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rot), new THREE.Vector3(1, 1, 1));
    const hill = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    hill.applyMatrix4(m.makeScale(b.width / 2, b.height, b.length / 2)).applyMatrix4(place);
    parts.push(paint(hill, grass));
    // Door at the near end, sunk into the mound's flank.
    const z = b.length / 2 - b.height * 0.55;
    const doorH = Math.min(2.4, b.height * 0.8);
    for (const x of [-0.85, 0.85]) {
      const post = new THREE.BoxGeometry(0.55, doorH, 0.6).toNonIndexed();
      post.applyMatrix4(m.makeTranslation(x, doorH / 2, z)).applyMatrix4(place);
      parts.push(paint(post, stone));
    }
    const lintel = new THREE.BoxGeometry(2.6, 0.5, 0.75).toNonIndexed();
    lintel.applyMatrix4(m.makeTranslation(0, doorH + 0.2, z)).applyMatrix4(place);
    parts.push(paint(lintel, stone));
    const gap = new THREE.PlaneGeometry(1.2, doorH).toNonIndexed();
    gap.applyMatrix4(m.makeTranslation(0, doorH / 2, z + 0.02)).applyMatrix4(place);
    parts.push(paint(gap, dark));
  }
  const geo = mergeAll(parts);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Standing stones: tapered four-sided slabs, leaning a little. */
function createMenhirs(layout: Layout, look: RegionLook): THREE.InstancedMesh {
  const geo = new THREE.CylinderGeometry(0.32, 0.5, 1, 4, 1);
  geo.translate(0, 0.5, 0);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, layout.menhirs.length);
  const rng: RngHolder = { rngState: 0x3e41 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  const light = new THREE.Color(look.stone.light);
  const dark = new THREE.Color(look.stone.dark);
  layout.menhirs.forEach((h, i) => {
    q.setFromEuler(new THREE.Euler(h.lean, h.rot, h.lean * 0.5));
    m.compose(new THREE.Vector3(h.x, groundHeight(h.x, h.z, look.ground.hills) - 0.3, h.z), q, new THREE.Vector3(range(rng, 1.4, 2), h.height + 0.3, range(rng, 0.8, 1.1)));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.copy(light).lerp(dark, nextFloat(rng)));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const p of parts) n += p.getAttribute('position').count;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.getAttribute('position').array as Float32Array, o * 3);
    col.set(p.getAttribute('color').array as Float32Array, o * 3);
    o += p.getAttribute('position').count;
    p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function disposeTree(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
}

/** The code-built trees (cones), used only while / if the scenery props do not load. */
function createTrees(rng: RngHolder, look: RegionLook): THREE.Group {
  const group = new THREE.Group();
  const spots: { x: number; z: number; h: number }[] = [];
  let guard = 0;
  while (spots.length < 140 && guard++ < 2000) {
    const a = nextFloat(rng) * Math.PI * 2;
    const r = range(rng, 1.7, 7.5);
    // Clumps: skip some spots so trees gather in groves with open grass between.
    if (Math.sin(a * 5 + r * 1.3) < -0.25) continue;
    const x = Math.sin(a) * RING_RX * r;
    const z = -Math.cos(a) * RING_RZ * r;
    if (Math.abs(x) > 200 || Math.abs(z) > 200) continue;
    spots.push({ x, z, h: range(rng, 0.8, 1.35) });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6);
  trunkGeo.translate(0, 0.8, 0);
  const lowGeo = new THREE.ConeGeometry(1.7, 2.6, 7);
  lowGeo.translate(0, 2.6, 0);
  const highGeo = new THREE.ConeGeometry(1.2, 2.1, 7);
  highGeo.translate(0, 3.9, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: MEADOW.trunk, flatShading: true }), spots.length);
  const lows = new THREE.InstancedMesh(lowGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), spots.length);
  const highs = new THREE.InstancedMesh(highGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const leaves = new THREE.Color(MEADOW.leaves);
  const leavesLight = new THREE.Color(MEADOW.leavesLight);
  const c = new THREE.Color();
  spots.forEach((t, i) => {
    p.set(t.x, groundHeight(t.x, t.z, look.ground.hills) - 0.1, t.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), nextFloat(rng) * Math.PI * 2);
    s.setScalar(t.h * 1.4);
    m.compose(p, q, s);
    trunks.setMatrixAt(i, m);
    lows.setMatrixAt(i, m);
    highs.setMatrixAt(i, m);
    c.copy(leaves).lerp(leavesLight, nextFloat(rng));
    lows.setColorAt(i, c);
    highs.setColorAt(i, c.offsetHSL(0, 0, 0.03));
  });
  for (const mesh of [trunks, lows, highs]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
