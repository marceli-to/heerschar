// Headless Chrome screencast to MP4. Usage: node tools/record.mjs <url> <out.webm> <seconds> [startDelayMs]
// Frames come from CDP Page.startScreencast with their timestamps; they are resampled to a constant 30 fps WebM.
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
const [url, out, seconds = '12', delay = '3000'] = process.argv.slice(2);
const chrome = spawn(C, ['--headless=new', '--use-angle=metal', '--remote-debugging-port=9335', '--window-size=1280,720', '--user-data-dir=/tmp/heerschar-chrome-rec', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const page = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const frames = [];
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Page.screencastFrame') {
    frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
    send('Page.screencastFrameAck', { sessionId: m.params.sessionId });
  }
});
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(Number(delay));
await send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1 });
await sleep(Number(seconds) * 1000);
await send('Page.stopScreencast');
chrome.kill();
// Resample to a constant 30 fps (nearest earlier frame) and pipe the JPEGs into ffmpeg.
// Uses Playwright's bundled ffmpeg (VP9/WebM only) because the Homebrew one here is broken.
const FF = join(process.env.HOME, 'Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac');
const t0 = frames[0].t;
const total = frames[frames.length - 1].t - t0;
const picked = [];
for (let k = 0, i = 0; k / 30 <= total; k++) {
  while (i + 1 < frames.length && frames[i + 1].t - t0 <= k / 30) i++;
  picked.push(Buffer.from(frames[i].data, 'base64'));
}
const mjpeg = `${out}.mjpeg`;
writeFileSync(mjpeg, Buffer.concat(picked));
execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', `file:${mjpeg}`, '-c:v', 'libvpx-vp9', '-b:v', '3M', '-deadline', 'good', '-cpu-used', '4', out]);
unlinkSync(mjpeg);
console.log(`${frames.length} frames (${picked.length} at 30 fps) -> ${out}`);
process.exit(0);
