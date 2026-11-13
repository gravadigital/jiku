# models

`@jiku/models`: the shared Sequelize models (tables, columns, associations and enums) that `api`
and `core` register on their own connections. It opens no connection: it exports the model classes
and `allModels`. Consumed compiled (`dist/`), so it is built before api and core. Its place in the
product is in `_gflow/prd/architecture/services.md`; the schema it maps is in `_gflow/db-schemas/`.

## Stack

| Concern | Choice | Version | Why |
|---|---|---|---|
| Language | TypeScript (`strict`, commonjs, `experimentalDecorators` + `emitDecoratorMetadata`) | ^5.9.3 (root) | Shared with the rest of the monorepo |
| ORM | sequelize + sequelize-typescript, as **peer dependencies** | ^6.37.7 / ^2.1.6 | api and core own the Sequelize instance |
| Tests | None in this package: the models are exercised by the api and core suites | — | — |
| Lint | ESLint 9 + typescript-eslint (root `eslint.config.base.js`) | ^9.39.2 | — |

Chosen before the package adopted grava-workflow. Before adding or upgrading a dependency, check the
official documentation for the stable version and its recommended practices.

## Commands

Today these are the workspace's npm scripts (run from the root with `-w @jiku/models`). The
alignment requirement adds the `make` targets (`make lint S=models`, `make typecheck S=models`).

| Command | Runs |
|---|---|
| `npm run build -w @jiku/models` | `tsc` → `dist/` (also the type check; `npm install` runs it through `postinstall`) |
| `npm run lint -w @jiku/models` | `eslint ./src` |
| Tests | n/a: no test script; covered by `npm test -w @jiku/api` and `npm test -w @jiku/core` |
| Migrations | n/a: a model change needs a migration in `api/db-upgrade/migrations/` |

## Structure

- `src/{entity}.model.ts` — one model per table (`requirement.model.ts` → `requirements`, `objectives.model.ts` → `objectives`…), plus join tables (`person-objective.model.ts`, `project-person.model.ts`…).
- `src/*.enum.ts` — shared enums.
- `src/index.ts` — the exports and `allModels`.

## Canonical examples

The best example of each kind of code: copy its shape when writing a new one.

| Kind | File |
|---|---|
| Model with columns, associations and enums | `packages/models/src/requirement.model.ts` |
| Join table | `packages/models/src/person-requirement.model.ts` |
| Registration of a new model | `packages/models/src/index.ts` (`allModels`) |

## Recurring errors

One line per mistake that showed up twice (in verification, in CI or in review).

- (none yet)
