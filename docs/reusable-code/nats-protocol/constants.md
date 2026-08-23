# Constants & Config — `packages/nats-protocol`

## COMMAND_SERVICE / QUERY_SERVICE

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** The two possible values of the `{svc}` token of the bus grammar. `COMMAND_SERVICE`
names the service that serves the 20 write commands; `QUERY_SERVICE` names the read service. The
grammar itself did not change in S-011 — the set of values of that one token went from one to two.

Both follow the package's environment-constant pattern: read from `process.env` **at import time**,
with `||` and not `??`. The operator matters. `process.env.X` for a variable defined as an empty
string returns `''`, which is falsy but not nullish; with `??` a `NATS_COMMAND_SERVICE=` line in a
`.env` would produce the subject `dev.u1..v1.clients.new` — an empty subject token, which NATS
rejects and which is very hard to diagnose.

Because they are read at import time, **a test cannot change them after the import**. Anything that
asserts on them has to go through the `reload()` test helper.

**Signature:**
```ts
const COMMAND_SERVICE: string; // NATS_COMMAND_SERVICE || 'jiku-commands'
const QUERY_SERVICE: string;   // NATS_QUERY_SERVICE   || 'jiku-queries'
```

**Usage:**
```ts
import { COMMAND_SERVICE, QUERY_SERVICE, groupSubject } from '@jiku/nats-protocol';

const commandsGroup = groupSubject(COMMAND_SERVICE); // dev.*.jiku-commands.v1
const queriesGroup = groupSubject(QUERY_SERVICE);    // dev.*.jiku-queries.v1
```

**Note:** Why the separation lives in `{svc}` and not nested under the commands service: the
commands subscription ends in `>`, and that `>` would also swallow the queries if they shared the
token. Two queue groups over overlapping subjects deliver the message to **both** subscriptions and
**two** replies reach the same inbox; a plain `request()` returns the first and **discards the second
silently**. Sharing the process does not avoid it — the overlap is in the subject. With a distinct
`{svc}` it cannot happen, because subject tokens are compared whole.

**Deprecated:** `SERVICE_NAME` is an alias of `COMMAND_SERVICE` and **no longer reads
`NATS_SERVICE_NAME`**. It exists only so `core/src/bus/consumer.ts` gets renamed without being
touched: its line 70 takes the subscription subject **and** the queue group from the same symbol, so
aliasing it moves both at once. It disappears in S-012.
