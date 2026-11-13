# Discovery

How to conduct the Discovery phase: the one step of the workflow where the user participates
heavily. It produces the functional analysis, the domain analysis, the technical analysis and one
database schema per service that owns a database — **decision-complete**, so every step after it
runs autonomously. Read this before running any discovery skill.

The structure of each document lives in its template:
[Discovery Functional](../templates/discovery-functional-tmpl.yaml),
[Discovery Domain](../templates/discovery-domain-tmpl.yaml),
[Discovery Technical](../templates/discovery-technical-tmpl.yaml),
[Discovery DB Schema](../templates/discovery-db-schema-tmpl.yaml).
How to extract knowledge from the user lives in
[Functional Analysis](functional-analysis.md); this spec applies it to discovery.

## CRITICAL RULES

1. **Definitions, not context.** Every section states *what the product does* and *how it
   behaves*. No problem statement, no business rationale, no "why".
2. **The user decides every rule; only wording and direct consequences are proposed.** A gap that
   adds a rule is always asked. Wording, presentation, and what follows directly from an existing
   definition may be written as a proposal, listed as an assumption in the section confirmation
   (at most 5 per section), so the user approves or corrects it. Never fill a gap silently: a fabricated
   definition is worse than a missing one. (See "Impact" below.)
3. **Never ask twice.** What the user already defined is inferred downstream. Each phase only
   asks the new decision it adds.
4. **Close without pending items.** Anything that cannot be defined yet is either moved to
   "Fuera de alcance" or decided with a concrete value. A document never closes with an open
   question, a TODO, a comment or a temporary note.
5. **One section, one human review.** Each section (and each functional block) is confirmed on
   its own, in its own `AskUserQuestion` call, after the user reviews it in the file. Never batch
   confirmations. The database schema is the deliberate exception: the whole document is one
   section, reviewed and confirmed at once, because it is where the user must take the time.
6. **Content goes to the file, questions go to the tool.** The agent writes the section in the
   document; the user reviews it there. Questions use the `AskUserQuestion` tool. Never paste the
   proposed content in chat.
7. **The document is the only memory.** Write it from the first exchange and save after every
   section, so an interrupted session can resume.
8. **Spanish** for every user interaction and every generated document. Section titles come
   from the templates, already in Spanish.

## Order and dependencies

```
functional-analysis.md  →  domain-analysis.md  →  technical-analysis.md  →  db-schema-{service}.md
```

There is one `db-schema-{service}.md` per service that owns a database in the technical analysis
(Persistencia e infraestructura).

- Each document **requires the previous one closed**.
- **A later document may complete an earlier one.** Modeling the domain reveals functional gaps
  (a transition no requirement triggers, an entity no requirement uses); designing the technical
  analysis reveals domain gaps. Propose the addition, get the user's confirmation, edit the
  earlier document. It stays closed.
- When the discovery closes, `/product-define` turns it into the plan: the Jiku requirements of the
  base and of every part, each with its specification (see "The plan" below). From then on the
  documents are **frozen** history: the requirements in Jiku carry what is still to build, the
  definition in `_gflow/prd/` describes what is built, and every change goes through a Jiku
  requirement (`/req-specify`).

## Input

**Brief.** Paths passed as arguments or, if none, the `docs/*.md` files at the repo root.
Formats: `.md`, `.txt`, `.pdf`. There may be more than one.

| Found in the brief | Action |
|---|---|
| Something the template requires and the brief defines | Transcribe it into the draft |
| Something the template requires and the brief does not define | Mark it as a gap and ask |
| A contradiction inside a brief or between briefs | Ask |
| Context, rationale, business goals | Discard: the document stores definitions |
| An accepted consequence of a decision | Record it as a decision, with its "Descartado" |
| Documentation of an external system | Save it to `_gflow/references/` |

Transcribed content is **not confirmed item by item**: the user reviews it when the section
closes. Only gaps and contradictions are asked.

**No brief:** interview from scratch, in the order below.

## Interview

### Functional analysis — order

```
Resumen → Actores → Superficies
  → Índice de bloques (name, prefix, surfaces)
  → Detail of each block
  → NOT and Parámetros (consolidate what came up in the blocks)
  → Integraciones externas → Requisitos no funcionales → Fuera de alcance → Decisiones tomadas
```

- **Block index first, detail after.** Agreeing on the whole list avoids discovering halfway
  that two blocks were one.
- **Transversal content is written as it appears.** A notification, parameter, out-of-scope item
  or decision that comes up while detailing a block is added to its section at that moment, as
  final content. Those sections close at the end, with everything together.

### Domain and technical analyses

- **Domain:** propose entities, states and invariants from the functional analysis. What the
  user adds that the functional analysis lacks becomes a proposed addition to it.
- **Technical:** almost everything is inferred (services, modules, auth, events, guarantees).
  Present each section already drafted. Ask from scratch only the choices between real
  alternatives, the language of each service, and any deviation from the engineering defaults.

### Database schema

The schema is **derived, not designed from scratch**: tables, columns, obligatoriness, enum values,
uniqueness, relationships and deletion policy come from the domain; constraints from Garantías;
technical tables and columns from Persistencia and Autenticación; names, types, keys and audit
columns from the schema conventions of
[Database](database.md), which are never asked.

1. **Write the whole document** following its template, citing the origin of every table, column
   and enum value in its note.
2. **Ask only what cannot be derived**: an English name with real alternatives for a central
   entity (`Turno` → `appointments` or `bookings`), a technical choice the earlier documents did
   not make, and the **schema decisions** that depend on the product (concurrency, multi-tenancy,
   history, deletion, and currency or re-delivered tokens when they apply; see "Schema decisions"
   in Database). A name that is the direct translation follows the convention and is not
   asked.
3. **Check and confirm** with the section loop, once, for the whole document: the user reviews the
   full schema in the file.

### Impact: what is asked and what is proposed

Many questions make the user stop paying attention, and an inattentive user makes mistakes. So
questions go to what has impact; details are proposed as assumptions.

Only two kinds of definitions may be proposed as assumptions. **Everything else is asked.**

| May be an assumption | Examples (Turnero) |
|---|---|
| **Wording and presentation**: message texts, display formats, format validations, list ordering, labels | The exact text of a rejection message; the phone format validation; whether search ignores case |
| **A direct consequence of something already defined**: it follows from an existing definition without adding a rule | A rescheduled appointment is in RESERVADO, so it can be rescheduled again; an inactive professional is not offered, so it does not appear in the public list |

| Always asked — never an assumption | Examples (Turnero) |
|---|---|
| A new rule: a permission (what an actor can or cannot do), a notification, a number with a business effect (a limit, a duration, a horizon and how it is counted), the result of a failure, which data is kept or shown, a capability that exists or not (a search, a list) | Whether an appointment that already started can be cancelled; whether the manual appointment sends the confirmation email; whether the horizon counts today |
| Every technical choice between real alternatives | LISTEN/NOTIFY versus a message bus; how often each automatic process runs |

**At most 5 assumptions per section.** If a section has more, the ones beyond 5 — the ones with the
most consequence first — are asked instead.

When in doubt, ask.

**A vague answer does not authorize choosing values.** If the user answers "formato básico" or
"listados simples", the concrete values (lengths, filters, ranges) are still undecided: propose them
— as a question if they add a rule, as an assumption if they are only wording or presentation.

### How to ask

- **Propose, then confirm.** Draft from what the user said and ask only what is missing.
- **`AskUserQuestion` with concrete options**, the recommended one first, always allowing a
  different answer. Up to 4 questions per call. Wait for the answer.
- **Choices between alternatives** carry a recommendation. The choice goes to the decisions
  section, with what was discarded, when the user rejects an alternative explicitly, or when
  something the brief or the user mentioned is left out (its row in «Fuera de alcance» then has a
  decision behind it) — also when the choice is made while detailing a block. Accepting a
  recommendation is not, by itself, a decision.
- **Whose motivo.** Ask why. The user's words go as they are; a motivo you drafted and the user only
  accepted ends with ` (propuesto)`; with no motivo from the user, write `No lo dio el usuario`. A
  later contradiction weighs a `(propuesto)` decision lighter than one the user argued.

### Section loop

Every section of every document — and every block of the functional analysis — goes through the
same loop:

1. **Write** the section in the document: transcribed from the brief, drafted from what the user
   said, proposed from the earlier documents, or inferred (technical). Write transversal content
   (notifications, parameters, out-of-scope items, decisions) into its own section as soon as it
   comes up.
2. **Ask** what is missing with `AskUserQuestion`: gaps, contradictions, and — for each functional
   block — the failure checklist below. Propose an answer when possible. Update the document with
   each answer.
3. **Check the source of every definition.** Re-read the section. Every definition in it — each
   requirement, failure result, attribute's type, obligatoriness, restriction and default, enum
   value, number, technical choice — must come from the brief, from an answer of the user, or from
   an earlier closed document. Anything else is an assumption: if it adds a rule, ask it now
   (step 2), with your proposal as the recommended option; if it is wording, presentation or a
   direct consequence, keep it and list it for the confirmation (at most 5). Never present something as "ya decidido" if the user did not decide it.
4. **Save and check**: run the mechanical check and handle its observations (see Verification).

   ```bash
   python3 .claude/scripts/grava.py discovery-check
   ```

   While a document is in progress, ignore observations that point to sections not written yet.
5. **Confirm**: notify, then ask with `AskUserQuestion` «¿Cerramos la sección {{sección}}?» with
   the options "Cerrar la sección" and "Quiero cambios". **The question itself lists the
   assumptions** of the section, one per line with the ID it affects («Supuestos: (1) RES-E5: el
   mensaje indica el campo inválido…»), or says there are none. Accepting the confirmation accepts
   them; a correction is edited and confirmed again. The assumptions are listed only in the
   question: in the document they are ordinary definitions, with no marker. **One section per confirmation:** the
   confirmation is the only question of its `AskUserQuestion` call — never two sections in the same
   call, and never together with questions about another section or block. Every section requires
   its own human review.

   ```markdown
   Sección guardada: `_gflow/discovery/{{documento}}` — {{sección}}

   Incluye:
   - {{resumen de lo escrito}}

   Revisá la sección en el archivo.
   ```

   On changes, edit and repeat from 3. On close, add the section id to `closed_sections` and
   save.

### Completing an earlier document

When a later phase reveals a gap in an earlier, closed document (a transition no requirement
triggers, an entity no requirement uses, an actor that authenticates without an account entity, a
block no module can own), propose the addition with `AskUserQuestion`. On confirmation, edit the
earlier document: it stays `closed`; update its `last_updated`.

### Failure checklist (every functional block)

Before closing a block, walk this fixed list **with the user**. It is a list of questions, not
a self-check: for each one that applies, ask what happens (proposing a result when possible) and
write the answer as a failure condition of the block.

| Question | Example (Turnero) |
|---|---|
| What happens if two actors do the same thing at the same time? | RES-E1 |
| What happens when a limit is reached? Includes the minimum and maximum of a numeric value when the business cares about it (durations, quantities, amounts). Text lengths, trimming, email case and technical ranges follow the Input defaults of Engineering: ask only when the business needs another bound | RES-E3, maximum service duration |
| What happens if time passes while the user operates? | RES-E4, ACC-E3 |
| What happens if the entity changed state between being seen and being acted on? | RES-E2 |
| What happens if an external system or a channel fails (the system does not answer, an email is rejected or bounces, a real-time connection drops)? | Email retry and rejection (NOT), agenda reconnection (AGE) |
| What happens if the actor has no permission over that data? | Client's scope |
| What happens to what depends on this if it is removed, deactivated or changed? | CAT-02 (cascade), appointments outside a new availability |
| What does the actor see on each failure, and does the message reveal something it should not (that an account exists, another client's data)? | Same message for unknown user and wrong password (ACC) |
| When a temporary state ends (a lock, a hold, an expiry), what is reset and what stays? | Attempt counter after a lockout (ACC) |

**System blocks** add two questions:

| Question | Example (Turnero) |
|---|---|
| What happens if the process did not run on time (the system was down)? | Ausente and reminder after a downtime |
| What happens if it runs at the same time as a user action on the same data? | A reservation while anonymization runs |

**Completeness question (every user block):** how does the actor find the record it acts on — a
list, a search, a filter? If the product needs a search to make an action practical, it is a
requirement (in Turnero: finding an appointment by the client's email or phone when they call).

**Not applied blindly.** If a question makes no sense for a block, skip it and say so in one
line ("concurrencia: no aplica, es solo lectura") so the user can object.

## Verification

Two kinds of checks:

- **Mechanical** — references between IDs, presence of sections and categories, no temporary
  content. Run by `.claude/scripts/check-discovery.py`: deterministic and context-free.
- **Semantic** — need reading and understanding. Done by the agent. Each template lists its
  semantic checks.

**When:**

- Mechanical: **after saving each section**.
- Semantic: **when closing the document**.
- Cross-document checks run in the **later** document, which has both in view.
- **Final verification**: before closing the **last** document (the last database schema), run
  every mechanical check over all the documents together, and read them looking for
  contradictions, names that do not match, different values for the same thing, and definitions
  one document contradicts. The last document does not close without passing it.

**Handling an observation:**

| Kind | Example | Action |
|---|---|---|
| **Agent's writing error** — the definition exists, the agent wrote it wrong | RES-13 cites NOT-01 but the notification is NOT-02 | Fix it and report it in one line. If the fix is not obvious, propose it and ask |
| **Definition gap** — only the user can decide | A transition no requirement triggers | Ask with `AskUserQuestion`, proposing an answer when possible. Never fill it in |

A document never closes with open observations.

## Resuming

The frontmatter tracks progress while the document is in progress:

```yaml
status: in-progress
closed_sections: [resumen, actores, superficies, indice-bloques, RES, REP]
```

| Document state | Action |
|---|---|
| Does not exist | Start from scratch |
| `status: in-progress` | Resume at the first section not in `closed_sections`; never re-ask a closed section |
| `status: closed` | Abort: the document is finished |

## Closing

- **A section closes** when the user reviews it in the file and confirms it. Add it to
  `closed_sections`.
- **A document closes** when every section is closed and verification passes with no
  observations. There is no final confirmation of the whole document. To close it:
  1. Run the semantic checks its template lists (including the cross-checks against earlier
     documents).
  2. The mechanical check must report no observations for this document.
  3. Set `status: closed`, **remove `closed_sections`**, update `last_updated`, and save.
     The mechanical check rejects a closed document that still has progress fields, HTML comments
     or pending markers.
- **Discovery is complete** when every document is closed: the three analyses and one database
  schema per service that owns a database.

## The plan

The last step of `/product-define`, with the discovery complete. Only the grouping and the order are
decided here; the content of every requirement is transcribed by `grava.py plan-build`.

1. **Propose the parts.** `grava.py plan-blocks` shows each block with its entities and the blocks it
   cites. A part is one or more blocks that are built and reviewed together (one requirement, one
   MR). Order them so that what a part needs is built before it: a block that cites another, or uses
   an entity another creates, goes in the same part or after. Mutual references (notifications and
   the blocks that trigger them) usually mean the same part.
2. **The user decides** the parts, their titles and their order. Fix in the plan the entities each
   part creates when the name match is ambiguous (an entity named like a common word).
3. **Build and review the drafts.** `grava.py plan-build --plan plan.json` writes one draft per part
   plus the base ("Producto base", from `.claude/templates/base-requirement.md`). Every piece of the
   discovery goes to the first part where everything it cites exists, so **no part cites what a
   later part brings**: each part is built, tested and merged on its own, and the definition in `dev`
   describes only what is built.
   - A block's requirement or failure that cites a later part goes, whole, to that part, even if its
     block is earlier (`aviso: {ID} va en la parte N`).
   - An invariant goes where all its entities exist; a guarantee, where the rules it enforces exist;
     a flow, where everything it names exists.
   - A table row or line of an entity, or of the authentication section, that cites a later part
     goes to that part under `#### {Entidad} (modifica)`. DBML notes lose the IDs of later parts.
   - A decision is taken in the first part it affects; a later part it also affects lists it as
     `respeta` with those IDs in `Afecta`.
   - Every part depends on the base and on the earlier parts it cites.
4. **Split what needs an early version.** For each requirement moved to a later part, the user
   decides whether the earlier part needs a reduced version. If so, the earlier part gets
   `agrega | {ID} | {texto acotado}` and the later part's row becomes `modifica | {ID} | {texto
   completo}`. Nothing else moves between parts.
5. **Resolve the markers** `{{completar: …}}` (one line of what each block covers, the functional
   summary of each part, variable names, module responsibilities), only from what the discovery says.
   `grava.py plan-check` must report nothing; `P1` is a part citing what a later part adds.
6. **Create them in Jiku**: `grava.py plan-push --product "{nombre}"`. The base first, then every part
   in order, in Planificación, public, titled with their order (`0 · Producto base`,
   `1 · {título}`, …), with "Depende de" pointing to the real ids. The number is the order in which
   they are implemented.
