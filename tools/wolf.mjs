// Copies the Quaternius Wolf (CC0, poly.pizza/m/P1gU3Qkr9r) into public/models/quaternius/,
// keeping one copy of each clip the game plays (the file ships every clip twice).
// Usage: node tools/wolf.mjs <downloaded wolf .glb>
import fs from 'node:fs';
import path from 'node:path';
import { readGlb, trim, writeGlb } from './glb.mjs';

const [src] = process.argv.slice(2);
if (!src) throw new Error('usage: node tools/wolf.mjs <wolf.glb>');
const CLIPS = ['Idle', 'Walk', 'Gallop', 'Attack', 'Idle_HitReact_Left', 'Idle_HitReact_Right', 'Death'];
const OUT = path.resolve('public/models/quaternius');
fs.mkdirSync(OUT, { recursive: true });
const dst = path.join(OUT, 'Wolf.glb');
const { json, bin } = trim(readGlb(src), CLIPS);
writeGlb(dst, json, bin);
console.log('quaternius/Wolf.glb', (fs.statSync(src).size / 1e6).toFixed(2), '->', (fs.statSync(dst).size / 1e6).toFixed(2), 'MB,', json.animations.length, 'clips');
fs.writeFileSync(path.join(OUT, 'LICENSE.txt'), 'Wolf by Quaternius (quaternius.com), via poly.pizza/m/P1gU3Qkr9r.\nLicence: CC0 1.0 Universal (public domain), https://creativecommons.org/publicdomain/zero/1.0/\n');
