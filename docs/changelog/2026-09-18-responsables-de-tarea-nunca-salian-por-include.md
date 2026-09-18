# Los responsables de una tarea nunca salían por `include` — la columna muerta `active`

**Story:** — (trabajo interactivo, sin story) · **Request:** — · **Fecha:** 2026-09-18

`tasks.list` / `tasks.get` con `include: ['responsiblePersons']` devolvía **`[]` para todas las
tareas**, incluidas las que sí tenían responsables. En `requirements` el mismo include funcionaba.
Esta entrada registra el arreglo y —sobre todo— **por qué una columna que nadie escribe no puede
decidir qué se lee**, que es la parte que se puede volver a romper con buena intención.

## El síntoma

Reportado desde el CLI contra producción, sobre la tarea `#2825`, con la persona 33 asignada:

```
$ jiku -q query tasks.list --filter id=2825 --include responsiblePersons -o json
  ... "responsiblePersons": [] ...

$ jiku -q query tasks.list --filter id=2825 --filter responsiblePersonId=33 -o json
  ... devuelve la tarea ...
```

**Las dos lecturas se contradecían sobre el mismo dato**: el filtro la encontraba, el include no la
mostraba. Verificado también en `#2864`, `#2865` y `#2866`.

## El diagnóstico

Una línea de la ficha, `core/src/queries/tasks/tasks-spec.ts`:

```ts
responsiblePersons: {
  ...
  where: 'r.active = true',
```

`people_objectives.active` **existe como columna pero ningún comando la escribe**: `tasks.new`
(`tasks-new.ts:151`) y `tasks.{id}.edit` (`tasks-edit.ts:200`) insertan `personId`, `objectiveId` e
`isLeader` y nada más. La columna queda **`NULL`**, y en PostgreSQL **`NULL = true` es `NULL`, no
`false`**: el predicado descartaba **todas** las filas escritas por `core`.

`requirements` nunca estuvo roto porque `people_requirements` **no tiene** esa columna, y su ficha
lo dice explícitamente desde S-024.

### Por qué sobrevivió: el comentario lo defendía y el fixture lo tapaba

Dos cosas, y las dos importan más que la línea:

1. **El comentario afirmaba que era deliberado.** Decía que la asimetría con el filtro *"parece un
   bug y no lo es"*, con un argumento razonable —*"buscar las tareas de fulano tiene que encontrar
   las que ya no tiene; mostrar los responsables tiene que mostrar los de hoy"*—. El argumento
   sería válido **si la columna se escribiera**. Como no se escribe, no distinguía vigentes de
   históricos: descartaba todo.
2. **Los fixtures eran los únicos que llenaban la columna.** `assignPerson()` exigía `active` como
   parámetro **obligatorio**, así que los tres call sites lo pasaban explícito y **ningún test
   reprodujo jamás lo que los comandos producen de verdad**. TS-56 pasaba en verde afirmando
   exactamente el comportamiento roto.

**La misma trampa ya estaba documentada en el codebase**, en el plano de eventos:
`events/domain/task-snapshot.ts` (D-8, S-065) explica que un `where active = true` *"devuelve CERO
FILAS SIEMPRE"* y sería *"un bug silencioso, porque `[]` es un valor perfectamente válido del
contrato"*. El plano de eventos lo evitó; el de consultas lo tenía.

## Por qué importaba más de lo que parecía

**No era un problema de una pantalla.** `responsiblePersonIds` **reemplaza la lista entera** al
escribir, no mergea. La única forma de sumar un responsable es leer la lista actual, agregar y
reescribirla completa.

Con el include roto, ese procedimiento leía `[]` y escribía la lista nueva **borrando a todos los
que estaban**, sin que nada lo advirtiera. Y el borrado **no es reconstruible desde la API**:
`activity` no registra cambios de responsables (`TRACKED` en `tasks-edit.ts:67` no incluye
`person`).

> **Sí queda rastro en el bus, por 7 días.** Desde REQ-014 `core` publica `task.assigned` a
> JetStream con `changes.responsiblePersonIds: {from, to}`, `added`, `removed` y `leaderId`. El
> `from` lo calcula `readTaskResponsiblePersonIds`, que es justamente la función que **no** filtra
> por `active`, así que es confiable. Para un borrado accidental dentro de la ventana de retención
> del stream `JIKU_EVENTS`, ahí está quién estaba antes.

## La decisión: si ningún comando la escribe, no puede filtrar

Es lo único de esta entrada que hay que retener.

Se eliminó el `where`. Las dos alternativas se descartaron:

- **Empezar a escribir `active: true` en los comandos** — agrega una columna al contrato de
  escritura para sostener una distinción que el producto no pide: no hay ningún caso de uso de
  "responsable histórico de una tarea", y `requirements` no lo tiene.
- **Backfillear las filas existentes a `true`** — arregla los datos de hoy y deja la trampa armada
  para la próxima fila que un comando escriba sin la columna.

El include y el filtro `responsiblePersonId` **ahora coinciden sobre el mismo dato**, que es la
propiedad que el bug violaba. Las filas heredadas con `active = false` se devuelven también: esa
columna no describe un estado del dominio.

## Alcance verificado

**`tasks.responsiblePersons` era el único caso.** Se revisaron los cuatro `where` de relación que
existen en todas las fichas de consulta: los otros tres son `r.type_of_activity = 'comment'` (en
`tasks` y en `requirements`), que sí filtran por una columna que la escritura llena.

## Cambios

| Archivo | Qué |
|---|---|
| `core/src/queries/tasks/tasks-spec.ts` | Se elimina `where: 'r.active = true'` de `responsiblePersons`; el comentario ahora explica por qué la columna no puede filtrar. Se corrige el comentario de `responsiblePersonId`, que describía la asimetría |
| `core/src/queries/engine/build-sql.ts` | Comentario de `conditionSql` que afirmaba que la relación *"solo devuelve los activos"* |
| `core/tests/queries/task-fixtures.ts` | **`assignPerson()` deja `active` OPCIONAL.** Es la corrección estructural: omitirlo es ahora el caso por defecto, el que corre en producción |
| `core/tests/queries/tasks.test.ts` | TS-56 reescrito: el líder se asigna **sin** `active` y tiene que venir. Test nuevo de que el include y el filtro coinciden |
| `core/tests/queries/tasks-spec.test.ts` | TS-53 exige que **ninguna** de las dos lecturas mencione `active` |
| `core/tests/queries/include.test.ts` | El SQL de la relación **no** puede volver a mencionar `active` |
| `docs/db-schemas/jiku.md` | `people_objectives.active` queda documentada como **columna muerta**, con el modo de falla |

## Verificación

- Suite completa de `core` en verde: **2073 tests**.
- **La prueba que importa, hecha de punta a punta:** una tarea creada por `tasks.new` de verdad
  —el camino de producción, que no escribe `active`— devuelve sus dos responsables por el include,
  con el líder primero. Contra el código anterior ese mismo recorrido devolvía `[]`.

## Pendiente, no resuelto acá

**`activity` no registra cambios de responsables.** El tipo `ActivityType`
(`commands/tasks/activity.ts:12`) ya contempla `'person'` y lo clasifica como interno, pero
`TRACKED` no lo incluye y ningún criterio de aceptación lo pide. Sin eso, un borrado accidental de
responsables sigue sin dejar rastro **en la base** (sí en el bus, por 7 días). Es un cambio de
producto chico y queda como candidato.
