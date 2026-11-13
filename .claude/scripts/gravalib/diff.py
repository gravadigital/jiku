"""What is left to do: the specification in Jiku against what the definition and the tests of the
current branch already have. Used to resume an open branch, or to adapt a reopened requirement whose
specification changed after it was implemented."""

import re
from pathlib import Path

from .evidence import scan_tests
from .md import LOCAL_AC_RE, prefix_of, render_table


def _norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\\|", "|")).strip().rstrip(".").lower()


def definition_text(defn):
    """{id: (text as a criterion, origin)} for every row a criterion can map to."""
    out = {}
    for p in defn.blocks:
        req, fail = defn.block_rows(p)
        for r in req:
            text = r.get("Requisito") or (f"{r.get('Evento', '')}: {r.get('Canal', '')} a {r.get('Destinatario', '')} — "
                                          f"{r.get('Contenido', '')}")
            out[r["ID"]] = (text, r.get("Origen", "").strip())
        for r in fail:
            out[r["ID"]] = (f"{r.get('Condición', '')} → {r.get('Resultado', '')}", r.get("Origen", "").strip())
    for r in defn.invariants():
        out[r["ID"]] = (r.get("Regla", ""), r.get("Origen", "").strip())
    for r in defn.guarantees():
        out[r["ID"]] = (f"{r.get('Garantía', '')}: {r.get('Mecanismo', '')}", r.get("Origen", "").strip())
    return out


DECISION_TEXT = ("Tema", "Decisión", "Descartado", "Motivo")


def integration_definition(repo):
    """The definition as the integration branch has it, read into a temporary folder; None when the
    current branch is the integration branch or it has no definition."""
    import io
    import shutil
    import subprocess
    import tarfile

    from .definition import Definition
    from .repo import Repo

    branch = repo.integration_branch
    if repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False).strip() == branch:
        return None
    r = subprocess.run(["git", "archive", "--format=tar", branch, "_gflow"], cwd=repo.root, capture_output=True)
    if r.returncode != 0:
        return None
    tmp = Path(repo.tmp) / "integration-definition"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    with tarfile.open(fileobj=io.BytesIO(r.stdout)) as tar:
        tar.extractall(tmp, filter="data")
    return Definition(Repo(tmp))


def definition_changes(base, defn, spec):
    """D1–D3: what changed in the definition between the integration branch and this branch that the
    specification does not account for. [[ID, Cambio, Estado, Detalle]]"""
    rows = []
    crit = {c["ID"] for c in spec.criteria()[0]}
    decisions = spec.decisions()
    # D1: a decision changes only by reverting it (it moves to Revertidas, and a `nueva` replaces it)
    now = {d["ID"]: d for d in defn.decisions() if d.get("ID")}
    for d in base.decisions():
        cur = now.get(d.get("ID"))
        if not cur:
            continue
        changed = [c for c in DECISION_TEXT if _norm(d.get(c)) != _norm(cur.get(c))]
        if changed:
            rows.append([d["ID"], "—", "decisión cambiada sin revertirla",
                         f"cambió {', '.join(changed)}: devolvé el texto de la rama de integración y, si el cambio "
                         f"es a propósito, que la especificación la revierta (`revierte` + `nueva`)"])
    # D2: a row of the definition changes only through a criterion
    before, after = definition_text(base), definition_text(defn)
    for cid, (text, _) in sorted(before.items()):
        if cid in after and cid not in crit and _norm(text) != _norm(after[cid][0]):
            rows.append([cid, "—", "fila cambiada sin criterio",
                         "devolvé el texto anterior, o que la especificación lo incluya con «modifica»"])
    # D3: a row leaves «fuera de alcance» only with the decision that brings it in
    gone = ({_norm(r.get("Fuera de alcance")): r.get("Fuera de alcance") for r in base.rows("out-of-scope.md", "Fuera de alcance")}
            .items())
    still = {_norm(r.get("Fuera de alcance")) for r in defn.rows("out-of-scope.md", "Fuera de alcance")}
    reverted = {d.get("ID", "").strip() for d in decisions if d.get("Tipo", "").strip().lower() == "revierte"}
    cited = _norm(" ".join(" ".join(d.values()) for d in decisions
                           if d.get("Tipo", "").strip().lower() in ("nueva", "revierte"))
                  + " " + " ".join(" ".join(d.values()) for d in base.decisions() if d.get("ID") in reverted))
    for key, item in gone:
        if key and key not in still and key not in cited:
            rows.append(["Fuera de alcance", "—", "fila quitada sin decisión",
                         f"«{item}»: la especificación necesita la decisión que lo incorpora; si no, devolvé la fila"])
    return rows



def spec_diff(repo, defn, spec):
    tag = f"#{spec.id}"
    have = definition_text(defn)
    tests = scan_tests(repo.root)
    rows, pending = [], 0
    crit, bad = spec.criteria()
    from .spec import decided_local
    listed = {c["ID"] for c in crit}
    for cid in decided_local(repo, spec.id):
        # decided in this branch and listed: checked like a criterion until `spec amend` adds it
        if cid not in listed and cid in have:
            crit.append({"ID": cid, "Cambio": "agrega", "Criterio": have[cid][0]})
    mentioned = set()
    for c in crit:
        cid, change = c["ID"], c.get("Cambio", "").strip().lower()
        mentioned.add(cid)
        has_test = bool(tests.get(cid))
        if LOCAL_AC_RE.fullmatch(cid):
            state = "listo" if has_test else "falta el test"
            rows.append([cid, change, state, ""])
            pending += state != "listo"
            continue
        cur = have.get(cid)
        if change == "elimina":
            if cur:
                rows.append([cid, change, "falta eliminarlo de la definición", ""])
                pending += 1
            if has_test:
                rows.append([cid, change, "quedan tests con su ID", ", ".join(tests[cid][:3])])
                pending += 1
            if not cur and not has_test:
                rows.append([cid, change, "listo", ""])
            continue
        notes = []
        if not cur:
            notes.append("falta en la definición")
        elif _norm(cur[0]) != _norm(c.get("Criterio")):
            notes.append(f"el texto de la definición es otro: «{cur[0][:80]}»")
        elif change in ("agrega", "modifica") and cur[1] != tag:
            notes.append(f"Origen es «{cur[1]}», no {tag}")
        if not has_test:
            notes.append("falta el test")
        rows.append([cid, change, "listo" if not notes else "pendiente", "; ".join(notes)])
        pending += bool(notes)
    for cid, (text, origin) in sorted(have.items()):
        if origin == tag and cid not in mentioned:
            rows.append([cid, "—", "sobra: la especificación ya no lo incluye",
                         "sacarlo de la definición, con su código y sus tests"])
            pending += 1
    known = {r["ID"] for r in defn.decisions()}
    reverted = {r["ID"] for r in defn.reverted()}
    for d in spec.decisions():
        did, tipo = d.get("ID", "").strip(), d.get("Tipo", "").strip().lower()
        if tipo == "nueva" and did not in known:
            rows.append([did, "nueva", "falta en decisions.md", ""])
            pending += 1
        elif tipo == "revierte" and did not in reverted:
            rows.append([did, "revierte", "falta moverla a Revertidas", ""])
            pending += 1
    params = {p["Parámetro"].strip().lower(): p for p in defn.parameters()}
    for p in spec.parameters():
        name, change = p.get("Parámetro", "").strip(), p.get("Cambio", "").strip().lower()
        cur = params.get(name.lower())
        if change == "elimina" and cur:
            rows.append([name, change, "falta eliminarlo de parameters.md", ""])
            pending += 1
        elif change in ("agrega", "modifica") and (not cur or _norm(cur.get("Valor")) != _norm(p.get("Valor"))):
            rows.append([name, change, "pendiente", "falta en parameters.md o tiene otro valor"])
            pending += 1
    base = integration_definition(repo)
    if base is not None:
        for r in definition_changes(base, defn, spec):
            rows.append(r)
            pending += 1
    for n, line in bad:
        rows.append(["?", "?", "criterio ilegible", line[:80]])
    head = (f"#{spec.id}: {pending} pendientes. El detalle técnico (datos, esquema, interfaz, flujos, arquitectura) "
            "se compara a mano contra _gflow/.\n\n")
    return head + render_table(["ID", "Cambio", "Estado", "Detalle"], rows)
