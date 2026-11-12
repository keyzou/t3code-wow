// Markdown -> blocks the addon draws one row each, markdown -> one WoW font string
// (for an addon that predates blocks, plans and notes), and markdown -> plain text
// for speech.
//
// A font string has one font and can only change colour inside it, so emphasis is
// colour: bold is gold, italic a paler gold, code is mint, links are blue, struck
// text is grey. Colour
// spans are never nested, because what "|r" restores inside another span is the
// client's business.

const GOLD = 'ffffd100';
const WHITE = 'ffffffff';
const CODE = 'ff9ad8c9';
const DIM = 'ff9d9d9d';
const STRUCK = 'ff858585';
const KEY = 'ffcdea70'; // bold code: between the gold of bold and the mint of code
const LINK = 'ff5fb0ff';
const SOFT = 'ffffeeb0';

const color = (hex, s) => `|c${hex}${s}|r`;

// Characters agents use often that the game's fonts don't have (they show as
// empty boxes), with plain stand-ins. Arrows, check marks and "❓" were seen as boxes
// in game; punctuation such as — … • · “ ” and math such as ≥ ± draw fine.
const GLYPHS = {
  '→': '->', '⟶': '->', '➜': '->', '➔': '->', '➡': '->', '➝': '->', '➞': '->', '⇢': '->',
  '←': '<-', '⟵': '<-', '⬅': '<-',
  '↔': '<->', '⟷': '<->',
  '⇒': '=>', '⟹': '=>', '⇐': '<=', '⇔': '<=>',
  '↑': '^', '⬆': '^', '↓': 'v', '⬇': 'v', '↳': '->', '↪': '->', '↵': 'Enter', '⏎': 'Enter',
  '✓': 'OK', '✔': 'OK', '✅': 'OK', '☑': '[x]', '✗': 'X', '✘': 'X', '❌': 'X', '✖': 'x', '☒': '[x]', '☐': '[ ]',
  '⚠': '!', '❗': '!', '❕': '!', '‼': '!!', '⁉': '!?', '❓': '?', '❔': '?',
  '★': '*', '☆': '*', '⭐': '*', '➕': '+', '➖': '-', '−': '-',
  '▶': '>', '►': '>', '▸': '>', '▹': '>', '◀': '<', '◄': '<', '◂': '<',
  '■': '•', '▪': '•', '●': '•', '◆': '•', '□': 'o', '▫': 'o', '○': 'o', '◇': 'o',
  '⌘': 'Cmd', '⌥': 'Opt', '⌃': 'Ctrl', '⇧': 'Shift',
  '─': '-', '━': '-', '═': '=', '│': '|', '┃': '|', '║': '|',
  '├': '|-', '┣': '|-', '└': '`-', '┗': '`-', '╰': '`-', '┌': ',-', '┏': ',-', '╭': ',-',
  '┐': '-.', '┓': '-.', '╮': '-.', '┘': "-'", '┛': "-'", '╯': "-'", '┤': '-|', '┫': '-|',
  '┬': '-', '┳': '-', '┴': '-', '┻': '-', '┼': '+', '╋': '+',
};
// Everything in the symbol and emoji ranges: a listed stand-in, or nothing. Variation
// selectors, joiners, keycap marks and skin tones only ever modify one of those.
const GLYPH_RE = /[\u2212\u2190-\u21ff\u2300-\u23ff\u2500-\u257f\u25a0-\u25ff\u2600-\u27bf\u27f0-\u27ff\u2900-\u297f\u2b00-\u2bff\u203c\u2049\ufe0e\ufe0f\u200d\u20e3]|[\u{1f000}-\u{1faff}]|[\u{e0020}-\u{e007f}]/gu;

// What only modifies the symbol before it: variation selectors, joiners, the keycap
// mark, skin tones, flag tags. Never drawn, never missed.
const MODIFIER_RE = /[\ufe0e\ufe0f\u200d\u20e3]|[\u{1f3fb}-\u{1f3ff}]|[\u{e0020}-\u{e007f}]/u;

// Status marks agents lead a line with, drawn with the game's own small pictures
// where text allows them (anywhere but code). The names are for tools/preview.
const ICON_FILES = {
  yes: 'Interface\\RaidFrame\\ReadyCheck-Ready',
  no: 'Interface\\RaidFrame\\ReadyCheck-NotReady',
  ask: 'Interface\\RaidFrame\\ReadyCheck-Waiting',
  warn: 'Interface\\DialogFrame\\UI-Dialog-Icon-AlertNew',
};
const ICONS = {
  '✓': 'yes', '✔': 'yes', '✅': 'yes', '✗': 'no', '✘': 'no', '❌': 'no', '✖': 'no', '❎': 'no',
  '❓': 'ask', '❔': 'ask', '⚠': 'warn', '❗': 'warn', '❕': 'warn',
};
// Coloured circles and squares say something by their colour, so they become a
// bullet in that colour. The block arrows lead a line the way a list marker does.
const DOT = { red: 'ffe8352e', orange: 'ffff8c1a', yellow: 'ffffe14d', green: 'ff3fdc3f', blue: 'ff4d9dff', purple: 'ffb070ff', brown: 'ffa0703c', black: 'ff707070', white: WHITE };
const MARKS = {
  '🔴': [DOT.red, '•'], '🟠': [DOT.orange, '•'], '🟡': [DOT.yellow, '•'], '🟢': [DOT.green, '•'], '🔵': [DOT.blue, '•'],
  '🟣': [DOT.purple, '•'], '🟤': [DOT.brown, '•'], '⚫': [DOT.black, '•'], '⚪': [DOT.white, '•'],
  '🟥': [DOT.red, '•'], '🟧': [DOT.orange, '•'], '🟨': [DOT.yellow, '•'], '🟩': [DOT.green, '•'], '🟦': [DOT.blue, '•'],
  '🟪': [DOT.purple, '•'], '🟫': [DOT.brown, '•'], '⬛': [DOT.black, '•'], '⬜': [DOT.white, '•'],
  '➡': [GOLD, '->'], '⬅': [GOLD, '<-'], '⬆': [GOLD, '^'], '⬇': [GOLD, 'v'],
};
// Emoji that stand for a word in a sentence about work.
const WORDS = {
  '👍': '+1', '👎': '-1', '🔁': '(repeat)', '🔄': '(repeat)', '⏳': '(waiting)', '⌛': '(waiting)', '🔒': '(locked)', '🔓': '(unlocked)',
  '🚧': '(in progress)', '⛔': '(blocked)', '🚫': '(blocked)', '🛑': '(stop)', '💡': '(idea)', '🐛': '(bug)', '📌': '(pinned)', '🆕': '(new)',
};
// What the fixed-width font the addon ships for code blocks can draw itself.
const MONO_HAS = /[\u2212\u2190-\u2195\u21d0-\u21d4\u2500-\u25ff\u27f5\u27f6]/;
// Symbols with an everyday spelling in plain text: arrows, box drawing, shapes, minus.
const TYPED_AS = /[\u2212\u2190-\u21ff\u2500-\u257f\u25a0-\u25ff\u2794-\u27be\u27f0-\u27ff\u2900-\u297f\u2b05-\u2b07]/;
const DROPPED = '\u0001';
const ICON_MARK = '\u0002';
const COLOR_MARK = '\u0003';
const RUN_MARK = '\u0004';
const UNKNOWN = `${COLOR_MARK}${DIM}${COLOR_MARK}[emoji]${COLOR_MARK}`;

// Swaps in stand-ins for characters the game can't draw. A symbol with no stand-in
// is dropped, and takes the space after it along when it started a line or followed
// a space ("🚀 Ship" -> "Ship").
//   mono: the text is for the addon's fixed-width font, which has arrows and box
//         drawing of its own.
//   code: the text is code, where a changed character is different code. Arrows, box
//         drawing, shapes and the minus sign keep the stand-in they are usually typed
//         as ("->"). Any other symbol is written as its escape: "\u{2753}", not "?".
export function plainGlyphs(s, { mono = false, code = false } = {}) {
  const out = String(s ?? '').replace(GLYPH_RE, (c) => {
    if (MODIFIER_RE.test(c)) return '';
    if (mono && MONO_HAS.test(c)) return c;
    if (code) return (TYPED_AS.test(c) && GLYPHS[c]) || `\\u{${c.codePointAt(0).toString(16)}}`;
    return GLYPHS[c] ?? DROPPED;
  });
  if (!out.includes(DROPPED)) return out;
  return out.replace(/(^|[ \n])\u0001+ /g, '$1').replace(/ \u0001+(?=$|\n)/g, '').replace(/\u0001/g, '');
}

// WoW treats "|" as an escape character; double it so text can't inject markup.
// Also swaps in stand-ins for characters the game can't draw (see plainGlyphs).
export function escapeWow(s, opts) {
  return plainGlyphs(String(s ?? '').replace(/[\u0000-\u0004]/g, ''), opts).replace(/\|/g, '||');
}

// Prose is escaped in three steps. markProse swaps in what a symbol becomes: beyond
// the stand-ins of plainGlyphs, status marks become pictures ("|T<file>:0|t" is a
// picture as tall as the line), coloured dots keep their colour, and a few emoji
// become the word they stand for. An emoji with no stand-in is left as a mark.
function markProse(s) {
  return String(s ?? '').replace(/[\u0000-\u0004]/g, '').replace(GLYPH_RE, (c) => {
    if (MODIFIER_RE.test(c)) return '';
    if (ICONS[c]) return ICON_MARK + ICONS[c] + ICON_MARK;
    if (MARKS[c]) return COLOR_MARK + MARKS[c][0] + COLOR_MARK + MARKS[c][1] + COLOR_MARK;
    return WORDS[c] ?? GLYPHS[c] ?? DROPPED;
  });
}

// settleProse decides what those marks become, from the marked text of every run of
// a block, because a line of the block may span several runs ("Pick **🍎** or
// **🍌**."). An emoji that leads or ends a line is decoration, and is dropped with
// the space beside it. Inside a sentence it may carry the meaning, so every one on
// that line is shown as "[emoji]"; so are they all when the block says nothing else.
function settleProse(pieces) {
  const joined = pieces.join(RUN_MARK);
  if (!joined.includes(DROPPED)) return pieces;
  const lines = joined.split('\n');
  const bare = lines.every((line) => !line.replace(/[ \u0001\u0004]/g, ''));
  const runMarks = (m) => (m.includes(DROPPED) ? m.replace(/[^\u0004]/g, '') : m);
  return lines.map((line) => {
    if (bare || /[^ \u0001] *\u0001[ \u0001]*[^ \u0001]/.test(line.replace(/\u0004/g, ''))) return line.replace(/\u0001/g, UNKNOWN);
    return line.replace(/^[ \u0001\u0004]*/, runMarks).replace(/[ \u0001\u0004]*$/, runMarks);
  }).join('\n').split(RUN_MARK);
}

// Settled prose as pieces of escaped text, some with a colour of their own.
function proseParts(settled) {
  const text = settled.replace(/\|/g, '||').replace(/\u0002(\w+)\u0002/g, (_, name) => `|T${ICON_FILES[name]}:0|t`);
  const parts = [];
  const re = /\u0003([0-9a-f]{8})\u0003([^\u0003]*)\u0003/g;
  let last = 0;
  for (let m; (m = re.exec(text)); last = re.lastIndex) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[2], color: m[1] });
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// ---------------------------------------------------------------------------
// Inline markdown -> runs of text, each with a set of styles.

const S_CODE = 1;
const S_STRONG = 2;
const S_EM = 4;
const S_STRIKE = 8;
const S_LINK = 16;
const S_DIM = 32;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', copy: '©', times: '×' };
const PUNCT = /[!-/:-@[-`{-~]/;
const ALNUM = /[\p{L}\p{N}]/u;

// A URL can't be opened or copied in game, so show where it goes, not all of it: a
// long one keeps its host, its first folders (on a code host, whose repository) and
// as much of its end as fits.
function shortUrl(url, max = 64) {
  const bare = url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '');
  if (bare.length <= max) return bare;
  const [, address, extra = ''] = /^([^?#]*)(.*)$/.exec(bare);
  const [host, ...rest] = address.replace(/\/$/, '').split('/');
  const last = rest.pop() || '';
  let tail = (last.length > 30 ? last.slice(0, 29) + '…' : last) + (extra.length > 24 ? extra.slice(0, 23) + '…' : extra);
  let head = host;
  let kept = 0;
  for (; kept < Math.min(2, rest.length); kept++) {
    if (`${head}/${rest[kept]}/…/${tail}`.length > max) break;
    head += '/' + rest[kept];
  }
  let end = rest.length;
  for (; end > kept; end--) {
    if (`${head}/…/${rest[end - 1]}/${tail}`.length > max) break;
    tail = rest[end - 1] + '/' + tail;
  }
  return end > kept ? `${head}/…/${tail}` : `${head}/${tail}`;
}

// A named link can't be followed in game, so where it goes is shown after the name,
// unless the name already says all of it: a web address shortened, a file as its last
// folder, name and line. A place in the same page or another app's link says nothing
// more than the name.
function destination(label, url) {
  const target = String(url || '').trim().split(/\s/)[0].replace(/^<|>$/g, '');
  const said = (part) => !part || label.toLowerCase().includes(part.toLowerCase());
  const web = /^https?:\/\/(?:www\.)?([^/?#]+)([^?#]*)/i.exec(target);
  if (web) {
    // "github.com" names the site but not which page of it.
    const page = web[2].split('/').filter(Boolean).pop();
    return said(web[1]) && said(page) ? null : ` (${shortUrl(target, 48)})`;
  }
  const mail = /^mailto:(.+)$/i.exec(target);
  if (mail) return said(mail[1]) ? null : ` (${mail[1]})`;
  const file = target.replace(/^file:\/\//i, '');
  if (!file || file.startsWith('#') || /^[a-z][a-z0-9+.-]+:(\/\/|(?!\d))/i.test(file)) return null;
  const parts = file.split(/[\\/]/).filter(Boolean);
  const name = parts[parts.length - 1] || '';
  // The name with its line: "rows.ts" doesn't say the 42 of "rows.ts:42".
  return !name || said(name) ? null : ` (${parts.slice(-2).join('/')})`;
}

// The index of the ")" closing a link destination that opens at `from`, or -1.
function closeParen(src, from) {
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '\n') return -1;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}

// The index of the "]" closing the bracket that opens before `from`, or -1.
function closeBracket(src, from) {
  let depth = 1;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '\\') i++;
    else if (c === '`') {
      const run = /^`+/.exec(src.slice(i))[0];
      const end = src.indexOf(run, i + run.length);
      if (end > 0) i = end + run.length - 1;
    } else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return i;
  }
  return -1;
}

// Tokens: { text, style } and delimiter runs { delim, count, open, close }.
function tokenize(src, refs, style) {
  const out = [];
  let text = '';
  const flush = () => {
    if (text) out.push({ text, style });
    text = '';
  };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const rest = src.slice(i);
    let m;
    if (c === '\\') {
      if (i + 1 < src.length && PUNCT.test(src[i + 1])) {
        text += src[i + 1];
        i += 2;
        continue;
      }
      if (src[i + 1] === '\n') {
        text += '\n';
        i += 2;
        continue;
      }
    } else if (c === '`') {
      const run = /^`+/.exec(rest)[0];
      let end = i + run.length;
      for (;;) {
        end = src.indexOf(run, end);
        if (end < 0 || (src[end + run.length] !== '`' && src[end - 1] !== '`')) break;
        end += /^`+/.exec(src.slice(end))[0].length;
      }
      if (end > 0) {
        let code = src.slice(i + run.length, end).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim()) code = code.slice(1, -1);
        flush();
        out.push({ text: code, style: style | S_CODE });
        i = end + run.length;
        continue;
      }
      text += run;
      i += run.length;
      continue;
    } else if (c === '&' && (m = /^&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]+);/i.exec(rest))) {
      const name = m[1].toLowerCase();
      let ch = ENTITIES[name];
      if (name[0] === '#') {
        const code = name[1] === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) ch = String.fromCodePoint(code);
      }
      if (ch !== undefined) {
        text += ch;
        i += m[0].length;
        continue;
      }
    } else if (c === '<') {
      if ((m = /^<br\s*\/?>/i.exec(rest))) {
        text += '\n';
        i += m[0].length;
        continue;
      }
      if ((m = /^<((?:https?|mailto):[^\s<>]+)>/i.exec(rest))) {
        flush();
        out.push({ text: shortUrl(m[1].replace(/^mailto:/i, '')), style: style | S_LINK });
        i += m[0].length;
        continue;
      }
    } else if (c === '!' && src[i + 1] === '[') {
      const end = closeBracket(src, i + 2);
      if (end > 0 && src[end + 1] === '(') {
        const close = closeParen(src, end + 2);
        if (close > 0) {
          flush();
          const alt = src.slice(i + 2, end).trim();
          out.push({ text: alt ? `[image: ${alt}]` : '[image]', style: style | S_DIM });
          i = close + 1;
          continue;
        }
      }
    } else if (c === '[') {
      const end = closeBracket(src, i + 1);
      if (end > 0) {
        const label = src.slice(i + 1, end);
        let after = -1;
        let url = null;
        if (src[end + 1] === '(') {
          const close = closeParen(src, end + 2);
          if (close > 0) {
            after = close + 1;
            url = src.slice(end + 2, close);
          }
        } else if (src[end + 1] === '[') {
          const close = src.indexOf(']', end + 2);
          const ref = close > 0 ? src.slice(end + 2, close) || label : null;
          if (ref !== null && refs.has(ref.trim().toLowerCase())) {
            after = close + 1;
            url = refs.get(ref.trim().toLowerCase());
          }
        } else if (refs.has(label.trim().toLowerCase())) {
          after = end + 1;
          url = refs.get(label.trim().toLowerCase());
        }
        if (after > 0 && label.trim()) {
          flush();
          out.push(...tokenize(label, refs, style | S_LINK));
          const where = destination(label, url);
          if (where) out.push({ text: where, style: (style & ~S_LINK) | S_DIM });
          i = after;
          continue;
        }
      }
    } else if (c === 'h' && (m = /^https?:\/\/[^\s<>]+/.exec(rest)) && !ALNUM.test(src[i - 1] || ' ')) {
      let url = m[0];
      // Trailing punctuation belongs to the sentence, and so does an unmatched ")".
      for (;;) {
        const last = url[url.length - 1];
        if (/[.,;:!?'"*_~]/.test(last)) url = url.slice(0, -1);
        else if (last === ')' && url.split('(').length <= url.split(')').length - 1) url = url.slice(0, -1);
        else break;
      }
      flush();
      out.push({ text: shortUrl(url), style: style | S_LINK });
      i += url.length;
      continue;
    } else if (c === '*' || c === '_' || c === '~') {
      const run = /^(\*+|_+|~+)/.exec(rest)[0];
      const before = src[i - 1] || ' ';
      const after = src[i + run.length] || ' ';
      const spaceBefore = /\s/.test(before);
      const spaceAfter = /\s/.test(after);
      const punctBefore = PUNCT.test(before);
      const punctAfter = PUNCT.test(after);
      const left = !spaceAfter && (!punctAfter || spaceBefore || punctBefore);
      const right = !spaceBefore && (!punctBefore || spaceAfter || punctAfter);
      let open = left;
      let close = right;
      if (c === '_') {
        open = left && (!right || punctBefore);
        close = right && (!left || punctAfter);
      }
      if (c === '~' && run.length !== 2) open = close = false;
      flush();
      out.push({ delim: c, count: run.length, open, close, style });
      i += run.length;
      continue;
    }
    text += c;
    i++;
  }
  flush();
  return out;
}

// Pair up delimiter runs (CommonMark's rule, without its "multiple of 3" corner) and
// add the style to everything between a pair. Unpaired delimiters stay as text.
function emphasize(tokens) {
  const openers = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.delim) continue;
    if (t.close) {
      for (let k = openers.length - 1; k >= 0 && t.count > 0; k--) {
        const o = tokens[openers[k]];
        if (o.delim !== t.delim || o.count === 0) continue;
        const use = t.delim === '~' ? 2 : o.count >= 2 && t.count >= 2 ? 2 : 1;
        const add = t.delim === '~' ? S_STRIKE : use === 2 ? S_STRONG : S_EM;
        for (let j = openers[k] + 1; j < i; j++) tokens[j].style |= add;
        o.count -= use;
        t.count -= use;
        openers.length = o.count > 0 ? k + 1 : k;
        if (o.count > 0) k++;
      }
    }
    if (t.open && t.count > 0) openers.push(i);
  }
  const runs = [];
  for (const t of tokens) {
    const text = t.delim ? t.delim.repeat(t.count) : t.text;
    if (!text) continue;
    const last = runs[runs.length - 1];
    if (last && last.style === t.style) last.text += text;
    else runs.push({ text, style: t.style });
  }
  return runs;
}

function inlineRuns(src, refs = new Map(), style = 0) {
  return emphasize(tokenize(src, refs, style));
}

// Bold is gold: a font string has one weight, and gold is what shows best on the
// addon's body text. The addon draws headings and table headers white and larger, so
// structure and emphasis don't look alike. A run has one colour, so of several styles
// the one that changes the meaning most wins: struck, then bold, then code, link,
// italic. Bold code has a colour of its own, to stand out and still read as code.
// `legacy` is
// one font string for a whole message, where the heading is the gold text and bold
// inside it is white.
function runColor(style, kind, legacy) {
  if (style & S_STRIKE) return STRUCK;
  if (style & S_DIM) return DIM;
  if (style & S_STRONG && style & S_CODE && !legacy) return KEY;
  if (style & S_STRONG) return legacy && kind === 'head' ? WHITE : GOLD;
  if (style & S_CODE) return CODE;
  if (style & S_LINK) return LINK;
  if (style & S_EM) return legacy && kind === 'head' ? null : SOFT;
  return null;
}

// `base` is the colour of the text around a run that has no style of its own: none
// when the font string's own colour does, a colour when several kinds share a string.
// Colour spans are never nested: a piece with its own colour ends the span around it.
// Struck text can't have a line through it, so it is grey between two "~".
function runsToWow(runs, kind = 'body', base = null, legacy = false) {
  let out = '';
  let pending = '';
  let pendingColor;
  const flush = () => {
    if (pending) out += pendingColor ? color(pendingColor, pending) : pending;
    pending = '';
  };
  const add = (text, c) => {
    if (c !== pendingColor) flush();
    pendingColor = c;
    pending += text;
  };
  // Code counts as text of the line, whatever it holds.
  const settled = settleProse(runs.map((r) => (r.style & S_CODE ? r.text.replace(/[^\n]/g, 'x') : markProse(r.text))));
  let struck = false;
  runs.forEach((run, i) => {
    const c = runColor(run.style, kind, legacy) || base;
    const strike = !!(run.style & S_STRIKE);
    if (strike !== struck) add('~', STRUCK);
    struck = strike;
    if (run.style & S_CODE) add(escapeWow(run.text, { code: true }), c);
    else for (const part of proseParts(settled[i])) add(part.text, strike ? c : part.color || c);
  });
  if (struck) add('~', STRUCK);
  flush();
  return out;
}

const runsText = (runs) => runs.map((r) => r.text).join('');

// ---------------------------------------------------------------------------
// Block markdown -> blocks.
//   { k: 'p', runs }                       paragraph
//   { k: 'h', l, runs }                    heading, level 1 to 3
//   { k: 'li', d, m, runs }                list item: depth, marker ("•", "1.", "[ ]", "[x]", "" = more of the item above)
//   { k: 'code', d, text }                 code block, indented under a list item at depth d - 1
//   { k: 'q', d, runs }                    quoted paragraph at quote depth d
//   { k: 'hr' }                            rule
//   { k: 'tbl', align, rows }              table: one of l/c/r per column, rows of cells (runs); row 1 is the header
//   { k: 'more' }                          the message was cut here

const FENCE = /^(\s*)(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const QUOTE = /^ {0,3}>[ \t]?(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const REF_DEF = /^ {0,3}\[(?!\^)([^\]]+)\]:\s*(\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/;

function splitCells(line) {
  const cells = [];
  let cell = '';
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && s[i + 1] === '|') {
      cell += '|';
      i++;
    } else if (c === '`') {
      const run = /^`+/.exec(s.slice(i))[0];
      const end = s.indexOf(run, i + run.length);
      const stop = end > 0 ? end + run.length : i + run.length;
      // An escaped pipe is one even inside code: the table splits its cells first.
      cell += s.slice(i, stop).replace(/\\\|/g, '|');
      i = stop - 1;
    } else if (c === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function parseBlocks(lines, refs, quote = 0) {
  const blocks = [];
  let para = null; // lines of the open paragraph
  let item = null; // the open list item's block
  let indents = []; // marker columns of the open list's levels
  const closePara = () => {
    if (para) {
      const runs = inlineRuns(para.join('\n').trim(), refs);
      blocks.push(quote ? { k: 'q', d: quote, runs } : { k: 'p', runs });
    }
    para = null;
  };
  const closeList = () => {
    item = null;
    indents = [];
  };
  // A numbered item ends the paragraph above it only when it is number 1: a line that
  // starts with "2026." is a sentence wrapped before a year.
  const interrupts = (m) => m && m[3] !== undefined && (!/\d/.test(m[2]) || parseInt(m[2], 10) === 1);
  const startsBlock = (line) => FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || interrupts(ITEM.exec(line));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    if (!line.trim()) {
      closePara();
      if (item) item.blank = true;
      continue;
    }
    if ((m = FENCE.exec(line)) && !(m[2][0] === '`' && m[3].includes('`'))) {
      closePara();
      const indent = m[1].length;
      const body = [];
      const close = new RegExp(`^\\s*${m[2][0]}{${m[2].length},}\\s*$`);
      for (i++; i < lines.length && !close.test(lines[i]); i++) {
        body.push(lines[i].replace(new RegExp(`^\\s{0,${indent}}`), ''));
      }
      // The fence belongs to the deepest open item it is indented under. Deeper
      // items end here, and text that follows at this indent goes on with that item.
      const depth = indents.filter((at) => indent > at).length;
      if (!depth) closeList();
      else if (depth < indents.length) {
        indents.length = depth;
        item = { d: depth - 1, blank: true, src: [] };
      }
      blocks.push({ k: 'code', d: depth, text: body.join('\n') });
      continue;
    }
    if ((m = HEADING.exec(line))) {
      closePara();
      closeList();
      blocks.push({ k: 'h', l: Math.min(3, m[1].length), runs: inlineRuns((m[2] || '').trim(), refs) });
      continue;
    }
    // "Text" then a line of = is a heading. A line of - under text would be one too, but
    // agents mean a rule by it, so it is always a rule.
    if (para && !item && /^ {0,3}=+[ \t]*$/.test(line)) {
      const runs = inlineRuns(para.join('\n').trim(), refs);
      para = null;
      blocks.push({ k: 'h', l: 1, runs });
      continue;
    }
    if (RULE.test(line)) {
      closePara();
      closeList();
      blocks.push({ k: 'hr' });
      continue;
    }
    if (QUOTE.test(line)) {
      closePara();
      closeList();
      const inner = [];
      for (; i < lines.length && (m = QUOTE.exec(lines[i])); i++) inner.push(m[1]);
      i--;
      blocks.push(...parseBlocks(inner, refs, quote + 1));
      continue;
    }
    if ((m = ITEM.exec(line)) && (!para || interrupts(m))) {
      closePara();
      const indent = m[1].length;
      while (indents.length > 1 && indent < indents[indents.length - 1]) indents.pop();
      if (!indents.length || indent > indents[indents.length - 1] + 1) indents.push(indent);
      else indents[indents.length - 1] = Math.min(indents[indents.length - 1], indent);
      let text = m[3] || '';
      let marker = /\d/.test(m[2]) ? m[2].replace(')', '.') : '•';
      const task = /^\[([ xX])\][ \t]+(.*)$/.exec(text);
      if (task) {
        marker = task[1] === ' ' ? '[ ]' : '[x]';
        text = task[2];
      }
      item = { k: 'li', d: Math.min(4, indents.length - 1), m: marker, src: [text] };
      blocks.push(item);
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitCells(line);
      const rule = splitCells(lines[i + 1]);
      if (head.length === rule.length && head.length > 1) {
        closePara();
        closeList();
        const align = rule.map((c) => (c.startsWith(':') && c.endsWith(':') ? 'c' : c.endsWith(':') ? 'r' : 'l')).join('');
        const rows = [head];
        for (i += 2; i < lines.length && lines[i].trim() && lines[i].includes('|'); i++) {
          const cells = splitCells(lines[i]).slice(0, head.length);
          while (cells.length < head.length) cells.push('');
          rows.push(cells);
        }
        i--;
        blocks.push({ k: 'tbl', align, rows: rows.map((r) => r.map((c) => inlineRuns(c, refs))) });
        continue;
      }
    }
    // Plain text: more of the open list item, or of the open paragraph, or a new one.
    if (item) {
      const indented = /^\s{2,}/.test(line);
      if (!item.blank) {
        item.src.push(line.trim());
        continue;
      }
      if (indented) {
        item = { k: 'li', d: item.d, m: '', src: [line.trim()] };
        blocks.push(item);
        continue;
      }
      closeList();
    }
    if (!para) para = [];
    para.push(line.replace(/^\s+/, '').replace(/( {2,}|\\)$/, ''));
    if (i + 1 < lines.length && startsBlock(lines[i + 1])) closePara();
  }
  closePara();
  for (const b of blocks) {
    if (b.src) {
      b.runs = inlineRuns(b.src.map((l) => l.replace(/( {2,}|\\)$/, '')).join('\n').trim(), refs);
      delete b.src;
      delete b.blank;
    }
  }
  if (quote) {
    // Inside a quote, anything that isn't a paragraph is drawn as quoted text: a list
    // item behind its marker, a heading as bold, the rest as its plain text.
    return blocks.map((b) => {
      if (b.k === 'q') return b;
      if (b.k === 'li') return { k: 'q', d: quote, runs: [{ text: '   '.repeat(b.d) + (b.m ? b.m + ' ' : '   '), style: 0 }, ...b.runs] };
      if (b.k === 'h') return { k: 'q', d: quote, runs: b.runs.map((r) => ({ ...r, style: r.style | S_STRONG })) };
      return { k: 'q', d: quote, runs: [{ text: blockText(b), style: b.k === 'code' ? S_CODE : 0 }] };
    });
  }
  return blocks;
}

function blockText(b) {
  if (b.k === 'code') return b.text;
  if (b.k === 'hr') return '—————';
  if (b.k === 'tbl') return b.rows.map((r) => r.map(runsText).join('  ·  ')).join('\n');
  if (b.k === 'li') return (b.m ? b.m + ' ' : '') + runsText(b.runs);
  return runsText(b.runs || []);
}

const CUT_NOTE = '… (open the thread in T3 Code for the rest)';

// Cut after `maxChars` of text, at the end of a word, and say so.
function limitBlocks(blocks, maxChars) {
  let left = maxChars;
  const out = [];
  for (const b of blocks) {
    const size = blockText(b).length;
    if (size <= left) {
      out.push(b);
      left -= size;
      continue;
    }
    if (b.k === 'code') {
      const kept = [];
      for (const l of b.text.split('\n')) {
        if (l.length + 1 > left) break;
        kept.push(l);
        left -= l.length + 1;
      }
      if (kept.length) out.push({ ...b, text: kept.join('\n') });
    } else if (b.k === 'tbl') {
      const rows = [];
      for (const r of b.rows) {
        const n = r.map(runsText).join('').length;
        if (n > left) break;
        rows.push(r);
        left -= n;
      }
      if (rows.length > 1) out.push({ ...b, rows });
    } else if (b.runs && left > 40) {
      const runs = [];
      for (const run of b.runs) {
        if (run.text.length <= left) {
          runs.push(run);
          left -= run.text.length;
          continue;
        }
        const points = Array.from(run.text).slice(0, left).join('');
        const cut = points.replace(/\s+\S*$/, '');
        runs.push({ text: (cut.length > left / 2 ? cut : points) + '…', style: run.style });
        break;
      }
      out.push({ ...b, runs });
    }
    out.push({ k: 'more' });
    break;
  }
  return out;
}

export function markdownToBlocks(md, { maxChars = 3500 } = {}) {
  const text = String(md ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000\u0001]/g, '');
  const refs = new Map();
  const lines = [];
  let fence = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\t/g, '    ');
    const f = FENCE.exec(line);
    if (f && (!fence || (f[2][0] === fence[0] && f[2].length >= fence.length && !f[3].trim()))) fence = fence ? null : f[2];
    const def = !fence && REF_DEF.exec(line);
    if (def) refs.set(def[1].trim().toLowerCase(), def[2]);
    else lines.push(line);
  }
  return limitBlocks(parseBlocks(lines, refs), maxChars);
}

// ---------------------------------------------------------------------------
// Blocks -> what the addon gets.

// One row per block, as short arrays: the snapshot is re-read by the game on every
// update, so keys would cost more than the text.
//   {"p", text}  {"h", level, text}  {"l", depth, marker, text}  {"c", depth, text}
//   {"q", depth, text}  {"r"}  {"t", align, {{cell, ...}, ...}}
// `mono`: the addon loaded its fixed-width font, so code blocks keep the arrows and
// box-drawing characters that font has.
export function blocksToWire(blocks, { mono = false } = {}) {
  const out = [];
  for (const b of blocks) {
    if (b.k === 'p') out.push(['p', runsToWow(b.runs)]);
    else if (b.k === 'h') out.push(['h', b.l, runsToWow(b.runs, 'head')]);
    else if (b.k === 'li') out.push(['l', b.d, b.m, runsToWow(b.runs)]);
    else if (b.k === 'code') out.push(['c', b.d, escapeWow(b.text, { mono, code: true })]);
    else if (b.k === 'q') out.push(['q', b.d, runsToWow(b.runs, 'quote')]);
    else if (b.k === 'hr') out.push(['r']);
    else if (b.k === 'tbl') out.push(['t', b.align, b.rows.map((r, i) => r.map((c) => runsToWow(c, i === 0 ? 'head' : 'body')))]);
    else if (b.k === 'more') out.push(['q', 0, CUT_NOTE]);
  }
  return out;
}

// The same blocks as one font string.
export function blocksToWow(blocks) {
  const out = [];
  let prev = null;
  for (const b of blocks) {
    // Items of one list, and a list under the line that introduces it, sit together.
    const tight = prev && b.k === 'li' && (prev.k === 'li' || prev.k === 'p');
    if (prev && !tight) out.push('');
    if (b.k === 'p') out.push(runsToWow(b.runs, 'body', null, true));
    else if (b.k === 'h') out.push(runsToWow(b.runs, 'head', GOLD, true));
    else if (b.k === 'li') out.push('  '.repeat(b.d) + (b.m ? color(GOLD, b.m) + ' ' : '  ') + runsToWow(b.runs, 'body', null, true));
    else if (b.k === 'code') out.push(b.text.split('\n').map((l) => color(CODE, '  '.repeat(b.d + 1) + escapeWow(l, { code: true }))).join('\n'));
    else if (b.k === 'q') out.push(runsToWow(b.runs, 'quote', DIM));
    else if (b.k === 'hr') out.push(color(DIM, '—————'));
    else if (b.k === 'tbl') out.push(b.rows.map((r, i) => r.map((c) => runsToWow(c, i === 0 ? 'head' : 'body', i === 0 ? GOLD : null, true)).join('  ·  ')).join('\n'));
    else if (b.k === 'more') out.push(color(DIM, CUT_NOTE));
    prev = b;
  }
  return out.join('\n');
}

export function markdownToWow(md, opts) {
  return blocksToWow(markdownToBlocks(md, opts));
}

export function markdownToSpeech(md, { maxChars = 1500 } = {}) {
  let s = String(md ?? '')
    .replace(/```[\s\S]*?```/g, ' (code block) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~>|]/g, ' ')
    .replace(/https?:\/\/\S+/g, 'a link')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (s.length > maxChars) {
    const cut = s.lastIndexOf('. ', maxChars);
    s = s.slice(0, cut > maxChars / 2 ? cut + 1 : maxChars);
  }
  return s;
}

export function firstLine(md, max = 140) {
  const plain = markdownToSpeech(md, { maxChars: max * 3 }).split('\n').find((l) => l.trim()) || '';
  return plain.length > max ? plain.slice(0, max - 1) + '…' : plain;
}
