// Draw how the addon would show a conversation, without the game: markdown in, PNG out.
//   node tools/preview/render.mjs <fixture.md> [--out <dir>] [--root <checkout>]
//        [--sidebar hidden] [--size small|medium|large|xlarge] [--scroll opened|top|bottom|last-agent|<units>]
//        [--captions off] [--name <file stem>]
//
// A fixture is one conversation. A line "=== user ===" or "=== agent ===" starts a
// message; a file without one is a single agent message.
//
// The text goes through the bridge's own formatter and the addon's own Lua (loaded
// against tools/wowstub.lua), so the rows, their text and every size are the real
// ones. The browser stands in for the game's text engine: it has a different font,
// so line breaks land a word or two away from the game's. `--root` points both steps
// at another checkout, to draw an older version with the same tool.
//
// Needs lua5.1 and chromium on the PATH. Nothing here is used by the addon or bridge.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const fixture = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
if (!fixture) {
  console.error('usage: node tools/preview/render.mjs <fixture.md> [--out dir] [--root checkout] [--sidebar hidden] [--size medium] [--scroll last-agent]');
  process.exit(2);
}
const root = path.resolve(flag('root', path.join(here, '../..')));
const outDir = path.resolve(flag('out', path.join(os.tmpdir(), 't3code-wow-preview')));
const name = flag('name', path.basename(fixture).replace(/\.md$/, ''));
const sidebar = flag('sidebar', 'shown');
const captions = flag('captions', 'on') !== 'off';
// The window's units per screen pixel in the screenshot the font was calibrated on.
const SCALE = Number(flag('scale', 1.43));
// The scroll box is this wide with the thread list shown, and the list is 304 wide.
const LIST_WIDTH = sidebar === 'hidden' ? 890 : 586;
const VIEWPORT = 400;
// Chosen so the reference message breaks its lines where the game did: Noto Sans with
// 0.2 units of letter spacing at size 12 matched an in-game screenshot (WoW: Forever,
// 0.4.0 addon) on every line break but one. `--track` is that spacing, at size 12.
const FONT = flag('font', '"Noto Sans", sans-serif');
const TRACK = Number(flag('track', 0.2));

function messages(text) {
  const out = [];
  let current = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const m = /^=== (user|agent) ===\s*$/.exec(line);
    if (m) {
      current = { role: m[1] === 'user' ? 'user' : 'assistant', lines: [] };
      out.push(current);
    } else {
      if (!current) {
        current = { role: 'assistant', lines: [] };
        out.push(current);
      }
      current.lines.push(line);
    }
  }
  const start = Date.UTC(2026, 10, 11, 21, 0, 0);
  return out.map((m, i) => ({ role: m.role, text: m.lines.join('\n').trim(), createdAt: new Date(start + i * 180000).toISOString() }));
}

const load = (file) => import(pathToFileURL(path.join(root, file)).href);
const bridge = await load('bridge/src/bridge.js');
const format = await load('bridge/src/format.js');
const { luaAssignment } = await load('bridge/src/luaser.js');

const source = messages(fs.readFileSync(fixture, 'utf8'));
let msgs;
if (bridge.viewMessages) {
  msgs = bridge.viewMessages(source, { blocks: true, mono: true }).out;
} else {
  // A checkout from before blocks: what its bridge put in a snapshot.
  msgs = source.map((m, i) => ({
    r: m.role === 'user' ? 'u' : 'a',
    t: format.markdownToWow(m.text, { maxChars: m.role === 'assistant' ? 4000 : 1500 }),
    at: Math.floor(Date.parse(m.createdAt) / 1000),
    n: i + 1,
  }));
}

const now = Math.floor(Date.UTC(2026, 10, 11, 22, 0, 0) / 1000);
const threads = ['Find codebase architecture', name, 'Summarize a video', 'Sync fork with upstream', 'Reduce awkward quest hand-ins', 'Measure screen-capture cost'];
const snapshot = {
  v: 1, gen: 1000, now, nextSig: 2, ack: { ui: 'preview', seq: 1 }, key: 'ab'.repeat(64),
  bridge: { version: 'preview', t3: 'connected', server: 'preview', host: 'preview', slots: 1200, snz: [] },
  projects: [{ id: 'demo', name: 'demo', act: true }],
  threads: threads.map((title, i) => ({ id: i === 1 ? 'preview' : 'other' + i, title, s: 'open', p: 'demo', m: 'claude-opus-5-5', mi: 'claudeAgent', re: 'high', st: now - 60 })),
  usage: [], models: { g: [], h: 'preview' }, results: {},
  view: { id: 'preview', msgs },
};

fs.mkdirSync(outDir, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 't3preview-'));
const snapPath = path.join(work, 'snapshot.lua');
const dumpPath = path.join(work, 'rows.json');
fs.writeFileSync(snapPath, luaAssignment('T3Code_Inbox', snapshot));
// The stub and the addon come from `root`; the dump script is this checkout's.
const env = { ...process.env, T3CODE_TEXT_SIZE: flag('size', '') };
execFileSync('lua5.1', [path.join(here, 'dump.lua'), 'addon/T3Code', snapPath, 'preview', dumpPath, String(LIST_WIDTH)], { cwd: root, env, stdio: ['ignore', 'ignore', 'inherit'] });
const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));

const css = fs.readFileSync(path.join(here, 'page.css'), 'utf8');
const js = fs.readFileSync(path.join(here, 'page.js'), 'utf8');
const results = {};
for (const part of ['window', 'strip']) {
  const options = { part, sidebar, captions, title: name, scroll: flag('scroll', 'opened'), viewport: VIEWPORT, font: FONT, track: TRACK };
  const html = `<!doctype html><meta charset="utf-8"><style>${css}</style><p class="caption" id="caption"></p><div id="root"></div>
<script>window.PREVIEW = ${JSON.stringify({ dump, options, threads }).replace(/</g, '\\u003c')};</script><script>${js}</script>`;
  const htmlPath = path.join(work, part + '.html');
  fs.writeFileSync(htmlPath, html);
  const chrome = (extra) => execFileSync('chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', ...extra, pathToFileURL(htmlPath).href], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).toString();
  const dom = chrome(['--window-size=1400,900', '--dump-dom']);
  const size = /data-size="(\d+)x(\d+)"/.exec(dom);
  if (!size) throw new Error('the page did not finish laying out: ' + htmlPath);
  const read = (key) => JSON.parse((new RegExp(`data-${key}="([^"]*)"`).exec(dom) || [, 'null'])[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const png = path.join(outDir, `${name}.${part}.png`);
  chrome([`--window-size=${size[1]},${size[2]}`, `--force-device-scale-factor=${SCALE}`, `--screenshot=${png}`]);
  results[part] = { png, ...read('info') };
  if (part === 'window') results.lines = read('lines');
}
fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(results, null, 2));
if (!args.includes('--keep')) fs.rmSync(work, { recursive: true, force: true });
console.log(`${name}: ${results.window.png} (one notch = ${results.window.notch} units), ${results.strip.png} (${results.strip.screens} screens)`);
