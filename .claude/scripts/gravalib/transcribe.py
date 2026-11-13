"""Read a closed discovery (_gflow/discovery/) into a model of the whole product, in the format of the
product definition. Nothing is written here: `base.py` writes the product-level part at bootstrap and
`plan.py` turns the rest into the Jiku requirements of the initial plan. What needs judgment is left as
a {{completar: ...}} marker for the agent. See .claude/specs/product-definition.md."""

import re
import shutil

from .md import (Doc, bullets, dump_value, ids_in, prefix_of, render_table, sections, slugify,
                 table_dicts, table_with, tables)

O = "inicial"
DOC_MAP = [
    ("blocks/index.md", "Un bloque por línea: prefijo, nombre, estado, superficies, qué cubre",
     "Hay que ubicar qué bloque cubre una funcionalidad"),
    ("blocks/{PREFIJO}.md", "Requisitos, condiciones de falla y ejemplos del bloque",
     "La tarea cita un ID `{PREFIJO}-NN` o `{PREFIJO}-EN`, o toca ese bloque"),
    ("decisions.md", "Decisiones de producto y técnicas, con lo descartado y su motivo",
     "Se carga cualquier bloque, módulo o servicio (filtrado por Afecta)"),
    ("parameters.md", "Valor y variable de cada parámetro", "Un archivo cargado nombra un parámetro en negrita"),
    ("nfr.md", "Requisitos no funcionales", "Tarea de una superficie o un servicio (filtrado por Alcance)"),
    ("out-of-scope.md", "Lo que el producto no hace", "Se define algo nuevo"),
    ("domain/index.md", "Una entidad por línea, con sus tablas", "Hay que ubicar una entidad"),
    ("domain/glossary.md", "Términos del dominio", "Se carga cualquier bloque"),
    ("domain/{entidad}.md", "Atributos, relaciones, baja, estados y transiciones", "Un bloque cargado la nombra en entities"),
    ("domain/invariants.md", "Reglas que valen siempre", "Se toca una de sus entidades"),
    ("architecture/services.md", "Servicios, módulos e interacciones", "Hay que ubicar dónde va el código"),
    ("architecture/integration.md", "Persistencia, comunicación e integraciones externas", "La tarea usa la base, un canal o un sistema externo"),
    ("architecture/auth.md", "Credenciales, su uso y los roles", "La tarea autentica o autoriza"),
    ("architecture/guarantees.md", "Cómo se cumple cada regla que vale siempre", "Se toca una regla, un invariante o un módulo"),
    ("../apis/", "Contratos de cada servicio (OpenAPI, AsyncAPI)", "La tarea expone o consume una operación"),
    ("../db-schemas/", "Esquema de base de cada servicio", "La tarea toca tablas"),
    ("../flows/index.md", "Flujos entre módulos y servicios", "La tarea cruza módulos o depende de una garantía"),
]


def fm(d):
    return "---\n" + "\n".join(f"{k}: {dump_value(v)}".rstrip() for k, v in d.items()) + "\n---\n\n"


def add_origin(header, rows):
    return header + ["Origen"], [r + [O] for r in rows]


def marked(lines, label):
    """Lines after a bold label (**Requisitos**) until the next bold label or heading."""
    out, on = [], False
    for l in lines:
        s = l.strip()
        if s.startswith("**") and s.endswith("**") or s.startswith("**") and ":**" in s:
            if on:
                break
            if s.strip("*").strip().rstrip(":") == label:
                on = True
                continue
        if on:
            out.append(l)
    return out


def bold_value(lines, label):
    for l in lines:
        if l.strip().startswith(f"**{label}"):
            return l.split("**", 2)[2].strip()
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
    """(files, meta): files = {path relative to _gflow/: content} of the whole product as the definition
    would describe it; meta = the parsed pieces plan.py and base.py distribute."""
    disc = repo.discovery
    f = Doc(disc / "functional-analysis.md")
    d = Doc(disc / "domain-analysis.md")
    t = Doc(disc / "technical-analysis.md")
    schemas = [Doc(p) for p in sorted(disc.glob("db-schema-*.md"))]
    for x in [f, d, t, *schemas]:
        if x.front.get("status") != "closed":
            raise SystemExit(f"error: {repo.rel(x.path)} no está cerrado (status: closed)")

    out = {}
    fs, ds, ts = f.sections(), d.sections(), t.sections()

    # ---------- entities and their tables ----------
    entity_names = list(sections(ds.get("Entidades", []), 3).keys())
    table_of, tables_of, describes = {}, {}, {}
    for s in schemas:
        for m in re.finditer(r"Table\s+(\w+)\s*\{(.*?)\n\}", s.body, re.S):
            note = re.search(r"Note:\s*'Entidad:\s*(.+?)\s*—\s*(.*?)'", m.group(2))
            if note:
                ent = note.group(1).strip()
                tables_of.setdefault(ent, []).append(m.group(1))
                table_of.setdefault(ent, m.group(1))
                describes.setdefault(ent, re.split(r"[.;]\s", note.group(2))[0].strip().rstrip(".;"))
    file_of = {e: slugify(singular(table_of[e]).replace("_", "-")) if e in table_of else slugify(e)
               for e in entity_names}

    # ---------- services and surfaces ----------
    services = table_dicts(ts.get("Servicios", []), "Servicio")
    served_by = {}
    for s in services:
        for surf in [x.strip() for x in s.get("Superficies", "").split(",")]:
            if surf and surf not in ("—", "-"):
                served_by[surf] = s["Servicio"]

    # ---------- index ----------
    resumen = " ".join(l.strip() for l in fs.get("Resumen", []) if l.strip())
    m = re.match(r"\*\*(.+?)\*\*\s*—\s*(.*)", resumen)
    name, desc = (m.group(1), m.group(2)) if m else ("{{completar: nombre}}", resumen)
    h, rows = table_with(fs.get("Actores", []), "ID")
    actors = render_table(*add_origin(h, rows)) if h else ""
    h, rows = table_with(fs.get("Superficies", []), "Superficie")
    surf_rows = [r + [served_by.get(r[0], "{{completar: servicio}}"), O] for r in rows] if h else []
    k_plat = h.index("Plataforma") if h and "Plataforma" in h else None
    platforms = sorted({r[k_plat].strip().lower() for r in rows if k_plat is not None and k_plat < len(r)} - {""})
    surfaces = render_table(h + ["Servicio", "Origen"], surf_rows) if h else ""
    docmap = render_table(["Documento", "Contiene", "Cargar cuando"], [list(x) for x in DOC_MAP])
    out["prd/index.md"] = (f"# {name}\n\n{desc}\n\n## Actores\n\n{actors}\n\n## Superficies\n\n{surfaces}\n\n"
                           f"## Documentación\n\nLas rutas son relativas a `_gflow/prd/`. El contexto de una tarea se "
                           f"arma con `python3 .claude/scripts/grava.py load` (ver la spec Product Definition).\n\n{docmap}\n")

    # ---------- blocks ----------
    blocks = sections(fs.get("Funcionalidades", []), 3)
    block_names, meta_blocks = {}, {}
    for title, lines in blocks.items():
        pre = title.split(" ")[0]
        bname = title.split("—", 1)[1].strip() if "—" in title else title
        block_names[pre] = bname
        surf_raw = bold_value(lines, "Superficie(s):")
        surfs = [] if surf_raw.startswith("—") else [strip_paren(x) for x in surf_raw.split(",") if x.strip()]
        text = "\n".join(lines)
        ents = [e for e in entity_names if re.search(entity_pattern(e), text)]
        req_h, req_rows = table_with(marked(lines, "Requisitos"), "ID")
        fail_h, fail_rows = table_with(marked(lines, "Condiciones de falla"), "ID")
        conf_h, conf_rows = table_with(marked(lines, "Configuraciones"), "Configuración")
        examples = bullets(marked(lines, "Ejemplos"))
        nonot = bullets(marked(lines, "No se notifica:"))
        ids_r = [r[0] for r in req_rows]
        ids_f = [r[0] for r in fail_rows]
        front = {"prefix": pre, "name": bname, "surfaces": surfs,
                 "covers": "{{completar: una línea con el alcance y la responsabilidad del bloque}}",
                 "entities": ents,
                 "last_requirement": ids_r[-1] if ids_r else "", "last_failure": ids_f[-1] if ids_f else ""}
        body = f"# {pre} — {bname}\n\n## Requisitos\n\n"
        body += render_table(*add_origin(req_h, req_rows)) if req_h else "Sin requisitos."
        if nonot:
            body += "\n\n## No se notifica\n\n" + "\n".join(f"- {x}" for x in nonot)
        body += "\n\n## Condiciones de falla\n\n"
        body += render_table(*add_origin(fail_h, fail_rows)) if fail_h else "Sin condiciones de falla."
        if conf_h:
            body += "\n\n## Configuraciones\n\n" + render_table(*add_origin(conf_h, conf_rows))
        if examples:
            body += "\n\n## Ejemplos\n\n" + "\n".join(f"- {x}" for x in examples)
        out[f"prd/blocks/{pre}.md"] = fm(front) + body + "\n"
        meta_blocks[pre] = {"name": bname, "surfaces": surfs, "entities": ents, "text": text,
                            "req": [dict(zip(req_h, r)) for r in req_rows] if req_h else [],
                            "fail": [dict(zip(fail_h, r)) for r in fail_rows] if fail_h else [],
                            "header": req_h or []}

    # ---------- parameters ----------
    rows = table_dicts(fs.get("Parámetros", []), "Parámetro")
    prow = []
    for r in rows:
        ed = r.get("¿Editable por un usuario?", "no").strip().lower()
        var = "{{completar: VARIABLE=valor}}" if ed in ("no", "") else f"— (lo edita {r.get('¿Editable por un usuario?')})"
        prow.append([r["Parámetro"], r["Valor"], var, O])
    out["prd/parameters.md"] = ("# Parámetros\n\nValores de reglas de negocio, citados por nombre en negrita. "
                                "La variable es la de entorno, con su valor por defecto.\n\n"
                                + render_table(["Parámetro", "Valor", "Variable", "Origen"], prow) + "\n")

    # ---------- decisions ----------
    def dec_rows(section):
        return [[r.get("ID", ""), r.get("Tema", ""), r.get("Decisión", ""), r.get("Descartado", ""),
                 r.get("Motivo", "").strip() or "—", r.get("Afecta", ""), O] for r in table_dicts(section, "ID")]
    hdr = ["ID", "Tema", "Decisión", "Descartado", "Motivo", "Afecta", "Origen"]
    out["prd/decisions.md"] = (
        "# Decisiones\n\nLo que se eligió a propósito frente a una alternativa. Un requisito que cambia una "
        "decisión la revierte explícitamente.\n\n## De producto\n\n"
        + render_table(hdr, dec_rows(fs.get("Decisiones tomadas", []))) + "\n\n## Técnicas\n\n"
        + render_table(hdr, dec_rows(ts.get("Decisiones técnicas", []))) + "\n\n## Revertidas\n\n"
        + render_table(["ID", "Tema", "Decía", "Revertida por", "Motivo", "Ahora"], []) + "\n")

    # ---------- NFR ----------
    nfr_meta = [[r["ID"], r.get("Categoría", ""), r.get("Requisito", ""), r.get("Target", "")]
                for r in table_dicts(fs.get("Requisitos no funcionales", []), "ID")]
    nrows = [n + ["producto", "{{completar: prueba | alerta | revisión, de la especificación del base}}",
                  "{{completar: base | #id de la parte | —}}", O] for n in nfr_meta]
    out["prd/nfr.md"] = ("# Requisitos no funcionales\n\nAlcance: `producto`, una superficie o un servicio. "
                         "Verificación: `prueba` (un test, en el requisito de «Prueba en»), `alerta` (en "
                         "`docs/operacion.md`) o `revisión` (la mira el verificador).\n\n"
                         + render_table(["ID", "Categoría", "Requisito", "Target", "Alcance", "Verificación", "Prueba en",
                                         "Origen"], nrows) + "\n")

    # ---------- out of scope ----------
    oos = bullets(fs.get("Fuera de alcance", []))
    out["prd/out-of-scope.md"] = ("# Fuera de alcance\n\nLo que el producto no hace.\n\n"
                                  + render_table(["Fuera de alcance", "Origen"], [[x, O] for x in oos]) + "\n")

    # ---------- domain ----------
    h, rows = table_with(ds.get("Glosario", []), "Término")
    out["prd/domain/glossary.md"] = "# Glosario\n\n" + (render_table(*add_origin(h, rows)) if h else "") + "\n"
    states = sections(ds.get("Estados", []), 3)
    for e, lines in sections(ds.get("Entidades", []), 3).items():
        front = {"entity": e, "tables": tables_of.get(e, []), "describes": describes.get(e, "{{completar: qué es}}")}
        h, rows = table_with(lines, "Atributo")
        body = f"# {e}\n\n## Atributos\n\n" + (render_table(*add_origin(h, rows)) if h else "")
        dh, drows = table_with(marked(lines, "Atributos derivados"), "Atributo")
        if dh:
            body += "\n\n## Atributos derivados\n\n" + render_table(*add_origin(dh, drows))
        rel = bold_value(lines, "Relaciones:")
        baja = bold_value(lines, "Baja:")
        body += f"\n\n## Relaciones\n\n{rel}\n\n## Baja\n\n{baja}"
        if e in states:
            sh, srows = table_with(marked(states[e], "Estados"), "Estado")
            th, trows = table_with(marked(states[e], "Transiciones"), "Desde")
            if sh:
                body += "\n\n## Estados\n\n" + render_table(*add_origin(sh, srows))
            if th:
                body += "\n\n## Transiciones\n\n" + render_table(*add_origin(th, trows))
        out[f"prd/domain/{file_of[e]}.md"] = fm(front) + body + "\n"
    irows = []
    for r in table_dicts(ds.get("Invariantes", []), "ID"):
        pres = sorted({prefix_of(x) for x in ids_in(r.get("Aplicada en", "")) if prefix_of(x) in block_names})
        irows.append([r["ID"], r.get("Regla", ""), r.get("Entidades", ""), ", ".join(pres), O])
    out["prd/domain/invariants.md"] = ("# Invariantes\n\nReglas sobre los datos que valen siempre. Cómo se "
                                       "cumple cada una está en `architecture/guarantees.md`.\n\n"
                                       + render_table(["ID", "Regla", "Entidades", "Aplicada en", "Origen"], irows) + "\n")

    # ---------- architecture: services ----------
    srows = [[s["Servicio"], s.get("Tipo", ""), s.get("Lenguaje", ""), s.get("Superficies", ""), s.get("Expone", ""),
              f"services/{s['Servicio']}", O] for s in services]
    body = "# Servicios y módulos\n\n## Servicios\n\n" + render_table(
        ["Servicio", "Tipo", "Lenguaje", "Superficies", "Expone", "Carpeta", "Origen"], srows) + "\n\n## Módulos\n"
    inter_rows, module_rows = [], {}
    for svc, lines in sections(ts.get("Módulos", []), 3).items():
        mrows = [[r["Módulo"], r.get("Entidades", ""),
                  "{{completar: responsabilidad en una línea}}", O] for r in table_dicts(lines, "Módulo")]
        module_rows[svc] = mrows
        body += f"\n### {svc}\n\n" + render_table(["Módulo", "Entidades", "Responsabilidad", "Origen"], mrows) + "\n"
        for r in table_dicts(marked(lines, "Interacciones"), "De → A"):
            a, _, b = r["De → A"].partition("→")
            pres = sorted({prefix_of(x) for x in ids_in(r.get("Requisito", "")) if prefix_of(x) in block_names})
            inter_rows.append([f"{svc}.{a.strip()} → {svc}.{b.strip()}", r.get("Para qué", ""), ", ".join(pres), O])
    body += "\n## Interacciones\n\n" + render_table(["De → A", "Para qué", "Bloques", "Origen"], inter_rows) + "\n"
    out["prd/architecture/services.md"] = body

    # ---------- architecture: integration ----------
    prow_infra = [[r["Componente"], r.get("Tecnología", ""), r.get("Dueño", ""), r.get("Usado por", ""), O]
                  for r in table_dicts(ts.get("Persistencia e infraestructura", []), "Componente")]
    crow = [[r["De → A"], r.get("Protocolo", ""), r.get("Tipo", ""), r.get("Para qué", ""), O]
            for r in table_dicts(ts.get("Comunicación", []), "De → A")]
    erow = [[r["Evento"], r.get("Publica", ""), r.get("Consume", ""), r.get("Transición", ""), O]
            for r in table_dicts(marked(ts.get("Comunicación", []), "Eventos"), "Evento")]
    integ = table_dicts(fs.get("Integraciones externas", []), "ID")
    irow = [[r["ID"], r.get("Sistema", ""), r.get("Dirección", ""), r.get("Datos", ""), r.get("Cuándo", ""),
             r.get("Fuente de verdad", ""), "—", O] for r in integ]
    body = ("# Integración\n\n## Persistencia e infraestructura\n\n"
            + render_table(["Componente", "Tecnología", "Dueño", "Usado por", "Origen"], prow_infra)
            + "\n\n## Comunicación\n\n" + render_table(["De → A", "Protocolo", "Tipo", "Para qué", "Origen"], crow))
    if erow:
        body += "\n\n## Eventos\n\n" + render_table(["Evento", "Publica", "Consume", "Transición", "Origen"], erow)
    body += "\n\n## Integraciones externas\n\n" + (render_table(
        ["ID", "Sistema", "Dirección", "Datos", "Cuándo", "Fuente de verdad", "Referencia", "Origen"], irow)
        if irow else "No hay integraciones externas.") + "\n"
    out["prd/architecture/integration.md"] = body

    # ---------- architecture: auth ----------
    auth = ts.get("Autenticación y autorización", [])
    sub = sections(auth, 3)
    if "Credenciales" in sub:
        body = "# Autenticación y autorización\n"
        for title, first in (("Credenciales", "ID"), ("Uso", "Credencial"), ("Roles", "Rol"),
                             ("Proveedores externos de identidad", "Proveedor")):
            h, rows = table_with(sub.get(title, []), first)
            if h:
                body += f"\n## {title}\n\n" + render_table(*add_origin(h, rows)) + "\n"
        out["prd/architecture/auth.md"] = body
    else:
        old = "\n".join(auth).strip()
        out["prd/architecture/auth.md"] = (
            "# Autenticación y autorización\n\n{{completar: el discovery usa el formato anterior (tabla por actor). "
            "Convertirlo a las tablas Credenciales, Uso y Roles de la spec Product Definition, sin agregar "
            "definiciones: solo reorganizar lo que dice este texto, y borrar este bloque}}\n\n"
            "```text\n" + old + "\n```\n\n## Credenciales\n\n"
            + render_table(["ID", "Credencial", "Emisor", "Se obtiene", "Vida y renovación", "Revocación", "Origen"], [])
            + "\n\n## Uso\n\n" + render_table(["Credencial", "Rol", "Desde", "Pasa por", "Verifica", "Origen"], [])
            + "\n\n## Roles\n\n" + render_table(["Rol", "Actores", "Permite", "Origen"], []) + "\n")

    # ---------- architecture: guarantees ----------
    grows = []
    for i, r in enumerate(table_dicts(ts.get("Garantías", []), "Regla"), 1):
        rule = r["Regla"]
        found = ids_in(rule)
        label = rule
        for x in found:
            label = label.replace(x, "")
        label = re.sub(r"^[\s,.]+|\b\.\.\w+", "", re.sub(r"\.\.[A-Z]?\d+", "", label)).strip(" ,") or rule
        label = re.sub(r"\s*\(\s*[,;\s]*\)", "", label).strip(" ,") or rule  # parentheses left empty by the IDs
        where = r.get("Dónde", "")
        where = re.sub(r"\bBase principal\b", "Base principal", where)
        grows.append([f"GAR-{i:02d}", label, ", ".join(found) or "—", r.get("Mecanismo", ""), where, O])
    out["prd/architecture/guarantees.md"] = (
        "# Garantías\n\nCómo se cumple cada regla que tiene que valer siempre. Cada garantía de un bloque "
        "construido tiene un test con su ID.\n\n"
        + render_table(["ID", "Garantía", "Regla", "Mecanismo", "Dónde", "Origen"], grows) + "\n")

    # ---------- schemas ----------
    for s in schemas:
        svc = s.front.get("service") or s.path.stem.replace("db-schema-", "")
        front = {"service": svc, "source": f"_gflow/discovery/{s.path.name}"}
        out[f"db-schemas/{svc}.md"] = fm(front) + s.body.lstrip()

    # ---------- flows ----------
    flow_meta = {}
    for title, lines in sections(ts.get("Flujos clave", []), 3).items():
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
                                             + render_table(["#", "Desde → Hacia", "Qué pasa", "Operación / tabla", "Reglas"], srows) + "\n")
        flow_meta[f"flows/{slugify(fname)}.md"] = {"name": fname, "requirements": req, "modules": mods,
                                                   "ids": sorted(set(req) | set(ids_in(text)))}

    meta = {
        "name": name, "blocks": meta_blocks, "entity_file": file_of, "tables_of": tables_of,
        "decisions": {"prod": dec_rows(fs.get("Decisiones tomadas", [])), "tech": dec_rows(ts.get("Decisiones técnicas", []))},
        "decision_header": hdr,
        "parameters": prow, "invariants": irows, "guarantees": grows, "services": services,
        "interactions": inter_rows, "integrations": irow, "persistence": prow_infra, "communication": crow,
        "events": erow, "schemas": {(x.front.get("service") or x.path.stem.replace("db-schema-", "")): x for x in schemas},
        "flows": flow_meta, "modules": module_rows, "platforms": platforms, "nfrs": nfr_meta,
    }
    return out, meta
