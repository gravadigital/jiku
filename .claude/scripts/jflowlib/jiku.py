"""Jiku through its CLI (`jiku`, from github.com/gravadigital/jiku-go). See .claude/specs/jiku.md."""

import datetime
import json
import os
import shutil
import subprocess
from pathlib import Path

from .lang import say, structure
from .repo import die
from .spec import FIELDS, OPEN_STATES, Spec

STATES = ("analisis", "planificacion", "en_cola", "desarrollo", "revision", "resuelto", "cancelado")
AGENT_STATES = ("planificacion", "desarrollo")
TYPES = ("funcionalidad", "mejora", "incidencia", "otro")


class Jiku:
    def __init__(self, repo):
        self.repo = repo
        self.bin = shutil.which("jiku")
        self.project_id = repo.cfg("jiku", "project_id")
        self.instance = repo.cfg("jiku", "instance")
        writes = repo.cfg("jiku", "writes", default=True)
        self.dry = os.environ.get("JFLOW_JIKU_DRY_RUN") == "1" or writes is False

    def _config_flags(self):
        """The instance's own config file. `--instance` alone keeps the default servers and
        credentials, so it could reach another deployment: never rely on it."""
        if not self.instance:
            die("jiku.instance (dev | prod) is missing in _jflow/project.yaml", 3)
        cfg = Path.home() / ".config" / "jiku" / f"config.{self.instance}.yaml"
        if not cfg.exists():
            die(f"{cfg} does not exist: configure the jiku CLI for the instance «{self.instance}» "
                f"(jiku config init) and run `jiku --config {cfg} login`", 3)
        return ["--config", str(cfg)]

    def _env(self):
        env = dict(os.environ)
        env["JIKU_VIA"] = "agent"
        return env

    def _run(self, args, stdin=None):
        if not self.bin:
            die("the `jiku` CLI is not installed (github.com/gravadigital/jiku-go): install it and run `jiku login`", 3)
        r = subprocess.run([self.bin, *self._config_flags(), *args], capture_output=True, text=True, input=stdin,
                           env=self._env(), timeout=90)
        return r.returncode, r.stdout, r.stderr

    def query(self, op, *flags):
        code, out, err = self._run(["query", op, *flags, "-o", "json"])
        if code != 0:
            die(f"jiku query {op} failed: {err.strip() or out.strip()}", 3)
        start = out.find("[") if out.find("[") != -1 and (out.find("{") == -1 or out.find("[") < out.find("{")) else out.find("{")
        return json.loads(out[start:]) if start != -1 else None

    def get_requirement(self, id_):
        rows = self.query("requirements.list", "--filter", f"id={int(id_)}", "--include", "description",
                          "--include", "comments", "--include", "attachments", "--include", "project",
                          "--include", "scope", "--include", "technicalSolution", "--include", "acceptanceCriteria",
                          "--include", "responsiblePersons")
        if not rows:
            die(f"requirement {id_} does not exist in Jiku or you have no access to it", 3)
        return rows[0]

    def command(self, method, payload):
        body = json.dumps(payload, ensure_ascii=False)
        self._log(method, payload)
        if self.dry:
            print(f"[dry-run] jiku cmd {method} {body}")
            return {"status": "dry-run"}
        code, out, err = self._run(["cmd", method, "-"], stdin=body)
        if code != 0:
            print(f"error: jiku cmd {method} failed: {(err or out).strip()}")
            print(f"To retry: echo '{body}' | JIKU_VIA=agent jiku {' '.join(self._config_flags())} cmd {method} -")
            return None
        print(f"jiku cmd {method}: ok")
        try:
            return json.loads(out[out.find("{"):]) if "{" in out else {"status": "ok"}
        except ValueError:
            return {"status": "ok"}

    def _log(self, method, payload):
        with open(self.repo.tmp / "jiku-log.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps({"at": datetime.datetime.now().isoformat(timespec="seconds"), "method": method,
                                "dry_run": self.dry, "payload": payload}, ensure_ascii=False) + "\n")

    def my_person_id(self):
        code, out, _ = self._run(["whoami"])
        sub = next((l.split()[-1] for l in out.splitlines() if l.strip().startswith("subject")), None)
        if not sub:
            return None
        rows = self.query("people.list", "--filter", f"userId={sub}")
        return rows[0]["id"] if rows else None


# ---------- operations ----------

def fetch(repo, id_):
    j = Jiku(repo)
    r = j.get_requirement(id_)
    if j.project_id and r.get("projectId") != j.project_id:
        die(f"requirement {id_} belongs to project {r.get('projectId')} "
            f"({(r.get('project') or {}).get('name')}), not to project {j.project_id} of this repo", 3)
    lines = [f"# Jiku #{r['id']} — {r['title']}", "",
             f"- Project: {(r.get('project') or {}).get('name', '—')} ({r.get('projectId')})",
             f"- Type: {r.get('type') or '—'} · Priority: {r.get('priority')} · State: {r.get('state')}",
             f"- Visibility: {r.get('visibilityLevel')} · Created: {r.get('createdAt', '')[:10]}",
             f"- Responsible: {', '.join(p.get('firstName', '') + ' ' + p.get('lastName', '') for p in r.get('responsiblePersons') or []) or '—'}",
             "", "## Description (context)", "", r.get("description") or "—"]
    for k, title in FIELDS:
        if r.get(k):
            lines += ["", f"## {title} (in Jiku)", "", r[k]]
    comments = r.get("comments") or []
    names = {}
    authors = sorted({str(c.get("authorId")) for c in comments if c.get("authorId")})
    if authors:
        try:
            for p_ in j.query("people.list", "--filter", f"userId={','.join(authors)}") or []:
                names[str(p_.get("userId"))] = f"{p_.get('firstName', '')} {p_.get('lastName', '')}".strip()
        except SystemExit:
            pass
    lines += ["", f"## Comments ({len(comments)})", ""]
    for c in comments:
        who = names.get(str(c.get("authorId")), f"user {c.get('authorId')}")
        lines += [f"### {c.get('createdAt', '')[:16].replace('T', ' ')} — {who}", "",
                  c.get("body") or "", ""]
    if r.get("commentsTruncated"):
        lines.append("_(Jiku truncated the list of comments: see the requirement in Jiku)_")
    atts = r.get("attachments") or []
    if atts:
        lines += ["", "## Attachments", ""] + [f"- {a.get('fileName')} ({a.get('mimeType')}, id {a.get('fileId')})" for a in atts]
    p = repo.tmp / f"jiku-{int(id_)}.md"
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return p, r


SPEC_DRAFT, SPEC_READY = "draft", "ready"
# The line is written in the product language and read in English or Spanish.
SPEC_WORDS = {"es": ("Especificación", {"draft": "borrador", "ready": "lista"}),
              "en": ("Specification", {"draft": "draft", "ready": "ready"})}
SPEC_LINE_RE = __import__("re").compile(r"^(?:Especificación|Specification): (borrador|lista|draft|ready)\b[^\n]*$",
                                        __import__("re").M)


def spec_line(value, lang):
    """The line of the description that says whether the specification is a draft or ready."""
    label, words = SPEC_WORDS[structure(lang)]
    if value == SPEC_READY:
        return f"{label}: {words[SPEC_READY]} ({datetime.date.today().isoformat()})"
    return f"{label}: {words[SPEC_DRAFT]}"


def spec_status(row):
    """draft | ready, from the line «Specification: …» of the requirement's description; None if absent."""
    m = SPEC_LINE_RE.search(row.get("description") or "")
    if not m:
        return None
    return SPEC_READY if m.group(1) in ("lista", "ready") else SPEC_DRAFT


def with_spec_line(description, value, lang):
    """The description with its «Specification: …» line set (replaced, or appended at the end)."""
    text = (description or "").rstrip()
    if SPEC_LINE_RE.search(text):
        return SPEC_LINE_RE.sub(spec_line(value, lang), text, count=1)
    return f"{text}\n\n{spec_line(value, lang)}".lstrip()


def set_spec_status(repo, id_, value, row=None):
    """Set the «Specification: …» line of the requirement's description, keeping the rest of it."""
    j = Jiku(repo)
    row = row if row is not None else j.get_requirement(id_)
    return j.command(f"requirements.{int(id_)}.edit",
                     {"description": with_spec_line(row.get("description"), value, repo.language)})


def get_spec(repo, id_):
    """The specification as it is in Jiku now."""
    j = Jiku(repo)
    r = j.get_requirement(id_)
    meta = {k: r.get(k) for k in ("title", "type", "state", "projectId", "visibilityLevel")}
    meta["spec_status"] = spec_status(r)
    return Spec(id_, {k: r.get(k) for k, _ in FIELDS}, meta), r


def spec_from_copy(repo, id_):
    """The specification as the last `jiku fetch` left it in the working folder, or None. For reading
    when Jiku does not answer (an expired session): it may be older than Jiku."""
    import re
    p = repo.tmp / f"jiku-{int(id_)}.md"
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8")
    marks = [(m.start(), m.end(), m.group(1)) for m in
             re.finditer(r"^## (Scope|Proposal|Acceptance criteria) \(in Jiku\)\n", text, re.M)]
    end_all = re.search(r"^## Comments \(\d+\)$", text, re.M)
    stop = end_all.start() if end_all else len(text)
    keys = {t: k for k, t in FIELDS}
    fields = {}
    for i, (_, body_start, title) in enumerate(marks):
        body_end = marks[i + 1][0] if i + 1 < len(marks) else stop
        fields[keys[title]] = text[body_start:body_end].strip()
    return Spec(id_, fields, {"source": str(p)})


def write_spec(repo, id_, spec):
    """Write the three fields to the requirement. Never changes its state."""
    return Jiku(repo).command(f"requirements.{int(id_)}.edit", {k: spec.fields[k] or None for k, _ in FIELDS})


def open_requirements(repo):
    """The project's requirements that are still open, with their specification fields."""
    j = Jiku(repo)
    if not j.project_id:
        die("jiku.project_id is missing in _jflow/project.yaml")
    rows = j.query("requirements.list", "--filter", f"projectId={j.project_id}", "--all",
                   "--include", "scope", "--include", "technicalSolution", "--include", "acceptanceCriteria") or []
    return [r for r in rows if r.get("state") in OPEN_STATES]


class Reserved(dict):
    """{id: requirement} plus `depends`: {requirement: set of the requirements it depends on}."""
    depends = {}


def reserved_ids(repo, defn, exclude=None):
    """{id: requirement} for the definition IDs that open requirements introduce."""
    known = set(defn.all_ids())
    out = Reserved()
    out.depends = {}
    for r in open_requirements(repo):
        if exclude is not None and int(r["id"]) == int(exclude):
            continue
        sp = Spec(r["id"], {k: r.get(k) for k, _ in FIELDS})
        out.depends[int(r["id"])] = set(sp.depends())
        for i in sp.added_ids(known):
            out.setdefault(i, r["id"])
    return out


def set_state(repo, id_, state):
    if state not in AGENT_STATES:
        die(f"the agent only moves to {' or '.join(AGENT_STATES)}; «{state}» is for a person to decide")
    return Jiku(repo).command(f"requirements.{int(id_)}.edit", {"state": state})


def comment(repo, id_, text):
    return Jiku(repo).command(f"requirements.{int(id_)}.comment", {"comment": text, "visibilityLevel": "internal"})


def task(repo, id_, title, description=""):
    j = Jiku(repo)
    if not j.project_id:
        die("jiku.project_id is missing in _jflow/project.yaml")
    person = None if j.dry else j.my_person_id()
    payload = {"projectId": j.project_id, "requirementId": int(id_), "title": title, "area": "desarrollo",
               "state": "activo", "visibilityLevel": "internal",
               "responsiblePersonIds": [person] if person else []}
    if description:
        payload["description"] = description
    return j.command("tasks.new", payload)


def new_requirement(repo, title, description, type_="funcionalidad", state="analisis", fields=None,
                    visibility="internal"):
    """Create a requirement in the project. Returns its id (None in dry-run or on failure)."""
    j = Jiku(repo)
    if not j.project_id:
        die("jiku.project_id is missing in _jflow/project.yaml")
    if type_ not in TYPES:
        die(f"invalid type «{type_}» ({' | '.join(TYPES)})")
    payload = {"projectId": j.project_id, "title": title, "description": description, "type": type_,
               "state": state, "visibilityLevel": visibility}
    for k, v in (fields or {}).items():
        if v:
            payload[k] = v
    out = j.command("requirements.new", payload)
    return out.get("id") if isinstance(out, dict) else None


def list_requirements(repo, states=None):
    j = Jiku(repo)
    if not j.project_id:
        die("jiku.project_id is missing in _jflow/project.yaml")
    flags = ["--filter", f"projectId={j.project_id}", "--all", "--include", "acceptanceCriteria", "--include", "scope",
             "--include", "description"]
    if states:
        flags += ["--filter", f"state={states}"]
    return j.query("requirements.list", *flags)


# ---------- what is seen out of scope ----------

ORIGIN_RE = __import__("re").compile(r"^(?:Origen|Origin): #(\d+)", __import__("re").M)
OPEN_ISSUE_STATES = ("analisis", "planificacion", "en_cola", "desarrollo")


def origin_of(row):
    """The requirement an item was found in (`Origin: #N` in its description), or None."""
    m = ORIGIN_RE.search(row.get("description") or "")
    return int(m.group(1)) if m else None


def open_issues(rows):
    """Open incidencias of the project, oldest first."""
    return sorted((r for r in rows or [] if r.get("type") == "incidencia" and r.get("state") in OPEN_ISSUE_STATES),
                  key=lambda r: int(r["id"]))


def out_of_scope_path(repo, id_):
    return repo.tmp / f"out-of-scope-{int(id_)}.md"


def out_of_scope(repo, id_, skill, title=None, description="", type_="incidencia", to=None):
    """Record something seen while working on #id_ that is not its scope: a new requirement (an
    incidencia, or a funcionalidad/mejora for a postponed piece), or a comment on the requirement that
    already covers it (`to`). Appends a line to the requirement's out-of-scope list, which the MR text
    and the Jiku comment carry. Returns the line."""
    lang = repo.language
    origin = f"{say('Origin', lang)}: #{int(id_)} ({skill})"
    if to:
        since = "Desde" if structure(lang) == "es" else "From"
        comment(repo, to, f"{since} #{int(id_)} ({skill}):\n\n{description}")
        line = f"- #{int(to)} (comment): {(title or description).splitlines()[0][:120]}"
    else:
        if not title:
            die("--title is missing")
        rid = new_requirement(repo, title, f"{description.rstrip()}\n\n{origin}", type_, "analisis")
        line = f"- #{rid if rid else '?'} ({type_}): {title}"
    p = out_of_scope_path(repo, id_)
    with p.open("a", encoding="utf-8") as f:
        f.write(line + "\n")
    return line
