"""Read a closed discovery (_jflow/discovery/) into a model of the whole product, in the format of the
product definition. Nothing is written here: `plan.write_base_definition` writes the product-level part at bootstrap and
`plan.py` turns the rest into the Jiku requirements of the initial plan. What needs judgment is left as
a {{fill: ...}} marker for the agent. The discovery is in the product language: its structure is read in
English or Spanish (lang.canon) and written in English; its text is copied as it is, in the product
language. See .claude/specs/product-definition.md and .claude/specs/language.md."""

import re
import shutil

from .lang import canon, value
from .md import (Doc, bullets, dump_value, ids_in, prefix_of, render_table, sections, slugify,
                 table_dicts, table_with, tables)

O = "initial"
DOC_MAP = [
    ("blocks/index.md", "One block per line: prefix, name, surfaces, what it covers",
     "You need to find which block covers a feature"),
    ("blocks/{PREFIX}.md", "Requirements, failure conditions and examples of the block",
     "The task cites an ID `{PREFIX}-NN` or `{PREFIX}-EN`, or touches that block"),
    ("decisions.md", "Product and technical decisions, with what was rejected and why",
     "Any block, module or service is loaded (filtered by Affects)"),
    ("parameters.md", "Value and variable of each parameter", "A loaded file names a parameter in bold"),
    ("nfr.md", "Non-functional requirements", "A task on a surface or a service (filtered by Scope)"),
    ("out-of-scope.md", "What the product does not do", "Something new is defined"),
    ("domain/index.md", "One entity per line, with its tables", "You need to find an entity"),
    ("domain/glossary.md", "Domain terms", "Any block is loaded"),
    ("domain/{entity}.md", "Attributes, relationships, removal, states and transitions", "A loaded block names it in entities"),
    ("domain/invariants.md", "Rules that always hold", "One of its entities is touched"),
    ("architecture/services.md", "Services, modules and interactions", "You need to find where the code goes"),
    ("architecture/integration.md", "Persistence, communication and external integrations", "The task uses the database, a channel or an external system"),
    ("architecture/auth.md", "Credentials, their use and the roles", "The task authenticates or authorizes"),
    ("architecture/guarantees.md", "How each rule that always holds is kept", "A rule, an invariant or a module is touched"),
    ("architecture/testing.md", "How each entry point is tested end to end: test identities and replaced external systems", "Something is implemented (always when a requirement closes)"),
    ("../apis/", "Contracts of each service (OpenAPI, AsyncAPI)", "The task exposes or consumes an operation"),
    ("../db-schemas/", "Database schema of each service", "The task touches tables"),
    ("../flows/index.md", "Flows between modules and services", "The task crosses modules or depends on a guarantee"),
]


def fm(d):
    return "---\n" + "\n".join(f"{k}: {dump_value(v)}".rstrip() for k, v in d.items()) + "\n---\n\n"


def add_origin(header, rows):
    return header + ["Origin"], [r + [O] for r in rows]


def marked(lines, label):
    """Lines after a bold label (**Requirements**, in English or Spanish) until the next bold label or heading."""
    out, on = [], False
    for l in lines:
        s = l.strip()
        if s.startswith("**") and s.endswith("**") or s.startswith("**") and ":**" in s:
            if on:
                break
            if canon(s.strip("*").strip().rstrip(":")) == label.rstrip(":"):
                on = True
                continue
        if on:
            out.append(l)
    return out


def bold_value(lines, label):
    """The text after a bold label (`**Removal:** …`), the label in English or Spanish."""
    for l in lines:
        m = re.match(r"^\*\*(.+?):?\*\*:?\s*(.*)$", l.strip())
        if m and canon(m.group(1).strip().rstrip(":")) == label.rstrip(":"):
            return m.group(2).strip()
    return ""


def singular(t):
    for a, b in (("ies", "y"), ("sses", "ss"), ("xes", "x"), ("ches", "ch"), ("shes", "sh")):
        if t.endswith(a):
            return t[: -len(a)] + b
    return t[:-1] if t.endswith("s") and not t.endswith("ss") else t


def entity_pattern(name):
    """Case-insensitive, each word in singular or plural: «Cuenta de administrador» also matches
    «cuentas de administrador» and «cuentas de administradores»."""
    words = [re.escape(w) + ("(?:s|es)?" if len(w) > 3 else "") for w in name.split()]
    return r"(?i)\b" + r"\s+".join(words) + r"\b"


def strip_paren(s):
    return re.sub(r"\s*\(.*?\)", "", s).strip()


def build_model(repo):
    """(files, meta): files = {path relative to _jflow/: content} of the whole product as the definition
    would describe it; meta = the parsed pieces plan.py distributes."""
    disc = repo.discovery
    f = Doc(disc / "functional-analysis.md")
    d = Doc(disc / "domain-analysis.md")
    t = Doc(disc / "technical-analysis.md")
    schemas = [Doc(p) for p in sorted(disc.glob("db-schema-*.md"))]
    for x in [f, d, t, *schemas]:
        if x.front.get("status") != "closed":
            raise SystemExit(f"error: {repo.rel(x.path)} is not closed (status: closed)")

    out = {}
    fs, ds, ts = f.sections(), d.sections(), t.sections()

    # ---------- entities and their tables ----------
    entity_names = list(sections(ds.get("Entities", []), 3).keys())
    table_of, tables_of, describes = {}, {}, {}
    for s in schemas:
        for m in re.finditer(r"Table\s+(\w+)\s*\{(.*?)\n\}", s.body, re.S):
            note = re.search(r"Note:\s*'(?:Entidad|Entity):\s*(.+?)\s*—\s*(.*?)'", m.group(2))
            if note:
                ent = note.group(1).strip()
                tables_of.setdefault(ent, []).append(m.group(1))
                table_of.setdefault(ent, m.group(1))
                describes.setdefault(ent, re.split(r"[.;]\s", note.group(2))[0].strip().rstrip(".;"))
    file_of = {e: slugify(singular(table_of[e]).replace("_", "-")) if e in table_of else slugify(e)
               for e in entity_names}

    # ---------- services and surfaces ----------
    services = table_dicts(ts.get("Services", []), "Service")
    served_by = {}
    for s in services:
        for surf in [x.strip() for x in s.get("Surfaces", "").split(",")]:
            if surf and surf not in ("—", "-"):
                served_by[surf] = s["Service"]

    # ---------- index ----------
    resumen = " ".join(l.strip() for l in fs.get("Summary", []) if l.strip())
    m = re.match(r"\*\*(.+?)\*\*\s*—\s*(.*)", resumen)
    name, desc = (m.group(1), m.group(2)) if m else ("{{fill: name}}", resumen)
    h, rows = table_with(fs.get("Actors", []), "ID")
    actors = render_table(*add_origin(h, rows)) if h else ""
    h, rows = table_with(fs.get("Surfaces", []), "Surface")
    surf_rows = [r + [served_by.get(r[0], "{{fill: service}}"), O] for r in rows] if h else []
    k_plat = h.index("Platform") if h and "Platform" in h else None
    platforms = sorted({r[k_plat].strip().lower() for r in rows if k_plat is not None and k_plat < len(r)} - {""})
    surfaces = render_table(h + ["Service", "Origin"], surf_rows) if h else ""
    docmap = render_table(["Document", "Contains", "Load when"], [list(x) for x in DOC_MAP])
    out["prd/index.md"] = (f"# {name}\n\n{desc}\n\n## Actors\n\n{actors}\n\n## Surfaces\n\n{surfaces}\n\n"
                           f"## Documentation\n\nPaths are relative to `_jflow/prd/`. The context of a task is "
                           f"assembled with `python3 .claude/scripts/jflow.py load` (see the Product Definition spec).\n\n{docmap}\n")

    # ---------- blocks ----------
    blocks = sections(fs.get("Features", []), 3)
    block_names, meta_blocks = {}, {}
    for title, lines in blocks.items():
        pre = title.split(" ")[0]
        bname = title.split("—", 1)[1].strip() if "—" in title else title
        block_names[pre] = bname
        surf_raw = bold_value(lines, "Surface(s)")
        surfs = [] if surf_raw.startswith("—") else [strip_paren(x) for x in surf_raw.split(",") if x.strip()]
        text = "\n".join(lines)
        ents = [e for e in entity_names if re.search(entity_pattern(e), text)]
        req_h, req_rows = table_with(marked(lines, "Requirements"), "ID")
        fail_h, fail_rows = table_with(marked(lines, "Failure conditions"), "ID")
        conf_h, conf_rows = table_with(marked(lines, "Configurations"), "Configuration")
        examples = bullets(marked(lines, "Examples"))
        nonot = bullets(marked(lines, "Not notified"))
        ids_r = [r[0] for r in req_rows]
        ids_f = [r[0] for r in fail_rows]
        front = {"prefix": pre, "name": bname, "surfaces": surfs,
                 "covers": "{{fill: one line with the scope and responsibility of the block}}",
                 "entities": ents,
                 "last_requirement": ids_r[-1] if ids_r else "", "last_failure": ids_f[-1] if ids_f else ""}
        body = f"# {pre} — {bname}\n\n## Requirements\n\n"
        body += render_table(*add_origin(req_h, req_rows)) if req_h else "No requirements."
        if nonot:
            body += "\n\n## Not notified\n\n" + "\n".join(f"- {x}" for x in nonot)
        body += "\n\n## Failure conditions\n\n"
        body += render_table(*add_origin(fail_h, fail_rows)) if fail_h else "No failure conditions."
        if conf_h:
            body += "\n\n## Configurations\n\n" + render_table(*add_origin(conf_h, conf_rows))
        if examples:
            body += "\n\n## Examples\n\n" + "\n".join(f"- {x}" for x in examples)
        out[f"prd/blocks/{pre}.md"] = fm(front) + body + "\n"
        meta_blocks[pre] = {"name": bname, "surfaces": surfs, "entities": ents, "text": text,
                            "req": [dict(zip(req_h, r)) for r in req_rows] if req_h else [],
                            "fail": [dict(zip(fail_h, r)) for r in fail_rows] if fail_h else [],
                            "header": req_h or []}

    # ---------- parameters ----------
    rows = table_dicts(fs.get("Parameters", []), "Parameter")
    prow = []
    for r in rows:
        ed = value(r.get("Editable by a user?", "no"))
        var = "{{fill: VARIABLE=value}}" if ed in ("no", "") else f"— (edited by {r.get('Editable by a user?')})"
        prow.append([r["Parameter"], r["Value"], var, O])
    out["prd/parameters.md"] = ("# Parameters\n\nValues of business rules, cited by name in bold. "
                                "The variable is the environment one, with its default value.\n\n"
                                + render_table(["Parameter", "Value", "Variable", "Origin"], prow) + "\n")

    # ---------- decisions ----------
    def dec_rows(section):
        return [[r.get("ID", ""), r.get("Topic", ""), r.get("Decision", ""), r.get("Rejected", ""),
                 r.get("Reason", "").strip() or "—", r.get("Affects", ""), O] for r in table_dicts(section, "ID")]
    hdr = ["ID", "Topic", "Decision", "Rejected", "Reason", "Affects", "Origin"]
    out["prd/decisions.md"] = (
        "# Decisions\n\nWhat was chosen on purpose over an alternative. A requirement that changes a "
        "decision reverts it explicitly.\n\n## Product\n\n"
        + render_table(hdr, dec_rows(fs.get("Decisions taken", []))) + "\n\n## Technical\n\n"
        + render_table(hdr, dec_rows(ts.get("Technical decisions", []))) + "\n\n## Reverted\n\n"
        + render_table(["ID", "Topic", "Said", "Reverted by", "Reason", "Now"], []) + "\n")

    # ---------- NFR ----------
    nfr_meta = [[r["ID"], r.get("Category", ""), r.get("Requirement", ""), r.get("Target", "")]
                for r in table_dicts(fs.get("Non-functional requirements", []), "ID")]
    nrows = [n + ["product", "{{fill: test / alert / review, from the base specification}}",
                  "{{fill: base / #id of the part / —}}", O] for n in nfr_meta]
    out["prd/nfr.md"] = ("# Non-functional requirements\n\nScope: `product`, a surface or a service. "
                         "Verification: `test` (a test, in the requirement named in «Tested in»), `alert` (in the "
                         "operations guide) or `review` (the verifier checks it).\n\n"
                         + render_table(["ID", "Category", "Requirement", "Target", "Scope", "Verification", "Tested in",
                                         "Origin"], nrows) + "\n")

    # ---------- out of scope ----------
    oos = bullets(fs.get("Out of scope", []))
    out["prd/out-of-scope.md"] = ("# Out of scope\n\nWhat the product does not do.\n\n"
                                  + render_table(["Out of scope", "Origin"], [[x, O] for x in oos]) + "\n")

    # ---------- domain ----------
    h, rows = table_with(ds.get("Glossary", []), "Term")
    out["prd/domain/glossary.md"] = "# Glossary\n\n" + (render_table(*add_origin(h, rows)) if h else "") + "\n"
    states = sections(ds.get("States", []), 3)
    for e, lines in sections(ds.get("Entities", []), 3).items():
        front = {"entity": e, "tables": tables_of.get(e, []), "describes": describes.get(e, "{{fill: what it is}}")}
        h, rows = table_with(lines, "Attribute")
        body = f"# {e}\n\n## Attributes\n\n" + (render_table(*add_origin(h, rows)) if h else "")
        dh, drows = table_with(marked(lines, "Derived attributes"), "Attribute")
        if dh:
            body += "\n\n## Derived attributes\n\n" + render_table(*add_origin(dh, drows))
        rel = bold_value(lines, "Relationships")
        baja = bold_value(lines, "Removal")
        body += f"\n\n## Relationships\n\n{rel}\n\n## Removal\n\n{baja}"
        if e in states:
            sh, srows = table_with(marked(states[e], "States"), "State")
            th, trows = table_with(marked(states[e], "Transitions"), "From")
            if sh:
                body += "\n\n## States\n\n" + render_table(*add_origin(sh, srows))
            if th:
                body += "\n\n## Transitions\n\n" + render_table(*add_origin(th, trows))
        out[f"prd/domain/{file_of[e]}.md"] = fm(front) + body + "\n"
    irows = []
    for r in table_dicts(ds.get("Invariants", []), "ID"):
        pres = sorted({prefix_of(x) for x in ids_in(r.get("Applied in", "")) if prefix_of(x) in block_names})
        irows.append([r["ID"], r.get("Rule", ""), r.get("Entities", ""), ", ".join(pres), O])
    out["prd/domain/invariants.md"] = ("# Invariants\n\nRules on the data that always hold. How each one "
                                       "is kept is in `architecture/guarantees.md`.\n\n"
                                       + render_table(["ID", "Rule", "Entities", "Applied in", "Origin"], irows) + "\n")

    # ---------- architecture: services ----------
    srows = [[s["Service"], s.get("Type", ""), s.get("Language", ""), s.get("Surfaces", ""), s.get("Exposes", ""),
              f"services/{s['Service']}", O] for s in services]
    body = "# Services and modules\n\n## Services\n\n" + render_table(
        ["Service", "Type", "Language", "Surfaces", "Exposes", "Folder", "Origin"], srows) + "\n\n## Modules\n"
    inter_rows, module_rows = [], {}
    for svc, lines in sections(ts.get("Modules", []), 3).items():
        mrows = [[r["Module"], r.get("Entities", ""),
                  "{{fill: responsibility in one line}}", O] for r in table_dicts(lines, "Module")]
        module_rows[svc] = mrows
        body += f"\n### {svc}\n\n" + render_table(["Module", "Entities", "Responsibility", "Origin"], mrows) + "\n"
        for r in table_dicts(marked(lines, "Interactions"), "From → To"):
            a, _, b = r["From → To"].partition("→")
            pres = sorted({prefix_of(x) for x in ids_in(r.get("Requirement", "")) if prefix_of(x) in block_names})
            inter_rows.append([f"{svc}.{a.strip()} → {svc}.{b.strip()}", r.get("Purpose", ""), ", ".join(pres), O])
    body += "\n## Interactions\n\n" + render_table(["From → To", "Purpose", "Blocks", "Origin"], inter_rows) + "\n"
    out["prd/architecture/services.md"] = body

    # ---------- architecture: integration ----------
    prow_infra = [[r["Component"], r.get("Technology", ""), r.get("Owner", ""), r.get("Used by", ""), O]
                  for r in table_dicts(ts.get("Persistence and infrastructure", []), "Component")]
    crow = [[r["From → To"], r.get("Protocol", ""), r.get("Type", ""), r.get("Purpose", ""), O]
            for r in table_dicts(ts.get("Communication", []), "From → To")]
    erow = [[r["Event"], r.get("Publishes", ""), r.get("Consumes", ""), r.get("Transition", ""), O]
            for r in table_dicts(marked(ts.get("Communication", []), "Events"), "Event")]
    integ = table_dicts(fs.get("External integrations", []), "ID")
    irow = [[r["ID"], r.get("System", ""), r.get("Direction", ""), r.get("Data", ""), r.get("When", ""),
             r.get("Source of truth", ""), "—", O] for r in integ]
    body = ("# Integration\n\n## Persistence and infrastructure\n\n"
            + render_table(["Component", "Technology", "Owner", "Used by", "Origin"], prow_infra)
            + "\n\n## Communication\n\n" + render_table(["From → To", "Protocol", "Type", "Purpose", "Origin"], crow))
    if erow:
        body += "\n\n## Events\n\n" + render_table(["Event", "Publishes", "Consumes", "Transition", "Origin"], erow)
    body += "\n\n## External integrations\n\n" + (render_table(
        ["ID", "System", "Direction", "Data", "When", "Source of truth", "Reference", "Origin"], irow)
        if irow else "No external integrations.") + "\n"
    out["prd/architecture/integration.md"] = body

    # ---------- architecture: auth ----------
    auth = ts.get("Authentication and authorization", [])
    sub = sections(auth, 3)
    if "Credentials" in sub:
        body = "# Authentication and authorization\n"
        for title, first in (("Credentials", "ID"), ("Use", "Credential"), ("Roles", "Role"),
                             ("External identity providers", "Provider")):
            h, rows = table_with(sub.get(title, []), first)
            if h:
                body += f"\n## {title}\n\n" + render_table(*add_origin(h, rows)) + "\n"
        out["prd/architecture/auth.md"] = body
    else:
        old = "\n".join(auth).strip()
        out["prd/architecture/auth.md"] = (
            "# Authentication and authorization\n\n{{fill: the discovery uses the previous format (a table per actor). "
            "Turn it into the Credentials, Use and Roles tables of the Product Definition spec, without adding "
            "definitions: only reorganize what this text says, and delete this block}}\n\n"
            "```text\n" + old + "\n```\n\n## Credentials\n\n"
            + render_table(["ID", "Credential", "Issuer", "Obtained", "Lifetime and renewal", "Revocation", "Origin"], [])
            + "\n\n## Use\n\n" + render_table(["Credential", "Role", "From", "Passes through", "Verifies", "Origin"], [])
            + "\n\n## Roles\n\n" + render_table(["Role", "Actors", "Allows", "Origin"], []) + "\n")

    # ---------- architecture: guarantees ----------
    grows = []
    for i, r in enumerate(table_dicts(ts.get("Guarantees", []), "Rule"), 1):
        rule = r["Rule"]
        found = ids_in(rule)
        label = rule
        for x in found:
            label = label.replace(x, "")
        label = re.sub(r"^[\s,.]+|\b\.\.\w+", "", re.sub(r"\.\.[A-Z]?\d+", "", label)).strip(" ,") or rule
        label = re.sub(r"\s*\(\s*[,;\s]*\)", "", label).strip(" ,") or rule  # parentheses left empty by the IDs
        where = r.get("Where", "")
        where = re.sub(r"\bBase principal\b", "Base principal", where)
        grows.append([f"GAR-{i:02d}", label, ", ".join(found) or "—", r.get("Mechanism", ""), where, O])
    out["prd/architecture/guarantees.md"] = (
        "# Guarantees\n\nHow each rule that must always hold is kept. Every guarantee of a built block "
        "has a test with its ID.\n\n"
        + render_table(["ID", "Guarantee", "Rule", "Mechanism", "Where", "Origin"], grows) + "\n")

    # ---------- schemas ----------
    for s in schemas:
        svc = s.front.get("service") or s.path.stem.replace("db-schema-", "")
        front = {"service": svc, "source": f"_jflow/discovery/{s.path.name}"}
        out[f"db-schemas/{svc}.md"] = fm(front) + s.body.lstrip()

    # ---------- flows ----------
    flow_meta = {}
    for title, lines in sections(ts.get("Key flows", []), 3).items():
        fname = re.sub(r"\s*\(.*\)\s*$", "", title).strip()
        req = ids_in(title)
        text = "\n".join(lines)
        mods = sorted(set(re.findall(r"\b([a-z][\w-]*\.[a-z][\w-]*)\b", text)) - {"e.g", "i.e"})
        desc, steps = [], []
        for l in lines:
            m2 = re.match(r"^\s*(\d+)\.\s+(.*)$", l)
            if m2:
                steps.append([m2.group(1), m2.group(2)])
            elif l.strip() and not steps:
                desc.append(l.strip())
            elif l.strip() and steps:
                steps[-1][1] += " " + l.strip()
        srows = []
        for n, s_ in steps:
            head, sep, rest = s_.partition(":")
            if not sep:
                head, rest = "", s_
            srows.append([n, head.strip() or "—", rest.strip(), "—", ", ".join(ids_in(rest)) or "—"])
        front = {"flow": slugify(fname), "requirements": req, "modules": mods}
        out[f"flows/{slugify(fname)}.md"] = (fm(front) + f"# {fname}\n\n{' '.join(desc)}\n\n"
                                             + render_table(["#", "From → To", "What happens", "Operation / table", "Rules"], srows) + "\n")
        flow_meta[f"flows/{slugify(fname)}.md"] = {"name": fname, "requirements": req, "modules": mods,
                                                   "ids": sorted(set(req) | set(ids_in(text)))}

    meta = {
        "name": name, "blocks": meta_blocks, "entity_file": file_of, "tables_of": tables_of,
        "decisions": {"prod": dec_rows(fs.get("Decisions taken", [])), "tech": dec_rows(ts.get("Technical decisions", []))},
        "decision_header": hdr,
        "parameters": prow, "invariants": irows, "guarantees": grows, "services": services,
        "interactions": inter_rows, "integrations": irow, "persistence": prow_infra, "communication": crow,
        "events": erow, "schemas": {(x.front.get("service") or x.path.stem.replace("db-schema-", "")): x for x in schemas},
        "flows": flow_meta, "modules": module_rows, "platforms": platforms, "nfrs": nfr_meta,
    }
    return out, meta
