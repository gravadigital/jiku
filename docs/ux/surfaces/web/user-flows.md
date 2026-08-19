---
document: UX User Flows
surface: web
version: 1.0
date: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — brownfield
---

> Flujos críticos internos de la superficie **web**. **No son todos los flujos** — son los 4 que
> definen el valor del producto acá. Inferidos de la navegación relevada (entradas y salidas de
> cada pantalla) cruzada con los flujos del PRD [fuente: código-existente].
>
> Los flujos que cruzan a `opus-web` viven en
> [`cross-surface-flows.md`](../../cross-surface-flows.md).

## Flujos Documentados

| # | Flujo | JTBD que resuelve | Audiencia |
|---|---|---|---|
| 1 | Carga diaria de horas | Registrar el tiempo del día sin que cueste tiempo | equipo-interno |
| 2 | Avanzar un requisito por su workflow | Mover el pedido de un cliente hacia su cierre | equipo-interno |
| 3 | Planificar la capacidad de la semana | Reservar quién trabaja en qué antes de que la semana pase | equipo-interno (`admin`) |
| 4 | Descomponer un requisito en tareas | Convertir un pedido en trabajo asignable | equipo-interno |

---

## Flujo 1: Carga diaria de horas

**JTBD que resuelve:** "Cuando termino mi jornada, quiero registrar en qué trabajé y cuánto, para
que quede el dato sin que me robe más tiempo del que ya trabajé."
**Audiencia:** equipo-interno
([research-context](../../audiences/equipo-interno/research-context.md))
**Trigger:** el usuario entra a **Horas Trabajadas** desde la sidebar, típicamente al final del día.

Es el flujo de **mayor frecuencia del producto** y el que sostiene toda la trazabilidad de costo
(G-01). Si cuesta, deja de hacerse y el resto del producto pierde su dato más valioso.

### Happy path

1. **carga-horas** → la pantalla abre en el día de hoy, con el **semáforo** indicando si está
   completo, parcial o vacío contra `hours-per-day` [fuente: código-existente]
2. El usuario deja el modo en **Presente** (el default)
3. Elige destino en el **selector agrupado** proyecto / requisito / tarea
4. Marca la cantidad con los **botones de horas y minutos** — no hay campo de texto libre
5. Guarda → el registro aparece en el listado del día y **el semáforo se actualiza**
6. Repite 3-5 hasta que el semáforo indica completo

### Caminos alternativos

- **Cargar una ausencia** — El usuario cambia a modo **Ausente**; el formulario cambia por completo
  y pide motivo (9 valores). Comparte el tope diario con las horas trabajadas.
- **Cargar un día anterior** — El selector de día permite retroceder hasta **10 días**. Fuera de
  esa ventana la api rechaza.
- **`admin` carga en nombre de otra persona** — Aparece un selector de persona que un `user` no
  ve. Es la única diferencia de rol en esta pantalla.
- **Borrar un registro** — Desde el listado del día, con **confirmación** (overlay O-02).

### Errores y recuperación

- **Fuera de la ventana de 11 días** — La api rechaza con `invalid_date_range`. El usuario no tiene
  forma de cargar ese día: **necesita que alguien lo haga por la base**. No hay recuperación en la
  interfaz.
- **Tope diario superado** — El error informa **cuántos minutos quedan disponibles**, así que el
  usuario puede corregir el monto sin adivinar. Es el mejor mensaje de error del producto.
- **Tarea y requisito a la vez** — El selector agrupado lo previene por construcción: se elige uno.
- **Bus caído** — 503. La carga no ocurrió y **no queda registro de que se intentó**.

### Estado final

El listado del día muestra los registros cargados y el semáforo queda en verde. El dato ya está
disponible para el reporte jerárquico y para comparar contra la asignación semanal.

### Criterios de éxito

- Cargar un día completo debería costar **menos de 90 segundos** (NFR-U08, sin medir hoy)
- El usuario no debería tener que recordar contra qué imputar: el selector agrupado se lo ofrece
- El semáforo debería responder la pregunta "¿me falta cargar?" **sin abrir nada**

---

## Flujo 2: Avanzar un requisito por su workflow

**JTBD que resuelve:** "Cuando el trabajo sobre un pedido avanza, quiero reflejarlo para que el
cliente y el equipo vean el mismo estado sin que yo tenga que avisarles."
**Audiencia:** equipo-interno
**Trigger:** el usuario abre un requisito desde el listado o desde el detalle de su proyecto.

Es el flujo que conecta las dos superficies: **el cambio de estado es público**, así que el cliente
lo ve en Opus sin que nadie se lo comunique.

### Happy path

1. **listado-requisitos** → filtra y abre uno → **detalle-requisito**
2. El **stepper de workflow** muestra dónde está: `analisis → planificacion → en_cola →
   desarrollo → revision` [fuente: código-existente]
3. El usuario completa los campos del **acordeón** que corresponden al estado actual
   (`analisis`→alcance, `planificacion`→propuesta y criterios, `en_cola`→cierre estimado)
4. Avanza el estado desde el stepper
5. El cambio se registra como **actividad pública** automáticamente y aparece en el feed

### Caminos alternativos

- **Es una incidencia** — El workflow **saltea `en_cola`**: de `planificacion` pasa directo a
  `desarrollo`.
- **Editar clasificación inline** — Estado, tipo y prioridad se cambian desde los
  **pills-dropdown** del header (overlay O-04), sin entrar a edición.
- **Cerrar el requisito** — `resuelto` y `cancelado` **no están en el stepper**: viven en la card
  de resolución. Para una incidencia, se exigen tipo y conclusión.
- **Comentar** — El feed acepta comentarios con **visibilidad elegible** (interno / público) y
  adjuntos embebidos. Es el único punto donde el usuario decide la visibilidad.
- **Adjuntar un archivo al comentario** — Se sube **de a uno por vez, con progreso real**, y el
  vínculo con el comentario se crea al enviarlo: si el envío falla, no queda ni el comentario ni
  el vínculo, pero **el archivo sí queda** y se puede volver a usar (REQ-001 RF-1, RF-7, RF-8).
  Un archivo **solo lo puede adjuntar quien lo subió**, sin excepción por rol (RF-12, RF-13).

### Errores y recuperación

- **Resolver una incidencia sin conclusión** — Falla con `resolution_required`. El usuario completa
  y reintenta; nada quedó a medias.
- **Salto de estado inválido** — **El stepper lo previene, pero la api no lo valida**
  [fuente: código-existente]: la regla vive solo en `web` (NFR-S07). Otro cliente HTTP podría
  saltar a cualquier estado.
- **Adjunto de otra persona** — Falla con *"No podés adjuntar un archivo que subió otra persona"*
  (REQ-001 RF-12). No hay recuperación posible más que subirlo de nuevo, y es deliberado.
- **Adjunto cuyo contenido nunca llegó** — Al abrirlo dice *"El archivo no está disponible"*, no un
  error genérico (RF-21, CA-15). El sistema registra el archivo antes de recibir su contenido y no
  verifica que haya llegado, así que este caso es alcanzable si la subida se corta a mitad.

### Estado final

El requisito muestra su nuevo estado en el header y en el stepper, y el feed tiene una entrada
nueva. **En Opus, el cliente ve el mismo cambio** — es actividad pública.

### Criterios de éxito

- El usuario debería saber **qué falta completar** para avanzar, sin conocer el proceso de memoria
- El paso a `resuelto` no debería poder ocurrir por accidente durante una edición

---

## Flujo 3: Planificar la capacidad de la semana

**JTBD que resuelve:** "Cuando arranca la semana, quiero reservar quién trabaja en qué, para poder
comparar después contra lo que realmente pasó."
**Audiencia:** equipo-interno (**solo `admin`**)
**Trigger:** el `admin` entra a **Asignación de Tiempo** desde la sidebar.

Es el contrapunto del flujo 1: acá se registra **lo planeado**, allá **lo ocurrido**.

### Happy path

1. **asignacion-tiempo** → la grilla proyecto × persona abre en la semana actual, agrupada en
   "Comerciales activos", "Internos activos" y "En análisis" [fuente: código-existente]
2. Si la semana está vacía, **la grilla se precarga con los valores de la semana anterior**
3. El `admin` ajusta las celdas en horas
4. Guarda → **la semana completa se reemplaza** (borrar + recrear en una transacción)

### Caminos alternativos

- **Semana ya cargada** — No hay precarga: se editan los valores existentes.
- **Poner una celda en cero** — La asignación se descarta: no queda fila.
- **Un `user` entra** — Ve la grilla en **solo lectura**. Es el único corte de capacidad por rol
  dentro de una pantalla de esta superficie.

### Errores y recuperación

- **Semana pasada** — La api rechaza. **No hay aviso previo en la interfaz**: el usuario descubre
  la restricción al intentar guardar.
- **Fallo al guardar** — La transacción del ORM revierte: la semana queda como estaba.

### Estado final

La grilla muestra la semana guardada. Las horas asignadas quedan disponibles para comparar contra
las cargadas en el flujo 1.

### Criterios de éxito

- Un `admin` debería poder planificar la semana **sin salir de la grilla**
- La precarga debería ahorrar el trabajo de una semana típica, donde poco cambia respecto de la
  anterior
- El usuario debería saber **antes de editar** que una semana pasada no se puede modificar

---

## Flujo 4: Descomponer un requisito en tareas

**JTBD que resuelve:** "Cuando un pedido queda definido, quiero partirlo en trabajo concreto con
responsables, para que cada quien sepa qué hacer y el tiempo se pueda imputar contra algo real."
**Audiencia:** equipo-interno
**Trigger:** desde el detalle de un requisito o del proyecto, o desde el listado de tareas.

Es lo que hace que el flujo 1 tenga contra qué imputar.

### Happy path

1. **alta-tareas** → el formulario permite **clonar y borrar formularios** para crear varias tareas
   en un solo submit [fuente: código-existente]
2. Para cada una: título, área (4 valores), proyecto, prioridad, responsables y fecha estimada
3. Si se vincula a un requisito, **el requisito tiene que pertenecer al proyecto**
4. Guarda → las tareas aparecen en el listado y en el detalle del proyecto

### Caminos alternativos

- **Cambiar estado inline** — Desde el tag de la tabla o de la card, sin abrir el detalle
  (overlay O-03).
- **Ver el trabajo agrupado** — **tareas-por-proyecto** (con horas del mes) o
  **tareas-por-responsable** (ordenado por fecha estimada).
- **Editar responsables** — Reemplazo total de la lista. **El primero queda como líder: el orden es
  información.**

### Errores y recuperación

- **Requisito de otro proyecto** — Falla con `requirement_project_mismatch`. El usuario corrige el
  proyecto o el requisito.
- **Fallo en una de varias tareas** — Cada tarea es un comando propio: **las que ya se crearon
  quedan**. No hay atomicidad entre los formularios del mismo submit.

### Estado final

Las tareas existen, con responsables y líder asignados, y ya pueden recibir horas imputadas.

### Criterios de éxito

- Crear cinco tareas de un requisito debería costar **un submit**, no cinco
- El usuario debería saber que el orden de responsables define el líder — hoy **no hay nada en la
  interfaz que lo diga**

---

Los flujos que cruzan a la superficie del cliente están en
[`cross-surface-flows.md`](../../cross-surface-flows.md). El detalle de cada pantalla, en
[`screens/`](screens/).
