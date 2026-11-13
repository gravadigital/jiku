"""Markdown helpers: frontmatter, sections, tables. Standard library only."""

import re
from pathlib import Path

FRONT_RE = re.compile(r"^---\n(.*?)\n---\n?", re.S)


# ---------- minimal YAML (the subset our documents use) ----------

def _scalar(v):
    v = v.strip()
    if v == "":
        return ""
    if (v.startswith("'") and v.endswith("'")) or (v.startswith('"') and v.endswith('"')):
        return v[1:-1]
    if v.startswith("[") and v.endswith("]"):
        inner = v[1:-1].strip()
        return [_scalar(x) for x in split_top(inner)] if inner else []
    if v.lower() in ("true", "yes"):
        return True
    if v.lower() in ("false", "no"):
        return False
    if re.fullmatch(r"-?\d+", v):
        return int(v)
    return v


def split_top(s, sep=","):
    """Split on sep outside brackets and quotes."""
    out, depth, cur, q = [], 0, "", None
    for ch in s:
        if q:
            cur += ch
            if ch == q:
                q = None
            continue
        if ch in "'\"":
            q = ch
        elif ch in "[{(":
            depth += 1
        elif ch in "]})":
            depth -= 1
        if ch == sep and depth == 0:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur.strip())
    return out


def parse_yaml(text):
    """Mappings nested by indentation, scalars, inline lists and block lists of scalars."""
    rows = []
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        line = re.sub(r"\s+#(?![^'\"]*['\"]).*$", "", raw).rstrip()
        rows.append((len(line) - len(line.lstrip()), line.strip()))

    def block(i, indent):
        if i < len(rows) and rows[i][1].startswith("- "):
            items = []
            while i < len(rows) and rows[i][0] == indent and rows[i][1].startswith("- "):
                items.append(_scalar(rows[i][1][2:]))
                i += 1
            return items, i
        out = {}
        while i < len(rows) and rows[i][0] == indent:
            s = rows[i][1]
            if ":" not in s:
                i += 1
                continue
            k, v = s.split(":", 1)
            i += 1
            if v.strip():
                out[k.strip()] = _scalar(v)
            elif i < len(rows) and rows[i][0] > indent:
                out[k.strip()], i = block(i, rows[i][0])
            elif i < len(rows) and rows[i][0] == indent and rows[i][1].startswith("- "):
                out[k.strip()], i = block(i, indent)
            else:
                out[k.strip()] = None
        return out, i

    result, _ = block(0, rows[0][0]) if rows else ({}, 0)
    return result if isinstance(result, dict) else {}


def parse_yaml_lists(text):
    return parse_yaml(text)


def dump_value(v):
    if isinstance(v, list):
        return "[" + ", ".join(dump_value(x) for x in v) + "]"
    if isinstance(v, bool):
        return "true" if v else "false"
    if v is None:
        return ""
    s = str(v)
    if s.startswith("#") or ": " in s or s.startswith("[") or s.startswith("{"):
        return "'" + s.replace("'", "''") + "'"
    return s


# ---------- documents ----------

class Doc:
    """A markdown document with optional YAML frontmatter."""

    def __init__(self, path, text=None):
        self.path = Path(path)
        text = self.path.read_text(encoding="utf-8") if text is None else text
        self.front, self.body = {}, text
        self.front_order = []
        m = FRONT_RE.match(text)
        if m:
            self.body = text[m.end():]
            self.front = parse_yaml_lists(m.group(1))
            self.front_order = [l.split(":", 1)[0].strip() for l in m.group(1).splitlines()
                                if re.match(r"^[\w.-]+:", l)]

    @property
    def lines(self):
        return self.body.splitlines()

    def text(self):
        if not self.front:
            return self.body
        keys = self.front_order + [k for k in self.front if k not in self.front_order]
        fm = "\n".join(f"{k}: {dump_value(self.front[k])}".rstrip() for k in keys if k in self.front)
        return f"---\n{fm}\n---\n\n{self.body.lstrip()}"

    def save(self):
        self.path.write_text(self.text(), encoding="utf-8")

    def set(self, key, value):
        if key not in self.front_order:
            self.front_order.append(key)
        self.front[key] = value

    def sections(self, level=2):
        return sections(self.lines, level)


def sections(lines, level=2):
    """{title: [lines]} for headings of exactly `level` hashes, outside code fences."""
    out, cur, fence = {}, None, False
    for line in lines:
        if line.startswith("```"):
            fence = not fence
        if not fence and re.match(r"^#{%d} \S" % level, line):
            cur = line[level + 1:].strip()
            out[cur] = []
        elif cur is not None:
            out[cur].append(line)
    return out


def split_row(line):
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|") and not s.endswith("\\|"):
        s = s[:-1]
    cells, cur, i = [], "", 0
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s) and s[i + 1] == "|":
            cur += "\\|"
            i += 2
            continue
        if s[i] == "|":
            cells.append(cur.strip())
            cur = ""
        else:
            cur += s[i]
        i += 1
    cells.append(cur.strip())
    return cells


def tables(lines):
    """Yield (header, rows) for each markdown table in lines."""
    block = []
    for line in list(lines) + [""]:
        if line.strip().startswith("|"):
            block.append(line)
            continue
        if len(block) >= 2 and re.match(r"^\s*\|?\s*:?-{2,}", block[1]):
            cells = [split_row(r) for r in block]
            yield cells[0], cells[2:]
        block = []


def table_with(lines, first_col):
    for header, rows in tables(lines):
        if header and header[0] == first_col:
            return header, rows
    return None, []


def table_dicts(lines, first_col):
    header, rows = table_with(lines, first_col)
    if not header:
        return []
    return [dict(zip(header, r + [""] * (len(header) - len(r)))) for r in rows]


def render_table(header, rows):
    out = ["| " + " | ".join(header) + " |", "|" + "|".join("---" for _ in header) + "|"]
    for r in rows:
        cells = [str(c) for c in r] + [""] * (len(header) - len(r))
        out.append("| " + " | ".join(cells[:len(header)]) + " |")
    return "\n".join(out)


def bullets(lines):
    return [l.strip()[2:].strip() for l in lines if l.strip().startswith("- ")]


ID_PATTERN = r"(?:DEC-T\d{2,}|(?:U|INT|NFR|DEC|INV|GAR|CRED|[A-Z]{2,4})-E?\d+)"
ID_RE = re.compile(r"\b" + ID_PATTERN + r"\b")
RANGE_RE = re.compile(r"\b(U|INT|NFR|DEC|INV|GAR|CRED|[A-Z]{2,4})-(E?)(\d+)\.\.(?:\1-)?(E?)(\d+)\b")
LOCAL_AC_RE = re.compile(r"\b(\d+)-AC-(\d+)\b")
TEST_TAG_RE = re.compile(r"\[(" + ID_PATTERN + r"|\d+-AC-\d+)\]")


def ids_in(text):
    """Every definition ID in a text, expanding ranges like RES-04..08 and NOT-E1..E3."""
    text = LOCAL_AC_RE.sub(" ", text)
    found = []
    for p, e1, a, e2, b in RANGE_RE.findall(text):
        width = len(a) if not e1 else 0
        for n in range(int(a), int(b) + 1):
            found.append(f"{p}-{e1}{n:0{width}d}" if width else f"{p}-{e1}{n}")
    found += ID_RE.findall(text)
    seen, out = set(), []
    for x in found:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def is_id(s):
    return bool(re.fullmatch(ID_PATTERN, s))


def prefix_of(id_):
    """Block prefix or kind of an ID: CAN-E1 -> CAN, DEC-T03 -> DEC-T, INV-02 -> INV."""
    if id_.startswith("DEC-T"):
        return "DEC-T"
    return id_.split("-", 1)[0]


def id_sort_key(id_):
    m = re.match(r"^(DEC-T|.*?)-?(E?)(\d+)$", id_)
    if not m:
        return (id_, 0, 0)
    return (m.group(1), 1 if m.group(2) else 0, int(m.group(3)))


def slugify(text, maxlen=50):
    import unicodedata
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:maxlen].rstrip("-") or "x"


PLACEHOLDER_RE = re.compile(r"\{\{[^}]*\}\}")
