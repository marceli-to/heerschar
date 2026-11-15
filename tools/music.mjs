// Builds the music in public/audio/music/ from the chosen tracks (see CREDITS.md): loudness
// matched (EBU R128, -18 LUFS for loops, -16 for stings), leading / trailing silence removed so
// loops restart without a gap, AAC 112 kbit/s stereo .m4a.
// Usage: node tools/music.mjs <dir with table.wav greenmarch.wav darkwood.mp3 barrowlands.mp3 victory.ogg defeat.ogg>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [src] = process.argv.slice(2);
if (!src) throw new Error('usage: node tools/music.mjs <sources dir>');
const FFMPEG = fs.existsSync('/opt/homebrew/bin/ffmpeg') ? '/opt/homebrew/bin/ffmpeg' : 'ffmpeg';
const OUT = path.resolve('public/audio/music');
const TRACKS = { table: ['table.wav', -18], greenmarch: ['greenmarch.wav', -18], darkwood: ['darkwood.mp3', -18], barrowlands: ['barrowlands.mp3', -18], victory: ['victory.ogg', -16], defeat: ['defeat.ogg', -16] };

const trim = 'silenceremove=start_periods=1:start_threshold=-60dB,areverse,silenceremove=start_periods=1:start_threshold=-60dB,areverse';
fs.mkdirSync(OUT, { recursive: true });
for (const [name, [file, lufs]] of Object.entries(TRACKS)) {
  const out = path.join(OUT, `${name}.m4a`);
  execFileSync(FFMPEG, ['-y', '-v', 'error', '-i', path.join(src, file), '-vn', '-af', `${trim},loudnorm=I=${lufs}:TP=-1.5:LRA=11`, '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '112k', '-movflags', '+faststart', '-map_metadata', '-1', out]);
  console.log(`${name.padEnd(12)} ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
}
