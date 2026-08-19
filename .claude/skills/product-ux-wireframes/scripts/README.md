# Wireframe Book Generator

Renders a surface's wireframes as a **single self-contained HTML file**: one document, no
dependencies, no build step, no network. Open it by double-clicking.

## Files

| File | Responsibility |
|------|----------------|
| `build_book.py` | Reads `screens.json` → writes `wireframes.html`. Stdlib only |
| `assets/Excalifont-Regular.woff2` | Hand-drawn face, embedded as a data URI (OFL-1.1) |
| `SCHEMA.md` | Full schema of `screens.json` |

## Usage

```bash
python3 build_book.py \
  docs/ux/surfaces/{surface}/screens.json \
  docs/ux/surfaces/{surface}/wireframes.html \
  .claude/skills/product-ux-wireframes/scripts/assets/Excalifont-Regular.woff2
```

## Architecture

```
docs/ux/surfaces/{surface}/screens/*.md      (human-readable source of truth)
docs/ux/surfaces/{surface}/user-flows.md
                ↓
        [agent: reads & interprets]
                ↓
docs/ux/surfaces/{surface}/screens.json      (canonical, VERSIONED)
                ↓
        [build_book.py: HTML + CSS grid]
                ↓
docs/ux/surfaces/{surface}/wireframes.html   (one file, self-contained)
```

## Why HTML and not a drawing format

This replaced an Excalidraw renderer of about 2000 lines. The reason is not aesthetic:

**Excalidraw has no layout engine.** Rendering to it meant reimplementing CSS by hand — a hardcoded
height per block type, a text-width heuristic (`fontSize * 0.6 * len(text)`) that erred around +20%
on real Spanish microcopy, and anti-collision arithmetic for arrows. None of that is fixable inside
the format: the font is WOFF2 and Excalidraw measures text in a canvas, so there is no server-side
metrics path.

In HTML the browser does it. `grid-template-columns: 4.1fr 3.3fr 2.5fr 2.1fr` is the declared layout,
executed. A column the spec says is 420px fixed stays 420px, instead of being forced into twelfths.

Secondary consequences, all measured on a real 25-screen product:

| | Excalidraw | HTML book |
|---|---|---|
| Output size | 3.6 MB | 275 KB |
| Deterministic | no — `random` without seed for ids and roughjs seeds; 3 builds, 3 hashes | yes — 3 builds, 1 hash |
| Diff on regeneration | ~127k lines | 0 if the spec did not change |
| Renderer size | ~2000 lines | 447 lines |
| Types with a real renderer | 27 of 36 (9 drew a grey `[type]` box) | 36 of 36 |

## Design decisions

**One file per surface, not per screen.** It is the artifact a non-technical reader opens. Every
screen × viewport × state is pre-rendered as a string and swapped with ~40 lines of JS.

**Greyscale and a hand-drawn face, deliberately.** A wireframe that looks finished invites review of
the wrong thing. Fidelity is a CSS knob, not a property of the format — and it stays turned down.

**Unknown block types render as a loud red block.** The previous renderer drew a silent grey box,
which is how a product ended up with 20 tables rendered as empty rectangles.

**Transitions are clickable blocks, not arrows.** `transitions[]` declares `srcBlock` and `dst`, so
the block that triggers a transition jumps to the destination screen inside the book. The reader
walks the flow instead of reading it, and there is no arrow geometry to compute.

## Failure modes

`build_book.py` fails hard on unreadable JSON. Everything else is a warning on stderr, because a
partial book beats no book:

- **`N bloque(s) declarados pero ausentes del layout`** — a `layouts` entry REPLACES the default
  stack, so a block it never mentions is never drawn. The frame can look complete while half the
  screen is missing. Fix the layout in the `.md`.
- **`transición a una pantalla inexistente`** — `transitions[]` and the screen inventory disagree.

## Extending

- **New block type** — add `r_<type>(b)` returning an HTML string, register it in `RENDERERS`, add
  its CSS class, and update the dictionary in `SKILL.md` and `SCHEMA.md`.
- **Visual language** — the CSS custom properties at the top of `CSS` (`--ink`, `--line`, `--fill`,
  `--ann`) control the whole palette.
- **Viewport widths** — `VIEWPORT_W`.
