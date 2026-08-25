# Test Helpers — `core`

> `S3Double` is listed in [index.md](index.md) but has no detail entry yet — the catalog is
> partial, as the index states. This file was opened by S-012 with the doubles of the bus layer.

## dispatch / dispatchQuery

**Location:** `core/tests/helpers/dispatch.ts`

**Description:** Dispatch a command or a query as if it had arrived on the bus, building the full
subject with the protocol package's helpers. Both go in through the **real** dispatcher over the
**real** registry, so every test also covers subject parsing, the authorisation gate, method
resolution and — for commands — the dispatcher's transaction.

**The default caller is the trusted publisher, and it changed in S-017.** It used to be `'api'`,
which does **not** match `CORE_TRUSTED_PUBLISHER_ID`, so that a test could not fall into
`resolveActor`'s trusted branch unnoticed. With the authorisation gate installed that choice stopped
being viable: `'api'` is not the trusted publisher and has no row in `users`, so the ~112 dispatches
that pass no caller would all answer `caller_not_authorized`. The alternatives were passing the
caller explicitly at 112 call sites of a security diff, or inventing a test role authorising all 20
commands — a hole in the map the suite would keep open.

**What to know:** a test that **forgets** its caller now lands on the **exempt** branch, not the
external one. The half that mattered is preserved — tests of the external branch still pass their
caller explicitly, because they assert on it, and their `users` fixtures carry
`roles: ['external-publisher']`.

The value comes from `getTrustedPublisherId()` and not a literal, so `core/.env.test` stays the only
source of it.

**Signature:**
```ts
function dispatch<T>(command: string, payload: unknown, caller?: string): Promise<Reply<T>>;
function dispatchQuery<T>(query: string, payload: unknown, caller?: string): Promise<Reply<T>>;
```

## fakeMsg / fakeConnection

**Location:** `core/tests/helpers/micro-double.ts`

**Description:** Doubles of the `nats` micro framework: `ServiceMsg`, `ServiceGroup`, `Service` and
`NatsConnection`. They record the calls and never touch the network.

**Why this does not contradict the `testing` convention.** The rule is *"do not mock Sequelize or
the database"*, and the reason is that the real database is the only thing that verifies a command
stores what it must. There is no database here: what is under test is **endpoint derivation and the
reply contract**, and the test environment has **no NATS to connect to**. The double does not
replace a possible verification — it enables the only one available. Same reasoning as
`s3-double.ts`.

Four properties the tests depend on:

- **`json()` throws** on a malformed body, exactly like the real `msg.json()` (which delegates to
  `JSON.parse`). A double returning `null` instead would leave the `invalid_fields` path never
  exercised, and the test would pass while proving nothing.
- **`respondError(code, description, data)` records the three arguments untransformed**, so a test
  can decode the body and check it is not `Empty` — which is the important half of the failure
  contract.
- **`replyCount`** is `responses.length + errorResponses.length`. It has to be exactly 1 on every
  path: never zero, never two.
- **One ordering trace shared** between the service and the connection (`trace`). That is what makes
  the shutdown order assertable by reading a single array, with no acrobatics.

**Signatures:**
```ts
function fakeMsg(options?: { subject?: string; data?: Uint8Array }): FakeMsg;
//   .respond(data, opts)       -> pushes to .responses
//   .respondError(c, d, data)  -> pushes to .errorResponses
//   .json<T>()                 -> JSON.parse(decode(data)), THROWS on invalid JSON
//   .replyCount                -> responses.length + errorResponses.length

function fakeConnection(options?: {
  add?: (config: ServiceConfig) => Promise<FakeService>;
}): FakeConnection;
//   .services.add(config)  -> records into .configs, returns the FakeService
//   .configs / .created    -> service configs requested, and services created
//   .trace                 -> ['service.stop', 'connection.drain', 'connection.close']
//   .makeService(config)   -> a service of this connection, for an injected `add`

function decode(data?: Payload): string;
function encode(value: string): Uint8Array;
```

**Usage:**
```ts
// The `add` hook covers the three cases a plain double cannot: reject, and resolve by hand.
const nc = fakeConnection({ add: () => Promise.reject(boom) });

// Deliver through the SAME path a real message takes: the handler registerService registered.
await registerService(nc as unknown as NatsConnection, spec);
const handler = nc.created[0].group.endpoints[0].handler!;
handler(null, msg as unknown as ServiceMsg);
```

**Do not `sinon.stub` the `nats` module.** `connect` is exported through a non-configurable getter
(`node_modules/nats/lib/src/mod.js`:55) and sinon fails with *"Descriptor for property connect is
non-configurable and non-writable"*. That is why `BusHost` has the `openConnection()` seam instead.

**The doubles do not implement `ServiceMsg` or `NatsConnection` in full**, on purpose: it is enough
to type the parameters of the functions under test and cast at the test boundary, which is one of
the two `any`/cast borders the `_base` convention tolerates.

## FakeSubscription

**Location:** `core/tests/helpers/micro-double.ts`

**Description:** Test double for a flat `Sub<Msg>` — the subscription of the event consumer. Like
the rest of the file, it substitutes **a network that is not there**, never the database: without
it, the subscription's log line, the per-message `try/catch` and the shutdown drain could only be
verified by hand against a real bus.

**It is the mirror image of `FakeConnection.status()`: this iterator does not end on its own.** A
subscription has to stay open to receive, so the exit is given by `drain()` or `unsubscribe()` —
and **every test that pushes messages has to drain before finishing**, because the consumer's
`for await` runs with `void` and no `await` from `start()`.

Two design points are what make the assertions writable without arbitrary `setTimeout`s:

- **`push()` returns a promise that resolves once the consumer asked for the next message**, i.e.
  once it finished processing this one. That is what TS-29, TS-30 and TS-33 of S-016 are built on.
- **`drain()` writes `'subscription.drain'` into the connection's shared trace and then waits for
  the iterator to end**, so a message still in flight finishes before `stop()` resolves — exactly
  the guarantee the shutdown order has to have.

The messages it delivers are `FakeMsg`, the double that already existed: its `json()` **throws** on
a malformed body just like the real one, and its `replyCount` is what lets a test assert that
**nobody answered**.

**Interface:**
```ts
class FakeSubscription {
  readonly subject: string;
  readonly opts?: SubscriptionOptions;   // .queue is the queue group
  readonly delivered: FakeMsg[];         // what the iterator already handed over, in order
  readonly closed: Promise<void>;

  push(data: Uint8Array, subject?: string): Promise<void>; // resolves once processed
  drain(): Promise<void>;                                  // traces + ends the iterator
  unsubscribe(): void;
  getSubject(): string;
  isDraining(): boolean;
  isClosed(): boolean;
  [Symbol.asyncIterator](): AsyncIterator<FakeMsg>;
}

// FakeConnection gains:
//   .subscribe(subject, opts) -> records into .subscriptions, traces 'subscribe'
//   .subscriptions            -> the flat subscriptions opened, in order
```

**Usage:**
```ts
const host = new TestHost(nc, spec).withEventConsumer({ subject, handle });
await host.start();

await nc.subscriptions[0].push(encode('{no-json'));   // resolves once the consumer discarded it
nc.subscriptions[0].delivered[0].replyCount.should.equal(0); // nobody answered

await host.stop();   // drains: 'subscription.drain' lands between the services and the connection
```

**It has no methods no test looks at** (`getReceived`, `getMax`, `getPending`). The file's criterion
is minimal: what `BusHost` uses and what the test asserts.

## setQueryBudget / resetQueryBudget

**Location:** `core/tests/helpers/dispatch.ts`

**Description:** Injects the **page byte budget** that `dispatchQuery()` will use. The tests for the
budget cut and for the item that alone does not fit need a small, predictable number; depending on a
real server's `max_payload` would make them fragile *and* would force a bus to be up in order to test
a rule that is not about the bus.

The dispatcher's budget provider is evaluated on **every** dispatch, so changing the variable between
two calls changes the second one without rebuilding anything. Default: `DEFAULT_PAYLOAD_BUDGET_BYTES`.

**Signature:**
```ts
function setQueryBudget(bytes: number): void;
function resetQueryBudget(): void;
```

**Usage:**
```ts
afterEach(() => resetQueryBudget());

it('the budget cuts the page', async () => {
  setQueryBudget(2048);
  const reply = await dispatchQuery('tasks.list', { page: { limit: 100 } });
  reply.data.page.returned.should.be.below(100);
});
```

## Task query fixtures

**Location:** `core/tests/queries/task-fixtures.ts`

**Description:** The fixture world the query-engine tests hang off: user, projects, requirement,
people, tasks with a **controlled `created_at`**, comments, assignments and subscriptions.

`created_at` is set with a SQL `UPDATE` rather than at insert time: Sequelize overwrites the
timestamp columns on save, and the default sort of `tasks` is precisely `-createdAt` — without
control over that column half the ordering tests would prove nothing.

**Writing fixtures goes through the WRITE connection and the `@jiku/models` classes; the reads under
test go through `readDb` with explicit SQL.** That asymmetry is the point: if the engine used the
ORM, there would not be two paths to compare.

**Signature:**
```ts
function createWorld(projects?: number[]): Promise<void>;   // requirement hangs off projects[0]
function createTasks(seeds: TaskSeed[]): Promise<void>;
function createComments(objectiveId: number, count: number): Promise<void>;
function assignPerson(objectiveId: number, personId: number,
                      options: { isLeader: boolean; active: boolean }): Promise<void>;
function subscribe(objectiveId: number, userId?: string): Promise<void>;
function destroyWorld(): Promise<void>;
```
