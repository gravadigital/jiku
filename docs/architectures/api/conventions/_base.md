---
id: _base
display_name: Convenciones generales (api)
language: node
description: "Convenciones base del servicio: estructura sin src/, un archivo por endpoint, imports relativos"
applies_to: [api]
required_by: []
package: typescript
---

# Convenciones base (api)

> **Reemplaza** el `_base` del catálogo de Node, que exige `src/domain/{module}/`, imports
> absolutos con paths de `tsconfig` y `strict: true`. Este servicio no tiene `src/`, usa imports
> relativos y su `tsconfig` no está en modo estricto. Lo que sí se mantiene del catálogo:
> TypeScript obligatorio, `kebab-case` en archivos, y fechas ISO en los bordes del sistema.

## Siempre activa

Esta convención está activa por definición: describe el terreno sobre el que trabajan todas las
demás.

## TypeScript

- TypeScript obligatorio. No se escribe JavaScript nuevo, salvo las migraciones de
  `db-upgrade/migrations/`, que son `.js` por requerimiento de `sequelize-cli`.
- `strict` **no** está activo. No lo actives por servicio: 61 archivos de ruta lo asumen apagado
  y el cambio no es local.
- `any` se usa en los bordes con Sequelize y con los payloads del bus. La regla de ESLint
  `@typescript-eslint/no-explicit-any` está apagada a propósito
  (`eslint.config.base.js:44`). Cuando lo uses fuera de esos dos casos, comentá por qué.
- La augmentación de `Express.Request` vive en `lib/interfaces/index.ts` y se importa por efecto
  en `app.ts:8` (`import './lib/interfaces'`). Si agregás una propiedad a `req`, va ahí.

## Estructura

No hay `src/`. El código vive en `lib/`, y el dominio no está en carpetas: **está en el prefijo
del nombre del archivo de ruta**.

```
api/
├── app.ts                    Express, middleware global, montaje
├── bin/index.ts              entry point
├── config/                   configuración declarativa (hoy solo public.ts)
├── lib/
│   ├── routes/               un archivo por endpoint + index.ts (barrel)
│   ├── models/               el Sequelize del servicio
│   ├── interfaces/           tipos compartidos y augmentación de Express
│   ├── logger.ts
│   └── utils/
│       ├── bus/              cliente NATS y traductores de contrato
│       ├── middlewares/      middlewares compartidos entre rutas
│       └── *.ts              helpers sueltos
├── db-upgrade/migrations/    .js, sequelize-cli
├── tests/
└── types/
```

## Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` | `validate-token.ts`, `send-command.ts` |
| Archivos de ruta | `{recurso}-{path}-{método}` | `requirements-id-patch.ts`, `worked-times-report-by-project-projid-get.ts` |
| Exports del barrel | `PascalCase` describiendo la ruta | `RequirementsIdPatch`, `WorkedTimesReportByProjectGet` |
| Funciones y variables | `camelCase` | `validateProject`, `parsedParams` |
| Constantes de módulo | `SCREAMING_SNAKE_CASE` | `MAX_FILE_SIZE`, `ALLOWED_MIME_TYPES` |
| Tipos e interfaces | `PascalCase`, sin prefijo `I` | `DecodedToken`, `ParsedParams` |
| Enums | `PascalCase` en nombre y miembros, valor en español | `RequirementState.Resuelto = 'resuelto'` |

**El nombre del archivo de ruta codifica el endpoint.** Los parámetros de path van con su nombre
sin los dos puntos: `PATCH /api/requirements/:reqid` es `requirements-id-patch.ts`, y
`GET /api/opus/requirements/:reqid/subscriptors/:userId` sería
`opus-requirements-id-subscriptors-userid-get.ts`. Es lo que hace que la carpeta sea navegable
con 61 archivos.

## Imports

- **Relativos.** No hay paths de `tsconfig` en el código fuente. Desde `lib/routes/` eso es
  `../utils/...` y `../logger`.
- Los `_moduleAliases` de `package.json` (`@models`, `@logger`, `@utils`) aplican al JavaScript
  compilado vía `module-alias`, **no** al código TypeScript. No los uses en los imports.
- Los paquetes del monorepo se importan por nombre: `@jiku/models`, `@jiku/nats-protocol`,
  `@jiku/zitadel-auth`.
- El orden habitual en un archivo de ruta: express, paquetes externos, `@jiku/*`, y después los
  relativos del servicio. No hay regla de lint que lo imponga.

## Fechas

- En los bordes HTTP, las fechas van como las manda Sequelize al serializar. Los comandos del
  bus que llevan un día llevan `YYYY-MM-DD`: `new Date(date).toISOString().split('T')[0]`
  (`lib/routes/worked-times-post.ts:122`).
- Los contenedores fijan `TZ=UTC` (`Dockerfile:5`). No dependas de la zona del host.
- Las reglas de calendario (ventana de carga, semana no pasada) comparan contra `new Date()`
  normalizado con `setHours(0,0,0,0)`. Si escribís una regla así, normalizá los dos lados.

## Comentarios

El servicio comenta **el por qué, no el qué**, y lo hace en español. Los comentarios existentes
registran decisiones y las consecuencias de cambiarlas — por ejemplo, por qué el bypass de auth
es opt-in explícito (`lib/utils/middlewares/validate-token.ts:12-24`) o por qué el prefijo de
claves del storage no se puede cambiar en una instalación con datos
(`lib/utils/storage-service.ts:21-27`).

Cuando toques algo con una razón no obvia, dejala escrita. Es la única documentación de la
decisión que va a viajar con el código.

## Reglas

- No crees `src/`. El código nuevo va en `lib/`, siguiendo la estructura existente.
- Un endpoint es un archivo en `lib/routes/` más una línea en `lib/routes/index.ts`. No agrupes
  dos endpoints en un archivo, salvo que compartan handler y difieran solo en el path
  (`attachments-get.ts` monta `/attachments` y `/attachments/:id`).
- No actives `strict` ni `noUncheckedIndexedAccess` en `tsconfig.json`.
- Usá imports relativos. No introduzcas paths de `tsconfig` ni uses los alias de `module-alias`
  en TypeScript.
- Los valores de enum van en español, porque son los que viajan al front y a la base.
- Comentá en español, y comentá el por qué.
- Un archivo `.ts` nuevo en `lib/` no lleva extensión en el import.
- Lint antes de dar por terminado: `npm run lint --workspace @jiku/api` (cubre solo `./lib`).

## Integración con otras convenciones

- **http-server**: define cómo se escribe el archivo de ruta que esta convención nombra.
- **_base es el terreno**: cada convención de este servicio asume la estructura de acá.
