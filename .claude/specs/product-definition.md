# Product Definition

The living definition of the product: what it is, its rules, what is built, and why it is the way it
is. Every skill that plans, implements or answers questions reads it; a new request is evaluated
against it. It lives in `_gflow/`, the workflow's memory, written for agents (documentation for people
is in `docs/`, `README.md` and `CHANGELOG.md`). Read this before reading or writing anything under
`_gflow/`.

## CRITICAL RULES

1. **Three parts, one truth.**
   - **Product and business**: actors, functional blocks, domain, rules, parameters, NFRs, out of
     scope.
   - **Current state**: services and modules, contracts, schema, flows.
   - **History**: decisions with what was discarded, and the reverted ones.
2. **It describes only what is built.** What is still to build lives in the Jiku requirements, each
   with its specification. A specification declares a change; the definition changes when
   `/req-implement` applies it in the requirement's branch. Nothing else writes the definition after
   the product is bootstrapped or adopted. In `dev`, the definition describes what is merged.
3. **Stable IDs everywhere.** Every row that can be cited has an ID that is never reused. Pieces cite
   each other by ID; the scripts compute what to load and check consistency from them.
4. **Origin on every row.** `inicial` (bootstrap or adopt) or the Jiku requirement that added or last
   changed it, as `#812`.
5. **Written for agents.** Tables with fixed columns, IDs, and load conditions expressed with the
   keys an agent has at hand. No narrative, no rationale outside the decisions.
6. **Deterministic work goes through `grava.py`.** Indexes are generated, IDs are allocated,
   consistency is checked and context is loaded by the script. Never hand-edit a generated index,
   never pick an ID by reading the files.
7. **Spanish content, English identifiers.** Prose, table content and section titles in Spanish.
   Table and column names, enum values, API paths, JSON fields, `operationId`s, module ids, file names
   in English.

## Layout

```
_gflow/
├── project.yaml                  # Jiku project and instance, git platform and branches (see Jiku spec)
├── discovery/                    # frozen after /product-define: the original analysis (history)
├── prd/
│   ├── index.md                  # entry point: product, actors, surfaces, map of documents
│   ├── blocks/
│   │   ├── index.md              # GENERATED from the blocks' frontmatter
│   │   └── {PREFIX}.md           # one functional block
│   ├── parameters.md
│   ├── decisions.md              # product and technical decisions; reverted ones
│   ├── nfr.md
│   ├── out-of-scope.md
│   ├── domain/
│   │   ├── index.md              # GENERATED from the entities' frontmatter
│   │   ├── glossary.md
│   │   ├── {entity}.md           # one entity
│   │   └── invariants.md
│   └── architecture/
│       ├── services.md           # services, modules, interactions
│       ├── integration.md        # persistence, communication, external integrations
│       ├── auth.md               # credentials, their use, roles
│       └── guarantees.md         # how each rule that must always hold is enforced
├── apis/{service}.openapi.yaml   # HTTP contract, if the service exposes HTTP
├── apis/{service}.asyncapi.yaml  # NATS/events contract, if it exposes NATS
├── db-schemas/{service}.md       # one per service that owns a database
├── flows/
│   ├── index.md                  # GENERATED from the flows' frontmatter
│   └── {flow}.md
└── references/                   # documentation of external systems
```

| Part | Files |
|---|---|
| Product and business | `prd/index.md`, `prd/blocks/`, `prd/domain/`, `prd/parameters.md`, `prd/nfr.md`, `prd/out-of-scope.md` |
| Current state | `prd/architecture/`, `apis/`, `db-schemas/`, `flows/` |
| History | `prd/decisions.md` |

## IDs

| Element | ID | Defined in |
|---|---|---|
| Actor | `U-01` | `prd/index.md` |
| Block requirement | `{PREFIX}-01` | `prd/blocks/{PREFIX}.md` |
| Failure condition | `{PREFIX}-E1` | `prd/blocks/{PREFIX}.md` |
| Notification | `NOT-01` | `prd/blocks/NOT.md` |
| Invariant | `INV-01` | `prd/domain/invariants.md` |
| Guarantee | `GAR-01` | `prd/architecture/guarantees.md` |
| Credential | `CRED-01` | `prd/architecture/auth.md` |
| External integration | `INT-01` | `prd/architecture/integration.md` |
| NFR | `NFR-01` | `prd/nfr.md` |
| Product decision | `DEC-01` | `prd/decisions.md` |
| Technical decision | `DEC-T01` | `prd/decisions.md` |
| Parameter | its name, in bold: **horizonte de reserva** | `prd/parameters.md` |
| Entity | its Spanish name (`Turno`) | `prd/domain/{entity}.md` |
| Module | `{service}.{module}` | `prd/architecture/services.md` |
| Operation | `operationId` | `apis/` |
| Jiku requirement | `#812` | Jiku |

- IDs are never reused. A removed row disappears from its file; its ID stays burned.
- **Never pick a new ID by hand**: `grava.py next-id {KIND}` returns the next free one, looking at the
  definition **and** at every open requirement in Jiku (they reserve the IDs they add).

## Files

Every table below has an `Origen` column (`inicial` or `#812`) unless stated otherwise.

### `prd/index.md`

The entry point. Small and stable: everybody loads it.

```markdown
# {Producto}

{Qué es, en 2-3 líneas.}

## Actores
| ID | Actor | Acceso | Recuperación de acceso | Origen |

## Superficies
| Superficie | Plataforma | Actores | Viewports | Servicio | Origen |

## Documentación
| Documento | Contiene | Cargar cuando |
```

The `Documentación` table is fixed (it comes from the template in `grava.py`): it tells an agent which
condition of its task requires each file.

### `prd/blocks/{PREFIX}.md`

One functional block: what the product does, seen by whoever uses it.

```markdown
---
prefix: CAN
name: Cancelación por el cliente
surfaces: [Reserva pública]
covers: Cancelar un turno desde el link del email, sin autenticarse, hasta su hora de inicio
entities: [Turno, Evento de turno]
last_requirement: CAN-05
last_failure: CAN-E3
---

# CAN — Cancelación por el cliente

## Requisitos
| ID | Requisito | Actor | Origen |

## Condiciones de falla
| ID | Condición | Resultado | Origen |

## Configuraciones          (only if the user chooses options)
| Configuración | Default | Alternativas | Origen |

## Ejemplos                 (only for logic with calculations or conditions)
- CAN-03: {caso con valores concretos}
```

- A block exists in the definition only once it is built. It has no status.
- The NOT block (notifications) uses `| ID | Evento | Canal | Destinatario | Contenido | Origen |` for
  its requirements and adds `## No se notifica`.
- Values are referenced by the parameter name in bold, never repeated.
- `entities`: the entities the block touches. They are how the loader brings the domain with the
  block.
- The block never cites operations: the contract cites the block's requirements (`x-requirements`).

### `prd/blocks/index.md` — GENERATED

`| Prefijo | Bloque | Superficies | Cubre | Último ID |`, built by `grava.py def-index` from
the blocks' frontmatter.

### `prd/parameters.md`

`| Parámetro | Valor | Variable | Origen |`

- A parameter is the value of a business rule, used by name in bold.
- `Variable`: environment variable and default (`BOOKING_HORIZON_DAYS=30`). English, derived by rule
  (the Spanish name translated, upper snake case, with the unit as suffix).
- A value a user edits from the interface is domain data, not a parameter. A purely technical value
  belongs to the service's `AGENTS.md` or a technical decision.

### `prd/decisions.md`

What was chosen on purpose, against which alternative, so nobody "fixes" it and a request that
changes it must say it reverts it.

```markdown
## De producto
| ID | Tema | Decisión | Descartado | Motivo | Afecta | Origen |

## Técnicas
| ID | Tema | Decisión | Descartado | Motivo | Afecta | Origen |

## Revertidas
| ID | Tema | Decía | Revertida por | Motivo | Ahora |
```

- `Descartado` is the essential column: what is not done.
- `Motivo`: why it was decided. `—` for the decisions inherited from the discovery (it records
  definitions, not reasons); **mandatory** for every decision a requirement adds or reverts.
- `Afecta`: block prefixes, actors (`U-01`), files (`parameters.md`), services or modules
  (`api`, `api.scheduling`). It is the loading key.
- Reverting moves the row to `Revertidas` (with the requirement in `Revertida por`) and, if there is
  a new decision, adds it with a new ID. The reverted ID is never reused.

### `prd/nfr.md`

`| ID | Categoría | Requisito | Target | Alcance | Verificación | Prueba en | Origen |`

- `Verificación`: `prueba` (a test, in the requirement of `Prueba en`: `base` or a `#id`), `alerta`
  (an alert in `docs/operacion.md`) or `revisión` (the verifier checks it by hand). Decided with the
  user when the base is specified; a requirement that changes it says so.

- Fixed categories: Volumen; Tiempos; Disponibilidad; Privacidad y cumplimiento; Accesibilidad;
  Idioma, zona horaria y formatos; Compatibilidad.
- `Alcance`: `producto`, a surface, or a service. The loader gives a task the NFRs of its surfaces
  and services plus the product-wide ones.

### `prd/out-of-scope.md`

`| Fuera de alcance | Origen |`, without IDs. Read whenever something new is defined. When a
requirement brings an item into the product, the row is removed, and the requirement records the
decision that brings it in: a `nueva` that names the item in `Descartado` («dejarlo fuera de alcance»),
or `revierte` of the decision that excluded it.

### `prd/domain/{entity}.md`

```markdown
---
entity: Turno
tables: [appointments]
describes: Reserva de un horario con un profesional y un servicio
---

# Turno

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |

## Atributos derivados        (only if any)
| Atributo | Regla de cálculo | Origen |

## Relaciones
- {relación con cardinalidad}

## Baja
{se elimina / se desactiva / nunca, y sus consecuencias referenciadas}

## Estados                    (only if the entity has states)
| Estado | Tipo | Significado | Origen |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
```

- File name: the main table in singular, kebab-case (`appointments` → `appointment.md`).
- Functional types (texto, número, booleano, fecha, hora, fecha y hora, duración, email, teléfono,
  dinero, enum, referencia). The database type is in the schema.
- `Disparado por` cites requirement IDs.
- Invariants are not here: they are in `invariants.md`, loaded by entity.

### `prd/domain/index.md` — GENERATED

`| Entidad | Archivo | Tablas | Describe |`, from the entities' frontmatter.

### `prd/domain/glossary.md`

`| Término | Definición | Origen |`. Terms that are not entities and that requirements use with a
precise meaning. Loaded with any block.

### `prd/domain/invariants.md`

`| ID | Regla | Entidades | Aplicada en | Origen |`

- `Entidades`: Spanish names, equal to the `entity` of each entity file (the loading key).
- `Aplicada en`: block prefixes.
- How it is enforced is in `guarantees.md`, which cites the `INV-XX`.

### `prd/architecture/services.md`

```markdown
## Servicios
| Servicio | Tipo | Lenguaje | Superficies | Expone | Carpeta | Origen |

## Módulos

### {servicio}
| Módulo | Entidades | Responsabilidad | Origen |

## Interacciones
| De → A | Para qué | Bloques | Origen |
```

- `Tipo`: `service` (a process), `library` (an imported package), `frontend` (serves surfaces).
- `Expone`: `HTTP`, `NATS`, `CLI`, a combination, or `—`.
- `Lenguaje`: language or framework (`node`, `go`, `nextjs`, `astro`, `flutter`…). The libraries are
  in the service's `AGENTS.md`.
- `Carpeta`: where the code lives (`services/api`).
- **Every entity has exactly one owner module**, which is the only one that writes it. A block may
  touch several modules; the loader computes them from the block's `entities` and the interactions
  that cite the block.
- Only `service` has modules. A frontend's structure is its own.

### `prd/architecture/integration.md`

```markdown
## Persistencia e infraestructura
| Componente | Tecnología | Dueño | Usado por | Origen |

## Comunicación
| De → A | Protocolo | Tipo | Para qué | Origen |

## Eventos                    (only if there is a bus between services)
| Evento | Publica | Consume | Transición | Origen |

## Integraciones externas
| ID | Sistema | Dirección | Datos | Cuándo | Fuente de verdad | Referencia | Origen |
```

`Referencia`: the documentation of the external system in `_gflow/references/`.

### `prd/architecture/auth.md`

OAuth 2.0 / OIDC vocabulary (issuer, bearer, verifier), even when OAuth is not used. **Which**
credentials exist is the product's; **how** they are implemented follows the engineering defaults.

```markdown
## Credenciales
| ID | Credencial | Emisor | Se obtiene | Vida y renovación | Revocación | Origen |

## Uso
| Credencial | Rol | Desde | Pasa por | Verifica | Origen |

## Roles
| Rol | Actores | Permite | Origen |

## Proveedores externos de identidad     (only if any)
| Proveedor | Protocolo | Para qué roles | Qué datos toma | Cómo se vincula a la cuenta | Referencia | Origen |
```

The permission of each operation is not here: each operation of the contract declares it.

### `prd/architecture/guarantees.md`

`| ID | Garantía | Regla | Mecanismo | Dónde | Origen |`

- `Regla`: the exact IDs it enforces (`INV-02`, `REP-02`, `CAN-E3`), or `—` for a guarantee that
  protects no rule with an ID ("un proceso programado por vez").
- `Dónde`: the database, or `servicio.módulo`.
- Every invariant has at least one guarantee. Every guarantee has a test named with
  its ID.

### `apis/{service}.openapi.yaml` and `apis/{service}.asyncapi.yaml`

The contract of what each service exposes, **written only when the operation is built**. It is what
external integrators read, so it must always match the implementation (a contract test verifies it;
see Engineering).

- OpenAPI 3.1 or later (the latest the chosen tooling supports); AsyncAPI 3 for NATS. One file per
  service and interface type.
- `info.version`: the contract's semantic version. A breaking change bumps the major.
- `tags`: one per module (`scheduling`), plus `system` for the general operations (health).
- Extensions on every operation:
  - `x-requirements: [CAN-01, CAN-03]`: the requirements it fulfills.
  - `x-origin: '#812'`: the requirement that added or last changed it.
  - `security` with the scheme of the credential, and `x-roles: [admin]`.
  - On every error response, `x-failure: CAN-E1`, the failure condition it comes from.
- `components.securitySchemes`: one per credential, with `x-credential: CRED-01`.
- Field names come from the schema (`starts_at` → `startsAt`).
- Concrete examples, taken from the block's examples when there are any.

### `db-schemas/{service}.md`

The database design: decisions of the schema, DBML, constraints DBML cannot express, derived
attributes. The bootstrap writes the shared part (engine, schema decisions, extensions and functions
every table uses); each requirement adds the tables of the blocks it builds. Conventions:
[Database](database.md). The schema document and the migrations always agree.

### `flows/{flow}.md`

How the pieces combine in an operation that crosses modules or services, or depends on a guarantee.

```markdown
---
flow: reserva
requirements: [RES-01, RES-02, RES-14]
modules: [api.scheduling, api.catalog, api.notifications]
---

# Reserva y turno manual, con "cualquiera"

{Caso de uso, en una o dos líneas.}

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
```

- A flow enters with the requirement that builds the last block it needs, and each step names the
  exact operation, message or table.
- Steps cite operations and tables by exact name; they never copy fields. Fields are written only
  where one step feeds the next (`appointments.id` → `notification_outbox.appointment_id`).

### `flows/index.md` — GENERATED

`| Flujo | Requisitos | Módulos |`, from the flows' frontmatter.

## Loading

**Never read the whole definition.** Ask the loader for the context of the task:

```bash
python3 .claude/scripts/grava.py load --block CAN --block RES      # by block
python3 .claude/scripts/grava.py load --id CAN-E1 --id INV-02      # by any ID
python3 .claude/scripts/grava.py load --entity Turno               # by entity
python3 .claude/scripts/grava.py load --module api.scheduling      # by module
python3 .claude/scripts/grava.py load --requirement 812            # what a specification in Jiku touches
python3 .claude/scripts/grava.py load --overview                   # index, blocks, domain, services
```

It prints, filtered to the keys: `prd/index.md`; the blocks; their decisions (by `Afecta`); the
glossary; the parameters they name; their entities; the invariants of those entities; the guarantees
of those invariants, blocks and modules; the NFRs of their surfaces, services and the product; the
interactions and flows that cite them; and the operations of the contracts whose `x-requirements` cite
them (summary: `operationId`, method, path). It lists the paths it read so the agent can open the
full file when it needs more.

## Who writes what

| Document | Created by | Changed by |
|---|---|---|
| `prd/` (product level: index, glossary, NFRs, out of scope, product decisions), `architecture/services.md` (services), `integration.md` (persistence, communication), the shared part of `db-schemas/` | `/product-bootstrap` (`grava.py def-base`) | `/req-implement` |
| Blocks, entities, invariants, guarantees, parameters, modules, integrations, credentials, tables, flows | `/req-implement`, applying the specification of the requirement that builds them | `/req-implement` |
| Everything, for an existing product | `/product-adopt` (from the code) | `/req-implement` |
| `apis/` | `/req-implement` (and `/product-adopt`) | `/req-implement` |
| `prd/blocks/index.md`, `prd/domain/index.md`, `flows/index.md` | `grava.py def-index` | `grava.py def-index` |
| `discovery/` | `/product-define` | nobody: frozen |

`/change` never changes the definition: if a change needs to, it is not small (see `/change`).

## Checks

```bash
python3 .claude/scripts/grava.py def-check
```

Deterministic, run after every change to the definition and before every commit that touches it:

- Every cited ID exists (blocks, invariants, guarantees, decisions, NFRs, credentials, integrations,
  actors). Every bold parameter exists in `parameters.md`.
- Every entity has exactly one owner module; every entity in a block's `entities` exists.
- Every invariant has a guarantee.
- `last_requirement` / `last_failure` are not lower than any ID in the block; no block has `status`.
- Generated indexes are up to date.
- Every `Origen` is `inicial` or `#{number}`.
- Contracts: every `x-requirements` and `x-failure` ID exists; every tag is a module of the service or
  `system`; every operation has `x-requirements` and `x-origin`; every error response, including the
  shared ones in `components.responses`, has `x-failure`.
- Every flow's `requirements` and `modules` exist.
- No placeholder (`{{…}}`) is left.
- The guides exist and are filled in: `README.md` and `docs/operacion.md` (people), every `AGENTS.md`
  (agents).
