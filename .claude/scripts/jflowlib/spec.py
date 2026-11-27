"""The specification of a Jiku requirement. It lives in three fields of the requirement in Jiku —
scope, technicalSolution (Proposal) and acceptanceCriteria — as markdown with a fixed shape, its
structure in the product language (lang.py). While /jflow-spec works, a local draft holds the same three
fields. Inside this module every structural name is English. See .claude/specs/requirement.md."""

import re

from .lang import TERMS, canon, say, value
from .md import LOCAL_AC_RE, PLACEHOLDER_RE, ids_in, is_id, prefix_of, sections, split_row, table_dicts
from .repo import die

FIELDS = (("scope", "Scope"), ("technicalSolution", "Proposal"), ("acceptanceCriteria", "Acceptance criteria"))
CHANGES = ("add", "modify", "remove")
DECISION_TYPES = ("new", "reverts", "keeps")
OPEN_STATES = ("analisis", "planificacion", "en_cola", "desarrollo", "revision")
TECH_SECTIONS = ("Blocks", "Data", "Invariants and guarantees", "Schema", "Interface", "Flows", "Architecture")

DECIDED_LABEL = "Decided in the implementation"
DECIDED_RE = re.compile(rf"^(?:{DECIDED_LABEL}|{TERMS[DECIDED_LABEL]}): ([^\n]*?)\.?\s*$", re.M)


def criteria_header(lang):
    return "| " + " | ".join(say(c, lang) for c in ("Change", "ID", "Criterion")) + " |\n|---|---|---|"


class Spec:
    """The three fields of a requirement, parsed."""

    def __init__(self, id_, fields, meta=None):
        self.id = int(id_)
        self.fields = {k: (fields.get(k) or "").strip() for k, _ in FIELDS}
        self.meta = meta or {}

    # ----- raw parts -----
    @property
    def scope(self):
        return self.fields["scope"]

    @property
    def proposal(self):
        return self.fields["technicalSolution"]

    @property
    def criteria_text(self):
        return self.fields["acceptanceCriteria"]

    def text(self):
        return "\n\n".join(self.fields.values())

    def is_empty(self):
        return not any(self.fields.values())

    def _h2(self, field):
        return sections(self.fields[field].splitlines(), 2)

    # ----- parsed -----
    def criteria(self):
        """[{Change, ID, Criterion, line}] and the lines that look like a criterion but cannot be read."""
        rows, bad = [], []
        lines = self.criteria_text.splitlines()
        header = None
        for n, line in enumerate(lines, 1):
            if not line.strip().startswith("|"):
                continue
            cells = split_row(line)
            if header is None:
                header = [canon(c.strip()) for c in cells]
                continue
            if all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in cells if c.strip()):
                continue
            row = dict(zip(header, [c.strip() for c in cells]))
            if len(cells) != len(header) or not row.get("ID"):
                bad.append((n, line))
                continue
            row["line"] = n
            row.setdefault("Change", "")
            rows.append(row)
        if header is not None and ("ID" not in header or "Criterion" not in header):
            bad.append((0, "the criteria table has no ID and Criterion columns"))
        return rows, bad

    def decisions(self):
        return table_dicts(self._h2("technicalSolution").get("Decisions", []), "Type")

    def parameters(self):
        return table_dicts(self._h2("technicalSolution").get("Parameters", []), "Change")

    def decided(self):
        """IDs of criteria that /jflow-build decided and added (`spec amend`), from the marker line."""
        m = DECIDED_RE.search(self.criteria_text)
        return [x.strip() for x in m.group(1).split(",") if x.strip()] if m else []

    def depends(self):
        return [int(x) for x in re.findall(r"#(\d+)", "\n".join(self._h2("scope").get("Depends on", [])))]

    def technical(self):
        """{section: text} of '## Technical detail' in the proposal, sections by their English name."""
        from .lang import Sections
        lines = self._h2("technicalSolution").get("Technical detail", [])
        return Sections({k: "\n".join(v).strip() for k, v in sections(lines, 3).items()})

    def ids(self):
        """Every definition ID the specification mentions (criteria, decisions, technical detail)."""
        return set(ids_in(self.text()))

    def introduced_ids(self):
        """IDs the specification adds to the definition: criteria and technical rows marked `add`,
        new decisions, and the IDs of the tables under a heading marked «(add)» or «(modify)» (and its
        sub-headings). Cited IDs do not count."""
        out = set()
        for line in (self.criteria_text + "\n" + self.proposal).splitlines():
            if line.strip().startswith("|"):
                cells = split_row(line)
                if len(cells) > 1 and value(cells[0]) == "add" and is_id(cells[1].strip()):
                    out.add(cells[1].strip())
        for d in self.decisions():
            if value(d.get("Type")) == "new" and d.get("ID", "").strip():
                out.add(d["ID"].strip())
        on, level, use = False, 0, False
        for line in self.proposal.splitlines():
            if line.startswith("#"):
                depth = len(line) - len(line.lstrip("#"))
                # the use and the roles of a credential cite it; only its own table adds it
                head = canon(line.lstrip("#").strip())
                use = head.lower().startswith(("use", "roles"))
                if on and depth > level:
                    continue  # a sub-heading of an «(add)» heading is part of what it adds
                # rows under «(modify)» can be new too (a later part completing an earlier piece);
                # added_ids() keeps only those the definition does not have
                on, level = ("(add)" in head or "(modify)" in head), depth
            elif on and not use and line.strip().startswith("|"):
                first = split_row(line)[0].strip()
                if is_id(first):
                    out.add(first)
        return out

    def added_ids(self, known):
        """IDs the specification introduces that the definition does not have yet."""
        return {i for i in self.introduced_ids() if i not in known}


def amend(spec, rows, lang):
    """A copy of the specification with criteria the implementation decided: each row
    {Change, ID, Criterion} goes to the end of the criteria table, and its ID to the marker line
    «Decided in the implementation: …» (in the product language), so a later /jflow-spec shows them
    for confirmation."""
    lines = spec.criteria_text.splitlines()
    lines = [l for l in lines if not DECIDED_RE.match(l)]
    last = max((n for n, l in enumerate(lines) if l.strip().startswith("|")), default=None)
    new = [f"| {say(value(r['Change']), lang)} | {r['ID']} | {r['Criterion'].replace('|', chr(92) + '|')} |"
           for r in rows]
    if last is None:
        lines = criteria_header(lang).splitlines() + new
    else:
        lines = lines[:last + 1] + new + lines[last + 1:]
    ids = spec.decided() + [r["ID"] for r in rows if r["ID"] not in spec.decided()]
    text = "\n".join(lines).rstrip() + f"\n\n{say(DECIDED_LABEL, lang)}: {', '.join(ids)}."
    fields = dict(spec.fields)
    fields["acceptanceCriteria"] = text
    return Spec(spec.id, fields, spec.meta)


def decided_path(repo, id_):
    return repo.tmp / f"decided-{int(id_)}.md"


def decided_local(repo, id_):
    """IDs listed in the working folder's «Decided in the implementation» file (`- ID: …` lines)."""
    p = decided_path(repo, id_)
    if not p.exists():
        return []
    out = []
    for m in re.finditer(r"^- ([^\s:`*]+)\s*:", p.read_text(encoding="utf-8"), re.M):
        if is_id(m.group(1)) and m.group(1) not in out:
            out.append(m.group(1))
    return out


# ---------- draft file ----------

def draft_path(repo, id_):
    return repo.tmp / f"spec-{int(id_)}.md"


def render_draft(spec, lang):
    head = "\n".join(f"{k}: {v}" for k, v in spec.meta.items() if v not in (None, ""))
    out = [f"<!-- Draft of the specification of #{spec.id}. It is written to Jiku when /jflow-spec closes. -->"]
    if head:
        out.append(f"<!--\n{head}\n-->")
    for key, title in FIELDS:
        out += ["", f"# {say(title, lang)}", "", spec.fields[key] or ""]
    return "\n".join(out).rstrip() + "\n"


def fields_digest(spec):
    """A fingerprint of the three fields, to know whether Jiku changed under a draft."""
    import hashlib
    raw = "\x00".join((spec.fields.get(k) or "").strip() for k, _ in FIELDS)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def parse_draft(text, id_):
    fields, current, buf = {}, None, []
    titles = {t: k for k, t in FIELDS}
    meta = {}
    m = re.search(r"<!--\n(.*?)\n-->", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            k, sep, v = line.partition(": ")
            if sep:
                meta[k.strip()] = v.strip()
    for line in text.splitlines():
        m = re.match(r"^# (.+?)\s*$", line)
        if m and canon(m.group(1)) in titles:
            if current:
                fields[current] = "\n".join(buf).strip()
            current, buf = titles[canon(m.group(1))], []
            continue
        if current:
            buf.append(line)
    if current:
        fields[current] = "\n".join(buf).strip()
    return Spec(id_, fields, meta)


def load_draft(repo, id_):
    p = draft_path(repo, id_)
    if not p.exists():
        die(f"no draft of #{id_} ({p}): start with `jflow.py spec draft {id_}`")
    return parse_draft(p.read_text(encoding="utf-8"), id_)


def empty(lang):
    """The three fields of a new specification, with their structure in the product language."""
    def s(x):
        return say(x, lang)

    def row(*cols):
        return "| " + " | ".join(s(c) for c in cols) + " |\n|" + "---|" * len(cols)
    es = s("Scope") != "Scope"
    nothing, summary = ("Nada.", "{resumen funcional}") if es else ("Nothing.", "{functional summary}")
    return {
        "scope": f"## {s('Includes')}\n\n- \n\n## {s('Excludes')}\n\n- \n\n## {s('Depends on')}\n\n- {nothing}",
        "technicalSolution": (f"{summary}\n\n"
                              f"## {s('Parameters')}\n\n{row('Change', 'Parameter', 'Value', 'Variable')}\n\n"
                              f"## {s('Decisions')}\n\n"
                              f"{row('Type', 'ID', 'Topic', 'Decision', 'Rejected', 'Reason', 'Affects')}\n\n"
                              f"## {s('Technical detail')}\n"),
        "acceptanceCriteria": criteria_header(lang),
    }


# ---------- checks ----------

def check(spec, defn, reserved=None, implement=False, repo=None, implemented_ids=(), earlier=()):
    """Observations on a specification. `reserved`: {id: requirement} for IDs that other open
    requirements introduce; those of a requirement this one depends on count as existing (the
    dependency is built first). `implemented_ids`: IDs that already carry Origin #{this id} in the
    definition (a reopened requirement). `earlier`: IDs added by earlier parts of the plan."""
    obs = []

    def add(code, msg):
        obs.append(f"[{code}] #{spec.id}: {msg}")

    for key, title in FIELDS:
        if not spec.fields[key]:
            add("S1", f"the field «{title}» is empty")
    rows, bad = spec.criteria()
    for n, line in bad:
        add("S2", f"unreadable criterion (line {n}): {line.strip()[:100]} — check the table in Jiku")
    if not rows and spec.criteria_text:
        add("S2", "no criteria in the `| Change | ID | Criterion |` format")
    deps = set(spec.depends())
    known = set(defn.all_ids())
    ahead = set(earlier) | {i for i, r in (reserved or {}).items() if r in deps}
    own = set(implemented_ids)
    for r in rows:
        cid, change = r["ID"], value(r.get("Change"))
        if change not in CHANGES:
            add("S3", f"{cid}: invalid Change «{r.get('Change', '')}» ({' | '.join(CHANGES)})")
        if not r.get("Criterion", "").strip():
            add("S3", f"{cid} has no text")
        local = LOCAL_AC_RE.fullmatch(cid)
        if local:
            if int(local.group(1)) != spec.id:
                add("S3", f"the local criterion {cid} does not carry the requirement id ({spec.id}-AC-NN)")
            continue
        if not is_id(cid):
            add("S3", f"«{cid}» is neither a definition ID nor a local criterion")
            continue
        if change in ("modify", "remove") and cid not in known and cid not in ahead:
            if reserved and cid in reserved:
                add("S4", f"{cid}: «{change}» on something requirement #{reserved[cid]} adds, not built yet: "
                          f"move the change to that requirement or wait until it is merged")
            else:
                add("S4", f"{cid}: «{change}» but it is not in the definition")
        if change == "add" and cid in known and cid not in own:
            add("S4", f"{cid}: «add» but it is already in the definition: ask for a new one with `jflow.py next-id`")
    later = {r for r, ds in getattr(reserved, "depends", {}).items() if spec.id in ds}
    for i in sorted(spec.added_ids(known | ahead)):
        # a requirement that depends on this one completes what this one adds: not a clash
        if reserved and i in reserved and int(reserved[i]) not in later:
            add("S5", f"{i} is already used by requirement #{reserved[i]}: ask for a new one with `jflow.py next-id`")
    for d in spec.decisions():
        kind = value(d.get("Type"))
        if kind not in DECISION_TYPES:
            add("S6", f"decision {d.get('ID', '?')}: invalid type «{d.get('Type')}» ({' | '.join(DECISION_TYPES)})")
        if kind in ("new", "reverts") and d.get("Reason", "").strip() in ("", "—", "-"):
            add("S6", f"decision {d.get('ID', '?')}: a «{kind}» decision needs its reason")
        if kind in ("keeps", "reverts") and d.get("ID", "").strip() not in known | ahead:
            add("S6", f"decision {d.get('ID', '?')}: «{kind}» but it is not in the definition")
    introduced = spec.introduced_ids()
    pool = known | ahead | introduced
    kinds = {prefix_of(i) for i in pool | set(reserved or {})} | {"U", "INT", "NFR", "DEC", "DEC-T", "INV", "GAR", "CRED"}
    loose = sorted({i for i in ids_in(spec.text()) if not LOCAL_AC_RE.fullmatch(i) and prefix_of(i) in kinds}
                   - pool)
    for i in loose:
        where = (f"requirement #{reserved[i]} adds it, and this one does not depend on it" if reserved and i in reserved
                 else "it does not exist")
        add("S10", f"cites {i}, but {where}: drop the citation, add it here or add the dependency")
    for p in spec.parameters():
        if value(p.get("Change")) not in CHANGES:
            add("S7", f"parameter «{p.get('Parameter', '?')}»: invalid Change «{p.get('Change', '')}»")
    for n, line in enumerate(spec.text().splitlines(), 1):
        if PLACEHOLDER_RE.search(line):
            add("S8", f"a placeholder is left to fill: {line.strip()[:90]}")
    _check_texts(spec, defn, rows, add)
    _check_postponed(spec, add)
    _check_nfr(spec, add)
    if implement and repo is not None:
        reverted = {r.get("ID") for r in defn.reverted()}
        for d in spec.decisions():
            if value(d.get("Type")) == "keeps" and d.get("ID", "").strip() in reverted:
                add("S9", f"keeps {d['ID']}, which was reverted after this was specified")
        for dep in spec.depends():
            if not merged_in_integration(repo, dep):
                add("S9", f"depends on #{dep}, not merged in {repo.integration_branch} yet")
    return obs


def _tables(text):
    """Every markdown table in `text`, as a list of row dicts keyed by its header (English names)."""
    out, header = [], None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in split_row(line)]
        if header is None:
            header = [canon(c) for c in cells]
            out.append([])
            continue
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        out[-1].append(dict(zip(header, cells)))
    return out


def technical_rule_text(row):
    """The text a criterion must carry for an invariant or guarantee row: what the definition keeps."""
    if "Guarantee" in row and "Mechanism" in row:
        return f"{row.get('Guarantee', '')}: {row.get('Mechanism', '')}"
    if "Rule" in row:
        return row.get("Rule", "")
    return None


def _empty(v):
    return (v or "").strip() in ("", "—", "-")


def _check_texts(spec, defn, rows, add):
    """S11–S16: what the criteria, the parameters, the decisions and the out-of-scope rows say,
    against each other and against the definition."""
    from .diff import _norm, definition_text

    crit = {r["ID"]: r for r in rows}
    # S11, S12: an invariant or guarantee is stored as its row; the criterion must say the same
    for table in _tables(spec.technical().get("Invariants and guarantees", "")):
        for r in table:
            rid, change = r.get("ID", "").strip(), value(r.get("Change"))
            text = technical_rule_text(r)
            if change not in ("add", "modify") or not rid or text is None:
                continue
            if rid not in crit:
                add("S12", f"{rid} is «{change}» in «Invariants and guarantees» but is not a criterion: add it "
                           f"with the text «{text}»")
            elif _norm(text) != _norm(crit[rid].get("Criterion")):
                add("S11", f"{rid}: the criterion and the row say different things, and the definition keeps "
                           f"only one. Criterion: «{crit[rid].get('Criterion', '')}». Row: «{text}». Use the "
                           f"row's text in the criterion")
    # S14: a parameter changes only if it exists, and is added only if it does not
    params = {p.get("Parameter", "").strip().lower(): p for p in defn.parameters()}
    for p in spec.parameters():
        name, change = p.get("Parameter", "").strip(), value(p.get("Change"))
        if change in ("modify", "remove") and name.lower() not in params:
            add("S14", f"parameter «{name}»: «{change}» but it is not in parameters.md")
        if change == "add" and name.lower() in params:
            add("S14", f"parameter «{name}»: «add» but it is already in parameters.md: use «modify»")
    # S13: a parameter that changes value, and a row of the definition that still states the old one
    reverted = {d.get("ID", "").strip() for d in spec.decisions() if value(d.get("Type")) == "reverts"}
    touched = set(crit) | reverted
    texts = {d["ID"]: " ".join(v for k, v in d.items() if k not in ("ID", "Origin", "Affects"))
             for d in defn.decisions() if d.get("ID")}
    texts.update({k: v[0] for k, v in definition_text(defn).items()})
    for p in spec.parameters():
        if value(p.get("Change")) != "modify":
            continue
        old = (params.get(p.get("Parameter", "").strip().lower()) or {}).get("Value", "").strip()
        if _norm(old) == _norm(p.get("Value")) or len(old) < 3 or not re.search(r"[^\d\s.,]", old):
            continue  # unchanged, or too short / unitless to search for safely
        pat = re.compile(r"(?<!\w)" + re.escape(_norm(old)) + r"(?!\w)")
        for rid, text in sorted(texts.items()):
            if rid not in touched and pat.search(_norm(text)):
                fix = ("revert it (`reverts` + a `new` one with the new value)" if rid.startswith("DEC")
                       else "modify it (`modify`) with the new value")
                add("S13", f"«{p.get('Parameter')}» goes from «{old}» to «{p.get('Value', '')}», but {rid} says "
                           f"«{old}»: {fix}, or take the value out of its text")
    # S15: `keeps` and `reverts` are for decisions; decisions and credentials are not criteria
    for d in spec.decisions():
        did, kind = d.get("ID", "").strip(), value(d.get("Type"))
        if kind in ("keeps", "reverts") and did and not did.startswith("DEC"):
            add("S15", f"{did}: «{kind}» only applies to decisions (DEC); a rule or a parameter changes with "
                       f"«modify» in the criteria or in Parameters")
    for cid in crit:
        if prefix_of(cid) in ("DEC", "DEC-T", "CRED", "U"):
            add("S15", f"{cid} cannot be a criterion: a decision goes in Decisions, a credential or an actor in "
                       f"the technical detail")
    # S16: what leaves «out of scope» needs the decision that brings it in
    scope = sections(spec.scope.splitlines(), 2)
    outside = _norm("\n".join("\n".join(v) for k, v in scope.items() if canon(k) != "Excludes")
                    + "\n" + spec.proposal + "\n" + spec.criteria_text)
    cited = _norm(" ".join(" ".join(d.values()) for d in spec.decisions()
                           if value(d.get("Type")) in ("new", "reverts"))
                  + " " + " ".join(texts.get(i, "") for i in reverted))
    for row in defn.rows("out-of-scope.md", "Out of scope"):
        item = _norm(row.get("Out of scope"))
        if len(item) >= 4 and item in outside and item not in cited:
            add("S16", f"brings in «{row.get('Out of scope')}», which is out of scope: record the decision that "
                       f"brings it in (a `new` one naming it in Rejected, or `reverts` of the one that left it "
                       f"out), or, if it only confirms it stays out, name it in «Excludes»")


POSTPONED_RE = re.compile(r"\b(otro requisito|otra parte|requisito (aparte|propio|nuevo|posterior|siguiente)|"
                          r"más adelante|en el futuro|se pide aparte|queda para después|"
                          r"another requirement|another part|(separate|own|new|later|next) requirement|"
                          r"later on|in the future|requested separately|left for later)\b", re.I)


VERIFICATIONS = ("test", "alert", "review")


def _check_nfr(spec, add):
    """S19: every row of «Non-functional requirements» in the proposal says how it is verified."""
    lines = sections(spec.proposal.splitlines(), 2).get("Non-functional requirements", [])
    for t in _tables("\n".join(lines)):
        for r in t:
            v = value(r.get("Verification"))
            where = r.get("Tested in", "").strip()
            if v not in VERIFICATIONS:
                add("S19", f"{r.get('NFR', '?')}: it does not say how it is verified ({' | '.join(VERIFICATIONS)}), "
                           f"it says «{v}»")
            elif v == "test" and not re.fullmatch(r"base|#\d+", where):
                add("S19", f"{r.get('NFR', '?')}: verified by a test, but «Tested in» does not say where (`base` "
                           f"or the `#id` of the part), it says «{where}»")


def _check_postponed(spec, add):
    """S17: what «Excludes» leaves for another requirement names it (#id)."""
    for line in sections(spec.scope.splitlines(), 2).get("Excludes", []):
        if POSTPONED_RE.search(line) and not re.search(r"#\d+", line):
            add("S17", f"«Excludes» leaves it for another requirement without saying which: «{line.strip()[:100]}». "
                       f"Cite the #id that will do it, or record it (`jflow.py out-of-scope`) and cite the new one")


def merged_in_integration(repo, id_):
    """A requirement counts as built when the integration branch has commits that name it: (#id)."""
    out = repo.git("log", repo.integration_branch, "--oneline", "-E", f"--grep=\\(#{int(id_)}\\)", check=False)
    return bool(out.strip())
