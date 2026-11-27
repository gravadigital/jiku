---
name: jflow-product-discover
description: Define a new product with the user - the decision-complete discovery (functional, domain, technical, database schemas) and the initial plan, created in Jiku as the base requirement plus one requirement per part, as drafts to specify before building
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion, WebSearch, WebFetch"
argument-hint: "[brief-path ...]"
---

# Define Product

## Purpose

Run the whole Discovery phase with the user, following [Discovery](.claude/specs/discovery.md): produce
the functional, domain and technical analyses and one database schema per service that owns a
database, decision-complete and mutually consistent, from an
optional brief or from scratch. It is the only step of the workflow where the user participates
heavily. It ends by turning the discovery into the initial plan: the Jiku requirements of the base
product and of every part, each with a **draft** specification generated from the discovery (its
description ends with the draft line, «Specification: draft» or «Especificación: borrador» in Spanish).
Each one is specified before it is built: the base by
`/jflow-product-scaffold`, every part by `/jflow-spec`, against what is built by then.

**Flow:**

```
Step 0: Load context, link the Jiku project, detect state (start or resume)
  |
Step 1: Resolve the brief (only when starting from scratch)
  |
Step 2: Functional phase   → functional-analysis.md  (section by section, user confirms each)
  |
Step 3: Domain phase       → domain-analysis.md    (proposed from the functional analysis)
  |
Step 4: Technical phase    → technical-analysis.md    (inferred)
  |
Step 5: Schema phase       → db-schema-{service}.md   (derived; reviewed whole; closes with the final verification)
  |
Step 6: The plan          → parts and order, confirmed by the user
  |
Step 7: Requirements in Jiku → the base + one per part, as drafts, in Planificación
  |
Step 8: Finalization → main and dev exist, everything committed on dev; suggest /jflow-product-scaffold {base id}
```

**Result:** Every discovery document closed in `_jflow/discovery/` and `_jflow/project.yaml`,
committed to `dev` (with `main` and `dev` both existing, pushed if there is a remote); in Jiku, the
base requirement («0 · Producto base» in Spanish, «0 · Base product» otherwise) and one requirement
per part of the plan, each with its draft scope, proposal and criteria. The product is defined and planned.

**This command does NOT:**

- Create the product definition (`_jflow/prd/`), contracts, flows or code
- Create the Jiku project (a person does)
- Choose libraries or frameworks beyond the language of each service
- Define UX (screens, interaction flows, visual identity)
- Run unattended: it is interactive by design

The base is specified and built by `/jflow-product-scaffold`; every part is specified by `/jflow-spec` and
built by `/jflow-build`. For an existing product, use `/jflow-product-brownfield` instead.

## References

**Read [Discovery](.claude/specs/discovery.md)** and apply it. It defines input handling, interview
order, how to ask, the failure checklist, verification, resuming and closing.

**Read [Functional Analysis](.claude/specs/functional-analysis.md)** for how to extract knowledge from
the user.

**Read [Database](.claude/specs/database.md)** before the schema phase, and
[Engineering](.claude/specs/engineering.md) before the technical phase (its defaults are never asked).

**Read [Requirement Spec](.claude/specs/requirement.md)** and [Jiku](.claude/specs/jiku.md) before
the plan.

## Pre-loaded Context

### Discovery State

!`grep -H "^status:" _jflow/discovery/*.md 2>/dev/null || echo "NO_DISCOVERY"`

### Product Definition Check

!`ls _jflow/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

### Project Link

!`cat _jflow/project.yaml 2>/dev/null || echo "NO_PROJECT_LINK"`

## CRITICAL RULES

1. **ABORT if the product definition exists** - If the "Product Definition Check" lists files, the
   product is already bootstrapped and the discovery is frozen. Changes go through a Jiku requirement
   (`/jflow-spec`)
2. **Discovery complete → plan, from where it stopped** - If every document shows `status: closed`, go
   to the plan: with drafts already in the working folder (`plan/part-*.md`), resume at Step 7 without
   regenerating them; otherwise Step 6. If Jiku already has every part (`plan-push --preview` says
   «Nothing to create»), there is nothing to do: say so and stop
3. **Read Jiku before writing, and show what will be written** - Never create in Jiku without first
   looking at what is there (`plan-push --preview`), showing the user the titles and the action for
   each, and getting their approval
4. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request): the messages quoted below are
   templates, said in that language. What people of the product read (Jiku, the discovery, README,
   `docs/`, CHANGELOG, texts and errors the product shows) is in the product language (`language` in
   `_jflow/project.yaml`, Spanish when unset). The discovery's structure (section titles, columns,
   fixed values) is Spanish when the product language is Spanish — as the templates and this skill
   name it — and the English names of `jflow.py lang-terms` otherwise; its content, in the product
   language. Commits, MR/PR text, branch names and test names always English; code, identifiers and
   `AGENTS.md` English. See [Language](.claude/specs/language.md)
5. **Content to the file, questions to the tool** - Write each section in the document; never paste
   proposed content in chat. Every question goes through `AskUserQuestion`
6. **Save first, then validate** - Save the section, run the mechanical check, notify, ask for
   confirmation
7. **Fixed locations** - Documents in `_jflow/discovery/`; documentation of external systems in
   `_jflow/references/`
8. **Never invent a definition** - A gap that adds a rule is asked. Only wording, presentation and
   direct consequences of existing definitions may be proposed, as assumptions listed in the section
   confirmation, at most 5 per section (see "Impact" in the spec). Nothing is filled in silently
9. **The document is the only memory** - Save after every section (and every functional block), and
   keep `closed_sections` up to date, so the session can resume
10. **Never close with observations open** - Neither a section nor a document closes while the
   mechanical check or the semantic checks report something
11. **Never ask twice** - What a previous section or document already defines is inferred; ask only
    the new decision
12. **One section, one confirmation** - Each section and each block is confirmed alone, in its own
    `AskUserQuestion` call, after the user reviews it. Never batch confirmations, never mix them
    with questions about another section
13. **Every decision has its motivo, and says whose it is** - Ask why when a decision is taken, and
    write it in the Motivo column (Reason) in the user's words. A motivo you drafted and the user only
    accepted ends with ` (proposed)` (`(propuesto)` in Spanish); if the user gave none, write `Not given by the user` (`No lo dio el usuario`) (both in the
    product language). Never present your
    reasoning as the user's. A choice is a decision (with what was discarded) when the user rejects
    an alternative explicitly, or when something the brief or the user mentioned is left out — then
    its row in «Fuera de alcance» (Out of scope) has a decision behind it. Accepting a recommendation is not, by
    itself, a decision
14. **Deterministic work through `jflow.py`** - `init-project`, `branches`, `discovery-check`,
    `plan-blocks`, `plan-build`, `plan-check`, `plan-push`

## Execution

### Step 0: Load Context and Detect State

**0.1 Validate**

Apply CRITICAL RULES 1 and 2 from the pre-loaded checks. Abort messages:

```markdown
This product already has its definition (_jflow/prd/ exists). The discovery is frozen:
changes go through a Jiku requirement, with `/jflow-spec {id}`.
```

**0.2 Jiku project** — if "Project Link" shows `NO_PROJECT_LINK`, ask for the id of the product's Jiku
project (a person creates it), its instance (`prod`, or `dev` for tests) and the product language
(Spanish, `es`, by default; any language code is valid: `en`, `pt`…), and:

```bash
python3 .claude/scripts/jflow.py init-project --project-id {id} --instance {prod|dev} --language {code}
python3 .claude/scripts/jflow.py jiku list
```

The list must answer (it proves the link and the login). If it fails, tell the user how to log in
(`jiku --config ~/.config/jiku/config.{instance}.yaml login`) and stop. Then make sure `main` and
`dev` exist and you are on `dev` (it creates what is missing, including a first commit in an empty
repository):

```bash
python3 .claude/scripts/jflow.py branches
```

Work on `dev` from here on. The CI platform is asked in the technical phase: when its decision closes, set `git.platform`
in `_jflow/project.yaml` to it.

**0.3 Detect the current phase**

From the "Discovery State" check, the current document is the first of
`functional-analysis.md` → `domain-analysis.md` → `technical-analysis.md` → `db-schema-{service}.md`
(one per service that owns a database, in the order of Persistencia) that is not `closed`.

- **It does not exist** → start that phase from its beginning (Step 1 first, if it is the functional
  analysis).
- **`status: in-progress`** → read it fully (and the closed documents before it), and resume at the
  first section not listed in `closed_sections`. Tell the user in one line where you resume:

  ```markdown
  Resuming the discovery: {{document}}, from the section «{{section}}».
  ```

---

### Step 1: Resolve the Brief

Only when `functional-analysis.md` does not exist yet.

**1.1 Find it**

- Paths in `$ARGUMENTS` → use them.
- No arguments → look for `docs/*.md` at the repo root.
- Formats `.md`, `.txt`, `.pdf`; there may be several. Read every brief FULLY.
- None found → ask with `AskUserQuestion` whether there is a brief (and where) or to start from
  scratch. If the user gives a path, read it.

**1.2 Create the functional document**

Read the [Discovery Functional Template](.claude/templates/discovery-functional-tmpl.yaml). Create `_jflow/discovery/functional-analysis.md` with the
frontmatter (`status: in-progress`, `closed_sections: []`, `base_documents`).

**1.3 Draft from the brief** (only with a brief)

Apply the input rules of the spec: transcribe what the brief defines into every section, discard
context, turn accepted consequences into decisions, save external system docs to
`_jflow/references/`. Keep an internal list of gaps and contradictions: that is what the interview
will ask. Save the draft.

---

### Step 2: Functional Phase

Follow the functional interview order of the spec:

```
Resumen → Actores → Superficies → Índice de bloques → each block → NOT → Parámetros
  → Integraciones externas → Requisitos no funcionales → Fuera de alcance → Decisiones tomadas
```

Run the **section loop** of the spec on each section and on each block. When every section is
closed, **close the document** as the spec says.

```markdown
Functional analysis closed: `_jflow/discovery/functional-analysis.md`

Next, the domain analysis, from what we defined.
```

---

### Step 3: Domain Phase

Read the [Discovery Domain Template](.claude/templates/discovery-domain-tmpl.yaml). Create `_jflow/discovery/domain-analysis.md`
(`status: in-progress`, `closed_sections: []`, `functional_analysis`).

Sections in order: Glosario → Entidades → Estados → Invariantes. **Propose** each one from the
functional analysis and run the **section loop** of the spec on it. When the domain reveals a gap in
the functional analysis, **complete the earlier document** as the spec says. When every section is
closed, **close the document** as the spec says.

```markdown
Domain analysis closed: `_jflow/discovery/domain-analysis.md`

Next, the technical analysis: I draft it from the two previous ones and ask you to confirm it.
```

---

### Step 4: Technical Phase

Read the [Discovery Technical Template](.claude/templates/discovery-technical-tmpl.yaml). Create `_jflow/discovery/technical-analysis.md`
(`status: in-progress`, `closed_sections: []`, `functional_analysis`, `domain_analysis`).

Sections in order: Servicios → Módulos → Persistencia e infraestructura → Comunicación →
Autenticación y autorización → Garantías → Flujos clave → Decisiones técnicas.

**Infer** each one from the functional and domain analyses with the template's criteria (minimum
number of services, engineering defaults), present it already written, and run the **section loop**
of the spec on it. Ask from scratch only the choices between real alternatives (each becomes a
technical decision), the language of each service, and whether the user wants to deviate from an
engineering default. The language of each service and the CI/CD platform are always asked. Libraries
are not asked: `/jflow-product-scaffold` researches and chooses them, unless the user wants to fix one now. Gaps in earlier documents: **complete the earlier document** as the spec says. When
every section is closed, **close the document** as the spec says.

```markdown
Technical analysis closed: `_jflow/discovery/technical-analysis.md`

Next, the database schema: I derive it from what we defined and ask you to review it whole.
```

---

### Step 5: Schema Phase

Read the [Discovery DB Schema Template](.claude/templates/discovery-db-schema-tmpl.yaml) and the
schema conventions of [Database](.claude/specs/database.md). For each service that owns a database
in Persistencia e infraestructura, create `_jflow/discovery/db-schema-{service}.md`
(`status: in-progress`, `closed_sections: []`, `service`, `technical_analysis`, `domain_analysis`).

Follow "Database schema" in the spec: **derive** the whole document from the domain, Garantías,
Persistencia, Autenticación and the conventions, citing the origin of every table, column and enum
value; ask only what cannot be derived. Then run the **section loop** of the spec **once, for the
whole document**: the user reviews the full schema and confirms it in a single question.

**Final verification**, before closing the last schema:

```bash
python3 .claude/scripts/jflow.py discovery-check --final
```

Then read every document together and look for contradictions, names that do not match, different
values for the same thing, and definitions one document contradicts. Handle every observation as the
spec says. Then **close the document** as the spec says.

---

### Step 6: The Plan

Follow "The plan" in the Discovery spec.

```bash
python3 .claude/scripts/jflow.py plan-blocks
```

Propose the parts: which blocks go together (one requirement, one MR each) and in which order, so what
a part needs is built before it. Write the proposal to `plan.json` in the working folder
(`jflow.py workdir`):

```json
{"parts": [{"title": "Acceso al panel", "blocks": ["ACC"], "auth": true, "entities": ["Cuenta de administrador"]}]}
```

`auth: true` marks the part that builds authentication; `entities` fixes which entities a part creates
when the name match is ambiguous (an entity named like a common word). Then:

```bash
python3 .claude/scripts/jflow.py plan-build --plan $(python3 .claude/scripts/jflow.py workdir)/plan.json
```

`plan-build` places every piece where everything it cites exists, so no part cites what a later one
brings: a part has to be built, tested and merged on its own, and the definition in `dev` describes only
what is built. When a row of a block cites a later part, the whole row goes to that later part
(`warning: {ID} goes in part N and not in M …`); a table row or line of an entity or of the
authentication section that cites a later part goes there under `(modifica)`.

Present the plan to the user — parts in order, blocks, computed dependencies — and every `warning`. For
each row moved to a later part, decide with the user whether the earlier part needs a reduced version
of it (example: "desactivar un cliente" in part 1, "sus entregas siguen saliendo" in part 3). If it
does, split it in Step 7. Confirm with `AskUserQuestion`. The user may change it — join or split parts
(the unit is the block), move a block, reorder, rename: edit `plan.json`, run `plan-build` again, and
present the new plan with its warnings (a new order can push rows to a later part: explain it before
the user confirms). `plan-build` refuses to overwrite drafts edited by hand after it wrote them: once
Step 7 has started, changing the plan needs `--force` and loses those edits — say so first.

---

### Step 7: Requirements in Jiku

Resolve every `{{fill: …}}` placeholder in the drafts the previous command listed (one line of what
each block covers, the functional summary of each part, the variable of each parameter, the
responsibility of each module, the conversion of an old-format authentication section), only from
what the discovery says, in the product language.

Apply the splits confirmed in Step 6, and only those: in the earlier part, a criterion row
`add | {ID} | {the reduced text, without what the later part brings}`; in the later part, the row
already there becomes `modify | {ID} | {the full text from the discovery}` (`agrega`/`modifica` in a
Spanish draft). Nothing else moves
between parts. Then:

```bash
python3 .claude/scripts/jflow.py plan-check
python3 .claude/scripts/jflow.py plan-push --product "{product name}" --preview
```

`plan-check` fails with `P1` if a part cites what a later part adds: fix the draft (a split you made),
never ignore it. The preview reads the project in Jiku and lists every requirement of the plan with its
action: «create», or «already in Jiku (#n): left as it is» (an open requirement with the same title — a
resumed run, or a lost record). Show that table to the user as it is and ask with `AskUserQuestion`
(«Create this in Jiku?», "Create" / "Not yet"). If nothing is left to create, say so and skip to
the commit. On approval:

```bash
python3 .claude/scripts/jflow.py plan-push --product "{product name}"
```

 `plan-push` creates the base first and every part in order, in Planificación, public,
with the draft line at the end of the description, titled with its order (`0 · Producto base` in
Spanish, `0 · Base product` otherwise, `1 · {title}`, …), all in the product language, each
part depending on the base and on the parts it uses, and resumes where it stopped if a write fails.
Commit the discovery and the project link on `dev` (`docs: discovery and initial plan of {product}`), and
leave the repository ready to continue — everything committed, `main` and `dev` existing, on `dev`,
both pushed if there is a remote:

```bash
python3 .claude/scripts/jflow.py branches --push
```

If it reports something left uncommitted or a failed push, fix it and run it again.

---

### Step 8: Finalization

```markdown
Discovery complete and plan created in Jiku.

- Discovery: `_jflow/discovery/` (four documents or more), on `dev`. Branches `main` and `dev` ready
  {{and pushed / no remote}}.
- Requirements, in the order they are built, as drafts (the draft line in the description):
  #{base} 0 · {base title}; #{p1} 1 · {title}; #{p2} 2 · {title}; …

---

## Next step

**Run:** `/jflow-product-scaffold {base}`.

It first asks the technical questions still open to specify the base product (how each surface is
tested, what is compiled, which non-functional requirements are verified and how). Then it builds, on
its own, the skeleton of every service and the definition of what is built, in its branch, and leaves
the MR.

Then, each part in the order of its number: `/jflow-spec {id}` (reviews the part against what is
already built and asks what is missing), approve it in Jiku and `/jflow-build {id}`. A part cannot be
implemented until the ones it uses are merged in `dev`.
```

## Output

Files saved to `_jflow/discovery/` (plus `_jflow/project.yaml`), committed to `dev`:

- `functional-analysis.md` — summary, actors, surfaces, functional blocks, out of scope, parameters,
  integrations, NFRs, decisions
- `domain-analysis.md` — glossary, entities, states, invariants
- `technical-analysis.md` — services, modules, persistence, communication, auth, guarantees, key
  flows, technical decisions
- `db-schema-{service}.md` — one per service that owns a database: DBML, constraints DBML does not
  express, derived attributes

External system documentation, if any, in `_jflow/references/`.

Each document has the frontmatter of its template and ends with `status: closed`.

In Jiku: the base requirement and one requirement per part of the plan, specified, in
Planificación.
