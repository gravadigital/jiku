# Types — `packages/nats-protocol`

> Partial catalog. It carries the types stories S-016 and S-029 created; it is **not** a full scan
> of the package. `Reply`, `ReplyStatus` and `ErrorCodeValue` are exported and still undocumented here —
> run `/service-update-reusable-code packages/nats-protocol` to complete it.

## AuthEvent

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** The payload of the authentication event, as the `auth-callout` publishes it. It is
the type `core` uses to type the event **after validating it**, in `src/events/dispatcher.ts` and
`src/events/auth/user-sync.ts`.

**Nine of the fifteen fields the emitter sends.** Three are guards that are never persisted
(`type`, `version`, `instance`) and six are data that is mirrored into `users` (`id`, `name`,
`username`, `email`, `roles`, `identity_type`). The other six — `authenticated_at`, `expires_at`,
`client_ip`, `session`, `matched_role`, `template` — are **not declared**, and neither is anything
new the emitter adds: its schema lives in another repo and can grow, so the consumer validates with
`.unknown(true)` and a new field cannot bring it down.

`client_ip` and `session` are additionally **never persisted**: that is personal-data minimization,
not just scope (RF-12). The type not naming them is the first barrier — a `core` that wanted to store
them would have to widen this type, and that diff shows up in review.

**Signature:**
```ts
interface AuthEvent {
  type: string;           // guard: core only processes 'authenticated'. Not persisted.
  version: number;        // guard: core only processes version 1. Not persisted.
  instance: string;       // guard: must match the consumer's INSTANCE. Not persisted.
  id: string;             // the Zitadel `sub`. It IS the PK of `users`.
  name: string;
  username: string;
  email: string | null;   // `null` IS a value: a service identity has no address.
  roles: string[];        // as they arrive, unfiltered and unvalidated.
  identity_type: string;  // from the `type` of the matched rule, not a heuristic.
}
```

**Usage:**
```ts
// core/src/events/dispatcher.ts — after the Joi schema validated the raw payload.
const event = result.value as AuthEvent;

// core/src/events/auth/user-sync.ts — the contract-to-database translation, one line.
const fields = {
  name: event.name,
  username: event.username,
  email: event.email,
  roles: event.roles,
  identityType: event.identity_type as IdentityType,
};
```

**Note:** Four decisions that look wrong until you know why.

- **The names are `snake_case`, verbatim from the emitter.** In particular `identity_type`, **not**
  `identityType`. ADR-004 says the bus contract owns the vocabulary, but here the package is the
  contract's **reader**, not its author: the emitter publishes `snake_case`, so the type that
  describes the message spells it that way. The translation to `camelCase` is `core`'s, in the
  handler, which is exactly where ADR-004 wants it. **Three names coexist and none is normalized:**
  `identity_type` (payload), `identityType` (model), `identity_type` (column).
- **`identity_type` is `string`, not the `IdentityType` enum of `@jiku/models`.** This package has
  **zero** runtime dependencies (only `node:crypto`) and that is a property, not an accident:
  importing `@jiku/models` would couple the bus contract to the database schema and create a build
  edge between two packages that are independent today. And an out-of-enum value is an **invalid
  event** that `core` discards, not an impossible type — `core`'s discard test needs to be able to
  build that payload.
- **All nine are required (no `?`).** The type describes the **validated** payload: `core`'s Joi
  schema applies `.default([])` to `roles` and `.default(IdentityType.Person)` to `identity_type`
  before the handler sees it. Declaring them optional would break `core` under `strict`, or worse,
  let `undefined` reach two `NOT NULL` columns.
- **`type` and `version` are widened to `string` and `number`, not the literals `'authenticated'`
  and `1`.** The type describes the **wire** contract, and on the wire `version: 2` is a legitimate
  value that `core` discards. Freezing them as literals would make the type lie about the contract
  and would make the discard branch **untypeable** in tests.

**There is no index signature.** No `[key: string]: unknown`: that would turn any typo into a valid
access and would undo the privacy barrier above.

---

## Actor

**Location:** `packages/nats-protocol/src/index.ts`

**Description:** The identity envelope — **who acts** behind a command. It is a **reserved
top-level key** of every command message, and it is optional: the message is
`{ actor?: Actor, ...domain payload }`.

**Only the trusted publisher (`CORE_TRUSTED_PUBLISHER_ID`, the api) may send it.** Any other caller
that includes it is rejected with `invalid_fields`; for everyone else the identity **is** the second
token of the subject — what `callerFromSubject()` reads — which the auth-callout makes unforgeable.
The two identities are different and both are needed: the subject identifies the **service** that
publishes, the envelope the **person** behind it.

**The dispatcher extracts it from the body before validating**, ahead of `registry.resolve()` and
ahead of `sequelize.transaction()`. That is why each command's Joi schema never sees it and the
`execute()` functions are untouched — **the envelope belongs to the transport, not to the domain**.

It does **not** replace `creator` / `author` / `editor` / `uploader`. Those are domain data (they
end up in `requirements.created_by`, in the Activity's author, in `files.uploaded_by`) and they stay
in the contract. What changes is **who wins**:

```
resolveActor(ctx, payload):
  if there is an envelope                          -> actor.id
  else if ctx.caller == CORE_TRUSTED_PUBLISHER_ID  -> payload.author/creator/editor/uploader
  else                                             -> ctx.caller
```

Envelope and domain field both present **and different** is `invalid_fields` with
`errorDetails: { field, value, expected }` — not a pick of the most likely one. Two different
identities in one message is a publisher bug, and resolving it silently is how one writes in
someone else's name.

**Signature:**
```ts
interface Actor {
  id: string;          // the Zitadel `sub`. It IS the PK of `users`. NOT `personId`.
  roles: string[];     // from the `urn:zitadel:iam:org:project:roles` claim the api verified.
  name?: string;       // optional. Missing logs a warning; on INSERT falls back to email or id.
  username?: string;   // optional. Same fallback as `name`.
  email?: string;      // optional — and NOT `string | null`. See the table below.
}
```

**Usage:**
```ts
// api — building the envelope from the ALREADY VERIFIED claim, never from a read of `users`.
const actor: Actor = {
  id: req.user.sub,
  roles: req.decodedTokenRoles,
  name: req.user.name,
  username: req.user.preferred_username,
  email: req.user.email,
};
await bus.request(commandSubject('worked-times.new'), { actor, ...payload });

// core/src/bus/dispatcher.ts — extracted BEFORE resolving the command and BEFORE the transaction.
const { actor, ...payload } = message as { actor?: Actor } & Record<string, unknown>;
```

**`AuthEvent` vs `Actor` — two types for the same person, and the same `users` row.**

Both end up writing the same row through the **same shared handler** (CA-12). Reading them side by
side is the point: the difference is deliberate and parameterized, not an oversight.

| | `AuthEvent` (S-016) | `Actor` (S-029) |
|---|---|---|
| Emitted by | the **auth-callout**, with the `callout-events` credential | the **api**, with the claim it already verified by JWT |
| Arrives through | `{instance}.events.auth`, 3 segments, fire-and-forget | reserved key of the command **body**, request/reply |
| Naming | `snake_case` verbatim from the emitter (`identity_type`) | `camelCase` — it is this product's own contract |
| Fields | **9** (3 guards + 6 data) | **5** |
| Required | **all 9** | `id` and `roles`. The other three optional |
| `email` | **`string \| null`** | **`string \| undefined`** (optional) |
| On a missing `email` | **discards the event**, no partial row | **does not reject**: logs `warn` and continues |
| `identity_type` | **carries it** (`string`, from the matched rule's `type`) | **does not carry it** |

**Note:** Four decisions that look wrong until you know why.

- **`email` is optional here and `string | null` in `AuthEvent`. Do not homogenize them.** In the
  event, `null` is a **normalized** value — `core`'s Joi schema collapses absent, `null` and empty
  string to `null` before the handler sees it — and it means something positive: *"this is a service
  identity"*, because a Zitadel machine user has no address. For a person it is never `null`, and
  its absence **discards** the event rather than create a partial row. In `Actor`, absence is just
  **absence**: the api builds the envelope from the claim, and if the claim has no `email` the key
  simply is not in the JSON. There is no schema to normalize it (the dispatcher **extracts** the
  envelope, it does not run it through Joi) and there is always a person on the other side. The
  command is **not** rejected over it: rejecting a write because of a profile field is
  disproportionate, and a misconfigured `CALLOUT_IDP_ENRICH` would leave the product with no writes
  at all. **This is the single parameterized difference of the shared mirror handler (CA-12)** —
  widening `Actor.email` to accept `null` would invite `core` to write `null` without telling "did
  not come" from "does not have", which is the distinction that whole design rests on.
- **`roles` is an open `string[]`, not a union of the known roles.** An unknown role is a
  **legitimate wire value that authorizes nothing** (ADR-008), not an impossible type. The role
  catalog lives in `core`'s map and in the auth-callout's `rules.yaml`; closing it here would move an
  authorization decision into this package's compiler, which is exactly where nobody would look for
  it. Same reasoning as `AuthEvent.identity_type` being `string`.
- **There is no `identity_type`, and it is not an oversight.** The command mirror writes
  `identity_type = 'person'` as a **literal**, because the api authenticates an end-user JWT and
  never a machine user. `AuthEvent` carries it because that channel transports **both** classes of
  identity. Declaring it here would give the api the ability to state that a person is a service —
  security surface given away for nothing.
- **`id` is the Zitadel `sub`, not `personId`.** `personId` is a `number` from the `persons` table.
  Both concepts coexist in `worked-times`, and confusing them is a silent bug.

**There is no index signature.** No `[key: string]: unknown`, for the same reason `AuthEvent` has
none: it would turn any typo into a valid access.

**Nothing validates it in this package.** There is no `extractActor()`, no `isActor()`, no schema —
the package does not throw and does not log. The extraction, the trusted-publisher guard, the
`INSERT … ON CONFLICT` mirror over `users` and `resolveActor` all live in `core`.
