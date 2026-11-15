// Packs the KayKit scenery props the arenas use into one GLB per pack (texture embedded), each prop
// a named root node. Source files are .gltf + .bin + one shared swatch texture per pack.
// Usage: node tools/scenery.mjs <Medieval Hexagon repo dir> <Halloween Bits repo dir>
// (github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0 and KayKit-Halloween-Bits-1.0, CC0)
import fs from 'node:fs';
import path from 'node:path';
import { writeGlb } from './glb.mjs';

const [hex, hal] = process.argv.slice(2);
if (!hex || !hal) throw new Error('usage: node tools/scenery.mjs <medieval hexagon dir> <halloween bits dir>');
const OUT = path.resolve('public/models/scenery');

const HEX = 'addons/kaykit_medieval_hexagon_pack/Assets/gltf';
const PACKS = [
  {
    out: 'medieval.glb',
    root: hex,
    texture: path.join(hex, 'addons/kaykit_medieval_hexagon_pack/Textures/hexagons_medieval.png'),
    license: path.join(hex, 'LICENSE.txt'),
    files: [
      ...['tree_single_A', 'tree_single_B', 'tree_single_A_cut', 'tree_single_B_cut', 'trees_A_medium', 'trees_B_medium', 'trees_B_large',
        'rock_single_A', 'rock_single_C', 'rock_single_E', 'cloud_big', 'cloud_small'].map((n) => `${HEX}/decoration/nature/${n}.gltf`),
      ...['barrel', 'crate_A_big', 'sack', 'resource_lumber', 'flag_red', 'tent', 'weaponrack'].map((n) => `${HEX}/decoration/props/${n}.gltf`),
      ...['building_windmill_red', 'building_home_A_red', 'building_home_B_red', 'building_well_red'].map((n) => `${HEX}/buildings/red/${n}.gltf`),
      ...['building_grain'].map((n) => `${HEX}/buildings/neutral/${n}.gltf`),
      ...['fence_wood_straight', 'fence_stone_straight'].map((n) => `${HEX}/decoration/props/${n}.gltf`),
    ],
  },
  {
    out: 'halloween.glb',
    root: hal,
    texture: path.join(hal, 'addons/kaykit_halloween_bits/Assets/gltf/halloweenbits_texture.png'),
    license: path.join(hal, 'LICENSE.txt'),
    files: [
      'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_orange_small', 'tree_dead_large', 'tree_dead_medium', 'tree_dead_small',
      'grave_A', 'grave_A_destroyed', 'grave_B', 'gravestone', 'gravemarker_A', 'gravemarker_B', 'fence', 'fence_broken', 'fence_pillar',
      'fence_pillar_broken', 'arch_gate', 'crypt', 'pillar', 'lantern_standing', 'post_lantern', 'skull', 'bone_A', 'bone_C', 'ribcage', 'shrine_candles',
    ].map((n) => `addons/kaykit_halloween_bits/Assets/gltf/${n}.gltf`),
  },
];

/** Finds a file under `root` by its path tail when the exact folder differs (packs sort props into sub-folders). */
function locate(root, rel) {
  const exact = path.join(root, rel);
  if (fs.existsSync(exact)) return exact;
  const name = path.basename(rel);
  const stack = [path.join(root, path.dirname(rel).split('/').slice(0, 4).join('/'))];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name === name) return p;
    }
  }
  throw new Error(`not found: ${rel}`);
}

fs.mkdirSync(OUT, { recursive: true });
for (const pack of PACKS) {
  const json = { asset: { version: '2.0', generator: 'heerschar tools/scenery.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], accessors: [], bufferViews: [], buffers: [], materials: [], textures: [], images: [], samplers: [] };
  const parts = [];
  let offset = 0;
  const push = (buf) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
    const at = offset;
    parts.push(buf);
    offset += buf.length;
    return at;
  };
  // One shared material + embedded texture per pack.
  const png = fs.readFileSync(pack.texture);
  json.bufferViews.push({ buffer: 0, byteOffset: push(png), byteLength: png.length });
  json.images.push({ bufferView: 0, mimeType: 'image/png', name: path.basename(pack.texture) });
  json.samplers.push({ magFilter: 9729, minFilter: 9987 });
  json.textures.push({ source: 0, sampler: 0 });
  json.materials.push({ name: 'scenery', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1 } });

  for (const rel of pack.files) {
    const file = locate(pack.root, rel);
    const src = JSON.parse(fs.readFileSync(file, 'utf8'));
    const bin = fs.readFileSync(path.join(path.dirname(file), src.buffers[0].uri));
    const viewBase = json.bufferViews.length;
    for (const v of src.bufferViews) {
      const data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
      const { byteOffset: _o, buffer: _b, ...rest } = v;
      json.bufferViews.push({ ...rest, buffer: 0, byteOffset: push(data) });
    }
    const accBase = json.accessors.length;
    for (const a of src.accessors) json.accessors.push({ ...a, bufferView: a.bufferView + viewBase });
    const meshBase = json.meshes.length;
    for (const m of src.meshes) {
      json.meshes.push({
        ...m,
        primitives: m.primitives.map((p) => ({
          attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, v + accBase])),
          ...(p.indices !== undefined ? { indices: p.indices + accBase } : {}),
          material: 0,
        })),
      });
    }
    const nodeBase = json.nodes.length;
    for (const n of src.nodes) {
      const node = { ...n };
      if (n.mesh !== undefined) node.mesh = n.mesh + meshBase;
      if (n.children) node.children = n.children.map((c) => c + nodeBase);
      json.nodes.push(node);
    }
    // Wrap the file's scene roots in one node named after the file.
    const roots = src.scenes[src.scene ?? 0].nodes.map((r) => r + nodeBase);
    json.nodes.push({ name: path.basename(file, '.gltf'), children: roots });
    json.scenes[0].nodes.push(json.nodes.length - 1);
  }
  const bin = Buffer.concat(parts);
  json.buffers.push({ byteLength: bin.length });
  writeGlb(path.join(OUT, pack.out), json, bin);
  console.log(pack.out, (bin.length / 1024).toFixed(0), 'KB,', pack.files.length, 'props');
}
fs.copyFileSync(PACKS[0].license, path.join(OUT, 'LICENSE-medieval-hexagon.txt'));
fs.copyFileSync(PACKS[1].license, path.join(OUT, 'LICENSE-halloween-bits.txt'));
