# Contributing to Jiku

Thanks for taking the time. This document covers how to get the project running, what the
codebase expects from a change, and the couple of rules that are not obvious from reading
the code.

## Getting set up

You need **Node.js 24** (see [`.nvmrc`](.nvmrc)) and **Docker**. Docker is not optional
for development: the `api` and `core` test suites start an ephemeral PostgreSQL container.

```sh
git clone https://github.com/gravadigital/jiku.git
cd jiku
npm install
```

`npm install` compiles the shared packages under `packages/` as a post-install step. `api`
and `core` import them from `dist/`, so skipping that step makes them fail with errors
that do not point at the real cause.

From the repository root:

```sh
npm run build   # compiles the shared packages, then api and core
npm test        # runs the test suites of all four projects
npm run lint
```

Each project can also be worked on individually with `npm run <script> --workspace <name>`,
where the names are `@jiku/api`, `@jiku/core`, `web` and `opus-web`.

To run the whole stack, see [deploy/README.md](deploy/README.md). Note that a first start
requires NATS credentials and Zitadel service users that are not in the repository.

## How the pieces fit

Read [documentation/README.md](documentation/README.md) first. The short version:

- **`api`** serves HTTP. It reads the database directly and **cannot write to it** — it
  connects with a read-only database role. Mutations are published as commands on NATS.
- **`core`** consumes those commands and is the only service that writes.
- **`web`** and **`opus-web`** are the two frontends.
- **`packages/`** holds what `api` and `core` share: the Sequelize models, the bus
  contract and the Zitadel service-user authentication.

The split is enforced by database permissions rather than by convention. If you find
yourself wanting to write to the database from `api`, that is the design telling you the
change belongs in `core`.

## The protocol is the contract

The subjects, request and reply formats and the list of commands live in
[docs/apis/core.yaml](docs/apis/core.yaml). When the code and
that document disagree, the document wins — fix the code, or change the document
deliberately as part of your PR.

Changing the protocol in a backwards-incompatible way is a major version bump. The subject
carries a `version` segment precisely so old and new consumers can coexist during a
migration.

### Adding a command to core

1. Create the file under `core/src/commands/<entity>/`, implementing the `Command`
   interface.
2. Register it in `core/src/commands/index.ts`.
3. Write its tests in `core/tests/commands/`.

The `pattern` has to match the subject in the protocol document. Variable segments go in
braces: `clients.{id}.edit`.

Core's tests run against a **real database**, without mocking Sequelize. That is
deliberate: it is what verifies that a command stores exactly what the API used to store.

## Tests

Every change that touches behaviour needs tests. The suites differ by project:

| Project    | Runner | Needs Docker |
| ---------- | ------ | ------------ |
| `api`      | mocha  | yes          |
| `core`     | mocha  | yes          |
| `web`      | vitest | no           |
| `opus-web` | jest   | no           |

Two environment variables help while iterating on `api` and `core`:

- `KEEP_DB=true` leaves the PostgreSQL container running so the next run starts faster.
- `CI=true` skips starting a container and uses an externally provided database.

## Style

`npm run lint` has to pass. Beyond that:

- The shared ESLint configuration in `eslint.config.base.js` covers the TypeScript
  projects; the frontends extend the Next.js rules instead.
- **Comments and documentation are written in English.** User-facing text in the two
  frontends is in Spanish, and so are the API's error messages — the frontends display
  them directly. There is an open item to fix that properly with an error code catalogue
  and i18n.
- Comments should explain _why_, not restate _what_ the code does. The existing code
  leans on this heavily; follow it.

## Pull requests

- Branch off the default branch and keep the change focused on one thing.
- Explain in the description what problem the change solves. If it fixes a bug, say how it
  reproduced.
- Update `CHANGELOG.md` under `[Unreleased]` for anything a user would notice.
- Make sure `npm run build`, `npm test` and `npm run lint` pass. CI runs all three.

If you are planning something large, open an issue first so we can talk about the approach
before you write it.

## Security

Do not open public issues for security problems. See [SECURITY.md](SECURITY.md).
