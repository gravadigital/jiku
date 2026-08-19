#!/usr/bin/env python3
"""Render a wireframe book (single self-contained HTML) from screens.json.

Usage:
    python3 build_book.py screens.json book.html [font.woff2]

One file, no build step, no dependencies. Open it by double-clicking.
Layout is CSS grid executed by the browser, so 12-column rows and fixed-px
columns are respected instead of approximated.
"""
import base64
import html
import re
import json
import sys
from pathlib import Path

# Canonical viewports, same set the rest of the workflow declares. The surface's platform
# decides which are valid (web: mobile/desktop · mobile-app: phone/tablet/phone-landscape).
VIEWPORT_W = {
    "mobile": 400, "desktop": 1200,
    "phone": 390, "phone-landscape": 844, "tablet": 834,
}
VIEWPORT_ORDER = ["phone", "mobile", "phone-landscape", "tablet", "desktop"]


def esc(s):
    return html.escape(str(s if s is not None else ""))


# ---------------------------------------------------------------- block renderers

def r_header(b):
    icon = '<span class="wf-burger">☰</span>' if b.get("icon") == "menu" else ""
    return f'<div class="wf-header"><b>{esc(b.get("content"))}</b>{icon}</div>'


def item_label(it):
    """An item may be a plain string or an object. Never let a dict reach the page.

    The specs use both shapes for the same thing — "Proyectos" and
    {"title": "Proyectos", "icon": "folder"} — because the second is what you write
    when the item carries an icon. Renderers that assumed str printed the repr.
    """
    if isinstance(it, dict):
        return str(it.get("title") or it.get("label") or it.get("text") or
                   it.get("name") or "")
    return str(it)


def item_icon(it):
    return it.get("icon") if isinstance(it, dict) else None


def r_sidebar(b):
    active = b.get("active")
    def one(i, it):
        ico = ICON_GLYPH if item_icon(it) else ""
        on = " class=on" if i == active else ""
        return f"<a{on}>{ico}{esc(item_label(it))}</a>"
    items = "".join(one(i, it) for i, it in enumerate(b.get("items", [])))
    return f'<nav class="wf-sidebar"><b>Navegación</b>{items}</nav>'


def r_heading(b):
    lvl = b.get("level", "h2")
    return f'<{lvl} class="wf-h">{esc(b.get("content"))}</{lvl}>'


def r_label(b):
    return f'<div class="wf-lbl">{esc(b.get("content"))}</div>'


def r_button(b):
    return f'<button class="wf-btn" data-variant="{esc(b.get("variant","primary"))}">{esc(b.get("content"))}</button>'


def r_link(b):
    return f'<a class="wf-link">← {esc(b.get("content"))}</a>'


def _field(b, inner, suffix=""):
    lab = f'<label>{esc(b["label"])}</label>' if b.get("label") else ""
    return f'<div class="wf-field">{lab}{inner}{suffix}</div>'


def r_text_input(b):
    ph = esc(b.get("content")) or "&nbsp;"
    st = f' data-state="{esc(b["state"])}"' if b.get("state") else ""
    return _field(b, f'<div class="wf-ctl"{st}>{ph}</div>')


def r_textarea(b):
    return _field(b, f'<div class="wf-ctl wf-area">{esc(b.get("content"))}</div>')


def r_dropdown(b):
    return _field(b, f'<div class="wf-ctl">{esc(b.get("content"))}<span class="wf-caret">▾</span></div>')


def r_date_picker(b):
    st = ' data-state="disabled"' if b.get("state") == "disabled" else ""
    val = esc(b.get("content")) or "dd/mm/aaaa"
    return _field(b, f'<div class="wf-ctl"{st}>{val}<span class="wf-caret">▤</span></div>')


def r_search(b):
    # leading icon: plain span, not .wf-caret (which pushes itself to the right edge)
    inner = f'<div class="wf-ctl"><span class="wf-ico">⌕</span>{esc(b.get("content"))}</div>'
    return _field(b, inner)


def r_table(b):
    cols = b.get("columns", [])
    cg = "".join(f'<col style="width:{esc(c.get("width",""))}">' for c in cols)
    th = "".join(f"<th>{esc(c.get('label'))}</th>" for c in cols)
    body = []
    for row in b.get("rows", []):
        tds = []
        for cell in row:
            s = str(cell)
            if s.startswith("badge:"):
                tds.append(f'<td><span class="wf-badge">{esc(s[6:])}</span></td>')
            elif s.startswith("skeleton"):
                w = s.split(":")[1] if ":" in s else "80"
                tds.append(f'<td><span class="wf-sk" style="width:{esc(w)}%"></span></td>')
            else:
                tds.append(f"<td>{esc(s)}</td>")
        body.append("<tr>" + "".join(tds) + "</tr>")
    return (f'<div class="wf-card wf-tablewrap"><table class="wf-table"><colgroup>{cg}</colgroup>'
            f"<thead><tr>{th}</tr></thead><tbody>{''.join(body)}</tbody></table></div>")


def r_card_list(b):
    out = []
    for it in b.get("items", []):
        badges = "".join(f'<span class="wf-badge">{esc(x)}</span>' for x in it.get("badges", []))
        out.append(
            f'<div class="wf-rowcard"><div class="wf-meta"><span>{esc(it.get("id"))}</span>'
            f'<span>{esc(it.get("fecha"))}</span></div>'
            f'<div class="wf-rctitle">{esc(it.get("titulo"))}</div>'
            f'<div class="wf-badges">{badges}</div>'
            f'<div class="wf-meta"><span>{esc(it.get("proyecto"))}</span>'
            f'<span>{esc(it.get("responsable"))}</span></div></div>'
        )
    return f'<div class="wf-stack">{"".join(out)}</div>'


def r_chips(b):
    return ('<div class="wf-badges">'
            + "".join(f'<span class="wf-badge">{esc(item_label(x))}</span>'
                       for x in b.get("items", []))
            + "</div>")


def r_loader(b):
    return f'<div class="wf-loader"><span class="wf-spin">◌</span> {esc(b.get("content") or "Cargando…")}</div>'


def r_empty(b):
    return (f'<div class="wf-empty"><b>{esc(b.get("content"))}</b>'
            f'<span>{esc(b.get("paragraph"))}</span></div>')


def r_toast(b):
    return f'<div class="wf-toast" data-kind="{esc(b.get("kind","info"))}">⚠ {esc(b.get("content"))}</div>'


def r_pagination(b):
    n = b.get("pages", 3)
    pages = "".join(f'<span{" class=on" if i == 0 else ""}>{i+1}</span>' for i in range(n))
    return f'<div class="wf-pg"><span>‹</span>{pages}<span>›</span></div>'


def r_section(b):
    return f'<div class="wf-section">{esc(b.get("content") or "")}</div>'


# ---- the 21 remaining dictionary types ----------------------------------------
# Every declared type gets a renderer. A type without one falls to the loud red block
# (see render_block): the old Excalidraw renderer drew a silent grey box instead, which is
# how a product ended up with 20 tables rendered as empty rectangles.

def r_footer(b):
    return f'<div class="wf-footer">{esc(b.get("content"))}</div>'


def r_main(b):
    return f'<div class="wf-main">{esc(b.get("content") or "")}</div>'


def r_modal(b):
    body = f'<p class="wf-p">{esc(b.get("paragraph"))}</p>' if b.get("paragraph") else ""
    return (f'<div class="wf-modalwrap"><div class="wf-modal">'
            f'<b>{esc(b.get("content") or "Modal")}</b>{body}</div></div>')


def r_nav_bar(b):
    labels = b.get("labels") or [x.strip() for x in str(b.get("content", "")).split("|") if x.strip()]
    active = b.get("active")
    items = "".join(f'<span{" class=on" if i == active else ""}>{esc(item_label(l))}</span>'
                    for i, l in enumerate(labels))
    return f'<div class="wf-navbar">{items}</div>'


def r_tabs(b):
    labels = b.get("labels") or [x.strip() for x in str(b.get("content", "")).split("|") if x.strip()]
    active = b.get("active", 0)
    items = "".join(f'<span{" class=on" if i == active else ""}>{esc(item_label(l))}</span>'
                    for i, l in enumerate(labels))
    return f'<div class="wf-tabs">{items}</div>'


def r_breadcrumbs(b):
    items = b.get("items") or [x.strip() for x in
                               str(b.get("content", "")).replace("›", "/").split("/") if x.strip()]
    return '<div class="wf-crumbs">' + " › ".join(esc(item_label(i)) for i in items) + "</div>"


def r_paragraph(b):
    cls = "wf-p wf-cap" if b.get("level") == "caption" else "wf-p"
    txt = b.get("content")
    if txt:
        return f'<p class="{cls}">{esc(txt)}</p>'
    # No copy declared: skeleton lines rather than lorem, so the gap stays visible.
    n = int(b.get("lines", 2))
    return '<div class="wf-plines">' + "".join(
        f'<span class="wf-sk" style="width:{95 if i < n - 1 else 60}%"></span>' for i in range(n)
    ) + "</div>"


def r_image(b):
    ar = b.get("aspect_ratio")
    style = f' style="aspect-ratio:{esc(ar.replace(":", "/"))}"' if ar else ""
    cap = esc(b.get("content") or "imagen")
    return f'<div class="wf-img"{style}><span>{cap}{f" · {esc(ar)}" if ar else ""}</span></div>'


def r_icon(b):
    return f'<span class="wf-icon" title="{esc(b.get("name") or b.get("content"))}">◻</span>'


def r_list(b):
    items = b.get("items")
    if items:
        rows = "".join(
            '<li><span class="wf-thumb"></span><span><b>{}</b>{}</span></li>'.format(
                esc(item_label(it)),
                f'<i>{esc(it.get("subtitle"))}</i>' if isinstance(it, dict) and it.get("subtitle") else "")
            for it in items)
    else:
        n = int(b.get("items_count", 3))
        rows = "".join('<li><span class="wf-thumb"></span>'
                       '<span class="wf-sk" style="width:70%"></span></li>' for _ in range(n))
    return f'<ul class="wf-list">{rows}</ul>'


def r_card(b):
    body = f'<p class="wf-p">{esc(b.get("paragraph"))}</p>' if b.get("paragraph") else ""
    title = f'<b>{esc(b.get("content"))}</b>' if b.get("content") else ""
    return f'<div class="wf-card wf-cardblock">{title}{body}</div>'


def r_avatar(b):
    return f'<span class="wf-avatar">{esc((b.get("content") or "·")[:2])}</span>'


def r_badge(b):
    return f'<span class="wf-badge" data-kind="{esc(b.get("kind",""))}">{esc(b.get("content"))}</span>'


def r_chart(b):
    kind = b.get("kind", "bar")
    if kind == "line":
        marks = ('<svg class="wf-spark" viewBox="0 0 100 40" preserveAspectRatio="none">'
                 '<polyline points="0,32 20,18 40,24 60,10 80,16 100,6"/></svg>')
    else:
        hs = [55, 80, 40, 95, 65, 50]
        marks = '<div class="wf-bars">' + "".join(
            f'<span style="height:{h}%"></span>' for h in hs) + "</div>"
    lab = f'<b>{esc(b.get("content"))}</b>' if b.get("content") else ""
    return f'<div class="wf-chart">{lab}{marks}</div>'


def _check(b, shape):
    on = b.get("checked") or b.get("selected")
    mark = "✓" if (on and shape == "box") else ("●" if on else "")
    return (f'<label class="wf-check"><span class="wf-{shape}">{mark}</span>'
            f'{esc(b.get("content"))}</label>')


def r_checkbox(b):
    return _check(b, "box")


def r_radio(b):
    return _check(b, "dot")


def r_toggle(b):
    on = "on" if b.get("on", True) else ""
    return (f'<label class="wf-check"><span class="wf-switch {on}"></span>'
            f'{esc(b.get("content"))}</label>')


def r_slider(b):
    fill = max(0.0, min(float(b.get("fill", 0.5)), 1.0)) * 100
    lab = f'<div class="wf-lbl">{esc(b.get("content"))}</div>' if b.get("content") else ""
    return (f'{lab}<div class="wf-slider"><span class="wf-track">'
            f'<span style="width:{fill:.0f}%"></span></span>'
            f'<span class="wf-thumb2" style="left:{fill:.0f}%"></span></div>')


def r_alert(b):
    return f'<div class="wf-alert" data-kind="{esc(b.get("kind","error"))}">{esc(b.get("content"))}</div>'


def r_progress(b):
    fill = max(0.0, min(float(b.get("fill", 0.6)), 1.0)) * 100
    return f'<div class="wf-prog"><span style="width:{fill:.0f}%"></span></div>'


def r_tooltip(b):
    return f'<div class="wf-tip">{esc(b.get("content"))}</div>'


RENDERERS = {
    "header": r_header, "sidebar": r_sidebar, "heading": r_heading, "label": r_label,
    "button": r_button, "link": r_link, "text-input": r_text_input, "textarea": r_textarea,
    "dropdown": r_dropdown, "date-picker": r_date_picker, "search-bar": r_search,
    "table": r_table, "card-list": r_card_list, "chips": r_chips, "loader": r_loader,
    "empty-state": r_empty, "toast": r_toast, "pagination": r_pagination, "section": r_section,
    # the 21 completed here
    "footer": r_footer, "main": r_main, "modal": r_modal, "nav-bar": r_nav_bar, "tabs": r_tabs,
    "breadcrumbs": r_breadcrumbs, "paragraph": r_paragraph, "image": r_image, "icon": r_icon,
    "list": r_list, "card": r_card, "avatar": r_avatar, "badge": r_badge, "chart": r_chart,
    "checkbox": r_checkbox, "radio": r_radio, "toggle": r_toggle, "slider": r_slider,
    "alert": r_alert, "progress-bar": r_progress, "tooltip": r_tooltip,
}


def render_block(b):
    fn = RENDERERS.get(b["type"])
    if fn is None:
        # Explicit, visible fallback. Silent fallbacks are how the old renderer
        # ended up drawing tables as empty boxes.
        return (f'<div class="wf-unknown">tipo sin renderer: <code>{esc(b["type"])}</code> '
                f'({esc(b.get("name"))})</div>')
    out = fn(b)
    if b.get("annotation"):
        out += f'<p class="wf-ann">{esc(b["annotation"])}</p>'
    return out


# ---------------------------------------------------------------- state visibility

def visible(b, state, viewport=None):
    """Two independent dimensions: viewport and state. Hidden in either means not rendered."""
    if viewport:
        only_vp = [v.lower() for v in b.get("visible_only_in_viewports", [])]
        hid_vp = [v.lower() for v in b.get("hidden_in_viewports", [])]
        if only_vp and viewport not in only_vp:
            return False
        if viewport in hid_vp:
            return False
    only = [s.lower() for s in b.get("visible_only_in_states", [])]
    hid = [s.lower() for s in b.get("hidden_in_states", [])]
    st = state.lower()
    if only:
        return st in only
    return st not in hid


def _patch(b, key, field):
    ov = b.get(field) or {}
    p = ov.get(key) or ov.get(key.lower())
    if not p:
        return b
    merged = dict(b)
    merged.update(p)
    return merged


def effective(b, state, viewport=None):
    """Viewport overrides apply first, then state ones — state wins on conflict, because it is
    the transient dimension (a button that is primary on desktop still goes disabled while
    loading)."""
    out = b
    if viewport:
        out = _patch(out, viewport, "viewport_overrides")
    return _patch(out, state, "state_overrides")


# ---------------------------------------------------------------- layout engine

CHROME = {"header", "footer"}

# Types whose whole point is prose. A 90px column of these is unreadable; a 90px
# column of a button or an avatar is merely tight, so it is not worth a warning.
TEXT_BEARING = {"heading", "paragraph", "list", "table", "card", "card-list",
                "alert", "breadcrumbs", "text-input", "textarea"}


def render_items(items, blocks, state, viewport=None, seen=None, nav=None):
    out = []
    for item in items:
        if isinstance(item, str):
            if seen is not None:
                seen.add(item)
            b = blocks.get(item)
            if b is None or b["type"] in CHROME or not visible(b, state, viewport):
                continue
            html_ = render_block(effective(b, state, viewport))
            # A block that triggers a transition becomes a jump inside the book.
            jump = (nav or {}).get(item)
            if jump:
                html_ = (f'<div class="wf-goto" data-goto="{esc(jump["dst"])}" '
                         f'title="{esc(jump["trigger"] or "ir a " + jump["dst"])}">{html_}</div>')
            out.append(html_)
        else:
            out.append(render_row(item, blocks, state, viewport, seen, nav))
    return "".join(out)


def render_row(row, blocks, state, viewport=None, seen=None, nav=None):
    cols = row.get("cols", [])
    # A row with an explicit CSS template keeps the real thing (e.g. a fixed 420px
    # column) instead of forcing it into twelfths.
    if row.get("fixed_cols"):
        tpl = row["fixed_cols"]
    else:
        tpl = " ".join(f'{c.get("w", 1)}fr' for c in cols)
    cells = []
    for c in cols:
        inner = render_items(c.get("stack", []), blocks, state, viewport, seen, nav)
        cls = "wf-col wf-card" if c.get("card") else "wf-col"
        cells.append(f'<div class="{cls}">{inner}</div>')
    ann = f'<p class="wf-ann">{esc(row["annotation"])}</p>' if row.get("annotation") else ""
    return (f'<div class="wf-row" style="grid-template-columns:{esc(tpl)}">'
            + "".join(cells) + "</div>" + ann)


def render_screen(screen, viewport, state, warn=None, nav=None):
    blocks = {b["name"]: b for b in screen["blocks"]}
    layouts = screen.get("layouts") or {}
    layout = layouts.get(viewport) or layouts.get(viewport.lower())
    declared_layout = layout is not None
    if layout is None:
        layout = [b["name"] for b in screen["blocks"]]

    chrome = [b for b in screen["blocks"]
              if b["type"] == "header" and visible(b, state, viewport)]
    head = "".join(render_block(effective(b, state, viewport)) for b in chrome)
    seen = set()
    body = render_items(layout, blocks, state, viewport, seen, nav)

    # A layout REPLACES the default stack, so a block it never mentions is never drawn. That is
    # a silent way to lose most of a screen while the frame still looks fine.
    if declared_layout and warn and state.lower() == "default":
        missing = [b["name"] for b in screen["blocks"]
                   if b["type"] not in CHROME and b["name"] not in seen
                   and visible(b, state, viewport)]
        if missing:
            warn(f"{screen['name']} ({viewport}): {len(missing)} bloque(s) declarados pero ausentes "
                 f"del layout, no se dibujan: {', '.join(missing[:6])}"
                 f"{'…' if len(missing) > 6 else ''}")
    # A layout whose top level is a single shell row (sidebar + content) manages its own
    # padding, because the sidebar has to reach the frame edges. Anything else is a plain
    # stack and needs the frame's own gutter.
    shell = len(layout) == 1 and isinstance(layout[0], dict)
    cls = "wf-body" + ("" if shell else " wf-pad")
    return f'<div class="wf-screen">{head}<div class="{cls}">{body}</div></div>'


# ---------------------------------------------------------------- book assembly

DEFAULT_ACCENT = "#4a4a4a"

ICON_GLYPH = '<span class="wf-ico">\u25fb</span>'

CSS = """
:root{
  --ink:#1f2328; --mut:#7a828a; --line:#c3c9cf; --fill:#f4f6f8; --paper:#fff;
  --accent:__ACCENT__; --ann:#b0468c; --u:8px;
}
*{box-sizing:border-box;margin:0}
body{font-family:Excalifont,'Patrick Hand','Comic Neue',system-ui,sans-serif;
  color:var(--ink);background:#eceff1;display:flex;height:100vh;overflow:hidden;font-size:14px}

/* ---- chrome of the book itself (not the wireframe) ---- */
aside.book{width:250px;flex:0 0 auto;background:#fafbfc;border-right:1px solid var(--line);
  overflow:auto;padding:14px;font-family:system-ui,sans-serif}
aside.book h1{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--mut);margin-bottom:10px}
aside.book a{display:block;padding:7px 9px;border-radius:5px;color:var(--ink);
  text-decoration:none;font-size:13px;cursor:pointer}
aside.book a:hover{background:#eef1f4}
aside.book a.on{background:var(--ink);color:#fff}
aside.book .vp{font-size:11px;color:var(--mut);margin-left:6px}
main.book{flex:1;overflow:auto;padding:20px}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;
  font-family:system-ui,sans-serif}
.bar button{border:1px solid var(--line);background:#fff;border-radius:5px;padding:5px 11px;
  font-size:12px;cursor:pointer;font-family:inherit}
.bar button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.bar .sep{width:1px;height:20px;background:var(--line)}
.bar .rt{margin-left:auto;font-size:12px;color:var(--mut)}
body.noann .wf-ann{display:none}

/* ---- the wireframe frame ---- */
.wf-screen{background:var(--paper);border:2px solid var(--ink);margin:0 auto;
  display:flex;flex-direction:column;min-height:600px;transition:width .15s ease}
.wf-body{flex:1;display:flex;flex-direction:column;min-width:0}
.wf-header{height:52px;flex:0 0 auto;border-bottom:2px solid var(--ink);display:flex;
  align-items:center;justify-content:space-between;padding:0 14px}
.wf-burger{font-size:20px}

/* ---- layout: real CSS grid ---- */
.wf-row{display:grid;gap:calc(var(--u)*1.5);align-items:start;padding:0}
.wf-row>*{min-width:0}                     /* else grid children refuse to shrink */
.wf-col{display:flex;flex-direction:column;gap:calc(var(--u)*1.25);min-width:0}
.wf-pad{padding:calc(var(--u)*2);gap:calc(var(--u)*1.25)}
/* The shell row: sidebar column flush to the frame edge, content column gets the gutter.
   `align-items:stretch` is what makes the sidebar reach the footer. */
.wf-body>.wf-row{flex:1;gap:0;align-items:stretch}
.wf-body>.wf-row>.wf-col{gap:0}
.wf-body>.wf-row>.wf-col:not(:has(>.wf-sidebar)){padding:calc(var(--u)*2);
  gap:calc(var(--u)*1.25)}
.wf-sidebar{background:var(--fill);border-right:1px solid var(--line);padding:12px;
  flex:1}
.wf-sidebar b{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;
  color:var(--mut);margin-bottom:8px}
.wf-sidebar a{display:block;padding:6px 8px;border-radius:4px;font-size:13px}
.wf-sidebar a.on{background:var(--accent);color:#fff}

/* ---- primitives ---- */
.wf-h{font-size:19px;font-weight:700}
h2.wf-h{font-size:15px}
.wf-lbl{font-size:12px;color:var(--mut)}
.wf-btn{border:1.5px solid var(--ink);border-radius:5px;padding:8px 14px;background:var(--paper);
  font:inherit;font-size:13px;cursor:default;width:100%}
.wf-btn[data-variant=primary]{background:var(--accent);border-color:var(--accent);color:#fff}
.wf-btn[data-variant=disabled]{background:var(--fill);border-color:var(--line);color:var(--mut)}
.wf-btn[data-variant=secondary]{background:var(--paper)}
.wf-link{color:var(--accent);text-decoration:underline;font-size:13px;display:inline-block;padding:8px 0}
.wf-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.wf-field label{font-size:12px;color:var(--mut)}
.wf-ctl{border:1.5px solid var(--line);border-radius:5px;padding:8px 10px;background:var(--paper);
  font-size:13px;display:flex;align-items:center;gap:6px;min-height:36px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wf-ctl[data-state=disabled]{background:var(--fill);color:var(--mut)}
.wf-area{min-height:90px;align-items:flex-start;color:var(--mut)}
.wf-caret{margin-left:auto;color:var(--mut);font-size:11px}
.wf-ico{color:var(--mut);font-size:14px}
.wf-card{border:1.5px solid var(--line);border-radius:6px;background:var(--paper);padding:14px}
.wf-tablewrap{padding:0;overflow:hidden}
.wf-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px}
/* border-box so the declared %ages stay true once padding is added — otherwise the last
   columns get pushed past the frame edge. */
.wf-table th,.wf-table td{box-sizing:border-box;padding:9px 10px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wf-table th{text-align:left;background:var(--fill);
  border-bottom:1.5px solid var(--line);font-size:11px;text-transform:uppercase;
  letter-spacing:.04em;color:#555}
.wf-table td{border-bottom:1px solid #e8ebee}
.wf-table tbody tr:last-child td{border-bottom:none}
.wf-badge{display:inline-block;border:1px solid var(--line);border-radius:999px;
  padding:1px 9px;font-size:11px;background:var(--fill);white-space:nowrap}
.wf-badges{display:flex;gap:5px;flex-wrap:wrap}
.wf-sk{display:inline-block;height:9px;background:#dfe3e7;border-radius:3px}
.wf-stack{display:flex;flex-direction:column;gap:var(--u)}
.wf-rowcard{border:1.5px solid var(--line);border-radius:6px;padding:11px;
  display:flex;flex-direction:column;gap:6px}
.wf-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--mut)}
.wf-rctitle{font-size:14px;font-weight:700;line-height:1.3}
.wf-loader{border:1.5px dashed var(--line);border-radius:6px;padding:32px;text-align:center;
  color:var(--mut);font-size:13px}
.wf-empty{border:1.5px dashed var(--line);border-radius:6px;padding:40px 20px;text-align:center;
  display:flex;flex-direction:column;gap:6px}
.wf-empty b{font-size:15px}
.wf-empty span{font-size:13px;color:var(--mut)}
.wf-toast{border:1.5px solid var(--ink);border-radius:6px;padding:10px 14px;font-size:13px;
  background:var(--fill);align-self:flex-end;max-width:380px}
.wf-pg{display:flex;gap:5px}
.wf-pg span{border:1px solid var(--line);border-radius:4px;padding:4px 9px;font-size:12px}
.wf-pg span.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.wf-section{border:1px dashed var(--line);border-radius:5px;padding:10px;min-height:36px}
.wf-ann{color:var(--ann);font-size:11px;font-style:italic;line-height:1.35}
.wf-ann::before{content:"› "}
.wf-unknown{border:2px solid #c92a2a;color:#c92a2a;border-radius:5px;padding:8px;font-size:12px}

aside.book .meta{font-size:11px;color:var(--mut);margin:-6px 0 10px;font-family:system-ui,sans-serif}
aside.book a.ov{padding-left:18px;position:relative}
aside.book a.ov::before{content:"↳";position:absolute;left:5px;color:var(--mut)}

/* ---- types completed beyond the prototype ---- */
.wf-footer{border-top:1px solid var(--line);padding:8px 12px;color:var(--mut);font-size:12px;margin-top:auto}
.wf-main{border:1px dashed var(--line);padding:12px;color:var(--mut);min-height:60px}
.wf-modalwrap{background:rgba(31,35,40,.12);padding:24px;display:flex;justify-content:center}
.wf-modal{background:var(--paper);border:1px solid var(--ink);border-radius:6px;padding:16px;
  min-width:60%;box-shadow:0 6px 0 rgba(31,35,40,.10)}
.wf-navbar{display:flex;border-top:1px solid var(--line);padding:8px 0;margin-top:auto}
.wf-navbar span{flex:1;text-align:center;color:var(--mut);font-size:12px}
.wf-navbar span.on{color:var(--ink);font-weight:600}
.wf-tabs{display:flex;gap:16px;border-bottom:1px solid var(--line)}
.wf-tabs span{padding:6px 2px;color:var(--mut)}
.wf-tabs span.on{color:var(--ink);border-bottom:2px solid var(--ink);font-weight:600}
.wf-crumbs{color:var(--mut);font-size:12px}
.wf-p{line-height:1.5}
.wf-cap{color:var(--mut);font-size:12px}
.wf-plines{display:flex;flex-direction:column;gap:6px}
.wf-img{border:1px solid var(--line);background:var(--fill);min-height:80px;display:flex;
  align-items:center;justify-content:center;color:var(--mut);font-size:12px}
.wf-icon{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;color:var(--mut)}
.wf-list{list-style:none;display:flex;flex-direction:column;gap:8px}
.wf-list li{display:flex;gap:10px;align-items:center;padding:8px;border:1px solid var(--line);background:var(--paper)}
.wf-list i{display:block;color:var(--mut);font-size:12px;font-style:normal}
.wf-thumb{width:28px;height:28px;flex:0 0 auto;background:var(--fill);border:1px solid var(--line)}
.wf-cardblock{padding:12px;display:flex;flex-direction:column;gap:6px}
.wf-avatar{display:inline-flex;width:32px;height:32px;border-radius:50%;border:1px solid var(--line);
  background:var(--fill);align-items:center;justify-content:center;font-size:12px;color:var(--mut)}
.wf-chart{border:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px}
.wf-bars{display:flex;gap:8px;align-items:flex-end;height:120px}
.wf-bars span{flex:1;background:var(--fill);border:1px solid var(--line)}
.wf-spark{width:100%;height:120px;fill:none;stroke:var(--ink);stroke-width:2}
.wf-check{display:flex;gap:8px;align-items:center}
.wf-box,.wf-dot{width:16px;height:16px;flex:0 0 auto;border:1px solid var(--ink);background:var(--paper);
  display:inline-flex;align-items:center;justify-content:center;font-size:11px}
.wf-dot{border-radius:50%}
.wf-switch{width:34px;height:18px;border-radius:9px;border:1px solid var(--ink);background:var(--paper);
  position:relative;flex:0 0 auto}
.wf-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;
  background:var(--line)}
.wf-switch.on::after{left:auto;right:2px;background:var(--ink)}
.wf-slider{position:relative;height:20px;display:flex;align-items:center}
.wf-track{flex:1;height:4px;background:var(--fill);border:1px solid var(--line);display:block}
.wf-track span{display:block;height:100%;background:var(--ink)}
.wf-thumb2{position:absolute;width:14px;height:14px;border-radius:50%;border:1px solid var(--ink);
  background:var(--paper);transform:translateX(-50%)}
.wf-alert{border:1px solid var(--ink);border-left-width:4px;padding:8px 10px;background:var(--fill)}
.wf-alert[data-kind=error]{border-left-color:#b4232c}
.wf-alert[data-kind=warning]{border-left-color:#b07000}
.wf-alert[data-kind=success]{border-left-color:#2f7a3f}
.wf-prog{height:8px;background:var(--fill);border:1px solid var(--line)}
.wf-prog span{display:block;height:100%;background:var(--ink)}
.wf-tip{display:inline-block;border:1px solid var(--line);background:var(--paper);padding:4px 8px;
  font-size:12px;color:var(--mut);border-radius:4px}
/* a block that navigates: clickable, replaces the transition arrows */
.wf-goto{cursor:pointer;position:relative}
.wf-goto::after{content:"→";position:absolute;right:-16px;top:50%;transform:translateY(-50%);
  color:var(--ann);font-size:12px}
.wf-goto:hover{outline:2px dashed var(--ann);outline-offset:2px}
"""

JS = """
const S = window.__SCREENS__;
const stage = document.getElementById('stage');
const bar   = document.getElementById('bar');
const nav   = document.getElementById('nav');
let cur = 0, vp = null, st = null;

function chip(label, on, fn){
  const b = document.createElement('button');
  b.textContent = label; if(on) b.className = 'on';
  b.onclick = fn; return b;
}

function draw(){
  const s = S[cur];
  if(!s.viewports.includes(vp)) vp = s.viewports[0];
  if(!s.states.includes(st))    st = s.states[0];

  bar.innerHTML = '';
  s.viewports.forEach(v => bar.appendChild(chip(v + ' · ' + s.widths[v], v === vp,
    () => { vp = v; draw(); })));
  const sp = document.createElement('span'); sp.className = 'sep'; bar.appendChild(sp);
  s.states.forEach(x => bar.appendChild(chip(x, x === st, () => { st = x; draw(); })));
  const sp2 = document.createElement('span'); sp2.className = 'sep'; bar.appendChild(sp2);
  bar.appendChild(chip('anotaciones', !document.body.classList.contains('noann'),
    () => { document.body.classList.toggle('noann'); draw(); }));
  const rt = document.createElement('span');
  rt.className = 'rt'; rt.textContent = s.route || '';
  bar.appendChild(rt);

  stage.innerHTML = s.html[vp][st] || '<p>sin render</p>';
  const f = stage.querySelector('.wf-screen');
  if(f) f.style.width = s.widths[vp] + 'px';

  // Blocks that trigger a transition jump to the destination screen. This is what replaces the
  // arrows the Excalidraw canvas used to draw between frames: the flow is walked, not read.
  stage.querySelectorAll('[data-goto]').forEach(el => {
    el.onclick = ev => {
      ev.stopPropagation();
      const i = S.findIndex(x => x.name === el.dataset.goto);
      if(i >= 0){ cur = i; draw(); window.scrollTo(0,0); }
    };
  });

  [...nav.children].forEach((a,i) => a.className = (i === cur ? 'on' : ''));
}

S.forEach((s,i) => {
  const a = document.createElement('a');
  const tag = s.overlay ? '<span class="vp">' + (s.overlayType || 'overlay') + '</span>'
                        : '<span class="vp">' + s.viewports.join('/') + '</span>';
  a.innerHTML = s.displayName + tag;
  if(s.overlay) a.classList.add('ov');
  a.onclick = () => { cur = i; draw(); };
  nav.appendChild(a);
});
draw();
"""


def warn(msg):
    print(f"[build_book] WARN: {msg}", file=sys.stderr)


def state_names(sc):
    """Accept both shapes of `states`.

    The skill emits `[{"name": "...", "applies": true}, ...]`; the prototype used a plain list of
    names. Normalising here keeps the schema untouched.
    """
    out = []
    for st in sc.get("states") or []:
        if isinstance(st, dict):
            if st.get("applies", True):
                out.append(st["name"])
        else:
            out.append(st)
    return out or ["default"]


def surface_viewports(spec):
    vps = spec.get("viewports")
    if not vps:
        vps = [spec.get("device") or "mobile"]      # deprecated single-viewport alias
    vps = [v for v in vps if v in VIEWPORT_W]
    return [v for v in VIEWPORT_ORDER if v in vps] or ["desktop"]


def navigation_map(spec):
    """srcBlock -> destination screen, per source screen.

    Replaces the transition arrows: instead of drawing a line between frames, the block that
    triggers the transition becomes clickable and jumps to the destination inside the book. The
    reader navigates the flow rather than reading it, and there is no arrow geometry to compute.
    """
    nav = {}
    for t in spec.get("transitions") or []:
        src, blk, dst = t.get("src"), t.get("srcBlock"), t.get("dst")
        if src and blk and dst:
            nav.setdefault(src, {})[blk] = {"dst": dst, "trigger": t.get("trigger", "")}
    return nav


MIN_LEGIBLE_COL = 180   # below this a text column wraps one word per line
ROW_GAP = 12            # keep in sync with .wf-row{gap:calc(var(--u)*1.5)}
COL_PAD = 32            # .wf-body>.wf-row>.wf-col padding, both sides


def _resolve_template(tpl, cols, free):
    """Approximate what the browser will do with a grid-template-columns string.

    Only the two forms the specs actually use are modelled: a px literal and an
    fr weight (bare or wrapped in minmax(0,Nfr)). Anything else is treated as
    flexible with weight 1. This is an estimate for warning purposes ONLY — the
    real layout is still the browser's.
    """
    if not tpl:
        total = sum(c.get("w", 1) for c in cols) or 1
        return [free * c.get("w", 1) / total for c in cols]
    parts, fixed, weights = tpl.replace(", ", ",").split(), [], []
    for part in parts:
        m = re.search(r"(\d+(?:\.\d+)?)px", part)
        if m and "fr" not in part:
            fixed.append(float(m.group(1))); weights.append(None)
        else:
            f = re.search(r"(\d+(?:\.\d+)?)fr", part)
            fixed.append(None); weights.append(float(f.group(1)) if f else 1.0)
    rest = free - sum(x for x in fixed if x)
    tw = sum(w for w in weights if w) or 1
    return [fx if fx is not None else max(0.0, rest) * w / tw
            for fx, w in zip(fixed, weights)]


def check_widths(items, avail, blocks, screen_name, viewport, warn, depth=0):
    """Warn when a row's fixed columns squeeze a flexible sibling below legibility.

    The renderer deliberately does no layout arithmetic — that is the browser's
    job and the reason this format replaced Excalidraw. This walk is not layout:
    it is a smoke alarm for a spec that asks for more width than the viewport has,
    which otherwise renders as a silently unreadable column.
    """
    for it in items:
        if not isinstance(it, dict) or not it.get("cols"):
            continue
        cols = it["cols"]
        free = avail - ROW_GAP * (len(cols) - 1)
        widths = _resolve_template(it.get("fixed_cols"), cols, free)
        for c, w in zip(cols, widths):
            names = [x for x in c.get("stack", []) if isinstance(x, str)]
            texty = [n for n in names
                     if (blocks.get(n) or {}).get("type") in TEXT_BEARING]
            if w < MIN_LEGIBLE_COL and texty:
                warn(f"{screen_name} ({viewport}): la columna de "
                     f"'{it.get('row') or 'row'}' que contiene {', '.join(texty[:3])} "
                     f"queda en ~{int(w)}px. Debajo de {MIN_LEGIBLE_COL}px el texto "
                     f"se parte palabra por palabra — revisa los anchos fijos de esa fila")
            check_widths(c.get("stack", []), w, blocks, screen_name, viewport,
                         warn, depth + 1)


def viewport_widths(spec):
    """Per-surface viewport widths, defaulting to VIEWPORT_W.

    A brownfield survey measures a real browser, and the fixed px columns it
    records only add up at the width they were measured at. Rendering those
    numbers into a narrower canvas silently crushes the flexible columns, so the
    width has to be a property of the surface rather than a constant.
    """
    out = dict(VIEWPORT_W)
    for k, v in (spec.get("viewport_widths") or {}).items():
        try:
            w = int(v)
        except (TypeError, ValueError):
            continue
        if 320 <= w <= 3840:
            out[k.lower()] = w
    return out


def build(spec_path, out_path, font_path=None):
    spec = json.loads(Path(spec_path).read_text(encoding="utf-8"))

    font_css = ""
    if font_path and Path(font_path).exists():
        b64 = base64.b64encode(Path(font_path).read_bytes()).decode()
        font_css = ("@font-face{font-family:Excalifont;"
                    f"src:url(data:font/woff2;base64,{b64}) format('woff2');font-display:block}}\n")

    surface_vps = surface_viewports(spec)
    vw = viewport_widths(spec)
    nav = navigation_map(spec)
    known = {sc["name"] for sc in spec["screens"]}
    for src, blks in nav.items():
        for blk, info in list(blks.items()):
            if info["dst"] not in known:
                warn(f"transición de '{src}' a una pantalla inexistente: '{info['dst']}' — se ignora")
                del blks[blk]

    # An item object with no recognizable label key renders as an empty chip. That is
    # exactly the kind of silent loss this renderer exists to stop, so say it out loud.
    for sc in spec["screens"]:
        for blk in sc.get("blocks", []):
            for it in (blk.get("items") or []) + (blk.get("labels") or []):
                if isinstance(it, dict) and not item_label(it):
                    warn(f"{sc['name']} / {blk.get('name')}: item sin title/label/text/name "
                         f"({sorted(it)}) — se dibuja vacio")

    for sc in spec["screens"]:
        bl = {b["name"]: b for b in sc.get("blocks", [])}
        for vp, lay in (sc.get("layouts") or {}).items():
            if vp in surface_vps:
                check_widths(lay, vw.get(vp, 1200) - COL_PAD,
                             bl, sc["name"], vp, warn)

    payload = []
    for sc in spec["screens"]:
        vps = [v for v in (sc.get("viewports") or surface_vps) if v in surface_vps] or surface_vps
        states = state_names(sc)
        htmls = {v: {st: render_screen(sc, v, st, warn=warn, nav=nav.get(sc["name"]))
                     for st in states} for v in vps}
        payload.append({
            "name": sc["name"], "displayName": sc["displayName"], "route": sc.get("route", ""),
            "viewports": vps, "states": states,
            "overlay": bool(sc.get("overlay")),
            "overlayType": sc.get("overlay_type", ""),
            "triggeredBy": sc.get("triggered_by", ""),
            "widths": {v: vw.get(v, 1200) for v in vps},
            "html": htmls,
        })

    # The accent is the ONE color in the book: primary buttons, links, active tabs.
    # It comes from the surface's design system (color.brand.primary) via screens.json.
    accent = str(spec.get("accent_color") or "").strip()
    if not re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?", accent):
        if accent and warn:
            warn(f"accent_color invalido ({accent!r}), uso el gris por defecto")
        accent = DEFAULT_ACCENT
    css = CSS.replace("__ACCENT__", accent)

    doc = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Wireframes · {esc(spec['surface'])}</title>
<style>{font_css}{css}</style></head><body>
<aside class="book"><h1>Superficie {esc(spec['surface'])}</h1>
<p class="meta">{esc(spec.get('platform','web'))} · {esc(' · '.join(surface_vps))}</p>
<div id="nav"></div></aside>
<main class="book"><div class="bar" id="bar"></div><div id="stage"></div></main>
<script>window.__SCREENS__ = {json.dumps(payload, ensure_ascii=False)};</script>
<script>{JS}</script></body></html>"""

    Path(out_path).write_text(doc, encoding="utf-8")
    kb = len(doc.encode()) / 1024
    n = sum(len(p["html"][v]) for p in payload for v in p["html"])
    print(f"Wrote {out_path} — {len(payload)} screens, {n} screen-states, {kb:.0f} KB")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
