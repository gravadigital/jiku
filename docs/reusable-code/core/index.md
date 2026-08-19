# Reusable Code Index — `core`

> Partial catalog. It was seeded by story S-002 with the reusable elements that story created;
> it is **not** a full scan of the service. Run `/service-update-reusable-code core` to complete it.

**Last updated:** 2026-08-19 (S-002)

## Utils

Total: 4

- **resolveActor** (`core/src/commands/files/resolve-actor.ts`) - Resolves who the actor of a command is depending on whether the api or an external publisher published it.
- **readFileSettings** (`core/src/commands/files/settings.ts`) - Reads the five file-policy keys from `system_settings` with code-level defaults, inside the command's transaction.
- **buildStorageKey** (`core/src/commands/files/storage.ts`) - Builds the storage object key `{prefix}/f/{uuid}{ext}`; the uploader never chooses where the file is stored.
- **contentDisposition** (`core/src/commands/files/storage.ts`) - Builds an escaped `Content-Disposition` header value safe to carry a user-supplied file name.

## Services

Total: 1

- **StorageSigner** (`core/src/commands/files/storage.ts`) - Lazily built S3 signer exposing exactly two local (no-network) operations: sign a PutObject and sign a GetObject.

## Constants

Total: 1

- **Config accessors** (`core/src/config.ts`) - `loadConfig()` / `getTrustedPublisherId()`: startup validation and access to `CORE_TRUSTED_PUBLISHER_ID`.

## Test Helpers

Total: 1

- **S3Double** (`core/tests/helpers/s3-double.ts`) - Test double for the S3 signer: records the signing calls and never touches the network.
