// Renders the title-screen backdrop (`?titleart`, src/view/titleArt.ts) to public/title-bg.jpg.
// Needs the dev server (npm run dev, port 5190). Usage: node tools/titleart.mjs [extra query, e.g. "&dist=12"] [out]
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [extra = '', out = 'public/title-bg.jpg'] = process.argv.slice(2);
const W = 1600, H = 900, SCALE = 1.6; // 2560 × 1440
const chrome = spawn(C, ['--headless=new', '--use-angle=metal', '--remote-debugging-port=9335', `--window-size=${W},${H}`, '--user-data-dir=/tmp/heerschar-chrome-titleart', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const page = (await (await fetch('http://127.0.0.1:9335/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
await send('Page.navigate', { url: `http://localhost:5190/?titleart${extra}` });
for (let i = 0; i < 60; i++) {
  await sleep(250);
  const r = await send('Runtime.evaluate', { expression: 'window.__titleArtReady === true', returnByValue: true });
  if (r.result.result.value) break;
}
await sleep(500);
const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 86 });
writeFileSync(out, Buffer.from(r.result.data, 'base64'));
console.log('wrote', out);
chrome.kill(); process.exit(0);
