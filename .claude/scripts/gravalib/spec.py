"""The specification of a Jiku requirement. It lives in three fields of the requirement in Jiku —
scope (Alcance), technicalSolution (Propuesta) and acceptanceCriteria (Criterios de aceptación) — as
markdown with a fixed shape. While /req-specify works, a local draft holds the same three fields.
See .claude/specs/requirement.md."""

import re

from .md import LOCAL_AC_RE, PLACEHOLDER_RE, ids_in, is_id, prefix_of, sections, split_row, table_dicts
from .repo import die

FIELDS = (("scope", "Alcance"), ("technicalSolution", "Propuesta"), ("acceptanceCriteria", "Criterios de aceptación"))
CHANGES = ("agrega", "modifica", "elimina")
DECISION_TYPES = ("nueva", "revierte", "respeta")
OPEN_STATES = ("analisis", "planificacion", "en_cola", "desarrollo", "revision")
TECH_SECTIONS = ("Bloques", "Datos", "Invariantes y garantías", "Esquema", "Interfaz", "Flujos", "Arquitectura")

CRITERIA_HEADER = "| Cambio | ID | Criterio |\n|---|---|---|"
DECIDED_LABEL = "Decidido en la implementación"
DECIDED_RE = re.compile(rf"^{DECIDED_LABEL}: ([^\n]*?)\.?\s*$", re.M)


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
        """[{Cambio, ID, Criterio, line}] and the lines that look like a criterion but cannot be read."""
        rows, bad = [], []
        lines = self.criteria_text.splitlines()
        header = None
        for n, line in enumerate(lines, 1):
            if not line.strip().startswith("|"):
                continue
            cells = split_row(line)
            if header is None:
                header = [c.strip() for c in cells]
                continue
            if all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in cells if c.strip()):
                continue
            row = dict(zip(header, [c.strip() for c in cells]))
            if len(cells) != len(header) or not row.get("ID"):
                bad.append((n, line))
                continue
            row["line"] = n
            row.setdefault("Cambio", "")
            rows.append(row)
        if header is not None and ("ID" not in header or "Criterio" not in header):
            bad.append((0, "la tabla de criterios no tiene las columnas ID y Criterio"))
        return rows, bad

    def decisions(self):
        return table_dicts(self._h2("technicalSolution").get("Decisiones", []), "Tipo")

    def parameters(self):
        return table_dicts(self._h2("technicalSolution").get("Parámetros", []), "Cambio")

    def decided(self):
        """IDs of criteria that /req-implement decided and added (`spec amend`), from the marker line."""
        m = DECIDED_RE.search(self.criteria_text)
        return [x.strip() for x in m.group(1).split(",") if x.strip()] if m else []

    def depends(self):
        return [int(x) for x in re.findall(r"#(\d+)", "\n".join(self._h2("scope").get("Depende de", [])))]

    def technical(self):
        """{section: text} of '## Detalle técnico' in the proposal."""
        lines = self._h2("technicalSolution").get("Detalle técnico", [])
        return {k: "\n".join(v).strip() for k, v in sections(lines, 3).items()}

    def ids(self):
        """Every definition ID the specification mentions (criteria, decisions, technical detail)."""
        return set(ids_in(self.text()))

    def introduced_ids(self):
        """IDs the specification adds to the definition: criteria and technical rows marked `agrega`,
        new decisions, and the IDs of the tables under a heading marked «(agrega)» or «(modifica)» (and its
        sub-headings). Cited IDs do not count."""
        out = set()
        for line in (self.criteria_text + "\n" + self.proposal).splitlines():
            if line.strip().startswith("|"):
                cells = split_row(line)
                if len(cells) > 1 and cells[0].strip().lower() == "agrega" and is_id(cells[1].strip()):
                    out.add(cells[1].strip())
        for d in self.decisions():
            if d.get("Tipo", "").strip().lower() == "nueva" and d.get("ID", "").strip():
                out.add(d["ID"].strip())
        on, level, use = False, 0, False
        for line in self.proposal.splitlines():
            if line.startswith("#"):
                depth = len(line) - len(line.lstrip("#"))
                # the use and the roles of a credential cite it; only its own table adds it
                use = line.lstrip("#").strip().lower().startswith(("uso", "roles"))
                if on and depth > level:
                    continue  # a sub-heading of an «(agrega)» heading is part of what it adds
                # rows under «(modifica)» can be new too (a later part completing an earlier piece);
                # added_ids() keeps only those the definition does not have
                on, level = ("(agrega)" in line or "(modifica)" in line), depth
            elif on and not use and line.strip().startswith("|"):
                first = split_row(line)[0].strip()
                if is_id(first):
                    out.add(first)
        return out

    def added_ids(self, known):
        """IDs the specification introduces that the definition does not have yet."""
        return {i for i in self.introduced_ids() if i not in known}


def amend(spec, rows):
    """A copy of the specification with criteria the implementation decided: each row
    {Cambio, ID, Criterio} goes to the end of the criteria table, and its ID to the marker line
    «Decidido en la implementación: …», so a later /req-specify shows them for confirmation."""
    lines = spec.criteria_text.splitlines()
    lines = [l for l in lines if not DECIDED_RE.match(l)]
    last = max((n for n, l in enumerate(lines) if l.strip().startswith("|")), default=None)
    new = [f"| {r['Cambio']} | {r['ID']} | {r['Criterio'].replace('|', chr(92) + '|')} |" for r in rows]
    if last is None:
        lines = CRITERIA_HEADER.splitlines() + new
    else:
        lines = lines[:last + 1] + new + lines[last + 1:]
    ids = spec.decided() + [r["ID"] for r in rows if r["ID"] not in spec.decided()]
    text = "\n".join(lines).rstrip() + f"\n\n{DECIDED_LABEL}: {', '.join(ids)}."
    fields = dict(spec.fields)
    fields["acceptanceCriteria"] = text
    return Spec(spec.id, fields, spec.meta)


def decided_path(repo, id_):
    return repo.tmp / f"decided-{int(id_)}.md"


def decided_local(repo, id_):
    """IDs listed in the working folder's «Decidido en la implementación» file (`- ID: …` lines)."""
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


def render_draft(spec):
    head = "\n".join(f"{k}: {v}" for k, v in spec.meta.items() if v not in (None, ""))
    out = [f"<!-- Borrador de la especificación de #{spec.id}. Se escribe en Jiku al cerrar /req-specify. -->"]
    if head:
        out.append(f"<!--\n{head}\n-->")
    for key, title in FIELDS:
        out += ["", f"# {title}", "", spec.fields[key] or ""]
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
        if m and m.group(1) in titles:
            if current:
                fields[current] = "\n".join(buf).strip()
            current, buf = titles[m.group(1)], []
            continue
        if current:
            buf.append(line)
    if current:
        fields[current] = "\n".join(buf).strip()
    return Spec(id_, fields, meta)


def load_draft(repo, id_):
    p = draft_path(repo, id_)
    if not p.exists():
        die(f"no hay borrador de #{id_} ({p}): empezá con `grava.py spec draft {id_}`")
    return parse_draft(p.read_text(encoding="utf-8"), id_)


EMPTY = {
    "scope": "## Incluye\n\n- \n\n## No incluye\n\n- \n\n## Depende de\n\n- Nada.",
    "technicalSolution": ("{resumen funcional}\n\n## Parámetros\n\n| Cambio | Parámetro | Valor | Variable |\n|---|---|---|---|\n\n"
                          "## Decisiones\n\n| Tipo | ID | Tema | Decisión | Descartado | Motivo | Afecta |\n|---|---|---|---|---|---|---|\n\n"
                          "## Detalle técnico\n"),
    "acceptanceCriteria": CRITERIA_HEADER,
}


# ---------- checks ----------

def check(spec, defn, reserved=None, implement=False, repo=None, implemented_ids=(), earlier=()):
    """Observations on a specification. `reserved`: {id: requirement} for IDs that other open
    requirements introduce; those of a requirement this one depends on count as existing (the
    dependency is built first). `implemented_ids`: IDs that already carry Origen #{this id} in the
    definition (a reopened requirement). `earlier`: IDs added by earlier parts of the plan."""
    obs = []

    def add(code, msg):
        obs.append(f"[{code}] #{spec.id}: {msg}")

    for key, title in FIELDS:
        if not spec.fields[key]:
            add("S1", f"el campo «{title}» está vacío")
    rows, bad = spec.criteria()
    for n, line in bad:
        add("S2", f"criterio ilegible (línea {n}): {line.strip()[:100]} — revisá la tabla en Jiku")
    if not rows and spec.criteria_text:
        add("S2", "no hay criterios con el formato `| Cambio | ID | Criterio |`")
    deps = set(spec.depends())
    known = set(defn.all_ids())
    ahead = set(earlier) | {i for i, r in (reserved or {}).items() if r in deps}
    own = set(implemented_ids)
    for r in rows:
        cid, change = r["ID"], r.get("Cambio", "").strip().lower()
        if change not in CHANGES:
            add("S3", f"{cid}: Cambio «{r.get('Cambio', '')}» inválido ({' | '.join(CHANGES)})")
        if not r.get("Criterio", "").strip():
            add("S3", f"{cid} no tiene texto")
        local = LOCAL_AC_RE.fullmatch(cid)
        if local:
            if int(local.group(1)) != spec.id:
                add("S3", f"el criterio local {cid} no lleva el id del requisito ({spec.id}-AC-NN)")
            continue
        if not is_id(cid):
            add("S3", f"«{cid}» no es un ID de la definición ni un criterio local")
            continue
        if change in ("modifica", "elimina") and cid not in known and cid not in ahead:
            if reserved and cid in reserved:
                add("S4", f"{cid}: «{change}» sobre algo que agrega el requisito #{reserved[cid]}, todavía no "
                          f"construido: sumá el cambio a ese requisito o esperá a que se mergee")
            else:
                add("S4", f"{cid}: «{change}» pero no existe en la definición")
        if change == "agrega" and cid in known and cid not in own:
            add("S4", f"{cid}: «agrega» pero ya existe en la definición: pedí uno nuevo con `grava.py next-id`")
    later = {r for r, ds in getattr(reserved, "depends", {}).items() if spec.id in ds}
    for i in sorted(spec.added_ids(known | ahead)):
        # a requirement that depends on this one completes what this one adds: not a clash
        if reserved and i in reserved and int(reserved[i]) not in later:
            add("S5", f"{i} ya lo usa el requisito #{reserved[i]}: pedí uno nuevo con `grava.py next-id`")
    for d in spec.decisions():
        tipo = d.get("Tipo", "").strip().lower()
        if tipo not in DECISION_TYPES:
            add("S6", f"decisión {d.get('ID', '?')}: tipo «{d.get('Tipo')}» inválido ({' | '.join(DECISION_TYPES)})")
        if tipo in ("nueva", "revierte") and d.get("Motivo", "").strip() in ("", "—", "-"):
            add("S6", f"decisión {d.get('ID', '?')}: una decisión {tipo} necesita su motivo")
        if tipo in ("respeta", "revierte") and d.get("ID", "").strip() not in known | ahead:
            add("S6", f"decisión {d.get('ID', '?')}: «{tipo}» pero no existe en la definición")
    introduced = spec.introduced_ids()
    pool = known | ahead | introduced
    kinds = {prefix_of(i) for i in pool | set(reserved or {})} | {"U", "INT", "NFR", "DEC", "DEC-T", "INV", "GAR", "CRED"}
    loose = sorted({i for i in ids_in(spec.text()) if not LOCAL_AC_RE.fullmatch(i) and prefix_of(i) in kinds}
                   - pool)
    for i in loose:
        where = f"lo agrega #{reserved[i]}, del que este no depende" if reserved and i in reserved else "no existe"
        add("S10", f"cita {i}, que {where}: sacá la cita, agregalo acá o sumá la dependencia")
    for p in spec.parameters():
        if p.get("Cambio", "").strip().lower() not in CHANGES:
            add("S7", f"parámetro «{p.get('Parámetro', '?')}»: Cambio «{p.get('Cambio', '')}» inválido")
    for n, line in enumerate(spec.text().splitlines(), 1):
        if PLACEHOLDER_RE.search(line):
            add("S8", f"queda un marcador para completar: {line.strip()[:90]}")
    _check_texts(spec, defn, rows, add)
    _check_postponed(spec, add)
    _check_nfr(spec, add)
    if implement and repo is not None:
        reverted = {r.get("ID") for r in defn.reverted()}
        for d in spec.decisions():
            if d.get("Tipo", "").strip().lower() == "respeta" and d.get("ID", "").strip() in reverted:
                add("S9", f"respeta {d['ID']}, que fue revertida después de especificarse")
        for dep in spec.depends():
            if not merged_in_integration(repo, dep):
                add("S9", f"depende de #{dep}, que todavía no está mergeado en {repo.integration_branch}")
    return obs


def _tables(text):
    """Every markdown table in `text`, as a list of row dicts keyed by its header."""
    out, header = [], None
    for line in text.splitlines():
        if not line.strip().startswith("|"):
            header = None
            continue
        cells = [c.strip() for c in split_row(line)]
        if header is None:
            header = cells
            out.append([])
            continue
        if all(re.fullmatch(r":?-{2,}:?", c) for c in cells if c):
            continue
        out[-1].append(dict(zip(header, cells)))
    return out


def technical_rule_text(row):
    """The text a criterion must carry for an invariant or guarantee row: what the definition keeps."""
    if "Garantía" in row and "Mecanismo" in row:
        return f"{row.get('Garantía', '')}: {row.get('Mecanismo', '')}"
    if "Regla" in row:
        return row.get("Regla", "")
    return None


def _empty(v):
    return (v or "").strip() in ("", "—", "-")


def _check_texts(spec, defn, rows, add):
    """S11–S16: what the criteria, the parameters, the decisions and the out-of-scope rows say,
    against each other and against the definition."""
    from .diff import _norm, definition_text

    crit = {r["ID"]: r for r in rows}
    # S11, S12: an invariant or guarantee is stored as its row; the criterion must say the same
    for table in _tables(spec.technical().get("Invariantes y garantías", "")):
        for r in table:
            rid, change = r.get("ID", "").strip(), r.get("Cambio", "").strip().lower()
            text = technical_rule_text(r)
            if change not in ("agrega", "modifica") or not rid or text is None:
                continue
            if rid not in crit:
                add("S12", f"{rid} se {change} en «Invariantes y garantías» pero no es criterio: sumalo con "
                           f"el texto «{text}»")
            elif _norm(text) != _norm(crit[rid].get("Criterio")):
                add("S11", f"{rid}: el criterio y la fila dicen cosas distintas, y la definición guarda uno "
                           f"solo. Criterio: «{crit[rid].get('Criterio', '')}». Fila: «{text}». Usá el texto de "
                           f"la fila en el criterio")
    # S14: a parameter changes only if it exists, and is added only if it does not
    params = {p.get("Parámetro", "").strip().lower(): p for p in defn.parameters()}
    for p in spec.parameters():
        name, change = p.get("Parámetro", "").strip(), p.get("Cambio", "").strip().lower()
        if change in ("modifica", "elimina") and name.lower() not in params:
            add("S14", f"parámetro «{name}»: «{change}» pero no existe en parameters.md")
        if change == "agrega" and name.lower() in params:
            add("S14", f"parámetro «{name}»: «agrega» pero ya existe en parameters.md: usá «modifica»")
    # S13: a parameter that changes value, and a row of the definition that still states the old one
    reverted = {d.get("ID", "").strip() for d in spec.decisions() if d.get("Tipo", "").strip().lower() == "revierte"}
    touched = set(crit) | reverted
    texts = {d["ID"]: " ".join(v for k, v in d.items() if k not in ("ID", "Origen", "Afecta"))
             for d in defn.decisions() if d.get("ID")}
    texts.update({k: v[0] for k, v in definition_text(defn).items()})
    for p in spec.parameters():
        if p.get("Cambio", "").strip().lower() != "modifica":
            continue
        old = (params.get(p.get("Parámetro", "").strip().lower()) or {}).get("Valor", "").strip()
        if _norm(old) == _norm(p.get("Valor")) or len(old) < 3 or not re.search(r"[^\d\s.,]", old):
            continue  # unchanged, or too short / unitless to search for safely
        pat = re.compile(r"(?<!\w)" + re.escape(_norm(old)) + r"(?!\w)")
        for rid, text in sorted(texts.items()):
            if rid not in touched and pat.search(_norm(text)):
                fix = ("revertila (`revierte` + una `nueva` con el valor nuevo)" if rid.startswith("DEC")
                       else "modificala (`modifica`) con el valor nuevo")
                add("S13", f"«{p.get('Parámetro')}» pasa de «{old}» a «{p.get('Valor', '')}», pero {rid} dice "
                           f"«{old}»: {fix}, o sacá el valor de su texto")
    # S15: `respeta` and `revierte` are for decisions; decisions and credentials are not criteria
    for d in spec.decisions():
        did, tipo = d.get("ID", "").strip(), d.get("Tipo", "").strip().lower()
        if tipo in ("respeta", "revierte") and did and not did.startswith("DEC"):
            add("S15", f"{did}: «{tipo}» solo aplica a decisiones (DEC); una regla o un parámetro cambia con "
                       f"«modifica» en los criterios o en Parámetros")
    for cid in crit:
        if prefix_of(cid) in ("DEC", "DEC-T", "CRED", "U"):
            add("S15", f"{cid} no puede ser criterio: una decisión va en Decisiones, una credencial o un actor "
                       f"en el detalle técnico")
    # S16: what leaves «fuera de alcance» needs the decision that brings it in
    scope = sections(spec.scope.splitlines(), 2)
    outside = _norm("\n".join("\n".join(v) for k, v in scope.items() if k.strip().lower() != "no incluye")
                    + "\n" + spec.proposal + "\n" + spec.criteria_text)
    cited = _norm(" ".join(" ".join(d.values()) for d in spec.decisions()
                           if d.get("Tipo", "").strip().lower() in ("nueva", "revierte"))
                  + " " + " ".join(texts.get(i, "") for i in reverted))
    for row in defn.rows("out-of-scope.md", "Fuera de alcance"):
        item = _norm(row.get("Fuera de alcance"))
        if len(item) >= 4 and item in outside and item not in cited:
            add("S16", f"trae «{row.get('Fuera de alcance')}», que está fuera de alcance: registrá la decisión "
                       f"que lo incorpora (una `nueva` que lo nombre en Descartado, o `revierte` de la que lo "
                       f"excluyó), o, si solo confirma que sigue afuera, nombralo en «No incluye»")


POSTPONED_RE = re.compile(r"\b(otro requisito|otra parte|requisito (aparte|propio|nuevo|posterior|siguiente)|"
                          r"más adelante|en el futuro|se pide aparte|queda para después)\b", re.I)


VERIFICATIONS = ("prueba", "alerta", "revisión")


def _check_nfr(spec, add):
    """S19: every row of «Requisitos no funcionales» in the proposal says how it is verified."""
    lines = sections(spec.proposal.splitlines(), 2).get("Requisitos no funcionales", [])
    for t in _tables("\n".join(lines)):
        for r in t:
            v = r.get("Verificación", "").strip().lower()
            where = r.get("Prueba en", "").strip()
            if v not in VERIFICATIONS:
                add("S19", f"{r.get('NFR', '?')}: falta cómo se verifica ({' | '.join(VERIFICATIONS)}), no «{v}»")
            elif v == "prueba" and not re.fullmatch(r"base|#\d+", where):
                add("S19", f"{r.get('NFR', '?')}: se verifica con una prueba, pero «Prueba en» no dice dónde "
                           f"(`base` o el `#id` de la parte), dice «{where}»")


def _check_postponed(spec, add):
    """S17: what «No incluye» leaves for another requirement names it (#id)."""
    for line in sections(spec.scope.splitlines(), 2).get("No incluye", []):
        if POSTPONED_RE.search(line) and not re.search(r"#\d+", line):
            add("S17", f"«No incluye» lo deja para otro requisito sin decir cuál: «{line.strip()[:100]}». Citá el "
                       f"#id que lo va a hacer, o registralo (`grava.py out-of-scope`) y citá el nuevo")


def merged_in_integration(repo, id_):
    """A requirement counts as built when the integration branch has commits that name it: (#id)."""
    out = repo.git("log", repo.integration_branch, "--oneline", "-E", f"--grep=\\(#{int(id_)}\\)", check=False)
    return bool(out.strip())
