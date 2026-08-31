# Functional Analysis

How to extract and structure product knowledge. Read this before capturing
requirements, requests, PRD sections or domain entities.

## Extract, Don't Generate

The user knows the business, the client and the constraints. The job is to pull that
knowledge out and structure it — not to write a PRD from training data.

- When the user gives enough detail, draft the section. When they don't, ask before inventing.
- Every section must be traceable to something the user said.
- **Never silently generate business rules, limits or default values.**

## Show What You Assume

When a gap must be filled to complete a section (default values, enum names, field
types), state it explicitly:

```
Voy a asumir que {{assumption}} porque {{reason}}. ¿Es correcto?
```

## Challenge Vagueness at the Point of Impact

Don't accept vague input ("debe ser rápido", "muchos usuarios", "permisos granulares")
— but only push back when the vagueness causes a downstream problem.

- `El usuario puede ver un dashboard` — fine as a description
- `El sistema debe ser seguro` — NOT fine as an NFR

**The test:** could the next phase implement this without asking another question?
If no, push back.

## Depth Where It Matters

- **Go deep on domain entities** — attributes, types, enums with all values,
  relationships, business rules, state transitions, permissions. This is the highest
  value activity: get it right and everything downstream flows.
- **Go deep on complex logic** — multi-step flows, conditional rules, external integrations
- **Keep brief** — descriptions, context sections, problem statements
- **Skip entirely if not relevant** — don't force compliance sections on a simple internal tool

Look for implicit entities the user hasn't named. Example: *"Mencionaste que un usuario
puede tener diferentes permisos en diferentes proyectos. Eso suena como una entidad
Miembro separada de Usuario. ¿Es así?"*

## Asking

- **Ask iteratively** — react to what was said; never dump a questionnaire
- **Confirm understanding** — paraphrase and let the user correct
- Go deeper on domain specifics: *"¿Qué pasa cuando un pedido se cancela después de que
  ya se envió?"* is high value. *"¿Cuál es el nombre del producto?"* is not.
- When the user can't give a number, help them think: *"¿Cuántos usuarios concurrentes
  esperás el primer mes? ¿100? ¿1000? ¿10000?"*

## Consistency Validation

Cross-reference goals ↔ requirements ↔ feature groups and flag, never silently fix:

- Orphan goals (no requirement addresses them)
- Orphan requirements (don't trace to any goal)
- Entity inconsistencies (mentioned in capabilities but absent from Domain Entities)

## Project Conventions

**Complexity scale** (used when capturing requests):

| Level | Meaning |
|---|---|
| Baja | 1 servicio, días |
| Media | 2 servicios, ~1 semana |
| Alta | 3+ servicios, semanas |

**Feature groups**: each one delivers working, deployable functionality. Feature Group 1
is the walking skeleton (infrastructure + minimal functionality). Sequence by what users
can actually DO after it's complete.
