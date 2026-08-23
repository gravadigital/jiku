# Reusable Code Index — `core`

> Partial catalog. It was seeded by story S-002 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code core` to complete it.

**Last updated:** 2026-08-23 (S-012)

## Utils

Total: 6

- **resolveActor** (`core/src/commands/resolve-actor.ts`) - Resolves who the actor of a command is depending on whether the api or an external publisher published it. Shared by seven commands; moved up from `commands/files/` in S-003.
- **linkFiles** (`core/src/commands/link-files.ts`) - Links `fileIds` to an already existing entity: resolves the actor, validates existence, liveness and ownership, marks the bytes uploaded and inserts one `attachments` row per file. Additive mode, for creation commands.
- **syncFileLinks** (`core/src/commands/link-files.ts`) - Same validation as `linkFiles` but with complete-set semantics for edit commands: preserves the rows of the links that stay and hard-deletes the ones no longer declared.
- **readFileSettings** (`core/src/commands/files/settings.ts`) - Reads the five file-policy keys from `system_settings` with code-level defaults, inside the command's transaction.
- **buildStorageKey** (`core/src/commands/files/storage.ts`) - Builds the storage object key `{prefix}/f/{uuid}{ext}`; the uploader never chooses where the file is stored.
- **contentDisposition** (`core/src/commands/files/storage.ts`) - Builds an escaped `Content-Disposition` header value safe to carry a user-supplied file name.

## Services

Total: 3

- **StorageSigner** (`core/src/commands/files/storage.ts`) - Lazily built S3 signer exposing exactly two local (no-network) operations: sign a PutObject and sign a GetObject.
- **BusHost** (`core/src/bus/host.ts`) - Opens ONE NATS connection and registers N micro services on it, in series, with an ordered shutdown. Takes the specs as varargs, so mounting a second service is adding one element.
- **registerService** (`core/src/bus/service.ts`) - Registers a micro service from a `ServiceSpec` on an existing connection: one endpoint per command pattern, own queue group, and a duplicate-subject check that fails startup.

## Types

Total: 1

- **ServiceSpec** (`core/src/bus/service.ts`) - What a micro service needs to be registered: bus name, description, the command patterns, and a `handle` that never throws.

## Constants

Total: 1

- **Config accessors** (`core/src/config.ts`) - `loadConfig()` / `getTrustedPublisherId()`: startup validation and access to `CORE_TRUSTED_PUBLISHER_ID`.

## Test Helpers

Total: 3

- **S3Double** (`core/tests/helpers/s3-double.ts`) - Test double for the S3 signer: records the signing calls and never touches the network.
- **fakeMsg** (`core/tests/helpers/micro-double.ts`) - Test double for a micro `ServiceMsg`: records `respond()` and `respondError()` without transforming the arguments, and `json()` throws on a malformed body just like the real one.
- **fakeConnection** (`core/tests/helpers/micro-double.ts`) - Test double for a `NatsConnection` with `services.add()`: records the service configs, groups and endpoints created, and shares one ordering trace with the service so shutdown order can be asserted.
