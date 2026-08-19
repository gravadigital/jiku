---
id: http-server
display_name: Servidor HTTP (Express 5, un archivo por endpoint)
language: node
description: Express 5 with one file per endpoint, auto-mounted from a barrel export
applies_to: [api]
required_by: []
package: express
---

# Servidor HTTP (api, Express 5)

> **Reemplaza** la convención `http-server` del catálogo, que usa Fastify con
> `domain/{module}/{module}.routes.ts` y controllers separados. Este servicio usa Express 5 con
> **un archivo por endpoint**, y la validación, los permisos y el handler colocados juntos en
> ese archivo.

## Cuándo aplica

Todo endpoint HTTP del servicio. Es la convención central: cualquier feature que exponga datos
o acepte una mutación pasa por acá.

## Paquete

```
express                # 5.2
cors                   # CORS abierto (app.ts:15)
express-winston        # logging de request (ver logging)
multer                 # multipart, solo en las rutas de adjuntos (ver storage)
```

## Estructura

```
api/
├── app.ts                 crea el Application, middleware global, monta las rutas
├── bin/index.ts           entry point: assertAuthConfig → initializeDb → initialize → listen
└── lib/routes/
    ├── index.ts           barrel: un export por archivo
    ├── clients-get.ts
    ├── requirements-id-patch.ts
    └── ...                61 archivos
```

## El montaje es automático

`app.ts` itera los exports del barrel y monta cada router bajo `/api`:

```ts
// app.ts:35-37
for (const key of Object.keys(routes)) {
  app.use('/api', routes[key as keyof typeof routes]);
}
```

Agregar un endpoint son **dos pasos**: crear el archivo y exportarlo en
`lib/routes/index.ts`. `app.ts` no se toca.

> El prefijo `/api` lo pone el montaje. En el archivo de ruta el path va **sin** él:
> `router.get('/requirements', ...)` responde en `GET /api/requirements`.

## Cómo se escribe un archivo de ruta

La forma canónica: esquema Joi, middlewares locales, handler, y el `router` al final con la
cadena de middlewares en orden de ejecución.

```ts
// lib/routes/requirements-post.ts
import { Request, Response, NextFunction, Router } from 'express';
import joi from 'joi';
import { Requirement, RequirementState } from '@jiku/models';
import logger from '../logger';
import hasAnyRole from '../utils/middlewares/has-any-role';
import validateBodyFields from '../utils/validate-body-fields';
import { sendCommand } from '../utils/bus/send-command';

const router: Router = Router();

const createSchema = joi.object({
  title: joi.string().required(),
  projectId: joi.number().integer().required(),
  state: joi.string().valid(...Object.values(RequirementState)).optional(),
});

// Middlewares locales al endpoint: los que no se comparten viven acá.
function validateProject(req: Request, res: Response, next: NextFunction) { /* ... */ }

async function createRequirement(req: Request, res: Response) { /* ... */ }

router.post('/requirements',
  hasAnyRole(['user', 'admin']),
  validateBodyFields(createSchema),
  validateProject,
  createRequirement
);

export default router;
```

Y el barrel:

```ts
// lib/routes/index.ts
export { default as RequirementsPost } from './requirements-post';
```

### Orden de la cadena

El orden importa y es siempre el mismo:

1. **Rol** — `hasAnyRole([...])`, si el endpoint lo acota
2. **Forma del input** — `validateBodyFields(schema)` o `validateQueryParams(schema)`
3. **Existencia de la entidad del path** — `validateProject`, `validateRequirement`, `validateObjective`
4. **Permiso sobre esa entidad** — `validateProjectPermissions`
5. **Reglas de negocio** — validadores locales del endpoint
6. **Handler**

> `opus-requirements-id-patch.ts:29-33` invierte 2 y 3 respecto de este orden. No lo tomes como
> modelo: validar el cuerpo antes de buscar la entidad evita una query para una request que ya
> era inválida.

## Los dos estilos de declaración del router

Ambos están en el código y son equivalentes:

```ts
router.get('/requirements', hasAnyRole(['user', 'admin']), getRequirements);   // directo

router                                                                         // encadenado
  .get('/clients', getAllClients);
```

Para código nuevo, usá el directo: es el mayoritario y el que hace grepeable la ruta.

> Tres archivos ponen el path en la línea siguiente al `router.patch(`, lo que hace que un grep
> de una línea no los encuentre. Evitalo: dejá el método y el path en la misma línea.

## Respuestas

Se responde con `res.status(...).json(...)` en el handler. No hay serializador ni capa de
presentación: el handler arma el objeto que sale.

| Situación | Status |
|---|---|
| Lectura correcta | 200 |
| Alta correcta | 201 |
| Edición correcta | 200, con `{ code, message }` cuando no hay recurso que devolver |
| Input inválido | 400 `invalid_fields` |
| Sin token o token inválido | 401 |
| Rol o permiso insuficiente | 403 `access_denied` |
| Entidad del path que no existe | 404 |
| Bus caído o timeout | 503 `service_unavailable` |

Ver [`error-handling`](./error-handling.md) para la forma del cuerpo de error.

## Middlewares compartidos

Los que están en `lib/utils/middlewares/` y `lib/utils/`:

| Middleware | Qué hace |
|---|---|
| `validate-token` | autentica; lo instala `app.ts` globalmente, no las rutas |
| `has-any-role` | 403 si ninguno de los roles del token está en la lista |
| `validate-project` | carga `req.project` desde `:projid`, o 404 |
| `validate-requirement` | carga `req.requirement` y `req.project` desde `:reqid`, o 404 |
| `validate-objective` | carga `req.objective` y `req.project` desde `:objid`, o 404 |
| `validate-project-permission` | 403 si el `external-user` no tiene permiso sobre `req.project` |
| `validate-week-not-past` | 400 si `body.weekStart` es de una semana anterior a la actual |
| `validate-body-fields(schema)` | valida `req.body` con Joi |
| `validate-query-params(schema)` | valida `req.query` con Joi |
| `parse-query-params()` | normaliza `sort`, `page`, `limit` y filtros en `req.parsedParams` |

> Un middleware que ya existe **no se reimplementa localmente**. Tres archivos definen su
> propio `validateProject` porque el proyecto viene en el **cuerpo** y no en el path
> (`requirements-post.ts:32`, `opus-requirements-post.ts:14`) — esa es la razón válida para
> duplicar, y está comentada en ambos.

## Paginación y ordenamiento

Dos mecanismos conviven:

- **`parseGetParams()`** — el compartido. Deja en `req.parsedParams`: `sort` como
  `[[campo, 'ASC'|'DESC']]` (prefijo `-` = descendente, default `-createdAt`), `page` (min 1) y
  `limit`. Lo usan `projects-get` y `objectives-get`.
- **Query params leídos a mano** en el handler, con `page`/`limit` del propio esquema Joi. Lo
  usan `requirements-get` y las rutas de reportes.

> Ojo con `parseLimit` (`lib/utils/parse-query-params.ts:41-43`): valida `limit <= 30` y, si no
> se cumple, devuelve **200**. El esquema Joi de `projects-get` declara `.max(30)`, así que un
> `limit` mayor se rechaza antes con 400. La combinación es confusa; si tocás paginación, no la
> replique.

## Reglas

- Un endpoint es un archivo en `lib/routes/`, exportado en el barrel. No modifiques `app.ts`
  para agregar rutas.
- El path en el archivo va sin el prefijo `/api`.
- Método y path en la misma línea del `router.{verb}(`.
- Respetá el orden de la cadena: rol → forma del input → entidad → permiso → negocio → handler.
- Reusá los middlewares de `lib/utils/middlewares/`. Duplicá solo con una razón, y comentala.
- Un middleware que corta la request **responde y no llama a `next()`**. Uno que sigue, llama a
  `next()` y no responde.
- Los datos que un middleware deja para el siguiente van en `req` (declarado en
  `lib/interfaces/index.ts`) o en `res.locals` para resultados intermedios del propio endpoint.
- No agregues un router de Express con su propio prefijo. El montaje bajo `/api` es uniforme.
- Toda mutación va por el bus, no por el modelo. Ver [`bus-commands`](./bus-commands.md).
- Todo endpoint nuevo lleva su archivo de test en `tests/routes/{mismo-nombre}.test.ts`.

## Integración con otras convenciones

- **validation**: los esquemas Joi que consumen `validateBodyFields` / `validateQueryParams`.
- **bus-commands**: cómo el handler publica una mutación en vez de escribir.
- **authorization**: las tres capas que atraviesan la cadena de middlewares.
- **error-handling**: la forma del cuerpo de error que devuelve cada `res.status()`.
- **testing**: un archivo de test por archivo de ruta.
