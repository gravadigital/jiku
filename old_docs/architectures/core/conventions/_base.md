---
id: _base
display_name: Convenciones generales (core)
language: node
description: "Base conventions: strict TypeScript, one file per command, relative imports, comments that explain why"
applies_to: [worker]
required_by: []
package: typescript
---

# Convenciones base (core)

> **Reemplaza** el `_base` del catálogo de Node, que exige `src/domain/{module}/` e imports
> absolutos con paths de `tsconfig`. Este servicio organiza por `src/commands/{entidad}/` y usa
> imports relativos. Lo que sí se mantiene del catálogo: TypeScript obligatorio, `kebab-case` en
> archivos, `strict: true`, y fechas ISO en los bordes del sistema.

## Siempre activa

Esta convención está activa por definición: describe el terreno sobre el que trabajan todas las
demás.

## TypeScript

- TypeScript obligatorio. No se escribe JavaScript nuevo.
- **`strict: true` está activo**, y además `noUnusedLocals`, `noUnusedParameters` y
  `noImplicitReturns` (`core/tsconfig.json:22-26`). No lo apagues: es el único servicio que
  escribe en la base y el tipado es parte de la defensa.
- Es la diferencia con `api`, que lo tiene apagado. Si movés código de la api a core, esperá que
  el compilador se queje: eso es el punto.
- `experimentalDecorators` y `emitDecoratorMetadata` están activos porque `sequelize-typescript`
  define los modelos con decoradores.
- `any` se tolera en dos bordes concretos: los payloads del bus antes de validar
  (`Command<any, any>` en el registry) y el acceso dinámico a campos del modelo
  (`(task as any)[field]` en `tasks-edit.ts:115`). La regla
  `@typescript-eslint/no-explicit-any` está apagada en el ESLint compartido a propósito.
- El módulo es `commonjs` y el target `es6`. No uses `import()` dinámico ni sintaxis ESM que
  `tsc` no pueda bajar.

## Estructura

```
core/src/
├── index.ts                 # arranque y señales
├── logger.ts
├── bus/                     # consumer + dispatcher
├── commands/
│   ├── index.ts             # el registro único
│   ├── registry.ts, types.ts, validate.ts
│   └── {entidad}/           # un archivo por comando
└── models/index.ts
```

- **Un archivo por comando.** El nombre del archivo es `{entidad}-{acción}.ts`
  (`clients-new.ts`, `tasks-edit.ts`). Los comandos que comparten payload y helpers pueden
  compartir archivo si son la misma operación en dos direcciones: `worked-times.ts` exporta
  `workedTimesNew` y `workedTimesDelete`.
- Los helpers de un dominio van en un archivo propio dentro de su carpeta, sin prefijo de entidad:
  `projects/properties.ts`, `tasks/priority.ts`, `tasks/activity.ts`.
- No hay capa de repositorio ni de servicio. Un comando habla directo con los modelos.
- No hay `src/domain/`: la carpeta de entidad bajo `commands/` ES el módulo de dominio.

## Naming

- Archivos: `kebab-case.ts`.
- Clases: `PascalCase` (`Consumer`, `Dispatcher`, `CommandRegistry`).
- Comandos exportados: `camelCase` que coincide con el `pattern`
  (`clientsNew` → `clients.new`, `requirementsSubscriptorsDelete` → `requirements.{id}.subscriptors.{userId}.delete`).
- Cada archivo de comando exporta el comando **nombrado y también como `default`**. El
  `index.ts` importa el default.
- Constantes de módulo: `SCREAMING_SNAKE_CASE` (`DAILY_LIMIT_MINUTES`, `TRACKED`,
  `ALLOWED_CODES`).
- Interfaces de payload: `{Comando}Payload` (`ClientsNewPayload`, `TasksEditPayload`).

## Imports

- **Imports relativos**, sin alias ni paths de `tsconfig`: `../types`, `./priority`.
- Los paquetes del workspace se importan por nombre: `@jiku/models`, `@jiku/nats-protocol`,
  `@jiku/zitadel-auth`. Se consumen **compilados** (su `package.json` apunta a `dist/`), así que
  hay que buildearlos antes de correr core.
- Orden de imports en un archivo de comando: `joi` → `sequelize` si hace falta →
  `@jiku/models` → `@jiku/nats-protocol` → relativos.

## Fechas

- Dos representaciones y no se mezclan:
  - **`DATE`/timestamp**: `initDate`, `endDate`, `estimatedFinishDate` de requirements. Joi las
    valida con `joi.date()` y llegan como `Date`.
  - **STRING `YYYY-MM-DD`**: `worked_times.date`, `unworked_times.date` y
    `objectives.estimated_finish_date`. La columna es STRING, no DATE.
- Cuando la columna es STRING y el payload trae una fecha, hay que **coercionar explícitamente**:
  ```ts
  estimatedFinishDate: joi.date().allow(null).optional().custom((value) =>
    value instanceof Date ? value.toISOString().split('T')[0] : value
  ),
  ```
  Sin eso Sequelize rechaza el `Date` (`tasks/tasks-new.ts:35-37`).
- Las de tipo string se validan con patrón, no con `joi.date()`:
  `joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)`.
- Los tests fijan `TZ=UTC` (`tests/setup-env.ts:16`). No dependas de la zona local en ningún lado.

## Comentarios

- **En español**, igual que en `api`.
- Explican **el por qué**, no el qué. El código ya dice qué hace.
- Lo que amerita un comentario: una decisión que parece un error y no lo es, una diferencia
  deliberada con lo que hacía la api, una traducción entre el contrato y la base, un escape
  transitorio.
- Ejemplos del codebase que dan la vara:
  - `validate.ts:23-33` — la semántica de edición parcial, entera, en cuatro líneas.
  - `priority.ts:1-17` — por qué existe la traducción y por qué el mapeo es el que es.
  - `registry.ts:9-17` — por qué segmentos y no regex.
- Un comentario que marca deuda o algo transitorio dice **cuándo desaparece**:
  *"cuando la web pase a hablar en nombres, este campo desaparece"* (`priority.ts:41-42`).

## Reglas

- `strict: true` no se apaga.
- Un comando nuevo son tres pasos: el archivo, el registro en `commands/index.ts`, y sus tests.
  Los tres o ninguno.
- El `pattern` de un comando tiene que coincidir con el subject de `docs/apis/core.yaml`. Ante una
  discrepancia, **manda el documento**.
- Un comando nunca abre ni cierra transacciones. Ver [`commands`](./commands.md).
- Un comando nunca lee `process.env`. La configuración se lee al arrancar
  (ver [`env-config`](./env-config.md)); las constantes de negocio son constantes de módulo.
- Nada de `console.log`. Se usa el logger (ver [`logging`](./logging.md)).
- Imports relativos; no agregues alias al `tsconfig`.
- No agregues una capa de repositorio ni de servicio: un comando es la unidad completa.
