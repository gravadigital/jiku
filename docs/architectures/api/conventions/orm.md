---
id: orm
display_name: Acceso a datos (Sequelize, solo lectura)
language: node
description: Read-only Sequelize access with models from a shared package; queries live in the route handler
applies_to: [api]
required_by: []
package: sequelize-typescript
---

# Acceso a datos (api, Sequelize en solo lectura)

> **Reemplaza** la convención `orm` del catálogo, que usa Prisma con `schema.prisma` y un
> repositorio por módulo de dominio. Este servicio usa Sequelize con los modelos en un paquete
> compartido, **sin capa de repositorio**: las queries viven en el handler. Y la conexión es de
> **solo lectura**.

## Cuándo aplica

Toda lectura de datos del servicio. Las escrituras no van por acá: ver
[`bus-commands`](./bus-commands.md).

## Paquete

```
sequelize              # 6.37
sequelize-typescript   # 2.1, decoradores
pg                     # driver
sequelize-cli          # migraciones
@jiku/models           # los 26 modelos, compartidos con core
```

## La conexión es de solo lectura

```ts
// lib/models/index.ts:19-31
export const sequelize = new Sequelize({
  database: process.env.POSTGRESQL_DB,
  username: process.env.POSTGRESQL_USER,     // rol con SELECT únicamente
  password: process.env.POSTGRESQL_PASSWORD,
  dialect: 'postgres',
  models: allModels,                          // registro explícito
  logging: false,
});
```

Un `Model.create()`, `.update()` o `.destroy()` **falla en runtime** por permisos de PostgreSQL.
Esa es la garantía; no la trates como una convención de estilo.

**Dos excepciones vivas:**

| Excepción | Dónde | Notas |
|---|---|---|
| Migraciones | `db-upgrade/config.js:10-14` | credenciales propias (`POSTGRESQL_MIGRATION_USER` / `_PASSWORD`), con fallback a las de la api |
| Fila de `attachments` | `lib/routes/attachments-post.ts:105-118` | `Attachment.create()` con las credenciales de la api |
| `PUT /api/week-assigned-times` | `lib/routes/week-assigned-times-put.ts:39-78` | `destroy` + `bulkCreate` en una transacción. **Es la única ruta que escribe con el ORM**, y la única que usa los middlewares de transacción |

> **Las dos últimas escriben con las credenciales de solo lectura.** Funcionan hoy porque el rol
> de la instalación las permite; contra un rol estrictamente `SELECT` fallarían en runtime. Son
> deuda conocida, no un patrón a seguir: el futuro de `week-assigned-times` está sin decidir
> (puede mantenerse, rehacerse o eliminarse), y su escritura nunca se convirtió en comando.

## Los modelos viven en un paquete compartido

`@jiku/models` exporta las 26 clases pero **no abre la conexión**, a propósito: api y core usan
la misma definición con credenciales distintas. Es lo que hace posible la separación.

```ts
// lib/models/index.ts
import { allModels } from '@jiku/models';
// ...
models: allModels,   // registro explícito, no un glob de archivos
```

> **Un cambio de modelo afecta a los dos servicios.** Si agregás una columna, tocá
> `packages/models/src/{entidad}.model.ts`, agregá la migración en `api/db-upgrade/migrations/`
> y revisá si core necesita aceptarla en su comando.

Convención de los modelos: `timestamps: true`, `underscored: true`, `tableName` explícito. Las
columnas se declaran en `camelCase` y Sequelize las mapea a `snake_case`.

## Cómo se consulta

La query va **en el handler**, con los `include` que la respuesta necesita.

```ts
// lib/routes/requirements-get.ts:47-62
return Requirement.findAll({
  where,
  include: [
    { model: Project, as: 'project', attributes: ['id', 'name'] },
    {
      model: Person,
      as: 'responsiblePeople',
      attributes: ['id', 'firstName', 'lastName'],
      through: { attributes: ['isLeader'] },
    },
  ],
  limit: Number(limit),
  offset,
  order: [['createdAt', 'DESC']],
});
```

Reglas prácticas que sigue el código:

- **`attributes` explícito en los `include`.** No traigas la fila entera de una relación cuando
  la respuesta usa tres campos.
- **`as` explícito** cuando la asociación tiene alias (`'project'`, `'creator'`,
  `'responsiblePeople'`).
- **`through: { attributes: [...] }`** para leer columnas de la tabla intermedia
  (`isLeader` de `people_requirements`).

## Filtros: el patrón `reduce`

Los `where` condicionales se arman con un array de condiciones colapsado con `reduce`:

```ts
// lib/routes/projects-get.ts:12-24
const whereClause = [
  type && { type },
  search && { name: { [Op.iLike]: '%' + search + '%' } },
  state && { status: { [Op.or]: state.split(',').map(s => s.trim()) } },
].reduce((acc, condition) => (condition ? { ...acc, ...condition } : acc), {});
```

`requirements-get.ts` usa `if` sucesivos para lo mismo. Ambos están; para código nuevo, el
`reduce` es el que declara mejor la intención.

Búsqueda de texto: **siempre `Op.iLike`** con `%...%`. No `Op.like`.

## Middlewares que cargan entidades

Cuando la entidad viene en el path, no la busques en el handler: usá el middleware, que ya
responde 404 y deja la entidad en `req`.

| Middleware | Param | Deja en `req` |
|---|---|---|
| `validate-project` | `:projid` | `req.project` |
| `validate-requirement` | `:reqid` | `req.requirement`, `req.project` |
| `validate-objective` | `:objid` | `req.objective`, `req.project` |

## SQL crudo

Se usa solo cuando el operador no tiene equivalente en Sequelize. Hoy, un caso: el filtro por
tag sobre una columna `jsonb`.

```ts
// lib/routes/requirements-get.ts:41-45
where.tags = sequelize.literal(
  `tags @> '[{"key": ${JSON.stringify(key)}, "value": ${JSON.stringify(value)}}]'::jsonb`
);
```

> El valor se interpola con `JSON.stringify`, que escapa las comillas. **Si escribís un
> `literal` nuevo, no interpoles input del usuario sin escapar.** Preferí siempre el operador de
> Sequelize; el `literal` es la última opción.

Los reportes con agregación usan `sequelize.fn` / `sequelize.col` en vez de `literal`.

## Transacciones

`transaction-start.ts` y `transaction-commit.ts` son middlewares que dejan la transacción en
`req.transaction`. **Una sola ruta los usa**: `PUT /api/week-assigned-times`, la única que escribe
con el ORM.

```ts
// lib/routes/week-assigned-times-put.ts:120-128
router.put('/week-assigned-times',
  validateToken,
  hasAnyRole(['admin']),
  validateBodyFields(putWeekAssignedTimesSchema),
  validateWeekNotPast,
  startTransaction,       // deja req.transaction
  putWeekAssignedTimes,   // destroy + bulkCreate; rollback explícito en el catch
  commitTransaction,
  sendResponse
);
```

El handler hace el `rollback()` a mano en su `catch` y responde 500;
`commitTransaction` commitea y, si el commit falla, hace rollback y responde 500.

> No uses este patrón en código nuevo: la escritura va por el bus, y la transacción de un comando
> pertenece al dispatcher de core. Estos middlewares existen para la ruta que quedó atrás.

## Migraciones

```sh
npm run upgrade-db --workspace @jiku/api      # solas
npm start --workspace @jiku/api               # las corre y después sirve
```

- Van en `db-upgrade/migrations/`, en **JavaScript** (requisito de `sequelize-cli`).
- Nombre: `YYYYMMDD_NN_descripcion.js`.
- Se esperan **aditivas**: el esquema no está versionado aparte del producto.
- Tabla de control: `sequelize_meta`.

> **Las 101 migraciones actuales no construyen el esquema desde cero**: todas asumen uno
> existente y ninguna crea `objectives`. Una instalación nueva necesita un dump previo. No
> asumas que `upgrade-db` sobre una base vacía funciona.

En `testing` y `development` el arranque hace `sequelize.sync()` además de las migraciones
(`lib/models/index.ts:63-70`). En producción, no.

## Reglas

- No escribas con el modelo. Las dos escrituras que quedan (`Attachment.create()` y
  `PUT /api/week-assigned-times`) son deuda, no precedente.
- No uses los middlewares de transacción en código nuevo: existen solo para
  `PUT /api/week-assigned-times`.
- Los modelos se modifican en `packages/models/src/`, nunca localmente en la api. El cambio
  afecta también a core.
- Todo cambio de esquema lleva su migración en `db-upgrade/migrations/`, aditiva, con nombre
  `YYYYMMDD_NN_descripcion.js`.
- `attributes` explícito en los `include`. No traigas relaciones completas.
- `as` explícito cuando la asociación tiene alias.
- Búsqueda de texto con `Op.iLike`, nunca `Op.like`.
- Filtros condicionales con el patrón `reduce`.
- Entidad en el path → middleware de validación, no query en el handler.
- `sequelize.literal` solo cuando no hay operador equivalente, y **nunca** con input del usuario
  sin escapar.
- Los reportes con agregación usan `sequelize.fn` / `sequelize.col`.

## Integración con otras convenciones

- **bus-commands**: toda escritura va por ahí; la relectura post-comando usa este Sequelize.
- **http-server**: las queries viven en el handler del archivo de ruta.
- **authorization**: `user_project_permissions` es la tabla que acota a `external-user`.
- **testing**: los tests corren contra una base real, con el esquema creado por `sync()`.
