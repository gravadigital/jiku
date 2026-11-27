# Product Definition

The living definition of the product: what it is, its rules, what is built, and why it is the way it
is. Every skill that plans, implements or answers questions reads it; a new request is evaluated
against it. It lives in `_jflow/`, the workflow's memory, written for agents (documentation for people
is in `docs/`, `README.md` and `CHANGELOG.md`). Read this before reading or writing anything under
`_jflow/`.

## CRITICAL RULES

1. **Three parts, one truth.**
   - **Product and business**: actors, functional blocks, domain, rules, parameters, NFRs, out of
     scope.
   - **Current state**: services and modules, contracts, schema, flows.
   - **History**: decisions with what was discarded, and the reverted ones.
2. **It describes only what is built.** What is still to build lives in the Jiku requirements, each
   with its specification. A specification declares a change; the definition changes when
   `/jflow-build` applies it in the requirement's branch. Nothing else writes the definition after
   the product is bootstrapped or adopted. In `dev`, the definition describes what is merged.
3. **Stable IDs everywhere.** Every row that can be cited has an ID that is never reused. Pieces cite
   each other by ID; the scripts compute what to load and check consistency from them.
4. **Origin on every row.** `initial` (bootstrap or adopt) or the Jiku requirement that added or last
   changed it, as `#812`.
5. **Written for agents.** Tables with fixed columns, IDs, and load conditions expressed with the
   keys an agent has at hand. No narrative, no rationale outside the decisions.
6. **Deterministic work goes through `jflow.py`.** Indexes are generated, IDs are allocated,
   consistency is checked and context is loaded by the script. Never hand-edit a generated index,
   never pick an ID by reading the files.
7. **English structure, content in the product language.** Headings, table columns, fixed values
   (`initial`, `product`, `test`…) and the text the scripts generate are English. Content stays in the
   product language, never translated ([Language](language.md)): rows are copied word for word from
   the criteria in Jiku and from the discovery, and domain names (entities, surfaces, blocks,
   parameters, states, roles) are the product's ubiquitous language. Identifiers — database table and
   column names, enum values, API paths, JSON fields, `operationId`s, module ids, file names — are
   English.

## Layout

```
_jflow/
├── project.yaml                  # Jiku project and instance, git platform and branches (see Jiku spec)
├── discovery/                    # frozen after /jflow-product-discover: the original analysis (history)
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
│       ├── guarantees.md         # how each rule that must always hold is enforced
│       └── testing.md            # how each entry is tested end to end: identities, external systems
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
| Entity | its name in the product language (`Turno`) | `prd/domain/{entity}.md` |
| Module | `{service}.{module}` | `prd/architecture/services.md` |
| Operation | `operationId` | `apis/` |
| Jiku requirement | `#812` | Jiku |

- IDs are never reused. A removed row disappears from its file; its ID stays burned.
- **Never pick a new ID by hand**: `jflow.py next-id {KIND}` returns the next free one, looking at the
  definition **and** at every open requirement in Jiku (they reserve the IDs they add).

## Files

Every table below has an `Origin` column (`initial` or `#812`) unless stated otherwise. The
examples keep Turnero's content in Spanish; their structure is the definition's, in English.

### `prd/index.md`

The entry point. Small and stable: everybody loads it.

```markdown
# {Product}

{What it is, in 2-3 lines.}

## Actors
| ID | Actor | Access | Access recovery | Origin |

## Surfaces
| Surface | Platform | Actors | Viewports | Service | Origin |

## Documentation
| Document | Contains | Load when |
```

The `Documentation` table is fixed (it comes from the template in `jflow.py`): it tells an agent which
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

## Requirements
| ID | Requirement | Actor | Origin |

## Failure conditions
| ID | Condition | Result | Origin |

## Configurations           (only if the user chooses options)
| Configuration | Default | Alternatives | Origin |

## Examples                 (only for logic with calculations or conditions)
- CAN-03: {caso con valores concretos}
```

- A block exists in the definition only once it is built. It has no status.
- The NOT block (notifications) uses `| ID | Event | Channel | Recipient | Content | Origin |` for
  its requirements and adds `## Not notified`.
- Values are referenced by the parameter name in bold, never repeated.
- `entities`: the entities the block touches. They are how the loader brings the domain with the
  block.
- The block never cites operations: the contract cites the block's requirements (`x-requirements`).

### `prd/blocks/index.md` — GENERATED

`| Prefix | Block | Surfaces | Covers | Last ID |`, built by `jflow.py def-index` from
the blocks' frontmatter.

### `prd/parameters.md`

`| Parameter | Value | Variable | Origin |`

- A parameter is the value of a business rule, used by name in bold.
- `Variable`: environment variable and default (`BOOKING_HORIZON_DAYS=30`). English, derived by rule
  (the parameter's name translated to English, upper snake case, with the unit as suffix).
- A value a user edits from the interface is domain data, not a parameter. A purely technical value
  belongs to the service's `AGENTS.md` or a technical decision.

### `prd/decisions.md`

What was chosen on purpose, against which alternative, so nobody "fixes" it and a request that
changes it must say it reverts it.

```markdown
## Product
| ID | Topic | Decision | Rejected | Reason | Affects | Origin |

## Technical
| ID | Topic | Decision | Rejected | Reason | Affects | Origin |

## Reverted
| ID | Topic | Said | Reverted by | Reason | Now |
```

- `Rejected` is the essential column: what is not done.
- `Reason`: why it was decided. `—` for the decisions inherited from the discovery (it records
  definitions, not reasons); **mandatory** for every decision a requirement adds or reverts.
- `Affects`: block prefixes, actors (`U-01`), files (`parameters.md`), services or modules
  (`api`, `api.scheduling`). It is the loading key.
- Reverting moves the row to `Reverted` (with the requirement in `Reverted by`) and, if there is
  a new decision, adds it with a new ID. The reverted ID is never reused.

### `prd/nfr.md`

`| ID | Category | Requirement | Target | Scope | Verification | Tested in | Origin |`

- `Verification`: `test` (a test, in the requirement of `Tested in`: `base` or a `#id`), `alert`
  (an alert in the operations guide: `docs/operacion.md` in Spanish, `docs/operations.md` otherwise)
  or `review` (the verifier checks it by hand). Decided with the
  user when the base is specified; a requirement that changes it says so.

- Fixed categories: Volume; Response times; Availability; Privacy and compliance; Accessibility;
  Language, time zone and formats; Compatibility (their Spanish names in `jflow.py lang-terms`).
- `Scope`: `product`, a surface, or a service. The loader gives a task the NFRs of its surfaces
  and services plus the product-wide ones.

### `prd/out-of-scope.md`

`| Out of scope | Origin |`, without IDs. Read whenever something new is defined. When a
requirement brings an item into the product, the row is removed, and the requirement records the
decision that brings it in: a `new` that names the item in `Rejected` («dejarlo fuera de alcance»),
or `reverts` of the decision that excluded it.

### `prd/domain/{entity}.md`

```markdown
---
entity: Turno
tables: [appointments]
describes: Reserva de un horario con un profesional y un servicio
---

# Turno

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |

## Derived attributes         (only if any)
| Attribute | Calculation rule | Origin |

## Relationships
- {relación con cardinalidad}

## Removal
{se elimina / se desactiva / nunca, y sus consecuencias referenciadas}

## States                     (only if the entity has states)
| State | Type | Meaning | Origin |

## Transitions
| From | To | Triggered by | Origin |
```

- File name: the main table in singular, kebab-case (`appointments` → `appointment.md`).
- Functional types (texto, número, booleano, fecha, hora, fecha y hora, duración, email, teléfono,
  dinero, enum, referencia). The database type is in the schema.
- `Triggered by` cites requirement IDs.
- Invariants are not here: they are in `invariants.md`, loaded by entity.

### `prd/domain/index.md` — GENERATED

`| Entity | File | Tables | Describes |`, from the entities' frontmatter.

### `prd/domain/glossary.md`

`| Term | Definition | Origin |`. Terms that are not entities and that requirements use with a
precise meaning. Loaded with any block.

### `prd/domain/invariants.md`

`| ID | Rule | Entities | Applied in | Origin |`

- `Entities`: entity names, equal to the `entity` of each entity file (the loading key).
- `Applied in`: block prefixes.
- How it is enforced is in `guarantees.md`, which cites the `INV-XX`.

### `prd/architecture/services.md`

```markdown
## Services
| Service | Type | Language | Surfaces | Exposes | Folder | Origin |

## Modules

### {service}
| Module | Entities | Responsibility | Origin |

## Interactions
| From → To | Purpose | Blocks | Origin |
```

- `Type`: `service` (a process), `library` (an imported package), `frontend` (serves surfaces).
- `Exposes`: `HTTP`, `NATS`, `CLI`, a combination, or `—`.
- `Language`: language or framework (`node`, `go`, `nextjs`, `astro`, `flutter`…). The libraries are
  in the service's `AGENTS.md`.
- `Folder`: where the code lives (`services/api`).
- **Every entity has exactly one owner module**, which is the only one that writes it. A block may
  touch several modules; the loader computes them from the block's `entities` and the interactions
  that cite the block.
- Only `service` has modules. A frontend's structure is its own.

### `prd/architecture/integration.md`

```markdown
## Persistence and infrastructure
| Component | Technology | Owner | Used by | Origin |

## Communication
| From → To | Protocol | Type | Purpose | Origin |

## Events                     (only if there is a bus between services)
| Event | Publishes | Consumes | Transition | Origin |

## External integrations
| ID | System | Direction | Data | When | Source of truth | Reference | Origin |
```

`Reference`: the documentation of the external system in `_jflow/references/`.

### `prd/architecture/auth.md`

OAuth 2.0 / OIDC vocabulary (issuer, bearer, verifier), even when OAuth is not used. **Which**
credentials exist is the product's; **how** they are implemented follows the engineering defaults.

```markdown
## Credentials
| ID | Credential | Issuer | Obtained | Lifetime and renewal | Revocation | Origin |

## Use
| Credential | Role | From | Passes through | Verifies | Origin |

## Roles
| Role | Actors | Allows | Origin |

## External identity providers     (only if any)
| Provider | Protocol | For which roles | Data it takes | How it is linked to the account | Reference | Origin |
```

The permission of each operation is not here: each operation of the contract declares it.

### `prd/architecture/guarantees.md`

`| ID | Guarantee | Rule | Mechanism | Where | Origin |`

- `Rule`: the exact IDs it enforces (`INV-02`, `REP-02`, `CAN-E3`), or `—` for a guarantee that
  protects no rule with an ID ("un proceso programado por vez").
- `Where`: the database, or `service.module`.
- Every invariant has at least one guarantee. Every guarantee has a test named with
  its ID.

### `prd/architecture/testing.md`

How the product is tested end to end, as [Engineering](engineering.md) says («How the product is
tested»). It is what makes «done» mean the same thing in every product.

```markdown
## Entry points
| Entry point | Type | Service | Actors | How it is tested | Test | Origin |

## Test identities
| Role | How the identity is obtained in tests | Origin |

## External systems
| System | How it is replaced in tests | Origin |

## How to run them
(free text: how the product comes up for the tests, the test data, the command, what runs only locally)
```

- `Entry points`: one row per surface of `prd/index.md` (`Type` = its `Platform`) and one per interface a
  service exposes (`Exposes` of `services.md`: `HTTP`, `NATS`, `CLI`; `Entry point` = `{service} {type}`).
  `How it is tested`: how the test enters as the actor (the browser, an HTTP client with a token of the
  role, a client of the broker authenticated as the actor). `Test`: where its end-to-end tests are.
- `Test identities`: one row per role of `auth.md`: the fake issuer of the `test` profile and
  the claims it signs, or the variables of `.env` with the test identity of the real provider (then a
  `DEC-T` says why).
- `External systems`: one row per external integration (`INT-xx {system}`): its local version, a
  fake server, or a sandbox with credentials in `.env`.
- `jflow.py def-testing` adds the rows that are missing (with `{{fill}}` markers); `def-check` requires
  every one (`T1` entries, `T2` roles, `T3` integrations).

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

| # | From → To | What happens | Operation / table | Rules |
```

- A flow enters with the requirement that builds the last block it needs, and each step names the
  exact operation, message or table.
- Steps cite operations and tables by exact name; they never copy fields. Fields are written only
  where one step feeds the next (`appointments.id` → `notification_outbox.appointment_id`).

### `flows/index.md` — GENERATED

`| Flow | Requirements | Modules |`, from the flows' frontmatter.

## Loading

**Never read the whole definition.** Ask the loader for the context of the task:

```bash
python3 .claude/scripts/jflow.py load --block CAN --block RES      # by block
python3 .claude/scripts/jflow.py load --id CAN-E1 --id INV-02      # by any ID
python3 .claude/scripts/jflow.py load --entity Turno               # by entity
python3 .claude/scripts/jflow.py load --module api.scheduling      # by module
python3 .claude/scripts/jflow.py load --requirement 812            # what a specification in Jiku touches
python3 .claude/scripts/jflow.py load --overview                   # index, blocks, domain, services
```

It prints, filtered to the keys: `prd/index.md`; the blocks; their decisions (by `Affects`); the
glossary; the parameters they name; their entities; the invariants of those entities; the guarantees
of those invariants, blocks and modules; the NFRs of their surfaces, services and the product; the
interactions and flows that cite them; and the operations of the contracts whose `x-requirements` cite
them (summary: `operationId`, method, path). It lists the paths it read so the agent can open the
full file when it needs more.

## Who writes what

| Document | Created by | Changed by |
|---|---|---|
| `prd/` (product level: index, glossary, NFRs, out of scope, product decisions), `architecture/services.md` (services), `integration.md` (persistence, communication), the shared part of `db-schemas/`, `architecture/testing.md` | `/jflow-product-scaffold` (`jflow.py def-base`) | `/jflow-build` (`testing.md`: `jflow.py def-testing` when it adds an entry, a role or an integration) |
| Blocks, entities, invariants, guarantees, parameters, modules, integrations, credentials, tables, flows | `/jflow-build`, applying the specification of the requirement that builds them | `/jflow-build` |
| Everything, for an existing product | `/jflow-product-brownfield` (from the code) | `/jflow-build` |
| `apis/` | `/jflow-build` (and `/jflow-product-brownfield`) | `/jflow-build` |
| `prd/blocks/index.md`, `prd/domain/index.md`, `flows/index.md` | `jflow.py def-index` | `jflow.py def-index` |
| `discovery/` | `/jflow-product-discover` | nobody: frozen |

`/jflow-fix` never changes the definition: if a change needs to, it is not small (see `/jflow-fix`).

## Checks

```bash
python3 .claude/scripts/jflow.py def-check
```

Deterministic, run after every change to the definition and before every commit that touches it:

- Every cited ID exists (blocks, invariants, guarantees, decisions, NFRs, credentials, integrations,
  actors). Every bold parameter exists in `parameters.md`.
- Every entity has exactly one owner module; every entity in a block's `entities` exists.
- Every invariant has a guarantee.
- `last_requirement` / `last_failure` are not lower than any ID in the block; no block has `status`.
- Generated indexes are up to date.
- Every `Origin` is `initial` or `#{number}`.
- Contracts: every `x-requirements` and `x-failure` ID exists; every tag is a module of the service or
  `system`; every operation has `x-requirements` and `x-origin`; every error response, including the
  shared ones in `components.responses`, has `x-failure`.
- Every flow's `requirements` and `modules` exist.
- `architecture/testing.md` has a row per surface, per exposed interface, per role and per external
  integration, and every entry says how it is tested and where its test is.
- No placeholder (`{{…}}`) is left.
- The guides exist and are filled in (no `{{fill: …}}` or `{{completar: …}}` left): `README.md` and the
  operations guide (people, in the product language), every `AGENTS.md` (agents).
