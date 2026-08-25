---
id: contract-translation
display_name: Traducción contrato ↔ base de datos
language: node
description: Where the bus contract and the database schema disagree on names, and who translates
applies_to: [worker]
required_by: []
package: null
---

# Traducción contrato ↔ base (core)

> **Convención nueva**, sin equivalente en el catálogo. Core es donde el vocabulario nuevo del
> producto se separa del de la base, sin migrar el esquema. Existe porque las traducciones están
> repartidas entre varios comandos y **olvidarse una escribe en la columna equivocada o falla en
> silencio**.

## Cuándo aplica

Cualquier comando que toque uno de los cuatro conceptos de abajo, **y cualquier ficha de consulta que
toque uno de los seis de la sección "Las traducciones de solo lectura"**. Y al agregar un campo
nuevo: la decisión de si el nombre del contrato coincide con el de la columna se toma una vez, acá.

> **Dos familias, y conviene no mezclarlas.** Las traducciones de ESCRITURA viven en un comando o en
> un helper de su módulo, y las reglas de esta convención que hablan de `pickPresent` y de la edición
> parcial son de ellas. Las de LECTURA viven en la **ficha** del recurso (`ResourceSpec`), que es un
> dato declarativo sin edición parcial: ahí la traducción es un `transform` de salida o un mapa
> `values` de entrada. Lo que aplica a las dos —y es lo único que hay que recordar si uno se olvida
> de todo lo demás— es que **la traducción vive en `core` y NO se filtra a `@jiku/models`**.

## El criterio

Declarado en el código, y es la regla que resuelve las dudas:

> *"La traducción vive acá porque la base no se toca: el nombre nuevo es del contrato, no del
> almacenamiento."* — `commands/projects/properties.ts:15-17`

El contrato del bus usa el vocabulario del **producto**. La base usa el que tiene. Renombrar 28
tablas y sus foreign keys no es una opción, así que core traduce en el borde.

## Las cuatro traducciones

| Contrato / bus | Base de datos | Dónde traduce |
|---|---|---|
| `task`, `taskId` | `objectives`, `objective_id` | en cada comando de `tasks` y `times` |
| `properties: [{code, value}]` | `key_value_pairs: {code: value}` | `projects/properties.ts:51` |
| `priority: 'alta'` (enum) | `priority: 3` (integer) | `tasks/priority.ts:43` |
| `responsiblePersonIds` | `personIds` | en cada comando de `tasks` y `requirements` |

### task ↔ objective

La más extendida y la más simple: no hay helper, cada comando lo hace al armar el objeto.

```ts
// core/src/commands/times/worked-times.ts
const workedTime = await WorkedTime.create({
  objectiveId: payload.taskId || null,     // taskId (bus) -> objective_id (base)
  ...
});
```

El modelo Sequelize es `Objective`; el payload dice `taskId`. **No renombres el modelo**: lo comparte
`api` a través de `@jiku/models`.

### properties ↔ keyValuePairs

El contrato define una lista de pares; la columna guarda un objeto plano.

```ts
// core/src/commands/projects/properties.ts
export function propertiesToKeyValuePairs(
  properties: Property[] | undefined
): Record<string, string | null> | undefined {
  if (properties === undefined) return undefined;      // ausente != vacío
  const out: Record<string, string | null> = {};
  for (const { code, value } of properties) out[code] = value ?? null;
  return out;
}
```

El `return undefined` cuando el campo está ausente es lo que hace que `pickPresent` funcione: sin
él, no mandar `properties` vaciaría la columna.

Como el nombre difiere, el edit no puede usar `pickPresent` para este campo y lo agrega a mano:

```ts
// core/src/commands/projects/projects-edit.ts:71-74
if (Object.prototype.hasOwnProperty.call(payload, 'properties')) {
  changes.keyValuePairs = propertiesToKeyValuePairs(payload.properties);
}
```

Los `code` admitidos salen de `DefaultKeyValuePairs` en `@jiku/models`, y los tres primeros se
validan como URI; `mattermost_group_name` es texto libre.

### priority: enum ↔ entero

`objectives.priority` es `INTEGER NOT NULL` y el contrato define nombres:

```ts
// core/src/commands/tasks/priority.ts
sin_prioridad = 0, baja = 1, media = 2, alta = 3, urgente = 4
```

**No confundir con `requirements.priority`, que SÍ es un enum en la base**: esa tabla ya migró
(`20260529_03_requirement_priority_enum.js`). La traducción es **solo para tasks**.

#### El escape transitorio: `priorityValue`

```ts
export function resolvePriority(
  name: TaskPriority | undefined,
  raw: number | undefined
): number | undefined {
  return raw !== undefined ? raw : priorityToNumber(name);
}
```

La api aceptaba 0-5 y el enum tiene 5 valores, así que el ida-y-vuelta colapsaría el 5 en 4. La api
manda el número original en `priorityValue` y core lo usa tal cual, **ignorando `priority`**.

Al leer, el 5 se interpreta como `urgente` (`FROM_NUMBER[5]`), así que ningún dato existente queda
sin traducción.

**Es deuda con fecha de vencimiento declarada:** desaparece cuando la web hable en nombres de
prioridad. No construyas nada nuevo sobre `priorityValue`.

### responsiblePersonIds ↔ personIds

Solo cambia el nombre del campo del payload; las tablas intermedias (`person_objectives`,
`person_requirements`) usan `personId`. El **orden de la lista es información**: el primero queda
`isLeader`.

## Las traducciones de SOLO LECTURA

Existen desde REQ-006 y viven en las **fichas** de `src/queries/`, no en comandos. Ninguna es nueva
al escribir: son campos que la base ya tenía con otro nombre y que el contrato de consultas publica
con el del producto.

| Contrato | Base | Dónde | Forma |
|---|---|---|---|
| `body` | `new_value` | ficha de `comments` | `BaseFieldSpec.column` |
| `authorId` | `changed_by` | ficha de `comments` | `BaseFieldSpec.column` |
| `taskId` | `objective_id` | fichas de `comments` / `activity` / `subscriptions`, por variante | columna de la variante |
| `task_comment` ↔ `objective_comment` | `attachments.entity_type` | `queries/entity-type.ts` | mapa, en LAS DOS direcciones |
| `priorityValue` | `objectives.priority` (entero crudo) | ficha de `tasks` | campo paralelo, transitorio |
| `hours-per-day` | `system_settings.key = 'hours_per_day'` | ficha de `settings` | `transform` de salida + `values` de entrada |

**Ninguna de estas traducciones se filtra a `@jiku/models`**, que describe la base tal como es. Es
literalmente una Implementation Rule de ADR-004 y aplica igual a las dos familias.

### `entity-type.ts` es DATO, no funciones

La traducción de `entityType` —qué tabla mirar para cada tipo de entidad— vive en **un solo lugar** y
está escrita como estructuras de datos, no como funciones. Es deliberado: así `meta.describe` puede
proyectar el contrato sin ejecutar una traducción, y las dos direcciones —del contrato a la base y de
vuelta— salen del mismo mapa. Si los nombres de tabla estuvieran escritos a mano en cada ficha, las
dos direcciones podrían divergir sin que nada lo diga, y la que se equivoca **devuelve las filas de
la otra entidad**.

### `hours-per-day` y la clave con guiones bajos

La única de las seis que se decidió en REQ-006 y no venía de antes. `system_settings` tiene seis
claves en la lista blanca del contrato de consultas: cinco se llaman igual en las dos puntas y la
sexta —la más vieja, de febrero— existe en la base como **`hours_per_day`**, con guiones bajos,
mientras que el contrato la publica como **`hours-per-day`**.

**El contrato gana y la ficha traduce**, en las dos direcciones: un `transform` en `base.key` para la
salida y el mapa `values` de `filterable.key` para la entrada. La alternativa —publicar el nombre de
la columna— dejaría al contrato de consultas hablando en nombres de base, que es lo que ADR-004
prohíbe; y escribir la lista blanca con el nombre del contrato sin traducir haría que la clave **no
apareciera nunca**, un bug silencioso porque `items: []` es indistinguible de "no está declarada".

> **La traducción va en la FICHA, no en el archivo del endpoint.** Resolverla reescribiendo el
> payload antes de validar la sacaría de lo que `meta.describe` proyecta, y la propiedad que hace
> confiable a la descripción —"todo lo que declara funciona"— dejaría de ser verificable para ese
> recurso.

## Dónde NO hay traducción, y podría parecer que sí

| Concepto | Estado |
|---|---|
| `stage` / etapa | **Eliminada de la base.** Core no tiene comando ni campo. La web sigue mandando `stageId` y la api lo descarta. `stage_not_found` existe en el catálogo de códigos y ningún comando lo emite |
| `client` / actor | La UI dice "Actor"; el bus **y** la base dicen `client`. La traducción es de la UI, no de core |
| `requirements.priority` | Enum en las dos puntas. Sin traducción |
| `visibilityLevel` | Mismo nombre y mismos valores (`public` / `internal`) en las dos puntas |

## Al agregar un campo nuevo

1. **Por defecto, el mismo nombre en las dos puntas.** Una traducción se paga en cada comando que
   toque el campo.
2. Si el nombre del producto difiere del de la columna, la traducción va en un helper del módulo
   (como `properties.ts` o `priority.ts`), no repetida en cada comando.
3. El helper devuelve `undefined` cuando el campo está ausente, para no romper la edición parcial.
4. **Documentalo en la spec del plano que corresponda**: `docs/apis/core.yaml` si es un campo de un
   comando, **`docs/apis/core-queries.yaml`** si es de una ficha de consulta. Una traducción
   indocumentada es un bug esperando: quien lea la base no va a encontrar el nombre del contrato.
5. Si la traducción es transitoria, el comentario dice **cuándo desaparece**.

## Reglas

- La base no se toca para acomodar un nombre del contrato. Core traduce.
- Una traducción vive en un helper del módulo, no repetida en cada comando.
- Los helpers de traducción devuelven `undefined` para un campo ausente, nunca un valor vacío.
- Un campo cuyo nombre difiere entre el bus y la base **no puede ir por `pickPresent`**: se agrega a
  mano al objeto de cambios, con `hasOwnProperty`.
- No renombres los modelos de `@jiku/models`: los comparte `api`.
- Toda traducción está documentada en la spec de su plano: `docs/apis/core.yaml` para los comandos,
  `docs/apis/core-queries.yaml` para las consultas.
- **Ninguna traducción se filtra a `@jiku/models`**: el paquete describe la base tal como es, y lo
  comparten los dos servicios. Vale para las de escritura y para las de lectura por igual.
- Una traducción de LECTURA vive en la ficha del recurso, no en el archivo del endpoint: fuera de la
  ficha queda fuera de lo que `meta.describe` proyecta.
- No construyas nada nuevo sobre `priorityValue`: es un escape con fecha de vencimiento.
- Un campo nuevo usa el mismo nombre en las dos puntas salvo que haya una razón que se pueda
  escribir en una línea.

## Integración con otras convenciones

- **[`commands`](./commands.md)**: por qué un campo traducido no puede ir por `pickPresent`.
- **[`validation`](./validation.md)**: los esquemas validan el nombre del **contrato**, no el de la
  columna.
- **[`orm`](./orm.md)**: los modelos usan los nombres de la base, y el plano de consultas no los usa
  en absoluto: arma SQL explícito contra su conexión de solo lectura.
