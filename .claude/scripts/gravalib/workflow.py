"""Git checks and branches, MR/PR text, release, project setup and status."""

import datetime
import re
import subprocess
import shutil

from .md import render_table, slugify
from .repo import die

GITIGNORE_LINES = ["reports/", ".env", "__pycache__/"]
# What /product-define leaves on dev before the bootstrap: anything else means dev is not empty.
BASE_ALLOWED = ("_gflow/", ".claude/", ".gitignore", "AGENTS.md", "CLAUDE.md", "README.md", "docs/",
                ".mcp.json")


# ---------- git ----------

def _remote_ref(repo, branch):
    remotes = repo.git("remote", check=False).split()
    if not remotes:
        return None
    remote = "origin" if "origin" in remotes else remotes[0]
    repo.git("fetch", "--quiet", remote, check=False)
    ref = f"{remote}/{branch}"
    return ref if repo.git("rev-parse", "--verify", "--quiet", ref, check=False) else None


def git_check(repo, mode):
    """Where the working copy stands before a skill starts. Returns (code, message):

    implement (req-implement, change, adopt): OK, BEHIND, DIRTY, OTHER_BRANCH, NO_REMOTE, NO_DEV
    base (product-bootstrap):                 OK, BEHIND, DIRTY, OTHER_BRANCH, NO_REMOTE, NO_DEV, DEV_HAS_MORE
    read (req-specify, status):               OK, BEHIND, NO_REMOTE, OTHER_BRANCH, NO_DEV
    """
    dev = repo.integration_branch
    current = repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    has_dev = bool(repo.git("rev-parse", "--verify", "--quiet", dev, check=False))
    if not has_dev:
        return "NO_DEV", f"no existe la rama {dev}"
    if mode != "read" and repo.git("status", "--porcelain", "--untracked-files=no", check=False):
        return "DIRTY", "hay cambios sin commitear: commitealos o descartalos antes de empezar"
    remote = _remote_ref(repo, dev)
    if remote:
        behind = int(repo.git("rev-list", "--count", f"{dev}..{remote}", check=False) or 0)
        if behind:
            return "BEHIND", f"{dev} está {behind} commit(s) atrás de {remote}: hacé `git pull` en {dev}"
    if current != dev:
        return "OTHER_BRANCH", f"estás en «{current}», no en {dev}"
    if mode == "base":
        files = repo.git("ls-tree", "-r", "--name-only", dev, check=False).splitlines()
        extra = [f for f in files if not f.startswith(BASE_ALLOWED)]
        if extra:
            more = f" (y {len(extra) - 10} más)" if len(extra) > 10 else ""
            return "DEV_HAS_MORE", f"{dev} ya tiene archivos además del discovery y grava-workflow: " + \
                ", ".join(extra[:10]) + more
    if not remote:
        return "NO_REMOTE", f"no hay remoto para {dev}: no se puede comprobar si está al día"
    return "OK", f"en {dev}, al día y sin cambios"


def ensure_branches(repo, push=False):
    """Make sure the production and integration branches exist and the copy stands on the integration
    branch (product-define, at start and at the end). With push: also that nothing is left uncommitted,
    and both branches go to the remote if there is one. Returns (ok, [what it did or found])."""
    main, dev = repo.production_branch, repo.integration_branch
    done = []
    has = lambda b: bool(repo.git("rev-parse", "--verify", "--quiet", f"refs/heads/{b}", check=False))
    if not repo.git("rev-parse", "--verify", "--quiet", "HEAD", check=False):
        repo.git("symbolic-ref", "HEAD", f"refs/heads/{main}")
        repo.git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-q", "-m", "chore: inicio del repositorio")
        done.append(f"repositorio sin commits: commit inicial en {main}")
    if not has(main):
        src = dev if has(dev) else "HEAD"
        repo.git("branch", main, src)
        done.append(f"creada {main} desde {src}")
    if not has(dev):
        repo.git("branch", dev, main)
        done.append(f"creada {dev} desde {main}")
    if repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False) != dev:
        r = subprocess.run(["git", "switch", dev], cwd=repo.root, capture_output=True, text=True)
        if r.returncode != 0:
            return False, done + [f"no pude pasar a {dev}: {r.stderr.strip()}"]
        done.append(f"ahora en {dev}")
    if push:
        dirty = repo.git("status", "--porcelain", check=False)
        if dirty:
            return False, done + ["quedan cambios sin commitear:\n" + dirty]
        if repo.git("remote", check=False).strip():
            r = subprocess.run(["git", "push", "-u", "origin", main, dev], cwd=repo.root, capture_output=True, text=True)
            if r.returncode != 0:
                return False, done + [f"falló el push: {r.stderr.strip()}"]
            done.append(f"pusheadas {main} y {dev}")
        else:
            done.append("sin remoto: nada que pushear")
    return True, done or [f"{main} y {dev} existen; en {dev}"]


def branches_for(repo, id_, kind):
    """Local and remote branches of a requirement: [(name, merged_into_dev)]."""
    dev = repo.integration_branch
    out = repo.git("branch", "-a", "--format=%(refname:short)", check=False).splitlines()
    names = set()
    for b in out:
        b = b.strip()
        b = b.split("/", 1)[1] if b.startswith(("origin/",)) else b
        if re.match(rf"^{kind}/{int(id_)}-", b):
            names.add(b)
    merged = set(x.strip().lstrip("* ").replace("origin/", "", 1)
                 for x in repo.git("branch", "-a", "--merged", dev, "--format=%(refname:short)", check=False).splitlines())
    dev_tip = repo.git("rev-parse", dev, check=False)

    def is_merged(n):
        # a branch just created from dev (no commits yet) is open, not merged
        tip = repo.git("rev-parse", n, check=False) or repo.git("rev-parse", f"origin/{n}", check=False)
        return n in merged and tip != dev_tip
    return sorted((n, is_merged(n)) for n in names)


def start_branch(repo, id_, slug, kind="feat"):
    """Create the requirement's branch from the integration branch, or switch to an open one.
    A requirement whose branch was already merged (reopened) gets a new one: -2, -3…"""
    if kind not in ("feat", "fix"):
        die("kind: feat | fix")
    base = f"{kind}/{int(id_)}-{slugify(slug, 40)}"
    existing = branches_for(repo, id_, kind)
    open_ = [n for n, merged in existing if not merged]
    current = repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    if open_:
        name = open_[-1]
        if current != name:
            if repo.git("rev-parse", "--verify", "--quiet", name, check=False):
                repo.git("switch", name)
            else:
                repo.git("switch", "--track", f"origin/{name}")
        return name, "retomada"
    taken = {n for n, _ in existing}
    name, k = base, 1
    while name in taken:
        k += 1
        name = f"{base}-{k}"
    repo.git("switch", "-c", name, repo.integration_branch)
    return name, "nueva" if k == 1 else f"nueva (reapertura {k})"


# ---------- MR/PR text ----------

def mr_text(repo, spec, branch, evidence_path=None, verdict_path=None, title=None):
    """Description of the MR/PR, from the specification in Jiku, the evidence and the verdict."""
    dev = repo.integration_branch
    title = title or spec.meta.get("title") or ""
    parts = [f"## #{spec.id} — {title}", "",
             f"Requisito de Jiku **#{spec.id}** ({spec.meta.get('type') or '—'}). Rama `{branch}` → `{dev}`.", ""]
    if spec.scope:
        parts += ["### Alcance", "", re.sub(r"^## ", "#### ", spec.scope, flags=re.M), ""]
    ev = evidence_path.read_text(encoding="utf-8").strip() if evidence_path and evidence_path.exists() else ""
    parts += ["### Evidencia", "", ev or "_Sin evidencia: correr `grava.py evidence`._", ""]
    decs = [d for d in spec.decisions() if d.get("Tipo", "").strip().lower() in ("nueva", "revierte")]
    if decs:
        parts += ["### Decisiones", ""] + [f"- **{d.get('ID')}** ({d.get('Tipo')}): {d.get('Decisión', '')}. "
                                          f"Motivo: {d.get('Motivo', '')}" for d in decs] + [""]
    stat = repo.git("diff", "--stat", f"{dev}...HEAD", "--", "_gflow", check=False)
    if stat:
        parts += ["### Cambios en la definición del producto", "", "```", stat, "```", ""]
    dec = repo.tmp / f"decided-{spec.id}.md"
    if dec.exists() and dec.read_text(encoding="utf-8").strip():
        parts += ["### Decidido en la implementación", "",
                  "Lo que la especificación no fijaba y es chico (ver la regla de `/req-implement`). Revisalo:", "",
                  dec.read_text(encoding="utf-8").strip(), ""]
    shots = repo.root / "reports" / "screenshots" / str(spec.id)
    if shots.is_dir() and any(shots.iterdir()):
        parts += ["### Capturas", "", f"Las pantallas que toca este requisito, en `reports/screenshots/{spec.id}/`:", "",
                  "\n".join(f"- `{p.name}`" for p in sorted(shots.iterdir()) if p.is_file()), ""]
    oos = repo.tmp / f"out-of-scope-{spec.id}.md"
    if oos.exists() and oos.read_text(encoding="utf-8").strip():
        parts += ["### Fuera de alcance", "", "Visto durante este requisito y registrado en Jiku:", "",
                  oos.read_text(encoding="utf-8").strip(), ""]
    verdict = verdict_path.read_text(encoding="utf-8").strip() if verdict_path and verdict_path.exists() else ""
    if verdict:
        parts += [verdict, ""]
    parts += ["### Para revisar", "",
              "- [ ] Probé el comportamiento con `make up`",
              "- [ ] Los criterios de aceptación están cubiertos por la evidencia",
              "- [ ] Los cambios en `_gflow/` coinciden con lo implementado",
              "- [ ] `make check` pasa en CI"]
    text = "\n".join(parts).rstrip() + "\n"
    p = repo.tmp / f"mr-{spec.id}.md"
    p.write_text(text, encoding="utf-8")
    return p, text


# ---------- release ----------

SEMVER_RE = re.compile(r"^v?(\d+)\.(\d+)\.(\d+)$")


def last_tag(repo):
    tags = [t for t in repo.git("tag", "--list", check=False).split() if SEMVER_RE.match(t)]
    tags.sort(key=lambda t: tuple(int(x) for x in SEMVER_RE.match(t).groups()))
    return tags[-1] if tags else None


def pending_release_ids(repo):
    """Jiku ids named by commits on the integration branch that production does not have yet."""
    dev, main = repo.integration_branch, repo.production_branch
    rng = f"{main}..{dev}" if repo.git("rev-parse", "--verify", "--quiet", main, check=False) else dev
    log = repo.git("log", rng, "--format=%s%n%b", check=False)
    seen = []
    for m in re.finditer(r"\(#(\d+)\)", log):
        i = int(m.group(1))
        if i not in seen:
            seen.append(i)
    return seen


def released_ids(repo):
    """Jiku ids named by commits that production already has."""
    main = repo.production_branch
    if not repo.git("rev-parse", "--verify", "--quiet", main, check=False):
        return set()
    return {int(i) for i in re.findall(r"\(#(\d+)\)", repo.git("log", main, "--format=%s%n%b", check=False))}


def contract_major_bumped(repo):
    """Contracts whose info.version major grew between production and the integration branch."""
    dev, main = repo.integration_branch, repo.production_branch
    out = []
    for p in sorted(repo.apis.glob("*.y*ml")) if repo.apis.is_dir() else []:
        rel = repo.rel(p)
        new = repo.git("show", f"{dev}:{rel}", check=False)
        old = repo.git("show", f"{main}:{rel}", check=False)
        mv = lambda t: int(m.group(1)) if (m := re.search(r"^\s+version:\s*['\"]?(\d+)\.", t, re.M)) else None
        if old and new and mv(old) is not None and mv(new) is not None and mv(new) > mv(old):
            out.append(rel)
    return out


def suggest_version(repo, reqs):
    """reqs: [{id, type}]. MAJOR when a contract's major grew; MINOR with a funcionalidad; else PATCH."""
    tag = last_tag(repo)
    a, b, c = (int(x) for x in SEMVER_RE.match(tag).groups()) if tag else (0, 0, 0)
    majors = contract_major_bumped(repo)
    if majors and tag:
        return f"{a + 1}.0.0", "mayor: cambió en forma incompatible " + ", ".join(majors)
    if any(r.get("type") == "funcionalidad" for r in reqs) or not tag:
        return (f"{a}.{b + 1}.0" if tag else "0.1.0"), "menor: hay funcionalidades nuevas" if tag else "primera versión"
    return f"{a}.{b}.{c + 1}", "parche: solo mejoras y correcciones"


def changelog(repo, version, reqs, write=True, known=()):
    """Add a CHANGELOG section below [Sin publicar]. reqs: [{id, title, type}]. known: [{id, title}] of
    open incidencias, listed as «Problemas conocidos».

    Entries written by hand under [Sin publicar] that cite a released requirement move into the new
    section as they are; the rest of [Sin publicar] stays."""
    p = repo.root / "CHANGELOG.md"
    current = p.read_text(encoding="utf-8") if p.exists() else "# Changelog\n\n"
    ids = {int(r["id"]) for r in reqs}
    # [Sin publicar]: its bounds, and its hand-written entries (an entry runs until the next "- " or heading)
    um = re.search(r"^## \[Sin publicar\][^\n]*\n", current, re.M | re.I)
    head, unreleased, tail = current, "", ""
    if um:
        nxt = re.search(r"^## ", current[um.end():], re.M)
        end = um.end() + nxt.start() if nxt else len(current)
        head, unreleased, tail = current[:um.end()], current[um.end():end], current[end:]
    moved, kept, sub = {"Agregado": [], "Cambiado": [], "Corregido": []}, [], None
    for block in re.split(r"(?m)^(?=- |### )", unreleased):
        if block.startswith("### "):
            sub = block[4:].strip().split("\n")[0]
            kept.append(block)
            continue
        cited = {int(i) for i in re.findall(r"\(#(\d+)\)", block)}
        if block.startswith("- ") and cited & ids:
            moved.setdefault(sub if sub in moved else "Cambiado", []).append(block.rstrip("\n"))
        else:
            kept.append(block)
    kept_text = "".join(kept)
    kept_text = re.sub(r"(?m)^### [^\n]*\n\s*(?=^### |\Z)", "", kept_text)  # drop emptied sub-headings
    groups = {g: list(v) for g, v in moved.items()}
    already = current.replace(unreleased, "")
    for r in reqs:
        if re.search(rf"\(#{r['id']}\)", already) or any(f"(#{r['id']})" in e for v in moved.values() for e in v):
            continue
        g = {"funcionalidad": "Agregado", "incidencia": "Corregido"}.get(r.get("type"), "Cambiado")
        title = re.sub(r"^\s*\d+\s*·\s*", "", r.get("title", ""))
        groups[g].append(f"- {title} (#{r['id']})")
    if not any(groups.values()):
        return None
    section = f"## [{version}] - {datetime.date.today().isoformat()}\n"
    first_id = lambda e: int(m.group(1)) if (m := re.search(r"\(#(\d+)\)", e)) else 0
    for g, items in groups.items():
        items = sorted(items, key=first_id)
        if items:
            section += f"\n### {g}\n\n" + "\n".join(items) + "\n"
    if known:
        section += "\n### Problemas conocidos\n\n" + "\n".join(
            f"- {r.get('title', '')} (#{r['id']})" for r in sorted(known, key=lambda r: int(r["id"]))) + "\n"
    if um:
        new = head + ("\n" + kept_text.strip() + "\n\n" if kept_text.strip() else "\n") + section + "\n" + tail.lstrip("\n")
    else:
        m = re.search(r"^## ", current, re.M)
        new = current[:m.start()] + section + "\n" + current[m.start():] if m else current.rstrip() + "\n\n" + section
    if write:
        p.write_text(new.rstrip() + "\n", encoding="utf-8")
    return section


# ---------- project ----------

def init_project(repo, project_id, platform, instance, templates_dir, writes=True):
    repo.gflow.mkdir(exist_ok=True)
    created = []
    if not repo.config_path.exists():
        repo.config_path.write_text(
            "# Vínculo del repositorio con Jiku y convenciones de git. Ver .claude/specs/jiku.md\n"
            f"jiku:\n  project_id: {project_id}\n  instance: {instance}\n  writes: {'true' if writes else 'false'}\n"
            f"git:\n  platform: {platform}\n  integration_branch: dev\n  production_branch: main\n",
            encoding="utf-8")
        created.append(repo.rel(repo.config_path))
    gi = repo.root / ".gitignore"
    lines = gi.read_text(encoding="utf-8").splitlines() if gi.exists() else []
    missing = [l for l in GITIGNORE_LINES if l not in lines]
    if missing:
        gi.write_text("\n".join(lines + missing).strip() + "\n", encoding="utf-8")
        created.append(".gitignore")
    for name, dst in (("AGENTS.md", repo.root / "AGENTS.md"), ("README.md", repo.root / "README.md"),
                      ("operacion.md", repo.docs / "operacion.md")):
        if not dst.exists() and (templates_dir / name).exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(templates_dir / name, dst)
            created.append(repo.rel(dst))
    claude = repo.root / "CLAUDE.md"
    if not claude.exists():
        claude.write_text("@AGENTS.md\n", encoding="utf-8")
        created.append("CLAUDE.md")
    return created


# ---------- status ----------

def stage(repo):
    disc = sorted(repo.discovery.glob("*.md")) if repo.discovery.is_dir() else []
    if repo.prd.is_dir() and any(repo.prd.iterdir()):
        return "base construida"
    if not disc:
        return "sin definir"
    open_docs = [p.name for p in disc if not re.search(r"^status:\s*closed", p.read_text(encoding="utf-8"), re.M)]
    return f"discovery en curso ({', '.join(open_docs)})" if open_docs else "discovery cerrado, sin base"


def status(repo, jiku_rows):
    """Group the project's requirements by their next action. jiku_rows: [] when Jiku is unreachable."""
    dev = repo.integration_branch
    all_branches = repo.git("branch", "-a", "--format=%(refname:short)", check=False).splitlines()
    remote_names = {b.split("/", 1)[1] for b in all_branches if b.startswith("origin/")}
    local = {b for b in all_branches if not b.startswith("origin/")}
    merged = set(x.strip().replace("origin/", "", 1)
                 for x in repo.git("branch", "-a", "--merged", dev, "--format=%(refname:short)", check=False).splitlines())
    by_id = {}
    for b in local | remote_names:
        m = re.match(r"^(feat|fix)/(\d+)-", b)
        if m:
            by_id.setdefault(int(m.group(2)), []).append(b)
    pending = set(pending_release_ids(repo))
    released = released_ids(repo) - pending
    from .spec import Spec, merged_in_integration

    def waiting(r):
        """The dependencies of a requirement that are not merged in dev yet ('' when none)."""
        deps = Spec(int(r["id"]), {"scope": r.get("scope") or ""}).depends()
        return ", ".join(f"#{d}" for d in deps if not merged_in_integration(repo, d))

    groups = {k: [] for k in ("Incidencias abiertas", "Borradores, para especificar", "Para especificar", "Especificados, esperan aprobación", "Para implementar",
                              "En cola, esperan a otro requisito",
                              "En implementación", "Mergeados, sin liberar", "Liberados, sin pasar a Revisión",
                              "En revisión", "Para liberar",
                              "Inconsistencias")}
    for r in sorted(jiku_rows, key=lambda x: int(x["id"])):
        rid, st = int(r["id"]), r.get("state")
        label = f"#{rid} {r.get('title', '')}"
        brs = by_id.get(rid, [])
        open_brs = [b for b in brs if b not in merged]
        has_crit = bool((r.get("acceptanceCriteria") or "").strip())
        draft = bool(re.search(r"^Especificación: borrador", r.get("description") or "", re.M))
        spec_cmd = (f"`/product-bootstrap {rid}` (lo especifica y lo construye)" if re.match(r"^0\s*·", r.get("title") or "")
                    else f"`/req-specify {rid}`")
        if st in ("resuelto", "cancelado"):
            if st == "cancelado" and open_brs:
                groups["Inconsistencias"].append(f"{label}: cancelado pero tiene la rama {open_brs[0]}")
            continue
        if draft and st in ("planificacion", "en_cola"):
            groups["Borradores, para especificar"].append(f"{label} ({st}) → {spec_cmd}")
            continue
        if st == "analisis" or (st == "planificacion" and not has_crit):
            if r.get("type") == "incidencia":
                m = re.search(r"^Origen: #(\d+)", r.get("description") or "", re.M)
                src = f", vista en #{m.group(1)}" if m else ""
                groups["Incidencias abiertas"].append(f"{label} ({st}{src}) → `/change {rid} …` si no toca nada "
                                                      f"documentado; si no, `/req-specify {rid}`")
                continue
            groups["Para especificar"].append(f"{label} ({st}) → pasarlo a Planificación y `/req-specify {rid}`")
        elif st == "planificacion":
            groups["Especificados, esperan aprobación"].append(f"{label} → aprobarlo en Jiku (En cola)")
        elif st == "en_cola" and waiting(r):
            groups["En cola, esperan a otro requisito"].append(f"{label} → antes: {waiting(r)}")
        elif st == "en_cola":
            groups["Para implementar"].append(f"{label} → `/req-implement {rid}`")
            if open_brs:
                groups["Inconsistencias"].append(f"{label}: en cola pero ya tiene la rama {open_brs[0]}")
        elif st == "desarrollo":
            if open_brs:
                b = open_brs[-1]
                pushed = b in remote_names
                act = "abrir o revisar el MR" if pushed else f"retomar con `/req-implement {rid}`"
                groups["En implementación"].append(f"{label} — `{b}`{' (pusheada)' if pushed else ' (solo local)'} → {act}")
            elif rid in pending or (brs and rid not in released):
                groups["Mergeados, sin liberar"].append(f"{label} → `/product-release`")
            elif rid in released:
                groups["Liberados, sin pasar a Revisión"].append(f"{label} → desplegar y pasarlo a Revisión")
            else:
                groups["Inconsistencias"].append(f"{label}: en Desarrollo sin rama ni commits")
        elif st == "revision":
            groups["En revisión"].append(f"{label} → confirmar que es estable y pasarlo a Resuelto")
    titles = {int(r["id"]): r.get("title", "") for r in jiku_rows}
    for i in sorted(pending):
        groups["Para liberar"].append(f"#{i} {titles.get(i, '')}".rstrip())
    if groups["Para liberar"]:
        groups["Para liberar"].append("→ `/product-release`")
    return groups
