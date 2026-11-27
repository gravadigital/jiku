# Language

Which language each thing jiku flow writes is in. Read it before writing anything a person or an agent
will read: a message, a document, a Jiku field, a commit, a test.

## CRITICAL RULES

1. **The product language is the people's.** Everything a person of the product reads is written in
   `language` of `_jflow/project.yaml` (`es`, `en`, `pt`…; **Spanish when unset**). It is asked when
   `project.yaml` is created (`/jflow-product-discover`, `/jflow-product-brownfield`) and never guessed.
2. **What only agents read is English.** `AGENTS.md`, `CLAUDE.md`, `project.yaml`, code, comments,
   identifiers and the output of `jflow.py` are always English, whatever the product language.
3. **Git is English.** Commit messages, the MR/PR text, branch names and test names are always English.
   What the MR quotes from the specification (its scope, a decision) stays as it was written.
4. **The conversation follows the user.** Talk to the user in the language they write in; it does not
   need to be the product language. Until the user has written something in their own words (a skill
   started with only `/jflow-… {id}` says nothing about it), use the product language. The messages the
   skills quote in English are templates: never send them as they are to a user who writes in another
   language.
5. **Structure in English or Spanish, content in the product language.** The documents people read have
   a fixed structure that `jflow.py` reads: headings, table columns, bold labels and the fixed values of
   some columns (`add`, `new`, `test`…). It is written in Spanish when the product language is Spanish,
   and in English for any other language; the scripts read both. Use the exact names of the
   vocabulary below (`jflow.py lang-terms`), never a translation of your own.
6. **Never translate content you did not write.** A quote from the discovery, the user's words, a
   requirement title: keep them as they are. Translate only when this spec says so (rule 7).
7. **The definition: English structure, content in the product language.** The definition (`_jflow/prd/`,
   `apis/`, `db-schemas/`, `flows/`) has its headings, columns, fixed values and the text the scripts
   generate in English. Its content stays in the product language, never translated: its rows are
   copied word for word from the criteria in Jiku and from the discovery, and the checks compare them
   (`spec check`, `spec diff`); parameters are cited by name and entities are found by name. Domain
   names (entities, surfaces, blocks, parameters, states, roles) are the product's ubiquitous language;
   identifiers in code and contracts are their English translation (see the Database spec).

## What goes in which language

| What | Language | Where the rule is applied |
|---|---|---|
| Messages to the user | the user's | every skill |
| Jiku: specification, comments, tasks, issues, release note, the titles the plan creates | product | `jflow.py spec`, `plan-push`, `out-of-scope`, `jiku comment` |
| Discovery (`_jflow/discovery/`) | product | `/jflow-product-discover` |
| `README.md`, `docs/` (operations, integration, adoption report), `CHANGELOG.md` | product | the templates of `.claude/templates/{es,en}/`, `jflow.py changelog` |
| Error messages and texts the product shows its users | product (the product's own NFR of language decides the rest) | engineering spec |
| Definition (`_jflow/prd/`, `apis/`, `db-schemas/`, `flows/`) | structure English, content product | product definition spec |
| `AGENTS.md`, `CLAUDE.md`, `project.yaml` | English | templates |
| Commits, MR/PR text, branches, test names | English | engineering spec |
| Code, comments, identifiers, `jflow.py` output | English | — |

## Configuration

```yaml
language: es        # es | en | any language code; structure: Spanish for es, English for the rest
```

`jflow.py init-project --language {code}` writes it. Changing it later changes only what is written from
then on: documents already written keep their language (the scripts read both structures).

## Files by language

| Document | Spanish (`es`) | Other languages |
|---|---|---|
| Operations guide | `docs/operacion.md` | `docs/operations.md` |
| Integration guide | `docs/integracion.md` | `docs/integration.md` |
| Adoption report | `docs/adopcion.md` | `docs/adoption.md` |
| Templates | `.claude/templates/es/` | `.claude/templates/en/` (written in the product language) |

`README.md` and `CHANGELOG.md` keep their names. In the skills, «the operations guide» means the file of
this table.

## Vocabulary

The structural names, English and Spanish. `python3 .claude/scripts/jflow.py lang-terms` prints the
complete, current list (from `jflowlib/lang.py`); `--grep {text}` filters it. The ones most used:

| English | Español |
|---|---|
| Scope · Includes · Excludes · Depends on | Alcance · Incluye · No incluye · Depende de |
| Proposal · Parameters · Decisions · Technical detail | Propuesta · Parámetros · Decisiones · Detalle técnico |
| Acceptance criteria · Change · Criterion | Criterios de aceptación · Cambio · Criterio |
| Type · Topic · Decision · Rejected · Reason · Affects | Tipo · Tema · Decisión · Descartado · Motivo · Afecta |
| add · modify · remove | agrega · modifica · elimina |
| new · reverts · keeps | nueva · revierte · respeta |
| Non-functional requirements · Verification · Tested in | Requisitos no funcionales · Verificación · Prueba en |
| test · alert · review | prueba · alerta · revisión |
| Blocks · Data · Invariants and guarantees · Schema · Interface · Flows · Architecture | Bloques · Datos · Invariantes y garantías · Esquema · Interfaz · Flujos · Arquitectura |
| Visual reference · Package · Screen · Reference · Route · State · Decided difference | Referencia visual · Paquete · Pantalla · Referencia · Ruta · Estado · Diferencia decidida |
| Decided in the implementation | Decidido en la implementación |
| Specification: draft · ready | Especificación: borrador · lista |
| Origin | Origen |
| Base product | Producto base |
| Unreleased · Added · Changed · Fixed · Removed · Known issues | Sin publicar · Agregado · Cambiado · Corregido · Eliminado · Problemas conocidos |
