import * as THREE from 'three';
import { nextFloat, range, type RngHolder } from '../sim/rng';
import { MEADOW } from './palette';

/** Radii of the stone ring, just outside the 44 × 30 m playable ellipse. */
const RING_RX = 22.9;
const RING_RZ = 15.9;

/**
 * Static meadow arena: flat playable ellipse, stone ring, rolling ground with hills and trees.
 * Uses its own fixed-seed sequence so the scenery looks the same every time without touching
 * the battle's RNG.
 */
export function createArena(width: number, depth: number): THREE.Group {
  const rng: RngHolder = { rngState: 0x5eed };
  const group = new THREE.Group();
  group.add(createOuterGround(rng));
  group.add(createArenaFloor(width / 2, depth / 2, rng));
  group.add(createStoneRing(rng));
  group.add(createTrees(rng));
  return group;
}

/** Height of the outer ground: flat around the arena, rolling into hills further out. */
export function groundHeight(x: number, z: number): number {
  // Normalised elliptical distance from the arena edge.
  const e = Math.hypot(x / RING_RX, z / RING_RZ);
  const outside = Math.max(0, e - 1.35);
  const ramp = Math.min(1, outside / 1.6);
  const rolling =
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 - 0.4) * 4.5 +
    Math.sin(x * 0.11 - z * 0.07) * 1.6 +
    Math.cos(x * 0.021 + z * 0.033) * 6;
  return ramp * ramp * Math.max(-1, rolling + 4 + outside * 2.2);
}

function createOuterGround(rng: RngHolder): THREE.Mesh {
  const size = 420;
  const seg = 84;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)) - 0.02);
  }
  const grass = new THREE.Color(MEADOW.grass);
  const dark = new THREE.Color(MEADOW.grassDark);
  const light = new THREE.Color(MEADOW.grassLight);
  const hill = new THREE.Color(MEADOW.hill);
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

function createArenaFloor(rx: number, rz: number, rng: RngHolder): THREE.Mesh {
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
  const base = new THREE.Color(MEADOW.arenaGround);
  const worn = new THREE.Color(MEADOW.arenaGroundWorn);
  const edgeColor = new THREE.Color(MEADOW.grass);
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

function createStoneRing(rng: RngHolder): THREE.InstancedMesh {
  const count = 96;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const stone = new THREE.Color(MEADOW.stone);
  const dark = new THREE.Color(MEADOW.stoneDark);
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

function createTrees(rng: RngHolder): THREE.Group {
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
  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const lows = new THREE.InstancedMesh(lowGeo, leafMat, spots.length);
  const highs = new THREE.InstancedMesh(highGeo, leafMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const leaves = new THREE.Color(MEADOW.leaves);
  const leavesLight = new THREE.Color(MEADOW.leavesLight);
  const c = new THREE.Color();
  spots.forEach((t, i) => {
    p.set(t.x, groundHeight(t.x, t.z) - 0.1, t.z);
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
