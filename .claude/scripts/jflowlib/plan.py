"""From a closed discovery to (a) the Jiku requirements of the initial plan, each with its
specification, and (b) the product-level definition the bootstrap writes. Every piece of the
discovery (block, entity, table, invariant, guarantee, decision, parameter, flow, module) goes to the
first part of the plan that needs it; what no block needs belongs to the product. See
.claude/specs/requirement.md and .claude/skills/jflow-product-discover/SKILL.md."""

import json
import re
from pathlib import Path

from .lang import localize, say
from .md import canon_headers, Doc, bullets, ids_in, is_id, prefix_of, render_table, sections, split_row, table_dicts, table_with, tables
from .repo import die
from .spec import Spec, criteria_header, parse_draft, render_draft

BASE = 0
NO_MOTIVO = "Not stated in the discovery"
NFR_HOW = ("How each one is verified: `test` (a test, in the requirement named in «Tested in»: `base` or the "
           "`#id` of the part), `alert` (in the operations guide) or `review` (the verifier checks it).")


def drop_empty(md):
    """Remove table headers left without rows and headings left without content."""
    lines = md.splitlines()
    out = []
    for k, line in enumerate(lines):
        if re.match(r"^\|[\s:|-]+\|$", line) and out and out[-1].startswith("|"):
            nxt = lines[k + 1] if k + 1 < len(lines) else ""
            if not nxt.startswith("|"):
                out.pop()
                continue
        out.append(line)
    res = []
    for k, line in enumerate(out):
        if line.startswith("#"):
            depth = len(line) - len(line.lstrip("#"))
            rest = [x for x in out[k + 1:] if x.strip()]
            if not rest or (rest[0].startswith("#") and len(rest[0]) - len(rest[0].lstrip("#")) <= depth):
                continue
        res.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(res))


def esc(s):
    """A table cell: one line, pipes escaped once."""
    return re.sub(r"(?<!\\)\|", r"\\|", str(s).replace("\n", " "))


def drop_origin(md):
    """Remove the Origin column of every table in a markdown text."""
    out = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            header = split_row(line)
            k = header.index("Origin") if "Origin" in header else None
            block = [line, lines[i + 1]]
            j = i + 2
            while j < len(lines) and lines[j].strip().startswith("|"):
                block.append(lines[j])
                j += 1
            if k is None:
                out += block
            else:
                rows = [split_row(r) for r in block]
                out.append(render_table([c for n, c in enumerate(rows[0]) if n != k],
                                        [[c for n, c in enumerate(r) if n != k] for r in rows[2:]]))
            i = j
            continue
        out.append(line)
        i += 1
    return "\n".join(out)


def body_of(content):
    """Text of a generated file without its frontmatter."""
    return re.sub(r"^---\n.*?\n---\n\n?", "", content, flags=re.S)


# ---------- analysis ----------

def block_info(meta):
    """{prefix: {name, entities, cites (other blocks), params}} to help propose the plan."""
    out = {}
    blocks = meta["blocks"]
    for pre, b in blocks.items():
        cites = sorted({prefix_of(i) for i in ids_in(b["text"]) if prefix_of(i) in blocks and prefix_of(i) != pre})
        params = sorted({t.strip() for t in re.findall(r"\*\*([^*]+?)\*\*", b["text"]) if not t.strip().endswith(":")})
        out[pre] = {"name": b["name"], "entities": b["entities"], "cites": cites, "surfaces": b["surfaces"],
                    "params": params}
    return out


class Assignment:
    """Which part of the plan (1..n; 0 = the product, written at bootstrap) owns each piece."""

    def __init__(self, meta, plan):
        self.meta, self.plan = meta, plan
        self.warnings = []
        self.deferred = {}  # part -> [(section, title, markdown)] of rows an earlier part could not carry
        self.block_part = {}
        for n, part in enumerate(plan["parts"], 1):
            for b in part["blocks"]:
                if b not in meta["blocks"]:
                    raise SystemExit(f"error: part {n} cites the block {b}, which is not in the discovery")
                if b in self.block_part:
                    raise SystemExit(f"error: the block {b} is in two parts ({self.block_part[b]} and {n})")
                self.block_part[b] = n
        missing = sorted(set(meta["blocks"]) - set(self.block_part))
        if missing:
            raise SystemExit(f"error: blocks missing in the plan: {', '.join(missing)}")
        self.auth_part = next((n for n, p in enumerate(plan["parts"], 1) if p.get("auth")), 1)
        self._assign()

    def _first(self, prefixes, default=None):
        parts = [self.block_part[p] for p in prefixes if p in self.block_part]
        return min(parts) if parts else default

    def _assign(self):
        m = self.meta
        # entities -> first part whose blocks touch them
        self.entity = {}
        all_entities = set(m["entity_file"])
        for n, part in enumerate(self.plan["parts"], 1):
            for e in part.get("entities", []):
                if e not in all_entities:
                    raise SystemExit(f"error: part {n} places the entity «{e}», which is not in the discovery")
                self.entity.setdefault(e, n)
        for e in sorted(all_entities - set(self.entity)):
            users = [p for p, b in m["blocks"].items() if e in b["entities"]]
            part = self._first(users)
            if part is None:
                self.warnings.append(f"no block names the entity «{e}»: it goes in part 1")
                part = 1
            self.entity[e] = part
        # an entity fixed by the plan to a later part is a false positive in an earlier block
        for pre, b in m["blocks"].items():
            keep = []
            for e in b["entities"]:
                if self.entity.get(e, 0) > self.block_part[pre]:
                    self.warnings.append(f"{pre} names «{e}», which the plan creates in part {self.entity[e]}: "
                                         f"taken as a text match, not as an entity of the block")
                    continue
                keep.append(e)
            b["entities"] = keep
        self.table = {t: self.entity[e] for e, ts in m["tables_of"].items() if e in self.entity for t in ts}
        # tables without an entity (technical): where the tables they reference and the IDs they cite are
        for doc in m["schemas"].values():
            code = "\n".join(doc.sections().get("Schema", []))
            for body, name in re.findall(r"^(Table\s+(\w+)\s*\{.*?\n\})", code, re.S | re.M):
                if name in self.table:
                    continue
                parts = [self.table[r] for r in re.findall(r"ref:\s*[<>-]\s*(\w+)\.", body) if r in self.table]
                parts += [self.block_part[prefix_of(i)] for i in ids_in(body) if prefix_of(i) in self.block_part]
                self.table[name] = max(parts) if parts else 1
        # modules
        self.module = {}
        for svc, rows in m["modules"].items():
            for r in rows:
                ents = [x.strip() for x in r[1].split(",") if x.strip() not in ("", "—", "-")]
                parts = [self.entity[e] for e in ents if e in self.entity]
                self.module[f"{svc}.{r[0]}"] = min(parts) if parts else None
        for it in m["interactions"]:
            part = self._first([x.strip() for x in it[2].split(",") if x.strip()], default=None)
            for side in it[0].split("→"):
                mod = side.strip()
                if mod in self.module and self.module[mod] is None and part is not None:
                    self.module[mod] = part
        for mod, part in list(self.module.items()):
            if part is None:
                self.warnings.append(f"the module {mod} has no entities and no interactions with blocks: it goes in part 1")
                self.module[mod] = 1
        # rows, invariants and guarantees: each one where everything it cites exists, so no part cites
        # what a later part brings. A block's requirement can land in a later part than its block.
        self.row, self.row_text = {}, {}
        for pre, b in m["blocks"].items():
            for r in b["req"] + b["fail"]:
                self.row[r["ID"]] = self.block_part[pre]
                self.row_text[r["ID"]] = " ".join(str(v) for k, v in r.items() if k != "ID")
        self.invariant, self.guarantee = {}, {}
        for _ in range(50):
            before = (dict(self.row), dict(self.invariant), dict(self.guarantee))
            for row in m["invariants"]:
                ents = [x.strip() for x in row[2].split(",")]
                parts = [self.entity[e] for e in ents if e in self.entity]
                users = [self._id_part(x.strip()) for x in row[3].split(",") if x.strip()]
                users = [u for u in users if u is not None]
                if users:
                    parts.append(min(users))
                self.invariant[row[0]] = max(parts) if parts else 1
            for row in m["guarantees"]:
                rule_ids = ids_in(row[2]) + ids_in(row[3])
                parts = [self._id_part(i) for i in rule_ids]
                parts = [x for x in parts if x is not None]
                if not parts:
                    mod = row[4].split(".")[-1] if "." in row[4] else None
                    parts = [self.module_part_guess(mod)] if mod else [1]
                self.guarantee[row[0]] = max(parts)
            for rid, text in self.row_text.items():
                cited = [self._id_part(i) for i in ids_in(text) if i != rid]
                self.row[rid] = max([self.row[rid]] + [x for x in cited if x is not None])
            if before == (self.row, self.invariant, self.guarantee):
                break
        for pre, b in m["blocks"].items():
            for r in b["req"] + b["fail"]:
                if self.row[r["ID"]] != self.block_part[pre]:
                    self.warnings.append(
                        f"{r['ID']} goes in part {self.row[r['ID']]} and not in {self.block_part[pre]} (the one of "
                        f"{pre}), because it cites what comes in {self.row[r['ID']]}. If part "
                        f"{self.block_part[pre]} needs a narrower version, split it (see the plan step)")
        # decisions
        self.decision = {}
        for kind in ("prod", "tech"):
            for row in m["decisions"][kind]:
                tokens = [x.strip() for x in row[5].split(",") if x.strip()]
                parts = [self._id_part(t) for t in tokens]
                parts = [x for x in parts if x is not None]
                parts += [self.module[t] for t in tokens if t in self.module]
                self.decision[row[0]] = min(parts) if parts else BASE
        # parameters: named in a block
        self.parameter = {}
        for row in m["parameters"]:
            name = row[0].strip().lower()
            bold = lambda t: {x.strip().lower() for x in re.findall(r"\*\*([^*]+?)\*\*", t)}
            rows = [self.row[rid] for rid, t in self.row_text.items() if name in bold(t)]
            if rows:
                self.parameter[row[0]] = min(rows)
                continue
            users = [p for p, b in m["blocks"].items() if name in bold(b["text"])]
            self.parameter[row[0]] = self._first(users, default=BASE)
        # integrations: cited by a block
        self.integration = {}
        for row in m["integrations"]:
            users = [p for p, b in m["blocks"].items() if re.search(rf"\b{re.escape(row[0])}\b", b["text"])]
            first = self._first(users, default=1)
            cited = [self._id_part(i) for i in ids_in(" ".join(row[1:]))]
            self.integration[row[0]] = max([first] + [x for x in cited if x is not None])
        # flows: when every block they need exists
        self.flow = {}
        for path, f in m["flows"].items():
            parts = [self._id_part(i) for i in f["ids"]]
            parts = [x for x in parts if x is not None]
            self.flow[path] = max(parts) if parts else 1

    def token_part(self, t):
        """Part of an «Afecta» token: a block prefix, an ID or a module."""
        t = t.strip()
        if t in self.module:
            return self.module[t]
        if t in self.block_part:
            return self.block_part[t]
        return self.owner_of_id(t)

    def defer(self, part, section, title, text):
        self.deferred.setdefault(part, []).append((section, title, text))

    def split_md(self, text, n):
        """Split markdown into what part n can carry and, per later part, the table rows and lines that
        cite what that part brings. Headings and table headers travel with what they introduce."""
        kept, later = [], {}
        heading, header = None, None
        deferred_rows = []  # (index in kept to insert after, line) of table rows defining an ID
        for line in text.splitlines():
            if line.startswith("#"):
                heading, header = line, None
                kept.append(line)
                continue
            if line.startswith("|"):
                if header is None or re.match(r"^\|[\s:|-]+\|$", line):
                    header = line if header is None else header + "\n" + line
                    kept.append(line)
                    continue
            elif not line.strip():
                header = None if not line.startswith("|") else header
            o = self.owner_of_text(line)
            if o > n:
                bucket = later.setdefault(o, {})
                key = (heading, header if line.startswith("|") else None)
                bucket.setdefault(key, []).append(line)
                if line.startswith("|"):
                    deferred_rows.append((len(kept), line))
            else:
                kept.append(line)
        # A deferred row that defines an ID what part n keeps still uses (a credential cited by its use
        # and its schema) stays in part n bounded, without the later IDs; the later part completes it.
        bounded, changed = {}, True
        while changed:
            changed = False
            used = set().union(*(ids_in(x) for x in kept + list(bounded.values()))) if kept else set()
            for pos, line in deferred_rows:
                cells = split_row(line)
                first = cells[0].strip() if cells else ""
                if pos not in bounded and is_id(first) and first in used:
                    bounded[pos] = self.strip_later(line, n)
                    changed = True
        for pos in sorted(bounded, reverse=True):
            kept.insert(pos, bounded[pos])
        out = {}
        for o, groups in later.items():
            chunks = []
            for (h, hdr), lines in groups.items():
                body = "\n".join(([hdr] if hdr else []) + lines)
                chunks.append(f"{h}\n\n{body}" if h else body)
            out[o] = "\n\n".join(chunks)
        return drop_empty("\n".join(kept)), out

    def strip_later(self, text, n):
        """text without the IDs that a part after n brings (and the empty parentheses they leave)."""
        for i in ids_in(text):
            o = self.owner_of_id(i)
            if o and o > n:
                text = re.sub(rf"\s*(?:[,·;]\s*)?\b{re.escape(i)}\b(?::\s*)?", " ", text)
        text = re.sub(r"\(\s*[, ]*\)", "", text)
        text = re.sub(r"\(\s*,\s*", "(", text)
        return re.sub(r" {2,}", " ", text)

    def _id_part(self, i):
        """The part where ID i exists, during assignment (None if it is not of any part)."""
        if i in self.row:
            return self.row[i]
        if i in self.invariant:
            return self.invariant[i]
        if i in self.guarantee:
            return self.guarantee[i]
        if prefix_of(i) in self.block_part:
            return self.block_part[prefix_of(i)]
        return None

    def module_part_guess(self, mod):
        for k, v in self.module.items():
            if k.endswith("." + mod):
                return v
        return 1

    def owner_of_text(self, text, tables=()):
        """The part where everything a row cites exists: block IDs, invariants, guarantees, decisions,
        integrations, bold parameters and tables. 0 (the product) when it cites nothing of a part."""
        parts = [o for o in (self.owner_of_id(i) for i in ids_in(text)) if o]
        for t in re.findall(r"\*\*([^*]+?)\*\*", text):
            for row in self.meta["parameters"]:
                if row[0].strip().lower() == t.strip().lower() and self.parameter.get(row[0]):
                    parts.append(self.parameter[row[0]])
        parts += [self.table[t] for t in tables if t in self.table]
        return max(parts) if parts else BASE

    def owner_of_id(self, i):
        if i in self.row:
            return self.row[i]
        if prefix_of(i) in self.block_part:
            return self.block_part[prefix_of(i)]
        for table in (self.invariant, self.guarantee, self.decision, self.integration):
            if i in table:
                return table[i]
        return None


# ---------- rendering ----------

def glossary_rows(files):
    h, rows = table_with(files.get("prd/domain/glossary.md", "").splitlines(), "Term")
    return [r[:2] for r in rows] if h else []


def criteria_rows(meta, a, n):
    rows = []
    for pre, b in meta["blocks"].items():
        for r in b["req"]:
            if a.row[r["ID"]] != n:
                continue
            if "Event" in r:
                text = f"{r.get('Event', '')}: {r.get('Channel', '')} → {r.get('Recipient', '')} — {r.get('Content', '')}"
            else:
                text = r.get("Requirement", "")
            rows.append(["add", r["ID"], esc(text)])
        for r in b["fail"]:
            if a.row[r["ID"]] != n:
                continue
            rows.append(["add", r["ID"], esc(f"{r.get('Condition', '')} → {r.get('Result', '')}")])
    for row in meta["invariants"]:
        if a.invariant[row[0]] == n:
            rows.append(["add", row[0], esc(row[1])])
    for row in meta["guarantees"]:
        if a.guarantee[row[0]] == n:
            rows.append(["add", row[0], esc(f"{row[1]}: {row[3]}")])
    return rows


def strip_later_ids(text, a, n):
    """Drop, from DBML notes, the IDs that a later part brings: the note keeps what is true at part n."""
    def fix(m):
        note = m.group(2)
        for i in ids_in(note):
            o = a.owner_of_id(i)
            if o and o > n:
                note = re.sub(rf"\s*(?:[,·;]\s*)?\b{re.escape(i)}\b(?::\s*)?", " ", note)
        note = re.sub(r"\(\s*[, ]*\)", "", note)
        note = re.sub(r"\s{2,}", " ", note).strip(" ,·;:")
        return f"{m.group(1)}'{note}'"
    return re.sub(r"(note:\s*|Note:\s*)'([^']*)'", fix, text)


def schema_part(meta, a, n):
    """DBML enums and tables, restrictions and derived attributes that belong to part n (0 = product)."""
    out = []
    for svc, doc in meta["schemas"].items():
        secs = doc.sections()
        dbml = "\n".join(secs.get("Schema", []))
        m = re.search(r"```dbml\n(.*?)```", dbml, re.S)
        code = m.group(1) if m else ""
        blocks = re.findall(r"^((?:Enum|Table)\s+(\w+)\s*\{.*?\n\})", code, re.S | re.M)
        tables_here = {name for blk, name in blocks if blk.startswith("Table") and a.table.get(name, 1) == n}
        enums = []
        for blk, name in blocks:
            if blk.startswith("Enum"):
                users = [t for b2, t in blocks if b2.startswith("Table") and re.search(rf"\b{name}\b", b2)]
                part = min((a.table.get(t, 1) for t in users), default=BASE)
                if part == n:
                    enums.append(blk)
        tbls = [strip_later_ids(blk, a, n) for blk, name in blocks if blk.startswith("Table") and name in tables_here]
        restr_h, restr = table_with(secs.get("Constraints DBML does not express", []), "Name")
        rrows = []
        for r in restr:
            names = [x.strip() for x in (r[1] if len(r) > 1 else "").split(",")]
            if any(x.startswith(("todas", "all")) for x in names):
                names = []
            if a.owner_of_text(" ".join(r), names) == n:
                rrows.append(r)
        der_h, der = table_with(secs.get("Derived attributes", []), "Entity")
        drows = [r for r in der if max(a.entity.get(r[0].strip(), BASE), a.owner_of_text(" ".join(r))) == n]
        if not (enums or tbls or rrows or drows):
            continue
        part = [f"#### Database of {svc}"]
        if enums or tbls:
            part.append("```dbml\n" + "\n\n".join(enums + tbls) + "\n```")
        if rrows:
            part.append("Constraints DBML does not express:\n\n" + render_table(restr_h, rrows))
        if drows:
            part.append("Derived attributes:\n\n" + render_table(der_h, drows))
        out.append("\n\n".join(part))
    return "\n\n".join(out)


def render_part(meta, files, a, n, part):
    blocks = [b for b, p in a.block_part.items() if p == n]
    deps = set()
    # ---- criteria
    crit = criteria_rows(meta, a, n)
    # ---- proposal pieces
    params = [["add", r[0], r[1], r[2]] for r in meta["parameters"] if a.parameter[r[0]] == n]
    decs = []
    for kind in ("prod", "tech"):
        for r in meta["decisions"][kind]:
            motivo = r[4] if r[4].strip() not in ("", "—", "-") else NO_MOTIVO
            tokens = [t.strip() for t in r[5].split(",") if t.strip()]
            if a.decision[r[0]] == n:
                now = [t for t in tokens if (a.token_part(t) or 0) <= n]
                decs.append(["new", r[0], r[1], esc(r[2]), esc(r[3]), esc(motivo), ", ".join(now) or "—"])
            elif a.decision[r[0]] < n:
                here = [t for t in tokens if a.token_part(t) == n]
                if here:
                    decs.append(["keeps", r[0], r[1], esc(r[2]), esc(r[3]), esc(motivo), ", ".join(here)])
    tech = []
    tech.append("### Blocks\n\n" + render_table(
        ["Change", "Prefix", "Block", "Surfaces", "Entities"],
        [["add", b, meta["blocks"][b]["name"], ", ".join(meta["blocks"][b]["surfaces"]) or "—",
          ", ".join(meta["blocks"][b]["entities"]) or "—"] for b in blocks]))
    ents = [e for e, p in a.entity.items() if p == n]
    data = []
    if ents:
        for e in ents:
            content = files.get(f"prd/domain/{meta['entity_file'][e]}.md", "")
            body = drop_origin(body_of(content))
            body = re.sub(r"^# .*\n+", "", body)
            body = re.sub(r"^## ", "##### ", body, flags=re.M)
            body, later_rows = a.split_md(body.strip(), n)
            for o, txt in later_rows.items():
                a.defer(o, "data", f"{e} (modify)", txt)
            data.append(f"#### {e} (add)\n\n{body.strip()}")
    data += [f"#### {t}\n\n{txt}" for sec, t, txt in a.deferred.get(n, []) if sec == "data"]
    if data:
        tech.append("### Data\n\n" + "\n\n".join(data))
    inv = [[ "add", r[0], esc(r[1]), r[2], r[3]] for r in meta["invariants"] if a.invariant[r[0]] == n]
    gar = [["add", r[0], esc(r[1]), r[2], esc(r[3]), r[4]] for r in meta["guarantees"] if a.guarantee[r[0]] == n]
    if inv or gar:
        txt = "### Invariants and guarantees"
        if inv:
            txt += "\n\n" + render_table(["Change", "ID", "Rule", "Entities", "Applied in"], inv)
        if gar:
            txt += "\n\n" + render_table(["Change", "ID", "Guarantee", "Rule", "Mechanism", "Where"], gar)
        tech.append(txt)
    gl = [r for r in glossary_rows(files) if a.owner_of_text(" ".join(r)) == n]
    if gl:
        tech.append("### Glossary\n\n" + render_table(["Change", "Term", "Definition"],
                                                       [["add", r[0], esc(r[1])] for r in gl]))
    comm = [r for r in meta["communication"] if a.owner_of_text(" ".join(r)) == n]
    infra = [r for r in meta["persistence"] if a.owner_of_text(" ".join(r)) == n]
    sch = schema_part(meta, a, n)
    if sch:
        tech.append("### Schema\n\n" + sch)
    flows = [p for p, k in a.flow.items() if k == n]
    if flows:
        tech.append("### Flows\n\n" + "\n\n".join(
            "#### " + meta["flows"][p]["name"] + "\n\n" + re.sub(r"^# .*\n+", "", body_of(files[p])).strip() for p in flows))
    arch = []
    mods = [mod for mod, p in a.module.items() if p == n]
    if mods:
        rows = []
        for mod in mods:
            svc, name = mod.split(".", 1)
            r = next(x for x in meta["modules"][svc] if x[0] == name)
            rows.append(["add", mod, r[1], r[2]])
        arch.append(render_table(["Change", "Module", "Entities", "Responsibility"], rows))
    inter = [["add", it[0], it[1], it[2]] for it in meta["interactions"]
             if a._first([x.strip() for x in it[2].split(",") if x.strip()], default=None) == n]
    if inter:
        arch.append("Interactions:\n\n" + render_table(["Change", "From → To", "Purpose", "Blocks"], inter))
    if infra:
        arch.append("Persistence and infrastructure:\n\n" + render_table(
            ["Change", "Component", "Technology", "Owner", "Used by"], [["add"] + r[:-1] for r in infra]))
    if comm:
        arch.append("Communication:\n\n" + render_table(
            ["Change", "From → To", "Protocol", "Type", "Purpose"], [["add"] + r[:-1] for r in comm]))
    integ = [["add"] + r[:-1] for r in meta["integrations"] if a.integration[r[0]] == n]
    if integ:
        arch.append("External integrations:\n\n" + render_table(
            ["Change", "ID", "System", "Direction", "Data", "When", "Source of truth", "Reference"], integ))
    if n == a.auth_part and "prd/architecture/auth.md" in files:
        auth = re.sub(r"^# .*\n+", "", drop_origin(files["prd/architecture/auth.md"])).strip()
        auth, later_rows = a.split_md(re.sub(r"^## ", "##### ", auth, flags=re.M), n)
        for o, txt in later_rows.items():
            a.defer(o, "arch", "Authentication (modify)", txt)
        arch.append("#### Authentication (add)\n\n" + auth)
    arch += [f"#### {t}\n\n{txt}" for sec, t, txt in a.deferred.get(n, []) if sec == "arch"]
    if arch:
        tech.append("### Architecture\n\n" + "\n\n".join(arch))
    proposal = "{{fill: functional summary of the part, in 2-4 lines and in business terms}}"
    if params:
        proposal += "\n\n## Parameters\n\n" + render_table(["Change", "Parameter", "Value", "Variable"], params)
    if decs:
        proposal += "\n\n## Decisions\n\n" + render_table(
            ["Type", "ID", "Topic", "Decision", "Rejected", "Reason", "Affects"], decs)
    proposal += "\n\n## Technical detail\n\n" + "\n\n".join(tech)
    # ---- dependencies: what this part uses that another part brings
    later = {}  # later part -> what cites what
    cites = [(c[1], ids_in(c[2])) for c in crit] + [("the proposal", ids_in(proposal))]
    for where, ids in cites:
        for i in ids:
            o = a.owner_of_id(i)
            if o is None or o == n or o == BASE:
                continue
            if o < n:
                deps.add(o)
            else:
                later.setdefault(o, {}).setdefault(where, set()).add(i)
    for b in blocks:
        for e in meta["blocks"][b]["entities"]:
            o = a.entity.get(e)
            if o and o != n:
                if o < n:
                    deps.add(o)
                else:
                    later.setdefault(o, {}).setdefault(b, set()).add(f"entity {e}")
    for o in sorted(later):
        detail = "; ".join(f"{w} cites {', '.join(sorted(ids))}" for w, ids in sorted(later[o].items()))
        a.warnings.append(f"part {n} cites what comes in part {o}, which goes later ({detail}). "
                          f"If a criterion needs it to hold or to be tested, part {n} cannot be built on its "
                          f"own: merge the parts or reorder the plan")
    titles = {k: p["title"] for k, p in enumerate(a.plan["parts"], 1)}
    titles[BASE] = "Base product"
    deps.add(BASE)  # every part is built on the base
    scope = "## Includes\n\n" + "\n".join(
        f"- **{b} — {meta['blocks'][b]['name']}:** {{{{fill: what it covers, in one line}}}}" for b in blocks)
    scope += "\n\n## Excludes\n\n- Whatever is not in the acceptance criteria."
    scope += "\n\n## Depends on\n\n" + "\n".join(f"- #P{d} {titles[d]}" for d in sorted(deps))
    spec = Spec(0, {"scope": scope, "technicalSolution": proposal,
                    "acceptanceCriteria": render_table(["Change", "ID", "Criterion"], crit)},
                meta={"title": part["title"], "part": n, "blocks": ", ".join(blocks)})
    return spec, sorted(deps)


def render_base(meta, a, template):
    """The base product requirement: the template's criteria that apply to these services."""
    services = meta["services"]
    kinds = {"always"}
    if any("HTTP" in s.get("Exposes", "") for s in services):
        kinds.add("http")
    if any("NATS" in s.get("Exposes", "") for s in services):
        kinds.add("nats")
    if len(services) > 1:
        kinds.add("multi")
    if any(s.get("Type", "").strip() == "frontend" for s in services):
        kinds.add("frontend")
        # the end-to-end test and the CI build follow the platform of the surfaces, not the service type
        plats = set(meta.get("platforms") or []) or {"web"}
        kinds |= {{"web": "web", "mobile-app": "mobile", "desktop-app": "desktop"}.get(p, "web") for p in plats}
        if any(s.get("Type", "").strip() != "frontend" and "HTTP" in s.get("Exposes", "") for s in services):
            kinds.add("frontend-backend")
    owners = {r[2].strip() for r in meta["persistence"]}
    if owners & {s["Service"] for s in services}:
        kinds.add("db")
    if any(s.get("Type", "").strip() == "service" for s in services):
        kinds.add("process")
    t = parse_draft(template, 0)
    rows, _ = t.criteria()
    crit, k = [], 0
    for r in rows:
        if r.get("Applies", "always").strip() in kinds:
            k += 1
            crit.append(["add", f"0-AC-{k:02d}", esc(r["Criterion"])])
    svc_rows = [[s["Service"], s.get("Type", ""), s.get("Language", ""), s.get("Surfaces", ""), s.get("Exposes", "")]
                for s in services]
    decs = []
    for kind in ("prod", "tech"):
        for r in meta["decisions"][kind]:
            if a.decision[r[0]] == BASE:
                motivo = r[4] if r[4].strip() not in ("", "—", "-") else NO_MOTIVO
                decs.append(["new", r[0], r[1], esc(r[2]), esc(r[3]), esc(motivo), r[5]])
    proposal = t.proposal.replace("{services}", render_table(
        ["Service", "Type", "Language", "Surfaces", "Exposes"], svc_rows))
    if decs:
        proposal += "\n\n## Decisions\n\n" + render_table(
            ["Type", "ID", "Topic", "Decision", "Rejected", "Reason", "Affects"], decs)
    if meta.get("nfrs"):
        # how each one is verified is decided with the user when the base is specified (/jflow-product-scaffold)
        proposal += ("\n\n## Non-functional requirements\n\n" + NFR_HOW + "\n\n" + render_table(
                         ["NFR", "Requirement", "Target", "Verification", "Tested in"],
                         [[n[0], esc(n[2]), esc(n[3]), "to be decided", "to be decided"] for n in meta["nfrs"]]))
    scope = t.scope.replace("{product}", meta["name"])
    return Spec(0, {"scope": scope, "technicalSolution": proposal,
                    "acceptanceCriteria": render_table(["Change", "ID", "Criterion"], crit)},
                meta={"title": "Base product", "part": 0})


def plan_dir(repo):
    d = repo.tmp / "plan"
    d.mkdir(exist_ok=True)
    return d


def _digest(path):
    import hashlib
    return hashlib.sha256(path.read_bytes()).hexdigest()


def edited_drafts(repo):
    """The drafts changed by hand since plan-build wrote them (splits, resolved markers)."""
    d = plan_dir(repo)
    rec = d / "generated.json"
    if not rec.exists():
        return []
    made = json.loads(rec.read_text(encoding="utf-8"))
    return sorted(p.name for p in d.glob("part-*.md") if made.get(p.name) != _digest(p))


def localized(spec, lang):
    """The draft as people read it in Jiku: its structure in the product language (lang.localize)."""
    meta = dict(spec.meta)
    if meta.get("title") == "Base product":
        meta["title"] = say("Base product", lang)
    return Spec(spec.id, {k: localize(v, lang) for k, v in spec.fields.items()}, meta)


def build(repo, files, meta, plan, template, force=False):
    """Write one draft per part (part-00 is the base) to the working folder. Returns (paths, deps, warnings).
    Drafts edited by hand since the last build are not overwritten unless `force`."""
    edited = edited_drafts(repo)
    if edited and not force:
        die("these drafts were edited after they were generated and regenerating would lose those changes: "
            f"{', '.join(edited)}. Continue from them (resolve placeholders, plan-check, plan-push), or, to "
            "redo the plan, run plan-build with --force")
    a = Assignment(meta, plan)
    d = plan_dir(repo)
    for old in d.glob("part-*.md"):
        old.unlink()
    paths, deps = [], {}
    base = render_base(meta, a, template)
    p = d / "part-00.md"
    p.write_text(render_draft(localized(base, repo.language), repo.language), encoding="utf-8")
    paths.append(p)
    for n, part in enumerate(plan["parts"], 1):
        spec, dep = render_part(meta, files, a, n, part)
        p = d / f"part-{n:02d}.md"
        p.write_text(render_draft(localized(spec, repo.language), repo.language), encoding="utf-8")
        paths.append(p)
        deps[n] = dep
    (d / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding="utf-8")
    (d / "generated.json").write_text(json.dumps({p.name: _digest(p) for p in paths}), encoding="utf-8")
    return paths, deps, a.warnings


def load_parts(repo):
    d = plan_dir(repo)
    out = []
    for p in sorted(d.glob("part-*.md")):
        n = int(p.stem.split("-")[1])
        out.append((n, p, parse_draft(p.read_text(encoding="utf-8"), 0)))
    return out


def order_check(parts):
    """Each part can cite only what it or an earlier part adds: a part that cites what a later one brings
    cannot be built, tested or merged on its own (its definition would document what does not exist yet)."""
    first = {}
    for n, p, sp in parts:
        for i in sp.introduced_ids():
            first.setdefault(i, n)
    obs = []
    for n, p, sp in parts:
        text = "\n".join(v or "" for v in sp.fields.values())
        later = sorted({i for i in ids_in(text) if first.get(i, -1) > n}, key=lambda i: (first[i], i))
        if later:
            detail = ", ".join(f"{i} (part {first[i]})" for i in later)
            obs.append(f"part {n}: P1 cites what a later part adds: {detail}. Take those citations out of "
                       f"part {n} (if needed, a narrower version of the row here and `modify` with the full "
                       f"version in the part that brings it)")
    return obs


# ---------- product-level definition (bootstrap) ----------

def write_base_definition(repo, files, meta, plan=None):
    """Write the part of the definition that describes the whole product or the skeleton:
    index, glossary, NFRs, out of scope, product decisions and parameters, services, persistence and
    communication, the shared part of each schema. Blocks and what they need come with their requirement."""
    blocks = set(meta["blocks"])
    fake_plan = plan or {"parts": [{"title": "all", "blocks": sorted(blocks)}]}
    a = Assignment(meta, fake_plan)
    out = {}
    for rel in ("prd/index.md", "prd/nfr.md", "prd/out-of-scope.md"):
        out[rel] = files[rel]
    gl = [r + ["initial"] for r in glossary_rows(files) if a.owner_of_text(" ".join(r)) == BASE]
    out["prd/domain/glossary.md"] = "# Glossary\n\n" + render_table(["Term", "Definition", "Origin"], gl) + "\n"
    hdr = meta["decision_header"]
    prod = [r for r in meta["decisions"]["prod"] if a.decision[r[0]] == BASE]
    tech = [r for r in meta["decisions"]["tech"] if a.decision[r[0]] == BASE]
    out["prd/decisions.md"] = (
        "# Decisions\n\nWhat was chosen on purpose over an alternative. A requirement that changes a "
        "decision reverts it explicitly.\n\n## Product\n\n" + render_table(hdr, prod)
        + "\n\n## Technical\n\n" + render_table(hdr, tech) + "\n\n## Reverted\n\n"
        + render_table(["ID", "Topic", "Said", "Reverted by", "Reason", "Now"], []) + "\n")
    params = [r for r in meta["parameters"] if a.parameter[r[0]] == BASE]
    out["prd/parameters.md"] = ("# Parameters\n\nValues of business rules, cited by name in bold. "
                                "The variable is the environment one, with its default value.\n\n"
                                + render_table(["Parameter", "Value", "Variable", "Origin"], params) + "\n")
    srows = [[s["Service"], s.get("Type", ""), s.get("Language", ""), s.get("Surfaces", ""), s.get("Exposes", ""),
              f"services/{s['Service']}", "initial"] for s in meta["services"]]
    mods = "".join(f"\n### {s['Service']}\n\n" + render_table(["Module", "Entities", "Responsibility", "Origin"], []) + "\n"
                   for s in meta["services"] if s.get("Type", "").strip() == "service")
    out["prd/architecture/services.md"] = (
        "# Services and modules\n\n## Services\n\n" + render_table(
            ["Service", "Type", "Language", "Surfaces", "Exposes", "Folder", "Origin"], srows)
        + "\n\n## Modules\n" + mods + "\n## Interactions\n\n"
        + render_table(["From → To", "Purpose", "Blocks", "Origin"], []) + "\n")
    out["prd/architecture/integration.md"] = (
        "# Integration\n\n## Persistence and infrastructure\n\n"
        + render_table(["Component", "Technology", "Owner", "Used by", "Origin"],
                       [r for r in meta["persistence"] if a.owner_of_text(" ".join(r)) == BASE])
        + "\n\n## Communication\n\n" + render_table(["From → To", "Protocol", "Type", "Purpose", "Origin"],
                                                      [r for r in meta["communication"] if a.owner_of_text(" ".join(r)) == BASE])
        + "\n\n## External integrations\n\nNo external integrations built.\n")
    out["prd/architecture/auth.md"] = (
        "# Authentication and authorization\n\n## Credentials\n\n"
        + render_table(["ID", "Credential", "Issuer", "Obtained", "Lifetime and renewal", "Revocation", "Origin"], [])
        + "\n\n## Use\n\n" + render_table(["Credential", "Role", "From", "Passes through", "Verifies", "Origin"], [])
        + "\n\n## Roles\n\n" + render_table(["Role", "Actors", "Allows", "Origin"], []) + "\n")
    out["prd/architecture/guarantees.md"] = (
        "# Guarantees\n\nHow each rule that must always hold is kept. Every guarantee has a test with "
        "its ID.\n\n" + render_table(["ID", "Guarantee", "Rule", "Mechanism", "Where", "Origin"], []) + "\n")
    out["prd/domain/invariants.md"] = (
        "# Invariants\n\nRules on the data that always hold. How each one is kept is in "
        "`architecture/guarantees.md`.\n\n" + render_table(["ID", "Rule", "Entities", "Applied in", "Origin"], []) + "\n")
    for svc, doc in meta["schemas"].items():
        secs = doc.sections()
        rh, rr = table_with(secs.get("Constraints DBML does not express", []), "Name")
        rrows = []
        for r in rr:
            names = [x.strip() for x in (r[1] if len(r) > 1 else "").split(",")]
            if any(x.startswith(("todas", "all")) for x in names):
                names = []
            if a.owner_of_text(" ".join(r), names) == BASE:
                rrows.append(r)
        text = (f"---\nservice: {svc}\nsource: _jflow/discovery/{doc.path.name}\n---\n\n# Database schema — {svc}\n\n"
                "## Base\n\n" + "\n".join(canon_headers(secs.get("Base", []))).strip() + "\n\n## Schema decisions\n\n"
                + "\n".join(secs.get("Schema decisions", [])).strip()
                + "\n\n## Schema\n\nTables are added with the requirement that builds each block.\n\n```dbml\n```\n\n"
                "## Constraints DBML does not express\n\n"
                + (render_table(rh, rrows) if rh else "None.") + "\n\n## Derived attributes\n\nNone.\n")
        out[f"db-schemas/{svc}.md"] = text
    for rel, content in out.items():
        p = repo.jflow / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    repo.references.mkdir(parents=True, exist_ok=True)
    return sorted(out)
