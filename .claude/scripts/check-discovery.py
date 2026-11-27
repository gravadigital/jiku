#!/usr/bin/env python3
"""Mechanical checks for the Discovery documents (see .claude/specs/discovery.md).

Usage:
    check-discovery.py [--final] [discovery_dir]

Checks whichever of functional-analysis.md, domain-analysis.md, technical-analysis.md and
db-schema-{service}.md exist in discovery_dir (default: _jflow/discovery). Cross-document checks run
on the later document. --final runs everything over all the documents together.

Prints one line per observation and exits 1 if there is any. Standard library only.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from jflowlib.lang import Sections, canon, value  # noqa: E402  (structure read in English or Spanish)

FUNC, DOM, TEC = "functional-analysis.md", "domain-analysis.md", "technical-analysis.md"

ID_RE = re.compile(r"\b(U|INT|NFR|DEC-T|DEC|INV|[A-Z]{2,4})-(E?\d+)\b")
RANGE_RE = re.compile(r"\b(U|INT|NFR|DEC-T|DEC|INV|[A-Z]{2,4})-(\d+)\.\.(\d+)\b")
BOLD_RE = re.compile(r"\*\*([^*]+?)\*\*")
# Bold labels inside a block or an entity (English names; the Spanish ones are read through canon).
LABELS = {
    "requirements", "failure conditions", "examples", "configurations", "not notified",
    "surface(s)", "derived attributes", "relationships", "removal", "states", "transitions",
    "interactions", "events",
}
PENDING_RE = re.compile(r"<!--|\bTODO\b|\bTBD\b|\bPENDIENTE\b|\bPENDING\b|\b[Aa] definir\b|\bto be decided\b|\?\?|¿\?")
REASON_RE = re.compile(r"\b(porque|para que|ya que|aunque|dado que|because|so that|since|although|given that)\b", re.I)
MAGNITUDE_RE = re.compile(r"\d|\b(decenas|cientos|miles|millones|unidades|tens|hundreds|thousands|millions|units)\b"
                          r"|no aplica|not applicable", re.I)
NFR_CATEGORIES = [
    "Volume", "Response times", "Availability", "Privacy and compliance", "Accessibility",
    "Language, time zone and formats", "Compatibility",
]
SCHEMA_SECTIONS = ["Base", "Schema decisions", "Schema", "Constraints DBML does not express",
                   "Derived attributes"]
SCHEMA_DECISIONS = ["Concurrency", "Multi-tenancy", "History", "Deletion"]
DB_ENGINE_RE = re.compile(r"(?i)postgres|mysql|mariadb|sqlite|sql server|mongo")
REQUIRED_SECTIONS = {
    FUNC: ["Summary", "Actors", "Surfaces", "Features", "Out of scope",
           "Parameters", "External integrations", "Non-functional requirements",
           "Decisions taken"],
    DOM: ["Glossary", "Entities", "States", "Invariants"],
    TEC: ["Services", "Modules", "Persistence and infrastructure", "Communication",
          "Authentication and authorization", "Guarantees", "Key flows", "Technical decisions"],
}


class Doc:
    def __init__(self, path):
        self.name = path.name
        text = path.read_text(encoding="utf-8")
        self.front, self.body = {}, text
        m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
        if m:
            self.body = text[m.end():]
            for line in m.group(1).splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    self.front[k.strip()] = v.strip()
        self.lines = self.body.splitlines()
        self.sections = self._split(2)

    def _split(self, level):
        """{title: [lines]} for headings of exactly `level` hashes (outside code fences)."""
        out, cur, fence = Sections(), None, False
        for line in self.lines:
            if line.startswith("```"):
                fence = not fence
            if not fence and re.match(r"^#{%d} \S" % level, line):
                cur = line[level + 1:].strip()
                out[cur] = []
            elif cur is not None:
                out[cur].append(line)
        return out

    def subsections(self, section):
        """{title: [lines]} for ### headings inside a ## section."""
        out, cur = Sections(), None
        for line in self.sections.get(section, []):
            if line.startswith("### "):
                cur = line[4:].strip()
                out[cur] = []
            elif cur is not None:
                out[cur].append(line)
        return out


def tables(lines):
    """Yield each markdown table as (header, rows), cells stripped."""
    block = []
    for line in lines + [""]:
        if line.startswith("|"):
            block.append(line)
            continue
        if len(block) >= 2:
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in block]
            yield [canon(c) for c in cells[0]], [r for r in cells[2:]]
        block = []


def table_with(lines, first_col):
    for header, rows in tables(lines):
        if header and header[0] == first_col:
            return header, rows
    return None, []


def tables_after(lines, marker):
    """Tables between a bold marker line (e.g. **Derived attributes**) and the next bold line."""
    for i, line in enumerate(lines):
        if canon(line.strip().strip("*").strip()) == marker:
            block = []
            for l in lines[i + 1:]:
                if l.startswith("**"):
                    break
                block.append(l)
            yield from tables(block)
            return


def parse_dbml(text):
    """Minimal DBML reader: enums (value, note), tables (columns with note, table note) and refs."""
    enums, tables, refs, cur, kind, in_indexes = {}, {}, [], None, None, False
    for raw in text.splitlines():
        line = raw.split("//")[0].rstrip() if not raw.strip().startswith("Note") else raw.rstrip()
        s = line.strip()
        m = re.match(r"(Enum|Table)\s+(\w+)\s*\{", s)
        if m:
            kind, cur = m.group(1), m.group(2)
            if kind == "Enum":
                enums[cur] = []
            else:
                tables[cur] = {"columns": [], "note": None}
            continue
        if s.startswith("indexes"):
            in_indexes = True
            continue
        if s.startswith("}"):
            if in_indexes:
                in_indexes = False
            else:
                cur = kind = None
            continue
        if in_indexes:
            continue
        if s.startswith("Ref:"):
            for tbl in re.findall(r"[<>-]\s*(\w+)\.\w+", s):
                refs.append(("Ref", tbl))
            continue
        if not cur or not s:
            continue
        note = re.search(r"note:\s*'([^']*)'", s)
        if kind == "Enum":
            enums[cur].append((s.split()[0], note.group(1) if note else None))
        elif s.startswith("Note:"):
            tables[cur]["note"] = re.sub(r"^Note:\s*'(.*)'$", r"\1", s)
        elif re.match(r"\w+\s+\S+", s):
            name = s.split()[0]
            tables[cur]["columns"].append({"name": name, "note": note.group(1) if note else None})
            for tbl in re.findall(r"ref:\s*[<>-]\s*(\w+)\.\w+", s):
                refs.append((f"{cur}.{name}", tbl))
    return enums, tables, refs


def ids_in(text):
    found = set()
    for p, a, b in RANGE_RE.findall(text):
        for n in range(int(a), int(b) + 1):
            found.add(f"{p}-{n:02d}")
    for p, n in ID_RE.findall(text):
        found.add(f"{p}-{n}")
    return found


def defined_ids(doc):
    out = set()
    for header, rows in tables(doc.lines):
        for r in rows:
            if r and re.fullmatch(ID_RE.pattern, r[0]):
                out.add(r[0])
    return out


def bold_terms(lines):
    out = set()
    for line in lines:
        for t in BOLD_RE.findall(line):
            t = t.strip()
            if canon(t.rstrip(":")).lower() in LABELS or t.endswith(":") or ID_RE.fullmatch(t):
                continue
            out.add(t.lower())
    return out


class Checker:
    def __init__(self, ddir, final):
        self.ddir, self.final, self.obs = ddir, final, []
        self.docs = {n: Doc(ddir / n) for n in (FUNC, DOM, TEC) if (ddir / n).exists()}
        self.schemas = [Doc(p) for p in sorted(ddir.glob("db-schema-*.md"))]

    def add(self, code, doc, msg):
        self.obs.append(f"[{code}] {doc}: {msg}")

    # ---------- common ----------
    def decisions(self, d, section):
        header, rows = table_with(d.sections.get(section, []), "ID")
        if not header:
            return
        k_dec = header.index("Decision") if "Decision" in header else 2
        k_mot = header.index("Reason") if "Reason" in header else None
        if k_mot is None and rows:
            self.add("C6", d.name, f"«{section}» has no Reason column: every decision carries why it was taken")
        for r in rows:
            if len(r) > k_dec and REASON_RE.search(r[k_dec]):
                self.add("C5", d.name, f"{r[0]}: the decision gives a why («{REASON_RE.search(r[k_dec]).group(0)}»); "
                                       f"it goes in the Reason column")
            if k_mot is not None and (len(r) <= k_mot or r[k_mot].strip() in ("", "—", "-")):
                self.add("C6", d.name, f"{r[0]}: the reason is missing (ask the user)")

    def common(self, d):
        for s in REQUIRED_SECTIONS.get(d.name, SCHEMA_SECTIONS):
            if s not in d.sections:
                self.add("C1", d.name, f"the section «{s}» is missing")
        status = d.front.get("status", "")
        if status not in ("in-progress", "closed"):
            self.add("C2", d.name, f"invalid status «{status}» (in-progress | closed)")
        if status == "closed":
            if "closed_sections" in d.front:
                self.add("C3", d.name, "closed but it keeps closed_sections in the frontmatter")
            for i, line in enumerate(d.lines, 1):
                if PENDING_RE.search(line):
                    self.add("C4", d.name, f"temporary or pending content on line {i}: {line.strip()[:80]}")

    # ---------- functional ----------
    def functional(self, f):
        defined = defined_ids(f)
        for ref in sorted(ids_in(f.body) - defined):
            self.add("F1", f.name, f"{ref} is referenced but not defined")

        params = {r[0].lower() for r in table_with(f.sections.get("Parameters", []), "Parameter")[1]}
        body = [l for s, ls in f.sections.items() if canon(s) != "Summary" for l in ls]
        for t in sorted(bold_terms(body) - params):
            self.add("F2", f.name, f"«{t}» is in bold but is not in Parameters")

        surfaces = {r[0] for r in table_with(f.sections.get("Surfaces", []), "Surface")[1]}
        _, index = table_with(f.sections.get("Features", []), "Block")
        prefixes = {r[1] for r in index if len(r) > 1}
        blocks = {}
        for title, lines in f.subsections("Features").items():
            blocks[title.split(" ")[0]] = lines
        for p in sorted(prefixes - set(blocks)):
            self.add("F3", f.name, f"the block {p} is in the index but has no detail")
        for p in sorted(set(blocks) - prefixes):
            self.add("F3", f.name, f"the block {p} has detail but is not in the index")
        used = set()
        for p, lines in blocks.items():
            line = next((l for l in lines if re.match(r"^\*\*(Superficie\(s\)|Surface\(s\)):\*\*", l)), None)
            if line is None:
                self.add("F4", f.name, f"the block {p} does not declare Surface(s)")
                continue
            surf = line.split("**", 2)[2].strip()
            if surf.startswith("—"):
                continue
            for s in surf.split(","):
                s = re.sub(r"\(.*?\)", "", s).strip()
                used.add(s)
                if s not in surfaces:
                    self.add("F4", f.name, f"the block {p} names the surface «{s}», which is not in Surfaces")
        for s in sorted(surfaces - used):
            self.add("F4", f.name, f"the surface «{s}» has no block")

        _, nfr = table_with(f.sections.get("Non-functional requirements", []), "ID")
        cats = {canon(r[1]) for r in nfr if len(r) > 1}
        for c in NFR_CATEGORIES:
            if c not in cats:
                self.add("F5", f.name, f"the NFR category «{c}» is missing")
        for c in sorted(cats - set(NFR_CATEGORIES)):
            self.add("F5", f.name, f"unknown NFR category «{c}»")

        for r in nfr:
            if len(r) > 3 and canon(r[1]) in ("Volume", "Response times") and not MAGNITUDE_RE.search(r[3]):
                self.add("F7", f.name, f"{r[0]}: the target «{r[3]}» is neither a number nor an order of magnitude")

        _, ptable = table_with(f.sections.get("Parameters", []), "Parameter")
        values = {r[1]: r[0] for r in ptable if len(r) > 1 and re.search(r"\d+\s+[a-záéíóúñ]+", r[1])}
        for p_, lines in blocks.items():
            for line in lines:
                if not line.startswith("|") or line.startswith("|---"):
                    continue
                cells = [c.strip() for c in line.strip("|").split("|")]
                for v, name in values.items():
                    if re.search(rf"(?<![\d.,]){re.escape(v)}\b", " ".join(cells[1:])):
                        self.add("F8", f.name, f"{cells[0]} repeats «{v}»; name the parameter **{name.lower()}**")
        self.decisions(f, "Decisions taken")

        _, actors = table_with(f.sections.get("Actors", []), "ID")
        needs_acc = any(len(r) > 2 and not re.match(r"(?i)\s*(anónimo|anonymous|—|-)", r[2]) for r in actors)
        if needs_acc and "ACC" not in blocks:
            self.add("F6", f.name, "an actor has access other than anonymous and there is no ACC block")

    # ---------- domain ----------
    def domain(self, d, f):
        fdef = defined_ids(f) if f else set()
        ddef = defined_ids(d)
        for ref in sorted(ids_in(d.body) - fdef - ddef):
            self.add("D1", d.name, f"{ref} is referenced but not defined in the functional or the domain analysis")

        for title, lines in d.subsections("Entities").items():
            if not any(re.match(r"^\*\*(Baja|Removal):\*\*", l) for l in lines):
                self.add("D2", d.name, f"the entity «{title}» has no Removal")

        for entity, lines in d.subsections("States").items():
            _, states = table_with(lines, "State")
            _, trans = table_with(lines, "From")
            sources = {r[0] for r in trans}
            initial = {r[1] for r in trans if r[0] in ("(creación)", "(creation)")}
            for r in states:
                name, typ = r[0], value(r[1]) if len(r) > 1 else ""
                derived = "initial" if name in initial else ("terminal" if name not in sources else "intermediate")
                if typ != derived:
                    self.add("D3", d.name, f"{entity}: the state {name} is listed as «{typ}» but its transitions make it «{derived}»")

        if f:
            params = {r[0].lower() for r in table_with(f.sections.get("Parameters", []), "Parameter")[1]}
            for t in sorted(bold_terms(d.lines) - params):
                self.add("D4", d.name, f"«{t}» is in bold but is not in the functional analysis' Parameters")

    # ---------- technical ----------
    def technical(self, t, f, d):
        known = defined_ids(t) | (defined_ids(f) if f else set()) | (defined_ids(d) if d else set())
        for ref in sorted(ids_in(t.body) - known):
            self.add("T1", t.name, f"{ref} is referenced but not defined in any document")

        owners_block, owners_entity = {}, {}
        for service, lines in t.subsections("Modules").items():
            _, rows = table_with(lines, "Module")
            for r in rows:
                if len(r) < 3:
                    continue
                for e in [x.strip() for x in r[1].split(",") if x.strip() not in ("", "—")]:
                    owners_entity.setdefault(e, []).append(f"{service}.{r[0]}")
                for b in [x.strip() for x in r[2].split(",") if x.strip() not in ("", "—")]:
                    owners_block.setdefault(b, []).append(f"{service}.{r[0]}")
        for k, v in list(owners_block.items()) + list(owners_entity.items()):
            if len(v) > 1:
                self.add("T2", t.name, f"«{k}» is assigned to more than one module: {', '.join(v)}")

        if f:
            _, index = table_with(f.sections.get("Features", []), "Block")
            for r in index:
                if len(r) > 1 and r[1] not in owners_block:
                    self.add("T2", t.name, f"the block {r[1]} is not assigned to any module")
            surfaces = {r[0] for r in table_with(f.sections.get("Surfaces", []), "Surface")[1]}
            _, services = table_with(t.sections.get("Services", []), "Service")
            served = set()
            for r in services:
                if len(r) > 3 and r[1] == "frontend":
                    served |= {s.strip() for s in r[3].split(",")}
            for s in sorted(surfaces - served):
                self.add("T3", t.name, f"no frontend serves the surface «{s}»")
        if d:
            for e in d.subsections("Entities"):
                if e not in owners_entity:
                    self.add("T2", t.name, f"the entity «{e}» has no owner module")
            invs = {r[0] for r in table_with(d.sections.get("Invariants", []), "ID")[1]}
            _, garantias = table_with(t.sections.get("Guarantees", []), "Rule")
            covered = set()
            for r in garantias:
                covered |= ids_in(r[0])
            for i in sorted(invs - covered):
                self.add("T4", t.name, f"the invariant {i} has no guarantee")

        self.decisions(t, "Technical decisions")
        _, decs = table_with(t.sections.get("Technical decisions", []), "ID")
        if not any(len(r) > 1 and "CI/CD" in r[1] for r in decs):
            self.add("T5", t.name, "the CI/CD decision is missing")

    # ---------- database schema ----------
    def schema(self, s, d, t):
        dbml = "\n".join(re.findall(r"```dbml\n(.*?)```", s.body, re.S))
        if not dbml.strip():
            self.add("S0", s.name, "it has no ```dbml``` block with the schema")
            return
        enums, tables, refs = parse_dbml(dbml)
        enum_notes = {n.lower() for vals in enums.values() for _, n in vals if n}
        by_entity = {}
        for name, tb in tables.items():
            m = re.match(r"(?:Entidad|Entity):\s*(.+?)\s*(—|$)", tb["note"] or "")
            if m:
                by_entity[m.group(1).strip().lower()] = name
            elif not (tb["note"] or "").startswith(("Técnica:", "Technical:")):
                self.add("S1", s.name, f"the table {name} does not say its origin (Note: 'Entity: …' or 'Technical: …')")
        for src, tbl in refs:
            if tbl not in tables:
                self.add("S7", s.name, f"{src} references the table {tbl}, which does not exist")

        _, decisions = table_with(s.sections.get("Schema decisions", []), "Decision")
        names = {canon(r[0]) for r in decisions}
        for n in SCHEMA_DECISIONS:
            if n not in names:
                self.add("S8", s.name, f"the schema decision «{n}» is missing (with its value or «not applicable»)")
        if d and "Currency" not in names and re.search(r"\|\s*(dinero|money)\s*\|", d.body, re.I):
            self.add("S8", s.name, "an attribute is of type money and the schema decision «Currency» is missing")

        stored = {}
        _, drows = table_with(s.sections.get("Derived attributes", []), "Entity")
        for r in drows:
            if len(r) > 2:
                stored[(r[0].lower(), r[1].lower())] = r[2].lower().startswith(("columna", "column"))
        if d:
            for entity, lines in d.subsections("Entities").items():
                table = by_entity.get(entity.lower())
                if not table:
                    self.missing_entities.setdefault(entity, s.name)
                    continue
                self.tabled_entities.add(entity)
                cols = {c["note"].split("·")[0].strip().lower(): c for c in tables[table]["columns"] if c["note"]}
                _, attrs = table_with(lines, "Attribute")
                for r in attrs:
                    a = r[0]
                    col = cols.get(a.lower())
                    if not col:
                        self.add("S2", s.name, f"{entity}.{a} has no column in {table} (note '{a}')")
                        continue
                    if (len(r) > 4 and value(r[4]).startswith("yes")
                            and not re.search(r"(?i)dato personal|personal data", col["note"])):
                        self.add("S5", s.name, f"{table}.{col['name']} stores personal data ({entity}.{a}) and its note does not say so")
                    if len(r) > 3 and r[1].lower() == "enum" and not r[3].lower().startswith(("valores de", "values of")):
                        values = r[3].split(";")[0].split(":")[-1]
                        for v in [x.strip() for x in values.split("/") if x.strip()]:
                            if v.lower() not in enum_notes:
                                self.add("S4", s.name, f"the value «{v}» of {entity}.{a} has no translation in an enum")
                for header, rows in tables_after(lines, "Derived attributes"):
                    for r in rows:
                        key = (entity.lower(), r[0].lower())
                        if key not in stored:
                            self.add("S3", s.name, f"the derived attribute {entity}.{r[0]} is not in «Derived attributes»")
                        elif stored[key] and r[0].lower() not in cols:
                            self.add("S3", s.name, f"the derived attribute {entity}.{r[0]} is stored but {table} has no column for it")
        if t:
            covered = set()
            _, crows = table_with(s.sections.get("Constraints DBML does not express", []), "Name")
            for r in crows:
                covered |= ids_in(" ".join(r))
            covered |= ids_in(dbml)
            _, garantias = table_with(t.sections.get("Guarantees", []), "Rule")
            for r in garantias:
                schema_level = re.search(r"(?i)restricci|índice|unicidad|único|exclusi|chequeo|tabla|permiso|funci"
                                         r"|constraint|index|unique|check|table|permission", r[1])
                if len(r) > 2 and re.search(r"(?i)\b(base|database)\b", r[2]) and schema_level:
                    self.schema_guarantees |= ids_in(r[0])
            self.covered_guarantees |= covered

    def run(self):
        f, d, t = (self.docs.get(n) for n in (FUNC, DOM, TEC))
        if self.final and len(self.docs) < 3:
            self.add("X1", str(self.ddir), "the final check needs the three documents")
        for doc in self.docs.values():
            self.common(doc)
        if f:
            self.functional(f)
        if d:
            self.domain(d, f)
        if t:
            self.technical(t, f, d)
        # With one schema per service, an entity or guarantee is covered if any schema has it.
        self.missing_entities, self.tabled_entities = {}, set()
        self.schema_guarantees, self.covered_guarantees = set(), set()
        for s in self.schemas:
            self.common(s)
            self.schema(s, d, t)
        where = self.schemas[0].name if len(self.schemas) == 1 else "db-schema-*.md"
        for entity, name in self.missing_entities.items():
            if entity not in self.tabled_entities:
                self.add("S1", where, f"the entity «{entity}» has no table (Note: 'Entity: {entity} — …')")
        for i in sorted(self.schema_guarantees - self.covered_guarantees):
            self.add("S6", where, f"the guarantee {i} belongs in the database and is in no schema and no constraint")
        if self.final and t:
            _, persistence = table_with(t.sections.get("Persistence and infrastructure", []), "Component")
            owners = {r[2] for r in persistence if len(r) > 2 and DB_ENGINE_RE.search(r[1])}
            have = {s.front.get("service") for s in self.schemas}
            for o in sorted(owners - have):
                self.add("X3", str(self.ddir), f"the service {o} owns a database and has no db-schema-{o}.md")
        if self.final and f and d and t:
            params = {r[0].lower() for r in table_with(f.sections.get("Parameters", []), "Parameter")[1]}
            for t_ in sorted(bold_terms(t.lines) - params):
                self.add("X2", t.name, f"«{t_}» is in bold but is not in the functional analysis' Parameters")
        return self.obs


def main(argv):
    final = "--final" in argv
    args = [a for a in argv if a != "--final"]
    ddir = Path(args[0]) if args else Path("_jflow/discovery")
    if not ddir.is_dir():
        print(f"The folder {ddir} does not exist")
        return 2
    obs = Checker(ddir, final).run()
    for o in obs:
        print(o)
    print(f"{len(obs)} observations" if obs else "No observations")
    return 1 if obs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
