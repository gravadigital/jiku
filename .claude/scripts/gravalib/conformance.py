"""The repository against the defaults of grava-workflow that a script can check
(.claude/specs/engineering.md). What needs judgment (error shape, logs, validation at the boundary,
security) is surveyed by the agent in /product-adopt."""

import re
import subprocess

MAKE_TARGETS = ("up", "down", "logs", "dev", "test", "test-unit", "test-integration", "test-e2e", "lint",
                "typecheck", "fmt", "check", "migrate", "build")


def _make_has(root, target):
    r = subprocess.run(["make", "-n", "-s", target], cwd=root, capture_output=True, text=True, timeout=30)
    return r.returncode == 0 and "No rule to make target" not in r.stderr


def _exists(root, *names):
    return next((n for n in names if (root / n).exists()), None)


def check(repo):
    root = repo.root
    rows, failing = [], 0

    def add(rule, ok, now):
        nonlocal failing
        rows.append([rule, "✅" if ok else "❌", now])
        failing += not ok

    has_make = (root / "Makefile").exists()
    add("Makefile en la raíz", has_make, "existe" if has_make else "no hay Makefile")
    if has_make:
        missing = [t for t in MAKE_TARGETS if not _make_has(root, t)]
        add("Targets de make: " + ", ".join(MAKE_TARGETS), not missing,
            "faltan: " + ", ".join(missing) if missing else "están todos")
    compose = _exists(root, "docker-compose.yml", "compose.yaml", "compose.yml", "docker-compose.yaml")
    add("Docker Compose para levantar todo el producto", bool(compose), compose or "no hay archivo de Compose")
    env = (root / ".env.example").exists()
    add(".env.example con todas las variables", env, "existe" if env else "no existe")
    gi = (root / ".gitignore").read_text(encoding="utf-8") if (root / ".gitignore").exists() else ""
    add(".env ignorado por git", bool(re.search(r"^\.env$", gi, re.M)), "sí" if re.search(r"^\.env$", gi, re.M) else "no")
    platform = repo.cfg("git", "platform", default="gitlab")
    ci_files = [".gitlab-ci.yml"] if platform == "gitlab" else sorted(str(p.relative_to(root)) for p in (root / ".github/workflows").glob("*.y*ml")) if (root / ".github/workflows").is_dir() else []
    ci = next((f for f in ci_files if (root / f).exists()), None)
    add(f"CI en {platform}", bool(ci), ci or "no hay CI")
    if ci:
        text = (root / ci).read_text(encoding="utf-8")
        add("CI corre targets de make", "make " in text, "sí" if "make " in text else "corre otros comandos")
        add("CI corre un escáner de secretos", bool(re.search(r"gitleaks|trufflehog|secrets", text, re.I)),
            "sí" if re.search(r"gitleaks|trufflehog|secrets", text, re.I) else "no se ve")
        add("CI corre una auditoría de dependencias", bool(re.search(r"audit|govulncheck|osv|snyk", text, re.I)),
            "sí" if re.search(r"audit|govulncheck|osv|snyk", text, re.I) else "no se ve")
    for f, who in (("README.md", "personas"), ("CHANGELOG.md", "personas"), ("docs/operacion.md", "personas"),
                   ("AGENTS.md", "agentes")):
        add(f"{f} ({who})", (root / f).exists(), "existe" if (root / f).exists() else "no existe")
    branches = repo.git("branch", "-a", "--format=%(refname:short)", check=False).split()
    released = bool(repo.git("tag", "--list", "v*", check=False).strip())
    for b in (repo.integration_branch, repo.production_branch):
        ok = b in branches or f"origin/{b}" in branches
        if not ok and b == repo.production_branch and not released:
            add(f"Rama {b}", True, "todavía no: la crea el primer `/product-release`")
            continue
        add(f"Rama {b}", ok, "existe" if ok else "no existe")
    contracts = sorted(str(p.relative_to(root)) for p in root.rglob("*.y*ml")
                       if re.search(r"openapi|asyncapi", p.name, re.I) and "node_modules" not in p.parts)
    add("Contrato OpenAPI / AsyncAPI de lo que se expone", bool(contracts),
        ", ".join(contracts[:3]) if contracts else "no se encontró")
    junit = bool(re.search(r"junit", " ".join(p.read_text(encoding="utf-8", errors="ignore")
                                               for p in root.rglob("*") if p.is_file() and p.suffix in
                                               (".json", ".ts", ".mjs", ".js", ".yml", ".yaml", ".toml", ".mk")
                                               and p.name != "package-lock.json" and "node_modules" not in p.parts
                                               and ".git" not in p.parts and p.stat().st_size < 200_000), re.I))
    add("Los tests dejan reportes JUnit", junit, "hay configuración de JUnit" if junit else "no se ve configuración de JUnit")
    return rows, failing
