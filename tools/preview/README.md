# Transcript preview

See how the addon would draw a conversation without starting the game, and count how real messages would come out. Use it while changing `bridge/src/format.js` or `addon/T3Code/UI/Transcript.lua`; the in-game check AGENTS.md asks for still comes last.

Needs `lua5.1` and `chromium` on the PATH. Nothing here is used by the addon or the bridge.

## A picture of a conversation

```bash
node tools/preview/render.mjs tools/preview/fixtures/status-report.md --out /tmp/preview
```

This writes `status-report.window.png` (the window as opened), `status-report.strip.png` (the whole transcript unrolled, with a mark at every screenful) and `status-report.json` (row count, height, how far one wheel notch scrolls).

A fixture is a markdown file. A line `=== user ===` or `=== agent ===` starts a message; a file without one is a single agent message. The fixtures here are made up. To look at a real thread, save its markdown outside the repository and pass that path.

Options: `--sidebar hidden` (thread list hidden), `--size small|medium|large|xlarge` (the Text size setting), `--scroll opened|top|bottom|last-agent|<units>` (`opened`, the default, is where the addon puts a thread it opens: the first line of the last answer when that answer is taller than the list, else the end), `--captions off`, `--root <checkout>`.

`--root` draws another checkout with this tool, for a before and after: `git archive <commit> addon tools bridge | tar -x -C /tmp/before`, then `--root /tmp/before`. It handles checkouts from before messages were drawn block by block.

## What the picture is, and isn't

The text goes through the bridge's formatter and then through the addon's own Lua, loaded against `tools/wowstub.lua`. Which rows exist, their text and markup, and every size and distance (`STYLE` and `LAYOUT` in `Transcript.lua`) are the addon's. `page.js` turns those into boxes, which repeats the anchoring each `Init…` function does in Lua. Change one, change the other.

The browser stands in for the game's text engine:

- **Font.** Noto Sans with 0.2 units of letter spacing at size 12. With those, the picture of the 0.4.0 addon breaks its lines where an in-game screenshot of the same message does (WoW: Forever, 2560x1440), except one line near the bottom that the picture breaks a word earlier. Other sizes, including the addon's default of 13, scale the spacing and were not checked against the game.
- **Missing characters.** The game drew arrows, check marks and "❓" as empty boxes. The picture draws every symbol and emoji as a box, which is a guess for the ones nobody has seen in game.
- **Code.** Code blocks use the fixed-width font the addon ships (`Media/NotoSansMono-Regular.ttf`); the picture uses the same font from your system, with ligatures off.
- **Status pictures.** The bridge sends "✅", "❌", "❓" and "⚠" as the game's own small pictures (`|TInterface\RaidFrame\ReadyCheck-Ready:0|t` and the like). The picture can't read the game's files, so it draws a look-alike for each.
- **The frame** around the transcript is a sketch for scale. Only the transcript's rows are measured.

It cannot show whether a widget call exists in the client, how the scroll box behaves, or what a texture looks like.

## Counts over real messages

```bash
node tools/preview/corpus.mjs --cache /tmp/messages.json --examples
```

Reads the newest threads from your running T3 Code, formats every agent message and counts how many would show an empty box, raw markdown, or be cut short. `--root` counts another checkout on the same cached messages. The cache holds your threads' text: keep it out of any repository.
