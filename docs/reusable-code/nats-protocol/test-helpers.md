# Test Helpers — `packages/nats-protocol`

## reload

**Location:** `packages/nats-protocol/tests/helpers/reload.ts`

**Description:** Re-imports the package with a controlled environment and returns the freshly loaded
module.

`INSTANCE`, `PROTOCOL_VERSION`, `COMMAND_SERVICE`, `QUERY_SERVICE` and `SERVICE_NAME` are evaluated
**once, when the module is imported**, so a test that sets `process.env.NATS_COMMAND_SERVICE` after
the `import` changes nothing. And a test that asserts the default (`'jiku-commands'`) would fail on
the machine of anyone who has that variable exported in their shell. `reload()` solves both: it
resets **all five** variables — not only the ones the test overrides — applies the overrides, clears
the module's `require.cache` entry, re-requires it, and then restores the environment and clears the
cache again.

**Signature:**
```ts
function reload(env?: Partial<Record<
  'NATS_INSTANCE' | 'NATS_PROTOCOL_VERSION' | 'NATS_COMMAND_SERVICE'
  | 'NATS_QUERY_SERVICE' | 'NATS_SERVICE_NAME',
  string
>>): typeof import('../../src/index');
```

**Usage:**
```ts
import { reload } from './helpers/reload';

reload({}).COMMAND_SERVICE;                                  // 'jiku-commands' (clean environment)
reload({ NATS_COMMAND_SERVICE: 'otro' }).COMMAND_SERVICE;    // 'otro'
reload({}).commandSubject('clients.new', 'u1');              // 'dev.u1.jiku-commands.v1.clients.new'
```

**Note:** Two rules that come with it:
- Tests import from `../../src/index`, **not** from `@jiku/nats-protocol`. The package name resolves
  to `dist/`, so a green test could be verifying the previous build. Against `src/` the cycle is
  immediate and `reload()` can clear the cache of a known path.
- Anything that involves `INSTANCE`, `PROTOCOL_VERSION`, `COMMAND_SERVICE`, `QUERY_SERVICE` or
  `SERVICE_NAME` **must** go through `reload()`. The pure functions that do not depend on the
  environment (`endpointName`, `endpointSubject`, `methodFromSubject`, `callerFromSubject`,
  `hashUserId`, `inboxPrefix`, `success`, `failure`) can be imported normally.
- Restoring the environment on the way out is not cosmetic: without it a `reload` leaks state into
  the next test and failures start depending on execution order, the worst failure mode a suite can
  have.
