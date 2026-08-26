---
id: validation
display_name: Validación de inputs (Joi, inline en la ruta)
language: node
description: Input validation with Joi schemas declared inline in each route file
applies_to: [api]
required_by: []
package: joi
---

# Validación de inputs (api, Joi)

> **Reemplaza** la convención `validation` del catálogo, que usa Zod con un `*.schema.ts` por
> módulo de dominio y tipos inferidos. Este servicio usa Joi con el esquema **declarado en el
> mismo archivo de ruta** que lo usa, coherente con la decisión de un archivo por endpoint.

## Cuándo aplica

Todo endpoint que reciba cuerpo o query params. Los path params no se validan con Joi: los
valida el middleware que carga la entidad, respondiendo 404.

## Paquete

```
joi                    # 18.0
```

## Los dos middlewares

```ts
validateBodyFields(schema)    // valida req.body
validateQueryParams(schema)   // valida req.query
```

Ambos responden 400 con el **primer** error, y no siguen:

```ts
// lib/utils/validate-body-fields.ts:6-14
const { error } = validationSchema.validate(req.body);
if (error) {
  const firstError = error.details[0].message;
  return res.status(400).json({
    code: 'invalid_fields',
    message: `Invalid field - ${firstError}`,
  });
}
return next();
```

> Se devuelve **un** error, no la lista. Es el contrato que los fronts ya manejan; no lo cambies
> a un array sin coordinar con `web` y `opus-web`.

## Cómo se declara

Dos formas, ambas presentes:

```ts
// Constante nombrada, arriba del archivo — preferida cuando el esquema es largo
const createSchema = joi.object({
  title: joi.string().required(),
  projectId: joi.number().integer().required(),
});

router.post('/requirements', validateBodyFields(createSchema), createRequirement);
```

```ts
// Inline en la cadena — aceptable cuando son dos o tres campos
router.post('/clients',
  validateBodyFields(joi.object({
    name: joi.string().required(),
    description: joi.string().optional().allow(''),
  })),
  createClient
);
```

## Los enums salen de los modelos

**Nunca repitas a mano los valores de un enum.** Se derivan del modelo compartido, así que un
valor nuevo en la base aparece solo en la validación:

```ts
// lib/routes/requirements-post.ts:14-18
import { RequirementState, RequirementType } from '@jiku/models';

type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
state: joi.string().valid(...Object.values(RequirementState)).optional(),
```

> Hay excepciones en el código que sí listan los valores a mano
> (`objectives-post.ts:80-81`, `requirements-id-patch.ts:15-16`). Son deuda: si tocás uno de
> esos esquemas, pasalo a `Object.values(...)`.

## Patrones habituales

| Necesidad | Joi |
|---|---|
| Opcional que acepta vacío | `joi.string().optional().allow('')` |
| Opcional que acepta `null` | `joi.string().allow(null).optional()` |
| Mutuamente excluyentes | `.oxor('objectiveId', 'requirementId')` |
| URL o vacío | `joi.string().uri().allow(null, '')` |
| Array de ids | `joi.array().items(joi.number().integer().positive())` |
| Ids de usuario | `joi.string()` — son `sub` de Zitadel, no numéricos |
| Claves extra permitidas | `.unknown(true)` |
| Default | `joi.string().valid('public', 'internal').default('internal')` |

`oxor` expresa "vino A **o** vino B, no los dos".

> **El ejemplo vivo que había acá ya no existe.** Era `oxor('objectiveId','requirementId')` en
> `worked-times-post.ts:19`, la exclusión tarea/requisito. **REQ-007 (S-031) lo eliminó**: la regla
> tenía dos definiciones —una en la api y otra en `core`— y dos definiciones de la misma regla es
> lo que las deja divergir en silencio. Hoy vive **solo** en `core/src/commands/times/worked-times.ts`,
> y sigue respondiendo `invalid_fields` → 400, así que el contrato con los frontends no cambió.
> `oxor` se sigue documentando porque el patrón sirve; el ejemplo queda como **histórico**.

## Qué no valida Joi

- **Los path params.** Los valida el middleware que carga la entidad, con 404.
- **Las reglas que necesitan la base o el calendario, *y que son de la api*.** Van como middleware
  local después de la validación de forma. Ejemplos vigentes: el deadline de 10 días desde
  `created_at` para borrar una ausencia (`deadline_exceeded`, un código que el protocolo del bus no
  tiene), que no se modifiquen semanas pasadas, que una incidencia no se resuelva sin conclusión.
  **Los ejemplos que estaban acá —la ventana de 10 días para cargar horas y que solo `admin` impute
  a terceros— se mudaron a `core` con REQ-007 (S-031)** y ya no son ciertos de este servicio.
- **El multipart de adjuntos.** `POST /api/attachments` valida a mano dentro del handler
  (`entityType` contra el enum, extensión y MIME contra listas blancas), porque los campos llegan
  después de multer. Ver [`storage`](./storage.md).

## Reglas

- Todo endpoint con cuerpo lleva `validateBodyFields`. Todo endpoint con query params
  significativos, `validateQueryParams`.
- La validación de forma va **antes** de buscar entidades en la base: no gastes una query en una
  request inválida.
- Los valores de enum se derivan con `...Object.values(EnumDelModelo)`, no se listan a mano.
- El esquema vive en el mismo archivo que la ruta. No lo muevas a un módulo compartido, salvo que
  dos rutas usen literalmente el mismo.
- Esquema largo → constante nombrada arriba del archivo. Corto → inline en la cadena.
- No cambies el contrato de error: `400` con `{ code: 'invalid_fields', message: 'Invalid field - ...' }`.
- Los ids de usuario son `joi.string()`; los de entidad, `joi.number().integer()`.
- Una regla que necesita la base, el rol o la fecha de hoy no es Joi. **Pero antes de escribirla
  como middleware local, preguntate de quién es la regla:** si decide si la operación puede ocurrir
  sobre estos datos y tiene que dar el mismo resultado por HTTP y por el bus, **es del escritor y va
  a `core`**, dentro del comando (con el sobre de S-029 `core` tiene el actor y sus roles). Solo si
  es del transporte HTTP —la forma del input, el 404 de la entidad del path, un código que el
  protocolo del bus no tiene— se queda acá como middleware local.

## Integración con otras convenciones

- **http-server**: los middlewares de validación son el paso 2 de la cadena.
- **error-handling**: el 400 `invalid_fields` es parte del contrato de errores.
- **orm**: los enums salen de los modelos de `@jiku/models`.
- **bus-commands**: lo que pasa la validación se traduce al payload del comando.
