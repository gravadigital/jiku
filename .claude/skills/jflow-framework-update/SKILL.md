---
name: jflow-framework-update
description: Update jiku flow in this repository to the latest version (or a given one) - compare versions, show the changes, decide what to do with local modifications, back up, update only what belongs to jiku flow and run the migrations
argument-hint: "[version, e.g. v1.2.0]"
allowed-tools: "Read, Bash, AskUserQuestion"
---

# Update Tools

## Purpose

Bring jiku flow in this repository's `.claude/` to the latest version (or the one the user names), without
losing local modifications, and run the migrations between the installed version and the new one. Only
what belongs to jiku flow changes: the files listed in `.claude/.jflow-manifest`, plus jiku flow's own
entries in `settings.json` and its block in `.claude/CLAUDE.md`; the user's own skills, agents and
settings are never touched. Everything mechanical is done by `.claude/scripts/framework-update.sh`, which
installs with the `jflow.py` of the downloaded version; the agent interprets its output, asks the user
what to do with local changes, and runs the agent migrations.

**Flow:**

```
Step 0: Download and compare versions
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

**Result:** `.claude/` at the new version, `.claude/.jflow-version` updated, the migrations applied,
and a backup of the previous `.claude/` in the system's temp folder (it stays after `cleanup`).

**This command does NOT:**

- Commit or push the update (the user reviews and commits it)
- Install jiku flow in a repository that does not have it (that is `install.sh`, see the README)
- Touch the user's own files in `.claude/`
- Touch the product's code, definition or guides

## References

**Read [Migrations README](.claude/migrations/README.md)** — only when there are agent migrations to
run (Step 4): their format and how to apply them.

## CRITICAL RULES

1. **Language** - Talk to the user in the language they write in (the product language until they write in their own words; with no project yet, the language of the request): the messages quoted below are
   templates, said in that language. The commit message is English. See
   [Language](.claude/specs/language.md)
2. **Everything through the script** - `framework-update.sh` compares, backs up, updates, migrates and
   verifies. Never copy or delete files of `.claude/` by hand
3. **Only jiku flow's files change** - The script never touches a file that is not in the manifest;
   `settings.local.json`, `local-config.yaml` and `.jflow-version` are never shipped
4. **Local modifications are the user's call** - Ask with `AskUserQuestion` before replacing any
   `MODIFIED` file

## Execution

### Step 0: Versions

```bash
bash .claude/scripts/framework-update.sh check-version
bash .claude/scripts/framework-update.sh fetch-remote {version}  # the version the user gave; without one, the latest release
bash .claude/scripts/framework-update.sh compare
```

| Output | Action |
|---|---|
| `COMPARISON:0` | Same version: ask whether to reinstall it |
| `COMPARISON:1` | The local version is newer (local development of jiku flow?): warn and ask whether to continue |
| `COMPARISON:2` | Continue |

---

### Step 1: What Changes

```bash
bash .claude/scripts/framework-update.sh changelog
```

Summarize for the user, in a few lines, what changes between the two versions (new or removed skills,
changes in how they work).

---

### Step 2: Local Modifications

```bash
bash .claude/scripts/framework-update.sh detect-changes
```

It lists what the update would do, by kind:

| Kind | Meaning |
|---|---|
| `NEW`, `UPDATE`, `REMOVE` | jiku flow's files to add, replace or delete: nothing of the user's |
| `MODIFIED` | jiku flow's files the user changed since they were installed |
| `CLASH` | a file of the user's with the same path as one of jiku flow's (no manifest yet) |
| `KEEP_REMOVED` | dropped by the new version but changed by the user: left in place |

If there are `MODIFIED` or `CLASH` files, ask with `AskUserQuestion`, for all of them or one by one:
1. Take the new version (the user's is saved next to it as `{file}.bkp`)
2. Keep the user's version (the new one is saved next to it as `{file}.new`)
3. Show the diff first
4. Cancel

---

### Step 3: Back Up and Update

```bash
bash .claude/scripts/framework-update.sh backup
bash .claude/scripts/framework-update.sh update                       # every MODIFIED file replaced
bash .claude/scripts/framework-update.sh update --keep {file1} {file2}  # these keep the user's version
```

---

### Step 4: Migrations

```bash
bash .claude/scripts/framework-update.sh migrate
```

It runs the script migrations whose target is between the installed version and the new one, updates
`.claude/.jflow-version`, and lists in `.claude/agent-migrations-pending.md` the ones that need the
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
bash .claude/scripts/framework-update.sh verify
bash .claude/scripts/framework-update.sh cleanup
```

```markdown
## jiku flow updated: {previous} → {new}

- Backup: {path}
- Your changes: {replaced (yours in `.bkp`) and kept (the new one in `.new`), or "none"}
- Left in place although the new version dropped them: {list or "none"}
- Migrations: {script and agent ones run, or "none"}

Review the changes (`git status`) and commit them: `chore: update jiku flow to {new}`.
```

## Output

- `.claude/` at the new version, `.claude/.jflow-version` updated
- A backup of the previous `.claude/` in the system's temp folder
- Nothing committed
