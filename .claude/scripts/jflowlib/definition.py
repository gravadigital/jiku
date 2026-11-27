"""The product definition (_jflow/prd, _jflow/apis, _jflow/db-schemas, _jflow/flows): model, indexes,
checks, ID allocation and context loading. See .claude/specs/product-definition.md."""

import re
from pathlib import Path

from .md import (Doc, LOCAL_AC_RE, PLACEHOLDER_RE, bullets, id_sort_key, ids_in, is_id, prefix_of,
                 render_table, sections, table_dicts, tables)

ORIGIN_RE = re.compile(r"^(initial|#\d+)$")
NOT_IDS = {"UTF", "ISO", "RFC", "SHA", "AES", "TLS", "HTTP", "UUID", "WCAG", "OWASP", "NIST"}
# Documents a decision may name in Affects; content, so in English or Spanish
DOC_ALIASES = {"all services", "product", "parameters", "nfr", "out of scope", "glossary",
               "non-functional requirements", "actors", "surfaces",
               "todos los servicios", "producto", "parámetros", "fuera de alcance", "glosario",
               "requisitos no funcionales", "actores", "superficies"}
HTTP_METHODS = {"get", "put", "post", "delete", "patch", "head", "options", "trace"}


# ---------- contracts ----------

def _yaml_list(lines, i, indent):
    """Value of a key at lines[i]: inline list, scalar, or block list below it."""
    key, _, val = lines[i].strip().partition(":")
    val = val.split(" #")[0].strip()
    if val.startswith("["):
        return [x.strip().strip("'\"") for x in val.strip("[]").split(",") if x.strip()]
    if val:
        return [val.strip("'\"")]
    out = []
    j = i + 1
    while j < len(lines):
        s = lines[j]
        if not s.strip():
            j += 1
            continue
        ind = len(s) - len(s.lstrip())
        if ind < indent or (ind == indent and not s.strip().startswith("- ")):
            break
        t = s.strip()
        if t.startswith("- "):
            item = t[2:].strip()
            if item.startswith("name:"):
                item = item[5:].strip()
            out.append(item.strip("'\""))
        j += 1
    return out


def shared_responses(path):
    """Entries of `components.responses` (OpenAPI): [(name, line, has_x_failure)]."""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    out, in_comp, in_resp, cur = [], False, False, None
    for i, l in enumerate(lines):
        if not l.strip() or l.strip().startswith("#"):
            continue
        n = len(l) - len(l.lstrip())
        if n == 0:
            in_comp, in_resp = l.rstrip() == "components:", False
            continue
        if not in_comp:
            continue
        if n == 2:
            in_resp = l.strip() == "responses:"
            continue
        if not in_resp:
            continue
        if n == 4:
            cur = [l.strip().rstrip(":"), i + 1, False]
            out.append(cur)
        elif cur and n == 6 and l.strip().startswith("x-failure:"):
            cur[2] = True
    return [tuple(x) for x in out]


def parse_contract(path):
    """Operations of an OpenAPI or AsyncAPI document, by indentation (no YAML library needed).
    Returns [{id, method, path, tags, requirements, origin, failures, kind}]."""
    lines = Path(path).read_text(encoding="utf-8").splitlines()
    kind = "asyncapi" if any(l.startswith("asyncapi:") for l in lines) else "openapi"
    ops = []
    top = "paths" if kind == "openapi" else "operations"
    try:
        start = next(i for i, l in enumerate(lines) if l.rstrip() == f"{top}:")
    except StopIteration:
        return ops
    end = next((i for i in range(start + 1, len(lines)) if lines[i] and not lines[i][0].isspace()
                and not lines[i].startswith("#")), len(lines))

    def ind(l):
        return len(l) - len(l.lstrip())

    body = list(range(start + 1, end))
    content = [i for i in body if lines[i].strip() and not lines[i].strip().startswith("#")]
    if not content:
        return ops
    key_indent = ind(lines[content[0]])

    def op_block(i0, base):
        j = i0 + 1
        while j < end and (not lines[j].strip() or ind(lines[j]) > base):
            j += 1
        return i0, j

    def collect(op, a, b, base):
        current = None
        for k in range(a + 1, b):
            t = lines[k].strip()
            kk = ind(lines[k])
            m = re.match(r"""^['"]?([1-5]\d\d|[45]XX)['"]?:""", t)
            if m:
                current = m.group(1)
                if current[0] in "45":
                    op["errors"][current] = False
                continue
            if t.startswith("x-failure:") and current in op["errors"]:
                op["errors"][current] = True
            if t.startswith("operationId:"):
                op["id"] = t.split(":", 1)[1].strip().strip("'\"")
            elif t.startswith("tags:") and kk == base + (key_indent if key_indent else 2):
                op["tags"] = _yaml_list(lines, k, kk)
            elif t.startswith("x-requirements:"):
                op["requirements"] += _yaml_list(lines, k, kk)
            elif t.startswith("x-origin:"):
                op["origin"] = t.split(":", 1)[1].strip().strip("'\"")
            elif t.startswith("x-failure:"):
                op["failures"] += _yaml_list(lines, k, kk)
            elif t.startswith("x-roles:"):
                op["roles"] = _yaml_list(lines, k, kk)

    if kind == "openapi":
        for i in content:
            if ind(lines[i]) != key_indent or not lines[i].strip().startswith("/"):
                continue
            path_ = lines[i].strip().rstrip(":").strip("'\"")
            _, pend = op_block(i, key_indent)
            method_indent = None
            for k in range(i + 1, pend):
                if not lines[k].strip():
                    continue
                method_indent = ind(lines[k])
                break
            for k in range(i + 1, pend):
                t = lines[k].strip()
                if ind(lines[k]) == method_indent and t.rstrip(":") in HTTP_METHODS:
                    a, b = op_block(k, method_indent)
                    op = {"id": None, "method": t.rstrip(":").upper(), "path": path_, "tags": [],
                          "requirements": [], "origin": None, "failures": [], "roles": [],
                          "kind": kind, "line": k + 1, "errors": {}}
                    collect(op, a, min(b, pend), method_indent)
                    ops.append(op)
    else:
        for i in content:
            if ind(lines[i]) != key_indent:
                continue
            name = lines[i].strip().rstrip(":")
            a, b = op_block(i, key_indent)
            op = {"id": name, "method": "", "path": "", "tags": [], "requirements": [],
                  "origin": None, "failures": [], "roles": [], "kind": kind, "line": i + 1, "errors": {}}
            collect(op, a, b, key_indent)
            for k in range(a + 1, b):
                t = lines[k].strip()
                if t.startswith("action:"):
                    op["method"] = t.split(":", 1)[1].strip()
                if t.startswith("$ref:") and "channels" in t and not op["path"]:
                    op["path"] = t.split("channels/")[-1].strip("'\"")
            ops.append(op)
    return ops


# ---------- the definition ----------

class Definition:
    def __init__(self, repo):
        self.repo = repo
        r = repo
        self.exists = r.prd.is_dir()
        self.index = Doc(r.prd / "index.md") if (r.prd / "index.md").exists() else None
        self.blocks = {}
        for p in sorted(r.blocks.glob("*.md")) if r.blocks.is_dir() else []:
            if p.name == "index.md":
                continue
            d = Doc(p)
            self.blocks[d.front.get("prefix") or p.stem] = d
        self.entities = {}
        for p in sorted(r.domain.glob("*.md")) if r.domain.is_dir() else []:
            if p.name in ("index.md", "glossary.md", "invariants.md"):
                continue
            d = Doc(p)
            self.entities[d.front.get("entity") or p.stem] = d
        self.flows = []
        for p in sorted(r.flows.glob("*.md")) if r.flows.is_dir() else []:
            if p.name != "index.md":
                self.flows.append(Doc(p))
        self.contracts = {}
        for p in sorted(r.apis.glob("*.yaml")) + sorted(r.apis.glob("*.yml")) if r.apis.is_dir() else []:
            self.contracts[p] = parse_contract(p)

    def doc(self, rel):
        p = self.repo.prd / rel
        return Doc(p) if p.exists() else None

    # ----- rows -----
    def rows(self, rel, first_col, section=None):
        d = self.doc(rel)
        if not d:
            return []
        lines = d.sections().get(section, []) if section else d.lines
        return table_dicts(lines, first_col)

    def actors(self):
        return table_dicts(self.index.sections().get("Actors", []), "ID") if self.index else []

    def surfaces(self):
        return table_dicts(self.index.sections().get("Surfaces", []), "Surface") if self.index else []

    def block_rows(self, prefix):
        d = self.blocks[prefix]
        s = d.sections()
        req = table_dicts(s.get("Requirements", []), "ID")
        fail = table_dicts(s.get("Failure conditions", []), "ID")
        return req, fail

    def services(self):
        return self.rows("architecture/services.md", "Service", "Services")

    def modules(self):
        """{service.module: {entities, row}}"""
        out = {}
        d = self.doc("architecture/services.md")
        if not d:
            return out
        mods = d.sections().get("Modules", [])
        for svc, lines in sections(mods, 3).items():
            for r in table_dicts(lines, "Module"):
                ents = [e.strip() for e in r.get("Entities", "").split(",") if e.strip() not in ("", "—", "-")]
                mod = r["Module"]
                # The column may hold the bare module ("access") or its id ("api.access").
                key = mod if mod.startswith(f"{svc}.") else f"{svc}.{mod}"
                out[key] = {"entities": ents, "row": r, "service": svc}
        return out

    def interactions(self):
        return self.rows("architecture/services.md", "From → To", "Interactions")

    def entity_owner(self):
        owner = {}
        for mod, m in self.modules().items():
            for e in m["entities"]:
                owner.setdefault(e, []).append(mod)
        return owner

    def invariants(self):
        return self.rows("domain/invariants.md", "ID")

    def guarantees(self):
        return self.rows("architecture/guarantees.md", "ID")

    def decisions(self):
        return (self.rows("decisions.md", "ID", "Product") + self.rows("decisions.md", "ID", "Technical"))

    def reverted(self):
        return self.rows("decisions.md", "ID", "Reverted")

    def parameters(self):
        return self.rows("parameters.md", "Parameter")

    def nfrs(self):
        return self.rows("nfr.md", "ID")

    def credentials(self):
        return self.rows("architecture/auth.md", "ID", "Credentials")

    def integrations(self):
        return self.rows("architecture/integration.md", "ID", "External integrations")

    def glossary(self):
        return self.rows("domain/glossary.md", "Term")

    def roles(self):
        return self.rows("architecture/auth.md", "Role", "Roles")

    # ----- how the product is tested (architecture/testing.md) -----
    def test_entries(self):
        return self.rows("architecture/testing.md", "Entry point", "Entry points")

    def test_identities(self):
        return self.rows("architecture/testing.md", "Role", "Test identities")

    def test_externals(self):
        return self.rows("architecture/testing.md", "System", "External systems")

    def entry_points(self):
        """What must be tested end to end: every surface (by its platform) and every interface a service
        exposes. [(type, service or surface, label)]."""
        out = []
        for s in self.surfaces():
            out.append((s.get("Platform", "").strip() or "web", s["Surface"].strip(), s["Surface"].strip()))
        for s in self.services():
            for kind in re.split(r"[,+/\s]+", s.get("Exposes", "")):
                kind = kind.strip()
                if kind and kind not in ("—", "-"):
                    out.append((kind, s["Service"].strip(), f"{s['Service'].strip()} {kind}"))
        return out

    def all_ids(self):
        """{id: where} for every ID defined in the definition."""
        out = {}
        for a in self.actors():
            out[a["ID"]] = "prd/index.md"
        for p, d in self.blocks.items():
            req, fail = self.block_rows(p)
            for r in req + fail:
                out[r["ID"]] = f"prd/blocks/{p}.md"
        for rel, rows in (("prd/domain/invariants.md", self.invariants()),
                          ("prd/architecture/guarantees.md", self.guarantees()),
                          ("prd/decisions.md", self.decisions() + self.reverted()),
                          ("prd/nfr.md", self.nfrs()),
                          ("prd/architecture/auth.md", self.credentials()),
                          ("prd/architecture/integration.md", self.integrations())):
            for r in rows:
                if r.get("ID"):
                    out[r["ID"]] = rel
        return out



# ---------- indexes ----------

def generate_indexes(defn, write=True):
    """Return {path: content} of the generated indexes; write them when asked."""
    r = defn.repo
    out = {}
    if defn.blocks:
        rows = []
        for p in sorted(defn.blocks):
            f = defn.blocks[p].front
            surf = f.get("surfaces") or []
            last = " / ".join(x for x in (f.get("last_requirement"), f.get("last_failure")) if x) or "—"
            rows.append([p, f.get("name", ""),
                         ", ".join(surf) if isinstance(surf, list) else str(surf) or "—",
                         f.get("covers", ""), last])
        out[r.blocks / "index.md"] = (
            "# Functional blocks\n\nGenerated by `jflow.py def-index` from the frontmatter of each "
            "block. Do not edit by hand.\n\n"
            + render_table(["Prefix", "Block", "Surfaces", "Covers", "Last ID"], rows) + "\n")
    if defn.entities:
        rows = []
        for name in sorted(defn.entities):
            d = defn.entities[name]
            t = d.front.get("tables") or []
            rows.append([name, d.path.name, ", ".join(t) if isinstance(t, list) else str(t),
                         d.front.get("describes", "")])
        out[r.domain / "index.md"] = (
            "# Entities\n\nGenerated by `jflow.py def-index` from the frontmatter of each entity. "
            "Do not edit by hand.\n\n" + render_table(["Entity", "File", "Tables", "Describes"], rows) + "\n")
    if defn.flows:
        rows = []
        for d in defn.flows:
            req = d.front.get("requirements") or []
            mods = d.front.get("modules") or []
            title = next((l[2:].strip() for l in d.lines if l.startswith("# ")), d.path.stem)
            rows.append([f"[{title}]({d.path.name})", ", ".join(req), ", ".join(mods)])
        out[r.flows / "index.md"] = (
            "# Flows\n\nGenerated by `jflow.py def-index` from the frontmatter of each flow. "
            "Do not edit by hand.\n\n" + render_table(["Flow", "Requirements", "Modules"], rows) + "\n")
    if write:
        for p, c in out.items():
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(c, encoding="utf-8")
    return out


# ---------- how the product is tested ----------

TESTING_HEADERS = {
    "Entry points": ["Entry point", "Type", "Service", "Actors", "How it is tested", "Test", "Origin"],
    "Test identities": ["Role", "How the identity is obtained in tests", "Origin"],
    "External systems": ["System", "How it is replaced in tests", "Origin"],
}
TESTING_INTRO = ("# How it is tested\n\nHow each entry point of the product is tested end to end, against "
                 "`make up` and through its real interface: the identity each role comes in with and how each "
                 "external system is replaced. `jflow.py def-check` requires a row per surface, per exposed "
                 "interface (`Exposes` in services.md), per role and per external integration.\n")
TODO = "{{fill}}"


def scaffold_testing(defn, origin="initial"):
    """architecture/testing.md with a row for every entry point, role and external integration that has
    none yet; new rows carry {{fill}} markers (def-check D2 keeps them visible). Returns
    (content, [added labels])."""
    p = defn.repo.arch / "testing.md"
    entries, idents, exts = defn.test_entries(), defn.test_identities(), defn.test_externals()
    added = []
    have = {(e.get("Type", "").strip(), x.strip()) for e in entries for x in (e["Entry point"], e.get("Service", ""))}
    surf = {x["Surface"].strip(): x for x in defn.surfaces()}
    rows_e = [[e.get(h, "") for h in TESTING_HEADERS["Entry points"]] for e in entries]
    for kind, owner, label in defn.entry_points():
        if (kind, owner) in have or (kind, label) in have:
            continue
        s = surf.get(owner)
        svc = s.get("Service", "") if s else owner
        actors = s.get("Actors", "") if s else TODO
        rows_e.append([label, kind, svc, actors, TODO, TODO, origin])
        added.append(f"entry point {label}")
    rows_i = [[x.get(h, "") for h in TESTING_HEADERS["Test identities"]] for x in idents]
    have_i = {x["Role"].strip() for x in idents}
    for role in defn.roles():
        if role["Role"].strip() not in have_i:
            rows_i.append([role["Role"].strip(), TODO, origin])
            added.append(f"role {role['Role'].strip()}")
    rows_x = [[x.get(h, "") for h in TESTING_HEADERS["External systems"]] for x in exts]
    have_x = " ".join(x["System"] for x in exts)
    for it in defn.integrations():
        if it.get("ID") and it["ID"] not in have_x:
            rows_x.append([f"{it['ID']} {it.get('System', '')}".strip(), TODO, origin])
            added.append(f"integration {it['ID']}")
    old = Doc(p).sections() if p.exists() else {}
    run = "\n".join(old.get("How to run them", [])).strip() or (
        "{{fill: how the product is brought up for the tests (`make up`, profile `test`), the test data, "
        "the command (`make test-e2e`) and what runs only locally}}")
    content = (TESTING_INTRO
               + "\n## Entry points\n\n" + render_table(TESTING_HEADERS["Entry points"], rows_e)
               + "\n\n## Test identities\n\n" + render_table(TESTING_HEADERS["Test identities"], rows_i)
               + "\n\n## External systems\n\n" + (render_table(TESTING_HEADERS["External systems"], rows_x)
                                                     if rows_x else "No external integrations.")
               + "\n\n## How to run them\n\n" + run + "\n")
    return content, added


# ---------- checks ----------

def check(defn):
    obs = []
    r = defn.repo

    def add(code, where, msg):
        obs.append(f"[{code}] {where}: {msg}")

    if not defn.exists:
        add("D0", "_jflow/prd", "the product definition does not exist")
        return obs
    for rel in ("index.md", "parameters.md", "decisions.md", "nfr.md", "out-of-scope.md",
                "domain/glossary.md", "domain/invariants.md", "architecture/services.md",
                "architecture/integration.md", "architecture/auth.md", "architecture/guarantees.md",
                "architecture/testing.md"):
        if not (r.prd / rel).exists():
            add("D1", f"prd/{rel}", "the file is missing")

    # guides: README.md and the operations guide (people, product language), AGENTS.md (agents) exist
    # and are filled in
    from .lang import doc_file, template
    for rel_, tmpl in (("README.md", template("README.md", r.language)),
                       (doc_file("operations", r.language), template("operations", r.language))):
        if not (r.root / rel_).exists():
            add("H1", rel_, f"missing (template: {tmpl})")
    guides = ([r.root / "README.md", r.root / "AGENTS.md"] + sorted(r.root.glob("services/*/AGENTS.md"))
              + sorted(r.docs.glob("*.md")))
    for p in guides:
        if p.exists():
            for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                if "{{" in line and ("completar" in line or "fill" in line):
                    add("H2", r.rel(p), f"line {i}: a placeholder is left to fill: {line.strip()[:90]}")

    known = defn.all_ids()
    params = {p["Parameter"].strip().lower() for p in defn.parameters()}
    entity_names = set(defn.entities)

    # every file: placeholders, origins, cited IDs, bold parameters
    files = [p for p in r.prd.rglob("*.md")] + [d.path for d in defn.flows]
    for p in files:
        rel = r.rel(p)
        text = p.read_text(encoding="utf-8")
        generated = p.name == "index.md" and p.parent in (r.blocks, r.domain, r.flows)
        for i, line in enumerate(text.splitlines(), 1):
            if PLACEHOLDER_RE.search(line) and not generated:
                add("D2", rel, f"line {i}: a placeholder is left to fill: {line.strip()[:90]}")
        d = Doc(p)
        for header, rows in tables(d.lines):
            if "Origin" in header:
                k = header.index("Origin")
                for row in rows:
                    v = row[k] if k < len(row) else ""
                    if not ORIGIN_RE.match(v.strip()):
                        add("D3", rel, f"invalid Origin «{v}» in row {row[0]} (initial or #number)")
        if p.name == "index.md" and p.parent in (r.blocks, r.domain, r.flows):
            continue
        for id_ in ids_in(d.body):
            if id_ not in known and prefix_of(id_) not in NOT_IDS:
                add("D4", rel, f"{id_} is cited but not defined")
        for line in d.lines:
            for t in re.findall(r"\*\*([^*]+?)\*\*", line):
                t2 = t.strip().lower()
                if t2.endswith(":") or is_id(t.strip()) or p.name == "parameters.md":
                    continue
                if t2 not in params:
                    add("D5", rel, f"«{t}» is in bold but is not in parameters.md")

    # blocks
    for pre, d in defn.blocks.items():
        rel = r.rel(d.path)
        f = d.front
        for k in ("prefix", "name", "covers", "entities"):
            if k not in f:
                add("B1", rel, f"«{k}» is missing in the frontmatter")
        if "status" in f:
            add("B1", rel, "the block has «status»: the definition describes only what is built, remove it")
        req, fail = defn.block_rows(pre)
        for e in f.get("entities") or []:
            if e not in entity_names:
                add("B2", rel, f"the entity «{e}» in entities does not exist in domain/")
        for kind, rows, last in (("requirement", req, f.get("last_requirement")),
                                 ("failure condition", fail, f.get("last_failure"))):
            ids = [x["ID"] for x in rows]
            for i in ids:
                if prefix_of(i) != pre:
                    add("B3", rel, f"{i} does not carry the block prefix")
            if ids:
                top = max(ids, key=id_sort_key)
                if not last or id_sort_key(str(last)) < id_sort_key(top):
                    add("B4", rel, f"last_{'requirement' if kind == 'requirement' else 'failure'} "
                                   f"({last}) is lower than {top}")
        surfaces = {s["Surface"] for s in defn.surfaces()}
        for s in f.get("surfaces") or []:
            if s not in surfaces:
                add("B5", rel, f"the surface «{s}» does not exist in prd/index.md")

    # entities and modules
    owner = defn.entity_owner()
    for e in entity_names:
        if e not in owner:
            add("E1", "prd/architecture/services.md", f"the entity «{e}» has no owner module")
        elif len(owner[e]) > 1:
            add("E1", "prd/architecture/services.md", f"the entity «{e}» has more than one owner: {', '.join(owner[e])}")
    for e in owner:
        if e not in entity_names:
            add("E2", "prd/architecture/services.md", f"a module names the entity «{e}», which does not exist in domain/")
    for inv in defn.invariants():
        for e in [x.strip() for x in inv.get("Entities", "").split(",") if x.strip()]:
            if e not in entity_names:
                add("E3", "prd/domain/invariants.md", f"{inv['ID']} names the entity «{e}», which does not exist")
        for b in [x.strip() for x in inv.get("Applied in", "").split(",") if x.strip()]:
            if b not in defn.blocks:
                add("E3", "prd/domain/invariants.md", f"{inv['ID']}: «{b}» is not a block prefix")
    guarded = set()
    for g in defn.guarantees():
        guarded |= set(ids_in(g.get("Rule", "")))
    for inv in defn.invariants():
        if inv["ID"] not in guarded:
            add("G1", "prd/architecture/guarantees.md", f"the invariant {inv['ID']} has no guarantee")
    mods = set(defn.modules())
    for d in defn.decisions():
        for a in [x.strip() for x in d.get("Affects", "").split(",") if x.strip()]:
            if not (a in defn.blocks or a in known or a in mods or a in {s["Service"] for s in defn.services()}
                    or (r.prd / a).exists() or a.endswith(".md") or a.lower() in DOC_ALIASES):
                add("C1", "prd/decisions.md", f"{d['ID']}: Affects «{a}» is not a block, ID, module, service or file")

    # how the product is tested: every entry point, role and external system has its row
    if (r.arch / "testing.md").exists():
        trel = "prd/architecture/testing.md"
        entries = defn.test_entries()
        have = {(e.get("Type", "").strip(), x.strip())
                for e in entries for x in (e["Entry point"], e.get("Service", ""))}
        for kind, owner, label in defn.entry_points():
            if (kind, owner) not in have and (kind, label) not in have:
                add("T1", trel, f"the entry point «{label}» ({kind}) does not say how it is tested end to end")
        for e in entries:
            if not e.get("How it is tested", "").strip() or not e.get("Test", "").strip():
                add("T1", trel, f"the entry point «{e['Entry point']}» has no «How it is tested» or «Test»")
        ids_ = {i["Role"].strip() for i in defn.test_identities()}
        for role in defn.roles():
            if role["Role"].strip() not in ids_:
                add("T2", trel, f"the role «{role['Role']}» does not say how it gets its test identity")
        ext = " ".join(x["System"] for x in defn.test_externals())
        for it in defn.integrations():
            if it.get("ID") and it["ID"] not in ext:
                add("T3", trel, f"{it['ID']} ({it.get('System', '')}) does not say how it is replaced in the tests")

    # generated indexes up to date
    for p, content in generate_indexes(defn, write=False).items():
        if not p.exists() or p.read_text(encoding="utf-8") != content:
            add("I1", r.rel(p), "the index is out of date: run `jflow.py def-index`")

    # contracts
    svc_mods = {}
    for m in mods:
        s, _, mm = m.partition(".")
        svc_mods.setdefault(s, set()).add(mm)
    for p, ops in defn.contracts.items():
        rel = r.rel(p)
        svc = p.name.split(".")[0]
        for op in ops:
            name = op["id"] or f"{op['method']} {op['path']}"
            system = "system" in op["tags"]
            if not op["requirements"] and not system:
                add("A1", rel, f"{name}: x-requirements is missing")
            if not op["origin"]:
                add("A1", rel, f"{name}: x-origin is missing")
            elif not ORIGIN_RE.match(op["origin"]):
                add("A1", rel, f"{name}: invalid x-origin «{op['origin']}»")
            for x in op["requirements"] + op["failures"]:
                if x not in known and not LOCAL_AC_RE.fullmatch(x):
                    add("A2", rel, f"{name}: {x} is not defined")
            for t in op["tags"]:
                bare = t[len(svc) + 1:] if t.startswith(f"{svc}.") else t
                if t != "system" and svc in svc_mods and bare not in svc_mods[svc]:
                    add("A3", rel, f"{name}: the tag «{t}» is not a module of {svc}")
            for code, has in op["errors"].items():
                if not has:
                    add("A4", rel, f"{name}: the {code} response has no x-failure")
            if op["kind"] == "openapi" and not op["id"]:
                add("A1", rel, f"{op['method']} {op['path']}: operationId is missing")
        if ops and ops[0]["kind"] == "openapi":
            for name, _line, has in shared_responses(p):
                if not has:
                    add("A4", rel, f"components.responses.{name}: it has no x-failure")

    # flows
    for d in defn.flows:
        rel = r.rel(d.path)
        for x in d.front.get("requirements") or []:
            if x not in known:
                add("F1", rel, f"the requirement {x} is not defined")
        for m in d.front.get("modules") or []:
            if m not in mods:
                add("F1", rel, f"the module {m} does not exist in services.md")
    return obs


# ---------- ID allocation ----------

def next_ids(defn, kind, count=1, reserved=()):
    """Next free IDs of a kind: a block prefix (CAN), its failures (CAN-E), INV, GAR, DEC, DEC-T,
    NFR, INT, CRED, U."""
    used = set(defn.all_ids()) | set(reserved)
    failure = kind.endswith("-E")
    base = kind[:-2] if failure else kind
    nums = []
    for i in used:
        m = re.match(rf"^{re.escape(base)}-?(E?)(\d+)$", i)
        if m and bool(m.group(1)) == failure:
            nums.append(int(m.group(2)))
    if base in defn.blocks:
        f = defn.blocks[base].front
        last = f.get("last_failure" if failure else "last_requirement")
        if last:
            m = re.search(r"(\d+)$", str(last))
            if m:
                nums.append(int(m.group(1)))
    n = max(nums, default=0)
    out = []
    for k in range(1, count + 1):
        v = n + k
        if failure:
            out.append(f"{base}-E{v}")
        elif base == "DEC-T":
            out.append(f"DEC-T{v:02d}")
        else:
            out.append(f"{base}-{v:02d}")
    return out


# ---------- context loading ----------

def _filter_table_lines(lines, keep):
    """Keep header, separator and rows for which keep(cells) is true."""
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("|") and i + 1 < len(lines) and re.match(r"^\s*\|?\s*:?-{2,}", lines[i + 1]):
            header = line
            out += [header, lines[i + 1]]
            j = i + 2
            from .md import split_row
            while j < len(lines) and lines[j].strip().startswith("|"):
                if keep(split_row(lines[j])):
                    out.append(lines[j])
                j += 1
            i = j
            continue
        out.append(line)
        i += 1
    return out


def load(defn, blocks=(), ids=(), entities=(), modules=(), overview=False):
    """Assemble the context for a task. Returns (markdown, [paths])."""
    r = defn.repo
    parts, paths = [], []

    def emit(path, text):
        paths.append(r.rel(path))
        parts.append(f"<!-- {r.rel(path)} -->\n{text.strip()}\n")

    if defn.index:
        body = defn.index.body
        body = body.split("\n## Documentation")[0] if not overview else body
        emit(defn.index.path, body)
    if overview:
        for p in (r.blocks / "index.md", r.domain / "index.md", r.arch / "services.md", r.flows / "index.md"):
            if p.exists():
                emit(p, Doc(p).body)
        return "\n".join(parts), paths

    blocks = set(blocks)
    ids = set(ids)
    for i in list(ids):
        if prefix_of(i) in defn.blocks:
            blocks.add(prefix_of(i))
    entities = set(entities)
    modules = set(modules)
    for b in blocks:
        if b in defn.blocks:
            entities |= set(defn.blocks[b].front.get("entities") or [])
    owner = defn.entity_owner()
    for e in entities:
        modules |= set(owner.get(e, []))
    for it in defn.interactions():
        if set(x.strip() for x in it.get("Blocks", "").split(",")) & blocks:
            for side in it["From → To"].split("→"):
                modules.add(side.strip())
    loaded_text = []

    for b in sorted(blocks):
        if b in defn.blocks:
            d = defn.blocks[b]
            emit(d.path, d.text())
            loaded_text.append(d.body)
            req, fail = defn.block_rows(b)
            ids |= {x["ID"] for x in req + fail}
    # decisions by Afecta
    dpath = r.prd / "decisions.md"
    if dpath.exists():
        keys = blocks | ids | modules | {m.split(".")[0] for m in modules}

        def keep_dec(cells):
            text = " ".join(cells)
            return any(re.search(rf"(?<![\w-]){re.escape(k)}(?![\w-])", text) for k in keys)
        emit(dpath, "\n".join(_filter_table_lines(Doc(dpath).lines, keep_dec)))
    # glossary
    gpath = r.domain / "glossary.md"
    if gpath.exists() and (blocks or entities):
        emit(gpath, Doc(gpath).body)
    # entities
    for e in sorted(entities):
        if e in defn.entities:
            emit(defn.entities[e].path, defn.entities[e].text())
            loaded_text.append(defn.entities[e].body)
    # invariants by entity or ID
    ipath = r.domain / "invariants.md"
    inv_ids = set()
    if ipath.exists():
        def keep_inv(cells):
            ents = {x.strip() for x in (cells[2] if len(cells) > 2 else "").split(",")}
            hit = bool(ents & entities) or cells[0] in ids
            if hit:
                inv_ids.add(cells[0])
            return hit
        emit(ipath, "\n".join(_filter_table_lines(Doc(ipath).lines, keep_inv)))
    # guarantees by rule or module
    gar = r.arch / "guarantees.md"
    if gar.exists():
        rule_keys = ids | inv_ids

        def keep_gar(cells):
            rule = set(ids_in(cells[2] if len(cells) > 2 else ""))
            where = cells[4] if len(cells) > 4 else ""
            return bool(rule & rule_keys) or cells[0] in ids or any(m in where for m in modules)
        emit(gar, "\n".join(_filter_table_lines(Doc(gar).lines, keep_gar)))
    # parameters named in the loaded text
    ppath = r.prd / "parameters.md"
    if ppath.exists():
        named = {t.strip().lower() for t in re.findall(r"\*\*([^*]+?)\*\*", "\n".join(loaded_text))}
        emit(ppath, "\n".join(_filter_table_lines(Doc(ppath).lines, lambda c: c[0].strip().lower() in named)))
    # NFRs of the product, the blocks' surfaces and the modules' services
    npath = r.prd / "nfr.md"
    if npath.exists():
        scopes = {"product"} | {m.split(".")[0] for m in modules}
        for b in blocks:
            if b in defn.blocks:
                scopes |= set(defn.blocks[b].front.get("surfaces") or [])
        emit(npath, "\n".join(_filter_table_lines(
            Doc(npath).lines, lambda c: (c[4] if len(c) > 4 else "product") in scopes or c[0] in ids)))
    # services: full (small) — modules and interactions are needed to place the work
    spath = r.arch / "services.md"
    if spath.exists() and (blocks or modules):
        emit(spath, Doc(spath).body)
    # integration, auth and how it is tested: full when work is placed
    for name, trig in (("integration.md", r"INT-\d+"), ("auth.md", r"CRED-\d+|U-\d+"), ("testing.md", None)):
        p = r.arch / name
        if p.exists() and (blocks or modules):
            emit(p, Doc(p).body)
    # flows that cite the IDs or modules
    for d in defn.flows:
        if set(d.front.get("requirements") or []) & ids:
            emit(d.path, d.text())
    # contract operations
    oplines = []
    for p, ops in defn.contracts.items():
        for op in ops:
            if set(op["requirements"]) & ids:
                oplines.append(f"- `{r.rel(p)}` {op['id']}: {op['method']} {op['path']} "
                               f"(tags: {', '.join(op['tags'])}; x-requirements: {', '.join(op['requirements'])})")
    if oplines:
        parts.append("<!-- contract operations that fulfil these requirements -->\n" + "\n".join(oplines) + "\n")
    # schemas of the modules' services
    for s in sorted({m.split(".")[0] for m in modules}):
        p = r.schemas / f"{s}.md"
        if p.exists():
            paths.append(r.rel(p) + " (not included: open it to see the tables)")
    return "\n".join(parts), paths
