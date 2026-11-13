---
name: product-adopt
description: Adopt an existing product into the workflow, autonomously - survey its code into the definition of what is built, list how the repository deviates from the grava-workflow defaults, and record the alignment work and suspected bugs in Jiku
allowed-tools: "Read, Write, Edit, Bash, Glob, Grep, Agent, AskUserQuestion"
argument-hint: "[jiku-requirement-id]"
---

# Adopt Product

## Purpose

Bring a product that already has code into the workflow without asking. The definition is surveyed
from the code exactly as it is today: what the product does (blocks), its data (domain, schema), what
it exposes (contracts), how it is built and the choices it made. The repository is also compared with
the defaults of grava-workflow, and every deviation is recorded as work to do. The user reviews
everything in the MR.

**Flow:**

```
Step 0: Check git, link the Jiku project, the adoption requirement (the only questions it may ask)
  |
Step 1: Survey the code, one subagent per service
  |
Step 2: Write the definition of what exists, and the contracts
  |
Step 3: Deviations from the grava-workflow defaults
  |
Step 4: Guides: README, docs/operacion.md, AGENTS.md
  |
Step 5: Verify (verifier subagent): definition ↔ code, both ways
  |
Step 6: Close: push, MR/PR text, Jiku (alignment requirement, incidencias, comment)
```

**Result:** Branch `feat/{id}-adopcion`, pushed, with `_gflow/` (project link, definition, contracts,
schema, flows), `README.md`, `docs/operacion.md` and the `AGENTS.md` files. In Jiku: the requirement
"Alinear con los defaults de grava-workflow" (one criterion per deviation), one `incidencia` per
suspected bug, and a comment on the adoption requirement.

**This command does NOT:**

- Change the product's behavior or refactor its code; it does not fix the deviations either (that is
  the alignment requirement)
- Invent requirements the code does not implement, or document what looks right instead of what is
- Write missing tests, or rename existing ones (they get their IDs as later work touches them)

New work afterwards goes through `/req-specify` and `/req-implement`, or `/change`.

## References

**Read [Product Definition](.claude/specs/product-definition.md)** — the documents you write.

**Read [Engineering](.claude/specs/engineering.md)** — the defaults the repository is compared with,
and what the guides must provide.

**Read [Database](.claude/specs/database.md)** — the schema document format (conventions are
described, not imposed on an existing schema).

**Read [Requirement Spec](.claude/specs/requirement.md)** and [Jiku](.claude/specs/jiku.md) — the
alignment requirement and what may be written in Jiku.

## Pre-loaded Context

### Product Definition Check

!`ls _gflow/prd/ 2>/dev/null || echo "NO_PRD_FOUND"`

### Project Link

!`cat _gflow/project.yaml 2>/dev/null || echo "NO_PROJECT_LINK"`

## CRITICAL RULES

1. **Use Spanish** for the definition, guides for people and Jiku; identifiers as they are in the code;
   `AGENTS.md` in English
2. **Autonomous after Step 0** - The only questions are the git check and the project link of Step 0
3. **What is, not what should be** - Document the current behavior, including guarantees, auth and
   credentials (the mechanism that exists). Behavior that looks like a bug is documented as it is and
   recorded as an incidencia; never corrected in the definition. Two contradictory behaviors are
   documented both, and listed in the MR
4. **Extract, don't invent** - Every requirement, failure condition, rule and decision comes from the
   code; cite `archivo:línea` in your notes while you survey (not in the definition). What the code does
   not show is not written. `Descartado` only with an alternative visible in the code, the docs or the
   git history, otherwise `—`; `Motivo: —`
5. **Everything is built, origin `inicial`** - Every row `Origen: inicial`
6. **ABORT if the definition exists** - The product is already adopted or bootstrapped
7. **Deterministic work through `grava.py`** - `git-check`, `init-project`, `jiku`, `branch`,
   `def-index`, `def-check`, `conformance`, `coverage`

## Execution

### Step 0: Check and Link

Stop if "Product Definition Check" lists files.

```bash
python3 .claude/scripts/grava.py git-check --mode implement
```

`OK` continue; `BEHIND` stop (pull `dev` first); `DIRTY` stop; `OTHER_BRANCH` warn and ask whether to
continue on that branch; `NO_REMOTE` warn and ask; `NO_DEV` create `dev` from the current branch.

If "Project Link" shows `NO_PROJECT_LINK`, ask for the Jiku project id and instance (the only other
question), and:

```bash
python3 .claude/scripts/grava.py init-project --project-id {project} --instance {prod|dev} --platform {gitlab|github según el CI del repo}
```

`$ARGUMENTS` is the id of the adoption requirement. Without it, create it:

```bash
python3 .claude/scripts/grava.py jiku new --title "Adopción de grava-workflow" --description "Incorporar el producto existente a grava-workflow: relevar la definición de lo construido y los desvíos respecto de los defaults." --type mejora --state desarrollo
```

With an id: `grava.py jiku fetch {id}`; if it is not in Desarrollo, move it (`grava.py jiku state {id}
desarrollo`). Then:

```bash
python3 .claude/scripts/grava.py branch {id} adopcion
```

From here on, do not ask anything.

---

### Step 1: Survey

Identify the services (folders with their own build: `package.json`, `go.mod`, `pubspec.yaml`,
Dockerfiles, compose services). For each service, launch one `Agent` (general-purpose) in parallel with
this brief (adapt the paths):

```
Relevá el servicio en {carpeta} (solo lectura) y devolvé, en español y citando archivo:línea:
1. Stack: lenguaje, framework, librerías principales y versiones, cómo se corre y se testea.
2. Módulos o áreas del código, y de qué datos es dueño cada uno.
3. Entidades: atributos (tipo, obligatorio, restricciones), estados y transiciones, baja.
4. Esquema: tablas, columnas, restricciones, índices, triggers (de las migraciones o del ORM).
5. Operaciones que expone (HTTP: método, ruta, permisos, errores; NATS: subjects; UI: rutas y
   pantallas), y qué hace cada una, incluidos sus casos de error.
6. Procesos automáticos (jobs, colas, schedulers).
7. Integraciones externas y autenticación (credenciales, sesiones, roles).
8. Reglas que se cumplen siempre y cómo (constraints, locks, transacciones).
9. Tests: qué cubren y dónde están.
10. Configuración: variables de entorno y valores por defecto, Compose, CI/CD y despliegue.
11. Observabilidad y operación: logs (formato, ids de correlación), health, métricas, trazas, apagado.
12. Cómo cumple estos defaults de grava-workflow, y en qué se aparta: errores RFC 9457, validación de
    la entrada en el borde, configuración validada al arrancar, contraseñas y tokens, rate limit en
    autenticación, tests de integración contra una base real, contrato validado por tests.
13. Lo que parezca un bug o una inconsistencia.
No inventes: lo que no está en el código, no existe.
```

---

### Step 2: Write the Definition

From the surveys, write every file of [Product Definition](.claude/specs/product-definition.md) under
`_gflow/`:

- `prd/index.md`: actors (from roles and anonymous access), surfaces (from the frontends' routes).
- Blocks: group the behavior by what the product does for whoever uses it (not by module). Each
  operation's behavior becomes requirements; each error case a failure condition. What has no actor of
  its own (health, logs, error format, configuration validation) is not a block: it goes to
  architecture, guarantees and NFRs.
- Domain, glossary (terms the code uses with a precise meaning), invariants (rules enforced across
  records), guarantees (the mechanism that exists).
- Architecture: services, modules, interactions, persistence, communication, integrations, auth.
- Decisions: the product and technical choices the code shows, including CI/CD, deployment,
  infrastructure (what is absent counts: no broker, no cache) and how parameters are configured.
- `db-schemas/{service}.md` from the migrations; `apis/` from an existing spec when there is one
  (adding the extensions, `x-failure` also on every shared response), otherwise from the routes. Move
  an existing spec to `_gflow/apis/` and update whatever reads it (tests, Compose). `flows/` for
  operations that cross modules or services.
- `parameters.md`: business values found in configuration.

```bash
python3 .claude/scripts/grava.py def-index
python3 .claude/scripts/grava.py def-check
```

Fix every observation of `_gflow/`. Commit: `docs: definición del producto existente (#{id})`.

---

### Step 3: Deviations

```bash
python3 .claude/scripts/grava.py conformance
```

It checks what a script can (Make targets, Compose, `.env.example`, CI with secret scanning and
audit, guides, branches, contracts, JUnit). Add what needs judgment from point 12 of the surveys.
Write the list — each deviation with the default it breaks, what the repository has today and the
change needed — to `desvios.md` in the working folder (`grava.py workdir`). It becomes the alignment
requirement in Step 6.

Do not fix anything: not even a missing Makefile.

---

### Step 4: Guides

- `README.md`, in Spanish (`init-project` copies the template when there is none). If the product
  already has one, keep its content and add what is missing (intro, how to start it and its URLs,
  local setup, main commands, where the docs are).
- `docs/operacion.md`, in Spanish, from the template: what exists today (health, processes,
  configuration). What does not exist is marked as such, not invented.
- In English: root `AGENTS.md` (from the template) and `services/{service}/AGENTS.md` + `CLAUDE.md` with
  the real stack, commands, structure and canonical examples. Commands that do not exist yet (no
  Makefile) are written as they run today, with a note that the alignment requirement will add them.

Commit: `docs: guías del producto (#{id})`.

---

### Step 5: Verify

Launch the [verifier](.claude/agents/verifier.md) subagent (`subagent_type: verifier`) with:

```
Adopción: #{id}. Sin especificación ni criterios.
Rama: feat/{id}-adopcion (base: dev)
Verificá que la definición en _gflow/ describe el código tal cual, en los dos sentidos: nada
documentado que el código no haga, y nada que el código haga (operaciones, errores, reglas, procesos,
configuración) sin documentar. Verificá que la lista de desvíos en {ruta de desvios.md} es correcta y
completa. El código no cambió, salvo las rutas que mueven el contrato.
```

Fix and verify again as in the other skills (previous findings to each new verifier; stop when a
finding survives two fixes or after five rounds, without pushing).

---

### Step 6: Close

```bash
python3 .claude/scripts/grava.py coverage --all
git push -u origin feat/{id}-adopcion        # if there is a remote
```

In Jiku:

- **Alignment requirement** — from `desvios.md`, a requirement with the format of the Requirement Spec:
  scope = the deviations; proposal = the change for each; criteria = one local criterion per deviation
  (`{nuevo id}-AC-NN`, filled after creating it). Create it in Análisis:
  `grava.py jiku new --title "Alinear con los defaults de grava-workflow" --type mejora --state analisis
  --description "{resumen}"`, then write its fields with `grava.py spec draft {nuevo id}` +
  `spec push {nuevo id}`. When it is specified, a deviation the user wants to keep becomes a technical
  decision.
- **Incidencias** — one per suspected bug, in Análisis:
  `grava.py jiku new --type incidencia --title "{título}" --description "{comportamiento actual y por
  qué parece un error, sin código}"`.
- **Comment** on the adoption requirement:

```markdown
## Producto adoptado — #{id}

Rama: `feat/{id}-adopcion`. Definición: {n} bloques, {m} entidades, {k} operaciones.
Desvíos de los defaults de grava-workflow: {n}, en el requisito #{alineación}.
Bugs sospechados: {n}, cargados como incidencias: #{…}.
Cobertura por ID: {x}/{y} (los tests anteriores no llevan IDs).
```

Write the MR/PR description to `mr-{id}.md` in the working folder: what was surveyed, the deviations,
the suspected bugs, contradictions found, coverage. Report the same to the user, with the path.

## Output

- `_gflow/` (project link, definition, contracts, schema, flows), `README.md`, `docs/operacion.md`,
  `AGENTS.md` and `CLAUDE.md` files, on `feat/{id}-adopcion`, pushed
- The MR/PR description in the working folder
- Jiku: the adoption requirement (comment), the alignment requirement, one incidencia per bug
