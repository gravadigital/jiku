# Utils — `packages/nats-protocol`

## querySubject

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** Builds the subject of an outgoing query. Same grammar as a command and a different
`{svc}` token — see the note in `constants.md` for why that is not cosmetic. It exists so no caller
of the read path ever concatenates a subject by hand, which ADR-002 forbids.

The parameter order is the same as `commandSubject(command, userId)` on purpose: both take two
strings, so inverting it would be a bug the compiler cannot catch.

**Signature:**
```ts
function querySubject(query: string, userId: string): string;
```

**Usage:**
```ts
querySubject('tasks.list', '323332022539911171');
// -> 'dev.323332022539911171.jiku-queries.v1.tasks.list'
```

**Note:** It does **not** validate its input and never throws. The package is a string builder and a
catalog of constants; a malformed method produces a malformed subject, and whoever detects it is
`core`'s registry.

## groupSubject

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** Prefix of a micro service group: `{instance}.*.{svc}.{version}`. The `*` in the user
id slot covers any caller, and several replicas share the messages between them.

It returns the prefix **without** the trailing `.>` on purpose: the micro framework takes the group
and builds each endpoint's subject on its own. Appending a `.>` here would produce a wildcard
subscription that swallows every method at once — which is precisely what per-endpoint registration
replaces.

**Signature:**
```ts
function groupSubject(service: string): string;
```

**Usage:**
```ts
groupSubject(COMMAND_SERVICE); // 'dev.*.jiku-commands.v1'
groupSubject(QUERY_SERVICE);   // 'dev.*.jiku-queries.v1'
```

**Note:** The service arrives **by parameter** and is not read from a constant. That is what lets one
process register **two** groups, one per service, with the same function.

## endpointName

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** Micro endpoint name that serves a command pattern. It **drops** the `{param}`
segments and joins the rest with `-`.

Two rules, each with a reason:
- **No dots**, because micro validates the name against `/^[-\w]+$/` (NATS ADR-32: only `A-Z a-z 0-9
  - _`). The subject, with its dots and `*`, travels separately in `opts.subject`.
- **The `{param}` is removed, not replaced.** The dispatcher already extracts the params from the
  full subject with the segment-by-segment registry, so it does not need them from the name.

**Signature:**
```ts
function endpointName(pattern: string): string;
```

**Usage:**
```ts
endpointName('clients.new');                                      // 'clients-new'
endpointName('tasks.{id}.edit');                                  // 'tasks-edit'
endpointName('requirements.{id}.subscriptors.{userId}.delete');   // 'requirements-subscriptors-delete'
```

**Note:** The one plausible bug of this derivation is leaving the param in the name.
`requirements-id-subscriptors-userId-delete` is a **valid** micro name, so it fails nowhere — it just
reads wrong in `nats micro info`, and nobody looks until much later. Replacing the param with an
empty string instead of filtering it out (`requirements--subscriptors--delete`) is the same family of
error, and also a valid name. Both are covered by tests.

## endpointSubject

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** Micro endpoint subject that serves a command pattern. It replaces **every**
`{param}` segment with `*` and joins with `.`. A subject token cannot carry braces; `*` matches any
one token, which is exactly the role of a param.

It is pure: it reads no environment variable and prefixes neither instance, service nor version.

**Signature:**
```ts
function endpointSubject(pattern: string): string;
```

**Usage:**
```ts
endpointSubject('clients.new');                                    // 'clients.new'
endpointSubject('tasks.{id}.edit');                                // 'tasks.*.edit'
endpointSubject('requirements.{id}.subscriptors.{userId}.delete'); // 'requirements.*.subscriptors.*.delete'
```

**Note:** Applied to the 20 patterns of `core`'s `registry.patterns()`, `endpointName` and
`endpointSubject` produce 20 distinct names and 20 distinct subjects. That table is published as a
contract in `docs/apis/core.yaml`; the tests copy it rather than recompute it.

## methodFromSubject

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** Extracts the method from a full subject: `subject.split('.').slice(4).join('.')`.
Rename of `commandFromSubject`, with a byte-identical body.

The rename has a reason: with two possible values of the `{svc}` token, the fifth segment is no
longer always "a command" — it is a **method**, which may be a command or a query.

**Signature:**
```ts
function methodFromSubject(subject: string): string;
```

**Usage:**
```ts
methodFromSubject('dev.323332022539911171.jiku-commands.v1.clients.new'); // 'clients.new'
methodFromSubject('dev.u1.jiku-queries.v1.tasks.list');                   // 'tasks.list'
```

**Note:** The `slice(4)` is correct for both services because `jiku-commands` and `jiku-queries` are
spelled with a **hyphen, not a dot**: they are a single subject token. That is the property that keeps
`core`'s dispatcher working without being touched. `commandFromSubject` is kept as
`export const commandFromSubject = methodFromSubject` — the **same** symbol, not a wrapper, so two
implementations cannot diverge.
