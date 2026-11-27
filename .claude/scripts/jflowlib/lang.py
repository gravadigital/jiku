"""The language of the documents people read: the specification in Jiku, the discovery, the product's
documentation and its CHANGELOG. Their content is written in the product language (`language` in
_jflow/project.yaml, Spanish by default). Their structure - headings, table columns and the fixed
values of some columns - is written in English or Spanish: English for any language other than Spanish.

Reading accepts both: `canon()` turns a Spanish structural word into its English name, so the code
only knows English names. Writing uses `say()`, which gives the name in the product language.
Everything only agents read (_jflow/ definition, AGENTS.md, script output) is always English.
See .claude/specs/language.md."""

import re

DEFAULT = "es"
STRUCTURE_LANGS = ("en", "es")

# English name -> Spanish name. Headings, columns and fixed values of the documents people read.
TERMS = {
    # specification: fields
    "Scope": "Alcance",
    "Proposal": "Propuesta",
    "Acceptance criteria": "Criterios de aceptación",
    # specification: scope
    "Includes": "Incluye",
    "Excludes": "No incluye",
    "Depends on": "Depende de",
    "Depended on by": "Dependen de este",
    # specification: proposal
    "Parameters": "Parámetros",
    "Decisions": "Decisiones",
    "Technical detail": "Detalle técnico",
    "Non-functional requirements": "Requisitos no funcionales",
    "Blocks": "Bloques",
    "Data": "Datos",
    "Invariants and guarantees": "Invariantes y garantías",
    "Schema": "Esquema",
    "Interface": "Interfaz",
    "Flows": "Flujos",
    "Architecture": "Arquitectura",
    "Visual reference": "Referencia visual",
    "Authentication": "Autenticación",
    "Use": "Uso",
    "Roles": "Roles",
    "Credentials": "Credenciales",
    "Glossary": "Glosario",
    "Out of scope": "Fuera de alcance",
    # specification: columns
    "Change": "Cambio",
    "Criterion": "Criterio",
    "Type": "Tipo",
    "Topic": "Tema",
    "Decision": "Decisión",
    "Rejected": "Descartado",
    "Reason": "Motivo",
    "Affects": "Afecta",
    "Parameter": "Parámetro",
    "Value": "Valor",
    "Rule": "Regla",
    "Guarantee": "Garantía",
    "Mechanism": "Mecanismo",
    "Verification": "Verificación",
    "Tested in": "Prueba en",
    "Screen": "Pantalla",
    "Reference": "Referencia",
    "Route": "Ruta",
    "State": "Estado",
    "Decided difference": "Diferencia decidida",
    "Screens": "Pantallas",
    "Package": "Paquete",
    "Decided in the implementation": "Decidido en la implementación",
    # specification: fixed values
    "add": "agrega",
    "modify": "modifica",
    "remove": "elimina",
    "new": "nueva",
    "reverts": "revierte",
    "keeps": "respeta",
    "test": "prueba",
    "alert": "alerta",
    "review": "revisión",
    # discovery
    "Functional analysis": "Análisis funcional",
    "Domain analysis": "Análisis de dominio",
    "Technical analysis": "Análisis técnico",
    "Base schema": "Esquema de base",
    "Summary": "Resumen",
    "Actors": "Actores",
    "Surfaces": "Superficies",
    "Features": "Funcionalidades",
    "External integrations": "Integraciones externas",
    "Decisions taken": "Decisiones tomadas",
    "Technical decisions": "Decisiones técnicas",
    "Schema decisions": "Decisiones del esquema",
    "Entities": "Entidades",
    "States": "Estados",
    "Invariants": "Invariantes",
    "Guarantees": "Garantías",
    "Derived attributes": "Atributos derivados",
    "Key flows": "Flujos clave",
    "Services": "Servicios",
    "Modules": "Módulos",
    "Communication": "Comunicación",
    "Persistence and infrastructure": "Persistencia e infraestructura",
    "Authentication and authorization": "Autenticación y autorización",
    "Constraints DBML does not express": "Restricciones que DBML no expresa",
    "Base": "Base",
    "Test identities": "Identidades de prueba",
    # discovery: columns
    "ID": "ID",
    "Actor": "Actor",
    "Role": "Rol",
    "Surface": "Superficie",
    "Platform": "Plataforma",
    "Service": "Servicio",
    "Module": "Módulo",
    "Language": "Lenguaje",
    "Technology": "Tecnología",
    "Protocol": "Protocolo",
    "Direction": "Dirección",
    "System": "Sistema",
    "External systems": "Sistemas externos",
    "Purpose": "Para qué",
    "Owner": "Dueño",
    "Source of truth": "Fuente de verdad",
    "Exposes": "Expone",
    "Consumes": "Consume",
    "Publishes": "Publica",
    "Used by": "Usado por",
    "Category": "Categoría",
    "Component": "Componente",
    "Entity": "Entidad",
    "Attribute": "Atributo",
    "Event": "Evento",
    "Transition": "Transición",
    "Term": "Término",
    "Name": "Nombre",
    "Description": "Descripción",
    "Applied in": "Aplicada en",
    "Applies": "Aplica",
    "Where": "Dónde",
    "When": "Cuándo",
    "Requirement": "Requisito",
    "Editable by a user?": "¿Editable por un usuario?",
    "Origin": "Origen",
    "Not stated in the discovery": "No consta en el discovery",
    "yes": "sí",
    "no": "no",
    # discovery: fixed values and row names
    "intermediate": "intermedio",
    "terminal": "terminal",
    "Volume": "Volumen",
    "Response times": "Tiempos",
    "Availability": "Disponibilidad",
    "Privacy and compliance": "Privacidad y cumplimiento",
    "Accessibility": "Accesibilidad",
    "Language, time zone and formats": "Idioma, zona horaria y formatos",
    "Compatibility": "Compatibilidad",
    "Concurrency": "Concurrencia",
    "Multi-tenancy": "Multi-tenancy",
    "History": "Historial",
    "Deletion": "Borrado",
    "Currency": "Moneda",
    # discovery: bold labels inside a block or an entity
    "Surface(s)": "Superficie(s)",
    "Configurations": "Configuraciones",
    "Examples": "Ejemplos",
    "Relationships": "Relaciones",
    "Removal": "Baja",
    "External identity providers": "Proveedores externos de identidad",
    "Provider": "Proveedor",
    # the definition (_jflow/prd: always English; the Spanish names are read for older or translated text)
    "Functional blocks": "Bloques funcionales",
    "Prefix": "Prefijo",
    "Block": "Bloque",
    "Covers": "Cubre",
    "Last ID": "Último ID",
    "File": "Archivo",
    "Tables": "Tablas",
    "Table": "Tabla",
    "Describes": "Describe",
    "Flow": "Flujo",
    "Requirements": "Requisitos",
    "Failure conditions": "Condiciones de falla",
    "Condition": "Condición",
    "Result": "Resultado",
    "Channel": "Canal",
    "Recipient": "Destinatario",
    "Content": "Contenido",
    "Not notified": "No se notifica",
    "Attributes": "Atributos",
    "Transitions": "Transiciones",
    "Events": "Eventos",
    "How it is tested": "Cómo se prueba",
    "Entry points": "Entradas",
    "Entry point": "Entrada",
    "How the identity is obtained in tests": "Cómo se obtiene en las pruebas",
    "How it is replaced in tests": "Cómo se reemplaza en las pruebas",
    "How to run them": "Cómo se corre",
    "Owner service": "Servicio dueño",
    "Engine": "Motor",
    "Definition": "Definición",
    "Credential": "Credencial",
    "Issuer": "Emisor",
    "Obtained": "Se obtiene",
    "Lifetime and renewal": "Vida y renovación",
    "Revocation": "Revocación",
    "From": "Desde",
    "Passes through": "Pasa por",
    "Verifies": "Verifica",
    "Allows": "Permite",
    "Access": "Acceso",
    "Access recovery": "Recuperación de acceso",
    "Integration": "Integración",
    "From → To": "De → A",
    "Services and modules": "Servicios y módulos",
    "Folder": "Carpeta",
    "Responsibility": "Responsabilidad",
    "Interactions": "Interacciones",
    "Product": "De producto",
    "Technical": "Técnicas",
    "Reverted": "Revertidas",
    "Said": "Decía",
    "Reverted by": "Revertida por",
    "Now": "Ahora",
    "What happens": "Qué pasa",
    "Operation / table": "Operación / tabla",
    "Rules": "Reglas",
    "Document": "Documento",
    "Contains": "Contiene",
    "Load when": "Cargar cuando",
    "Target": "Target",
    # columns copied from the discovery into the definition
    "Required": "Obligatorio",
    "Constraints": "Restricciones",
    "Personal data": "Dato personal",
    "Meaning": "Significado",
    "Triggered by": "Disparado por",
    "Calculation rule": "Regla de cálculo",
    "To": "Hacia",
    "Alternatives": "Alternativas",
    "Stored": "Se guarda",
    "By": "Por",
    "For which roles": "Para qué roles",
    "Data it takes": "Datos que toma",
    "How it is linked to the account": "Cómo se vincula con la cuenta",
    "initial": "inicial",
    "product": "producto",
    # product documentation: columns
    "Dependencies checked": "Dependencias que chequea",
    "Process": "Proceso",
    "How often": "Cada cuánto",
    "What it does": "Qué hace",
    "Last success metric": "Métrica de último éxito",
    "Alert": "Alerta",
    "Threshold": "Umbral",
    "What it is": "Qué es",
    "How it is created": "Cómo se crea",
    "If missing": "Si falta",
    "What": "Qué",
    "Command": "Comando",
    # fixed phrases the scripts write in a specification
    "Base product": "Producto base",
    "Whatever is not in the acceptance criteria.": "Lo que no está en los criterios de aceptación.",
    "Nothing.": "Nada.",
    "to be decided": "a definir",
    ("How each one is verified: `test` (a test, in the requirement named in «Tested in»: `base` or the "
     "`#id` of the part), `alert` (in the operations guide) or `review` (the verifier checks it)."):
    ("Cómo se verifica cada uno: `prueba` (un test, en el requisito de «Prueba en»: `base` o el `#id` de la "
     "parte), `alerta` (en la guía de operación) o `revisión` (la mira el verificador)."),
    # product documentation and release
    "How to run it": "Cómo levantarlo",
    "Commands": "Comandos",
    "Documentation": "Documentación",
    "Services and health": "Servicios y salud",
    "Background processes": "Procesos en segundo plano",
    "Configuration": "Configuración",
    "Observability": "Observabilidad",
    "Recommended alerts": "Alertas recomendadas",
    "CI secrets": "Secretos del CI",
    "Downloadable builds": "Builds para descargar",
    "Deployment": "Despliegue",
    "Added": "Agregado",
    "Changed": "Cambiado",
    "Fixed": "Corregido",
    "Removed": "Eliminado",
    "Known issues": "Problemas conocidos",
    "Unreleased": "Sin publicar",
}

# Other Spanish forms of a name (gender, number) -> English name.
ALIASES = {"Desde → Hacia": "From → To", "Usada por": "Used by", "Usadas por": "Used by", "Usados por": "Used by"}

_TO_EN = {}
for _en, _es in TERMS.items():
    _TO_EN[_en.lower()] = _en
    _TO_EN[_es.lower()] = _en
for _es, _en in ALIASES.items():
    _TO_EN[_es.lower()] = _en

_MARK_RE = re.compile(r"^(.*?)\s*\((\w+)\)\s*$")


def canon(s):
    """The English name of a structural word in English or Spanish; any other text unchanged.
    A heading with a change mark keeps it, translated: «Autenticación (agrega)» -> «Authentication (add)»."""
    if s is None:
        return s
    t = s.strip()
    hit = _TO_EN.get(t.lower())
    if hit is not None:
        # already English: keep it as written (the column «Test» is not the value «test»)
        return t if hit.lower() == t.lower() else hit
    m = _MARK_RE.match(t)
    if m and m.group(2).lower() in _TO_EN:
        return f"{canon(m.group(1))} ({_TO_EN[m.group(2).lower()]})"
    return s


class Sections(dict):
    """{title: lines} that keeps each title as written (a title can be content: an entity called
    «Servicio») and also finds it by its English structural name: `s.get("Entities")` finds
    «## Entidades». Iteration yields the titles as written."""

    def _key(self, k):
        if dict.__contains__(self, k):
            return k
        for kk in dict.keys(self):
            if canon(kk) == k:
                return kk
        return None

    def __contains__(self, k):
        return self._key(k) is not None

    def __getitem__(self, k):
        kk = self._key(k)
        if kk is None:
            raise KeyError(k)
        return dict.__getitem__(self, kk)

    def get(self, k, default=None):
        kk = self._key(k)
        return dict.__getitem__(self, kk) if kk is not None else default


def value(s):
    """A fixed value read from a cell, as its English name in lower case ('' when empty)."""
    return (canon((s or "").strip()) or "").lower()


ENUM_COLUMNS = ("Change", "Type", "Verification")
# Fixed phrases the scripts write inside a cell or a bullet, translated wherever they are the whole text.
PHRASES = ("Not stated in the discovery", "to be decided", "Base product", "Nothing.",
           "Whatever is not in the acceptance criteria.")
# Headings the scripts build around a name: English pattern -> Spanish pattern.
HEADING_PATTERNS = ((r"^Database of (.+)$", "Base de {0}"),)


def _heading(name, lang):
    for pat, es in HEADING_PATTERNS:
        m = re.match(pat, name)
        if m:
            return es.format(*m.groups())
    return say(name, lang)


def localize(md, lang):
    """A specification text built with English structure, with its structure in the product language:
    headings, change marks, table columns, the fixed values of the Change/Type/Verification columns,
    label lines («Interactions:») and the fixed phrases of TERMS. Content is left as it is."""
    if structure(lang) == "en":
        return md
    lines = md.splitlines()
    out, header = [], None
    for k, line in enumerate(lines):
        s = line.strip()
        m = re.match(r"^(#{1,6} )(.+?)(?:\s*\((\w+)\))?\s*$", line)
        if m:
            name = _heading(m.group(2), lang)
            mark = f" ({say(m.group(3), lang)})" if m.group(3) else ""
            out.append(f"{m.group(1)}{name}{mark}")
            header = None
            continue
        if s.startswith("|"):
            from .md import split_row
            cells = split_row(s)
            nxt = lines[k + 1].strip() if k + 1 < len(lines) else ""
            if header is None and re.match(r"^\|?\s*:?-{2,}", nxt):
                header = cells
                out.append("| " + " | ".join(say(c, lang) for c in cells) + " |")
                continue
            if header is not None and not re.match(r"^\|?[\s:|-]+\|?$", s):
                cells = [say(c, lang) if (i < len(header) and header[i] in ENUM_COLUMNS) or c in PHRASES else c
                         for i, c in enumerate(cells)]
                out.append("| " + " | ".join(cells) + " |")
                continue
            out.append(line)
            continue
        header = None
        m = re.match(r"^([A-Z][\w /]*):$", s)
        if m and m.group(1) in TERMS:
            out.append(f"{say(m.group(1), lang)}:")
            continue
        if s in TERMS and len(s) > 40:
            out.append(say(s, lang))
            continue
        m = re.match(r"^(\s*- )(#P?\d+ )?(.+)$", line)
        if m and (m.group(3) in PHRASES or (not m.group(2) and m.group(3) in TERMS)):
            out.append(m.group(1) + (m.group(2) or "") + say(m.group(3), lang))
            continue
        out.append(line)
    return "\n".join(out)


def structure(lang):
    """The language the structure is written in: Spanish or English."""
    return "es" if (lang or DEFAULT).lower().startswith("es") else "en"


def say(term, lang):
    """The structural word `term` (its English name) in the language of the product."""
    if structure(lang) == "es":
        return TERMS.get(term, term)
    return term


# The product's documentation for people: file names by language (docs/{name}).
DOC_FILES = {
    "operations": {"en": "operations.md", "es": "operacion.md"},
    "integration": {"en": "integration.md", "es": "integracion.md"},
    "adoption": {"en": "adoption.md", "es": "adopcion.md"},
}


def doc_file(key, lang):
    """Path, relative to the repo root, of a document for people in the product language."""
    return f"docs/{DOC_FILES[key][structure(lang)]}"


def template(name, lang):
    """Path of a template for people (.claude/templates/{en|es}/{name}); `name` may be a DOC_FILES key."""
    lang = structure(lang)
    if name in DOC_FILES:
        name = DOC_FILES[name][lang]
    return f".claude/templates/{lang}/{name}"

