"""Test coverage by ID and evidence from JUnit reports. See .claude/specs/engineering.md (Testing)."""

import datetime
import os
import re
import xml.etree.ElementTree as ET

from .md import TEST_TAG_RE, render_table

SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", ".next", ".astro", "coverage",
             ".dart_tool", "reports", "_gflow", "docs", ".claude", "target", "__pycache__", ".venv"}
TEST_FILE_RE = re.compile(r"(?i)(test|spec|e2e)")
CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".go", ".dart", ".py", ".astro", ".vue",
            ".svelte", ".java", ".kt", ".rb", ".php", ".rs", ".cs"}


def scan_tests(root):
    """{tag: [file:line]} for every [ID] tag found in test files."""
    found = {}
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            ext = os.path.splitext(fn)[1]
            if ext not in CODE_EXT:
                continue
            path = os.path.join(dirpath, fn)
            if not TEST_FILE_RE.search(path):
                continue
            try:
                text = open(path, encoding="utf-8", errors="ignore").read()
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                for tag in TEST_TAG_RE.findall(line):
                    found.setdefault(tag, []).append(f"{os.path.relpath(path, root)}:{i}")
    return found


def coverage_for(repo, ids):
    tags = scan_tests(repo.root)
    return {i: tags.get(i, []) for i in ids}


def built_ids(defn):
    """Every ID the product must have a test for: requirements and failures of every block (the
    definition describes only what is built), the invariants applied in them, and their guarantees."""
    ids = []
    built = list(defn.blocks)
    for p in built:
        req, fail = defn.block_rows(p)
        ids += [r["ID"] for r in req + fail]
    invs = [i["ID"] for i in defn.invariants()
            if set(x.strip() for x in i.get("Aplicada en", "").split(",")) & set(built)]
    ids += invs
    from .md import ids_in
    for g in defn.guarantees():
        if set(ids_in(g.get("Regla", ""))) & set(ids):
            ids.append(g["ID"])
    return ids


# ---------- JUnit ----------

def read_junit(reports_dir):
    """[{name, classname, file, status, message}] from every JUnit XML under reports_dir."""
    cases = []
    if not reports_dir.is_dir():
        return cases
    for p in sorted(reports_dir.rglob("*.xml")):
        try:
            root = ET.parse(p).getroot()
        except ET.ParseError:
            continue
        for tc in root.iter("testcase"):
            status, msg = "passed", ""
            for child in tc:
                if child.tag in ("failure", "error"):
                    status, msg = "failed", (child.get("message") or child.text or "").strip()[:200]
                elif child.tag == "skipped":
                    status = "skipped"
            cases.append({"name": tc.get("name", ""), "classname": tc.get("classname", ""),
                          "file": p.name, "status": status, "message": msg})
    return cases


def evidence(repo, id_, criteria_rows, write=True):
    """Criterion -> tests -> result from the JUnit reports. `criteria_rows`: [{ID, Criterio}] of the
    specification (from Jiku), or of the IDs a direct change proves. Writes the table to the working
    folder (evidence-{id}.md) for the MR text. Returns (ok, table_md, summary, failed, path)."""
    cases = read_junit(repo.reports / "junit")
    by_tag = {}
    for c in cases:
        for tag in TEST_TAG_RE.findall(f"{c['classname']} {c['name']}"):
            by_tag.setdefault(tag, []).append(c)
    rows, ok = [], True
    for crit in criteria_rows:
        cid = crit["ID"].strip()
        if crit.get("Cambio", "").strip().lower() == "elimina":
            continue
        tests = by_tag.get(cid, [])
        if not tests:
            result, ok = "❌ sin test", False
        elif any(t["status"] == "failed" for t in tests):
            result, ok = "❌ falla", False
        elif all(t["status"] == "skipped" for t in tests):
            result, ok = "❌ omitido", False
        else:
            n = sum(1 for t in tests if t["status"] == "passed")
            result = f"✅ pasa ({n})"
        names = "<br>".join(f"{t['name'][:90]}" for t in tests[:4]) + (" …" if len(tests) > 4 else "")
        rows.append([cid, crit.get("Criterio", "")[:120], names or "—", result])
    total = len(cases)
    failed = sum(1 for c in cases if c["status"] == "failed")
    passed = sum(1 for c in cases if c["status"] == "passed")
    commit = repo.git("rev-parse", "--short", "HEAD", check=False) or "—"
    nrep = len(list((repo.reports / "junit").rglob("*.xml"))) if (repo.reports / "junit").is_dir() else 0
    summary = (f"Calculada el {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} sobre el commit `{commit}` "
               f"con `grava.py evidence`, desde {nrep} reportes JUnit: {total} tests, {passed} pasan, {failed} fallan.")
    table = render_table(["Criterio", "Qué se verifica", "Tests", "Resultado"], rows)
    path = repo.tmp / f"evidence-{int(id_)}.md"
    if write:
        path.write_text(summary + "\n\n" + table + "\n", encoding="utf-8")
    return ok, table, summary, failed, path
