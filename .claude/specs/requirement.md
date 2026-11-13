# Requirement Spec

The specification of one Jiku requirement: what it changes in the product and how we know it is done.
It lives **in Jiku**, in three fields of the requirement, so the team and the client read it where they
manage the work. It is, with the product definition, the only input `/req-implement` needs. Read this
before writing or reading a specification.

## CRITICAL RULES

1. **One Jiku requirement = one specification = one branch = one MR/PR.** The Jiku id is the identity
   everywhere: branch, `Origen` columns, local criteria in tests.
2. **Jiku holds the specification; the repository holds the product.** The specification is the
   functional definition plus the key technical details, at the level of the discovery: data,
   interface (API operations, NATS subjects), flows, architecture. Never code-level detail (files,
   functions, lines): that is `/req-implement`'s decision and lives only in the code.
3. **It declares a change; it never edits the definition.** Requirements wait, get postponed or
   cancelled. The definition (`_gflow/`) changes only when `/req-implement` applies the specification.
4. **The user decides; the agent challenges.** Every rule, decision, criterion and scope boundary is
   the user's. What is already written in the requirement is input, not truth: the agent contrasts it
   like any request and shows every disagreement as a conflict for the user to decide.
5. **Every acceptance criterion is verifiable and identified.** A criterion that cannot be tested is
   rewritten or removed.
6. **Deterministic work goes through `grava.py`**: the draft, IDs, the check, writing to Jiku, the
   difference with what is implemented, the evidence.

## Where it lives

| Jiku field | Section | Contains |
|---|---|---|
| `scope` (Alcance) | Alcance | What is included, what is not, and which requirements it depends on |
| `technicalSolution` (Propuesta) | Propuesta | The solution in business terms, parameters, decisions, technical detail |
| `acceptanceCriteria` (Criterios de aceptación) | Criterios | The criteria, each with its change and its ID |

The fields are markdown: Jiku stores them as text and renders them with GFM, so tables survive intact
(verified). A person may edit them in Jiku; the scripts read whatever is there and **report every row
they cannot read** instead of ignoring it.

While `/req-specify` works, a **draft** holds the three fields in the system's temp folder
(`grava.py spec draft {id}` prints the path). It is written to Jiku only when the specification is
closed (`grava.py spec push {id}`), so the requirement's history does not fill with half-done edits.
The draft is lost on reboot; without a draft, `/req-specify` starts over and says so.

## Format

### Alcance

```markdown
## Incluye
- **CAN — Cancelación por el cliente:** cancelación desde el link del email, hasta el inicio del turno.

## No incluye
- Avisos por SMS: se piden en otro requisito.

## Depende de
- #812 Reserva
```

`Depende de` lists the requirements that must be merged before this one is implemented, or
`- Nada.` It sets the order: `/req-implement` stops, without asking, while a dependency is not
merged in `dev` (`grava.py spec order`); `/req-specify` only warns, because specifying ahead is
planning. A specification cites only what exists in the definition, what it adds itself, or what a
dependency adds (`S10`): the definition it leaves in `dev` never documents what is not built.

A `respeta` decision whose `Afecta` names IDs this requirement adds extends the decision's `Afecta`
in the definition (the plan uses it when a decision taken in an earlier part also governs a later
one).

### Propuesta

```markdown
{La solución en términos de negocio, en 2 a 5 líneas.}

## Parámetros
| Cambio | Parámetro | Valor | Variable |
|---|---|---|---|
| agrega | Margen de cancelación tras el inicio | 15 minutos | `CANCELLATION_MARGIN_AFTER_START_MINUTES=15` |

## Decisiones
| Tipo | ID | Tema | Decisión | Descartado | Motivo | Afecta |
|---|---|---|---|---|---|---|
| nueva | DEC-17 | Cancelación tardía | Hasta 15 minutos después del inicio | Hasta 1 hora | A los 30 minutos el turno pasa a ausente | CAN-01, CAN-E1 |
| revierte | DEC-03 | … | Ahora: … | — | {motivo} | … |
| respeta | DEC-05 | Ausente automático | Sigue siendo definitivo: el margen termina antes | — | — | AUS-01 |

## Detalle técnico
### Bloques
| Cambio | Prefijo | Bloque | Superficies | Entidades |
### Datos
#### {Entidad} (agrega | modifica)
{las tablas de la entidad, como en la definición: atributos, estados, transiciones}
### Invariantes y garantías
| Cambio | ID | Regla | Entidades | Aplicada en |
| Cambio | ID | Garantía | Regla | Mecanismo | Dónde |
### Esquema
{DBML de las tablas y enums que se agregan o cambian; restricciones que DBML no expresa}
### Interfaz
{operaciones de la API o subjects de NATS a nivel funcional: qué hace, quién la llama, qué reglas
cumple, si rompe a un integrador externo. Paths, campos y códigos solo si el usuario los fijó}
### Flujos
{los pasos entre servicios y módulos}
### Glosario
| Cambio | Término | Definición |
### Arquitectura
{módulos, interacciones, persistencia, comunicación, integraciones, credenciales y roles}
```

Only the sections that apply. `Detalle técnico` is what a developer needs to understand the change
without reading the discovery; it never says how to write the code.

### Criterios de aceptación

```markdown
| Cambio | ID | Criterio |
|---|---|---|
| modifica | CAN-01 | Cancelar el turno desde el link … hasta que pase el **margen de cancelación tras el inicio** |
| modifica | CAN-E1 | Pasó el margen desde la hora de inicio → No se cancela. Se informa que ya no se puede cancelar online |
| agrega | CAN-E4 | El margen configurado no es menor que la **ventana de ausente automático** → api no arranca |
| agrega | 812-AC-01 | Las cancelaciones pendientes al desplegar siguen la regla nueva |
```

- `Cambio`: `agrega`, `modifica` (the full new text) or `elimina`. It tells `/req-implement` what to do
  with the row in the definition. Every row of a requirement that builds new blocks is `agrega`.
- `ID`: an ID of the definition — a block requirement (`CAN-06`), a failure condition (`CAN-E4`), an
  invariant (`INV-02`), a guarantee (`GAR-04`) or an NFR (`NFR-04`) — or a **local criterion**
  `{id}-AC-NN`, only for what is not product definition (technical criteria, a migration of data).
- `Criterio`: the row as it will read in the definition. A failure condition is written
  `condición → resultado`. It says what must be observable.

Rules:

- Every requirement, failure condition, invariant and guarantee the change adds or modifies is a
  criterion. Unchanged IDs enter only if the requirement can break them.
- Every criterion has at least one test whose name contains the ID in brackets: `[CAN-E4] …`.
  `grava.py coverage` checks it.
- A criterion that maps to nothing in the definition means the definition is missing something: add
  the row instead of a local criterion.

## IDs

New IDs come from `grava.py next-id {KIND} --requirement {id}`. It looks at the definition **and at
every open requirement of the project in Jiku**: the IDs a requirement adds (criteria and technical
rows marked `agrega`, new decisions) are reserved until it is implemented or cancelled. Cited IDs
reserve nothing. If Jiku does not answer, `next-id` stops: an ID is never guessed.

## States

Jiku's states, and who moves them:

| State | Meaning | Moved by |
|---|---|---|
| `analisis` | The request arrived | People |
| `planificacion` | To specify, or specified and waiting for approval | People (to specify); the plan's requirements are born here |
| `en_cola` | Approved, waiting for priority | People |
| `desarrollo` | Implementation, verification, MR/PR and human review, until the merge | The agent when it creates the branch; `/req-specify` when it reopens a requirement |
| `revision` | In production: making sure it works and is stable | People |
| `resuelto` / `cancelado` | Closed | People |

- `/req-specify` expects `planificacion`. In another state it warns and asks; a `revision` or
  `resuelto` requirement is reopened (back to `desarrollo`) when the user confirms; `cancelado` aborts.
- `/req-implement` expects `en_cola`. In another state it warns and asks.

## Changing a specification

Always with `/req-specify {id} [what changes]`. Whatever the user says and whatever was edited in Jiku
is contrasted with the definition. A requirement already merged is **reopened**, never duplicated:
`/req-implement` then works on a new branch (`feat/{id}-{slug}-2`) and applies only the difference
between the specification and what `dev` has (`grava.py spec diff {id}`).

## Checks

```bash
python3 .claude/scripts/grava.py spec check {id} [--source draft] [--implement]
```

| Code | Checks |
|---|---|
| S1 | The three fields have content |
| S2 | Every criterion row can be read |
| S3 | `Cambio` is valid; every ID is a definition ID or `{id}-AC-NN`; every criterion has text |
| S4 | `modifica` / `elimina` on an ID that exists or that a dependency adds (and says so when another open requirement adds it, not built yet); `agrega` on a free ID |
| S5 | No ID it adds is added by another open requirement |
| S6 | Decision types; `nueva` and `revierte` have their motivo; `respeta` and `revierte` cite an existing decision (or one a dependency adds) |
| S7 | Parameters' `Cambio` |
| S8 | No `{{…}}` marker left |
| S9 | With `--implement`: every `Depende de` is merged in `dev` (commits with `(#id)`); no `respeta` decision was reverted since |
| S10 | Every ID it cites exists in the definition, is added by this specification, or by a requirement in its `Depende de` |
| S11 | The criterion of an invariant or guarantee it adds or modifies says exactly what its row in «Invariantes y garantías» says (`Regla`; `Garantía: Mecanismo`): the definition keeps one text |
| S12 | Every invariant or guarantee it adds or modifies is a criterion |
| S13 | A parameter that changes value is not still stated with its old value by a decision or a row of the definition the specification leaves untouched (a decision is reverted, a row modified) |
| S14 | A parameter is modified or removed only if it exists, and added only if it does not |
| S15 | `respeta` and `revierte` only on decisions (`DEC`, `DEC-T`); a decision, credential or actor is never a criterion |
| — | «Decidido en la implementación: A, B.» after the criteria table marks criteria `/req-implement` added with `spec amend` (only small things, see its Rule 2); `/req-specify` shows them to the user to keep or change |
| S18 | With `--implement`: the requirement's description says «Especificación: lista» (not a draft from the initial plan) |
| S19 | Every row of «Requisitos no funcionales» in the proposal (the base) says how it is verified (`prueba`, with `Prueba en`: `base` or `#id`; `alerta`; `revisión`). Not checked on the plan's drafts: it is settled when the base is specified |
| S17 | A line of «No incluye» that leaves something for another requirement names it (`#id`) |
| S16 | Bringing in an item of «Fuera de alcance» (it appears outside «No incluye») needs the decision that brings it in: a `nueva` that names it, or `revierte` of the one that excluded it |

`grava.py spec diff {id}` also compares the definition of `dev` with the branch's, for what no criterion
accounts for: a decision whose Tema, Decisión, Descartado or Motivo changed (only `Afecta` may change
without reverting it), a row whose text changed without a criterion, a row removed from «Fuera de
alcance» without the decision of S16.

`grava.py spec order {id}` shows where a requirement stands: each dependency (`MERGED`, `PENDING`,
`CANCELLED`) and the open requirements that depend on it, with the IDs they cite that this one
modifies, removes or reverts.

## Evidence

`/req-implement` computes it with `grava.py evidence {id}` from the JUnit reports (criterion → test →
result). It goes to the MR/PR description and, in business terms (criterion → met, no test names),
to the Jiku comment. The repository keeps the tests, named with their IDs.
