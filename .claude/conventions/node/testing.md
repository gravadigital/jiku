---
id: testing
display_name: Testing (Vitest + Testcontainers, contenedor compartido)
language: node
description: Unit and integration testing with Vitest; ONE shared Testcontainers instance per suite via globalSetup, sequential execution, seed-state reset per file
applies_to: [api, worker, cli, library]
required_by: []
package: vitest
---

# Testing (Node, Vitest)

Unit and integration tests with [Vitest](https://vitest.dev). Integration tests run
against **real** dependencies via [Testcontainers](https://testcontainers.com) (Postgres,
NATS, MinIO/S3) — no mocking of infrastructure. HTTP routes are exercised with the
framework's in-process injector (Fastify `app.inject()`), not a network client.

The defining rule of this convention: **one shared container per backing service for the
whole suite, started once in `globalSetup`** — NOT one container per test file. Per-file
containers caused a container explosion (dozens of Postgres/NATS at once), host
contention, and order-dependent flakiness. Read the rationale below before changing this.

## When to use

- Every Node service that has logic worth testing (all of them).
- **Unit tests** for pure functions, domain logic, transformers — no I/O, no containers.
- **Integration tests** for repositories/DB, HTTP routes, queue handlers — against real
  containers.
- The shared-container + seed-reset machinery below applies to services with **DB/infra**
  (api, worker). A `cli`/`library` without backing services only needs the unit-test rules.

## Package

```
vitest                          # test runner
@testcontainers/postgresql      # real Postgres in tests (dev only)
testcontainers                  # generic containers: NATS, MinIO/S3 (dev only)
```

## Architecture: one shared container per service, started once

Vitest's default pool (`forks`) runs each test file in its own worker. If each file starts
its own container in `beforeAll`, you get **N containers for N files**, all at once. Instead:

- **`globalSetup`** (runs ONCE, in the main process, before any worker) starts **one**
  Postgres and **one** NATS (and MinIO if needed) for the entire suite, applies migrations,
  seeds the catalog once, and exposes the connection URLs via `provide()`.
- Test files read those URLs with `inject()` and connect to the shared containers — they do
  **not** start their own.
- **Sequential execution** (`fileParallelism: false`): with a shared DB, running files
  sequentially removes cross-file races without the cost of per-worker physical isolation.
  This is the deliberate trade-off — slower wall-clock, far fewer containers, deterministic.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['./test/global-setup.ts'], // 1 PG + 1 NATS for the whole suite
    fileParallelism: false,                  // sequential: shared DB, no cross-file races
  },
});
```

```ts
// test/global-setup.ts  (runs ONCE, main process)
import type { GlobalSetupContext } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
    natsUrl: string;
  }
}

export async function setup({ provide }: GlobalSetupContext): Promise<void> {
  const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
  await applyMigrations(client);          // schema + roles + triggers
  await runSeed(db, log, loadTestSeedDataset()); // SMALL test dataset (see below)
  // ...start NATS, create KV buckets...
  provide('databaseUrl', pg.getConnectionUri());
  provide('natsUrl', natsUrl);
}

export async function teardown(): Promise<void> {
  await natsContainer?.stop();
  await pgContainer?.stop();
}
```

```ts
// test/db/helpers.ts  (per file: connect to the shared container, do NOT start one)
import { inject } from 'vitest';

export async function setupTestDb(): Promise<TestDbContext> {
  const url = inject('databaseUrl');          // shared container URL
  const client = postgres(url, { max: 5 });
  // ...returns { url, db, client, connectAs, cleanup }; cleanup closes connections only
}
```

## Data isolation: seed-state reset (Goldberg-style), not container-per-file

The suite shares ONE database, so a file that leaves junk behind breaks the next. The
discipline that keeps it deterministic:

1. **Catalog tables are read-only and seeded once** (`countries`, `players`,
   `system_flags`). Seeded by `globalSetup` from a **small, curated test dataset**
   (`loadTestSeedDataset()`, ~6 countries / ~40 players) — NOT the production dataset of
   hundreds of rows. Re-seeding the full dataset in every file is the main thing that makes
   the suite slow; keep the test dataset small. The real dataset stays in
   `db/migrations/seed/data/*.json` and is validated only by the `db/seed/*` tests.

2. **Every file calls `resetToSeedState(client, nc?)` in `beforeAll`** to start from a known
   state regardless of what the previous file left. It truncates the transactional tables
   (+ re-seeds `system_flags`, which a CASCADE can wipe) and, if given `nc`, purges the KV
   buckets (rate-limit / brute-force counters). It does NOT restore the catalog — most files
   don't dirty it, so paying that cost everywhere is wasteful.

3. **Whoever inserts into the catalog restores it.** A file that inserts test
   players/countries must call `restoreCatalog(client)` in its `afterAll` (after
   `truncateTransactional`, before `cleanup`). This is uniform: every catalog-mutating file
   restores; no exceptions. Cheap now because the test dataset is small.

4. **Unique data per test** for UNIQUE columns (`teams.code`, `admin_users.email`): use a
   `uniqueCode()` helper so tests within a file don't collide.

**Services without a read-only catalog** (e.g. `image-worker`, where every test builds its
own team via `seedTeam` and nothing reads a pre-seeded catalog): there is NO small catalog
dataset and NO `restoreCatalog`. Instead, `countries`/`players` are just transactional test
data — include them in `truncateTransactional` so each file's `afterAll` leaves the DB empty.
The structural rules still apply (shared container via `globalSetup`, sequential,
`truncateTransactional` in `afterAll`); only the catalog machinery is dropped.

```ts
describe('GET /teams/{code}', () => {
  let ctx: TestDbContext;
  beforeAll(async () => {
    ctx = await setupTestDb();
    await resetToSeedState(ctx.client);          // known state, no inherited junk
    process.env['DATABASE_URL'] = ctx.url;        // BEFORE the dynamic import of the server
    ({ buildServer } = await import('@/http/server.js'));
    app = await buildServer();
  });
  afterAll(async () => {
    await app.close();
    await truncateTransactional(ctx.client);
    await restoreCatalog(ctx.client);             // only if this file inserts catalog rows
    await ctx.cleanup();
  });
});
```

## Unit tests

Pure functions and domain logic — no I/O, no containers:

```ts
import { describe, it, expect } from 'vitest';
import { computeTotalCost } from './cost';

describe('computeTotalCost', () => {
  it('sums the cost of occupied slots', () => {
    expect(computeTotalCost(slots)).toBe(900);
  });
});
```

## HTTP integration tests

Exercise routes with the framework's in-process injector — for Fastify, `app.inject()`
(no network, no Supertest). The server reads its DB from the env/singleton, so set
`DATABASE_URL` to the shared container URL **before** the dynamic `import` of the server.

```ts
const res = await app.inject({ method: 'GET', url: '/teams/ABC1234' });
expect(res.statusCode).toBe(200);
expect(res.headers['set-cookie']).toBeUndefined();
```

## Gotchas (learned the hard way)

- **`system_flags` has a FK → `admin_users`**, so `TRUNCATE admin_users ... CASCADE` wipes
  it. `truncateTransactional` re-seeds it. Don't add `system_flags` to the transactional
  truncate list; don't assume a flag persists across files — set it in your `beforeEach`.
- **The rate-limit KV key is the client IP** (`127.0.0.1` for `app.inject()`), shared by all
  routes/files. A rate-limit test must reset its key (or `resetToSeedState(client, nc)`
  purges the bucket) and clean up after pushing the counter over the limit.
- **Don't assert exact counts on shared/catalog tables** unless your file just restored them
  to a known state. Prefer content assertions (a specific row exists) or `>=`.
- **No wall-clock sleeps to wait for a condition.** Use Testcontainers `Wait.*` strategies
  for readiness and await the observable condition, never `sleep(ms)` + assert.

## Rules

- **One shared container per backing service, started in `globalSetup`.** Never start a
  container in `beforeAll` per file, and never inside an `it` block.
- **Do not mock the database or infrastructure** in integration tests. Real containers only —
  mock divergence from real DB behavior has caused production incidents.
- **Unit tests are for pure functions only.** If it does I/O, write an integration test.
- **`resetToSeedState` in `beforeAll`; `restoreCatalog` in `afterAll` for any file that
  inserts catalog rows.** Clean up KV state you mutate.
- **Catalog (`countries`/`players`) is read-only test data** seeded from the small test
  dataset; never `DELETE`/`TRUNCATE` it in a test except the dedicated `db/seed/*` tests
  (which restore it on exit).
- Tests must not depend on host env vars or external services. Everything is started by the
  test setup.
- Test file names co-located or under `test/`, suffixed `.test.ts`.
- `describe` names the unit under test; `it` names the scenario. Both in plain English.
- Reset mocks between tests with `vi.clearAllMocks()` / `vi.unstubAllGlobals()`.

## Integration with other conventions

- **http-server**: routes exercised via `app.inject()`; the server resolves its DB from
  `DATABASE_URL` (set to the shared container before importing the server).
- **logging**: keep test log output quiet (`LOG_LEVEL=silent` / a silent pino transport);
  don't silence errors globally.
- **orm**: migrations run once in `globalSetup`; repositories tested against the shared
  real DB.
