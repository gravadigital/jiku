---
id: orm
display_name: Acceso a datos (Sequelize, usuario dueño de la base)
language: node
description: Sequelize with the database owner credentials; models from a shared package, no repository layer
applies_to: [worker]
required_by: []
package: sequelize-typescript
---

# Acceso a datos (core, Sequelize con el usuario dueño)

> **Reemplaza** la convención `orm` del catálogo, que usa Prisma con `schema.prisma` y un
> repositorio por módulo de dominio. Este servicio usa Sequelize con los modelos en un paquete
> compartido y **sin capa de repositorio**: las queries viven en el comando. Y a diferencia de
> `api`, la conexión es de **lectura y escritura**.

## Cuándo aplica

Todo acceso a datos del servicio. Core es el único que escribe en la base del producto.

## Paquete

```
sequelize                # 6.37
sequelize-typescript     # 2.1, modelos con decoradores
pg                       # 8.16, driver
@jiku/models             # los 28 modelos, compartidos con api
```

## La conexión

```ts
// core/src/models/index.ts
export const sequelize = new Sequelize({
  database: process.env.POSTGRESQL_DB,
  username: process.env.POSTGRESQL_USER,      // el usuario DUEÑO
  password: process.env.POSTGRESQL_PASSWORD,
  port: Number(process.env.POSTGRESQL_PORT) || 5432,
  host: process.env.POSTGRESQL_HOST,
  dialect: 'postgres',
  omitNull: false,
  models: allModels,
  logging: false,
});
```

**Core conecta con el usuario dueño de la base**, y es el único servicio que lo hace. `api` conecta
con un rol sin `INSERT`/`UPDATE`/`DELETE`. La separación es por **credenciales**, no por disciplina:
no hay forma de que la api escriba por accidente.

`omitNull: false` es deliberado: un `null` explícito en un `update` tiene que llegar a la base como
`NULL`. Es lo que hace funcionar el "campo en `null` = vaciar" de la edición parcial.

`logging: false` apaga el SQL. Para diagnosticar un comando se usa `LOG_COMMANDS`
(ver [`logging`](./logging.md)), que muestra el payload y la respuesta.

### Reintento al arrancar

```ts
const CONN_MAX_ATTEMPTS = 5;
const CONN_INTERVAL = 1;
```

Cinco intentos con 1 segundo de espera antes de abortar (`models/index.ts:35-52`). Es para el
arranque en Docker, donde el contenedor de la base puede no estar listo todavía. **No hay reintento
después del arranque**: una caída de la base en caliente hace fallar los comandos con
`internal_error`.

## Los modelos vienen de un paquete compartido

```ts
import { allModels } from '@jiku/models';
```

`@jiku/models` **no abre la conexión**: exporta las clases y cada servicio las registra en su propio
Sequelize, porque conectan con credenciales distintas. Es lo que hace que las definiciones no puedan
divergir entre `api` y `core`.

**Consecuencias prácticas:**

- Un cambio de modelo es un cambio en `packages/models/`, no en core. Afecta a `api` en el mismo
  commit.
- Hay que **compilar el paquete** antes de correr core: su `package.json` apunta a `dist/`. El
  `postinstall` de la raíz lo hace.
- Los modelos usan los nombres de la **base** (`Objective`, `objectiveId`). Los del contrato se
  traducen en el comando (ver [`contract-translation`](./contract-translation.md)).
- **No renombres un modelo** para que coincida con el contrato: lo comparte `api`.

## Sin capa de repositorio

Un comando habla directo con los modelos:

```ts
const project = await Project.findByPk(payload.projectId, { transaction: ctx.transaction });
if (!project) return failure(ErrorCode.PROJECT_NOT_FOUND, 'Project not found');
```

No hay `ProjectRepository`, ni servicio de dominio, ni DTO intermedio. El comando **es** la unidad
completa: valida, consulta y escribe. Un comando de core tiene entre 30 y 180 líneas; una capa de
abstracción por encima sumaría archivos sin sumar aislamiento.

## Toda operación lleva la transacción

```ts
await Client.create({ ... }, { transaction: ctx.transaction });
await client.update(changes, { transaction: ctx.transaction });
await Person.count({ where: { ... }, transaction: ctx.transaction });
await PersonObjective.destroy({ where: { ... }, transaction: ctx.transaction });
```

**Sin excepción, incluidas las lecturas.** Las lecturas la llevan para ver las escrituras que el
propio comando ya hizo — un `findOne` fuera de la transacción no vería la fila recién insertada.

Una escritura que se olvide la transacción **corre por fuera y sobrevive al rollback**. Es el error
más fácil de cometer en este codebase y el más difícil de detectar: el test pasa, y la inconsistencia
aparece cuando otra validación falla más adelante.

La transacción la abre el despachador; el comando solo la propaga. Ver
[`commands`](./commands.md).

## Patrones de consulta

### Existencia de una entidad del subject

```ts
const task = await Objective.findByPk(ctx.params.id, { transaction: ctx.transaction });
if (!task) return failure(ErrorCode.OBJECTIVE_NOT_FOUND, 'Objective not found');
```

### Existencia de una lista completa

```ts
const count = await Person.count({
  where: { id: { [Op.in]: payload.responsiblePersonIds } },
  transaction: ctx.transaction,
});
if (count !== payload.responsiblePersonIds.length) {
  return failure(ErrorCode.PERSON_NOT_FOUND, 'Person not found');
}
```

Un `count` contra el largo de la lista. **No informa cuál falta** — está documentado así en el
contrato. Si algún día hace falta el detalle, cambia el contrato, no solo la query.

### Agregación con tope

```ts
const total = (await WorkedTime.sum('minutes', {
  where: { personId: payload.personId, date: payload.date },
  transaction: ctx.transaction,
})) || 0;
```

`sum` devuelve `null` cuando no hay filas: el `|| 0` no es defensivo, es necesario.

### Scopes del modelo

```ts
const attachment = await Attachment.scope('active').findOne({ where: { ... } });
```

Los scopes se definen en el modelo, en `@jiku/models`. El `active` de `Attachment` filtra los
soft-eliminados.

### Hooks del modelo

Algunos modelos tienen lógica propia que el comando **aprovecha en lugar de duplicar**:

```ts
// requirements-edit.ts:90-94
// El hook @BeforeUpdate del modelo calcula `activityLog` y, cuando cambia el estado,
// completa las marcas de tiempo (scheduledAt, inProgressAt, ...).
await requirement.update(changes, { transaction: ctx.transaction });
const logged: FieldActivityChange[] = requirement.activityLog || [];
```

Es la razón por la que el historial de `requirements` y el de `tasks` se calculan distinto: el de
requirements lo hace el modelo, el de tasks lo hace el comando a mano.

### Soft delete

```ts
await attachment.softDelete(payload.editor, { transaction: ctx.transaction });
```

Método del modelo, no un `destroy`. Los adjuntos no se borran físicamente.

## Migraciones

**Core no las corre.** Viven en `api/db-upgrade/migrations/` (95 migraciones) y las ejecuta la api
al arrancar con credenciales propias (`POSTGRESQL_MIGRATION_USER`). El esquema tiene un solo dueño.

> El comentario de `deploy/docker-compose.yml:129` dice que core corre las migraciones. **Es
> incorrecto.**

### `sequelize.sync()` en desarrollo y tests

```ts
if (['testing', 'development'].includes(NODE_ENV)) {
  return sequelize.sync();
}
```

En producción no corre. Pero significa que **el esquema de desarrollo lo construye Sequelize y el de
producción las migraciones**: dos fuentes distintas. Una columna que exista en el modelo pero no en
una migración funciona en local y falla en producción. Si agregás una columna, la migración es parte
del cambio.

## Reglas

- **Toda operación de Sequelize lleva `{ transaction: ctx.transaction }`**, incluidas las lecturas.
- Los modelos se importan de `@jiku/models`. No definas un modelo en core.
- No renombres un modelo ni una columna para acomodar el contrato: se traduce en el comando.
- No agregues una capa de repositorio ni de servicio.
- No cambies `omitNull: false`: rompe el vaciado de campos de la edición parcial.
- No enciendas `logging` de Sequelize en producción. Para diagnosticar, `LOG_COMMANDS`.
- Un `count` contra el largo de una lista es el patrón para validar existencia en bloque.
- `sum` puede devolver `null`: siempre `|| 0`.
- Aprovechá los hooks y scopes del modelo en vez de duplicar su lógica en el comando.
- Una columna nueva va con su migración en `api/db-upgrade/migrations/`, en el mismo cambio.
- Core no ejecuta migraciones.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: quién abre la transacción y por qué el comando no la controla.
- **[`contract-translation`](./contract-translation.md)**: los nombres que difieren entre el bus y
  la base.
- **[`testing`](./testing.md)**: los tests corren contra una base real, sin mocks de Sequelize.
- **[`env-config`](./env-config.md)**: las variables `POSTGRESQL_*`.
