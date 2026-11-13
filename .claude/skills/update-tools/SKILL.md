---
name: update-tools
description: Update grava-workflow in this repository to the latest version - compare versions, show the changes, preserve local modifications, back up, update and run the migrations
allowed-tools: "Read, Bash, AskUserQuestion"
---

# Update Tools

## Purpose

Bring the `.claude/` folder of this repository to the latest version of grava-workflow, without
losing local modifications, and run the migrations between the installed version and the new one.
Everything mechanical is done by `.claude/scripts/update-tools.sh`; the agent interprets its output,
asks the user what to do with local changes, and runs the agent migrations.

**Flow:**

```
Step 0: Compare versions (abort on an incompatible jump)
  |
Step 1: Show what changes (CHANGELOG)
  |
Step 2: Local modifications → the user decides
  |
Step 3: Back up and update
  |
Step 4: Script migrations, then agent migrations
  |
Step 5: Verify, clean up, report
```

**Result:** `.claude/` at the new version, `.claude/.grava-version` updated, the migrations applied,
and a backup of the previous `.claude/` in the system's temp folder.

**This command does NOT:**

- Commit or push the update (the user reviews and commits it)
- Update across an incompatible major: from a version before 11 to 11 or later there is no migration
- Touch the product's code, definition or guides

## References

**Read [Migrations README](.claude/migrations/README.md)** — only when there are agent migrations to
run (Step 4): their format and how to apply them.

## CRITICAL RULES

1. **Use Spanish** with the user
2. **Everything through the script** - `update-tools.sh` compares, backs up, updates, migrates and
   verifies. Never copy or delete files of `.claude/` by hand
3. **Protected files are never overwritten** - `settings.local.json`, `local-config.yaml` and
   `.grava-version` are preserved by the script; tell the user they were
4. **Local modifications are the user's call** - Ask with `AskUserQuestion` before overwriting any
   `MODIFIED` file
5. **ABORT on `BLOCKED:v11`** - The jump is incompatible; never force it

## Execution

### Step 0: Versions

```bash
bash .claude/scripts/update-tools.sh check-version
bash .claude/scripts/update-tools.sh fetch-remote
bash .claude/scripts/update-tools.sh compare
```

| Output | Action |
|---|---|
| `BLOCKED:v11` | Stop: «Este producto está en {local} y grava-workflow {remota} es incompatible: no hay migración desde versiones anteriores a 11. El camino es adoptar el producto con v11 (`/product-adopt`), no actualizar.» Run `cleanup` |
| `COMPARISON:0` | Same version: ask whether to reinstall it |
| `COMPARISON:1` | The local version is newer (local development of grava-workflow?): warn and ask whether to continue |
| `COMPARISON:2` | Continue |

---

### Step 1: What Changes

```bash
bash .claude/scripts/update-tools.sh changelog
```

Summarize for the user, in a few lines, what changes between the two versions (new or removed skills,
changes in how they work).

---

### Step 2: Local Modifications

```bash
bash .claude/scripts/update-tools.sh detect-changes
```

- `PROTECTED` files are preserved automatically: just list them.
- If there are `MODIFIED` or `LOCAL_ONLY` files, ask with `AskUserQuestion`:
  1. Update everything (local changes are lost; they stay in the backup)
  2. Update preserving the modified files (the new version of each is saved next to it as `.bkp`)
  3. Show the diff of some files first
  4. Cancel

---

### Step 3: Back Up and Update

```bash
bash .claude/scripts/update-tools.sh backup
bash .claude/scripts/update-tools.sh update-full
# or, preserving files:
bash .claude/scripts/update-tools.sh update-preserve "{archivo1}" "{archivo2}"
```

---

### Step 4: Migrations

```bash
bash .claude/scripts/update-tools.sh migrate
```

It runs the script migrations whose target is between the installed version and the new one, updates
`.claude/.grava-version`, and lists in `.claude/agent-migrations-pending.md` the ones that need the
agent.

```bash
cat .claude/agent-migrations-pending.md 2>/dev/null || echo "NO_PENDING"
```

For each listed migration (a `.md` file in `.claude/migrations/`): check its `requires` field against
this repository, and if it applies, follow its steps. When all are done, delete
`.claude/agent-migrations-pending.md`.

---

### Step 5: Verify and Report

```bash
bash .claude/scripts/update-tools.sh verify
bash .claude/scripts/update-tools.sh cleanup
```

```markdown
## grava-workflow actualizado: {anterior} → {nueva}

- Backup: {ruta}
- Archivos protegidos preservados: {lista}
- Con conflicto (revisar el `.bkp` al lado de cada uno): {lista o "ninguno"}
- Migraciones: {script y de agente ejecutadas, o "ninguna"}

Revisá los cambios (`git status`) y commitealos: `chore: grava-workflow {nueva}`.
```

## Output

- `.claude/` at the new version, `.claude/.grava-version` updated
- A backup of the previous `.claude/` in the system's temp folder
- Nothing committed
