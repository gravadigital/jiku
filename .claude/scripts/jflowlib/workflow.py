"""Git checks and branches, MR/PR text, release, project setup and status."""

import datetime
import re
import subprocess
import shutil

from .lang import canon, say, structure, value
from .md import render_table, slugify
from .repo import die

GITIGNORE_LINES = ["reports/", ".env", "__pycache__/"]
# What /jflow-product-discover leaves on dev before the bootstrap: anything else means dev is not empty.
BASE_ALLOWED = ("_jflow/", ".claude/", ".gitignore", "AGENTS.md", "CLAUDE.md", "README.md", "docs/",
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

    implement (jflow-build, jflow-fix, jflow-product-brownfield): OK, BEHIND, DIRTY, OTHER_BRANCH, NO_REMOTE, NO_DEV
    base (jflow-product-scaffold):                 OK, BEHIND, DIRTY, OTHER_BRANCH, NO_REMOTE, NO_DEV, DEV_HAS_MORE
    read (jflow-spec, jflow-status):               OK, BEHIND, NO_REMOTE, OTHER_BRANCH, NO_DEV
    """
    dev = repo.integration_branch
    current = repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False)
    has_dev = bool(repo.git("rev-parse", "--verify", "--quiet", dev, check=False))
    if not has_dev:
        return "NO_DEV", f"the branch {dev} does not exist"
    if mode != "read" and repo.git("status", "--porcelain", "--untracked-files=no", check=False):
        return "DIRTY", "there are uncommitted changes: commit or discard them before starting"
    remote = _remote_ref(repo, dev)
    if remote:
        behind = int(repo.git("rev-list", "--count", f"{dev}..{remote}", check=False) or 0)
        if behind:
            return "BEHIND", f"{dev} is {behind} commit(s) behind {remote}: run `git pull` on {dev}"
    if current != dev:
        return "OTHER_BRANCH", f"you are on «{current}», not on {dev}"
    if mode == "base":
        files = repo.git("ls-tree", "-r", "--name-only", dev, check=False).splitlines()
        extra = [f for f in files if not f.startswith(BASE_ALLOWED)]
        if extra:
            more = f" (and {len(extra) - 10} more)" if len(extra) > 10 else ""
            return "DEV_HAS_MORE", f"{dev} already has files besides the discovery and jiku flow: " + \
                ", ".join(extra[:10]) + more
    if not remote:
        return "NO_REMOTE", f"no remote for {dev}: cannot check whether it is up to date"
    return "OK", f"on {dev}, up to date and clean"


def ensure_branches(repo, push=False):
    """Make sure the production and integration branches exist and the copy stands on the integration
    branch (jflow-product-discover, at start and at the end). With push: also that nothing is left uncommitted,
    and both branches go to the remote if there is one. Returns (ok, [what it did or found])."""
    main, dev = repo.production_branch, repo.integration_branch
    done = []
    has = lambda b: bool(repo.git("rev-parse", "--verify", "--quiet", f"refs/heads/{b}", check=False))
    if not repo.git("rev-parse", "--verify", "--quiet", "HEAD", check=False):
        repo.git("symbolic-ref", "HEAD", f"refs/heads/{main}")
        repo.git("-c", "commit.gpgsign=false", "commit", "--allow-empty", "-q", "-m", "chore: initial commit")
        done.append(f"repository without commits: initial commit on {main}")
    if not has(main):
        src = dev if has(dev) else "HEAD"
        repo.git("branch", main, src)
        done.append(f"created {main} from {src}")
    if not has(dev):
        repo.git("branch", dev, main)
        done.append(f"created {dev} from {main}")
    if repo.git("rev-parse", "--abbrev-ref", "HEAD", check=False) != dev:
        r = subprocess.run(["git", "switch", dev], cwd=repo.root, capture_output=True, text=True)
        if r.returncode != 0:
            return False, done + [f"could not switch to {dev}: {r.stderr.strip()}"]
        done.append(f"now on {dev}")
    if push:
        dirty = repo.git("status", "--porcelain", check=False)
        if dirty:
            return False, done + ["uncommitted changes are left:\n" + dirty]
        if repo.git("remote", check=False).strip():
            r = subprocess.run(["git", "push", "-u", "origin", main, dev], cwd=repo.root, capture_output=True, text=True)
            if r.returncode != 0:
                return False, done + [f"the push failed: {r.stderr.strip()}"]
            done.append(f"pushed {main} and {dev}")
        else:
            done.append("no remote: nothing to push")
    return True, done or [f"{main} and {dev} exist; on {dev}"]


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
        return name, "resumed"
    taken = {n for n, _ in existing}
    name, k = base, 1
    while name in taken:
        k += 1
        name = f"{base}-{k}"
    repo.git("switch", "-c", name, repo.integration_branch)
    return name, "new" if k == 1 else f"new (reopened {k})"


# ---------- MR/PR text ----------

def mr_text(repo, spec, branch, evidence_path=None, verdict_path=None, title=None):
    """Description of the MR/PR, from the specification in Jiku, the evidence and the verdict. Git text is
    always English; what it quotes from the specification stays in the product language."""
    dev = repo.integration_branch
    title = title or spec.meta.get("title") or ""
    parts = [f"## #{spec.id} — {title}", "",
             f"Jiku requirement **#{spec.id}** ({spec.meta.get('type') or '—'}). Branch `{branch}` → `{dev}`.", ""]
    if spec.scope:
        parts += ["### Scope", "", re.sub(r"^## ", "#### ", spec.scope, flags=re.M), ""]
    ev = evidence_path.read_text(encoding="utf-8").strip() if evidence_path and evidence_path.exists() else ""
    parts += ["### Evidence", "", ev or "_No evidence: run `jflow.py evidence`._", ""]
    decs = [d for d in spec.decisions() if value(d.get("Type")) in ("new", "reverts")]
    if decs:
        parts += ["### Decisions", ""] + [f"- **{d.get('ID')}** ({value(d.get('Type'))}): {d.get('Decision', '')}. "
                                          f"Reason: {d.get('Reason', '')}" for d in decs] + [""]
    stat = repo.git("diff", "--stat", f"{dev}...HEAD", "--", "_jflow", check=False)
    if stat:
        parts += ["### Changes to the product definition", "", "```", stat, "```", ""]
    dec = repo.tmp / f"decided-{spec.id}.md"
    if dec.exists() and dec.read_text(encoding="utf-8").strip():
        parts += ["### Decided in the implementation", "",
                  "What the specification did not settle and is small (see the rule in `/jflow-build`). Review it:", "",
                  dec.read_text(encoding="utf-8").strip(), ""]
    fixed = repo.tmp / f"corrected-{spec.id}.md"
    if fixed.exists() and fixed.read_text(encoding="utf-8").strip():
        parts += ["### Fixed along the way", "",
                  "What was already built wrong according to the definition, in what this requirement touches, "
                  "and was fixed with its test (see the rule in `/jflow-build`). Review it:", "",
                  fixed.read_text(encoding="utf-8").strip(), ""]
    shots = repo.root / "reports" / "screenshots" / str(spec.id)
    if shots.is_dir() and any(shots.iterdir()):
        parts += ["### Screenshots", "", f"The screens this requirement touches, in `reports/screenshots/{spec.id}/`:", "",
                  "\n".join(f"- `{p.name}`" for p in sorted(shots.iterdir()) if p.is_file()), ""]
    oos = repo.tmp / f"out-of-scope-{spec.id}.md"
    if oos.exists() and oos.read_text(encoding="utf-8").strip():
        parts += ["### Out of scope", "", "Seen during this requirement and recorded in Jiku:", "",
                  oos.read_text(encoding="utf-8").strip(), ""]
    verdict = verdict_path.read_text(encoding="utf-8").strip() if verdict_path and verdict_path.exists() else ""
    if verdict:
        parts += [verdict, ""]
    parts += ["### To review", "",
              "- [ ] I tried the behaviour with `make up`",
              "- [ ] The acceptance criteria are covered by the evidence",
              "- [ ] The changes in `_jflow/` match what was implemented",
              "- [ ] `make check` passes in CI"]
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
        return f"{a + 1}.0.0", "major: incompatible change in " + ", ".join(majors)
    if any(r.get("type") == "funcionalidad" for r in reqs) or not tag:
        return (f"{a}.{b + 1}.0" if tag else "0.1.0"), "minor: there are new features" if tag else "first version"
    return f"{a}.{b}.{c + 1}", "patch: only improvements and fixes"


def changelog(repo, version, reqs, write=True, known=()):
    """Add a CHANGELOG section below [Unreleased] ([Sin publicar] in Spanish). reqs: [{id, title, type}].
    known: [{id, title}] of open incidencias, listed as «Known issues». The CHANGELOG is for people: its
    headings follow the product language.

    Entries written by hand under [Unreleased] that cite a released requirement move into the new
    section as they are; the rest of [Unreleased] stays."""
    lang = repo.language
    p = repo.root / "CHANGELOG.md"
    current = p.read_text(encoding="utf-8") if p.exists() else "# Changelog\n\n"
    ids = {int(r["id"]) for r in reqs}
    # [Unreleased]: its bounds, and its hand-written entries (an entry runs until the next "- " or heading)
    um = re.search(r"^## \[(?:Sin publicar|Unreleased)\][^\n]*\n", current, re.M | re.I)
    head, unreleased, tail = current, "", ""
    if um:
        nxt = re.search(r"^## ", current[um.end():], re.M)
        end = um.end() + nxt.start() if nxt else len(current)
        head, unreleased, tail = current[:um.end()], current[um.end():end], current[end:]
    moved, kept, sub = {"Added": [], "Changed": [], "Fixed": []}, [], None
    for block in re.split(r"(?m)^(?=- |### )", unreleased):
        if block.startswith("### "):
            sub = canon(block[4:].strip().split("\n")[0])
            kept.append(block)
            continue
        cited = {int(i) for i in re.findall(r"\(#(\d+)\)", block)}
        if block.startswith("- ") and cited & ids:
            moved.setdefault(sub if sub in moved else "Changed", []).append(block.rstrip("\n"))
        else:
            kept.append(block)
    kept_text = "".join(kept)
    kept_text = re.sub(r"(?m)^### [^\n]*\n\s*(?=^### |\Z)", "", kept_text)  # drop emptied sub-headings
    groups = {g: list(v) for g, v in moved.items()}
    already = current.replace(unreleased, "")
    for r in reqs:
        if re.search(rf"\(#{r['id']}\)", already) or any(f"(#{r['id']})" in e for v in moved.values() for e in v):
            continue
        g = {"funcionalidad": "Added", "incidencia": "Fixed"}.get(r.get("type"), "Changed")
        title = re.sub(r"^\s*\d+\s*·\s*", "", r.get("title", ""))
        groups[g].append(f"- {title} (#{r['id']})")
    if not any(groups.values()):
        return None
    section = f"## [{version}] - {datetime.date.today().isoformat()}\n"
    first_id = lambda e: int(m.group(1)) if (m := re.search(r"\(#(\d+)\)", e)) else 0
    for g, items in groups.items():
        items = sorted(items, key=first_id)
        if items:
            section += f"\n### {say(g, lang)}\n\n" + "\n".join(items) + "\n"
    if known:
        section += f"\n### {say('Known issues', lang)}\n\n" + "\n".join(
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

def init_project(repo, project_id, platform, instance, templates_dir, writes=True, language=None):
    """_jflow/project.yaml, .gitignore, AGENTS.md and CLAUDE.md (agents, English) and the README and the
    operations guide (people, from the templates of the product language)."""
    from .lang import DEFAULT, doc_file, template
    repo.jflow.mkdir(exist_ok=True)
    created = []
    if not repo.config_path.exists():
        repo.config_path.write_text(
            "# How this repository links to Jiku, its language and its git conventions. "
            "See .claude/specs/jiku.md and .claude/specs/language.md\n"
            f"language: {language or DEFAULT}\n"
            f"jiku:\n  project_id: {project_id}\n  instance: {instance}\n  writes: {'true' if writes else 'false'}\n"
            f"git:\n  platform: {platform}\n  integration_branch: dev\n  production_branch: main\n",
            encoding="utf-8")
        created.append(repo.rel(repo.config_path))
        repo._config = None
    gi = repo.root / ".gitignore"
    lines = gi.read_text(encoding="utf-8").splitlines() if gi.exists() else []
    missing = [l for l in GITIGNORE_LINES if l not in lines]
    if missing:
        gi.write_text("\n".join(lines + missing).strip() + "\n", encoding="utf-8")
        created.append(".gitignore")
    lang = repo.language
    root = templates_dir.parent.parent  # .claude/templates -> repo root
    for src, dst in ((templates_dir / "AGENTS.md", repo.root / "AGENTS.md"),
                     (root / template("README.md", lang), repo.root / "README.md"),
                     (root / template("operations", lang), repo.root / doc_file("operations", lang))):
        if not dst.exists() and src.exists():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(src, dst)
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
        return "base built"
    if not disc:
        return "not defined"
    open_docs = [p.name for p in disc if not re.search(r"^status:\s*closed", p.read_text(encoding="utf-8"), re.M)]
    return f"discovery in progress ({', '.join(open_docs)})" if open_docs else "discovery closed, no base"


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

    from .jiku import SPEC_DRAFT, origin_of, spec_status
    groups = {k: [] for k in ("Open issues", "Drafts, to specify", "To specify", "Specified, waiting for approval",
                              "To implement", "Queued, waiting for another requirement",
                              "In implementation", "Merged, not released", "Released, not moved to Review",
                              "In review", "To release",
                              "Inconsistencies")}
    for r in sorted(jiku_rows, key=lambda x: int(x["id"])):
        rid, st = int(r["id"]), r.get("state")
        label = f"#{rid} {r.get('title', '')}"
        brs = by_id.get(rid, [])
        open_brs = [b for b in brs if b not in merged]
        has_crit = bool((r.get("acceptanceCriteria") or "").strip())
        draft = spec_status(r) == SPEC_DRAFT
        spec_cmd = (f"`/jflow-product-scaffold {rid}` (specifies and builds it)" if re.match(r"^0\s*·", r.get("title") or "")
                    else f"`/jflow-spec {rid}`")
        if st in ("resuelto", "cancelado"):
            if st == "cancelado" and open_brs:
                groups["Inconsistencies"].append(f"{label}: cancelled but it has the branch {open_brs[0]}")
            continue
        if draft and st in ("planificacion", "en_cola"):
            groups["Drafts, to specify"].append(f"{label} ({st}) → {spec_cmd}")
            continue
        if st == "analisis" or (st == "planificacion" and not has_crit):
            if r.get("type") == "incidencia":
                src = f", seen in #{origin_of(r)}" if origin_of(r) else ""
                groups["Open issues"].append(f"{label} ({st}{src}) → `/jflow-fix {rid} …` if it touches nothing "
                                             f"documented; otherwise, `/jflow-spec {rid}`")
                continue
            groups["To specify"].append(f"{label} ({st}) → move it to Planificación and `/jflow-spec {rid}`")
        elif st == "planificacion":
            groups["Specified, waiting for approval"].append(f"{label} → approve it in Jiku (En cola)")
        elif st == "en_cola" and waiting(r):
            groups["Queued, waiting for another requirement"].append(f"{label} → first: {waiting(r)}")
        elif st == "en_cola":
            groups["To implement"].append(f"{label} → `/jflow-build {rid}`")
            if open_brs:
                groups["Inconsistencies"].append(f"{label}: queued but it already has the branch {open_brs[0]}")
        elif st == "desarrollo":
            if open_brs:
                b = open_brs[-1]
                pushed = b in remote_names
                act = "open or review the MR" if pushed else f"resume with `/jflow-build {rid}`"
                groups["In implementation"].append(f"{label} — `{b}`{' (pushed)' if pushed else ' (local only)'} → {act}")
            elif rid in pending or (brs and rid not in released):
                groups["Merged, not released"].append(f"{label} → `/jflow-release`")
            elif rid in released:
                groups["Released, not moved to Review"].append(f"{label} → deploy it and move it to Revisión")
            else:
                groups["Inconsistencies"].append(f"{label}: in Desarrollo without a branch or commits")
        elif st == "revision":
            groups["In review"].append(f"{label} → confirm it is stable and move it to Resuelto")
    titles = {int(r["id"]): r.get("title", "") for r in jiku_rows}
    for i in sorted(pending):
        groups["To release"].append(f"#{i} {titles.get(i, '')}".rstrip())
    if groups["To release"]:
        groups["To release"].append("→ `/jflow-release`")
    return groups
