"""The repository against the defaults of jiku flow that a script can check
(.claude/specs/engineering.md). Each check says whether it belongs to the minimum an adopted product
must reach (M1-M9, "Adopting an existing product: the minimum") or is a default followed from then on.
What needs judgment (error shape, logs, validation at the boundary, security) is surveyed by the agent
in /jflow-product-brownfield."""

import re
import subprocess

MAKE_TARGETS = ("up", "down", "logs", "dev", "test", "test-unit", "test-integration", "test-e2e", "test-perf",
                "lint", "typecheck", "fmt", "check", "migrate", "build")
# Root folders that are never a service folder out of place.
NOT_SERVICES = {"services", "node_modules", "_jflow", "docs", "reports", ".git", ".github", ".claude"}


def _make_has(root, target):
    r = subprocess.run(["make", "-n", "-s", target], cwd=root, capture_output=True, text=True, timeout=30)
    return r.returncode == 0 and "No rule to make target" not in r.stderr


def _e2e_is_stub(folder):
    """True when `make test-e2e` of a service only prints a message: a level that tests nothing."""
    r = subprocess.run(["make", "-n", "-s", "test-e2e"], cwd=folder, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        return True
    lines = [l.strip() for l in r.stdout.splitlines() if l.strip()]
    return all(re.match(r"^(echo|printf|true|:)(\s|$)", l) for l in lines)


def _exists(root, *names):
    return next((n for n in names if (root / n).exists()), None)


def check(repo):
    root = repo.root
    rows, failing = [], 0

    def add(rule, ok, now, level="minimum"):
        nonlocal failing
        rows.append([rule, level, "✅" if ok else "❌", now])
        failing += not ok

    out_of_place = sorted(d.name for d in root.iterdir() if d.is_dir() and d.name not in NOT_SERVICES
                          and (d / "Dockerfile").exists())
    add("M1 Services in services/{service}/", not out_of_place,
        "outside services/: " + ", ".join(out_of_place) if out_of_place else "yes")

    has_make = (root / "Makefile").exists()
    add("M2 Makefile at the root", has_make, "exists" if has_make else "no Makefile")
    if has_make:
        missing = [t for t in MAKE_TARGETS if not _make_has(root, t)]
        add("M2 Make targets: " + ", ".join(MAKE_TARGETS), not missing,
            "missing: " + ", ".join(missing) if missing else "all there")
    compose = _exists(root, "docker-compose.yml", "compose.yaml", "compose.yml", "docker-compose.yaml")
    add("M5 Docker Compose to bring up the whole product", bool(compose), compose or "no Compose file")
    env = (root / ".env.example").exists()
    add("M4 .env.example with every variable", env, "exists" if env else "does not exist")
    gi = (root / ".gitignore").read_text(encoding="utf-8") if (root / ".gitignore").exists() else ""
    for ignored in (".env", "reports/"):
        ok = bool(re.search(rf"^/?{re.escape(ignored)}$", gi, re.M))
        add(f"M4 {ignored} ignored by git", ok, "yes" if ok else "no")
    platform = repo.cfg("git", "platform", default="gitlab")
    ci_files = [".gitlab-ci.yml"] if platform == "gitlab" else sorted(str(p.relative_to(root)) for p in (root / ".github/workflows").glob("*.y*ml")) if (root / ".github/workflows").is_dir() else []
    ci = next((f for f in ci_files if (root / f).exists()), None)
    add(f"M7 CI on {platform}", bool(ci), ci or "no CI")
    if ci:
        text = (root / ci).read_text(encoding="utf-8")
        add("M7 CI runs make targets", "make " in text, "yes" if "make " in text else "runs other commands")
        add("CI runs a secret scanner", bool(re.search(r"gitleaks|trufflehog|secrets", text, re.I)),
            "yes" if re.search(r"gitleaks|trufflehog|secrets", text, re.I) else "not seen", "default")
        add("CI runs a dependency audit", bool(re.search(r"audit|govulncheck|osv|snyk", text, re.I)),
            "yes" if re.search(r"audit|govulncheck|osv|snyk", text, re.I) else "not seen", "default")
    from .lang import doc_file
    for f, who in (("README.md", "people"), ("CHANGELOG.md", "people"), (doc_file("operations", repo.language), "people"),
                   ("AGENTS.md", "agents")):
        level = "default" if f == "CHANGELOG.md" else "minimum"
        add(f"{'M8 ' if level == 'minimum' else ''}{f} ({who})", (root / f).exists(),
            "exists" if (root / f).exists() else "does not exist", level)
    branches = repo.git("branch", "-a", "--format=%(refname:short)", check=False).split()
    released = bool(repo.git("tag", "--list", "v*", check=False).strip())
    for b in (repo.integration_branch, repo.production_branch):
        ok = b in branches or f"origin/{b}" in branches
        if not ok and b == repo.production_branch and not released:
            add(f"Branch {b}", True, "not yet: the first `/jflow-release` creates it", "default")
            continue
        add(f"M8 Branch {b}" if b == repo.integration_branch else f"Branch {b}", ok, "exists" if ok else "does not exist",
            "minimum" if b == repo.integration_branch else "default")
    contracts = sorted(str(p.relative_to(root)) for p in root.rglob("*.y*ml")
                       if re.search(r"openapi|asyncapi", p.name, re.I) and "node_modules" not in p.parts)
    outside = [c for c in contracts if not c.startswith("_jflow/apis/")]
    add("M8 OpenAPI / AsyncAPI contract in _jflow/apis/", bool(contracts) and not outside,
        ("outside _jflow/apis/: " + ", ".join(outside[:3])) if outside
        else ", ".join(contracts[:3]) if contracts else "not found")
    junit = bool(re.search(r"junit", " ".join(p.read_text(encoding="utf-8", errors="ignore")
                                               for p in root.rglob("*") if p.is_file() and p.suffix in
                                               (".json", ".ts", ".mjs", ".js", ".yml", ".yaml", ".toml", ".mk")
                                               and p.name != "package-lock.json" and "node_modules" not in p.parts
                                               and ".git" not in p.parts and p.stat().st_size < 200_000), re.I))
    testing = repo.arch / "testing.md"
    add("M9 How each entry point is tested (_jflow/prd/architecture/testing.md)", testing.exists(),
        "exists" if testing.exists() else "does not exist (`jflow.py def-testing` builds it)")
    from .definition import Definition
    defn = Definition(repo)
    owners = sorted({o for k, o, _ in defn.entry_points() if o in {s["Service"].strip() for s in defn.services()}}
                    | {s.get("Service", "").strip() for s in defn.surfaces() if s.get("Service", "").strip()})
    stubs = [o for o in owners if (root / "services" / o / "Makefile").exists() and _e2e_is_stub(root / "services" / o)]
    if owners:
        add("M9 `make test-e2e` tests every service with an entry point", not stubs,
            "only prints a message: " + ", ".join(stubs) if stubs else "yes")
    add("M3 The tests leave JUnit reports", junit, "JUnit is configured" if junit else "no JUnit configuration seen")
    return rows, failing
