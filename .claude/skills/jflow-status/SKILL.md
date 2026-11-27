---
name: jflow-status
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
Step 0: Collect (jflow.py status)
  |
Step 1: Present with next actions
```

**Result:** A dashboard in chat.

**This command does NOT:**

- Create, modify or move anything, in the repository or in Jiku

## References

**Read [Jiku](.claude/specs/jiku.md)** — what each state means and who moves it.

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request): the dashboard below is a template,
   presented in that language; requirement titles stay as they are in Jiku. See
   [Language](.claude/specs/language.md)
2. **Read-only** - Never write, in the repository or in Jiku; `git fetch` is the only git command that
   touches anything (remote references)
3. **Deterministic work through `jflow.py`** - `status` does the crossing; you present it

## Execution

### Step 0: Collect

```bash
python3 .claude/scripts/jflow.py git-check --mode read
python3 .claude/scripts/jflow.py status
```

If Jiku does not answer, `status` shows only git: say so in one line.

---

### Step 1: Present

```markdown
## {Product} — status

Stage: {not defined | discovery in progress (…) | discovery closed, no base | base built}
{{if git-check is not OK: one line with what it says}}

### {group}
- #{id} {title} — {detail} → {next action}
…
```

Show the groups `status` printed, in its order, omitting the empty ones: Open issues (with the
requirement each was seen in), Drafts, to specify, To specify, Specified, waiting for approval, To
implement, Queued, waiting for another requirement, In implementation, Merged, not released, Released,
not moved to Review, In review, To release, Inconsistencies. By stage:

| Stage | Next action |
|---|---|
| not defined | `/jflow-product-discover` (new product) or `/jflow-product-brownfield` (existing code) |
| discovery in progress (…) | `/jflow-product-discover` to continue |
| discovery closed, no base | `/jflow-product-scaffold {id of the base requirement}` |
| base built | The groups above |

## Output

A dashboard in chat. Nothing is written.
