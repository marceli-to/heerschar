// GLB read / write and trimming, shared by the asset tools.
import fs from 'node:fs';

export function readGlb(file) {
  const b = fs.readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString());
  const binLen = b.readUInt32LE(20 + jsonLen);
  return { json, bin: b.subarray(28 + jsonLen, 28 + jsonLen + binLen) };
}

export function writeGlb(file, json, bin) {
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

/** Keeps only the clips named in `keepClips` (none when falsy), then drops every accessor / buffer view nothing refers to any more. */
export function trim({ json, bin }, keepClips) {
  json.animations = keepClips ? (json.animations ?? []).filter((a) => keepClips.includes(a.name)) : [];
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
