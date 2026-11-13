#!/usr/bin/env python3
"""grava — the deterministic half of the workflow. Agents decide; this script does the repeatable
work: reading the discovery, building the plan and the base definition, indexing, checking,
allocating IDs, loading context, reading and writing specifications in Jiku, branches, evidence,
MR text, release and status. Standard library only.

    python3 .claude/scripts/grava.py <command> [options]      (help: grava.py -h, grava.py <command> -h)
"""

import argparse
import json
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True

from gravalib import definition as D  # noqa: E402
from gravalib import evidence as E  # noqa: E402
from gravalib import jiku as J  # noqa: E402
from gravalib import spec as S  # noqa: E402
from gravalib import workflow as W  # noqa: E402
from gravalib.md import TEST_TAG_RE, ids_in, render_table  # noqa: E402
from gravalib.repo import Repo, die  # noqa: E402

TEMPLATES = HERE.parent / "templates"


def report(obs, ok_msg="Sin observaciones"):
    for o in obs:
        print(o)
    print(f"{len(obs)} observaciones" if obs else ok_msg)
    return 1 if obs else 0


def get_spec(repo, id_, source):
    """The specification from the local draft or from Jiku."""
    if source == "draft":
        return S.load_draft(repo, id_)
    sp, _ = J.get_spec(repo, id_)
    return sp


def spec_amend(repo, defn, a):
    """Add to the Jiku specification the criteria the implementation decided (listed in the working
    folder's decided-{id}.md), with the text the definition of this branch has."""
    from gravalib.diff import definition_text, integration_definition
    sp = get_spec(repo, a.id, "jiku")
    have = definition_text(defn)
    base = integration_definition(repo)
    before = definition_text(base) if base is not None else {}
    listed = {r["ID"] for r in sp.criteria()[0]}
    rows, missing = [], []
    for cid in S.decided_local(repo, a.id):
        if cid in listed:
            continue
        cur = have.get(cid)
        if not cur or cur[1] != f"#{int(a.id)}":
            missing.append(cid)
            continue
        rows.append({"Cambio": "modifica" if cid in before else "agrega", "ID": cid, "Criterio": cur[0]})
    if missing:
        die(f"sin fila con Origen #{a.id} en la definición: {', '.join(missing)} — agregala antes de `spec amend`")
    if not rows:
        print("Nada que agregar: la especificación ya tiene lo decidido.")
        return 0
    new = S.amend(sp, rows)
    own = implemented_ids(defn, a.id)
    old = set(S.check(sp, defn, {}, implemented_ids=own))
    obs = [o for o in S.check(new, defn, {}, implemented_ids=own) if o not in old]  # only what the rows add
    if obs:
        return report(obs)
    if a.dry:
        print(new.criteria_text)
        return 0
    J.write_spec(repo, a.id, new)
    print(f"especificación de #{a.id}: {len(rows)} criterios decididos en la implementación ({', '.join(r['ID'] for r in rows)})")
    return 0


def implemented_ids(defn, id_):
    """IDs that already carry Origen #id in the definition (a reopened requirement)."""
    out = set()
    tag = f"#{int(id_)}"
    for p in defn.blocks:
        req, fail = defn.block_rows(p)
        out |= {r["ID"] for r in req + fail if r.get("Origen", "").strip() == tag}
    for rows in (defn.invariants(), defn.guarantees(), defn.decisions(), defn.credentials(), defn.integrations()):
        out |= {r["ID"] for r in rows if r.get("ID") and r.get("Origen", "").strip() == tag}
    return out


# ---------- discovery, plan and base ----------

def c_discovery_check(a, repo):
    sys.argv = ["check-discovery.py"] + (["--final"] if a.final else []) + [str(repo.discovery)]
    try:
        runpy.run_path(str(HERE / "check-discovery.py"), run_name="__main__")
    except SystemExit as e:
        return e.code or 0
    return 0


def _model(repo):
    from gravalib.transcribe import build_model
    return build_model(repo)


def c_plan_blocks(a, repo):
    from gravalib.plan import block_info
    _, meta = _model(repo)
    rows = [[p, i["name"], ", ".join(i["entities"]) or "—", ", ".join(i["cites"]) or "—",
             ", ".join(i["surfaces"]) or "—"] for p, i in sorted(block_info(meta).items())]
    print(render_table(["Bloque", "Nombre", "Entidades", "Cita bloques", "Superficies"], rows))
    print("\nUn bloque que cita a otro (o que usa una entidad que otro crea) va en la misma parte o después.\n"
          "Las entidades se detectan por su nombre en el texto: si una no corresponde, fijá en el plan qué parte la crea.")
    return 0


def c_plan_build(a, repo):
    from gravalib.plan import build
    files, meta = _model(repo)
    plan = json.loads(Path(a.plan).read_text(encoding="utf-8"))
    template = (TEMPLATES / "base-requirement.md").read_text(encoding="utf-8")
    paths, deps, warnings = build(repo, files, meta, plan, template, force=a.force)
    for p in paths:
        n = int(p.stem.split("-")[1])
        dep = ", ".join("base" if d == 0 else f"parte {d}" for d in deps.get(n, [])) or "—"
        print(f"{p}  (depende de: {dep})" if n else f"{p}  (producto base)")
    for w in warnings:
        print(f"aviso: {w}")
    print("Resolvé los marcadores {{completar: …}} de cada borrador y corré `grava.py plan-check`.")
    return 0


def product_level_ids(repo):
    """IDs the base definition writes before any part (actors, NFRs, product decisions), from the
    discovery: cited by the parts, they exist from the base on."""
    files, meta = _model(repo)
    out = set()
    for rel in ("prd/index.md", "prd/nfr.md", "prd/out-of-scope.md"):
        out |= set(ids_in(files.get(rel, "")))
    return out


def plan_spec_obs(parts, defn, repo):
    """spec check of each part, taking as existing what the earlier parts add."""
    obs, earlier = [], set(product_level_ids(repo))
    for n, p, sp in parts:
        # S19 (how each NFR is verified) is settled when the base is specified, not in the plan's drafts
        obs += [f"parte {n}: {o}" for o in S.check(sp, defn, earlier=earlier) if not o.startswith("[S19]")]
        earlier |= sp.introduced_ids()
    return obs


def c_plan_check(a, repo):
    from gravalib.plan import load_parts, order_check
    defn = D.Definition(repo)
    obs = []
    parts = load_parts(repo)
    obs += plan_spec_obs(parts, defn, repo)
    obs += order_check(parts)
    return report(obs)


def c_plan_push(a, repo):
    from gravalib.plan import load_parts, plan_dir
    created_p = plan_dir(repo) / "created.json"
    created = {int(k): v for k, v in json.loads(created_p.read_text()).items()} if created_p.exists() else {}
    parts = load_parts(repo)
    plan = json.loads((plan_dir(repo) / "plan.json").read_text(encoding="utf-8"))
    name = a.product
    defn = D.Definition(repo)
    from gravalib.plan import order_check
    bad = plan_spec_obs(parts, defn, repo) + order_check(parts)
    if bad:
        return report(bad)

    def title_of(n):
        return "0 · Producto base" if n == 0 else f"{n} · {plan['parts'][n - 1]['title']}"

    # what Jiku already has: an open requirement of the project with the part's title is that part
    # (a lost created.json, or a resumed run), never created twice
    existing = {}
    for r in J.list_requirements(repo) or []:
        if r.get("state") not in ("resuelto", "cancelado"):
            existing.setdefault(r.get("title", "").strip(), int(r["id"]))
    rows = []
    for n, p, sp in parts:
        t = title_of(n)
        if n in created:
            rows.append([t, f"ya creada (#{created[n]})"])
        elif t in existing:
            created[n] = existing[t]
            rows.append([t, f"ya existe en Jiku (#{existing[t]}): no se toca"])
        else:
            rows.append([t, "crear"])
    if a.preview:
        j = J.Jiku(repo)
        print(f"Plan para Jiku (proyecto {j.project_id}, {j.instance}):\n")
        print(render_table(["Requisito", "Acción"], rows))
        todo = sum(1 for r in rows if r[1] == "crear")
        print(f"\n{todo} para crear." if todo else "\nNada para crear: el plan ya está en Jiku.")
        return 0
    created_p.write_text(json.dumps(created), encoding="utf-8")
    for n, p, sp in parts:
        if n in created:
            print(f"parte {n}: ya está (#{created[n]})")
            continue
        fields = dict(sp.fields)
        for k in fields:
            for m, rid in created.items():
                fields[k] = fields[k].replace(f"#P{m} ", f"#{rid} ").replace(f"#P{m}\n", f"#{rid}\n")
        if n == 0:
            title = "0 · Producto base"
            desc = (f"Producto base de {name}: la estructura sobre la que se construyen las partes del plan. "
                    f"Va primero: las partes se implementan en el orden de su número.")
        else:
            part = plan["parts"][n - 1]
            title = f"{n} · {part['title']}"
            desc = (f"Parte {n} del plan inicial de {name}. Bloques: {', '.join(part['blocks'])}. "
                    f"Se implementa después de las partes de número menor de las que depende.")
        rid = J.new_requirement(repo, title, J.with_spec_line(desc, J.SPEC_DRAFT), "funcionalidad", "planificacion",
                                fields, "public")
        if rid is None:
            if J.Jiku(repo).dry:
                rid = -(n + 1)
            else:
                print(f"parte {n}: no se pudo crear; corregí y volvé a correr plan-push (las creadas se saltean)")
                return 1
        if n == 0 and rid > 0:
            crit = fields["acceptanceCriteria"].replace("| 0-AC-", f"| {rid}-AC-")
            J.Jiku(repo).command(f"requirements.{rid}.edit", {"acceptanceCriteria": crit})
        created[n] = rid
        created_p.write_text(json.dumps(created), encoding="utf-8")
        print(f"parte {n}: #{rid} {title}")
    return 0


def c_def_base(a, repo):
    from gravalib.plan import write_base_definition
    if repo.prd.exists() and any(repo.prd.iterdir()) and not a.force:
        die("_gflow/prd/ ya existe. Usá --force para regenerarlo")
    files, meta = _model(repo)
    plan = json.loads(Path(a.plan).read_text(encoding="utf-8")) if a.plan else None
    written = write_base_definition(repo, files, meta, plan)
    D.generate_indexes(D.Definition(repo))
    print(f"Definición del producto base: {len(written)} archivos en _gflow/.")
    pending = []
    for rel in written:
        n = (repo.gflow / rel).read_text(encoding="utf-8").count("{{completar")
        if n:
            pending.append(f"  _gflow/{rel}: {n}")
    if pending:
        print("Marcadores {{completar: …}} para resolver (juicio del agente):\n" + "\n".join(pending))
    return 0


# ---------- definition ----------

def c_def_index(a, repo):
    for p in D.generate_indexes(D.Definition(repo)):
        print(f"generado {repo.rel(p)}")
    return 0


def c_def_check(a, repo):
    return report(D.check(D.Definition(repo)))


def c_next_id(a, repo):
    defn = D.Definition(repo)
    if a.kind.endswith("-AC"):
        jid = int(a.kind[:-3])
        used = set(E.scan_tests(repo.root))
        if S.draft_path(repo, jid).exists():
            used |= {r["ID"] for r in S.load_draft(repo, jid).criteria()[0]}
        nums = [int(t.split("-AC-")[1]) for t in used if t.startswith(f"{jid}-AC-")]
        n = max(nums, default=0)
        print("\n".join(f"{jid}-AC-{n + k:02d}" for k in range(1, a.count + 1)))
        return 0
    reserved = {}
    if not a.offline:
        reserved = J.reserved_ids(repo, defn, exclude=a.requirement)
    print("\n".join(D.next_ids(defn, a.kind, a.count, reserved)))
    return 0


def c_load(a, repo):
    defn = D.Definition(repo)
    if not defn.exists:
        die("no existe _gflow/prd/")
    blocks, ids, ents, mods = list(a.block), list(a.id), list(a.entity), list(a.module)
    if a.requirement:
        sp = get_spec(repo, a.requirement, a.source)
        known = defn.all_ids()
        ids += [i for i in sp.ids() if i in known]
        ents += [e for e in defn.entities if e in sp.text()]
    text, paths = D.load(defn, blocks, ids, ents, mods, overview=a.overview)
    print(text)
    print("<!-- archivos cargados -->\n" + "\n".join(f"- {p}" for p in paths))
    return 0


# ---------- specification ----------

def spec_order(repo, id_, sp):
    """Where the requirement stands in the order: each dependency (merged, pending or cancelled) and the
    open requirements that depend on it, with the IDs they cite that this one changes or removes."""
    print(f"# Orden de #{id_}\n")
    deps = sp.depends()
    print("## Depende de\n")
    if not deps:
        print("- Nada.")
    worst = "OK"
    for d in deps:
        dsp, r = J.get_spec(repo, d)
        state = r.get("state", "?")
        if state == "cancelado":
            code = "CANCELLED"
        elif S.merged_in_integration(repo, d):
            code = "MERGED"
        else:
            code = "PENDING"
        if code == "CANCELLED" or (code == "PENDING" and worst == "OK"):
            worst = code
        print(f"- {code} #{d} {r.get('title', '')} — {state}")
    changed = {r["ID"] for r in sp.criteria()[0] if r.get("Cambio", "").strip().lower() in ("modifica", "elimina")}
    changed |= {d.get("ID", "").strip() for d in sp.decisions() if d.get("Tipo", "").strip().lower() == "revierte"}
    print("\n## Dependen de este\n")
    found = False
    for r in J.open_requirements(repo):
        if r.get("id") == int(id_):
            continue
        other = S.Spec(r["id"], {k: r.get(k) for k, _ in S.FIELDS})
        if int(id_) not in other.depends():
            continue
        found = True
        hit = sorted(changed & set(ids_in(other.text())))
        cites = f" — cita lo que este cambia o elimina: {', '.join(hit)}" if hit else ""
        print(f"- #{r['id']} {r.get('title', '')} — {r.get('state', '')}{cites}")
    if not found:
        print("- Ninguno abierto.")
    print(f"\norden: {worst}")
    return 0


def c_spec(a, repo):
    defn = D.Definition(repo)
    if a.op == "draft":
        p = S.draft_path(repo, a.id)
        if p.exists():
            print(f"retomo el borrador: {p}")
            return 0
        sp, r = J.get_spec(repo, a.id)
        sp.meta["jiku_hash"] = S.fields_digest(sp)  # what Jiku had: push refuses if it changed meanwhile
        if sp.is_empty():
            sp = S.Spec(a.id, dict(S.EMPTY), sp.meta)
            origin = "vacío"
        else:
            origin = "con lo que ya tiene el requisito en Jiku"
        p.write_text(S.render_draft(sp), encoding="utf-8")
        print(f"borrador nuevo ({origin}): {p}")
        return 0
    if a.op == "check":
        sp = get_spec(repo, a.id, a.source)
        reserved = {} if a.offline else J.reserved_ids(repo, defn, exclude=a.id)
        obs = S.check(sp, defn, reserved, implement=a.implement, repo=repo, implemented_ids=implemented_ids(defn, a.id))
        if a.implement and a.source == "jiku" and sp.meta.get("spec_status") != J.SPEC_READY:
            obs.insert(0, f"[S18] #{a.id}: la descripción no dice «Especificación: lista» "
                          f"({sp.meta.get('spec_status') or 'no tiene la línea'}): es un borrador, hay que especificarlo")
        return report(obs)
    if a.op == "push":
        sp = S.load_draft(repo, a.id)
        before = sp.meta.get("jiku_hash")
        if before and not a.offline:
            now, _ = J.get_spec(repo, a.id)
            if S.fields_digest(now) != before:
                changed = [t for k, t in S.FIELDS if (now.fields.get(k) or "").strip() != (sp.fields.get(k) or "").strip()]
                die(f"la especificación de #{a.id} cambió en Jiku desde que empezó este borrador (alguien la editó): "
                    f"no la piso. Campos que difieren del borrador: {', '.join(changed) or '—'}. Mirala con "
                    f"`grava.py spec show {a.id}`, llevá esos cambios al borrador y borrá su línea «jiku_hash» "
                    f"para escribirlo", 1)
        obs = S.check(sp, defn, {} if a.offline else J.reserved_ids(repo, defn, exclude=a.id),
                      implemented_ids=implemented_ids(defn, a.id))
        if obs:
            return report(obs)
        out = J.write_spec(repo, a.id, sp)
        if out is not None:
            J.set_spec_status(repo, a.id, J.SPEC_READY)
            if not J.Jiku(repo).dry:
                S.draft_path(repo, a.id).unlink()
            print(f"especificación de #{a.id} escrita en Jiku y marcada lista")
            return 0
        return 1
    if a.op == "show":
        sp = get_spec(repo, a.id, a.source)
        print(S.render_draft(sp))
        return 0
    if a.op == "order":
        return spec_order(repo, a.id, get_spec(repo, a.id, a.source))
    if a.op == "amend":
        return spec_amend(repo, defn, a)
    if a.op == "diff":
        from gravalib.diff import spec_diff
        sp = get_spec(repo, a.id, a.source)
        print(spec_diff(repo, defn, sp))
        return 0
    return 0


# ---------- git ----------

def c_git_check(a, repo):
    code, msg = W.git_check(repo, a.mode)
    print(f"git-check: {code} — {msg}")
    return 0 if code == "OK" else 1


def c_branch(a, repo):
    name, how = W.start_branch(repo, a.id, a.slug, a.kind)
    print(f"rama {name} ({how})")
    return 0


# ---------- tests and evidence ----------

def _criteria(repo, a):
    if a.ids:
        return [{"ID": x.strip(), "Criterio": ""} for x in a.ids.split(",") if x.strip()]
    sp = get_spec(repo, a.id, getattr(a, "source", "jiku"))
    return sp.criteria()[0]


def c_coverage(a, repo):
    defn = D.Definition(repo)
    if a.all:
        ids = E.built_ids(defn)
    else:
        ids = [c["ID"] for c in _criteria(repo, a) if c.get("Cambio", "").strip().lower() != "elimina"]
    cov = E.coverage_for(repo, ids)
    missing = [i for i, where in cov.items() if not where]
    for i, where in cov.items():
        print(f"{'ok ' if where else 'FALTA'} {i}: {', '.join(where[:3]) if where else 'ningún test lo nombra [' + i + ']'}")
    print(f"{len(ids) - len(missing)}/{len(ids)} IDs con test")
    return 1 if missing else 0


def c_evidence(a, repo):
    rows = _criteria(repo, a)
    ok, table, summary, failed, path = E.evidence(repo, a.id or 0, rows, write=not a.dry)
    print(summary)
    print(table)
    if not a.dry:
        print(f"\n<!-- guardado en {path} -->")
    if failed:
        print(f"\n{failed} tests fallan en los reportes (aunque no sean de un criterio).")
    return 0 if ok and not failed else 1


def c_mr_text(a, repo):
    sp = get_spec(repo, a.id, "jiku")
    branch = repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    p, text = W.mr_text(repo, sp, branch, repo.tmp / f"evidence-{int(a.id)}.md",
                        Path(a.verdict) if a.verdict else None)
    print(text)
    print(f"<!-- guardado en {p} -->")
    return 0


# ---------- release ----------

def _release_reqs(repo, ids):
    if not ids:
        return []
    reqs = []
    rows = {int(r["id"]): r for r in (J.list_requirements(repo) or [])}
    for i in ids:
        r = rows.get(i, {})
        reqs.append({"id": i, "title": r.get("title", "(no está en el proyecto de Jiku)"), "type": r.get("type")})
    return reqs


def c_release_info(a, repo):
    ids = W.pending_release_ids(repo)
    if not ids:
        print(f"No hay requisitos en {repo.integration_branch} que falten en {repo.production_branch}.")
        return 1
    reqs = _release_reqs(repo, ids)
    version, why = W.suggest_version(repo, reqs)
    print(f"Última versión: {W.last_tag(repo) or '(ninguna)'}")
    print(f"Versión sugerida: {version} — {why}\n")
    print(render_table(["Requisito", "Título", "Tipo"], [[f"#{r['id']}", r["title"], r.get("type") or "—"] for r in reqs]))
    issues = J.open_issues(J.list_requirements(repo))
    if issues:
        print("\nIncidencias abiertas (no entran en esta versión; ¿se libera igual?):\n")
        print(render_table(["Incidencia", "Título", "Estado", "Origen"],
                           [[f"#{r['id']}", r["title"], r.get("state"), f"#{J.origin_of(r)}" if J.origin_of(r) else "—"]
                            for r in issues]))
    return 0


def c_changelog(a, repo):
    ids = [int(x) for x in a.ids.split(",")] if a.ids else W.pending_release_ids(repo)
    known = J.open_issues(J.list_requirements(repo)) if a.known_issues else ()
    sec = W.changelog(repo, a.version, _release_reqs(repo, ids), write=not a.dry, known=known)
    print(sec or "No hay requisitos nuevos para el CHANGELOG.")
    return 0


# ---------- project ----------

def c_conformance(a, repo):
    from gravalib.conformance import check
    rows, failing = check(repo)
    print(render_table(["Regla de grava-workflow", "Estado", "Qué hay hoy"], rows))
    print(f"\n{failing} desvíos detectados mecánicamente (los que piden juicio los releva el agente).")
    return 0


def c_init_project(a, repo):
    created = W.init_project(repo, a.project_id, a.platform, a.instance, TEMPLATES, writes=not a.dry_run_jiku)
    print("\n".join(f"creado {c}" for c in created) or "nada que crear")
    return 0


def c_status(a, repo):
    print(f"Etapa: {W.stage(repo)}")
    rows = []
    if not a.offline:
        try:
            rows = J.list_requirements(repo) or []
        except SystemExit:
            print("(Jiku no respondió: muestro solo lo de git)")
    groups = W.status(repo, rows)
    for title, items in groups.items():
        if items:
            print(f"\n## {title}\n")
            print("\n".join(f"- {x}" for x in items))
    return 0


def c_out_of_scope(a, repo):
    if a.list:
        p = J.out_of_scope_path(repo, a.id)
        print(p.read_text(encoding="utf-8").rstrip() if p.exists() else "Nada registrado.")
        return 0
    desc = Path(a.file).read_text(encoding="utf-8") if a.file else a.description
    if not desc and not a.title:
        die("falta qué registrar: --title y --description (o --file)")
    print(J.out_of_scope(repo, a.id, a.skill, a.title, desc, a.type, a.to))
    return 0


def c_branches(a, repo):
    ok, lines = W.ensure_branches(repo, push=a.push)
    print("\n".join(lines))
    return 0 if ok else 1


def c_workdir(a, repo):
    print(repo.tmp)
    return 0


def c_jiku(a, repo):
    if a.op == "fetch":
        p, r = J.fetch(repo, a.id)
        print(f"{p} — #{r['id']} {r['title']} ({r.get('state')})")
    elif a.op == "state":
        J.set_state(repo, a.id, a.value)
    elif a.op == "comment":
        text = Path(a.file).read_text(encoding="utf-8") if a.file else a.value
        if not text:
            die("falta el texto: --file o un valor")
        J.comment(repo, a.id, text)
    elif a.op == "task":
        J.task(repo, a.id, a.title or a.value or "", a.description or "")
    elif a.op == "new":
        rid = J.new_requirement(repo, a.title, a.description or "", a.type or "funcionalidad", a.state or "analisis",
                                visibility=a.visibility)
        print(f"requisito #{rid}" if rid else "")
    elif a.op == "list":
        rows = J.list_requirements(repo, a.value)
        print(render_table(["ID", "Título", "Tipo", "Estado"],
                           [[r["id"], r["title"], r.get("type") or "—", r.get("state")] for r in rows or []]))
    return 0


# ---------- parser ----------

def main(argv=None):
    p = argparse.ArgumentParser(prog="grava.py", description=__doc__.split("\n\n")[0])
    p.add_argument("--root", help="raíz del repo (por defecto, se detecta)")
    sub = p.add_subparsers(dest="cmd", required=True)

    def cmd(name, fn, help_):
        s = sub.add_parser(name, help=help_)
        s.set_defaults(fn=fn)
        return s

    s = cmd("discovery-check", c_discovery_check, "chequeo mecánico del discovery")
    s.add_argument("--final", action="store_true")

    cmd("plan-blocks", c_plan_blocks, "bloques del discovery con sus entidades y a qué bloques citan")
    s = cmd("plan-build", c_plan_build, "un borrador de requisito por parte del plan (y el producto base)")
    s.add_argument("--plan", required=True, help='JSON: {"parts": [{"title": "…", "blocks": ["ACC"], "auth": true, '
                                                  '"entities": ["Cuenta de administrador"]}]}')
    s.add_argument("--force", action="store_true", help="regenerar aunque haya borradores editados a mano")
    cmd("plan-check", c_plan_check, "chequea los borradores del plan")
    s = cmd("plan-push", c_plan_push, "crea en Jiku los requisitos del plan, en orden")
    s.add_argument("--product", required=True, help="nombre del producto")
    s.add_argument("--preview", action="store_true", help="solo mostrar qué va a crear y qué ya existe en Jiku")

    s = cmd("def-base", c_def_base, "escribe la definición del producto base desde el discovery")
    s.add_argument("--plan", help="el plan.json de /product-define (para repartir decisiones y parámetros)")
    s.add_argument("--force", action="store_true")
    cmd("def-index", c_def_index, "regenera los índices de bloques, entidades y flujos")
    cmd("def-check", c_def_check, "chequeo de consistencia de la definición, los contratos y las guías")

    s = cmd("next-id", c_next_id, "siguientes IDs libres: CAN, CAN-E, INV, GAR, DEC, DEC-T, NFR, INT, CRED, U, {id}-AC")
    s.add_argument("kind")
    s.add_argument("--count", type=int, default=1)
    s.add_argument("--requirement", type=int, help="el requisito que se especifica (sus propios IDs no cuentan como reservados)")
    s.add_argument("--offline", action="store_true", help="sin consultar Jiku (no garantiza que el ID esté libre)")

    s = cmd("load", c_load, "arma el contexto de la definición para una tarea")
    s.add_argument("--block", action="append", default=[])
    s.add_argument("--id", action="append", default=[])
    s.add_argument("--entity", action="append", default=[])
    s.add_argument("--module", action="append", default=[])
    s.add_argument("--requirement", type=int)
    s.add_argument("--source", choices=("jiku", "draft"), default="jiku")
    s.add_argument("--overview", action="store_true")

    s = cmd("spec", c_spec, "especificación de un requisito: draft, check, push, show, diff, order, amend")
    s.add_argument("op", choices=("draft", "check", "push", "show", "diff", "order", "amend"))
    s.add_argument("--dry", action="store_true", help="amend: mostrar los criterios sin escribir en Jiku")
    s.add_argument("id", type=int)
    s.add_argument("--source", choices=("jiku", "draft"), default="jiku")
    s.add_argument("--implement", action="store_true", help="además: dependencias mergeadas, decisiones vigentes")
    s.add_argument("--offline", action="store_true", help="sin consultar los IDs reservados en Jiku")

    s = cmd("git-check", c_git_check, "dónde está parada la copia antes de empezar")
    s.add_argument("--mode", choices=("implement", "base", "read"), required=True)
    s = cmd("branch", c_branch, "crea o retoma la rama de un requisito (feat/ o fix/), con sufijo si se reabrió")
    s.add_argument("id", type=int)
    s.add_argument("slug")
    s.add_argument("--kind", choices=("feat", "fix"), default="feat")

    s = cmd("coverage", c_coverage, "qué IDs tienen un test que los nombra")
    s.add_argument("id", nargs="?", type=int)
    s.add_argument("--all", action="store_true", help="todos los IDs de la definición")
    s.add_argument("--ids", help="lista de IDs separados por coma")
    s = cmd("evidence", c_evidence, "criterio → test → resultado desde reports/junit/")
    s.add_argument("id", nargs="?", type=int)
    s.add_argument("--ids", help="sin especificación: lista de IDs separados por coma")
    s.add_argument("--dry", action="store_true", help="no guardar el archivo de evidencia")
    s = cmd("mr-text", c_mr_text, "descripción del MR/PR de un requisito")
    s.add_argument("id", type=int)
    s.add_argument("--verdict", help="archivo con el veredicto del verificador")

    cmd("release-info", c_release_info, "requisitos para liberar y versión sugerida")
    s = cmd("changelog", c_changelog, "agrega al CHANGELOG la sección de una versión")
    s.add_argument("version")
    s.add_argument("--ids", help="requisitos, separados por coma (por defecto, los de dev que faltan en main)")
    s.add_argument("--known-issues", action="store_true", help="suma «Problemas conocidos» con las incidencias abiertas")
    s.add_argument("--dry", action="store_true")

    cmd("conformance", c_conformance, "desvíos mecánicos del repo contra los defaults de grava-workflow")
    s = cmd("init-project", c_init_project, "crea _gflow/project.yaml, las guías y el .gitignore")
    s.add_argument("--project-id", type=int, required=True)
    s.add_argument("--platform", choices=("gitlab", "github"), default="gitlab",
                   help="se ajusta después con la decisión de CI del análisis técnico")
    s.add_argument("--instance", choices=("dev", "prod"), default="prod")
    s.add_argument("--dry-run-jiku", action="store_true", help="writes: false en project.yaml")
    s = cmd("status", c_status, "etapa del producto y requisitos agrupados por siguiente acción")
    s.add_argument("--offline", action="store_true")

    cmd("workdir", c_workdir, "carpeta de trabajo del repo (temporal del sistema): borradores, MR, comentarios")

    s = cmd("jiku", c_jiku, "Jiku: fetch, state, comment, task, new, list")
    s.add_argument("op", choices=("fetch", "state", "comment", "task", "new", "list"))
    s.add_argument("id", nargs="?")
    s.add_argument("value", nargs="?")
    s.add_argument("--file")
    s.add_argument("--title")
    s.add_argument("--description")
    s.add_argument("--type")
    s.add_argument("--state")
    s.add_argument("--visibility", choices=("internal", "public"), default="internal")

    s = cmd("branches", c_branches, "asegura main y dev y deja la copia en dev (con --push: todo commiteado y pusheado)")
    s.add_argument("--push", action="store_true")

    s = cmd("out-of-scope", c_out_of_scope, "registrar en Jiku algo visto fuera del alcance de un requisito")
    s.add_argument("id")
    s.add_argument("--skill", default="req-implement")
    s.add_argument("--title")
    s.add_argument("--description", default="")
    s.add_argument("--file", help="la descripción, desde un archivo")
    s.add_argument("--type", choices=J.TYPES, default="incidencia")
    s.add_argument("--to", type=int, help="comentar en el requisito que ya lo cubre, en vez de crear uno")
    s.add_argument("--list", action="store_true", help="mostrar lo registrado para este requisito")

    a = p.parse_args(argv)
    repo = Repo(a.root)
    return a.fn(a, repo) or 0


if __name__ == "__main__":
    sys.exit(main())
