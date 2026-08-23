# Test Helpers — `core`

> `S3Double` is listed in [index.md](index.md) but has no detail entry yet — the catalog is
> partial, as the index states. This file was opened by S-012 with the doubles of the bus layer.

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
