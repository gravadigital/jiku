# Reusable Code Index — `packages/models`

> Partial catalog. It was seeded by story S-015 with the reusable elements that story created;
> it is **not** a full scan of the package. Run `/service-update-reusable-code packages/models`
> to complete it.

**Last updated:** 2026-08-24 (S-015)

The package exports the Sequelize model classes shared by `api` (which reads) and `core` (which
writes), plus the column enums that type their attributes. It **does not open a connection**: each
service registers the classes in its own `Sequelize` with its own credentials (ADR-005). Consumers
import it **compiled** (`main` points at `dist/`), so a change here does not reach them without
`npm run build:packages`.

Every reusable element is re-exported from the barrel `packages/models/src/index.ts`. Import from
`@jiku/models`, never from a deep path.

## Types

Total: 1

- **IdentityType** (`packages/models/src/user.model.ts`) - Enum of the two kinds of identity a `User` row can hold: `Person = 'person'` and `Service = 'service'`. Types the `identityType` attribute, whose column is declared `DataType.STRING` on purpose.
