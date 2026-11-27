"""What is left to do: the specification in Jiku against what the definition and the tests of the
current branch already have. Used to resume an open branch, or to adapt a reopened requirement whose
specification changed after it was implemented."""

import re
from pathlib import Path

from .evidence import scan_tests
from .lang import value
from .md import LOCAL_AC_RE, prefix_of, render_table


def _norm(s):
    return re.sub(r"\s+", " ", (s or "").replace("\\|", "|")).strip().rstrip(".").lower()


def definition_text(defn):
    """{id: (text as a criterion, origin)} for every row a criterion can map to."""
    out = {}
    for p in defn.blocks:
        req, fail = defn.block_rows(p)
        for r in req:
            text = r.get("Requirement") or (f"{r.get('Event', '')}: {r.get('Channel', '')} → {r.get('Recipient', '')} — "
                                            f"{r.get('Content', '')}")
            out[r["ID"]] = (text, r.get("Origin", "").strip())
        for r in fail:
            out[r["ID"]] = (f"{r.get('Condition', '')} → {r.get('Result', '')}", r.get("Origin", "").strip())
    for r in defn.invariants():
        out[r["ID"]] = (r.get("Rule", ""), r.get("Origin", "").strip())
    for r in defn.guarantees():
        out[r["ID"]] = (f"{r.get('Guarantee', '')}: {r.get('Mechanism', '')}", r.get("Origin", "").strip())
    return out


DECISION_TEXT = ("Topic", "Decision", "Rejected", "Reason")


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
    r = subprocess.run(["git", "archive", "--format=tar", branch, "_jflow"], cwd=repo.root, capture_output=True)
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
    specification does not account for. [[ID, Change, State, Detail]]"""
    rows = []
    crit = {c["ID"] for c in spec.criteria()[0]}
    decisions = spec.decisions()
    # D1: a decision changes only by reverting it (it moves to Reverted, and a `new` one replaces it)
    now = {d["ID"]: d for d in defn.decisions() if d.get("ID")}
    for d in base.decisions():
        cur = now.get(d.get("ID"))
        if not cur:
            continue
        changed = [c for c in DECISION_TEXT if _norm(d.get(c)) != _norm(cur.get(c))]
        if changed:
            rows.append([d["ID"], "—", "decision changed without reverting it",
                         f"{', '.join(changed)} changed: restore the integration branch's text and, if the change is "
                         f"on purpose, have the specification revert it (`reverts` + `new`)"])
    # D2: a row of the definition changes only through a criterion
    before, after = definition_text(base), definition_text(defn)
    for cid, (text, _) in sorted(before.items()):
        if cid in after and cid not in crit and _norm(text) != _norm(after[cid][0]):
            rows.append([cid, "—", "row changed without a criterion",
                         "restore the previous text, or have the specification include it with «modify»"])
    # D3: a row leaves «out of scope» only with the decision that brings it in
    gone = ({_norm(r.get("Out of scope")): r.get("Out of scope") for r in base.rows("out-of-scope.md", "Out of scope")}
            .items())
    still = {_norm(r.get("Out of scope")) for r in defn.rows("out-of-scope.md", "Out of scope")}
    reverted = {d.get("ID", "").strip() for d in decisions if value(d.get("Type")) == "reverts"}
    cited = _norm(" ".join(" ".join(d.values()) for d in decisions
                           if value(d.get("Type")) in ("new", "reverts"))
                  + " " + " ".join(" ".join(d.values()) for d in base.decisions() if d.get("ID") in reverted))
    for key, item in gone:
        if key and key not in still and key not in cited:
            rows.append(["Out of scope", "—", "row removed without a decision",
                         f"«{item}»: the specification needs the decision that brings it in; otherwise, restore the row"])
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
            crit.append({"ID": cid, "Change": "add", "Criterion": have[cid][0]})
    mentioned = set()
    for c in crit:
        cid, change = c["ID"], value(c.get("Change"))
        mentioned.add(cid)
        has_test = bool(tests.get(cid))
        if LOCAL_AC_RE.fullmatch(cid):
            state = "done" if has_test else "test missing"
            rows.append([cid, change, state, ""])
            pending += state != "done"
            continue
        cur = have.get(cid)
        if change == "remove":
            if cur:
                rows.append([cid, change, "still in the definition", ""])
                pending += 1
            if has_test:
                rows.append([cid, change, "tests still carry its ID", ", ".join(tests[cid][:3])])
                pending += 1
            if not cur and not has_test:
                rows.append([cid, change, "done", ""])
            continue
        notes = []
        if not cur:
            notes.append("missing in the definition")
        elif _norm(cur[0]) != _norm(c.get("Criterion")):
            notes.append(f"the definition's text is different: «{cur[0][:80]}»")
        elif change in ("add", "modify") and cur[1] != tag:
            notes.append(f"Origin is «{cur[1]}», not {tag}")
        if not has_test:
            notes.append("test missing")
        rows.append([cid, change, "done" if not notes else "pending", "; ".join(notes)])
        pending += bool(notes)
    for cid, (text, origin) in sorted(have.items()):
        if origin == tag and cid not in mentioned:
            rows.append([cid, "—", "left over: the specification no longer includes it",
                         "take it out of the definition, with its code and its tests"])
            pending += 1
    known = {r["ID"] for r in defn.decisions()}
    reverted = {r["ID"] for r in defn.reverted()}
    for d in spec.decisions():
        did, kind = d.get("ID", "").strip(), value(d.get("Type"))
        if kind == "new" and did not in known:
            rows.append([did, "new", "missing in decisions.md", ""])
            pending += 1
        elif kind == "reverts" and did not in reverted:
            rows.append([did, "reverts", "not moved to Reverted yet", ""])
            pending += 1
    params = {p["Parameter"].strip().lower(): p for p in defn.parameters()}
    for p in spec.parameters():
        name, change = p.get("Parameter", "").strip(), value(p.get("Change"))
        cur = params.get(name.lower())
        if change == "remove" and cur:
            rows.append([name, change, "still in parameters.md", ""])
            pending += 1
        elif change in ("add", "modify") and (not cur or _norm(cur.get("Value")) != _norm(p.get("Value"))):
            rows.append([name, change, "pending", "missing in parameters.md or with another value"])
            pending += 1
    base = integration_definition(repo)
    if base is not None:
        for r in definition_changes(base, defn, spec):
            rows.append(r)
            pending += 1
    for n, line in bad:
        rows.append(["?", "?", "unreadable criterion", line[:80]])
    head = (f"#{spec.id}: {pending} pending. The technical detail (data, schema, interface, flows, architecture) "
            "is compared by hand against _jflow/.\n\n")
    return head + render_table(["ID", "Change", "State", "Detail"], rows)
