"""The visual reference of a requirement: the screens of a design package, the route and state of the
product each one corresponds to, and the differences decided on purpose. `pairs` puts each reference
next to the screenshot of the product, so the agent and the verifier compare the same images.
See .claude/specs/requirement.md («Visual reference»)."""

import re
from pathlib import Path

from .md import table_dicts

SECTION = "Visual reference"
PACKAGE_RE = re.compile(r"^(?:Package|Paquete):\s*`([^`]+)`", re.M)
SIDE = 900          # width of each half of a pair, in pixels
LABEL_H = 36


def parse(spec):
    """(package path or None, screens [{Screen, Reference, Route, State}], decided [{…}])."""
    text = spec.technical().get(SECTION, "")
    if not text:
        return None, [], []
    m = PACKAGE_RE.search(text)
    lines = text.splitlines()
    return (m.group(1).strip() if m else None,
            table_dicts(lines, "Screen"),
            table_dicts(lines, "Decided difference"))


def _width(path):
    from PIL import Image
    with Image.open(path) as im:
        return im.width


def capture_for(shots, screen):
    """The widest screenshot of the screen: `{Screen}.png` or `{Screen}-{size}.png`."""
    found = [p for p in shots.glob(f"{screen}*.png")
             if p.stem == screen or p.stem.startswith(screen + "-")]
    return max(found, key=_width) if found else None


ZONE_SIDE = 1100    # width of each half of a zone, in pixels
ZONE_H = 700        # target height of a zone, at ZONE_SIDE
OVERLAP = 0.04      # each zone repeats this fraction of the page above and below


def _scaled(path, width):
    from PIL import Image
    im = Image.open(path).convert("RGB")
    return im.resize((width, max(1, round(im.height * width / im.width))))


def _side_by_side(a, b, labels, out):
    from PIL import Image, ImageDraw
    side, gap = a.width, 24
    canvas = Image.new("RGB", (side * 2 + gap, LABEL_H + max(a.height, b.height)), "white")
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 10), labels[0], fill="black")
    draw.text((side + gap + 8, 10), labels[1], fill="black")
    canvas.paste(a, (0, LABEL_H))
    canvas.paste(b, (side + gap, LABEL_H))
    draw.line([(side + gap // 2, 0), (side + gap // 2, canvas.height)], fill="red", width=2)
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, optimize=True)


def _pair(ref, cap, out):
    """The whole screen side by side, and the same page cut in zones (top to bottom, by the same
    fraction of each page's height) at a higher resolution: `{screen}.png`, `{screen}-z{n}.png`."""
    labels = (f"REFERENCE  {ref.name}", f"PRODUCT  {cap.name}")
    _side_by_side(_scaled(ref, SIDE), _scaled(cap, SIDE), labels, out)
    a, b = _scaled(ref, ZONE_SIDE), _scaled(cap, ZONE_SIDE)
    n = max(1, round(max(a.height, b.height) / ZONE_H))
    for old in out.parent.glob(f"{out.stem}-z*.png"):
        old.unlink()
    if n == 1:
        return 1
    for i in range(n):
        lo, hi = max(0.0, i / n - OVERLAP), min(1.0, (i + 1) / n + OVERLAP)
        za = a.crop((0, round(lo * a.height), a.width, round(hi * a.height)))
        zb = b.crop((0, round(lo * b.height), b.width, round(hi * b.height)))
        zl = tuple(f"{l}  zone {i + 1}/{n}" for l in labels)
        _side_by_side(za, zb, zl, out.with_name(f"{out.stem}-z{i + 1}.png"))
    return n


def pairs(repo, spec):
    """[(screen, reference, capture, pair, zones, problem)] — writes reports/screenshots/{id}/pairs/."""
    package, screens, _ = parse(spec)
    shots = repo.root / "reports" / "screenshots" / str(spec.id)
    base = Path(package) if package else None
    if base is not None and not base.is_absolute():
        base = repo.root / base
    rows = []
    for s in screens:
        screen = s.get("Screen", "").strip().strip("`")
        ref = (base / s.get("Reference", "").strip().strip("`")) if base else None
        cap = capture_for(shots, screen) if shots.is_dir() else None
        problem = ""
        if base is None:
            problem = "the section does not name the package («Package: `path`»)"
        elif not ref or not ref.is_file():
            problem = f"the reference {ref} does not exist"
        elif cap is None:
            problem = f"no screenshot {shots.relative_to(repo.root)}/{screen}[-size].png"
        out = shots / "pairs" / f"{screen}.png"
        zones = 0 if problem else _pair(ref, cap, out)
        rows.append((screen, ref, cap, None if problem else out, zones, problem))
    return rows
