# Requirement Spec

The specification of one Jiku requirement: what it changes in the product and how we know it is done.
It lives **in Jiku**, in three fields of the requirement, so the team and the client read it where they
manage the work. It is, with the product definition, the only input `/jflow-build` needs. Read this
before writing or reading a specification.

## CRITICAL RULES

1. **One Jiku requirement = one specification = one branch = one MR/PR.** The Jiku id is the identity
   everywhere: branch, `Origin` columns, local criteria in tests.
2. **Jiku holds the specification; the repository holds the product.** The specification is the
   functional definition plus the key technical details, at the level of the discovery: data,
   interface (API operations, NATS subjects), flows, architecture. Never code-level detail (files,
   functions, lines): that is `/jflow-build`'s decision and lives only in the code.
3. **It declares a change; it never edits the definition.** Requirements wait, get postponed or
   cancelled. The definition (`_jflow/`) changes only when `/jflow-build` applies the specification.
4. **The user decides; the agent challenges.** Every rule, decision, criterion and scope boundary is
   the user's. What is already written in the requirement is input, not truth: the agent contrasts it
   like any request and shows every disagreement as a conflict for the user to decide.
5. **Every acceptance criterion is verifiable and identified.** A criterion that cannot be tested is
   rewritten or removed.
6. **Deterministic work goes through `jflow.py`**: the draft, IDs, the check, writing to Jiku, the
   difference with what is implemented, the evidence.

## Where it lives

| Jiku field | Section | Contains |
|---|---|---|
| `scope` | Scope (Alcance) | What is included, what is not, and which requirements it depends on |
| `technicalSolution` | Proposal (Propuesta) | The solution in business terms, parameters, decisions, technical detail |
| `acceptanceCriteria` | Acceptance criteria (Criterios de aceptación) | The criteria, each with its change and its ID |

The specification is a document for people: its content is in the product language and its structure
(headings, columns, fixed values, labels) in Spanish when the product language is Spanish and in
English otherwise; the scripts read both ([Language](language.md)). This spec names each element in
English; `jflow.py lang-terms` gives its Spanish name. The examples are Turnero's, with English
structure.

The fields are markdown: Jiku stores them as text and renders them with GFM, so tables survive intact
(verified). A person may edit them in Jiku; the scripts read whatever is there and **report every row
they cannot read** instead of ignoring it.

While `/jflow-spec` works, a **draft** holds the three fields in the system's temp folder
(`jflow.py spec draft {id}` prints the path). It is written to Jiku only when the specification is
closed (`jflow.py spec push {id}`), so the requirement's history does not fill with half-done edits.
The draft is lost on reboot; without a draft, `/jflow-spec` starts over and says so.

## Format

### Scope

```markdown
## Includes
- **CAN — Cancelación por el cliente:** cancelación desde el link del email, hasta el inicio del turno.

## Excludes
- Avisos por SMS: se piden en otro requisito.

## Depends on
- #812 Reserva
```

`Depends on` lists the requirements that must be merged before this one is implemented, or
`- Nothing.` (`- Nada.`). It sets the order: `/jflow-build` stops, without asking, while a dependency is not
merged in `dev` (`jflow.py spec order`); `/jflow-spec` only warns, because specifying ahead is
planning. A specification cites only what exists in the definition, what it adds itself, or what a
dependency adds (`S10`): the definition it leaves in `dev` never documents what is not built.

A `keeps` decision whose `Affects` names IDs this requirement adds extends the decision's `Affects`
in the definition (the plan uses it when a decision taken in an earlier part also governs a later
one).

### Proposal

```markdown
{The solution in business terms, in 2 to 5 lines.}

## Parameters
| Change | Parameter | Value | Variable |
|---|---|---|---|
| add | Margen de cancelación tras el inicio | 15 minutos | `CANCELLATION_MARGIN_AFTER_START_MINUTES=15` |

## Decisions
| Type | ID | Topic | Decision | Rejected | Reason | Affects |
|---|---|---|---|---|---|---|
| new | DEC-17 | Cancelación tardía | Hasta 15 minutos después del inicio | Hasta 1 hora | A los 30 minutos el turno pasa a ausente | CAN-01, CAN-E1 |
| reverts | DEC-03 | … | Ahora: … | — | {reason} | … |
| keeps | DEC-05 | Ausente automático | Sigue siendo definitivo: el margen termina antes | — | — | AUS-01 |

## Technical detail
### Blocks
| Change | Prefix | Block | Surfaces | Entities |
### Data
#### {Entity} (add | modify)
{the entity's tables, as in the definition: attributes, states, transitions}
### Invariants and guarantees
| Change | ID | Rule | Entities | Applied in |
| Change | ID | Guarantee | Rule | Mechanism | Where |
### Schema
{DBML of the tables and enums added or changed; constraints DBML does not express}
### Interface
{API operations or NATS subjects at functional level: what it does, who calls it, which rules it
keeps, whether it breaks an external integrator. Paths, fields and codes only if the user fixed them}
### Flows
{the steps between services and modules}
### Glossary
| Change | Term | Definition |
### Architecture
{modules, interactions, persistence, communication, integrations, credentials and roles}
### Visual reference
Package: `{path of the package in the repo}` ({Jiku attachment})

| Screen | Reference | Route | State |
|---|---|---|---|
| {short name, the screenshot's} | {file inside the package} | {route of the surface} | {role, stage and data it looks like this with} |

| Decided difference | Screens | Decision |
|---|---|---|
| {the only thing that may look different from the reference} | {screens, or «all»} | {ID of the decision or requirement that sets it} |
```

Only the sections that apply. `Technical detail` is what a developer needs to understand the change
without reading the discovery; it never says how to write the code.

**Visual reference** — when the requirement comes with a design (screens, an HTML prototype, a
design package) the product must look like. One row per screen of the reference, with the route and
the state that reproduce it. The «Decided difference» table is closed: each difference is a
decision, a rule of the definition or something the user chose, and everything not listed must look
as the reference does — colors, sizes, shapes, spacing, components, hierarchy, texts (except the
data). A local criterion carries it, in the product language: «{id}-AC-NN: Cada pantalla de la
referencia visual se ve como su referencia, salvo las diferencias decididas». Screenshots are named
after the `Screen` (`{screen}.png` or `{screen}-{size}.png`), and `jflow.py visual-pairs {id}` puts each
reference next to its screenshot, in `reports/screenshots/{id}/pairs/`. The package lives in the repository at the path given (versioned, or in a
git-ignored folder, as the team prefers) so the implementation and the verifier can read it.

### Acceptance criteria

```markdown
| Change | ID | Criterion |
|---|---|---|
| modify | CAN-01 | Cancelar el turno desde el link … hasta que pase el **margen de cancelación tras el inicio** |
| modify | CAN-E1 | Pasó el margen desde la hora de inicio → No se cancela. Se informa que ya no se puede cancelar online |
| add | CAN-E4 | El margen configurado no es menor que la **ventana de ausente automático** → api no arranca |
| add | 812-AC-01 | Las cancelaciones pendientes al desplegar siguen la regla nueva |
```

- `Change`: `add`, `modify` (the full new text) or `remove` (Spanish: `agrega`, `modifica`, `elimina`).
  It tells `/jflow-build` what to do with the row in the definition. Every row of a requirement that
  builds new blocks is `add`.
- `ID`: an ID of the definition — a block requirement (`CAN-06`), a failure condition (`CAN-E4`), an
  invariant (`INV-02`), a guarantee (`GAR-04`) or an NFR (`NFR-04`) — or a **local criterion**
  `{id}-AC-NN`, only for what is not product definition (technical criteria, a migration of data).
- `Criterion`: the row as it will read in the definition, copied there word for word. A failure
  condition is written `condition → result`; a notification of the NOT block, as the plan writes it,
  `{Event}: {Channel} → {Recipient} — {Content}`. It says what must be observable.

Rules:

- Every requirement, failure condition, invariant and guarantee the change adds or modifies is a
  criterion. Unchanged IDs enter only if the requirement can break them.
- Every criterion has at least one test whose name contains the ID in brackets: `[CAN-E4] …`.
  `jflow.py coverage` checks it.
- A criterion that maps to nothing in the definition means the definition is missing something: add
  the row instead of a local criterion.

## IDs

New IDs come from `jflow.py next-id {KIND} --requirement {id}`. It looks at the definition **and at
every open requirement of the project in Jiku**: the IDs a requirement adds (criteria and technical
rows marked `add`, new decisions) are reserved until it is implemented or cancelled. Cited IDs
reserve nothing. If Jiku does not answer, `next-id` stops: an ID is never guessed.

## States

Jiku's states, and who moves them:

| State | Meaning | Moved by |
|---|---|---|
| `analisis` | The request arrived | People |
| `planificacion` | To specify, or specified and waiting for approval | People (to specify); the plan's requirements are born here |
| `en_cola` | Approved, waiting for priority | People |
| `desarrollo` | Implementation, verification, MR/PR and human review, until the merge | The agent when it creates the branch; `/jflow-spec` when it reopens a requirement |
| `revision` | In production: making sure it works and is stable | People |
| `resuelto` / `cancelado` | Closed | People |

- `/jflow-spec` expects `planificacion`. In another state it warns and asks; a `revision` or
  `resuelto` requirement is reopened (back to `desarrollo`) when the user confirms; `cancelado` aborts.
- `/jflow-build` expects `en_cola`. In another state it warns and asks.

## Changing a specification

Always with `/jflow-spec {id} [what changes]`. Whatever the user says and whatever was edited in Jiku
is contrasted with the definition. A requirement already merged is **reopened**, never duplicated:
`/jflow-build` then works on a new branch (`feat/{id}-{slug}-2`) and applies only the difference
between the specification and what `dev` has (`jflow.py spec diff {id}`).

## Checks

```bash
python3 .claude/scripts/jflow.py spec check {id} [--source draft] [--implement]
```

| Code | Checks |
|---|---|
| S1 | The three fields have content |
| S2 | Every criterion row can be read |
| S3 | `Change` is valid; every ID is a definition ID or `{id}-AC-NN`; every criterion has text |
| S4 | `modify` / `remove` on an ID that exists or that a dependency adds (and says so when another open requirement adds it, not built yet); `add` on a free ID |
| S5 | No ID it adds is added by another open requirement |
| S6 | Decision types; `new` and `reverts` have their reason; `keeps` and `reverts` cite an existing decision (or one a dependency adds) |
| S7 | Parameters' `Change` |
| S8 | No `{{…}}` marker left |
| S9 | With `--implement`: every `Depends on` is merged in `dev` (commits with `(#id)`); no `keeps` decision was reverted since |
| S10 | Every ID it cites exists in the definition, is added by this specification, or by a requirement in its `Depends on` |
| S11 | The criterion of an invariant or guarantee it adds or modifies says exactly what its row in «Invariants and guarantees» says (`Rule`; `Guarantee: Mechanism`): the definition keeps one text |
| S12 | Every invariant or guarantee it adds or modifies is a criterion |
| S13 | A parameter that changes value is not still stated with its old value by a decision or a row of the definition the specification leaves untouched (a decision is reverted, a row modified) |
| S14 | A parameter is modified or removed only if it exists, and added only if it does not |
| S15 | `keeps` and `reverts` only on decisions (`DEC`, `DEC-T`); a decision, credential or actor is never a criterion |
| — | «Decided in the implementation: A, B.» (Spanish: «Decidido en la implementación») after the criteria table marks criteria `/jflow-build` added with `spec amend` (only small things, see its Rule 2); `/jflow-spec` shows them to the user to keep or change |
| S18 | With `--implement`: the requirement's description says «Specification: ready» («Especificación: lista»; not a draft from the initial plan) |
| S19 | Every row of «Non-functional requirements» in the proposal (the base) says how it is verified (`test`, with `Tested in`: `base` or `#id`; `alert`; `review`). Not checked on the plan's drafts: it is settled when the base is specified |
| S17 | A line of «Excludes» that leaves something for another requirement names it (`#id`) |
| S16 | Bringing in an item of «Out of scope» (it appears outside «Excludes») needs the decision that brings it in: a `new` that names it, or `reverts` of the one that excluded it |

`jflow.py spec diff {id}` also compares the definition of `dev` with the branch's, for what no criterion
accounts for: a decision whose Topic, Decision, Rejected or Reason changed (only `Affects` may change
without reverting it), a row whose text changed without a criterion, a row removed from «Out of
scope» without the decision of S16.

`jflow.py spec order {id}` shows where a requirement stands: each dependency (`MERGED`, `PENDING`,
`CANCELLED`) and the open requirements that depend on it, with the IDs they cite that this one
modifies, removes or reverts.

## Evidence

`/jflow-build` computes it with `jflow.py evidence {id}` from the JUnit reports (criterion → test →
result). It goes to the MR/PR description and, in business terms (criterion → met, no test names),
to the Jiku comment. The repository keeps the tests, named with their IDs.
