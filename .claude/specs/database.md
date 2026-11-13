# Database

Conventions for every database schema: the discovery derives the schema with them, and every later
change follows them. Read this before writing or changing a schema or a migration.

## Format

`_gflow/db-schemas/{service}.md`, one per service that owns a database:

- **Base**: owner service, engine, other services that use it.
- **Decisiones del esquema**: the schema decisions below, each with its value or "no aplica".
- **Esquema**: DBML. Enums first, then tables grouped by module (a comment line per module). Every
  table, column and enum value cites its origin in a note: `Note: 'Entidad: Turno — …'` or
  `Note: 'Técnica: … (NOT-E1)'`; a column's note is the domain attribute name
  (`· dato personal` when it holds personal data) or the ID that needs it; an enum value's note is
  the domain value it translates.
- **Restricciones que DBML no expresa**: `| Nombre | Tabla | Tipo | Definición | Garantía |` —
  exclusion constraints, partial unique indexes, checks, permissions, functions. The source of the
  SQL migrations.
- **Atributos derivados**: `| Entidad | Atributo | Se guarda | Por |`.

The migrations implement this document. A change to one is a change to the other, in the same
branch.

## Language of identifiers

Generated documents are written in **Spanish** — that rule is in every skill. This is the
exception, and it is not negotiable: **every identifier of the technical contract is English.**

| Element | Language | Example |
|---|---|---|
| Table, column, index and constraint names | English, `snake_case` | `appointments.starts_at` |
| Enum values (DB and JSON) | English | `confirmed`, `no_show`, `pending_reschedule` |
| API paths, JSON field names, `operationId` | English, `camelCase` for fields | `POST /appointments`, `cancelToken` |
| Field names inside flow documents | English — copied verbatim from the API/DBML | `professionalId` |
| Prose: descriptions, notes, rationale, section bodies | **Spanish** | `Note: 'Turno: reserva de un slot.'` |

The domain analysis names entities in Spanish, because that is the team's ubiquitous language.
**Translate the identifier, keep the Spanish term in the note** — do not carry the Spanish name
into the schema:

```
Table appointments {              // not `turnos`
  starts_at   timestamptz         // not `inicio`
  status      appointment_status  // confirmed | attended | no_show | cancelled | rescheduled
  Note: 'Turno: reserva de un slot para un cliente con un profesional y un servicio.'
}
```

**Why it matters:** the ORM models, the HTTP contract, the queries and the tests all read these
identifiers. A Spanish schema behind an English contract adds a translation layer to every mapper,
query and test, and every requirement built on top pays for it — forever. Choosing one language and
applying it consistently is what makes the contract cheap; mixing them per table is worse than
either choice.

## Schema conventions (the same in every product)

These are never asked: every schema follows them. A product deviates only through a technical
decision (in the discovery or in a requirement). Validated on 2026-10-11 against the PostgreSQL documentation and wiki
("Don't Do This"), the Prisma 7 and sqlc/pgx documentation, OWASP and NIST SP 800-63B, and a Prisma
7.10 + PostgreSQL 18 spike (raw-SQL constraints survive later generated migrations).

| Concern | Convention |
|---|---|
| Table names | English, `snake_case`, plural: `appointments`, `time_blocks` |
| Column names | English, `snake_case`, singular: `starts_at`, `professional_id` |
| Join tables | The domain noun if there is one (`enrollments`); otherwise both entities, plural last: `professional_services` |
| Primary key | `id uuid [pk, default: \`uuidv7()\`]` (native since PostgreSQL 18): time-ordered, good index locality. A value that must be unguessable (a token, a capability URL) never uses v7: it embeds its creation time |
| NOT NULL | Every column is `NOT NULL` unless absence is a real state of the domain (an attribute that is not obligatory, or obligatory only in some state) |
| Defaults | Database defaults only for technical columns (`id`, audit columns, `version`, `active`) and genuine domain defaults. Never a fake default (`''`, `0`) to dodge `NOT NULL` |
| Audit columns | `created_at` and `updated_at`, `timestamptz not null default now()`. `updated_at` is maintained by a `BEFORE UPDATE` trigger (`set_updated_at()`), never by the ORM alone: other writers bypass it. Insert-only tables (event logs): only `created_at` |
| Instants | `timestamptz`, stored in UTC; the database time zone is `UTC`. Logic over local days uses `AT TIME ZONE` with the product's zone (its NFR). Never `timestamp` without zone, `timetz`, or `timestamptz(0)` |
| Durations | `integer` with the unit in the name (`duration_minutes`), `CHECK (>= 0)`. When a constraint needs an end instant, store it as a column: `timestamptz + interval` cannot be used in an index or exclusion expression |
| Money | `bigint` in the minor unit (`price_cents`). The currency is a schema decision (below). `numeric(p,s)`, with explicit precision, only for values below the minor unit (rates, unit prices). Never the `money` type |
| Enums | Native enum type named `{table_singular}_{column}`, values English `snake_case`, for small and stable sets (states). A value is never removed, only deprecated; adding one is its own migration. A set whose values carry attributes or change often is a lookup table |
| Text | `text`. A length limit, only when the domain states it, is a `CHECK (char_length(x) <= n)`. Never `char(n)` or `varchar(n)` |
| Case-insensitive values | Normalized at write (`lower()`), guaranteed by `CHECK (x = lower(x))`, with a plain unique index. Not `citext` |
| JSON | `jsonb`, never `json`. Only for opaque or variable payloads that are never filtered or joined on |
| Booleans | A plain adjective or participle (`active`, `verified`), `NOT NULL` with a default. When *when* matters, a timestamp instead (`verified_at`) |
| Deactivation | A domain entity that "se desactiva" gets `active boolean not null default true`. Deletion otherwise is physical; `deleted_at` only through a schema decision |
| Foreign keys | `{referenced_singular}_id`, always indexed (PostgreSQL does not index them). `ON DELETE RESTRICT`, `ON UPDATE RESTRICT`; `ON DELETE CASCADE` only when the domain's deletion policy says the child goes with the parent |
| Secrets | Never stored readable. Passwords: Argon2id, the full PHC string in `password_hash`. Random tokens of at least 128 bits: SHA-256 in `{name}_hash`, with a unique index. A token that must be delivered again later is a schema decision (below) |
| Personal data | The schema document marks every column holding personal data (`dato personal` in its note); the migration mirrors it with `COMMENT ON COLUMN … IS '[pii] …'`. Anonymization and log redaction read it |
| Derived attributes | Stored as a column only when a constraint, an index or a guarantee needs it; otherwise computed |
| Names of constraints and indexes | Primary keys, foreign keys and plain unique: PostgreSQL's default names. Every other constraint (exclusion, check, partial unique, permission): `{table}_{purpose}`, with the guarantee ID when it implements one (`appointments_inv01_no_overlap`), at most 63 bytes. These names are a contract: errors are mapped to domain errors by constraint name, so they never change |
| Extensions | Only from an allow-list (`btree_gist`, `pg_trgm`), created in a migration with `IF NOT EXISTS`. A new one is a technical decision. Not `pgcrypto` for UUIDs |
| Documentation in the database | `COMMENT ON TABLE` with the domain entity, `COMMENT ON CONSTRAINT` with the guarantee it implements, written in the migrations |

Functional types of the domain analysis map to database types:

| Functional type | Database type | Column name |
|---|---|---|
| texto, email, teléfono | `text` | — |
| número | `integer` (`numeric(p,s)` if the domain states decimals) | — |
| booleano | `boolean` | — |
| fecha | `date` | — |
| hora | `time` | — |
| fecha y hora | `timestamptz`, stored in UTC | reads as an instant: `{name}_at`, `locked_until` |
| duración | `integer`, in minutes | `{name}_minutes` |
| dinero | `bigint`, in the minor unit | `{name}_cents` |
| enum | native enum type | — |
| referencia | `uuid`, foreign key | `{referenced_singular}_id` |

## Schema decisions (the product decides them)

These depend on the product, so the database schema document records each one — with its value or
an explicit "no aplica":

| Decision | Question | Turnero |
|---|---|---|
| Concurrency | Which entities are edited concurrently and need a `version integer` column (optimistic concurrency), beyond the row locks the guarantees already take? | No aplica: los conflictos se resuelven con bloqueos de fila (Garantías) |
| Multi-tenancy | Does the product serve several organizations? If so, `tenant_id` in every tenant table, leading composite indexes and uniques, and optionally row-level security | No aplica: un solo consultorio |
| History | What history is kept, and how: a history table per entity, a trigger-based audit, or an event log | Evento de turno, para los turnos; nada más |
| Deletion | Does any entity need undo or retention after deletion (`deleted_at`)? | No aplica |
| Currency | Only if there is a `dinero` attribute: one fixed currency, or a `{name}_currency` column (ISO 4217) | Una sola: pesos argentinos |
| Re-delivered tokens | Only if a token must be delivered again after its creation (a link in a later email): a new token on each delivery (earlier ones stop working), or the token stored encrypted with a key outside the database | El link del recordatorio: se guarda cifrado |
