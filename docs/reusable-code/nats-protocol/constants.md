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

## ErrorCode

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** The catalog of protocol error codes, as a frozen object (`as const`). Every
`failure()` **must** be built from a member of this object and never from a bare string literal:
`as const` is what makes `ErrorCodeValue` the union of the literals, so a typo in a consumer is a
compile error instead of an `undefined` at runtime.

**The catalog is not closed, and it holds codes with no emitter on purpose.**
`invalid_attachment_id` has had none since S-003, and `file_not_available` none since 2026-08-20.
Declaring a code before anything emits it is correct rather than debt: the package is shared
(ADR-005) and consumed compiled, so the declaration necessarily lands before its emitter — a code
used but not declared would force a hand-written literal instead. Removing them is a separate
requirement.

**Adding a code is three changes, not one** — the rule comes from
`docs/architectures/core/conventions/error-handling.md`:

1. this file (the constant),
2. the `errorCode` `enum` of `docs/apis/core.yaml`,
3. the `STATUS_BY_ERROR_CODE` map of `api/lib/utils/bus/protocol.ts`, with its HTTP status.

Without the third one the code falls through the `|| 500` of `httpStatusFor()` and the user sees a
generic 500 instead of the intended status.

**The rule still stands, and REQ-006 is a declared exception to its third step — not an oversight.**
The five codes of the query plane (below) make **two** of the three changes on purpose: the package
and the contract, never the HTTP map. The reason is that when REQ-006 closes, `bus.query()` still
has **no caller**, so none of those five can reach an HTTP response; a map today would be dead code
that has to be maintained. The third change belongs to the requirement that migrates the `GET`
routes. For any code that **does** have an HTTP consumer, all three steps apply as written.

**The source of truth for the value is `docs/apis/core.yaml`, not this file.** The first lines of
`src/index.ts` say so explicitly: on any discrepancy, the document wins. A new code is not chosen
from the package — it is copied from the contract.

REQ-005 added **`caller_not_authorized`** (403), and it is the first code emitted by **the
dispatcher** rather than by a command: both dispatchers authorise the caller of the subject before
resolving the method and before opening the transaction. That is why it does not appear in the
`x-error-codes` of any of the 20 messages — that list enumerates what an `execute()` returns.

**REQ-006 added five codes, and none of them is emitted by a command** — the catalog went from 27 to
**32** members. They belong to the query plane (`jiku-queries`), and they sit immediately after
`CALLER_NOT_AUTHORIZED` because they share with it the property that separates them from the other
26. Their emitters land in later stories; at the end of REQ-006 the five are declared and **nobody
emits them**, which is the correct state for a shared package consumed compiled.

| Code | Emitter (story) | HTTP once a consumer exists |
|---|---|---|
| `unknown_caller` | query dispatcher (S-023) | 403 |
| `query_timeout` | query engine, PostgreSQL `statement_timeout` (S-022) | 504 |
| `invalid_cursor` | query engine, keyset cursor (S-022) | 400 |
| `comment_not_found` | `comments.get` (S-025) | 404 |
| `task_not_found` | `tasks.get` (S-022) | 404 |

**The HTTP column is documentation, not code** — see the exception to the three-changes rule above.

Two distinctions the catalog encodes deliberately, and that must not be "cleaned up":

- **`unknown_caller` is not `caller_not_authorized`.** Two gates, one behind the other:
  `authorizeCaller()` answers *"may this caller run this method?"*; resolving the caller **class**
  answers *"what do I trim for them?"*. Merging them would map one code to two causes and would
  erase the rule that a caller with no row gets an **error**, never an empty list.
- **`task_not_found` coexists with `objective_not_found`.** The bus resource is called `tasks`
  (ADR-004: the product vocabulary lives in the contract, not in the schema), so its not-found code
  is `task_not_found`. `objective_not_found` stays exactly where it is, emitted by the commands.

**Signature:**
```ts
const ErrorCode: {
  readonly INVALID_FIELDS: 'invalid_fields';
  readonly CALLER_NOT_AUTHORIZED: 'caller_not_authorized';
  readonly UNKNOWN_CALLER: 'unknown_caller';
  // ...32 members in total
};
type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
```

**Usage:**
```ts
import { ErrorCode, failure } from '@jiku/nats-protocol';

return failure(ErrorCode.CALLER_NOT_AUTHORIZED, 'No autorizado');
```

**Known debt this catalog does not settle:** `failure()` takes `string`, not `ErrorCodeValue`, so
the compiler does not catch a hand-written code. That is why three codes are still emitted as
literals today (`resolution_required`, `worked_time_not_found`, `unworked_time_not_found`).
Narrowing the signature would break those three, so it is a separate requirement — the rule
meanwhile is enforced by convention, not by the type system.
