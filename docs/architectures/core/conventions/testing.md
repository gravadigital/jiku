---
id: testing
display_name: Testing (Mocha + base real, entrando por el despachador)
language: node
description: Mocha with should/sinon against an ephemeral PostgreSQL, dispatching commands through the real dispatcher
applies_to: [worker]
required_by: []
package: mocha
---

# Testing (core, Mocha)

> **Reemplaza** la convención `testing` del catálogo, que usa Vitest con Testcontainers. Este
> servicio usa Mocha con `should` y levanta el PostgreSQL con `docker` directamente. Lo más
> particular: los tests entran **por el despachador**, no por el `execute` de cada comando.

## Cuándo aplica

Todo el servicio. Un comando nuevo lleva sus tests en el mismo cambio.

## Paquete

```
mocha              # 11.7, runner
should             # 13.2, aserciones (estilo BDD)
sinon              # 21.0, dobles
nyc                # 17.1, cobertura
ts-node            # ejecuta TypeScript sin compilar
```

## Sobre base real, sin mocks de Sequelize

Es la decisión central: **no hay dobles de la base**. Los tests corren contra un PostgreSQL de
verdad, con el esquema real.

Es lo que verifica que un comando guarde exactamente lo que guardaba la api — el objetivo con el que
se escribió core. Un mock de Sequelize verificaría que se llamó a `create` con ciertos argumentos, no
que la fila quedó bien: no habría detectado que `estimatedFinishDate` necesita ser string, ni que
`omitNull: false` hace falta para vaciar un campo.

## Arranque

```json
// core/.mocharc.json
{
  "require": ["ts-node/register", "tests/setup-env.ts", "tests/global-setup.ts"],
  "timeout": 60000,
  "exit": true,
  "recursive": true
}
```

El orden importa y está documentado en el código:

1. **`tests/setup-env.ts`** — se carga **primero**, antes que cualquier test y antes que `src/`.
   `src/models/index.ts` construye el Sequelize **al importarse**, leyendo `process.env` en ese
   momento; por eso el contenedor tiene que estar listo acá y no en un `mochaGlobalSetup`, que corre
   después de que Mocha ya cargó los tests.
2. **`tests/global-setup.ts`** — crea el esquema con `sequelize.sync()` y hace
   `TRUNCATE ... RESTART IDENTITY CASCADE` sobre todas las tablas.

```ts
process.env.TZ = 'UTC';
process.env.NODE_ENV = 'testing';
```

`TZ=UTC` se fija ahí: sin eso, los tests de fechas dependerían de la máquina.

### La base

| Modo | Comportamiento |
|---|---|
| Local | Levanta `postgres:15.4-alpine3.18` con `docker run -P`, espera el puerto y lo escribe en `POSTGRESQL_PORT` |
| `CI=true` | **No levanta nada**: usa la base del pipeline (GitHub Actions la define como service) |
| `KEEP_DB=true` | Deja el contenedor vivo entre corridas |

El truncado al arrancar existe por `KEEP_DB`: los datos de una corrida anterior chocan con las
restricciones de unicidad de los fixtures (email y username de `users`).

## Los tests entran por el despachador

```ts
// core/tests/helpers/dispatch.ts
export function dispatch<T = unknown>(
  command: string,
  payload: unknown,
  caller = 'api'
): Promise<Reply<T>> {
  const subject = `${INSTANCE}.${caller}.${SERVICE_NAME}.${PROTOCOL_VERSION}.${command}`;
  return dispatcher.dispatch(subject, payload) as Promise<Reply<T>>;
}
```

```ts
const reply = await dispatch('clients.new', { name: 'Acme' });
```

**No se llama al `execute` de un comando directamente.** Entrar por el despachador significa que
cada test cubre también:

- la resolución del comando y la extracción de `params` del subject
- la validación Joi
- **la transacción**: que un `failure` no deje nada escrito
- el formato del `Reply`

Es la diferencia entre testear la lógica de un comando y testear el comando.

## Qué cubrir en un comando

Los 136 casos existentes dan la vara. Para un comando nuevo:

**Camino feliz**
- Crea/edita y devuelve el `id` o `success`
- Los defaults del contrato se aplican (`projects.test.ts:27`)
- Todos los campos se guardan cuando vienen (`projects.test.ts:47`)
- Las traducciones contrato ↔ base (`projects.test.ts:72`, `tasks.test.ts:73`, `times.test.ts:73`)

**Validación**
- Falla sin cada campo requerido
- Falla con un campo desconocido (`clients.test.ts:52`)
- Falla con un valor fuera de un enum
- Falla con un tipo equivocado

**Edición parcial**
- Edita solo los campos presentes
- **No vacía un campo ausente** (`projects.test.ts:184` — el bug de la api)
- Vacía con `null` explícito
- **Falla al mandar `null` en un campo obligatorio al crear**
- Acepta un payload vacío sin cambiar nada

**Referencias y reglas**
- Falla si la entidad del subject no existe
- Falla si una referencia del payload no existe
- Cada regla de negocio, con su código de error
- **Que un fallo no deje escritura parcial** (`tasks.test.ts:247` — "falla si una persona no existe
  y no toca la task")

**Efectos laterales**
- El historial de actividad se registra, y **no se registra cuando el valor no cambia**
  (`tasks.test.ts:202`)
- El líder queda asignado al primero de la lista

## Fixtures

Cada archivo crea lo suyo en un `before`, usando los modelos directamente. No hay factories ni
seeds compartidos: un test de `times` crea su persona, su proyecto y su tarea.

Es verboso pero deja cada archivo legible por separado, y evita que un cambio de fixture rompa un
archivo que no se estaba tocando.

## Correr

```sh
npm test                                       # todo
npx mocha tests/commands/clients.test.ts       # un archivo
npm run test:coverage                          # con nyc
```

## Reglas

- Un comando nuevo lleva sus tests en el mismo cambio.
- Los tests entran por `dispatch()`, **nunca** llamando a `execute` directamente.
- No mockees Sequelize ni la base. La base real es el punto.
- Un archivo de test por módulo de dominio, en `tests/commands/{módulo}.test.ts`.
- Los fixtures se crean en el `before` del propio archivo.
- Todo comando cubre: camino feliz, cada campo requerido faltante, un campo desconocido, y la
  entidad del subject inexistente.
- Todo comando de edición cubre la semántica parcial completa: ausente, con valor, `null`, y `null`
  en obligatorio.
- Toda regla de negocio tiene un test con su código de error.
- Si un comando puede fallar después de escribir, hay un test que verifica que **no quedó nada**.
- No dependas de la zona horaria local: `TZ=UTC` está fijado.
- No dejes datos entre archivos: el truncado es al arrancar la corrida, no entre tests.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: entrar por el despachador es lo que cubre la transacción.
- **[`orm`](./orm.md)**: por qué `sequelize.sync()` en tests y qué implica.
- **[`ci-github`](./ci-github.md)**: cómo provee la base el pipeline.
- **[`env-config`](./env-config.md)**: `CI`, `KEEP_DB` y `.env.test`.
