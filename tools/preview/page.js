// Draws the rows tools/preview/dump.lua wrote, inside a schematic of the T3 Code window.
// Runs in the browser render.mjs opens; `window.PREVIEW` is set by the page.
//
// What is the addon's own: which rows there are, their text and markup, and every
// size in STYLE and LAYOUT. What is this file's: turning those into boxes, which
// repeats the anchoring each Init function in UI/Transcript.lua does. Change one,
// change the other.
(function () {
  const P = window.PREVIEW;
  const D = P.dump;
  const O = P.options;
  const legacy = !D.layout; // an addon from before blocks: one font string per message
  const L = D.layout || { padX: 10, listTop: 4, listBottom: 8 };
  const S = D.style || {};
  S.legacyBody = { size: 12, spacing: 2, color: [1, 1, 1] };
  S.legacyLabel = { size: 10, spacing: 0, color: [1, 0.82, 0] };
  S.note = S.note || { size: 12, spacing: 0, color: [1, 0.82, 0] };
  const ROW_SPACING = legacy ? 4 : 0;

  // Characters the game's font is known or assumed not to have: it drew arrows, check
  // marks and "❓" as empty boxes, so every symbol and emoji is drawn as a box here.
  const TOFU = /[\u2190-\u21ff\u2300-\u23ff\u2500-\u257f\u25a0-\u25ff\u2600-\u27bf\u27f0-\u27ff\u2900-\u297f\u2b00-\u2bff]|\p{Extended_Pictographic}/gu;
  const INVISIBLE = /[\ufe0e\ufe0f\u200d\u20e3]|[\u{1f3fb}-\u{1f3ff}]/gu;

  // "|T<file>:0|t" is one of the game's pictures, as tall as the line. The files are
  // the game's, so these are look-alikes: a green tick for ReadyCheck-Ready, and so on.
  const ICONS = {
    'ReadyCheck-Ready': '<svg viewBox="0 0 16 16"><path d="M2.5 8.5l3.6 3.8L13.6 3.6" fill="none" stroke="#3fdc3f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    'ReadyCheck-NotReady': '<svg viewBox="0 0 16 16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="#e8352e" stroke-width="2.6" stroke-linecap="round"/></svg>',
    'ReadyCheck-Waiting': '<svg viewBox="0 0 16 16"><path d="M5 5.6C5 3.6 6.3 2.5 8.1 2.5s3 1.1 3 2.7c0 2.4-3 2.3-3 5" fill="none" stroke="#ffd100" stroke-width="2.5" stroke-linecap="round"/><circle cx="8.1" cy="13.4" r="1.5" fill="#ffd100"/></svg>',
    'UI-Dialog-Icon-AlertNew': '<svg viewBox="0 0 16 16"><path d="M8 1.6L15 14H1z" fill="#f2c200" stroke="#7a5a00" stroke-width=".8" stroke-linejoin="round"/><path d="M8 6v4.2" stroke="#2a1d00" stroke-width="1.7" stroke-linecap="round"/><circle cx="8" cy="12.1" r=".95" fill="#2a1d00"/></svg>',
  };
  const icon = (file) => `<span class="icon">${ICONS[file.split('\\').pop()] || '<span class="tofu"></span>'}</span>`;

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  // The fixed-width font the addon ships has these (bridge/src/format.js, MONO_HAS).
  const MONO_HAS = /[\u2212\u2190-\u2195\u21d0-\u21d4\u2500-\u25ff\u27f5\u27f6]/;
  const plain = (s, mono) => esc(s.replace(INVISIBLE, '')).replace(TOFU, (c) => (c.codePointAt(0) >= 0x2190 && !(mono && MONO_HAS.test(c)) ? '<span class="tofu"></span>' : c));

  // WoW colour markup -> spans. "|r" ends the colour; it does not bring an outer one back.
  // `mono`: the text is drawn in the addon's fixed-width font.
  function markup(text, mono) {
    let out = '';
    let open = false;
    const re = /\|\||\|c([0-9a-fA-F]{8})|\|r|\|T([^:|]+)[^|]*\|t/g;
    let last = 0;
    let m;
    while ((m = re.exec(text))) {
      out += plain(text.slice(last, m.index), mono);
      last = re.lastIndex;
      if (m[0] === '||') {
        out += '|';
      } else if (m[2]) {
        out += icon(m[2]);
      } else if (m[1]) {
        if (open) out += '</span>';
        out += `<span style="color:#${m[1].slice(2)}">`;
        open = true;
      } else if (open) {
        out += '</span>';
        open = false;
      }
    }
    out += plain(text.slice(last), mono);
    return open ? out + '</span>' : out;
  }

  const rgb = (c) => `rgb(${c.slice(0, 3).map((v) => Math.round(v * 255)).join(',')}${c.length > 3 ? ',' + c[3] : ''})`;

  // A font string of n lines is n * size + (n - 1) * spacing tall; a CSS box of n
  // lines is n * line-height. The negative margin takes the difference back.
  function fontCss(name) {
    const s = S[name];
    // A style with its own font file is the fixed-width one the addon ships.
    const face = s.file ? 'font-family:"Noto Sans Mono",monospace;letter-spacing:0;font-variant-ligatures:none;font-feature-settings:"liga" 0,"calt" 0;' : '';
    return `${face}font-size:${s.size}px;line-height:${s.size + s.spacing}px;color:${rgb(s.color)};margin-top:${-s.spacing / 2}px;margin-bottom:${-s.spacing / 2}px;`;
  }

  function el(tag, cls, css, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (css) e.style.cssText = css;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  const probe = el('span', 'text', 'position:absolute;visibility:hidden;white-space:pre;');
  function textWidth(html, style) {
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;${fontCss(style)}`;
    probe.innerHTML = html;
    return Math.ceil(probe.getBoundingClientRect().width);
  }

  // The same rule as ColumnWidths in UI/Transcript.lua.
  function columnWidths(rows, avail) {
    const n = rows[0].cells.length;
    const room = avail - L.cellGap * (n - 1);
    const natural = [];
    let sum = 0;
    for (let c = 0; c < n; c++) {
      let w = 0;
      for (const row of rows) w = Math.max(w, textWidth(markup(row.cells[c] || ''), row.head ? 'cellHead' : 'cell'));
      natural[c] = w + 2;
      sum += natural[c];
    }
    if (sum <= room) return natural;
    const widths = [];
    let left = room;
    let wide = n;
    for (let settled = true; settled && wide > 0; ) {
      settled = false;
      for (let c = 0; c < n; c++) {
        if (widths[c] === undefined && natural[c] <= left / wide) {
          widths[c] = natural[c];
          left -= natural[c];
          wide--;
          settled = true;
        }
      }
    }
    const want = natural.reduce((a, w, c) => a + (widths[c] === undefined ? w : 0), 0);
    return natural.map((w, c) => (widths[c] === undefined ? Math.floor((left * w) / want) : widths[c]));
  }

  function tint(row, ed, top) {
    if (ed.role !== 'u' || legacy) return;
    row.appendChild(el('div', 'tint', `top:${top || 0}px;background:${rgb(L.userTint)};`));
  }

  function headRow(ed) {
    const row = el('div', 'row head', `height:${ed.height}px;`);
    tint(row, ed, ed.tintTop);
    row.appendChild(el('div', 'abs text', `left:${L.padX}px;bottom:5px;${fontCss('label')}`, markup(ed.label)));
    const agent = ed.role === 'a';
    const time = S.time ? fontCss('time') : 'font-size:10px;line-height:10px;color:#7f7f7f;';
    row.appendChild(el('div', 'abs text', `right:${agent ? 30 : L.padX}px;bottom:5px;${time}`, esc(ed.time || '')));
    if (agent) row.appendChild(el('div', 'abs', 'right:9px;bottom:3px;width:13px;height:13px;border-radius:2px;background:#6f6a5c;opacity:.8;'));
    return row;
  }

  function blockRow(ed) {
    const row = el('div', 'row block', `padding-top:${ed.top}px;padding-bottom:${ed.bottom}px;`);
    tint(row, ed, 0);
    if (ed.style === 'hr') {
      row.style.height = ed.textHeight + 'px';
      const across = L.panLines ? `width:${Math.min(D.bodyWidth, L.maxText)}px;` : `right:${L.padX}px;`;
      row.appendChild(el('div', 'abs', `left:${L.padX}px;${across}top:50%;height:1px;background:${rgb(L.ruleColor)};`));
      return row;
    }
    let left = L.padX + ed.indent;
    if (ed.style === 'code') {
      const edge = L.codeEdge ? `border:1px solid ${rgb(L.codeEdge)};${ed.open ? '' : 'border-top:0;'}${ed.close ? '' : 'border-bottom:0;'}` : '';
      row.appendChild(el('div', 'abs', `left:${left}px;right:${L.padX}px;top:${ed.top - (ed.open ? L.codePad : 0)}px;bottom:${ed.bottom - (ed.close ? L.codePad : 0)}px;background:${rgb(L.codeBackground)};${edge}`));
      left += L.codePad;
    } else if (ed.style === 'quote' && ed.bar) {
      row.appendChild(el('div', 'abs', `left:${left - L.quoteIndent}px;width:${L.quoteBar}px;top:${ed.top}px;bottom:${ed.joined ? 0 : ed.bottom}px;background:${rgb(L.quoteBarColor)};`));
    } else if (ed.style === 'li' && ed.marker) {
      if (ed.marker === '[ ]' || ed.marker === '[x]') {
        const size = S.li.size + 3;
        row.appendChild(el('div', 'check', `left:${left - 4 - size}px;top:${ed.top - 2}px;width:${size}px;height:${size}px;font-size:${size - 4}px;line-height:${size - 3}px;`, ed.marker === '[x]' ? '✓' : ''));
      } else {
        row.appendChild(el('div', 'abs text', `left:0;width:${left - 6}px;top:${ed.top}px;text-align:right;${fontCss('marker')}`, markup(ed.marker)));
      }
    }
    row.appendChild(el('div', 'text', `margin-left:${left}px;width:${ed.width}px;${fontCss(ed.style)}`, markup(ed.text, !!S[ed.style].file) || '&nbsp;'));
    return row;
  }

  function tableRow(ed, widths) {
    const row = el('div', 'row trow', `padding-top:${ed.top}px;padding-bottom:${ed.bottom}px;`);
    tint(row, ed, 0);
    const cells = el('div', '', `display:flex;align-items:flex-start;margin-left:${L.padX}px;gap:${L.cellGap}px;`);
    ed.cells.forEach((text, i) => {
      const a = (ed.align || '')[i];
      cells.appendChild(el('div', 'text', `flex:none;width:${widths[i]}px;text-align:${a === 'r' ? 'right' : a === 'c' ? 'center' : 'left'};${fontCss(ed.head ? 'cellHead' : 'cell')}`, markup(text) || '&nbsp;'));
    });
    row.appendChild(cells);
    const total = widths.reduce((a, b) => a + b, 0) + L.cellGap * (widths.length - 1);
    row.appendChild(el('div', 'abs', `left:${L.padX}px;width:${total}px;bottom:${ed.bottom - L.cellPad}px;height:1px;background:rgba(255,255,255,${ed.head ? 0.3 : 0.08});`));
    return row;
  }

  function noteRow(ed) {
    const row = el('div', 'row note', 'padding:6px 0 8px;min-height:30px;');
    row.appendChild(el('div', 'abs', `left:${L.padX}px;top:6px;width:16px;height:16px;border-radius:8px;background:#7a6a45;`));
    row.appendChild(el('div', 'text', `margin-left:${L.padX + 22}px;width:${D.bodyWidth - 22}px;${fontCss('note')}`, markup(ed.text)));
    return row;
  }

  function optionRow(ed) {
    const row = el('div', 'row option', 'height:26px;');
    row.appendChild(el('div', 'abs', `left:${L.padX + 6}px;top:10px;width:7px;height:7px;background:#e6e6e6;`));
    row.appendChild(el('div', 'abs text', `left:${L.padX + 21}px;top:6px;font-size:12px;line-height:14px;color:${ed.primary ? '#fff' : ed.quiet ? '#cccccc' : '#ffd100'};`, markup(ed.label)));
    return row;
  }

  // An addon from before blocks: a label, then the whole message in one font string.
  function legacyRow(ed) {
    const m = ed.msg;
    const row = el('div', 'row msg', 'padding:6px 0 0;');
    const label = m.r === 'u' ? '<span style="color:#ffd100">you</span>' : '<span style="color:#4a9eff">agent</span>';
    row.appendChild(el('div', 'text', `margin-left:${L.padX}px;${fontCss('legacyLabel')}margin-top:0;margin-bottom:0;line-height:10px;`, label));
    row.appendChild(el('div', 'abs text', 'right:30px;top:7px;font-size:10px;line-height:10px;color:#7f7f7f;', esc(m.at ? new Date(m.at * 1000).toISOString().slice(11, 16) : '')));
    if (m.r === 'a') row.appendChild(el('div', 'abs', 'right:8px;top:5px;width:14px;height:14px;border-radius:2px;background:#6f6a5c;opacity:.8;'));
    const body = el('div', 'text', `margin-left:${L.padX}px;margin-top:4px;width:${D.bodyWidth}px;${fontCss('legacyBody')}`, markup(m.t));
    body.style.marginTop = 4 - S.legacyBody.spacing / 2 + 'px';
    row.appendChild(body);
    // The row is 34 + the text's height; 6 + 10 + 4 are above the text.
    row.style.paddingBottom = 14 + S.legacyBody.spacing / 2 + 'px';
    return row;
  }

  function buildRows(width) {
    const box = el('div', 'rows', `width:${width}px;padding:${L.listTop}px 0 ${L.listBottom}px;`);
    box.appendChild(probe);
    const tables = new Map();
    for (const ed of D.elements) {
      if (ed.kind !== 'trow') continue;
      if (!tables.has(ed.table)) tables.set(ed.table, []);
      tables.get(ed.table).push(ed);
    }
    const widths = new Map();
    document.body.appendChild(box);
    for (const [id, rows] of tables) widths.set(id, columnWidths(rows, D.bodyWidth));
    D.elements.forEach((ed, i) => {
      let row;
      if (ed.kind === 'head') row = headRow(ed);
      else if (ed.kind === 'block') row = blockRow(ed);
      else if (ed.kind === 'trow') row = tableRow(ed, widths.get(ed.table));
      else if (ed.kind === 'msg') row = legacyRow(ed);
      else if (ed.kind === 'option') row = optionRow(ed);
      else row = noteRow(ed);
      if (i > 0 && ROW_SPACING) row.style.marginTop = ROW_SPACING + 'px';
      row.dataset.kind = ed.kind;
      row.dataset.role = ed.role || (ed.msg && ed.msg.r) || '';
      box.appendChild(row);
    });
    return box;
  }

  // One wheel notch, in the addon's units: twice the pan extent, which the scroll box
  // takes from the first row unless the addon sets it.
  function notch(rows) {
    if (L.pan) return 2 * L.pan;
    const first = rows.querySelector('.row');
    return first ? Math.round(2 * (first.getBoundingClientRect().height + ROW_SPACING)) : 0;
  }

  const hidden = O.sidebar === 'hidden';
  const listWidth = D.bodyWidth + 2 * L.padX + (legacy ? 26 : 0);
  const root = document.getElementById('root');
  if (O.font) document.documentElement.style.setProperty('--font', O.font);
  if (O.track) document.documentElement.style.setProperty('--track', O.track / 12 + 'em');

  if (O.part === 'strip') {
    // The whole transcript unrolled, with a mark at every screenful.
    const strip = el('div', 'strip', `width:${listWidth + 2}px;`);
    const rows = buildRows(listWidth);
    strip.appendChild(rows);
    root.appendChild(strip);
    const screen = O.viewport;
    const height = rows.getBoundingClientRect().height;
    for (let y = screen, n = 1; y < height; y += screen, n++) {
      strip.appendChild(el('div', 'abs', `position:absolute;left:0;right:0;top:${y}px;border-top:1px dashed #ff5ad1;opacity:.55;`));
      strip.appendChild(el('div', 'abs', `position:absolute;right:3px;top:${y - 15}px;font:10px/12px "Noto Sans",sans-serif;letter-spacing:0;color:#ff5ad1;`, `screen ${n}`));
    }
    window.PREVIEW_INFO = { rows: D.elements.length, height: Math.round(height), screens: +(height / screen).toFixed(2), notch: notch(rows) };
  } else {
    const win = el('div', 'window' + (hidden ? ' sidebar-hidden' : ''));
    win.innerHTML = `
      <div class="title">T3 Code</div>
      <div class="subtitle">${esc(O.title)}</div>
      <div class="status">Connected</div>
      <div class="pane left">
        <div class="box">All projects</div>
        <div class="box" style="color:#777">Search</div>
        <div class="group">Open &nbsp;(${P.threads.length})</div>
        ${P.threads.map((t, i) => `<div class="thread${i === 1 ? ' sel' : ''}"><div class="name">${esc(i === 1 ? O.title : t)}</div><div class="meta">demo · workstation</div></div>`).join('')}
      </div>
      <div class="pane right">
        <div class="header">Finished &nbsp;·&nbsp; demo <span class="btn">Settle</span><span class="btn">Snooze</span></div>
        <div class="transcript"><div class="scrollbox"></div><div class="scrollbar"><div class="thumb"></div><div class="notch"></div></div></div>
        <div class="composer">Message the agent (Shift+Enter for a new line)</div>
      </div>
      <div class="bar"><span class="btn">Refresh</span><span class="btn">New Thread</span><span class="btn">Back</span><span class="btn send">Send</span></div>`;
    root.appendChild(win);
    const box = win.querySelector('.scrollbox');
    const rows = buildRows(listWidth);
    box.appendChild(rows);
    const view = box.getBoundingClientRect().height;
    const height = rows.getBoundingClientRect().height;
    const max = Math.max(0, height - view);
    let scroll = max;
    if (O.scroll === 'top') scroll = 0;
    else if (O.scroll === 'opened' && !legacy) {
      // Where the addon puts a thread it opens (T:AnswerStart in UI/Transcript.lua): the
      // header of the last message when that is an answer taller than the list, else the end.
      const heads = [...rows.querySelectorAll('.row[data-kind="head"]')];
      const last = heads[heads.length - 1];
      if (last && last.dataset.role === 'a' && height - L.listBottom - last.offsetTop > view) scroll = Math.min(max, last.offsetTop);
    } else if (O.scroll === 'last-agent') {
      const heads = [...rows.querySelectorAll('.row[data-kind="head"][data-role="a"], .row[data-kind="msg"][data-role="a"]')];
      const last = heads[heads.length - 1];
      if (last) scroll = Math.min(max, Math.max(0, last.offsetTop - 44));
    } else if (/^\d+$/.test(String(O.scroll))) scroll = Math.min(max, Number(O.scroll));
    rows.style.transform = `translateY(${-scroll}px)`;
    const thumb = win.querySelector('.thumb');
    thumb.style.height = Math.max(18, (view * view) / Math.max(view, height)) + 'px';
    thumb.style.top = (max ? scroll / max : 0) * (view - thumb.getBoundingClientRect().height) + 'px';
    const step = notch(rows);
    const mark = win.querySelector('.notch');
    mark.style.top = '6px';
    mark.style.height = Math.min(view - 12, step) + 'px';
    if (!O.captions) mark.style.display = 'none';
    window.PREVIEW_INFO = { rows: D.elements.length, height: Math.round(height), screens: +(height / view).toFixed(2), notch: step, viewport: Math.round(view), bodyWidth: D.bodyWidth };
  }

  // The line breaks of the first text rows, for calibrating the font against a screenshot.
  window.PREVIEW_LINES = [...document.querySelectorAll('.row .text')].slice(0, 12).map((node) => {
    const lines = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let top = null;
    let line = '';
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        range.setStart(n, i);
        range.setEnd(n, i + 1);
        const r = range.getClientRects()[0];
        if (!r) continue;
        if (top !== null && r.top > top + 3) {
          lines.push(line);
          line = '';
        }
        top = r.top;
        line += n.data[i];
      }
    }
    lines.push(line);
    return lines.map((l) => l.trim());
  });

  const info = window.PREVIEW_INFO;
  if (O.captions) {
    const cap = document.getElementById('caption');
    const lines = S.p ? S.p.size + S.p.spacing : 14;
    cap.innerHTML = `<b>${esc(O.title)}</b> &nbsp;·&nbsp; ${O.part === 'strip' ? 'whole transcript' : 'window as opened'} &nbsp;·&nbsp; thread list ${hidden ? 'hidden' : 'shown'}`
      + ` &nbsp;·&nbsp; ${info.rows} rows, ${info.screens} screens &nbsp;·&nbsp; one wheel notch = <b>${info.notch} units</b> (about ${Math.round(info.notch / lines)} lines${O.part === 'strip' ? '' : ', the pink bracket'})`;
  }
  const size = document.body.getBoundingClientRect();
  document.documentElement.dataset.size = `${Math.ceil(size.width)}x${Math.ceil(size.height)}`;
  document.documentElement.dataset.info = JSON.stringify(info);
  document.documentElement.dataset.lines = JSON.stringify(window.PREVIEW_LINES);
})();
