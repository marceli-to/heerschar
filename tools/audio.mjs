// Builds the game's sound effects in public/audio/sfx/ from the CC0 source packs (see CREDITS.md).
// Each source is decoded in headless Chrome (ffmpeg is not needed), mixed to mono at 44.1 kHz,
// trimmed of leading / trailing silence, cut to `max` seconds with a short fade, peak-normalised to
// -1 dBFS, then encoded to AAC (.m4a, plays in every browser) with macOS `afconvert`.
// Writes `<name>-<i>.m4a` per variant and `index.json` ({ name: variantCount }) for the game.
// Usage: node tools/audio.mjs <sources dir>   (the dir holds the unzipped packs, named as below)
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [src] = process.argv.slice(2);
if (!src) throw new Error('usage: node tools/audio.mjs <sources dir>');
const OUT = path.resolve('public/audio/sfx');

const range = (pattern, from, to) => Array.from({ length: to - from + 1 }, (_, i) => pattern.replace('#', String(from + i)));
const pad3 = (pattern, from, to) => range(pattern, from, to).map((f) => f.replace(/(\d+)(\.\w+)$/, (_, n, ext) => n.padStart(3, '0') + ext));
const IMPACT = 'impact-sounds/Audio/';
const RPG = 'rpg-audio/Audio/';
const UI = 'interface-sounds/Audio/';
const MAGIC = 'combat150/04_magic_spells/';
const BOOM = 'combat150/03_explosions_destruction/';

/** name → source files (variants) and the longest kept length in seconds. */
const SOUNDS = {
  // Melee and missiles landing.
  hitBlade: { files: pad3(IMPACT + 'impactPlate_medium_#.ogg', 0, 4), max: 0.5 },
  hitHeavy: { files: pad3(IMPACT + 'impactPlate_heavy_#.ogg', 0, 4), max: 0.7 },
  hitPunch: { files: pad3(IMPACT + 'impactPunch_heavy_#.ogg', 0, 4), max: 0.6 },
  hitArrow: { files: pad3(IMPACT + 'impactWood_light_#.ogg', 0, 4), max: 0.4 },
  hitBone: { files: range('rpg80/wood_0#.ogg', 1, 5), max: 0.5 },
  hitShield: { files: pad3(IMPACT + 'impactGlass_light_#.ogg', 0, 4), max: 0.5 },
  hitLight: { files: range(MAGIC + 'Wind Spell Impact #_s07.wav', 1, 5), max: 0.8 },
  hitFire: { files: range(MAGIC + 'Fire Spell Impact #_s06.wav', 1, 5), max: 0.9 },
  hitFrost: { files: range(MAGIC + 'Ice Spell Impact #_s06.wav', 1, 5), max: 0.9 },
  hitHex: { files: range(MAGIC + 'Plant Spell Impact #_s07.wav', 1, 5), max: 0.9 },
  // Swings and shots.
  swing: { files: range('swishes/swishes/swish-#.wav', 1, 8), max: 0.45 },
  swingHeavy: { files: range('swishes/swishes/swish-#.wav', 9, 13), max: 0.6 },
  crossbow: { files: [RPG + 'metalLatch.ogg', RPG + 'metalClick.ogg'], max: 0.35 },
  castFire: { files: range('rpg80/spell_fire_0#.ogg', 1, 7), max: 1.0 },
  castLight: { files: range(MAGIC + 'Healing Spell Impact #_s08.wav', 1, 5), max: 0.9 },
  castHex: { files: ['rpg80/spell_01.ogg', 'rpg80/spell_02.ogg'], max: 1.0 },
  // Areas.
  explosion: { files: range(BOOM + 'explosion_crunch_00#_48kHz_16bit_*', 0, 4), max: 1.4 },
  slam: { files: [BOOM + 'BlastImpact_01_s01.wav', BOOM + 'BlastImpact_02_s01.wav', BOOM + 'BlastImpact_03_s01.wav', BOOM + 'low_frequency_explosion_001_48kHz_16bit_1s_a63b8c61_s04.wav'], max: 1.2 },
  iceBlast: { files: ['icespells/coldsnap.wav', 'icespells/ice.wav', 'single/freeze.wav'], max: 1.4 },
  healCircle: { files: range('cure/Cure#.wav', 1, 8), max: 1.6 },
  poison: { files: range('rpg80/creature_slime_0#.ogg', 1, 4), max: 0.9 },
  // Statuses and support.
  freeze: { files: pad3(IMPACT + 'impactGlass_medium_#.ogg', 0, 4), max: 0.6 },
  heal: { files: range(MAGIC + 'Healing Spell Impact #_s08.wav', 6, 15), max: 0.9 },
  ward: { files: ['single/health_restore.wav'], max: 1.4 },
  taunt: { files: pad3(IMPACT + 'impactMetal_heavy_#.ogg', 0, 4), max: 0.8 },
  rally: { files: ['sfx100/gong_01.ogg', 'sfx100/gong_02.ogg'], max: 2.0 },
  raise: { files: range(MAGIC + 'Earth Spell Impact #_s07.wav', 1, 5), max: 1.2 },
  howl: { files: ['creature80/howl.ogg'], max: 2.5 },
  bark: { files: ['creature80/barking_01.ogg', 'creature80/barking_02.ogg'], max: 0.8 },
  dodge: { files: range(RPG + 'cloth#.ogg', 1, 4), max: 0.5 },
  // Falls.
  fall: { files: pad3(IMPACT + 'impactSoft_heavy_#.ogg', 0, 4), max: 0.7 },
  clatter: { files: range('rpg80/chain_0#.ogg', 1, 3), max: 0.8 },
  bones: { files: range('sfx100/wooden_0#.ogg', 1, 3), max: 0.8 },
  whimper: { files: range('creature80/hurt_0#.ogg', 1, 5), max: 0.7 },
  // Battle flow and targeting.
  drum: { files: pad3(IMPACT + 'impactWood_heavy_#.ogg', 0, 4), max: 0.7 },
  bell: { files: pad3(IMPACT + 'impactBell_heavy_#.ogg', 0, 4), max: 1.6 },
  lock: { files: [UI + 'tick_001.ogg', UI + 'tick_002.ogg'], max: 0.2 },
  mark: { files: [RPG + 'clothBelt.ogg', RPG + 'clothBelt2.ogg'], max: 0.5 },
  // Interface.
  uiClick: { files: pad3(UI + 'click_#.ogg', 1, 5), max: 0.2 },
  uiPage: { files: range(RPG + 'bookFlip#.ogg', 1, 3), max: 0.6 },
  uiCoins: { files: [RPG + 'handleCoins.ogg', RPG + 'handleCoins2.ogg'], max: 0.9 },
  uiSeal: { files: [RPG + 'bookClose.ogg'], max: 0.5 },
  uiBack: { files: range(RPG + 'bookPlace#.ogg', 1, 3), max: 0.4 },
};

/** Resolves a `*` at the end of a file pattern against the directory. */
function resolve(rel) {
  if (!rel.endsWith('*')) return path.join(src, rel);
  const dir = path.join(src, path.dirname(rel));
  const prefix = path.basename(rel).slice(0, -1);
  const hit = fs.readdirSync(dir).find((f) => f.startsWith(prefix));
  if (!hit) throw new Error('no match for ' + rel);
  return path.join(dir, hit);
}

// --- headless Chrome as the decoder ---
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = spawn(C, ['--headless=new', '--remote-debugging-port=9335', '--user-data-dir=/tmp/heerschar-chrome-audio', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const page = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

const PROCESS = `async (b64, max) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const buf = await ctx.decodeAudioData(bytes.buffer);
  const n = buf.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) mono[i] += d[i] / buf.numberOfChannels; }
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(mono[i]));
  const gate = peak * 0.006; // about -44 dB under the peak
  let start = 0; while (start < n && Math.abs(mono[start]) < gate) start++;
  start = Math.max(0, start - 64);
  let end = n; while (end > start && Math.abs(mono[end - 1]) < gate * 0.5) end--;
  end = Math.min(end, start + Math.round(max * 44100));
  const out = mono.slice(start, end);
  const fadeIn = Math.min(32, out.length), fadeOut = Math.min(Math.round(0.06 * 44100), out.length);
  for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) out[out.length - 1 - i] *= i / fadeOut;
  const gain = peak > 0 ? 0.89 / peak : 1;
  const pcm = new Int16Array(out.length);
  for (let i = 0; i < out.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(out[i] * gain * 32767)));
  let s = ''; const u8 = new Uint8Array(pcm.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return JSON.stringify({ pcm: btoa(s), seconds: out.length / 44100, source: n / buf.sampleRate });
}`;

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(44100, 24);
  h.writeUInt32LE(88200, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heerschar-audio-'));
const index = {};
let bytes = 0;
for (const [name, { files, max }] of Object.entries(SOUNDS)) {
  const lens = [];
  for (const [i, rel] of files.entries()) {
    const file = resolve(rel);
    const b64 = fs.readFileSync(file).toString('base64');
    const r = await send('Runtime.evaluate', { expression: `(${PROCESS})(${JSON.stringify(b64)}, ${max})`, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(`${rel}: ${r.result.exceptionDetails.exception?.description}`);
    const { pcm, seconds, source } = JSON.parse(r.result.result.value);
    const w = path.join(tmp, `${name}-${i}.wav`);
    fs.writeFileSync(w, wav(Buffer.from(pcm, 'base64')));
    const out = path.join(OUT, `${name}-${i}.m4a`);
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', w, out]);
    bytes += fs.statSync(out).size;
    lens.push(`${seconds.toFixed(2)}/${source.toFixed(2)}`);
  }
  index[name] = files.length;
  console.log(`${name.padEnd(12)} ${files.length} × ${lens.join(' ')} s`);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${Object.keys(index).length} sounds, ${(bytes / 1024).toFixed(0)} KB`);
ws.close();
chrome.kill();
