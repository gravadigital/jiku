#!/usr/bin/env python3
"""Mechanical checks for the Discovery documents (see .claude/specs/discovery.md).

Usage:
    check-discovery.py [--final] [discovery_dir]

Checks whichever of functional-analysis.md, domain-analysis.md, technical-analysis.md and
db-schema-{service}.md exist in discovery_dir (default: _gflow/discovery). Cross-document checks run
on the later document. --final runs everything over all the documents together.

Prints one line per observation and exits 1 if there is any. Standard library only.
"""

import re
import sys
from pathlib import Path

FUNC, DOM, TEC = "functional-analysis.md", "domain-analysis.md", "technical-analysis.md"

ID_RE = re.compile(r"\b(U|INT|NFR|DEC-T|DEC|INV|[A-Z]{2,4})-(E?\d+)\b")
RANGE_RE = re.compile(r"\b(U|INT|NFR|DEC-T|DEC|INV|[A-Z]{2,4})-(\d+)\.\.(\d+)\b")
BOLD_RE = re.compile(r"\*\*([^*]+?)\*\*")
LABELS = {
    "requisitos", "condiciones de falla", "ejemplos", "configuraciones", "no se notifica:",
    "superficie(s):", "atributos derivados", "relaciones:", "baja:", "estados", "transiciones",
    "interacciones", "eventos",
}
PENDING_RE = re.compile(r"<!--|\bTODO\b|\bTBD\b|\bPENDIENTE\b|\b[Aa] definir\b|\?\?|¿\?")
REASON_RE = re.compile(r"\b(porque|para que|ya que|aunque|dado que)\b", re.I)
MAGNITUDE_RE = re.compile(r"\d|\b(decenas|cientos|miles|millones|unidades)\b|no aplica", re.I)
NFR_CATEGORIES = [
    "Volumen", "Tiempos", "Disponibilidad", "Privacidad y cumplimiento", "Accesibilidad",
    "Idioma, zona horaria y formatos", "Compatibilidad",
]
SCHEMA_SECTIONS = ["Base", "Decisiones del esquema", "Esquema", "Restricciones que DBML no expresa",
                   "Atributos derivados"]
SCHEMA_DECISIONS = ["Concurrencia", "Multi-tenancy", "Historial", "Borrado"]
DB_ENGINE_RE = re.compile(r"(?i)postgres|mysql|mariadb|sqlite|sql server|mongo")
REQUIRED_SECTIONS = {
    FUNC: ["Resumen", "Actores", "Superficies", "Funcionalidades", "Fuera de alcance",
           "Parámetros", "Integraciones externas", "Requisitos no funcionales",
           "Decisiones tomadas"],
    DOM: ["Glosario", "Entidades", "Estados", "Invariantes"],
    TEC: ["Servicios", "Módulos", "Persistencia e infraestructura", "Comunicación",
          "Autenticación y autorización", "Garantías", "Flujos clave", "Decisiones técnicas"],
}


class Doc:
    def __init__(self, path):
        self.name = path.name
        text = path.read_text(encoding="utf-8")
        self.front, self.body = {}, text
        m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
        if m:
            self.body = text[m.end():]
            for line in m.group(1).splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    self.front[k.strip()] = v.strip()
        self.lines = self.body.splitlines()
        self.sections = self._split(2)

    def _split(self, level):
        """{title: [lines]} for headings of exactly `level` hashes (outside code fences)."""
        out, cur, fence = {}, None, False
        for line in self.lines:
            if line.startswith("```"):
                fence = not fence
            if not fence and re.match(r"^#{%d} \S" % level, line):
                cur = line[level + 1:].strip()
                out[cur] = []
            elif cur is not None:
                out[cur].append(line)
        return out

    def subsections(self, section):
        """{title: [lines]} for ### headings inside a ## section."""
        out, cur = {}, None
        for line in self.sections.get(section, []):
            if line.startswith("### "):
                cur = line[4:].strip()
                out[cur] = []
            elif cur is not None:
                out[cur].append(line)
        return out


def tables(lines):
    """Yield each markdown table as (header, rows), cells stripped."""
    block = []
    for line in lines + [""]:
        if line.startswith("|"):
            block.append(line)
            continue
        if len(block) >= 2:
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in block]
            yield cells[0], [r for r in cells[2:]]
        block = []


def table_with(lines, first_col):
    for header, rows in tables(lines):
        if header and header[0] == first_col:
            return header, rows
    return None, []


def tables_after(lines, marker):
    """Tables between a bold marker line (e.g. **Atributos derivados**) and the next bold line."""
    for i, line in enumerate(lines):
        if line.strip().strip("*").strip() == marker:
            block = []
            for l in lines[i + 1:]:
                if l.startswith("**"):
                    break
                block.append(l)
            yield from tables(block)
            return


def parse_dbml(text):
    """Minimal DBML reader: enums (value, note), tables (columns with note, table note) and refs."""
    enums, tables, refs, cur, kind, in_indexes = {}, {}, [], None, None, False
    for raw in text.splitlines():
        line = raw.split("//")[0].rstrip() if not raw.strip().startswith("Note") else raw.rstrip()
        s = line.strip()
        m = re.match(r"(Enum|Table)\s+(\w+)\s*\{", s)
        if m:
            kind, cur = m.group(1), m.group(2)
            if kind == "Enum":
                enums[cur] = []
            else:
                tables[cur] = {"columns": [], "note": None}
            continue
        if s.startswith("indexes"):
            in_indexes = True
            continue
        if s.startswith("}"):
            if in_indexes:
                in_indexes = False
            else:
                cur = kind = None
            continue
        if in_indexes:
            continue
        if s.startswith("Ref:"):
            for tbl in re.findall(r"[<>-]\s*(\w+)\.\w+", s):
                refs.append(("Ref", tbl))
            continue
        if not cur or not s:
            continue
        note = re.search(r"note:\s*'([^']*)'", s)
        if kind == "Enum":
            enums[cur].append((s.split()[0], note.group(1) if note else None))
        elif s.startswith("Note:"):
            tables[cur]["note"] = re.sub(r"^Note:\s*'(.*)'$", r"\1", s)
        elif re.match(r"\w+\s+\S+", s):
            name = s.split()[0]
            tables[cur]["columns"].append({"name": name, "note": note.group(1) if note else None})
            for tbl in re.findall(r"ref:\s*[<>-]\s*(\w+)\.\w+", s):
                refs.append((f"{cur}.{name}", tbl))
    return enums, tables, refs


def ids_in(text):
    found = set()
    for p, a, b in RANGE_RE.findall(text):
        for n in range(int(a), int(b) + 1):
            found.add(f"{p}-{n:02d}")
    for p, n in ID_RE.findall(text):
        found.add(f"{p}-{n}")
    return found


def defined_ids(doc):
    out = set()
    for header, rows in tables(doc.lines):
        for r in rows:
            if r and re.fullmatch(ID_RE.pattern, r[0]):
                out.add(r[0])
    return out


def bold_terms(lines):
    out = set()
    for line in lines:
        for t in BOLD_RE.findall(line):
            t = t.strip()
            if t.lower() in LABELS or t.endswith(":") or ID_RE.fullmatch(t):
                continue
            out.add(t.lower())
    return out


class Checker:
    def __init__(self, ddir, final):
        self.ddir, self.final, self.obs = ddir, final, []
        self.docs = {n: Doc(ddir / n) for n in (FUNC, DOM, TEC) if (ddir / n).exists()}
        self.schemas = [Doc(p) for p in sorted(ddir.glob("db-schema-*.md"))]

    def add(self, code, doc, msg):
        self.obs.append(f"[{code}] {doc}: {msg}")

    # ---------- common ----------
    def decisions(self, d, section):
        header, rows = table_with(d.sections.get(section, []), "ID")
        if not header:
            return
        k_dec = header.index("Decisión") if "Decisión" in header else 2
        k_mot = header.index("Motivo") if "Motivo" in header else None
        if k_mot is None and rows:
            self.add("C6", d.name, f"«{section}» no tiene la columna Motivo: cada decisión lleva por qué se tomó")
        for r in rows:
            if len(r) > k_dec and REASON_RE.search(r[k_dec]):
                self.add("C5", d.name, f"{r[0]}: la decisión da un porqué («{REASON_RE.search(r[k_dec]).group(0)}»); "
                                       f"va en la columna Motivo")
            if k_mot is not None and (len(r) <= k_mot or r[k_mot].strip() in ("", "—", "-")):
                self.add("C6", d.name, f"{r[0]}: falta el motivo (preguntáselo al usuario)")

    def common(self, d):
        for s in REQUIRED_SECTIONS.get(d.name, SCHEMA_SECTIONS):
            if s not in d.sections:
                self.add("C1", d.name, f"falta la sección «{s}»")
        status = d.front.get("status", "")
        if status not in ("in-progress", "closed"):
            self.add("C2", d.name, f"status «{status}» inválido (in-progress | closed)")
        if status == "closed":
            if "closed_sections" in d.front:
                self.add("C3", d.name, "cerrado pero conserva closed_sections en el frontmatter")
            for i, line in enumerate(d.lines, 1):
                if PENDING_RE.search(line):
                    self.add("C4", d.name, f"contenido temporal o pendiente en la línea {i}: {line.strip()[:80]}")

    # ---------- functional ----------
    def functional(self, f):
        defined = defined_ids(f)
        for ref in sorted(ids_in(f.body) - defined):
            self.add("F1", f.name, f"{ref} se referencia pero no está definido")

        params = {r[0].lower() for r in table_with(f.sections.get("Parámetros", []), "Parámetro")[1]}
        body = [l for s, ls in f.sections.items() if s != "Resumen" for l in ls]
        for t in sorted(bold_terms(body) - params):
            self.add("F2", f.name, f"«{t}» está en negrita pero no existe en Parámetros")

        surfaces = {r[0] for r in table_with(f.sections.get("Superficies", []), "Superficie")[1]}
        _, index = table_with(f.sections.get("Funcionalidades", []), "Bloque")
        prefixes = {r[1] for r in index if len(r) > 1}
        blocks = {}
        for title, lines in f.subsections("Funcionalidades").items():
            blocks[title.split(" ")[0]] = lines
        for p in sorted(prefixes - set(blocks)):
            self.add("F3", f.name, f"el bloque {p} está en el índice pero no tiene su detalle")
        for p in sorted(set(blocks) - prefixes):
            self.add("F3", f.name, f"el bloque {p} tiene detalle pero no está en el índice")
        used = set()
        for p, lines in blocks.items():
            line = next((l for l in lines if l.startswith("**Superficie(s):**")), None)
            if line is None:
                self.add("F4", f.name, f"el bloque {p} no declara Superficie(s)")
                continue
            value = line.split("**", 2)[2].strip()
            if value.startswith("—"):
                continue
            for s in value.split(","):
                s = re.sub(r"\(.*?\)", "", s).strip()
                used.add(s)
                if s not in surfaces:
                    self.add("F4", f.name, f"el bloque {p} nombra la superficie «{s}», que no existe en Superficies")
        for s in sorted(surfaces - used):
            self.add("F4", f.name, f"la superficie «{s}» no tiene ningún bloque")

        _, nfr = table_with(f.sections.get("Requisitos no funcionales", []), "ID")
        cats = {r[1] for r in nfr if len(r) > 1}
        for c in NFR_CATEGORIES:
            if c not in cats:
                self.add("F5", f.name, f"falta la categoría de NFR «{c}»")
        for c in sorted(cats - set(NFR_CATEGORIES)):
            self.add("F5", f.name, f"categoría de NFR desconocida «{c}»")

        for r in nfr:
            if len(r) > 3 and r[1] in ("Volumen", "Tiempos") and not MAGNITUDE_RE.search(r[3]):
                self.add("F7", f.name, f"{r[0]}: el target «{r[3]}» no es un número ni un orden de magnitud")

        _, ptable = table_with(f.sections.get("Parámetros", []), "Parámetro")
        values = {r[1]: r[0] for r in ptable if len(r) > 1 and re.search(r"\d+\s+[a-záéíóú]+", r[1])}
        for p_, lines in blocks.items():
            for line in lines:
                if not line.startswith("|") or line.startswith("|---"):
                    continue
                cells = [c.strip() for c in line.strip("|").split("|")]
                for v, name in values.items():
                    if re.search(rf"(?<![\d.,]){re.escape(v)}\b", " ".join(cells[1:])):
                        self.add("F8", f.name, f"{cells[0]} repite «{v}»; nombrá el parámetro **{name.lower()}**")
        self.decisions(f, "Decisiones tomadas")

        _, actors = table_with(f.sections.get("Actores", []), "ID")
        needs_acc = any(len(r) > 2 and not re.match(r"(?i)\s*(anónimo|—|-)", r[2]) for r in actors)
        if needs_acc and "ACC" not in blocks:
            self.add("F6", f.name, "hay un actor con acceso distinto de anónimo y no existe el bloque ACC")

    # ---------- domain ----------
    def domain(self, d, f):
        fdef = defined_ids(f) if f else set()
        ddef = defined_ids(d)
        for ref in sorted(ids_in(d.body) - fdef - ddef):
            self.add("D1", d.name, f"{ref} se referencia pero no está definido en el funcional ni en el dominio")

        for title, lines in d.subsections("Entidades").items():
            if not any(l.startswith("**Baja:**") for l in lines):
                self.add("D2", d.name, f"la entidad «{title}» no tiene su Baja")

        for entity, lines in d.subsections("Estados").items():
            _, states = table_with(lines, "Estado")
            _, trans = table_with(lines, "Desde")
            sources = {r[0] for r in trans}
            initial = {r[1] for r in trans if r[0] == "(creación)"}
            for r in states:
                name, typ = r[0], r[1] if len(r) > 1 else ""
                derived = "inicial" if name in initial else ("terminal" if name not in sources else "intermedio")
                if typ != derived:
                    self.add("D3", d.name, f"{entity}: el estado {name} figura como «{typ}» pero sus transiciones lo hacen «{derived}»")

        if f:
            params = {r[0].lower() for r in table_with(f.sections.get("Parámetros", []), "Parámetro")[1]}
            for t in sorted(bold_terms(d.lines) - params):
                self.add("D4", d.name, f"«{t}» está en negrita pero no existe en los Parámetros del funcional")

    # ---------- technical ----------
    def technical(self, t, f, d):
        known = defined_ids(t) | (defined_ids(f) if f else set()) | (defined_ids(d) if d else set())
        for ref in sorted(ids_in(t.body) - known):
            self.add("T1", t.name, f"{ref} se referencia pero no está definido en ningún documento")

        owners_block, owners_entity = {}, {}
        for service, lines in t.subsections("Módulos").items():
            _, rows = table_with(lines, "Módulo")
            for r in rows:
                if len(r) < 3:
                    continue
                for e in [x.strip() for x in r[1].split(",") if x.strip() not in ("", "—")]:
                    owners_entity.setdefault(e, []).append(f"{service}.{r[0]}")
                for b in [x.strip() for x in r[2].split(",") if x.strip() not in ("", "—")]:
                    owners_block.setdefault(b, []).append(f"{service}.{r[0]}")
        for k, v in list(owners_block.items()) + list(owners_entity.items()):
            if len(v) > 1:
                self.add("T2", t.name, f"«{k}» está asignado a más de un módulo: {', '.join(v)}")

        if f:
            _, index = table_with(f.sections.get("Funcionalidades", []), "Bloque")
            for r in index:
                if len(r) > 1 and r[1] not in owners_block:
                    self.add("T2", t.name, f"el bloque {r[1]} no está asignado a ningún módulo")
            surfaces = {r[0] for r in table_with(f.sections.get("Superficies", []), "Superficie")[1]}
            _, services = table_with(t.sections.get("Servicios", []), "Servicio")
            served = set()
            for r in services:
                if len(r) > 3 and r[1] == "frontend":
                    served |= {s.strip() for s in r[3].split(",")}
            for s in sorted(surfaces - served):
                self.add("T3", t.name, f"la superficie «{s}» no la sirve ningún frontend")
        if d:
            for e in d.subsections("Entidades"):
                if e not in owners_entity:
                    self.add("T2", t.name, f"la entidad «{e}» no tiene módulo dueño")
            invs = {r[0] for r in table_with(d.sections.get("Invariantes", []), "ID")[1]}
            _, garantias = table_with(t.sections.get("Garantías", []), "Regla")
            covered = set()
            for r in garantias:
                covered |= ids_in(r[0])
            for i in sorted(invs - covered):
                self.add("T4", t.name, f"el invariante {i} no tiene garantía")

        self.decisions(t, "Decisiones técnicas")
        _, decs = table_with(t.sections.get("Decisiones técnicas", []), "ID")
        if not any(len(r) > 1 and "CI/CD" in r[1] for r in decs):
            self.add("T5", t.name, "falta la decisión de CI/CD")

    # ---------- database schema ----------
    def schema(self, s, d, t):
        dbml = "\n".join(re.findall(r"```dbml\n(.*?)```", s.body, re.S))
        if not dbml.strip():
            self.add("S0", s.name, "no tiene el bloque ```dbml``` del esquema")
            return
        enums, tables, refs = parse_dbml(dbml)
        enum_notes = {n.lower() for vals in enums.values() for _, n in vals if n}
        by_entity = {}
        for name, tb in tables.items():
            m = re.match(r"Entidad:\s*(.+?)\s*(—|$)", tb["note"] or "")
            if m:
                by_entity[m.group(1).strip().lower()] = name
            elif not (tb["note"] or "").startswith("Técnica:"):
                self.add("S1", s.name, f"la tabla {name} no dice su origen (Note: 'Entidad: …' o 'Técnica: …')")
        for src, tbl in refs:
            if tbl not in tables:
                self.add("S7", s.name, f"{src} referencia a la tabla {tbl}, que no existe")

        _, decisions = table_with(s.sections.get("Decisiones del esquema", []), "Decisión")
        names = {r[0] for r in decisions}
        for n in SCHEMA_DECISIONS:
            if n not in names:
                self.add("S8", s.name, f"falta la decisión de esquema «{n}» (con su valor o «no aplica»)")
        if d and "Moneda" not in names and re.search(r"\|\s*dinero\s*\|", d.body):
            self.add("S8", s.name, "hay un atributo de tipo dinero y falta la decisión de esquema «Moneda»")

        stored = {}
        _, drows = table_with(s.sections.get("Atributos derivados", []), "Entidad")
        for r in drows:
            if len(r) > 2:
                stored[(r[0].lower(), r[1].lower())] = r[2].lower().startswith("columna")
        if d:
            for entity, lines in d.subsections("Entidades").items():
                table = by_entity.get(entity.lower())
                if not table:
                    self.missing_entities.setdefault(entity, s.name)
                    continue
                self.tabled_entities.add(entity)
                cols = {c["note"].split("·")[0].strip().lower(): c for c in tables[table]["columns"] if c["note"]}
                _, attrs = table_with(lines, "Atributo")
                for r in attrs:
                    a = r[0]
                    col = cols.get(a.lower())
                    if not col:
                        self.add("S2", s.name, f"{entity}.{a} no tiene columna en {table} (nota '{a}')")
                        continue
                    if len(r) > 4 and r[4].lower().startswith("sí") and "dato personal" not in col["note"].lower():
                        self.add("S5", s.name, f"{table}.{col['name']} guarda un dato personal ({entity}.{a}) y su nota no lo dice")
                    if len(r) > 3 and r[1].lower() == "enum" and not r[3].lower().startswith("valores de"):
                        values = r[3].split(";")[0].split(":")[-1]
                        for v in [x.strip() for x in values.split("/") if x.strip()]:
                            if v.lower() not in enum_notes:
                                self.add("S4", s.name, f"el valor «{v}» de {entity}.{a} no tiene traducción en un enum")
                for header, rows in tables_after(lines, "Atributos derivados"):
                    for r in rows:
                        key = (entity.lower(), r[0].lower())
                        if key not in stored:
                            self.add("S3", s.name, f"el derivado {entity}.{r[0]} no está en «Atributos derivados»")
                        elif stored[key] and r[0].lower() not in cols:
                            self.add("S3", s.name, f"el derivado {entity}.{r[0]} se guarda pero {table} no tiene la columna")
        if t:
            covered = set()
            _, crows = table_with(s.sections.get("Restricciones que DBML no expresa", []), "Nombre")
            for r in crows:
                covered |= ids_in(" ".join(r))
            covered |= ids_in(dbml)
            _, garantias = table_with(t.sections.get("Garantías", []), "Regla")
            for r in garantias:
                schema_level = re.search(r"(?i)restricci|índice|unicidad|único|exclusi|chequeo|tabla|permiso|funci", r[1])
                if len(r) > 2 and re.search(r"(?i)\bbase\b", r[2]) and schema_level:
                    self.schema_guarantees |= ids_in(r[0])
            self.covered_guarantees |= covered

    def run(self):
        f, d, t = (self.docs.get(n) for n in (FUNC, DOM, TEC))
        if self.final and len(self.docs) < 3:
            self.add("X1", str(self.ddir), "la verificación final necesita los tres documentos")
        for doc in self.docs.values():
            self.common(doc)
        if f:
            self.functional(f)
        if d:
            self.domain(d, f)
        if t:
            self.technical(t, f, d)
        # With one schema per service, an entity or guarantee is covered if any schema has it.
        self.missing_entities, self.tabled_entities = {}, set()
        self.schema_guarantees, self.covered_guarantees = set(), set()
        for s in self.schemas:
            self.common(s)
            self.schema(s, d, t)
        where = self.schemas[0].name if len(self.schemas) == 1 else "db-schema-*.md"
        for entity, name in self.missing_entities.items():
            if entity not in self.tabled_entities:
                self.add("S1", where, f"la entidad «{entity}» no tiene tabla (Note: 'Entidad: {entity} — …')")
        for i in sorted(self.schema_guarantees - self.covered_guarantees):
            self.add("S6", where, f"la garantía {i} va en la base y no está en ningún esquema ni en sus restricciones")
        if self.final and t:
            _, persistence = table_with(t.sections.get("Persistencia e infraestructura", []), "Componente")
            owners = {r[2] for r in persistence if len(r) > 2 and DB_ENGINE_RE.search(r[1])}
            have = {s.front.get("service") for s in self.schemas}
            for o in sorted(owners - have):
                self.add("X3", str(self.ddir), f"el servicio {o} es dueño de una base y no tiene db-schema-{o}.md")
        if self.final and f and d and t:
            params = {r[0].lower() for r in table_with(f.sections.get("Parámetros", []), "Parámetro")[1]}
            for t_ in sorted(bold_terms(t.lines) - params):
                self.add("X2", t.name, f"«{t_}» está en negrita pero no existe en los Parámetros del funcional")
        return self.obs


def main(argv):
    final = "--final" in argv
    args = [a for a in argv if a != "--final"]
    ddir = Path(args[0]) if args else Path("_gflow/discovery")
    if not ddir.is_dir():
        print(f"No existe la carpeta {ddir}")
        return 2
    obs = Checker(ddir, final).run()
    for o in obs:
        print(o)
    print(f"{len(obs)} observaciones" if obs else "Sin observaciones")
    return 1 if obs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
