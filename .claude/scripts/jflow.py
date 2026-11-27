#!/usr/bin/env python3
"""jflow — the deterministic half of the workflow. Agents decide; this script does the repeatable
work: reading the discovery, building the plan and the base definition, indexing, checking,
allocating IDs, loading context, reading and writing specifications in Jiku, branches, evidence,
MR text, release and status. Standard library only.

    python3 .claude/scripts/jflow.py <command> [options]      (help: jflow.py -h, jflow.py <command> -h)
"""

import argparse
import json
import runpy
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True

from jflowlib import definition as D  # noqa: E402
from jflowlib import evidence as E  # noqa: E402
from jflowlib import jiku as J  # noqa: E402
from jflowlib import spec as S  # noqa: E402
from jflowlib import workflow as W  # noqa: E402
from jflowlib.lang import say, structure, template  # noqa: E402
from jflowlib.md import TEST_TAG_RE, ids_in, render_table  # noqa: E402
from jflowlib.repo import Repo, die  # noqa: E402

TEMPLATES = HERE.parent / "templates"


def report(obs, ok_msg="No observations"):
    for o in obs:
        print(o)
    print(f"{len(obs)} observations" if obs else ok_msg)
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
    from jflowlib.diff import definition_text, integration_definition
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
        rows.append({"Change": "modify" if cid in before else "add", "ID": cid, "Criterion": cur[0]})
    if missing:
        die(f"no row with Origin #{a.id} in the definition: {', '.join(missing)} — add it before `spec amend`")
    if not rows:
        print("Nothing to add: the specification already has what was decided.")
        return 0
    new = S.amend(sp, rows, repo.language)
    own = implemented_ids(defn, a.id)
    old = set(S.check(sp, defn, {}, implemented_ids=own))
    obs = [o for o in S.check(new, defn, {}, implemented_ids=own) if o not in old]  # only what the rows add
    if obs:
        return report(obs)
    if a.dry:
        print(new.criteria_text)
        return 0
    J.write_spec(repo, a.id, new)
    print(f"specification of #{a.id}: {len(rows)} criteria decided in the implementation ({', '.join(r['ID'] for r in rows)})")
    return 0


def implemented_ids(defn, id_):
    """IDs that already carry Origin #id in the definition (a reopened requirement)."""
    out = set()
    tag = f"#{int(id_)}"
    for p in defn.blocks:
        req, fail = defn.block_rows(p)
        out |= {r["ID"] for r in req + fail if r.get("Origin", "").strip() == tag}
    for rows in (defn.invariants(), defn.guarantees(), defn.decisions(), defn.credentials(), defn.integrations()):
        out |= {r["ID"] for r in rows if r.get("ID") and r.get("Origin", "").strip() == tag}
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
    from jflowlib.transcribe import build_model
    return build_model(repo)


def c_plan_blocks(a, repo):
    from jflowlib.plan import block_info
    _, meta = _model(repo)
    rows = [[p, i["name"], ", ".join(i["entities"]) or "—", ", ".join(i["cites"]) or "—",
             ", ".join(i["surfaces"]) or "—"] for p, i in sorted(block_info(meta).items())]
    print(render_table(["Block", "Name", "Entities", "Cites blocks", "Surfaces"], rows))
    print("\nA block that cites another (or uses an entity another one creates) goes in the same part or later.\n"
          "Entities are detected by their name in the text: if one does not belong, set in the plan which part creates it.")
    return 0


def c_plan_build(a, repo):
    from jflowlib.plan import build
    files, meta = _model(repo)
    plan = json.loads(Path(a.plan).read_text(encoding="utf-8"))
    template_text = (HERE.parent.parent / template("base-requirement.md", repo.language)).read_text(encoding="utf-8")
    paths, deps, warnings = build(repo, files, meta, plan, template_text, force=a.force)
    for p in paths:
        n = int(p.stem.split("-")[1])
        dep = ", ".join("base" if d == 0 else f"part {d}" for d in deps.get(n, [])) or "—"
        print(f"{p}  (depends on: {dep})" if n else f"{p}  (base product)")
    for w in warnings:
        print(f"warning: {w}")
    print("Resolve the {{fill: …}} placeholders of each draft and run `jflow.py plan-check`.")
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
        obs += [f"part {n}: {o}" for o in S.check(sp, defn, earlier=earlier) if not o.startswith("[S19]")]
        earlier |= sp.introduced_ids()
    return obs


def c_plan_check(a, repo):
    from jflowlib.plan import load_parts, order_check
    defn = D.Definition(repo)
    obs = []
    parts = load_parts(repo)
    obs += plan_spec_obs(parts, defn, repo)
    obs += order_check(parts)
    return report(obs)


def c_plan_push(a, repo):
    from jflowlib.plan import load_parts, plan_dir
    created_p = plan_dir(repo) / "created.json"
    created = {int(k): v for k, v in json.loads(created_p.read_text()).items()} if created_p.exists() else {}
    parts = load_parts(repo)
    plan = json.loads((plan_dir(repo) / "plan.json").read_text(encoding="utf-8"))
    name = a.product
    defn = D.Definition(repo)
    from jflowlib.plan import order_check
    bad = plan_spec_obs(parts, defn, repo) + order_check(parts)
    if bad:
        return report(bad)

    lang = repo.language

    def title_of(n):
        return f"0 · {say('Base product', lang)}" if n == 0 else f"{n} · {plan['parts'][n - 1]['title']}"

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
            rows.append([t, f"already created (#{created[n]})"])
        elif t in existing:
            created[n] = existing[t]
            rows.append([t, f"already in Jiku (#{existing[t]}): left as it is"])
        else:
            rows.append([t, "create"])
    if a.preview:
        j = J.Jiku(repo)
        print(f"Plan for Jiku (project {j.project_id}, {j.instance}):\n")
        print(render_table(["Requirement", "Action"], rows))
        todo = sum(1 for r in rows if r[1] == "create")
        print(f"\n{todo} to create." if todo else "\nNothing to create: the plan is already in Jiku.")
        return 0
    created_p.write_text(json.dumps(created), encoding="utf-8")
    for n, p, sp in parts:
        if n in created:
            print(f"part {n}: already there (#{created[n]})")
            continue
        fields = dict(sp.fields)
        for k in fields:
            for m, rid in created.items():
                fields[k] = fields[k].replace(f"#P{m} ", f"#{rid} ").replace(f"#P{m}\n", f"#{rid}\n")
        es = structure(lang) == "es"
        if n == 0:
            title = title_of(0)
            desc = (f"Producto base de {name}: la estructura sobre la que se construyen las partes del plan. "
                    f"Va primero: las partes se implementan en el orden de su número." if es else
                    f"Base product of {name}: the structure the parts of the plan are built on. "
                    f"It goes first: the parts are implemented in the order of their number.")
        else:
            part = plan["parts"][n - 1]
            title = title_of(n)
            desc = (f"Parte {n} del plan inicial de {name}. Bloques: {', '.join(part['blocks'])}. "
                    f"Se implementa después de las partes de número menor de las que depende." if es else
                    f"Part {n} of the initial plan of {name}. Blocks: {', '.join(part['blocks'])}. "
                    f"It is implemented after the lower-numbered parts it depends on.")
        rid = J.new_requirement(repo, title, J.with_spec_line(desc, J.SPEC_DRAFT, lang), "funcionalidad",
                                "planificacion", fields, "public")
        if rid is None:
            if J.Jiku(repo).dry:
                rid = -(n + 1)
            else:
                print(f"part {n}: could not be created; fix it and run plan-push again (the created ones are skipped)")
                return 1
        if n == 0 and rid > 0:
            crit = fields["acceptanceCriteria"].replace("| 0-AC-", f"| {rid}-AC-")
            J.Jiku(repo).command(f"requirements.{rid}.edit", {"acceptanceCriteria": crit})
        created[n] = rid
        created_p.write_text(json.dumps(created), encoding="utf-8")
        print(f"part {n}: #{rid} {title}")
    return 0


def c_def_base(a, repo):
    from jflowlib.plan import write_base_definition
    if repo.prd.exists() and any(repo.prd.iterdir()) and not a.force:
        die("_jflow/prd/ already exists. Use --force to regenerate it")
    files, meta = _model(repo)
    plan = json.loads(Path(a.plan).read_text(encoding="utf-8")) if a.plan else None
    written = write_base_definition(repo, files, meta, plan)
    D.generate_indexes(D.Definition(repo))
    content, _ = D.scaffold_testing(D.Definition(repo))
    (repo.arch / "testing.md").write_text(content, encoding="utf-8")
    written.append("prd/architecture/testing.md")
    print(f"Base product definition: {len(written)} files in _jflow/.")
    pending = []
    for rel in written:
        n = (repo.jflow / rel).read_text(encoding="utf-8").count("{{fill")
        if n:
            pending.append(f"  _jflow/{rel}: {n}")
    if pending:
        print("{{fill: …}} placeholders to resolve (agent's judgment):\n" + "\n".join(pending))
    return 0


# ---------- definition ----------

def c_def_index(a, repo):
    for p in D.generate_indexes(D.Definition(repo)):
        print(f"generated {repo.rel(p)}")
    return 0


def c_def_check(a, repo):
    return report(D.check(D.Definition(repo)))


def c_def_testing(a, repo):
    defn = D.Definition(repo)
    if not defn.exists:
        die("_jflow/prd/ does not exist")
    content, added = D.scaffold_testing(defn, a.origin)
    p = repo.arch / "testing.md"
    new = not p.exists()
    if new or added:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
    print(("created" if new else "updated" if added else "unchanged") + f" {repo.rel(p)}")
    for x in added:
        print(f"- to fill: {x}")
    n = p.read_text(encoding="utf-8").count("{{fill")
    if n:
        print(f"{n} {{{{fill}}}} placeholders to resolve")
    return 0


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
        die("_jflow/prd/ does not exist")
    blocks, ids, ents, mods = list(a.block), list(a.id), list(a.entity), list(a.module)
    if a.requirement:
        sp = get_spec(repo, a.requirement, a.source)
        known = defn.all_ids()
        ids += [i for i in sp.ids() if i in known]
        ents += [e for e in defn.entities if e in sp.text()]
    text, paths = D.load(defn, blocks, ids, ents, mods, overview=a.overview)
    print(text)
    print("<!-- files loaded -->\n" + "\n".join(f"- {p}" for p in paths))
    return 0


# ---------- specification ----------

def spec_order(repo, id_, sp):
    """Where the requirement stands in the order: each dependency (merged, pending or cancelled) and the
    open requirements that depend on it, with the IDs they cite that this one changes or removes."""
    print(f"# Order of #{id_}\n")
    deps = sp.depends()
    print("## Depends on\n")
    if not deps:
        print("- Nothing.")
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
    from jflowlib.lang import value
    changed = {r["ID"] for r in sp.criteria()[0] if value(r.get("Change")) in ("modify", "remove")}
    changed |= {d.get("ID", "").strip() for d in sp.decisions() if value(d.get("Type")) == "reverts"}
    print("\n## Depended on by\n")
    found = False
    for r in J.open_requirements(repo):
        if r.get("id") == int(id_):
            continue
        other = S.Spec(r["id"], {k: r.get(k) for k, _ in S.FIELDS})
        if int(id_) not in other.depends():
            continue
        found = True
        hit = sorted(changed & set(ids_in(other.text())))
        cites = f" — cites what this one changes or removes: {', '.join(hit)}" if hit else ""
        print(f"- #{r['id']} {r.get('title', '')} — {r.get('state', '')}{cites}")
    if not found:
        print("- None open.")
    print(f"\norder: {worst}")
    return 0


def c_spec(a, repo):
    defn = D.Definition(repo)
    if a.op == "draft":
        p = S.draft_path(repo, a.id)
        if p.exists():
            print(f"resuming the draft: {p}")
            return 0
        sp, r = J.get_spec(repo, a.id)
        sp.meta["jiku_hash"] = S.fields_digest(sp)  # what Jiku had: push refuses if it changed meanwhile
        if sp.is_empty():
            sp = S.Spec(a.id, S.empty(repo.language), sp.meta)
            origin = "empty"
        else:
            origin = "with what the requirement already has in Jiku"
        p.write_text(S.render_draft(sp, repo.language), encoding="utf-8")
        print(f"new draft ({origin}): {p}")
        return 0
    if a.op == "check":
        sp = get_spec(repo, a.id, a.source)
        reserved = {} if a.offline else J.reserved_ids(repo, defn, exclude=a.id)
        obs = S.check(sp, defn, reserved, implement=a.implement, repo=repo, implemented_ids=implemented_ids(defn, a.id))
        if a.implement and a.source == "jiku" and sp.meta.get("spec_status") != J.SPEC_READY:
            obs.insert(0, f"[S18] #{a.id}: the description does not say the specification is ready "
                          f"({sp.meta.get('spec_status') or 'it has no specification line'}): it is a draft, specify it first")
        return report(obs)
    if a.op == "push":
        sp = S.load_draft(repo, a.id)
        before = sp.meta.get("jiku_hash")
        if before and not a.offline:
            now, _ = J.get_spec(repo, a.id)
            if S.fields_digest(now) != before:
                changed = [t for k, t in S.FIELDS if (now.fields.get(k) or "").strip() != (sp.fields.get(k) or "").strip()]
                die(f"the specification of #{a.id} changed in Jiku since this draft started (someone edited it): "
                    f"not overwriting it. Fields that differ from the draft: {', '.join(changed) or '—'}. See it with "
                    f"`jflow.py spec show {a.id}`, bring those changes into the draft and delete its «jiku_hash» line "
                    f"to write it", 1)
        obs = S.check(sp, defn, {} if a.offline else J.reserved_ids(repo, defn, exclude=a.id),
                      implemented_ids=implemented_ids(defn, a.id))
        if obs:
            return report(obs)
        out = J.write_spec(repo, a.id, sp)
        if out is not None:
            J.set_spec_status(repo, a.id, J.SPEC_READY)
            if not J.Jiku(repo).dry:
                S.draft_path(repo, a.id).unlink()
            print(f"specification of #{a.id} written to Jiku and marked ready")
            return 0
        return 1
    if a.op == "show":
        sp = get_spec(repo, a.id, a.source)
        print(S.render_draft(sp, repo.language))
        return 0
    if a.op == "order":
        return spec_order(repo, a.id, get_spec(repo, a.id, a.source))
    if a.op == "amend":
        return spec_amend(repo, defn, a)
    if a.op == "diff":
        from jflowlib.diff import spec_diff
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
    print(f"branch {name} ({how})")
    return 0


# ---------- tests and evidence ----------

def _criteria(repo, a):
    if a.ids:
        return [{"ID": x.strip(), "Criterion": ""} for x in a.ids.split(",") if x.strip()]
    sp = get_spec(repo, a.id, getattr(a, "source", "jiku"))
    return sp.criteria()[0]


def c_coverage(a, repo):
    defn = D.Definition(repo)
    if a.all:
        ids = E.built_ids(defn)
    else:
        from jflowlib.lang import value
        ids = [c["ID"] for c in _criteria(repo, a) if value(c.get("Change")) != "remove"]
    cov = E.coverage_for(repo, ids)
    missing = [i for i, where in cov.items() if not where]
    for i, where in cov.items():
        print(f"{'ok     ' if where else 'MISSING'} {i}: {', '.join(where[:3]) if where else 'no test names it [' + i + ']'}")
    print(f"{len(ids) - len(missing)}/{len(ids)} IDs with a test")
    return 1 if missing else 0


def c_evidence(a, repo):
    rows = _criteria(repo, a)
    ok, table, summary, failed, path = E.evidence(repo, a.id or 0, rows, write=not a.dry)
    print(summary)
    print(table)
    if not a.dry:
        print(f"\n<!-- saved in {path} -->")
    if failed:
        print(f"\n{failed} tests fail in the reports (even if they are not a criterion's).")
    return 0 if ok and not failed else 1


def c_visual_pairs(a, repo):
    from jflowlib import visual as V
    try:
        sp = get_spec(repo, a.id, a.source)
    except SystemExit:
        sp = J.spec_from_copy(repo, a.id) if a.source == "jiku" else None
        if sp is None:
            raise
        print(f"Jiku did not answer: using the last copy from `jiku fetch` ({sp.meta['source']}), "
              f"which may be out of date.\n")
    _, screens, decided = V.parse(sp)
    if not screens:
        print(f"#{a.id} has no «Visual reference» in its technical detail: nothing to compare.")
        return 0
    rows = V.pairs(repo, sp)
    for screen, ref, cap, pair, zones, problem in rows:
        if problem:
            print(f"MISSING {screen}: {problem}")
        else:
            z = f" + {zones} zones ({pair.stem}-z1..{zones}.png)" if zones > 1 else ""
            print(f"ok      {screen}: {pair.relative_to(repo.root)}{z}  (reference {ref.name}, screenshot {cap.name})")
    bad = sum(1 for r in rows if r[5])
    print(f"{len(rows) - bad}/{len(rows)} pairs")
    print("\nDecided differences (the only thing that may look different):")
    for d in decided:
        print(f"- {d.get('Decided difference', '')} — {d.get('Screens', '')} ({d.get('Decision', '')})")
    if not decided:
        print("- none")
    return 1 if bad else 0


def c_mr_text(a, repo):
    sp = get_spec(repo, a.id, "jiku")
    branch = repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    p, text = W.mr_text(repo, sp, branch, repo.tmp / f"evidence-{int(a.id)}.md",
                        Path(a.verdict) if a.verdict else None)
    print(text)
    print(f"<!-- saved in {p} -->")
    return 0


# ---------- release ----------

def _release_reqs(repo, ids):
    if not ids:
        return []
    reqs = []
    rows = {int(r["id"]): r for r in (J.list_requirements(repo) or [])}
    for i in ids:
        r = rows.get(i, {})
        reqs.append({"id": i, "title": r.get("title", "(not in the Jiku project)"), "type": r.get("type")})
    return reqs


def c_release_info(a, repo):
    ids = W.pending_release_ids(repo)
    if not ids:
        print(f"No requirements in {repo.integration_branch} that {repo.production_branch} lacks.")
        return 1
    reqs = _release_reqs(repo, ids)
    version, why = W.suggest_version(repo, reqs)
    print(f"Last version: {W.last_tag(repo) or '(none)'}")
    print(f"Suggested version: {version} — {why}\n")
    print(render_table(["Requirement", "Title", "Type"], [[f"#{r['id']}", r["title"], r.get("type") or "—"] for r in reqs]))
    issues = J.open_issues(J.list_requirements(repo))
    if issues:
        print("\nOpen issues (not in this version; release anyway?):\n")
        print(render_table(["Issue", "Title", "State", "Origin"],
                           [[f"#{r['id']}", r["title"], r.get("state"), f"#{J.origin_of(r)}" if J.origin_of(r) else "—"]
                            for r in issues]))
    return 0


def c_changelog(a, repo):
    ids = [int(x) for x in a.ids.split(",")] if a.ids else W.pending_release_ids(repo)
    known = J.open_issues(J.list_requirements(repo)) if a.known_issues else ()
    sec = W.changelog(repo, a.version, _release_reqs(repo, ids), write=not a.dry, known=known)
    print(sec or "No new requirements for the CHANGELOG.")
    return 0


# ---------- project ----------

def c_conformance(a, repo):
    from jflowlib.conformance import check
    rows, failing = check(repo)
    print(render_table(["jiku flow rule", "Level", "State", "What is there today"], rows))
    minimum = sum(1 for r in rows if r[1] == "minimum" and r[2] == "❌")
    print(f"\n{failing} deviations detected mechanically, {minimum} of the minimum to adopt "
          "(the agent surveys the ones that need judgment).")
    return 0


def c_init_project(a, repo):
    created = W.init_project(repo, a.project_id, a.platform, a.instance, TEMPLATES, writes=not a.dry_run_jiku,
                             language=a.language)
    print("\n".join(f"created {c}" for c in created) or "nothing to create")
    return 0


def c_status(a, repo):
    print(f"Stage: {W.stage(repo)}")
    rows = []
    if not a.offline:
        try:
            rows = J.list_requirements(repo) or []
        except SystemExit:
            print("(Jiku did not answer: showing only what git has)")
    groups = W.status(repo, rows)
    for title, items in groups.items():
        if items:
            print(f"\n## {title}\n")
            print("\n".join(f"- {x}" for x in items))
    return 0


def c_out_of_scope(a, repo):
    if a.list:
        p = J.out_of_scope_path(repo, a.id)
        print(p.read_text(encoding="utf-8").rstrip() if p.exists() else "Nothing recorded.")
        return 0
    desc = Path(a.file).read_text(encoding="utf-8") if a.file else a.description
    if not desc and not a.title:
        die("nothing to record: --title and --description (or --file)")
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
            die("the text is missing: --file or a value")
        J.comment(repo, a.id, text)
    elif a.op == "task":
        J.task(repo, a.id, a.title or a.value or "", a.description or "")
    elif a.op == "new":
        rid = J.new_requirement(repo, a.title, a.description or "", a.type or "funcionalidad", a.state or "analisis",
                                visibility=a.visibility)
        print(f"requirement #{rid}" if rid else "")
    elif a.op == "list":
        rows = J.list_requirements(repo, a.value or a.id)  # `jiku list {states}`: the states land in `id`
        print(render_table(["ID", "Title", "Type", "State"],
                           [[r["id"], r["title"], r.get("type") or "—", r.get("state")] for r in rows or []]))
    return 0


def c_install(a, repo):
    """Install or update jiku flow from the copy this jflow.py belongs to into --root's .claude/."""
    from jflowlib import install as I
    src, dst = HERE.parent, repo.root / ".claude"
    if src.resolve() == dst.resolve():
        die("run the jflow.py of the downloaded copy, not the installed one (see framework-update.sh)")
    pl, notes = I.run(src, dst, keep=a.keep, dry=a.dry)
    for key, label in (("new", "NEW"), ("update", "UPDATE"), ("modified", "MODIFIED"), ("clash", "CLASH"),
                       ("remove", "REMOVE"), ("keep_removed", "KEEP_REMOVED")):
        print(f"{label}: {len(pl[key])}")
        for rel in pl[key] if key not in ("new", "update") or a.verbose else []:
            print(f"  {rel}")
    print(f"UNCHANGED: {len(pl['same'])}")
    for n in notes:
        print(n)
    if not a.dry:
        print("settings.json and CLAUDE.md merged; manifest written to .claude/.jflow-manifest")
    return 0


def c_lang_terms(a, repo):
    from jflowlib.lang import TERMS
    rows = [[en, es] for en, es in TERMS.items() if en != es and not a.grep or a.grep and
            (a.grep.lower() in en.lower() or a.grep.lower() in es.lower())]
    print(render_table(["English", "Español"], rows))
    print(f"\nProduct language: {repo.language} (structure in {structure(repo.language)})")
    return 0


# ---------- parser ----------

def main(argv=None):
    p = argparse.ArgumentParser(prog="jflow.py", description=__doc__.split("\n\n")[0])
    p.add_argument("--root", help="repo root (detected by default)")
    sub = p.add_subparsers(dest="cmd", required=True)

    def cmd(name, fn, help_):
        s = sub.add_parser(name, help=help_)
        s.set_defaults(fn=fn)
        return s

    s = cmd("discovery-check", c_discovery_check, "mechanical check of the discovery")
    s.add_argument("--final", action="store_true")

    cmd("plan-blocks", c_plan_blocks, "blocks of the discovery with their entities and the blocks they cite")
    s = cmd("plan-build", c_plan_build, "a requirement draft per part of the plan (and the base product)")
    s.add_argument("--plan", required=True, help='JSON: {"parts": [{"title": "…", "blocks": ["ACC"], "auth": true, '
                                                  '"entities": ["Administrator account"]}]}')
    s.add_argument("--force", action="store_true", help="regenerate even if drafts were edited by hand")
    cmd("plan-check", c_plan_check, "checks the plan's drafts")
    s = cmd("plan-push", c_plan_push, "creates the plan's requirements in Jiku, in order")
    s.add_argument("--product", required=True, help="product name")
    s.add_argument("--preview", action="store_true", help="only show what it would create and what already exists in Jiku")

    s = cmd("def-base", c_def_base, "writes the base product definition from the discovery")
    s.add_argument("--plan", help="the plan.json of /jflow-product-discover (to distribute decisions and parameters)")
    s.add_argument("--force", action="store_true")
    cmd("def-index", c_def_index, "regenerates the indexes of blocks, entities and flows")
    cmd("def-check", c_def_check, "consistency check of the definition, the contracts and the guides")
    s = cmd("def-testing", c_def_testing, "creates or completes prd/architecture/testing.md: a row per entry point, role "
            "and external integration that does not say yet how it is tested")
    s.add_argument("--origin", default="initial", help="Origin of the new rows: initial or #id")

    s = cmd("next-id", c_next_id, "next free IDs: CAN, CAN-E, INV, GAR, DEC, DEC-T, NFR, INT, CRED, U, {id}-AC")
    s.add_argument("kind")
    s.add_argument("--count", type=int, default=1)
    s.add_argument("--requirement", type=int, help="the requirement being specified (its own IDs do not count as reserved)")
    s.add_argument("--offline", action="store_true", help="without asking Jiku (does not guarantee the ID is free)")

    s = cmd("load", c_load, "assembles the definition context for a task")
    s.add_argument("--block", action="append", default=[])
    s.add_argument("--id", action="append", default=[])
    s.add_argument("--entity", action="append", default=[])
    s.add_argument("--module", action="append", default=[])
    s.add_argument("--requirement", type=int)
    s.add_argument("--source", choices=("jiku", "draft"), default="jiku")
    s.add_argument("--overview", action="store_true")

    s = cmd("spec", c_spec, "specification of a requirement: draft, check, push, show, diff, order, amend")
    s.add_argument("op", choices=("draft", "check", "push", "show", "diff", "order", "amend"))
    s.add_argument("--dry", action="store_true", help="amend: show the criteria without writing to Jiku")
    s.add_argument("id", type=int)
    s.add_argument("--source", choices=("jiku", "draft"), default="jiku")
    s.add_argument("--implement", action="store_true", help="also: dependencies merged, decisions in force")
    s.add_argument("--offline", action="store_true", help="without asking Jiku for the reserved IDs")

    s = cmd("git-check", c_git_check, "where the working copy stands before starting")
    s.add_argument("--mode", choices=("implement", "base", "read"), required=True)
    s = cmd("branch", c_branch, "creates or resumes the branch of a requirement (feat/ or fix/), with a suffix if it was reopened")
    s.add_argument("id", type=int)
    s.add_argument("slug")
    s.add_argument("--kind", choices=("feat", "fix"), default="feat")

    s = cmd("coverage", c_coverage, "which IDs have a test that names them")
    s.add_argument("id", nargs="?", type=int)
    s.add_argument("--all", action="store_true", help="every ID of the definition")
    s.add_argument("--ids", help="comma-separated list of IDs")
    s = cmd("evidence", c_evidence, "criterion → test → result from reports/junit/")
    s.add_argument("id", nargs="?", type=int)
    s.add_argument("--ids", help="without a specification: comma-separated list of IDs")
    s.add_argument("--dry", action="store_true", help="do not save the evidence file")
    s = cmd("visual-pairs", c_visual_pairs, "each screen of the visual reference next to its screenshot")
    s.add_argument("id", type=int)
    s.add_argument("--source", choices=("jiku", "draft"), default="jiku")
    s = cmd("mr-text", c_mr_text, "MR/PR description of a requirement")
    s.add_argument("id", type=int)
    s.add_argument("--verdict", help="file with the verifier's verdict")

    cmd("release-info", c_release_info, "requirements to release and suggested version")
    s = cmd("changelog", c_changelog, "adds a version's section to the CHANGELOG")
    s.add_argument("version")
    s.add_argument("--ids", help="requirements, comma-separated (by default, those in dev that main lacks)")
    s.add_argument("--known-issues", action="store_true", help="adds «Known issues» with the open incidencias")
    s.add_argument("--dry", action="store_true")

    cmd("conformance", c_conformance, "mechanical deviations of the repo from the adoption minimum and the jiku flow defaults")
    s = cmd("init-project", c_init_project, "creates _jflow/project.yaml, the guides and the .gitignore")
    s.add_argument("--project-id", type=int, required=True)
    s.add_argument("--platform", choices=("gitlab", "github"), default="gitlab",
                   help="adjusted later with the CI decision of the technical analysis")
    s.add_argument("--instance", choices=("dev", "prod"), default="prod")
    s.add_argument("--dry-run-jiku", action="store_true", help="writes: false in project.yaml")
    s.add_argument("--language", default=None,
                   help="language of what people read (Jiku, discovery, product docs): es (default), en, …")
    s = cmd("status", c_status, "stage of the product and requirements grouped by next action")
    s.add_argument("--offline", action="store_true")

    s = cmd("install", c_install, "install or update jiku flow into --root (run from the downloaded copy)")
    s.add_argument("--keep", nargs="*", default=[], help="modified files to keep as they are (new version saved as .new)")
    s.add_argument("--dry", action="store_true", help="only show what would change")
    s.add_argument("--verbose", action="store_true", help="also list new and updated files")

    s = cmd("lang-terms", c_lang_terms, "the structural names of the documents people read, in English and Spanish")
    s.add_argument("--grep", help="only the names that contain this text")

    cmd("workdir", c_workdir, "working folder of the repo (system temp): drafts, MR, comments")

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

    s = cmd("branches", c_branches, "ensures main and dev and leaves the copy on dev (with --push: everything committed and pushed)")
    s.add_argument("--push", action="store_true")

    s = cmd("out-of-scope", c_out_of_scope, "record in Jiku something seen outside a requirement's scope")
    s.add_argument("id")
    s.add_argument("--skill", default="jflow-build")
    s.add_argument("--title")
    s.add_argument("--description", default="")
    s.add_argument("--file", help="the description, from a file")
    s.add_argument("--type", choices=J.TYPES, default="incidencia")
    s.add_argument("--to", type=int, help="comment on the requirement that already covers it, instead of creating one")
    s.add_argument("--list", action="store_true", help="show what was recorded for this requirement")

    a = p.parse_args(argv)
    repo = Repo(a.root)
    return a.fn(a, repo) or 0


if __name__ == "__main__":
    sys.exit(main())
