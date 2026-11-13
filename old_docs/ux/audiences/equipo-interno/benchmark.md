---
document: UX Benchmark
audience: equipo-interno
version: 1.0
date: 2026-08-18
status: Hipótesis inicial - Referencias de partida
---

# Benchmark — Audiencia `equipo-interno`

> Referentes mentales que esta audiencia trae al producto. Productos que ya usa o conoce, y de
> los que importa expectativas. No es auditoría exhaustiva — es punto de partida para entender
> qué patrones ya conoce el usuario y qué espera encontrar.

**Foco de esta investigación:** los tres JTBD que definen a la audiencia según el PRD —gestionar
requisitos y tareas, planificar capacidad semanal y **cargar horas todos los días**— no viven en
una sola categoría de producto. El equipo de una consultora de software convive a diario con tres
familias de herramientas distintas (issue tracker, time tracker, resource planner), y trae
expectativas de las tres. Jiku es el caso raro que las une, así que el benchmark se organiza por
esas tres familias en vez de por competidor único.

## Competidores Directos

### Linear (issue tracking, keyboard-first)

- **Qué resuelve:** Gestión de issues y proyectos para equipos de software chicos y medianos, con
  la velocidad de interacción como propuesta de valor explícita.
- **Cómo lo resuelve:** Todo el producto está construido alrededor del teclado. `Cmd+K` abre un
  command menu que da acceso **a toda acción del producto por nombre**, sin navegar. Con un issue
  enfocado, teclas de una letra abren los pickers de los campos que más cambian: `S` estado,
  `P` prioridad, `A` responsable, `L` etiquetas, `I` asignarse a sí mismo, `C` crear. El efecto
  buscado es poder triagear decenas de issues en el tiempo que otra herramienta tarda en uno.
- **A tomar:** **La jerarquía de atajos coincide con la frecuencia de la acción**, no con la
  importancia del campo. Los campos que cambian todos los días (estado, prioridad, responsable)
  tienen tecla propia; los que se tocan una vez, no. Para Jiku esto se traduce directo: el cambio
  de estado de un requisito y la imputación de horas son las acciones de mayor frecuencia, y son
  las que deberían costar menos.
- **A evitar:** La curva de los primeros minutos es vertical si el usuario no conoce ningún atajo.
  Linear lo compensa con un producto que también funciona con mouse; un producto que solo funcione
  con teclado dejaría afuera al usuario esporádico. Relevante para Jiku porque `admin` entra a la
  grilla de capacidad una vez por semana, no todos los días.
- **Fuente:** [linear.app/docs/select-issues](https://linear.app/docs/select-issues),
  [shortcut.fyi/linear-shortcuts](https://shortcut.fyi/linear-shortcuts),
  [medium.com/linear-app/invisible-details](https://medium.com/linear-app/invisible-details-2ca718b41a44)
  (documentación pública, verificado 2026-08).

### Jira / Jira Work Management (gestión de requisitos y workflow de estados)

- **Qué resuelve:** Gestión de tickets con workflows formales y configurables para equipos con
  proceso definido. Es el referente que casi todo desarrollador ya usó, y por lo tanto la
  expectativa por defecto sobre "qué es un workflow de estados".
- **Cómo lo resuelve:** Workflow explícito con estados y **transiciones permitidas** entre ellos
  (no todo estado lleva a todo estado), pantallas de transición que pueden pedir campos, y
  permisos por transición. El vocabulario "estado / transición / condición" viene de acá.
- **A tomar:** La idea de **transición legal explícita** —que la UI solo ofrezca los estados a los
  que este requisito puede ir desde donde está— en lugar de un dropdown plano con los 7 estados
  siempre. Jiku ya tiene las reglas en el modelo (7 estados, las incidencias saltean `en_cola`):
  el patrón consiste en que la UI las refleje en vez de dejar que el usuario descubra el error al
  guardar.
- **A evitar:** El costo por click acumulado. Desde Jira 9.0 los botones de transición se
  replegaron a un menú, y transicionar pasó a costar dos clicks; la comunidad lo registró como
  regresión de UI. Sumado a formularios de transición con campos obligatorios y listas de decenas
  de opciones, el resultado documentado es que **cuanto más cuesta actualizar un ticket, menos se
  actualiza**, y el tablero deja de reflejar la realidad. Hay un caso citado de una instancia con
  25 estados descrito por su propio equipo como inmanejable. Es el riesgo directo de un workflow
  de 7 estados como el de Jiku: cada estado extra es un punto de decisión.
- **Fuente:** [community.atlassian.com — transiciones en dropdown en vez de botones](https://community.atlassian.com/forums/Jira-questions/Workflow-transitions-are-showing-in-Dropdown-instead-of-buttons/qaq-p/2255446),
  [projectflow.co.uk — guía de customización de workflows](https://projectflow.co.uk/jira-workflow-customization-guide/),
  [dev.to — por qué los desarrolladores odian Jira](https://dev.to/alina_chyzh_fd772c6bfce37/why-developers-hate-jira-and-how-to-make-it-dev-friendly-again-67j)
  (verificado 2026-08).

### Harvest (carga de horas — el JTBD de mayor frecuencia)

- **Qué resuelve:** Registro de tiempo por persona contra proyecto y tarea, en agencias y
  consultoras. Es el caso de uso más cercano al de Jiku: mismo tipo de organización, misma
  necesidad de imputar horas a un cliente.
- **Cómo lo resuelve:** Dos vistas del mismo dato, **Day view** y **Week view**, con propósitos
  distintos: la diaria para el registro del día (con timer y notas), la semanal para cargar varios
  días de una sin entrar a cada uno. La entrada exige elegir proyecto y después tarea. **No hay
  botón de guardar**: la planilla se guarda sola al iniciar/terminar un timer o editar una entrada.
  Encima hay una capa de recordatorios (recurrentes automáticos, manuales de admin a una persona,
  y diarios que cada uno se configura) que se pueden disparar por regla —por ejemplo, "a quien haya
  cargado menos del X% de su capacidad"— y un flujo de aprobación donde admin puede ver quién no
  cargó, recordarle, o **enviar la planilla en su nombre**.
- **A tomar:** Tres cosas. (1) El **par Day/Week como dos entradas al mismo dato**: el día para
  registrar, la semana para recuperar lo que no se cargó. Jiku hoy tiene ventana de 11 días pero
  una sola vista de día, así que ponerse al día con varios días atrasados cuesta N navegaciones.
  (2) El **guardado sin botón**, que elimina el modo "cargué y no guardé". (3) La capacidad de
  admin de **imputar en nombre de otro**, que Jiku ya tiene implementada, como parte de un flujo
  más amplio de "ver quién no cargó" y no como acción suelta.
- **A evitar:** La cadena proyecto → tarea obliga a dos decisiones antes de poder escribir un
  número; en un equipo que trabaja todo el día sobre los mismos dos o tres proyectos, es fricción
  repetida sin información nueva. Un default por lo último usado o lo asignado esta semana ahorra
  la mayor parte de esas decisiones.
- **Fuente:** [support.getharvest.com — Tracking time: Day view](https://support.getharvest.com/hc/en-us/articles/360048181892-Tracking-time-Day-view),
  [support.getharvest.com — Tracking time in Harvest](https://support.getharvest.com/hc/en-us/articles/26871883335821-Tracking-time-in-Harvest),
  [support.getharvest.com — Timesheet reminders](https://support.getharvest.com/hc/en-us/articles/360058596112-Timesheet-reminders),
  [support.getharvest.com — Timesheet approval](https://support.getharvest.com/hc/en-us/articles/360048181832-Time-Expense-Approval)
  (verificado 2026-08).

### Toggl Track (carga de horas — variante de planilla)

- **Qué resuelve:** Lo mismo que Harvest, con más peso en el registro retroactivo y menos en la
  facturación.
- **Cómo lo resuelve:** La **Timesheet View** es una grilla semanal donde cada fila es una
  combinación proyecto/tarea y cada columna un día. Se hace click en la celda (que muestra
  `0:00:00`), se escribe, y **se guarda al presionar Enter o al hacer click afuera**. Convive con
  un Manual Mode explícito para cargar actividades ya ocurridas, sin timer de por medio.
- **A tomar:** La **edición celda por celda con guardado al salir del campo**: es el patrón de
  planilla que el usuario ya trae de Excel/Sheets, y no requiere aprender nada. Y el
  reconocimiento explícito de que **cargar hacia atrás es un modo de primera clase**, no un caso
  de error: Jiku tiene una ventana de 11 días justamente porque asume que la gente se atrasa.
- **A evitar:** La grilla semanal pierde el detalle por entrada (una celda es un total, no una
  lista de imputaciones con su comentario). Si Jiku adoptara una vista semanal, tendría que
  resolver cómo convive con las imputaciones individuales, no reemplazarlas.
- **Fuente:** [support.toggl.com — Adding Time Entries in Timesheet View](https://support.toggl.com/en/articles/10760857-adding-time-entries-in-timesheet-view),
  [toggl.com/track/ways-to-log-time](https://toggl.com/track/ways-to-log-time/)
  (verificado 2026-08).

### Float y Resource Guru (asignación semanal de capacidad)

Se tratan juntos porque son el mismo patrón resuelto por dos productos, y es **el JTBD más
específico y menos estandarizado** de los tres: hay mucha menos convención acá que en issue
tracking o time tracking.

- **Qué resuelven:** Reservar por adelantado el tiempo de cada persona contra cada proyecto, y ver
  quién está sobrecargado antes de que ocurra.
- **Cómo lo resuelven:**
  - **Float** — el Schedule pone **una fila por persona** y el tiempo en el eje horizontal, con
    cada proyecto codificado por color. La lectura buscada es de un vistazo: quién está al tope,
    quién tiene holgura. La asignación se hace **en horas o en porcentaje** de la capacidad, se
    reasigna con drag & drop, y hay indicadores de utilización en vivo, tiempo libre pre-cargado y
    **advertencias de sobre-capacidad sobre la misma grilla**. Se puede alternar entre vista diaria
    y semanal.
  - **Resource Guru** — el diferenciador es el **clash management**: si una persona no tiene
    disponibilidad suficiente para la reserva que se está intentando, el producto **no la rechaza
    ni la acepta en silencio**, sino que muestra el conflicto con tres salidas explícitas —agregar
    a lista de espera, agregar como overtime, o agregar extendiendo la disponibilidad. Suma un
    heat map de capacidad y una barra de disponibilidad por persona que descuenta el tiempo libre.
- **A tomar:** (1) La **fila por persona con lectura de saturación en la propia grilla** —no en un
  reporte aparte— es el patrón dominante y el que Jiku ya insinúa con su grilla proyecto × persona.
  (2) El **conflicto como decisión ofrecida, no como error**: Jiku tiene un tope duro de 24 h por
  persona y día en la carga de horas; el equivalente en la asignación semanal es avisar de la
  sobre-asignación en el momento y dejar decidir, en lugar de bloquear o dejar pasar. (3) La
  **precarga de la semana anterior** que Jiku ya implementa es de la misma familia que el drag &
  drop de Float: ambas atacan que planificar de cero cada semana no se sostiene.
- **A evitar:** Cuando la grilla es la única lectura, el número planificado y el número real
  quedan en pantallas distintas y nadie los compara. Jiku tiene las dos mitades del dato
  (`week_assigned_times` y `worked_times`) y el desvío es una métrica declarada del PRD (G-03);
  la oportunidad de mostrar planificado vs. cargado sobre la misma grilla es propia y no está
  cubierta por estos referentes, que no registran horas reales con este nivel de detalle.
- **Fuente:** [float.com/product/scheduling](https://www.float.com/product/scheduling),
  [float.com/product/capacity-planning](https://www.float.com/product/capacity-planning),
  [help.resourceguruapp.com — Booking clashes, waiting list, overtime](https://help.resourceguruapp.com/en/articles/2942080-booking-clashes-the-waiting-list-overtime-and-capacity-planning),
  [resourceguruapp.com/features/resource-scheduling-software](https://resourceguruapp.com/features/resource-scheduling-software)
  (verificado 2026-08).

## Referentes Indirectos

### Excel / Google Sheets (categoría: planilla de cálculo)

- **Qué expectativa trae a este producto:** Es lo que la asignación semanal de capacidad **era
  antes** en cualquier consultora, y el PRD lo dice: "una planilla de asignación" es una de las
  tres herramientas que Jiku viene a reemplazar. El usuario trae de ahí la grilla editable como
  modelo mental: tabulación entre celdas, edición in-place, totales por fila y por columna
  visibles al pie, y la posibilidad de recorrer toda la grilla sin abrir un formulario por celda.
- **Cómo se manifiesta:** Ante una grilla proyecto × persona, el usuario espera poder escribir
  directo en la celda y moverse con teclado, no abrir un modal por intersección. También espera
  ver los totales (cuánto tiene asignada cada persona en la semana) sin calcularlos.
- **Fuente:** Referente inferido del propio PRD (§ Problema que Resuelve, "una planilla de
  asignación [resuelve] la segunda"). No verificado con el equipo.

### GitHub (categoría: plataforma de desarrollo)

- **Qué expectativa trae a este producto:** Es la herramienta que este equipo usa todos los días
  por definición de oficio. De ahí viene la expectativa sobre el **feed de actividad cronológico
  único** que mezcla cambios de campo y comentarios en la misma línea de tiempo —exactamente el
  modelo de "Actividad" que Jiku ya implementa— y sobre las **etiquetas clave:valor** con
  sugerencias al escribir.
- **Cómo se manifiesta:** El usuario espera que en la ficha de un requisito el historial y la
  conversación sean **una sola cosa ordenada por tiempo**, no dos pestañas separadas; y que los
  cambios de estado aparezcan en esa línea como eventos, no ocultos en un log aparte.
- **Fuente:** [docs.github.com](https://docs.github.com) — patrón de timeline de issues,
  ampliamente convencional. Verificado como convención, no como preferencia declarada del equipo.

## Patrones Recurrentes

- **Guardado implícito, sin botón de guardar** — Harvest (auto-save constante), Toggl (Enter o
  click afuera), Float (drag & drop que confirma solo), Linear (todo cambio se aplica al elegir).
  En la carga de tiempo el patrón es prácticamente universal: el formulario con "Guardar" es la
  excepción, no la regla. Romperlo tiene costo de aprendizaje **y** costo de datos perdidos.
- **Dos granularidades del mismo dato: día y semana** — Harvest (Day view / Week view), Toggl
  (Timer / Timesheet view), Float (vista diaria / semanal). Cada una sirve a un momento distinto:
  el día para registrar lo que acaba de pasar, la semana para revisar y ponerse al día.
- **Fila por persona como unidad de lectura de capacidad** — Float y Resource Guru coinciden. La
  pregunta que la grilla responde es "¿quién está al tope?", y eso se lee por fila.
- **Saturación señalizada sobre la misma grilla donde se edita** — Float (indicadores de
  utilización y warnings de sobre-capacidad in-line), Resource Guru (heat map y barra de
  disponibilidad). Nadie manda al usuario a un reporte aparte para enterarse de que sobre-asignó.
- **Teclas de una letra para los campos de alta frecuencia** — Linear lo lleva al extremo, pero
  Jira, GitHub y Height comparten la idea de atajos para estado y responsable. La convención es
  que el campo que se cambia todos los días no debería requerir apuntar con el mouse.
- **Recordatorio y "cargar en nombre de" como par** — Harvest resuelve la carga incompleta con
  recordatorios por regla **y** con la capacidad de admin de completar por el otro. Las dos mitades
  aparecen juntas porque una sola no alcanza.

## Diferenciadores

Formulados como oportunidades, no como decisiones. Quien diseñe decide cuáles perseguir.

- **Planificado y ocurrido sobre el mismo modelo** — Float y Resource Guru planifican pero no
  registran horas reales con detalle de requisito; Harvest y Toggl registran pero no planifican
  capacidad. Jiku tiene `week_assigned_times` y `worked_times` en la misma base, relacionados por
  persona/proyecto/semana. **Mostrar asignado vs. cargado en la misma grilla es algo que ningún
  referente del set puede hacer**, y es exactamente la métrica de desvío que el PRD declara en
  G-03.
- **Trazabilidad de la hora hasta el pedido del cliente** — el reporte de Jiku baja cuatro niveles
  (persona → proyecto → requisito → tarea) porque la relación existe en el modelo. En Harvest la
  hora llega a la tarea; el pedido original del cliente vive en otra herramienta. La oportunidad es
  presentar el reporte de horas **como respuesta a "cuánto costó esto que pidió el cliente"**, no
  como planilla de horas por persona.
- **Semáforo de completitud del día como estado propio, no como recordatorio externo** — Harvest
  resuelve la carga faltante con mails de recordatorio; Jiku ya tiene la información en pantalla
  (semáforo completo/parcial/vacío contra las horas por día configuradas). Como el producto **no
  tiene canal de notificación** (limitación estructural documentada en el PRD), el semáforo no es
  un complemento del recordatorio: es el único mecanismo disponible, y eso sube su exigencia de
  diseño. Tiene que ser visible desde donde el usuario esté, no solo dentro de la pantalla de
  carga.
- **Ventana de carga acotada y explícita** — los referentes permiten cargar hacia atrás casi sin
  límite. Jiku define una ventana de 11 días (hoy + 10 previos). Es una restricción de producto que
  puede jugar a favor si se comunica como tal —"esto se cierra el día X"— en vez de aparecer como
  un error cuando el usuario intenta cargar el día 12.

## Anti-patrones Detectados

- **Cada estado extra es un punto de decisión** — documentado en la comunidad de Jira, con el caso
  de una instancia de 25 estados descrita por su propio equipo como inmanejable. Jiku tiene 7
  estados con reglas de transición y un salto condicional (las incidencias saltean `en_cola`). El
  riesgo no es el número en sí sino que el usuario tenga que **recordar** qué transición es legal:
  si la UI no lo muestra, cada cambio de estado es una apuesta.
- **Convertir la acción más frecuente en dos clicks** — Jira 9.0 movió las transiciones a un menú
  desplegable y la comunidad lo registró como pérdida de throughput en workflows intensivos. La
  lección aplicada a Jiku: la carga de horas y el cambio de estado son las acciones de mayor
  frecuencia, y cualquier capa de navegación que se les agregue se paga todos los días.
- **Formularios de alta con campos obligatorios que no aportan al momento de crear** — "un update
  simple se convierte en una épica en miniatura: campos obligatorios, listas de 40 opciones,
  pestañas con datos que nadie usa". El efecto documentado es que la herramienta deja de
  actualizarse y el tablero miente. Para Jiku, con requisitos de 4 tipos, 5 prioridades y
  etiquetas clave:valor, el riesgo es concreto en el alta.
- **Elegir proyecto y tarea antes de poder escribir un número** — presente en Harvest y en Toggl.
  Es información que en un equipo chico casi nunca cambia entre un día y el siguiente, y se vuelve
  a pedir cada vez.
- **Bloquear en vez de avisar ante un conflicto de capacidad** — el anti-patrón que Resource Guru
  evita deliberadamente con su clash management de tres salidas. Un tope duro sin salida
  (como el de 24 h/día de Jiku en la carga) resuelve la integridad del dato pero deja al usuario
  sin camino cuando su realidad no entra en la regla; lo que hace falta es que el mensaje diga qué
  hacer, no solo que no se puede.

## Limitaciones del Benchmark

- **Todos los productos se verificaron por documentación pública, no por uso directo.** No hay
  cuenta paga de Linear, Harvest, Toggl, Float ni Resource Guru en este trabajo. Lo documentado es
  lo que cada producto afirma de sí mismo más lo que reporta su comunidad; **la fricción real de
  cada flujo no está medida**.
- **Jira Work Management específicamente:** el benchmark cubre el patrón de workflow de estados de
  Jira en general. La variante Work Management (la orientada a equipos de negocio, no a software)
  no se pudo verificar por separado, y puede diferir en la presentación del board y de los estados.
- **Float y Resource Guru — el detalle de la grilla:** se verificó qué muestran (fila por persona,
  color por proyecto, indicadores de saturación) pero **no cómo se edita una celda concreta**
  (¿inline?, ¿panel lateral?, ¿modal?). Es justamente el detalle que más importaría para la grilla
  de asignación semanal de Jiku. Cerrar este gap requeriría trial de alguno de los dos.
- **No se benchmarkeó ningún producto que una las tres familias.** Se buscó y el set de referentes
  disponible las tiene separadas. Puede existir (Productive.io, Runn, Scoro están en esa dirección
  y aparecieron tangencialmente en las búsquedas) y quedaría pendiente para una segunda vuelta.
- **No hay input del equipo.** Este benchmark asume qué herramientas conoce el equipo de Grava a
  partir de su oficio, no de haberlo preguntado. Cuál usaron antes de Jiku, y qué extrañan de esa
  herramienta, es una pregunta abierta de una sola reunión — y el equipo está disponible, porque
  es su propia audiencia.

---

**Próximo artefacto:** Este benchmark alimenta `research-context.md` de la misma audiencia con
material concreto para inferir pains, gains y JTBDs.
