---
id: validation
display_name: Validación de payloads (Joi, un esquema por comando)
language: node
description: Joi schema per command, declared in the command file, validated before the transaction opens
applies_to: [worker]
required_by: []
package: joi
---

# Validación (core, Joi)

> **Reemplaza** la convención `validation` del catálogo, que usa Zod con esquemas por endpoint y
> tipos inferidos. Este servicio usa Joi con un esquema por comando, declarado en el mismo archivo,
> y la interfaz del payload escrita a mano.

## Cuándo aplica

Todo comando. `validate` es parte de la interfaz `Command`: no hay comando sin esquema.

## Paquete

```
joi                # 18.0
```

## El helper

```ts
// core/src/commands/validate.ts
export function validateWith<T>(
  schema: joi.Schema,
  payload: unknown
): { value: T } | { error: Reply<never> } {
  const result = schema.validate(payload, { convert: true, abortEarly: true });

  if (result.error) {
    return { error: failure(ErrorCode.INVALID_FIELDS, result.error.message) };
  }
  return { value: result.value as T };
}
```

- **`convert: true`** deja que Joi normalice tipos: la fecha que llega como string queda como
  `Date`, el número como string queda como número. Es lo que hacía `validate-body-fields` en la api,
  y los comandos lo asumen.
- **`abortEarly: true`**: se responde el primer error. El consumidor es la api, no un formulario;
  no hace falta la lista completa.
- **El mensaje de Joi va tal cual al `errorMessage`**, y ese texto **llega al usuario final** a
  través de la api. Por eso los `.messages()` personalizados importarían: hoy no se usan y el
  usuario ve el texto por defecto de Joi, en inglés.

## Un esquema por comando, en el mismo archivo

```ts
// core/src/commands/clients/clients-new.ts
export interface ClientsNewPayload {
  name: string;
  description?: string;
}

const schema = joi.object({
  name: joi.string().required(),
  description: joi.string().optional().allow(''),
});

export const clientsNew: Command<ClientsNewPayload, { id: number }> = {
  pattern: 'clients.new',
  validate(payload: unknown) {
    return validateWith<ClientsNewPayload>(schema, payload);
  },
  ...
};
```

La interfaz del payload se escribe **a mano** y no se infiere del esquema. Es duplicación
deliberada: la interfaz documenta el contrato y el esquema lo hace cumplir. Cuando cambia uno hay
que cambiar el otro, y el compilador ayuda solo a medias — por eso los tests cubren los casos de
validación.

## `validate` no toca la base

Se ejecuta **antes** de abrir la transacción (`dispatcher.ts:37-42`), así que un payload inválido no
consume una conexión del pool. Todo lo que necesite una consulta —que el proyecto exista, que la
persona exista— va en `execute`, no en el esquema.

## Los campos por defecto

```ts
status: joi.string().valid('analisis', 'activo', 'inactivo', 'finalizado', 'cancelado')
  .default('analisis'),
initDate: joi.date().default(() => new Date()),
```

Los defaults del contrato se declaran en el esquema, no en el `execute`. Así el valor efectivo es
visible en un solo lugar y coincide con lo documentado en `docs/apis/core.yaml`.

**Ojo con la asimetría new/edit**: el esquema de creación lleva `.default()`, el de edición **no**.
En una edición, un campo ausente se deja como estaba; un default lo sobrescribiría.

## Qué acepta `null` y qué no

La regla del protocolo se expresa en el esquema:

```ts
// core/src/commands/clients/clients-edit.ts
const schema = joi.object({
  name: joi.string().optional(),                      // NO acepta null: obligatorio al crear
  description: joi.string().optional().allow('', null),  // sí: vaciarlo es válido
});
```

| Situación | Cómo se declara |
|---|---|
| Campo obligatorio al crear | `.required()` en el new; **sin `.allow(null)`** en el edit |
| Campo que se puede vaciar | `.allow(null)` — y `.allow('')` si el vacío es un string válido |
| Campo opcional que no se vacía | `.optional()` a secas |

## Enums

Se derivan del modelo cuando existen ahí:

```ts
type: joi.string().valid(...Object.values(RequirementType)).allow(null).optional(),
```

Y se escriben literales cuando la columna no es un enum de la base:

```ts
state: joi.string().valid('backlog', 'activo', 'finalizado', 'cancelado', 'en_revision')
  .default('backlog'),
```

**Preferí derivar del modelo.** Un enum literal se desincroniza en silencio cuando la base cambia;
uno derivado rompe la compilación.

## Restricciones entre campos

```ts
// core/src/commands/times/worked-times.ts
}).oxor('taskId', 'requirementId');
```

`oxor` = "uno u otro, o ninguno". Las reglas que relacionan **campos del payload entre sí** van en
el esquema; las que dependen del **estado de la base** van en `execute`.

## Coerción cuando la columna no coincide con el tipo

```ts
// core/src/commands/tasks/tasks-new.ts
estimatedFinishDate: joi.date().allow(null).optional().custom((value) =>
  value instanceof Date ? value.toISOString().split('T')[0] : value
),
```

La columna es STRING (`YYYY-MM-DD`), no DATE. Sin el `.custom()`, `convert: true` dejaría un objeto
`Date` que Sequelize rechaza. Aceptar una fecha y guardarla como string es lo que espera el contrato.

Cuando la columna es string y el contrato también, se valida con patrón y no con `joi.date()`:

```ts
date: joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
```

## Comandos sin payload

```ts
validateWith<Record<string, never>>(
  joi.object({}).unknown(false).default({}),
  payload ?? {}
);
```

`unknown(false)` rechaza cualquier campo. Mandar datos a un borrado es un error del cliente, no algo
a ignorar en silencio.

## Campos desconocidos

Joi los rechaza por defecto (`joi.object()` sin `.unknown()`), y eso se mantiene: un campo que la api
manda de más es una discrepancia de contrato y tiene que verse. Hay un test que lo cubre
(`tests/commands/clients.test.ts:52`).

## Reglas

- Todo comando tiene esquema. No hay `validate` que devuelva el payload sin validar.
- El esquema vive en el archivo del comando, como `const schema`, arriba del objeto `Command`.
- La interfaz `{Comando}Payload` se escribe a mano y se mantiene en sincronía con el esquema.
- `validate` **no consulta la base**. Lo que necesita una query va en `execute`.
- Los defaults del contrato van en el esquema del comando de creación, nunca en el de edición.
- Un campo obligatorio al crear **no lleva `.allow(null)`** en el esquema de edición.
- Los enums se derivan del modelo (`Object.values(...)`) siempre que existan ahí.
- Las reglas entre campos del payload van en el esquema (`oxor`, `and`, `with`); las que dependen
  de la base, en `execute`.
- No agregues `.unknown(true)`: un campo de más es una discrepancia de contrato.
- El esquema tiene que coincidir con `docs/apis/core.yaml`. Ante discrepancia, manda el documento.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: `validate` es parte de la interfaz `Command`; corre antes de la
  transacción.
- **[`error-handling`](./error-handling.md)**: un fallo de validación es siempre `invalid_fields`.
- **[`contract-translation`](./contract-translation.md)**: el esquema valida el nombre del
  **contrato**, no el de la columna.
