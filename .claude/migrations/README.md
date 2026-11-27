# Migrations System

This directory contains migration scripts that automatically update project structure when updating jiku flow versions.

## How It Works

When you run `/jflow-framework-update`, the system:

1. Reads `.claude/.jflow-version` (without it, a fresh install: it takes the installed version)
2. Compares with the target — the `.claude/VERSION` shipped by the new copy
3. Executes, in order, every migration whose target falls inside that range
4. Writes the target into `.claude/.jflow-version`

The gate is `PROJECT_VERSION < MIGRATION_TARGET <= WORKFLOW_TARGET`, so a migration runs exactly once
per project.

**Reachability rule.** `WORKFLOW_TARGET` is `.claude/VERSION`, so a migration declaring a target
**above** it is unreachable: it never runs and nothing warns. That is a legitimate state for a change
still under test — it stays dormant until a release reaches it — but it has to be deliberate, and the
release process has a step for checking it.

## Migration Types

| Type | Extension | When | How it runs |
|------|-----------|------|-------------|
| **Script** | `.sh` | The change is mechanical: move files, edit YAML, delete folders | `migrate.sh` executes it directly, in order |
| **Agent** | `.md` | The change needs interpretation: infer a layout, derive content, resolve a conflict between two values | `migrate.sh` lists it in `.claude/agent-migrations-pending.md`; the agent executes it during the same `/jflow-framework-update` |

The target is declared differently in each: `TARGET_VERSION="X.Y.Z"` in a `.sh`,
`target_version: "X.Y.Z"` in the frontmatter of a `.md`.

Pick agent over script whenever a script would have to **guess**. A `.sh` that invents a value
produces documentation nobody can tell apart from a real decision.

## Migration Files

None yet. The chain starts at 1.0.0. Number new migrations from `001`.

## Agent Migration Format (`.md`)

```markdown
---
target_version: "1.1.0"
requires: "docs/ux/"            # optional: path that must exist for the migration to apply
description: "One line, in English — this is what the pending list shows the agent"
---

# Migration NNN: Title

## Purpose            # what changed and why a script cannot do it
## Execution          # numbered steps; step 0 is the idempotency check ("already applied → stop")
```

Any further `##` section is a **template** the steps fill in (the proposal table a gate shows the
user, the final report). Keep them out of `## Execution` so the steps stay readable.

An agent migration is a **prompt**, so it has to be explicit about the same things a script is:
how to detect it already ran, what to do per file, and where to stop and ask. If it rewrites product
or UX documentation, batch a review gate — do not apply screen-by-screen edits silently.

`migrate.sh` collects them into `.claude/agent-migrations-pending.md` **accumulatively**: entries the
agent has not executed yet survive a later run. `/jflow-framework-update` deletes that file only after running
all of them.

## Migration Script Format (`.sh`)

Each migration script must:

```bash
#!/bin/bash
# Migration: 001-move-flows-index
# From version: 1.0.0
# To version: 1.1.0
# Description: Moves _jflow/flows/README.md to _jflow/flows/index.md

TARGET_VERSION="1.1.0"

# Your migration logic here...
```

### Required Variables

- `TARGET_VERSION` - The version this migration targets

### Execution Model

`migrate.sh` runs each `.sh` migration in an **isolated child process** (`bash "$migration_file"`), never with `source`. Consequences to keep in mind when writing one:

- The script **must call its own `main`** (or otherwise do its work) at the end — nothing else will invoke it.
- It gets **no** variables or functions from the orchestrator: define your own `log_*` helpers, colors and paths.
- Variables it defines (`TARGET_VERSION` included) **cannot** leak into the orchestrator. This isolation is what keeps a chain of several migrations running; do not switch it back to `source`.
- Exit non-zero to signal failure — the orchestrator aborts the whole chain on a failed migration.

### Best Practices

- Make migrations **idempotent** (can run multiple times safely)
- Check if migration is needed before executing
- Provide clear console output about what's happening
- Handle edge cases gracefully
- Migrate data completely before removing old structure
- Assume users have git/backups (this is a development tool)

## Version Detection

When a project doesn't have `.jflow-version` (a fresh install), `migrate.sh` creates it with the
installed version: there is nothing to migrate.

## Manual Migration

If you need to run migrations manually:

```bash
bash .claude/scripts/migrate.sh
```

This will:
1. Detect or create `.jflow-version`
2. Execute pending migrations
3. Update `.jflow-version` to current version

## Troubleshooting

- **Migration failed**: Check the migration script output, fix the issue, and re-run
- **Want to skip a migration**: Not recommended, but you can manually update `.jflow-version`
- **Need to re-run a migration**: Temporarily lower the version in `.jflow-version` and run `/jflow-framework-update`
