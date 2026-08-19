# Migrations System

This directory contains migration scripts that automatically update project structure when updating Grava Workflow versions.

## How It Works

When you run `/update-tools`, the system:

1. Reads `.grava-version` from your project root (or detects it automatically)
2. Compares with the new version being installed
3. Executes only the migrations needed between those versions
4. Updates `.grava-version` to the new version

## Migration Files

Each migration is a bash script named with a sequential number:

- `001-consolidate-tasks.sh` - Migrates from v1.5.0 → v1.6.0 (task structure change)
- `002-add-story-plans-path.sh` - Migrates from v1.8.0 → v1.9.0 (adds story_plans to local-config.yaml)
- `003-migrate-epics-to-files.sh` - Migrates from v1.10.0 → v1.11.0 (migrates epics from epic-list.md to individual files in docs/epics/)
- `009-remove-monorepo-local-config.sh` - Migrates to v6.1.0 (deletes local-config.yaml in monorepo — the file is no longer used there; monorepo is auto-detected from docs/prd/)
- `010-consolidate-screen-template.sh` - Migrates to v6.2.0 (removes the stale screen-mid-tmpl.yaml; the two screen templates were consolidated into screen-tmpl.yaml)
- `011-add-viewports-to-ux.md` - Migrates to v6.2.0 (**agent migration**: declares viewports per surface and generates the desktop layout of every existing screen, with a per-surface review gate — a bash script cannot infer layouts)
- `012-wireframes-html.md` - Migrates to v6.2.0 (**agent migration**: regenerates wireframes as a self-contained HTML book and retires `.excalidraw` — deriving `screens.json` from the specs is interpretation, and the render surfaces spec bugs that need a human decision)

## Migration Script Format

Each migration script must:

```bash
#!/bin/bash
# Migration: 001-consolidate-tasks
# From version: 1.5.0
# To version: 1.6.0
# Description: Consolidates task files from docs/tasks/{story_id}/ to docs/story-plans/{story}.md

TARGET_VERSION="1.6.0"

# Your migration logic here...
```

### Required Variables

- `TARGET_VERSION` - The version this migration targets

### Best Practices

- Make migrations **idempotent** (can run multiple times safely)
- Check if migration is needed before executing
- Provide clear console output about what's happening
- Handle edge cases gracefully
- Migrate data completely before removing old structure
- Assume users have git/backups (this is a development tool)

## Version Detection

When a project doesn't have `.grava-version`:

- If it has `docs/story-plans/` → Assumes v1.6.0+ (new project)
- If it has `docs/tasks/` → Assumes v1.5.0 (legacy, needs migration)
- Otherwise → Creates `.grava-version` with current version

## Manual Migration

If you need to run migrations manually:

```bash
bash .claude/scripts/migrate.sh
```

This will:
1. Detect or create `.grava-version`
2. Execute pending migrations
3. Update `.grava-version` to current version

## Troubleshooting

- **Migration failed**: Check the migration script output, fix the issue, and re-run
- **Want to skip a migration**: Not recommended, but you can manually update `.grava-version`
- **Need to re-run a migration**: Temporarily lower the version in `.grava-version` and run `/update-tools`
