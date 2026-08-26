# CLAUDE.md

Instructions for agents working in this repository.

---

## Cutting a release

**Triggers:** "versiona", "versionar", "cortá una release", "nueva versión", "bump de
versión", "versiona y listo", "release", "cut a release", "new version", "version bump", or
any variant in either language. When one appears, follow this procedure in full and in order.

### What gets versioned and what does not

| Version | Where it lives | Who moves it |
| --- | --- | --- |
| **The product** — what "versiona" means | root `CHANGELOG.md` + `scripts/set-version.sh` | This procedure |
| The grava-workflow methodology | `.claude/VERSION` and `.claude/CHANGELOG.md` | The `/update-tools` skill. **Never touch it here** |

The whole monorepo shares a single number: `api`, `core`, `web`, `opus-web` and the packages
under `packages/` are released together and always carry the same one. The policy is in
[CHANGELOG.md](CHANGELOG.md#versioning-policy); this file is the operational step-by-step.

---

### Step 1 — Pick the cut point

`main` is the release branch; work lands through `dev`.

```sh
git describe --tags --abbrev=0            # last published version
git rev-list --left-right --count main...dev
git status --porcelain
```

**The cut has to land on a closed REQ.** Never version in the middle of a half-implemented
request. To check, look at the story statuses of the latest REQ on the candidate branch:

```sh
git ls-tree --name-only <branch> docs/requests/
grep -l "status: Completed" docs/stories/S-*.md
```

If `dev` is ahead but has pending stories, the cut is `main` — and **say so to the user**,
do not resolve it silently. If `origin/main` is behind `main`, report that too, but **do not
push** (see Step 8).

### Step 2 — Gather the actual changes

The CHANGELOG entry has to cover **everything** that landed since the last tag. Commit
subjects are not enough: read the bodies.

```sh
git log v<last>..HEAD --oneline
git log v<last>..HEAD --format='%h%n%B'        # the bodies are what explain the why
git diff --stat v<last>..HEAD
```

Sources, richest first:

1. `docs/changelog/*.md` — per-story publication entries. The best thing available: they carry
   the old contract against the new one, the deployment procedures and the decisions.
2. `docs/requests/REQ-*.md` — the request and its rationale.
3. `docs/stories/S-*.md` — the acceptance criteria.
4. The commit bodies.

And always review these diffs, because they are the ones that produce entries nobody wrote in
any document:

```sh
git diff v<last>..HEAD -- deploy/.env.dist                   # new/renamed variables
git diff v<last>..HEAD -- packages/nats-protocol/src/          # the bus contract
git diff v<last>..HEAD -- docs/apis/                           # HTTP and bus contracts
git diff --stat v<last>..HEAD -- api/db-upgrade/migrations/    # migrations
git diff v<last>..HEAD -- deploy/nats/auth-callout/            # roles and permissions
git diff v<last>..HEAD -- api/lib/routes/ api/config/public.ts
git diff v<last>..HEAD --diff-filter=D --name-only             # what was deleted
```

> **The rule that matters: every entry has to be verifiable in the tree being tagged.** If you
> cut from `main`, a change that exists only on `dev` **does not go** in the entry. It is the
> easy mistake to make when `dev` is ahead. Check with `git branch --contains <sha>` before
> claiming anything.

### Step 3 — Propose the number and WAIT

| Bump | When |
| --- | --- |
| **major** | Breaks the HTTP contract or the NATS protocol |
| **minor** | New functionality, backwards compatible |
| **patch** | Bugs and internal changes, no effect on either contract |

Present to the user: **the proposed number, the reasoning, and the list of incompatible
changes you found**.

**Do not set the version without explicit confirmation.** If the user corrects the number,
that is their call: take it. If the correction contradicts the table — a `minor` carrying
contract-breaking changes, say — state it **in one line**, keep the incompatible changes
prominent at the top of the CHANGELOG entry, and move on without pressing the point.

### Step 4 — Write the CHANGELOG entry

In [CHANGELOG.md](CHANGELOG.md), above the previous entry:

- Heading `## [X.Y.Z] - YYYY-MM-DD` with **today's real date**.
- Leave `## [Unreleased]` empty above it, and move whatever was there below the new heading.
- Keep a Changelog sections, only the ones that apply: `Added`, `Changed`, `Deprecated`,
  `Removed`, `Fixed`, `Security`.
- **`### Notes for existing installations`** at the end. It belongs to this repository, not to
  Keep a Changelog, and it is **mandatory** when there are: new required environment
  variables, renamed or removed variables, destructive migrations, roles that change in the
  identity provider, or bus consumers that have to migrate.
- In English, like the rest of the file. Bold lead-in on the important entries. Say **what
  breaks and what whoever operates the installation has to do**, not just what changed.
- Never delete or rewrite entries of already-published versions.

### Step 5 — Update the README and the public docs if needed

Review and update where it applies:

- **[README.md](README.md)** — if the `Structure` table changed (a directory added or
  removed), the architecture diagram, the endpoint count, the *Getting started*
  prerequisites, the Node version, or any document it links to.
  **It carries no version number, on purpose: do not add one.**
- **[documentation/](documentation/)** — the public docs. `configuration.md` is the one that
  goes stale most often, because environment variables change in nearly every release. Also
  review `features.md`, `installation.md`, `api-reference.md` and `known-limitations.md`.
- `docs/apis/*.yaml` are the source of truth for the contracts: where the code and the
  document disagree, the document wins — and that is a bug to report, not something to
  "fix" in the yaml during a release.

### Step 6 — Apply the number

A single script writes the thirteen values across ten files (8 `package.json`, the lockfile
and the four `*_VERSION` defaults in `deploy/.env.dist`):

```sh
scripts/set-version.sh X.Y.Z
scripts/set-version.sh --check     # must say "ok: everything reports X.Y.Z"
```

Recommended before tagging, because `release.yml` will run it anyway and by then the tag is
already placed:

```sh
npm run build && npm run lint && npm test
```

### Step 7 — Commit

On the cut branch, with the CHANGELOG, the ten version files and whatever you touched in
README / `documentation/`.

**Never `git add -A` or `git add .` here.** The repository root deliberately carries untracked
analysis documents — the inputs a REQ was captured from, which `docs/requests/` references as
"must not be deleted" — and a blanket add would commit them. Stage the release files by name:

```sh
git add CHANGELOG.md README.md documentation/ \
        package.json package-lock.json api/package.json core/package.json \
        web/package.json opus-web/package.json packages/*/package.json \
        deploy/.env.dist
git status --porcelain          # confirm nothing unintended is staged
git commit -m "chore(release): X.Y.Z"
```

Close the message with the usual `Co-Authored-By:` line.

### Step 8 — Tag locally, and nothing else

```sh
git tag vX.Y.Z
```

> ### NEVER PUSH ANYTHING
>
> Not the branch, not the tag, not `git push --tags`, not `git push --follow-tags`, not
> `git push origin vX.Y.Z`. **Not even when it looks like the obvious next step**, and not
> when the user says "versiona y listo".
>
> The reason is concrete: pushing the tag is what publishes four images to Docker Hub
> (`release.yml` triggers on `push: tags: ['v*.*.*']`). That is the user's action, not the
> agent's.
>
> Finish by telling them the exact command, as information, without running it:
>
> ```sh
> git push origin <branch> && git push origin vX.Y.Z
> ```

### Step 9 — Report

- Which version was tagged, on which branch, and on which commit.
- What was left out of the release and why (typically: work on `dev` belonging to an open REQ).
- If `origin/<branch>` is behind, say so.
- The push command, without running it.
- That `release.yml` re-verifies the tag against the tree and runs the full suite before
  publishing, so a mislabelled tag never reaches the registry.

---

### Hard rules

1. **Never `git push`** anything, at any step, for any reason.
2. **Never set the version without** explicit confirmation from the user.
3. **Never put a change in the entry that is not in the tree being tagged.**
4. **Never version on top of a half-implemented REQ** without flagging it first.
5. **Never touch `.claude/VERSION` or `.claude/CHANGELOG.md`.**
6. **Never rewrite entries of already-published versions.**
7. If the tag already exists and needs correcting: `git tag -d vX.Y.Z` and create it again.
   That is only safe **because it is never pushed**.
