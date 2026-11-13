---
name: product-release
description: Release a version of the product - the requirements merged in dev that main does not have, the suggested semantic version, CHANGELOG, merge to main, tag, and a note in Jiku. Use it also when the user says "versioná", "liberá", "nueva versión" or similar in a product repository
allowed-tools: "Read, Edit, Bash, AskUserQuestion"
---

# Release Product

## Purpose

Publish what `dev` has and production does not, as a new version: the CHANGELOG section from the Jiku
requirements merged since the last tag, a semantic version suggested from what they are, the merge of
`dev` into `main` with its tag, and a note on every requirement saying which version it shipped in.
One confirmation from the user, before anything is merged.

**Flow:**

```
Step 0: Check (product repository, dev up to date, something to release)
  |
Step 1: Regression on dev, locally: make check, the whole end-to-end suite, make test-perf
  |
Step 2: Requirements and suggested version → the user confirms
  |
Step 3: CHANGELOG on dev
  |
Step 4: Merge dev → main, tag, push
  |
Step 5: Note in Jiku, report
```

**Result:** `CHANGELOG.md` with the new section on `dev`; `main` with the merge and the tag `vX.Y.Z`,
pushed; a comment on every requirement released.

**This command does NOT:**

- Deploy, or move any requirement's state (Revisión and Resuelto are people's)
- Release grava-workflow itself (its repository has its own release process)
- Force anything on a protected `main`: it leaves the release ready and says to open the MR

## References

**Read [Engineering](.claude/specs/engineering.md)** — versioning and git.

**Read [Jiku](.claude/specs/jiku.md)** — the comment.

## Pre-loaded Context

### Repository

!`ls _gflow/project.yaml 2>/dev/null || echo "NO_PRODUCT"`

## CRITICAL RULES

1. **Use Spanish** in the CHANGELOG, commits, Jiku and messages
2. **Only in a product repository** - ABORT if there is no `_gflow/project.yaml` (in the grava-workflow
   repository, "versioná" means its own release process, in its `CLAUDE.md`)
3. **One confirmation** - The version is confirmed with `AskUserQuestion` before the CHANGELOG is
   written and anything is merged
4. **Deterministic work through `grava.py`** - `git-check`, `release-info`, `changelog`, `jiku comment`,
   `jiku new`

## Execution

### Step 0: Check

ABORT per CRITICAL RULE 2 if "Repository" shows `NO_PRODUCT`. Then:

```bash
python3 .claude/scripts/grava.py git-check --mode implement
```

`OK` continue; `BEHIND`, `DIRTY`, `NO_DEV` stop and say what to do; `OTHER_BRANCH` switch to `dev`
only if the user agrees; `NO_REMOTE` warn (nothing will be pushed) and ask.

---

### Step 1: Regression

Each requirement proved, at its close, the screens and the operations it touched. Before a version,
prove everything together, locally, on `dev` as it will be released — the slow levels do not run in
each MR's CI ([Engineering](.claude/specs/engineering.md), End to end, by platform):

```bash
make check
make test-e2e      # the whole suite: browsers, or the Android emulator for a mobile app
make test-perf     # if the product has NFRs verified by load
```

All green → continue. A failure → stop before anything is merged or tagged: report what failed (test,
screenshot, log), record it as an `incidencia` unless an open one covers it (`grava.py jiku list`):
`grava.py jiku new --type incidencia --state analisis --title … --description …` — what failed, how to
reproduce it, and «Detectado en la regresión antes de la versión {versión}» — and tell the user the
version is not ready. If the machine cannot run a level (no Docker, no KVM for
the emulator), say so and ask whether to release without it; never skip it silently.

---

### Step 2: Requirements and Version

```bash
python3 .claude/scripts/grava.py release-info
```

If it says there is nothing to release, stop. Otherwise show the requirements and the suggested
version with its reason, and the open incidencias it lists (with the requirement they were seen in):
they do not block the release, but the user decides knowing them. Ask with `AskUserQuestion`: the
suggested version (recommended), the other two semver bumps, or another version; and, if there are
open incidencias, whether the CHANGELOG lists them as «Problemas conocidos» (recommended when one
affects what is released).

---

### Step 3: CHANGELOG

```bash
python3 .claude/scripts/grava.py changelog {versión}            # --known-issues if the user said so
```

It adds the section below `[Sin publicar]`, moves there the entries written by hand under
`[Sin publicar]` that cite a released requirement, and writes the rest from the Jiku titles (without
the plan order). Review it and adjust wording only. Commit on `dev`:
`chore: versión {versión}`.

---

### Step 4: Merge, Tag, Push

```bash
git push origin dev
git switch main && git pull --ff-only
git merge --no-ff dev -m "chore: versión {versión}"
git tag v{versión}
git push origin main && git push origin v{versión}
git switch dev
```

**First release** (no `main`, locally or in the remote): create it instead of merging —
`git branch main dev`, then tag, push (`git push -u origin main`) and switch back to `dev` as above.
Tell the user to protect `main` in the git platform.

If pushing `main` is refused (protected branch), undo the local merge (`git reset --hard origin/main`),
keep the tag unpushed, and tell the user to open the MR from `dev` to `main` and create the tag after
merging it.

---

### Step 5: Jiku and Report

For each released requirement:

```bash
python3 .claude/scripts/grava.py jiku comment {id} "Incluido en la versión {versión}."
```

```markdown
## Versión {versión} liberada

Tag `v{versión}` en `main` {{pusheado / pendiente del MR}}. {n} requisitos: #{…}.
CHANGELOG actualizado. Los estados en Jiku no cambiaron: pasan a Revisión después del deploy.
```

## Output

- `CHANGELOG.md` on `dev`; `main` merged and tagged `v{versión}`, pushed (or ready, when protected)
- Jiku: a comment on every released requirement
