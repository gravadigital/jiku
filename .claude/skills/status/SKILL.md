---
name: status
description: Show the state of the product - its stage, the Jiku requirements grouped by their next action crossed with the git branches, what is ready to release, and inconsistencies
allowed-tools: "Read, Glob, Grep, Bash"
---

# Status

## Purpose

One view of where the product is: the stage (being defined, base pending, defined), every open Jiku
requirement with what has to happen next, the branches that carry them, what `dev` has that `main`
does not, and anything that does not add up between Jiku and git.

**Flow:**

```
Step 0: Collect (grava.py status)
  |
Step 1: Present with next actions
```

**Result:** A dashboard in chat.

**This command does NOT:**

- Create, modify or move anything, in the repository or in Jiku

## References

**Read [Jiku](.claude/specs/jiku.md)** — what each state means and who moves it.

## CRITICAL RULES

1. **Use Spanish**
2. **Read-only** - Never write, in the repository or in Jiku; `git fetch` is the only git command that
   touches anything (remote references)
3. **Deterministic work through `grava.py`** - `status` does the crossing; you present it

## Execution

### Step 0: Collect

```bash
python3 .claude/scripts/grava.py git-check --mode read
python3 .claude/scripts/grava.py status
```

If Jiku does not answer, `status` shows only git: say so in one line.

---

### Step 1: Present

```markdown
## {Producto} — estado

Etapa: {sin definir | discovery en curso | discovery cerrado, sin base | definido}
{{si git-check no da OK: una línea con lo que dice}}

### {grupo}
- #{id} {título} — {detalle} → {siguiente acción}
…
```

Show the groups `status` printed, in its order, omitting the empty ones: Incidencias abiertas (with
the requirement each was seen in), Para especificar,
Especificados (esperan aprobación), Para implementar, En cola (esperan a otro requisito), En
implementación, Mergeados sin liberar, Liberados sin pasar a Revisión, En revisión, Para liberar,
Inconsistencias. By stage:

| Stage | Next action |
|---|---|
| Sin definir | `/product-define` (new product) or `/product-adopt` (existing code) |
| Discovery en curso | `/product-define` to continue |
| Discovery cerrado, sin base | `/product-bootstrap {id del requisito base}` |
| Definido | The groups above |

## Output

A dashboard in chat. Nothing is written.
