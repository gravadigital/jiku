# Types — `packages/nats-protocol`

> Partial catalog. It carries only the type story S-016 created; it is **not** a full scan of the
> package. `Reply`, `ReplyStatus` and `ErrorCodeValue` are exported and still undocumented here —
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
  email: string;
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
