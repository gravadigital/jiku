---
id: commands
display_name: Comandos (validar y escribir)
language: node
description: The Command interface, segment-based registry, dispatcher-owned transaction and partial-edit semantics
applies_to: [worker]
required_by: []
package: null
---

# Comandos (core)

> **Convención nueva**, sin equivalente en el catálogo. Define la unidad de trabajo del servicio:
> un comando valida su payload y escribe, dentro de una transacción que **no controla**.

## Cuándo aplica

Todo el código de negocio del servicio. Core no hace otra cosa que atender comandos.

## La interfaz

```ts
// core/src/commands/types.ts
export interface Command<TPayload = any, TData = unknown> {
  /** Patrón del subject, con `{param}` para las partes variables: `clients.{id}.edit` */
  readonly pattern: string;

  /** Valida y normaliza el payload. Devuelve el error del protocolo si no es válido. */
  validate(payload: unknown): { value: TPayload } | { error: Reply<never> };

  /** Ejecuta la escritura. */
  execute(payload: TPayload, ctx: CommandContext): Promise<Reply<TData>>;
}

export interface CommandContext {
  caller: string;                      // el SERVICIO que publicó, del subject
  params: Record<string, string>;      // `clients.{id}.edit` deja { id: '7' }
  transaction: Transaction;            // abierta por el despachador
}
```

`validate` y `execute` están separados a propósito: el despachador valida **antes** de abrir la
transacción, así un payload inválido no consume una conexión del pool.

## La transacción es del despachador

```ts
// core/src/bus/dispatcher.ts
const transaction = await sequelize.transaction();
try {
  const reply = await command.execute(validated.value, { caller, params, transaction });

  if (reply.status === 'success') await transaction.commit();
  else await transaction.rollback();

  return reply;
} catch (error: any) {
  await transaction.rollback();
  logger.error(`[dispatch] ${name}: ${error.message}`);
  return failure(ErrorCode.INTERNAL_ERROR, 'Internal error');
}
```

**Esta es la regla más importante del servicio.** El comando recibe la transacción pero **no tiene
acceso a `commit` ni `rollback`**. Consecuencias:

- Un comando que responde `failure` con tres filas ya insertadas las pierde todas, sin hacer nada.
  Por eso una validación tardía es segura: `requirements-new.ts:116-121` valida los adjuntos
  **después** de crear el requisito y responde `invalid_attachment_id`; el requisito no queda.
- No se puede dejar una escritura a medias por olvidarse un rollback en una rama de error. No es
  disciplina, es que no hay API para hacerlo mal.
- **Toda escritura tiene que pasar `{ transaction: ctx.transaction }`.** Una que se olvide corre
  fuera de la transacción y sobrevive al rollback. Es el error más fácil de cometer y el más difícil
  de ver.

## El registro

```ts
// core/src/commands/index.ts
export const registry = new CommandRegistry().registerAll([
  clientsNew, clientsEdit, projectsNew, projectsEdit, /* ... */
]);
```

Un solo lugar. Agregar un comando es sumarlo a esa lista; si no está, el despachador responde
`unknown_command`.

### El matching es por segmentos, no por regex

```ts
// core/src/commands/registry.ts
resolve(name: string): { command: Command<any, any>; params: Record<string, string> } | null
```

`clients.{id}.edit` se guarda como `['clients', '{id}', 'edit']` y se compara segmento a segmento
contra el nombre recibido. Un segmento entre llaves captura; el resto tiene que coincidir literal.

**Por qué no regex:** los ids del protocolo pueden ser números (`clients.7.edit`) o strings de
Zitadel (`requirements.3.subscriptors.<zitadel-user-id>.delete`), y un `.` dentro de un valor
rompería una regex ingenua. Comparar por segmentos no tiene ese problema.

**Consecuencia:** un patrón solo matchea si tiene **la misma cantidad de segmentos**. Dos comandos
con la misma forma y distinta longitud no compiten.

## Anatomía de un archivo de comando

```ts
// core/src/commands/clients/clients-new.ts
import joi from 'joi';
import { Client } from '@jiku/models';
import { Reply, success } from '@jiku/nats-protocol';
import { Command, CommandContext } from '../types';
import { validateWith } from '../validate';

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

  async execute(payload, ctx: CommandContext): Promise<Reply<{ id: number }>> {
    const client = await Client.create(
      { name: payload.name, description: payload.description },
      { transaction: ctx.transaction }
    );
    return success({ id: client.id });
  },
};

export default clientsNew;
```

Cinco partes, siempre en este orden: imports → interfaz del payload → esquema Joi → el objeto
`Command` → `export default`.

## Orden dentro de `execute`

El orden importa y es consistente en los 20 comandos:

1. **Buscar la entidad del `params`** y responder `*_not_found` si no está.
2. **Validar las referencias del payload** (proyecto, personas, requisito) y responder su código.
3. **Validar las reglas de negocio** (tope diario, conclusión de incidencia).
4. **Calcular lo que necesita el estado anterior** — el historial de actividad se computa acá,
   *antes* de escribir, porque después el valor previo ya no existe (`tasks-edit.ts:103`).
5. **Escribir**, siempre con `{ transaction: ctx.transaction }`.
6. `success()` o `success({ id })`.

## Qué devuelve

```ts
success({ id: client.id })   // creaciones: SOLO el id
success()                    // ediciones y borrados: nada
```

Las creaciones devuelven **solo el `id`**. El contrato con los frontends es el recurso completo con
sus relaciones, y de eso se encarga la api releyendo la base. No agregues campos a la respuesta de
un comando: mueve el contrato a dos lugares.

## Edición parcial

La semántica está definida en el protocolo y implementada en un helper:

| El payload trae | Efecto |
|---|---|
| el campo ausente | no se toca |
| el campo con valor | se reemplaza |
| el campo en `null` | se vacía |
| el campo en `null`, siendo obligatorio al crear | **falla** |

```ts
// core/src/commands/validate.ts
export function pickPresent<T extends object>(payload: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) out[key] = payload[key];
  }
  return out;
}
```

`pickPresent` devuelve **solo las claves presentes**, así un `undefined` nunca llega a Sequelize
como "poner en null". La distinción ausente/`null` es del `hasOwnProperty`, no del valor.

Quién declara qué acepta `null` es el esquema Joi: `.allow(null)` en los campos que se pueden
vaciar, y nada en los que son obligatorios al crear.

```ts
const changes = pickPresent(payload, ['name', 'description']);
if (Object.keys(changes).length > 0) {
  await client.update(changes, { transaction: ctx.transaction });
}
```

El `if` no es cosmético: un payload vacío es válido y no tiene que disparar un `UPDATE`.

## Un comando sin payload

Los borrados no llevan cuerpo — el id viene en el subject:

```ts
validate(payload: unknown) {
  return validateWith<Record<string, never>>(
    joi.object({}).unknown(false).default({}),
    payload ?? {}
  );
}
```

`unknown(false)` rechaza cualquier campo: mandar datos a un borrado es un error del cliente, no
algo a ignorar.

## Reemplazo total de listas

Cuando un payload trae una lista (`responsiblePersonIds`, `attachmentIds`), es el **conjunto
completo que debe quedar**, no un agregado. Dos patrones en el codebase:

- **`tasks`** borra los que no vienen y hace `upsert` de los que sí, **preservando la fila y su
  `createdAt`** (`tasks-edit.ts:151-166`).
- **`requirements`** borra todas y recrea (`requirements-edit.ts:158-174`), perdiendo el
  `createdAt` de las que se mantienen.

La asimetría **no está justificada en el código**. Para un comando nuevo, seguí el patrón de
`tasks`: preservar la fila es información que no cuesta nada conservar.

**El orden de la lista es información:** el primero queda líder (`isLeader`).

## Lo que un comando NO hace

- **No decide si un rol habilita un método.** Eso es de la **compuerta** del despachador
  (`authorize-caller.ts`, S-030): *"¿tu rol habilita este método?"*. El comando decide otra
  pregunta: *"¿podés hacer esto con estos datos?"*.

  > **Esta línea afirmaba que decidir sobre permisos y roles era de la api, «que es quien conoce
  > al usuario final», y S-031 la derogó.** La premisa era cierta hasta S-029: el `sub` del subject es
  > el service user de la api (ADR-007), así que core no conocía a la persona. **Con el sobre de
  > identidad la conoce**, y desde S-031 los comandos de tiempos aplican reglas que dependen de
  > quién actúa: la ventana de carga (C-40), quién imputa horas a otra persona (C-41) y la
  > titularidad del registro al borrar. Un comando que necesite decidir sobre el actor usa
  > `resolveActor(ctx, ...)` y `ctx.roles` —los roles que el despachador ya resolvió, sin una
  > consulta nueva—, **nunca** una escalera de identidad propia ni un `SELECT` sobre `users`.
  >
  > **Sin actor no se evalúan las reglas derivadas del actor.** `resolveActor` devuelve `undefined`
  > en el canal exento (el publicador de confianza sin sobre) y ahí `ctx.roles` es `[]`: es la misma
  > decisión que S-030 tomó para la clase `connector`, *"el caller autoriza por su cuenta"*.
- **No abre ni cierra transacciones.**
- **No lanza.** Un error esperado es un `Reply` de falla; uno inesperado lo captura el despachador.
- **No lee `process.env`.** Las constantes de negocio son constantes de módulo.
- **No loguea el flujo normal.** El despachador ya traza con `LOG_COMMANDS`.
- **No notifica.** Las notificaciones se eliminaron del producto
  (`requirements-comment.ts:40`).

## Reglas

- Un comando nuevo son tres pasos: el archivo, el registro en `commands/index.ts`, y sus tests.
- El `pattern` coincide con el subject de `docs/apis/core.yaml`. Ante discrepancia, manda el
  documento.
- **Toda escritura pasa `{ transaction: ctx.transaction }`.** Sin excepción.
- Un comando nunca llama a `commit` ni `rollback`.
- `validate` no toca la base: solo forma. Lo que necesita una consulta va en `execute`.
- El historial que necesita el valor anterior se calcula **antes** de escribir.
- Las creaciones devuelven solo `{ id }`. Las ediciones y borrados, nada.
- La edición parcial usa `pickPresent`; no armes el objeto de cambios a mano.
- Un `update` solo se dispara si hay cambios (`Object.keys(changes).length > 0`).
- Una lista en el payload es el conjunto completo. Documentalo en el contrato si es nueva.
- No agregues capa de repositorio ni de servicio: el comando es la unidad completa.

## Integración con otras convenciones

- **[`bus-consumer`](./bus-consumer.md)**: quién invoca al despachador y cómo se responde.
- **[`validation`](./validation.md)**: los esquemas Joi y `validateWith`.
- **[`error-handling`](./error-handling.md)**: qué código devolver en cada situación.
- **[`contract-translation`](./contract-translation.md)**: los nombres que difieren entre el bus y
  la base.
- **[`orm`](./orm.md)**: los modelos y por qué no hay repositorio.
