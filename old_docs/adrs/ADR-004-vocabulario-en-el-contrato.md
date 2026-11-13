# ADR-004: El vocabulario del producto vive en el contrato del bus, no en el esquema

**Estado:** Aceptado (implementado, migración a medio camino)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** modelado, vocabulario, contrato, deuda-tecnica
**Detectado desde:** `core`, `api`

---

## Contexto

El producto y su base de datos llaman a las cosas de manera distinta, por razones históricas:

| Producto / UI | Base de datos |
|---|---|
| Actor | `clients` |
| Tarea | `objectives` |
| Etapa | `stages` (ya eliminada) |

Renombrar una tabla en producción no es gratis: hay que migrar el esquema, actualizar los modelos,
tocar todas las consultas, y coordinarlo con un despliegue en el que los dos frontends siguen
hablando el vocabulario viejo. Para `objectives` eso significa además `objective_id` en cinco
tablas relacionadas, dos enums de tipo de actividad, y los índices correspondientes.

La pregunta era: ¿se paga esa migración, se acepta la divergencia para siempre, o hay un tercer
camino?

## Decisión

**El nombre nuevo es del contrato, no del almacenamiento.** El criterio está declarado
explícitamente en el código (`core/src/commands/projects/properties.ts:15-17`): *"la base no se
toca: el nombre nuevo es del contrato, no del almacenamiento"*.

El bus adopta el vocabulario del producto, y **core traduce** al escribir:

| Contrato / bus | Base de datos | Dónde traduce |
|---|---|---|
| `task`, `taskId` | `objectives`, `objective_id` | en cada comando |
| `properties: [{code, value}]` | `key_value_pairs: {code: value}` | `projects/properties.ts:51` |
| `priority: 'alta'` (enum) | `priority: 3` (integer) | `tasks/priority.ts:43` |
| `responsiblePersonIds` | `personIds` | en cada comando |

La api traduce en el otro sentido para no romper el contrato HTTP, que sigue usando el vocabulario
viejo (`objectives`, `keyValuePairs`, `priority` numérica).

El resultado es que **el bus ya habla el vocabulario nuevo mientras la base y HTTP siguen en el
viejo**: la migración está a medio camino, con la dirección decidida.

### El escape transitorio de `priority`

Documentado en el código y en el contrato. La columna `objectives.priority` acepta 0-5 y el enum
del bus tiene 5 valores, así que la traducción ida y vuelta **colapsaría el 5 en 4**.

La api manda el número original en `priorityValue` y core lo usa tal cual, ignorando `priority`
(`tasks/priority.ts:43-48`). **Desaparece cuando la web hable en nombres de prioridad.**

`requirements.priority` sí es un enum en la base: esa tabla ya migró. La traducción es solo para
tasks.

## Implementation Rules

- Un comando nuevo **DEBE** usar el vocabulario del producto en su contrato (`task`, no
  `objective`). La traducción a nombres de tabla vive **dentro** del comando.
- **NO SE DEBE** renombrar una tabla ni una columna existente para alinearla con el contrato. La
  base se cambia solo cuando hay una razón propia, no por vocabulario.
- Toda traducción contrato ↔ base **DEBE** vivir en `core`, en el comando o en un helper del
  módulo. **NO DEBE** filtrarse a `@jiku/models`, que describe la base tal como es.
- El contrato HTTP de la api **NO DEBE** cambiar de vocabulario sin coordinarlo con los dos
  frontends: es el contrato público del producto.
- `priorityValue` es un escape transitorio: **NO SE DEBE** replicar el patrón de mandar un campo
  paralelo para esquivar una traducción con pérdida. Cuando la web mande nombres de prioridad,
  el campo se elimina.
- Al agregar un valor a un enum del bus, **DEBE** verificarse que la traducción a la base sea
  biyectiva. Si no lo es, la traducción es el problema, no el enum.

## Consecuencias

### Positivas

- **El producto pudo renombrar conceptos sin migrar producción.** El costo del renombre pasó de
  una migración coordinada a una función de traducción.
- **La base sigue siendo la que los datos históricos describen.** No hay que interpretar qué
  significaba `objectives` antes de un renombre.
- **Las traducciones están concentradas en core** y son testeables como cualquier otra función.
- **La dirección del cambio quedó declarada**: el bus ya dice `task`, así que cuando se complete
  la migración el contrato no cambia, solo desaparece la traducción.

### Negativas

- **Tres vocabularios conviviendo.** UI dice "Tarea", HTTP y la base dicen `objective`, el bus
  dice `task`. Alguien que lea los tres se confunde, y todos los documentos del producto tienen
  que aclarar la equivalencia.
- **Cada comando paga la traducción**, en código y en carga cognitiva al leerlo.
- **La migración a medio camino es un estado, no una transición.** No hay fecha ni condición de
  finalización declarada: puede quedarse así indefinidamente.
- **`priorityValue` es una fuga del modelo**: un campo que existe solo porque la traducción tiene
  pérdida, y que la web tiene que mandar sabiendo por qué.

### Riesgos

- **Riesgo:** aparece un tercer vocabulario cuando alguien renombre algo en la UI sin tocar el bus.
  - **Mitigación:** la tabla de vocabulario en [`docs/prd/goals-and-context.md`](../prd/goals-and-context.md)
    es el registro. Debe actualizarse con cada renombre.
- **Riesgo:** una traducción con pérdida pasa desapercibida y corrompe datos, como casi ocurre con
  `priority`.
  - **Mitigación:** la regla de biyectividad al agregar valores de enum. Hoy no hay test que la
    verifique.
- **Riesgo:** los restos de `stages` (que `web` sigue enviando y la api reenvía) sugieren que un
  concepto eliminado puede sobrevivir años en el contrato.
  - **Mitigación:** registrado en el feature group **FG-6**.

## Alternativas Consideradas

### Alternativa 1: Migrar la base al vocabulario del producto

**Pros:**
- Un solo vocabulario en todas las capas
- Sin traducciones que mantener

**Cons:**
- Migración grande y coordinada: `objectives` arrastra `objective_id` en cinco tablas, dos enums
  de actividad y sus índices
- Requiere desplegar los dos frontends en simultáneo con la base
- Las 95 migraciones existentes ya asumen los nombres actuales

**Por qué se descartó:** el costo era alto y el beneficio, cosmético. **Sigue siendo la opción
correcta a largo plazo** y está registrada como pregunta abierta 12 y en FG-6.

---

### Alternativa 2: Aceptar la divergencia y no traducir

**Pros:**
- Cero código de traducción
- El contrato refleja exactamente el almacenamiento

**Cons:**
- El vocabulario del producto nunca llega al contrato: quien lee `docs/apis/core.yaml` ve
  `objectives` y tiene que saber que se llaman tareas
- La deuda de vocabulario se congela

**Por qué se descartó:** el objetivo era que el contrato hablara el idioma del producto, no el del
almacenamiento.

---

### Alternativa 3: Vistas de PostgreSQL con los nombres nuevos

**Pros:**
- La traducción la haría la base, sin código
- Las consultas usarían el vocabulario nuevo

**Cons:**
- Las vistas escribibles necesitan reglas o triggers para `INSERT`/`UPDATE`
- Sequelize tendría que mapear modelos a vistas, con casos raros en las relaciones
- La traducción de `priority` (entero ↔ enum) no es expresable como vista sin una función

**Por qué se descartó:** mueve la complejidad a una capa más difícil de testear y de versionar que
el código de core.

## Referencias

- Contrato: [`docs/apis/core.yaml`](../apis/core.yaml)
- Esquema: [`docs/db-schemas/jiku.md`](../db-schemas/jiku.md)
- Vocabulario del producto: [`docs/prd/goals-and-context.md`](../prd/goals-and-context.md)
- Feature group que lo revisa: **FG-6** en [`docs/prd/feature-groups.md`](../prd/feature-groups.md)
- ADRs relacionados: [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-005](ADR-005-modelos-compartidos.md)
