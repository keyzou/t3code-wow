// Count what real agent messages would look like in game: how many would show an
// empty box, raw markdown, unreadable bold, or be cut short.
//   node tools/preview/corpus.mjs [--root <checkout>] [--cache <file.json>] [--threads 60] [--examples]
//
// Reads the newest threads from the running T3 Code server (as tools/snapshot.mjs
// does), runs each agent message through the formatter of `--root` (default: this
// checkout) and prints counts. `--cache` keeps the messages in a file so two
// checkouts are counted on the same text; they are your threads, so keep that file
// out of any repository. `--examples` prints one offending line per kind of defect.
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
const root = path.resolve(flag('root', path.join(here, '../..')));
const cache = flag('cache');
const maxThreads = Number(flag('threads', 60));
const load = (file) => import(pathToFileURL(path.join(root, file)).href);

async function fetchMessages() {
  if (cache && fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const { Bridge } = await import(pathToFileURL(path.join(here, '../../bridge/src/bridge.js')).href);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 't3corpus-'));
  const bridge = new Bridge({ addonsDir: tmp, config: {}, log: () => {}, stateDir: tmp });
  bridge.t3.start();
  await new Promise((r) => setTimeout(r, 2500));
  const threads = [...bridge.t3.threads.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, maxThreads);
  const out = [];
  for (const t of threads) {
    try {
      await bridge.refreshView(t.id, true);
    } catch {
      continue;
    }
    for (const m of bridge.views.get(t.id)?.projection?.messages || []) {
      if (m.role === 'assistant' && m.text?.trim()) out.push(m.text);
    }
  }
  bridge.t3.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (cache) fs.writeFileSync(cache, JSON.stringify(out));
  return out;
}

const format = await load('bridge/src/format.js');
const texts = await fetchMessages();

// What the player reads, outside code: the game shows code as written.
const CODE_SPAN = /\|cff(?:a8c7fa|9ad8c9)[\s\S]*?\|r/g;
const strip = (s) => s.replace(/\|T[^|]*\|t/g, '').replace(/\|c[0-9a-f]{8}/gi, '').replace(/\|r/g, '').replace(/\|\|/g, '|');
function shown(md) {
  if (format.markdownToBlocks) {
    const blocks = format.blocksToWire(format.markdownToBlocks(md, { maxChars: 4000 }));
    const prose = [];
    const all = [];
    for (const b of blocks) {
      const parts = b[0] === 't' ? b[2].flat() : b[0] === 'r' ? [] : [b[b.length - 1]];
      for (const p of parts) {
        all.push(p);
        if (b[0] !== 'c') prose.push(p.replace(CODE_SPAN, ''));
      }
    }
    return { all: strip(all.join('\n')), prose: strip(prose.join('\n')), raw: JSON.stringify(blocks) };
  }
  const raw = format.markdownToWow(md, { maxChars: 4000 });
  return { all: strip(raw), prose: strip(raw.replace(CODE_SPAN, '')), raw };
}

// Symbols and emoji: the game drew arrows, check marks and "❓" as boxes, so any
// character left in those ranges is counted as one.
const BOX = /[\u2190-\u21ff\u2300-\u23ff\u2500-\u257f\u25a0-\u25ff\u2600-\u27bf\u27f0-\u27ff\u2900-\u297f\u2b00-\u2bff]|[\u{1f000}-\u{1faff}]/u;
const DEFECTS = {
  'an empty box (symbol or emoji the font lacks)': (s) => BOX.exec(s.all),
  'bold that looks like body text': (s) => /\|cffffffff/.exec(s.raw) && !format.markdownToBlocks && /\|cffffffff[^|]*\|r/.exec(s.raw),
  'raw ** or __ left in the text': (s) => /(\*\*|__)\S[^\n]*?\S(\*\*|__)/.exec(s.prose),
  'a backslash escape shown as written': (s) => /\\[_*[\]()#`~>|]/.exec(s.prose),
  'raw link or image syntax': (s) => /\]\([^)\s]+\)|\]\[[^\]]*\]/.exec(s.prose),
  'raw ~~strike~~ markers': (s) => /~~\S[^\n]*?\S~~/.exec(s.prose),
  'a "- [ ]" task box as text': (s) => /^\s*(?:[•-]\s*)?\[[ xX]\]\s/m.exec(s.prose) && !format.markdownToBlocks && /\[[ xX]\]\s[^\n]*/.exec(s.prose),
  'a table drawn as "a · b · c" lines': (s) => !format.markdownToBlocks && /^[^\n]+(?: {2}· {2}[^\n]+){1,}$/m.exec(s.prose),
  'cut short ("open the thread in T3 Code for the rest")': (s) => /open the thread in T3 Code for the rest/.exec(s.all),
};
const USES = {
  'bold': /\*\*\S/,
  'inline code': /`[^`\n]+`/,
  'a list': /^\s*(?:[-*+]|\d+[.)])\s/m,
  'a nested list': /^\s{2,}(?:[-*+]|\d+[.)])\s/m,
  'a heading': /^\s{0,3}#{1,6}\s/m,
  'a code block': /^\s*(?:```|~~~)/m,
  'a table': /^\s*\|?.*\|.*\n\s*\|?\s*:?-+:?\s*\|/m,
  'a rule (---)': /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/m,
  'a link': /\]\(|https?:\/\//,
  'a symbol or emoji': BOX,
};

const count = Object.fromEntries(Object.keys(DEFECTS).map((k) => [k, 0]));
const example = {};
let any = 0;
for (const md of texts) {
  const s = shown(md);
  let hit = false;
  for (const [name, test] of Object.entries(DEFECTS)) {
    const m = test(s);
    if (!m) continue;
    count[name]++;
    hit = true;
    example[name] ??= String(m.input ?? '').slice(Math.max(0, m.index - 30), m.index + 50).replace(/\n/g, ' ⏎ ');
  }
  if (hit) any++;
}
const pct = (n) => `${String(n).padStart(5)}  ${((100 * n) / Math.max(1, texts.length)).toFixed(1).padStart(5)}%`;
const lengths = texts.map((t) => t.length).sort((a, b) => a - b);
const at = (q) => lengths[Math.min(lengths.length - 1, Math.floor(q * lengths.length))] ?? 0;

console.log(`${texts.length} agent messages, formatter from ${root}`);
console.log(`length in characters: median ${at(0.5)}, 90th percentile ${at(0.9)}, 99th ${at(0.99)}, longest ${at(1)}`);
console.log(`over 4,000: ${pct(lengths.filter((n) => n > 4000).length)}   over 8,000: ${pct(lengths.filter((n) => n > 8000).length)}`);
console.log('\nMessages that use');
for (const [name, re] of Object.entries(USES)) console.log(`  ${pct(texts.filter((t) => re.test(t)).length)}  ${name}`);
console.log('\nMessages the player would see with');
for (const [name, n] of Object.entries(count)) console.log(`  ${pct(n)}  ${name}`);
console.log(`  ${pct(any)}  at least one of the above`);
if (args.includes('--examples')) {
  console.log('\nOne example of each');
  for (const [name, text] of Object.entries(example)) console.log(`  ${name}\n      ${text}`);
}
process.exit(0);
