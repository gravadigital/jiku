# Types — `packages/models`

## IdentityType

**Location:** `packages/models/src/user.model.ts` (exported from the barrel as
`import { IdentityType } from '@jiku/models'`)

**Description:** The two kinds of identity a `users` row can hold. `person` is a human from the
identity provider; `service` is a machine identity that authenticates against the bus. It types
the `identityType` attribute of `User` and is the value the event consumer writes and the
authorization gate reads.

**The values are in English on purpose**, against the schema convention of Spanish enum values:
they are not chosen by the product and they do not travel to the front end. They are the `type`
field of `deploy/nats/auth-callout/rules.yaml`, a contract with an external component. Translating
them would force a `person -> persona` map in the consumer — one more place to diverge from the
identity provider with no symptom.

**The column is `DataType.STRING`, NOT `DataType.ENUM`**, while the database has a native
`identity_type` enum. The divergence is deliberate and follows the documented precedent of
`byteStatus` / `retentionStatus` in `file.model.ts`: declaring it `ENUM` in the model would make
`sequelize.sync()` create a type named with Sequelize's own convention
(`enum_users_identity_type`), different from the `identity_type` the migration creates — and
because the test suites run against the schema `sync()` builds (ADR-013), **no test would catch
it**. `api/tests/00-configurations/user-model.test.ts` (TS-11) asserts that no `%identity%` type
exists, which is what breaks if someone "fixes" the model to `ENUM`.

**Interface:**
```ts
export enum IdentityType {
  Person = 'person',
  Service = 'service',
}
```

**Usage:**
```ts
import { IdentityType, User } from '@jiku/models';

// Writing: the event consumer mirrors the identity that authenticated against the bus.
await User.upsert({ id: payload.id, identityType: IdentityType.Service, roles: payload.roles });

// Reading: keep service identities out of a person picker.
UserProjectPermission.findAll({
  where: { projectId },
  include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'],
              where: { identityType: IdentityType.Person } }],
});
```

**Where it lives, and why not in a file of its own.** Inside `user.model.ts`, which is the default
pattern of the package (`ByteStatus` in `file.model.ts`, `AttachmentEntityType` in
`attachment.model.ts`). The one enum that does live in its own file, `RetentionStatus`, is an
exception with a cause: `Attachment` and `File` import each other, and reading a value from the
other module **at decoration time** fails. `IdentityType` is read from the same file that declares
it (`defaultValue: IdentityType.Person`), so there is no cross-module read and no cycle to break.
