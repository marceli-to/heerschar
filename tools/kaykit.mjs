// Copies the KayKit characters the game uses into public/models/, keeping only the animation
// clips it plays (each pack file ships 76-95 clips, ~4 MB). All characters of a pack share one rig
// and identical clips, so only the first file of each pack keeps them (`ANIM_SOURCE` in
// src/view/models/assets.ts); the others are stripped to meshes. Weapons (.gltf + .bin) are copied as is.
// Usage: node tools/kaykit.mjs <Adventurers repo dir> <Skeletons repo dir>
// (github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0 and -Skeletons-1.0, CC0)
import fs from 'node:fs';
import path from 'node:path';

const [adv, skel] = process.argv.slice(2);
if (!adv || !skel) throw new Error('usage: node tools/kaykit.mjs <adventurers dir> <skeletons dir>');
const OUT = path.resolve('public/models');

const CLIPS = [
  'Idle', 'Walking_A', 'Running_A', 'Hit_A', 'Hit_B', 'Death_A', 'Dodge_Forward', 'Dodge_Backward', 'Cheer',
  '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Idle', 'Block_Attack',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab',
  'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Spellcasting', 'Spellcast_Summon',
  '2H_Ranged_Aiming', '2H_Ranged_Shoot', 'Taunt',
  'Death_C_Skeletons', 'Spawn_Ground_Skeletons', 'Idle_Combat',
];

const CHARACTERS = [
  [adv, 'addons/kaykit_character_pack_adventures/Characters/gltf', ['Knight', 'Mage', 'Rogue_Hooded', 'Barbarian'], 'kaykit'],
  [skel, 'addons/kaykit_character_pack_skeletons/Characters/gltf', ['Skeleton_Minion', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage'], 'kaykit-skeletons'],
];
const WEAPONS = [[skel, 'addons/kaykit_character_pack_skeletons/Assets/gltf', ['Skeleton_Blade', 'Skeleton_Axe', 'Skeleton_Shield_Large_A', 'Skeleton_Shield_Small_A', 'Skeleton_Crossbow', 'Skeleton_Staff'], 'kaykit-skeletons']];

function readGlb(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  const binLen = b.readUInt32LE(20 + jsonLen);
  return { json, bin: b.subarray(28 + jsonLen, 28 + jsonLen + binLen) };
}

function writeGlb(file, json, bin) {
  if (json.animations?.length === 0) delete json.animations;
  let js = Buffer.from(JSON.stringify(json));
  js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4, 0)]);
  const h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546c67, 0);
  h.writeUInt32LE(2, 4);
  h.writeUInt32LE(12 + 8 + js.length + 8 + bn.length, 8);
  const ch = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  fs.writeFileSync(file, Buffer.concat([h, ch(js.length, 0x4e4f534a), js, ch(bn.length, 0x004e4942), bn]));
}

/** Drops unused clips, then every accessor / buffer view nothing refers to any more. */
function trim({ json, bin }, keepClips) {
  json.animations = keepClips ? (json.animations ?? []).filter((a) => CLIPS.includes(a.name)) : [];
  const usedAcc = new Set();
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    Object.values(p.attributes).forEach((a) => usedAcc.add(a));
    if (p.indices !== undefined) usedAcc.add(p.indices);
    for (const t of p.targets ?? []) Object.values(t).forEach((a) => usedAcc.add(a));
  }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) usedAcc.add(s.inverseBindMatrices);
  for (const a of json.animations) for (const s of a.samplers) { usedAcc.add(s.input); usedAcc.add(s.output); }
  const accMap = new Map();
  const accessors = [];
  json.accessors.forEach((a, i) => { if (usedAcc.has(i)) { accMap.set(i, accessors.length); accessors.push(a); } });
  const usedView = new Set(accessors.map((a) => a.bufferView));
  for (const img of json.images ?? []) if (img.bufferView !== undefined) usedView.add(img.bufferView);
  const viewMap = new Map();
  const views = [];
  const parts = [];
  let offset = 0;
  json.bufferViews.forEach((v, i) => {
    if (!usedView.has(i)) return;
    const data = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { parts.push(Buffer.alloc(pad)); offset += pad; }
    viewMap.set(i, views.length);
    views.push({ ...v, byteOffset: offset });
    parts.push(data);
    offset += data.length;
  });
  for (const a of accessors) a.bufferView = viewMap.get(a.bufferView);
  for (const img of json.images ?? []) if (img.bufferView !== undefined) img.bufferView = viewMap.get(img.bufferView);
  const remap = (i) => accMap.get(i);
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = remap(p.attributes[k]);
    if (p.indices !== undefined) p.indices = remap(p.indices);
    for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = remap(t[k]);
  }
  for (const s of json.skins ?? []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = remap(s.inverseBindMatrices);
  for (const a of json.animations) for (const s of a.samplers) { s.input = remap(s.input); s.output = remap(s.output); }
  json.accessors = accessors;
  json.bufferViews = views;
  const out = Buffer.concat(parts);
  json.buffers = [{ byteLength: out.length }];
  return { json, bin: out };
}

for (const [root, dir, names, sub] of CHARACTERS) {
  fs.mkdirSync(path.join(OUT, sub), { recursive: true });
  for (const [i, n] of names.entries()) {
    const src = path.join(root, dir, `${n}.glb`);
    const { json, bin } = trim(readGlb(src), i === 0);
    const dst = path.join(OUT, sub, `${n}.glb`);
    writeGlb(dst, json, bin);
    console.log(`${sub}/${n}.glb`, (fs.statSync(src).size / 1e6).toFixed(2), '->', (fs.statSync(dst).size / 1e6).toFixed(2), 'MB,', json.animations?.length ?? 0, 'clips');
  }
  fs.copyFileSync(path.join(root, 'LICENSE.txt'), path.join(OUT, sub, 'LICENSE.txt'));
}
for (const [root, dir, names, sub] of WEAPONS) {
  for (const n of names) for (const ext of ['gltf', 'bin']) fs.copyFileSync(path.join(root, dir, `${n}.${ext}`), path.join(OUT, sub, `${n}.${ext}`));
  fs.copyFileSync(path.join(root, dir, 'skeleton_texture.png'), path.join(OUT, sub, 'skeleton_texture.png'));
}
