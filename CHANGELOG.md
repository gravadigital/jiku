# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

The whole monorepo shares a single version: `api`, `core`, `web`, `opus-web` and the
packages under `packages/` are released together and always carry the same number. The
per-service variables in `deploy/` (`API_VERSION`, `CORE_VERSION`, …) exist so a single
service can be redeployed without touching the others, not to version them separately.

What each bump means:

| Bump      | When                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **major** | A breaking change to the HTTP API or to the NATS protocol. The protocol also carries a `version` segment in its subjects (`v1`), which is the mechanism that lets old and new consumers coexist during a migration. |
| **minor** | New functionality, backwards compatible.                                                                                                                                                                            |
| **patch** | Bug fixes and internal changes with no effect on either contract.                                                                                                                                                   |

The database schema is not versioned separately: migrations under
`api/db-upgrade/migrations/` run on startup and are expected to be additive.

### Cutting a release

The version lives in eight `package.json` files, the lockfile and four `*_VERSION`
defaults in `deploy/.env.dist`. One script writes all of them:

```sh
scripts/set-version.sh 1.2.3      # bump everything
scripts/set-version.sh --check    # verify they agree (CI runs this)
```

Then move the `[Unreleased]` entries under the new heading, commit on `dev`, merge to
`main`, and tag:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

Pushing the tag is what publishes. `release.yml` re-checks that the tag matches the
tree, runs build, lint and the full suite, and then pushes four images to Docker Hub —
`gravadigital/jiku-{api,core,web,opus-web}`, each tagged `1.2.3`, `1.2` and `latest`.

A tag that disagrees with `package.json` fails before anything is built, so a
mislabelled image never reaches the registry.

### The `dev` tag

Separately from releases, every push to `dev` republishes the same four images tagged
`dev`, overwriting the previous ones. It is a moving pointer to the tip of the branch,
useful for a staging environment; it is not a release and carries no stability promise.

Each build also publishes an immutable `dev-<commit-sha>` tag, so a specific dev image
stays reachable after the `dev` tag has moved on.

To run against it, set the per-service versions to `dev` in `deploy/.env`:

```
API_VERSION=dev
CORE_VERSION=dev
WEB_VERSION=dev
OPUS_WEB_VERSION=dev
```

---

## [Unreleased]

## [1.0.0] - 2026-08-12

First public release.

### Added

- Apache-2.0 license, `NOTICE`, contribution guide, security policy and code of conduct.
- Continuous integration running build, lint and the test suites of the four projects.
- Root `build` script and a `postinstall` hook that compiles the shared packages, so a
  fresh clone works with a single `npm install`.
- Shared ESLint configuration for the TypeScript projects.

### Changed

- `web` and `opus-web` are now npm workspaces: one `npm install` from the root covers the
  whole monorepo. Their Dockerfiles build from the repository root as a consequence.
- Container images are published on Docker Hub instead of a private registry.
- The auth-callout is consumed from `gravadigital/nats-zitadel-auth-callout`. That image
  ships only the callout: the NATS server runs as a separate service.
- Every package now declares version `1.0.0`. They were inconsistent (`0.1.0`, `1.3.1`)
  and there were `version.txt` files disagreeing with them.

### Fixed

- **Authentication could be silently disabled.** When `IDENTITY_URL` was empty the API
  skipped token validation entirely and treated every request as an admin, and the
  documented setup path shipped that variable empty. Bypassing authentication is now an
  explicit opt-in (`AUTH_BYPASS=true`, refused when `NODE_ENV=production`), and the
  process refuses to start when the configuration would leave the API open.
- **`GET /api/mattermost/projectobjectives` required no authentication.** Anyone who
  guessed a group name could read a project's objectives. The route was removed: no
  frontend consumed it and the integration that did was decommissioned.
- The access token is no longer accepted through the `?jwt=` query parameter, where it
  could end up recorded in access logs.
- A failed startup now exits with a non-zero status.
- `KEEP_DB=true` had no effect on the API test suite: the container was always removed.

### Removed

- **Mattermost and email notifications, and the hour-reminder cron jobs.** These were
  integrations with one organisation's infrastructure rather than product features: the
  Mattermost bot had already been decommissioned, and the reminders encoded specific
  business rules (a fixed daily hour target, fixed schedules, a named channel). The
  `nodemailer` and `node-schedule` dependencies and around fourteen environment variables
  went with them.
- **`POST /api/objectives/convert-to-requirement`**, together with its button and hook in
  the internal frontend.
- Internal tooling, sprint planning documents and generated catalogues that were tracked
  in the repository (516 files).
- Personal data belonging to a third party that had been pasted into design prototypes.

### Notes for existing installations

- The tables `objective_mail_threads`, `requirement_mail_threads` and
  `inbound_mail_threads` are no longer used, but **no migration drops them**: removing a
  model does not remove its table, and a destructive migration would lose data.
- `STORAGE_S3_BUCKETNAME` and `STORAGE_S3_REGION` are now **required**. They used to fall
  back to one organisation's bucket and region, which meant a misconfigured install failed
  only when the first file was uploaded.
- `STORAGE_S3_KEY_PREFIX` is new and **defaults to the previous hardcoded value**. Object
  keys are stored in `attachments.storage_key`, so changing it on an installation with
  data would make existing attachments unreachable.
