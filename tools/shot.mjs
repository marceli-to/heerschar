// Headless Chrome screenshots. Usage: node tools/shot.mjs <url> <out.png> [actionsJson]
// actions: [{"eval":"js"},{"wait":ms},{"shot":"file.png"},{"print":true},{"mouse":[x,y]} (real move = CSS hover),{"click":[x,y]} (trusted click, unlocks audio),{"hover":"css selector"} (moves to its centre)]. Use ?debug for window.__game, ?bot to autoplay.
const C = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const [url, out, actions = '[]'] = process.argv.slice(2);
const chrome = spawn(C, ['--headless=new', '--use-angle=metal', '--remote-debugging-port=9334', '--window-size=1280,800', '--user-data-dir=/tmp/heerschar-chrome-shot', 'about:blank']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);
const page = (await (await fetch('http://127.0.0.1:9334/json')).json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } if (m.method === 'Runtime.exceptionThrown') logs.push((m.params.exceptionDetails.exception?.description ?? "").slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push(m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(2500);
for (const a of JSON.parse(actions)) {
  if (a.eval) { const r = await send('Runtime.evaluate', { expression: a.eval, returnByValue: true, awaitPromise: true }); if (a.print) console.log(JSON.stringify(r.result.result.value)); }
  let at = a.mouse;
  if (a.hover) { const r = await send('Runtime.evaluate', { expression: `(() => { const b = document.querySelector(${JSON.stringify(a.hover)})?.getBoundingClientRect(); return b ? [b.x + b.width / 2, b.y + b.height / 2] : null; })()`, returnByValue: true }); at = r.result.result.value; if (!at) logs.push(`hover: no ${a.hover}`); }
  if (at) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: at[0], y: at[1] });
  if (a.click) for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: a.click[0], y: a.click[1], button: 'left', clickCount: 1 });
  if (a.wait) await sleep(a.wait);
  if (a.shot) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(a.shot, Buffer.from(r.result.data, 'base64')); }
}
const r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(r.result.data, 'base64'));
if (logs.length) console.log('PAGE ERRORS:', logs.join('\n'));
chrome.kill(); process.exit(0);
