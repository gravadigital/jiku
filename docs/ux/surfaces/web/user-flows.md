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
  ve. Es la única diferencia de rol en esta pantalla. **Desde REQ-007 esa diferencia también se
  aplica en el servidor**: un `user` que mande un `personId` distinto del propio es rechazado por
  `core` con el mismo 403 de siempre (CA-17). Para quien usa la pantalla no cambia nada; lo que
  cambia es que ocultar el selector dejó de ser la única defensa.
- **Borrar un registro** — Desde el listado del día, con **confirmación** (overlay O-02).

### Errores y recuperación

- **Fuera de la ventana de 11 días** — Rechazo con `invalid_date_range`. El usuario no tiene forma
  de cargar ese día: **necesita que alguien lo haga por la base**. No hay recuperación en la
  interfaz. **Desde REQ-007 la regla la aplica `core`, no la api** (CA-16): el mismo status, el
  mismo código y el mismo mensaje (CA-8), pero ahora rige **venga la carga de donde venga** —también
  si una persona publica `worked-times.new` directo al bus—, en vez de depender de que el cliente
  sea la interfaz.
- **Tope diario superado** — El error informa **cuántos minutos quedan disponibles**, así que el
  usuario puede corregir el monto sin adivinar. Es el mejor mensaje de error del producto.
- **Tarea y requisito a la vez** — El selector agrupado lo previene por construcción: se elige uno.
- **No hay quién atienda el comando** — `503 service_unavailable`, *"El servicio no está
  disponible en este momento"*. La carga **no ocurrió** y **no queda registro de que se intentó**;
  reintentar es seguro [REQ-004 RF-16, CA-8].
- **La respuesta no llegó a tiempo** — `504 gateway_timeout`, *"La operación tardó demasiado"*. La
  carga **pudo haber ocurrido**: si el registro se escribió y la respuesta se perdió, reintentar
  duplica el asiento y consume el tope diario dos veces. La interfaz no puede distinguirlo, así que
  la recuperación correcta es **mirar la lista del día antes de reintentar**, no volver a apretar
  [REQ-004 RF-16, CA-9]. Antes los dos casos colapsaban en un 503 genérico y la nota del flujo de
  sistema decía que el usuario veía *"un 503 de una operación que sí ocurrió"*: eso es lo que este
  desdoblamiento hace nombrable.

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
   - El listado **abre filtrado por los cuatro estados de trabajo en curso** (`planificacion`,
     `en_cola`, `desarrollo`, `revision`): quien viene a avanzar un requisito entra viendo los que
     están en curso, sin los de `analisis` ni el histórico de `resuelto` y `cancelado`. El filtro de
     estado es de **selección múltiple**, así que se agregan o quitan estados sin perder el resto de
     la selección, y **deseleccionar todos muestra los siete** [REQ-009 RF-4..RF-6].
   - La selección viaja en la URL, de modo que un recorte de estados se comparte como link y el
     paginador informa el total del conjunto filtrado [REQ-009 RF-7, RF-9].
   - La columna **"Hs. Trab."** muestra en la misma fila cuántas horas lleva cada requisito, así
     que la decisión de cuál abrir se toma con el esfuerzo ya invertido a la vista y sin salir del
     listado [REQ-010 RF-7].
2. El **stepper de workflow** muestra dónde está: `analisis → planificacion → en_cola →
   desarrollo → revision` [fuente: código-existente]. **Desde REQ-012 el stepper ubica pero no
   restringe**: el recorrido que dibuja es el habitual, no el único posible (RF-1, RF-12)
3. El usuario completa los campos del **acordeón** que corresponden al estado actual
   (`analisis`→alcance, `planificacion`→propuesta y criterios, `en_cola`→cierre estimado)
4. Avanza el estado — con el **botón de transición**, que guarda los campos y va al paso siguiente
   en una sola acción, o con la **pill del header**, que desde REQ-012 lleva a cualquiera de los
   siete estados sin pasar por los intermedios (RF-12, CA-6)
5. El cambio se registra como **actividad pública** automáticamente y aparece en el feed

En cualquier punto a partir del paso 1, la card **"Horas Trabajadas"** de la columna derecha
responde cuánto lleva el requisito y quién lo trabajó, sin ir al reporte de período — que es el
desvío que este flujo obligaba a hacer hasta ahora. La card **se carga por su cuenta**: si tarda o
falla, el workflow se avanza igual, porque no es un paso del flujo sino contexto para decidir
[REQ-010 RF-8, AC-10].

### Caminos alternativos

- **Ir a cualquier estado, en cualquier orden** — Camino **nuevo desde REQ-012**, y el que cambia la
  naturaleza del flujo: la secuencia dejó de ser una regla. Desde la **pill de estado** del header se
  llega a cualquiera de los siete estados desde cualquier otro, hacia adelante o hacia atrás, sin
  validación de secuencia ni en la pantalla ni en el servidor (RF-1, CA-1, CA-2, CA-6). El
  **stepper sigue mostrando el recorrido de trabajo** —`analisis → planificacion → en_cola →
  desarrollo → revision`— porque es cómo el equipo lee dónde está un requisito, pero ya no recorta a
  dónde puede ir: **informa, no decide**. El botón de transición sigue siendo el atajo al paso
  siguiente cuando ese paso es el que se quiere.
- **Es una incidencia** — El recorrido habitual **saltea `en_cola`**: de `planificacion` pasa directo
  a `desarrollo`. **Desde REQ-012 es una costumbre, no una restricción**: `"En cola"` vuelve a estar
  entre las opciones de la pill para las incidencias, porque el servidor ya no distingue por tipo al
  cambiar de estado (RF-1, RF-12).
- **Reabrir un requisito cerrado** — Camino **nuevo desde REQ-012**. `resuelto` y `cancelado` dejan
  de ser terminales: desde la card de resolución, el botón **"Reabrir"** devuelve el requisito a
  `desarrollo` (RF-2, CA-3, CA-4). **Reabrir borra los datos de resolución** —tipo, conclusión y nota
  para cliente— en la misma escritura que cambia el estado (RF-10, CA-12); cuando el requisito se
  vuelva a resolver, el formulario **sugiere esos mismos valores** para que nadie tenga que
  reescribirlos (RF-11, CA-13). La fecha de finalización **se conserva** hasta que haya una nueva
  resolución, y `finishedAt` refleja siempre la última (RF-9, CA-11).
- **Editar clasificación inline** — Estado, tipo y prioridad se cambian desde los
  **pills-dropdown** del header (overlay O-04), sin entrar a edición.
- **Cerrar el requisito** — `resuelto` y `cancelado` **no están en el stepper**: viven en la card
  de resolución (y, desde REQ-012, también en la pill como cualquier otro estado). **Tipo y
  conclusión se exigen solo si el requisito es de tipo `incidencia`** — para `funcionalidad`,
  `mejora` y `otro` son siempre opcionales y el formulario no los pide (RF-5, RF-6, CA-7, CA-8).
  Hasta REQ-012 el servidor los reclamaba para todos los tipos mientras la pantalla los ofrecía solo
  para incidencias: resolver una `funcionalidad` desde acá **era imposible**, y ese callejón es lo
  que el requerimiento cierra.
- **Comentar** — El feed acepta comentarios con **visibilidad elegible** (interno / público) y
  adjuntos embebidos. Es el único punto donde el usuario decide la visibilidad.
- **Adjuntar un archivo al comentario** — Se sube **de a uno por vez, con progreso real**, y el
  vínculo con el comentario se crea al enviarlo: si el envío falla, no queda ni el comentario ni
  el vínculo, pero **el archivo sí queda** y se puede volver a usar (REQ-001 RF-1, RF-7, RF-8).
  Un archivo **solo lo puede adjuntar quien lo subió**, sin excepción por rol (RF-12, RF-13).
- **Editar un comentario ya publicado** — Camino **nuevo desde REQ-011**, y el primero que escribe
  sobre una entrada del feed que ya existe. El autor de un comentario —o un `admin`, sobre
  cualquiera— entra en edición desde la propia entrada, corrige el texto y agrega o quita adjuntos,
  y guarda. **La visibilidad no se puede cambiar**: quedó fijada al publicarlo, porque el
  comentario ya pudo haber sido leído por el cliente en el portal (RF-8, CA-8). El feed **no gana
  una entrada nueva** —el comentario cambia en su lugar— y la edición **no notifica** (RF-10). Lo
  que queda visible es una marca `"(editado)"` junto a la fecha, que dice `"(editado por X)"`
  cuando quien editó no fue el autor: sin eso, un texto cambiado por un `admin` quedaría atribuido
  a quien no lo escribió (RF-4, RF-5, CA-4). **Las entradas de cambio de campo no son editables**:
  la asimetría es deliberada y es lo que mantiene confiable el registro (RF-12, CA-12). Se puede
  editar **cuantas veces se quiera y sin ventana de tiempo**; solo se conserva la última edición,
  no un historial (RF-9, CA-7).
- **Leer una entrada del feed que no la escribió una persona** — Camino de lectura **nuevo desde
  REQ-005**. Una identidad de servicio —el conector externo— tiene fila en `users` y puede figurar
  como autor de una actividad o como `created_by` del requisito. En el feed y en la fila
  "Creado por" el nombre viene acompañado de un badge **"Automático"**, que es lo único que
  distingue a ese autor de un compañero de equipo. **No hay acción asociada:** el usuario no puede
  responderle, y **desde REQ-011 el comentario de un servicio es editable por un `admin`**, como
  cualquier comentario ajeno: la excepción por rol no distingue si el autor es una persona o una
  identidad de servicio. Para un `user` que no lo escribió sigue sin haber acción (REQ-005 RF-3,
  RF-10; REQ-011 RF-3).

### Errores y recuperación

- **Resolver una incidencia sin conclusión** — Falla con `resolution_required`. El usuario completa
  y reintenta; nada quedó a medias. **Desde REQ-012 es el único error de regla de dominio que queda
  en este flujo**, y solo alcanza a los requisitos de tipo `incidencia` (RF-5, CA-14). El tipo se lee
  de la fila y no del payload, así que reclasificar el requisito en la misma operación no esquiva la
  regla. Si la conclusión ya estaba almacenada, se acepta la almacenada (RF-7, CA-15).
- **Salto de estado inválido** — **Deja de existir desde REQ-012.** REQ-007 había mudado la secuencia
  a `core` como tabla de transiciones declarada (C-15) y la rechazaba con `invalid_state_transition`
  → **400**; REQ-012 **la da de baja entera**, por decisión de producto y no por omisión: cualquier
  estado es alcanzable desde cualquier otro, por las dos webs y por la api NATS por igual (RF-1,
  RF-3, RF-4, CA-1..CA-5). El código `invalid_state_transition` **queda en el catálogo sin emisor
  para requisitos** —igual que `invalid_attachment_id`— así que no hay que buscarlo: ya no lo produce
  nadie. **Esto cierra el gap que REQ-007 abrió en el portal**, cuyo dropdown ofrecía los siete
  estados sin orden y era el lugar donde el rechazo era fácil de provocar: desaparece sin que nadie
  toque `opus-web` (ver [`opus-web/screens/tablero-requisitos.md`](../opus-web/screens/tablero-requisitos.md)).
  La contrapartida aceptada es que **el salto ya no se previene, se audita**: cada cambio de estado
  sigue registrándose como actividad en el feed (C-21).
- **Adjunto de otra persona** — Falla con *"No podés adjuntar un archivo que subió otra persona"*
  (REQ-001 RF-12). No hay recuperación posible más que subirlo de nuevo, y es deliberado.
- **Editar un comentario que ya no se puede editar** — Falla con *"No podés editar un comentario
  que no es tuyo"* si la autoría cambió de criterio desde que se cargó la pantalla, o con *"El
  comentario ya no existe"* si fue borrado mientras estaba abierto en edición (REQ-011 CA-10,
  CA-16). **Ninguno de los dos debería alcanzarse desde esta pantalla** —el botón de editar solo
  aparece donde la edición está permitida—, así que valen como red de seguridad ante una vista
  desactualizada, no como flujo previsto. La recuperación es refrescar.
- **Adjunto cuyo contenido nunca llegó** — Al abrirlo dice *"El archivo no está disponible"*, no un
  error genérico (RF-21, CA-15). El sistema registra el archivo antes de recibir su contenido y no
  verifica que haya llegado, así que este caso es alcanzable si la subida se corta a mitad.
- **Falla del bus** — Se separa en dos casos con recuperación opuesta [REQ-004 RF-16, CA-8, CA-9].
  `503 service_unavailable` (*"El servicio no está disponible en este momento"*): el avance de
  estado o el comentario **no ocurrió**, reintentar es seguro. `504 gateway_timeout` (*"La operación
  tardó demasiado"*): **pudo haber ocurrido**, y como el cambio de estado y el comentario son
  actividad del feed, un reintento a ciegas puede dejar **dos entradas** — y si son públicas, el
  cliente las ve duplicadas en Opus. La recuperación es **refrescar el requisito antes de repetir**,
  con un agravante: si el refetch falla la pantalla sigue mostrando el dato viejo sin avisar, así
  que la verificación puede mentir.

### Estado final

El requisito muestra su nuevo estado en el header y en el stepper, y el feed tiene una entrada
nueva. **En Opus, el cliente ve el mismo cambio** — es actividad pública.

### Criterios de éxito

- El usuario debería saber **qué falta completar** para avanzar, sin conocer el proceso de memoria
- El paso a `resuelto` no debería poder ocurrir por accidente durante una edición. **Desde REQ-012
  el criterio se cumple de otra manera:** no por prevención —la transición ya no se puede impedir,
  es libre por decisión de producto— sino porque **es reversible**, con `"Reabrir"` en la card de
  resolución (RF-2). El riesgo se corrió de lugar: lo que ahora conviene no hacer por accidente es
  **reabrir**, que sí destruye los datos de resolución (RF-10)
- Un requisito que no es una incidencia debería poder resolverse **sin inventar una conclusión**.
  Se cumple desde REQ-012: hasta acá no se podía resolver en absoluto desde esta pantalla (RF-6,
  CA-7, CA-8)
- El usuario debería poder distinguir **qué escribió una persona y qué escribió un servicio** sin
  tener que reconocer nombres — **se cumple desde REQ-005** con la marca de autoría automática

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

- **Semana pasada** — Rechazo con `invalid_date_range`. **No hay aviso previo en la interfaz**: el
  usuario descubre la restricción al intentar guardar. **Desde REQ-007 la rechaza `core`** —
  `validateWeekNotPast` deja de ser una regla de la api (CA-21) — con el mismo status y el mismo
  mensaje. Lo mismo con el corte por rol: la grilla sigue siendo solo de `admin`, y ahora también
  del lado del servidor (CA-20).
- **Fallo al guardar** — La semana queda como estaba: el reemplazo ocurre dentro de una transacción
  y el rollback vale igual (CA-30).
- 🔴 **Este flujo dejó de ser la excepción, y con eso hereda el desdoblamiento 503/504** [REQ-007
  CA-20, CA-21]. Hasta acá era la **única escritura de dominio que no pasaba por el bus**:
  `PUT /api/week-assigned-times` escribía con el ORM (excepción 3 de ADR-001), el resultado era
  binario —commiteó o revirtió— y este documento lo registraba explícitamente para que nadie
  asumiera lo contrario por analogía. **Ya no es así.** La api publica `week-assigned-times.replace`
  y relee, así que aparece el tercer desenlace de [REQ-004 RF-16, CA-9]: con `504 gateway_timeout`
  —*"La operación tardó demasiado"*— **la semana pudo haberse reemplazado o no**. El toast del
  guardado ya renderiza el mensaje, pero **nada le dice al `admin` que la recuperación correcta es
  recargar la semana antes de reintentar**, y esta pantalla además pierde los cambios sin guardar al
  cambiar de semana sin avisar. Es un gap que **nace con REQ-007**, no una deuda heredada.

### Estado final

La grilla muestra la semana guardada. Las horas asignadas quedan disponibles para comparar contra
las cargadas en el flujo 1.

### Criterios de éxito

- Un `admin` debería poder planificar la semana **sin salir de la grilla**
- Ante un guardado que no se sabe si ocurrió, el `admin` debería saber que tiene que **recargar
  antes de reintentar** — criterio **nuevo desde REQ-007**, y hoy no se cumple
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
- **Falla del bus** — Como cada tarea es un comando propio, la falla es por tarea y los dos casos
  se resuelven distinto [REQ-004 RF-16, CA-8, CA-9]. Con `503 service_unavailable` **ninguna** salió
  y reintentar es seguro. Con `504 gateway_timeout` **no se sabe cuáles llegaron**, y volver a
  apretar "Guardar" reenvía los N formularios y duplica las que sí se crearon. Es el flujo donde el
  reintento a ciegas hace más daño, y el que convierte el fallo parcial ya conocido en un caso
  reproducible en vez de una posibilidad.

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
