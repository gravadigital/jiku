---
document: UX Benchmark
audience: cliente
version: 1.0
date: 2026-08-18
status: Hipótesis inicial - Referencias de partida
---

# Benchmark — Audiencia `cliente`

> Referentes mentales que esta audiencia trae al producto. Productos que ya usa o conoce, y de
> los que importa expectativas. No es auditoría exhaustiva — es punto de partida para entender
> qué patrones ya conoce el usuario y qué espera encontrar.

**Foco de esta investigación:** esta audiencia tiene una característica que condiciona todo el
benchmark — **usa el producto poco y espaciado**. No acumula pericia entre visitas, así que
cualquier patrón que dependa de haber aprendido algo la vez anterior no le sirve. Se investigaron
dos familias: los **portales de cliente de herramientas de agencia** (Teamwork, Basecamp,
Productive), que resuelven el problema de mostrar avance sin exponer lo interno, y los **portales
de tickets de soporte** (Zendesk, Freshdesk), que son el paralelo más cercano al alta de un
requisito por parte del cliente y a la lectura de su estado.

## Competidores Directos

### Basecamp — Clientside (portal de cliente de agencia)

- **Qué resuelve:** Que una agencia trabaje con su cliente dentro de la misma herramienta sin que
  el cliente vea las conversaciones internas del equipo.
- **Cómo lo resuelve:** Con un modelo de **visibilidad por ítem, con default privado**. Todo lo que
  se crea en un proyecto con cliente nace privado al equipo, y alguien del equipo tiene que "dar
  vuelta el interruptor" para que el cliente lo vea. La señalización es deliberadamente física y
  constante: **azul + candado = privado del equipo; amarillo + ojo = visible para el cliente**, y
  el color aparece sobre el propio contenido mientras se escribe, no en una pantalla de
  configuración aparte. El cliente, del otro lado, ve un proyecto que se ve como un proyecto
  normal, solo que con menos cosas.
- **A tomar:** **Que el autor sepa, en el momento de escribir, quién lo va a leer.** Es el
  problema más difícil de este modelo y Basecamp lo resuelve con color y no con texto. Jiku tiene
  exactamente la misma decisión (`visibilityLevel: public | internal` por actividad) y, según el
  glosario del producto, **la decide el sistema salvo en los comentarios** — que es justo donde el
  riesgo de decir algo interno delante del cliente es más alto.
- **A evitar:** El default privado con toggle manual traslada al equipo una decisión por cada ítem,
  y lo que no se marca, el cliente no lo ve nunca. Si el equipo se olvida, el cliente ve un
  proyecto muerto y no tiene forma de saber que hay actividad del otro lado. Para Jiku, donde
  estado/título/descripción son públicos por regla del sistema, este riesgo está parcialmente
  cubierto — pero solo para los cambios de campo, no para la conversación.
- **Fuente:** [3.basecamp-help.com — Changing what Clients can see and do](https://3.basecamp-help.com/article/693-changing-what-clients-can-see-and-do),
  [signalvnoise.com — Launch: a brand new way to work with clients](https://signalvnoise.com/svn3/launch-a-brand-new-way-to-work-with-clients-in-basecamp-3/),
  [github.com/basecamp/bc3-api — client_visibility](https://github.com/basecamp/bc3-api/blob/master/sections/client_visibility.md)
  (verificado 2026-08).

### Teamwork.com — Client Users (portal de cliente de agencia)

- **Qué resuelve:** Lo mismo, con un enfoque de **licencia de usuario limitada** en vez de
  visibilidad por ítem.
- **Cómo lo resuelve:** El "client user" es un tipo de licencia distinta, con permisos acotados por
  construcción: se lo agrega a proyectos específicos y queda excluido por perfil de las áreas que
  no le corresponden. Ve listas de tareas y estados —para entender qué está planificado y cómo
  avanza— y archivos compartidos. **El tiempo imputado es un permiso aparte** (`View Time Log`),
  apagado para el cliente por defecto, y del que además depende ver el presupuesto del proyecto.
- **A tomar:** La separación es **por tipo de usuario, no por configuración de cada proyecto**. Es
  el mismo criterio estructural que Jiku eligió y llevó más lejos: en Jiku no es un perfil de
  permisos dentro de la misma aplicación sino **dos aplicaciones distintas sobre la misma API**,
  con las rutas `/api/opus/*` separadas de las internas. Esa decisión ya está tomada y el
  benchmark la respalda: es la dirección que toma el mercado, y Jiku está en el extremo más
  seguro de ella.
- **A evitar:** Cuando la diferencia entre lo que ve el cliente y lo que ve el equipo es solo un
  conjunto de permisos sobre la misma UI, el cliente se encuentra con vistas pensadas para otro:
  columnas vacías, filtros que no aplican, secciones a las que no puede entrar. El costo lo paga
  un usuario que no tiene contexto para interpretarlo.
- **Fuente:** [support.teamwork.com — Client Users](https://support.teamwork.com/projects/using-teamwork/working-with-client-users),
  [support.teamwork.com — Understanding user permissions and access](https://support.teamwork.com/projects/using-teamwork/understanding-user-permissions-and-access),
  [teamwork.com/blog — who sees what](https://www.teamwork.com/blog/who-sees-what-customizing-permissions-and-privacy-in-teamwork-projects/)
  (verificado 2026-08).

### Productive.io — Client Portal (portal de cliente de consultora de software)

- **Qué resuelve:** Es el referente más cercano al caso de Jiku: consultora de software que factura
  por tiempo y necesita que el cliente participe sin ver la economía del proyecto.
- **Cómo lo resuelve:** Un cliente agregado a un proyecto **ve solo los datos de ese proyecto** y
  solo los de las compañías a las que pertenece. El conjunto de acciones que puede hacer es corto y
  explícito: **ver tareas y listas de tareas, abrir tareas nuevas, comentar, cerrar tareas,
  filtrar, y colaborar en documentos compartidos**. La información financiera sensible y **el
  tiempo trabajado nunca son visibles para un cliente**; ni siquiera en los planes altos, donde un
  "Client Manager" puede acceder a presupuestos, el worked time general queda fuera.
- **A tomar:** El **inventario corto de acciones del cliente** es casi idéntico al de Opus (ver
  requisitos, crear requisitos, comentar, suscribirse) y confirma que un portal de cliente no
  necesita ser un producto completo para ser útil. Y el hecho de que un producto maduro de esta
  categoría trate "el cliente nunca ve horas" como **invariante de producto y no como opción de
  configuración** valida la decisión estructural de Jiku.
- **A evitar:** No se detectó fricción específica documentada. Lo que sí es relevante como
  advertencia: Productive apunta a un dashboard en vivo con estado de tareas, tiempo facturable y
  gastos, es decir, resuelve la orientación del cliente con **una vista de resumen** además del
  listado. Un portal que solo ofrece el listado de items le pide al cliente que arme el resumen en
  su cabeza cada vez que entra.
- **Fuente:** [help.productive.io — What can a client see after joining Productive](https://help.productive.io/en/articles/2179600-what-can-a-client-see-after-joining-productive),
  [productive.io/client-portal](https://productive.io/client-portal/),
  [help.productive.io — Giving clients access to budgets and timesheets](https://help.productive.io/en/articles/2179616-giving-clients-access-to-budgets-and-timesheets)
  (verificado 2026-08).

### Zendesk — Customer Portal (portal de tickets, paralelo del alta de requisitos)

- **Qué resuelve:** Que alguien externo a la organización pida algo, y después pueda ver en qué
  quedó lo que pidió. Es exactamente el par de JTBD del cliente de Opus, en otra categoría.
- **Cómo lo resuelve:** Dos piezas. El **formulario de pedido** ("Submit a request"), accesible
  desde un botón fijo arriba de todo, con la posibilidad de elegir entre varios formularios cuando
  hay tipos de pedido distintos, y con CC para copiar a otras personas de la organización del
  cliente. Y la **lista "My requests"**, que por defecto muestra todo lo que esa persona pidió con
  cinco columnas: asunto, ID, fecha de creación, **fecha de actualización** y estado; se puede
  filtrar y buscar, mostrar u ocultar columnas, y en organizaciones compartidas ver los pedidos de
  toda la organización, no solo los propios.
- **A tomar:** Tres cosas muy transferibles. (1) **"Fecha de actualización" como columna de primera
  clase**: para un usuario esporádico, la pregunta al entrar no es "qué estados hay" sino "**qué
  cambió desde la última vez que entré**", y esa columna es la respuesta más barata. (2) La
  **acción de crear siempre visible y en el mismo lugar**, no escondida dentro de un proyecto.
  (3) **Ver los pedidos de toda mi organización, no solo los míos**: en una consultora el
  interlocutor cambia (alguien se va de vacaciones, otro toma el proyecto) y el pedido lo hizo una
  persona pero le importa a la empresa. Jiku otorga permisos por proyecto vía
  `user_project_permissions`, lo que sugiere que el alcance ya es de proyecto y no de autor — vale
  confirmar que la UI lo refleje.
- **A evitar:** La lista de requests es una tabla de tickets: eficiente para quien entra seguido,
  pobre para quien entra cada tres semanas y necesita saber si el proyecto avanza. No hay noción de
  progreso, solo de estado individual.
- **Fuente:** [support.zendesk.com — Submitting and tracking requests in the help center Customer Portal](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal),
  [support.zendesk.com — Using the new request list experience (Beta)](https://support.zendesk.com/hc/en-us/articles/4628113350170-Using-the-new-request-list-experience-in-the-help-center-customer-portal-Beta),
  [support.zendesk.com — Presenting ticket forms to end users](https://support.zendesk.com/hc/en-us/articles/4408842873498-Presenting-ticket-forms-to-end-users)
  (verificado 2026-08).

### Freshdesk — Support Portal (portal de tickets, traducción de estados)

- **Qué resuelve:** Lo mismo que Zendesk. Se incluye por **un solo patrón, que es el más
  directamente aplicable a Jiku**.
- **Cómo lo resuelve:** Freshdesk mantiene **dos vocabularios de estado en paralelo**: el que ve el
  agente y el que ve el cliente. El caso canónico documentado: el agente ve `Waiting on Customer` y
  el mismo ticket, para el cliente, dice `Awaiting your Reply`. Cualquier estado —incluidos los de
  fábrica— admite una **etiqueta de cara al cliente** distinta de la interna, y el producto ofrece
  control explícito sobre cómo se muestra el campo de estado en el portal. El set base es corto
  (Open, Pending, Resolved, Closed).
- **A tomar:** **El estado interno y el estado que se le comunica al cliente no tienen por qué ser
  la misma palabra.** Jiku tiene 7 estados diseñados para el flujo del equipo, y los muestra tal
  cual en Opus. Dos consecuencias: un nombre pensado para uso interno puede no significar nada para
  el cliente (o significar algo peor de lo que es), y —lo más valioso del patrón— la etiqueta puede
  **decirle al cliente si la pelota está de su lado**, que es la única pregunta accionable que un
  estado le responde a alguien que no ejecuta el trabajo.
- **A evitar:** Traducir estados desacopla dos vocabularios que después hay que mantener
  sincronizados. Y el set base de 4 estados de Freshdesk contra los 7 de Jiku sugiere que **el
  cliente puede no necesitar la misma granularidad que el equipo**: agrupar varios estados internos
  bajo una misma etiqueta pública es una opción, no solo renombrarlos uno a uno.
- **Fuente:** [support.freshdesk.com — Customizing your ticket statuses](https://support.freshdesk.com/en/support/articles/37600-customizing-your-ticket-statuses),
  [support.freshdesk.com — Customize customer ticket status list](https://support.freshdesk.com/support/discussions/topics/324832),
  [support.freshservice.com — Understanding custom ticket statuses](https://support.freshservice.com/support/solutions/articles/155560--understanding-custom-ticket-statuses)
  (verificado 2026-08).

## Referentes Indirectos

### Height (categoría: gestión de proyectos con acceso de invitado)

- **Qué expectativa trae a este producto:** El modelo de **guest** —alguien que solo ve lo que se
  le compartió explícitamente, y que puede comentar, marcar tareas como hechas y **crear tareas
  nuevas** dentro de las listas a las que tiene acceso— es el mismo contrato de Opus. Height agrega
  un matiz útil: el guest **puede** cambiar la configuración de vista y filtrar, pero **no puede
  guardar** esos cambios como vista propia. Es una distinción sensata para un usuario esporádico:
  se le da flexibilidad de lectura sin pedirle que configure nada permanente.
- **Cómo se manifiesta:** El cliente espera poder reordenar o filtrar lo que ve para encontrar algo,
  sin que eso implique haber configurado su espacio de trabajo. Y espera que lo que no le
  compartieron **no aparezca en absoluto** —ni siquiera atenuado o bloqueado.
- **Fuente:** [help.height.app — diferencia entre member y guest](https://help.height.app/en/articles/3991864-what-s-the-difference-between-a-workspace-member-and-a-guest),
  [forum.height.app — Guest/Client View](https://forum.height.app/t/guest-client-view/940)
  (verificado 2026-08).

### Aplicaciones de seguimiento de envíos y trámites (categoría: seguimiento esporádico)

- **Qué expectativa trae a este producto:** Es el arquetipo del uso esporádico y de baja
  frecuencia: el usuario entra una vez cada tanto, con **una sola pregunta** ("¿dónde está?"), y la
  respuesta tiene que estar completa en la primera pantalla sin navegar. De ahí viene la
  expectativa de una **línea de progreso con hitos** —dónde está, qué pasó antes, qué falta— en
  lugar de una etiqueta de estado sola.
- **Cómo se manifiesta:** Ante un requisito en estado `en_desarrollo`, el cliente espera entender
  qué significa eso **en relación con el recorrido completo**: cuántos pasos faltan, si eso es
  normal, cuándo cambió por última vez. Una etiqueta suelta no responde nada de eso.
- **Fuente:** Patrón de categoría, no verificado en un producto puntual en esta investigación.
  Se incluye como analogía explícita y **debe validarse con clientes reales** antes de tomarse como
  requisito.

## Patrones Recurrentes

- **El cliente nunca ve horas ni economía, y eso es invariante del producto** — Productive
  (worked time nunca visible), Teamwork (`View Time Log` como permiso aparte, apagado), Basecamp
  (todo privado por default). Ningún referente lo trata como preferencia configurable de bajo
  riesgo. La decisión estructural de Jiku coincide con el consenso de la categoría.
- **El alcance de lo visible es el proyecto, y se otorga uno por uno** — Basecamp, Teamwork,
  Productive y Height coinciden: el cliente entra a los proyectos a los que fue agregado, y de ahí
  no sale. Es literalmente lo que hace `user_project_permissions`.
- **El inventario de acciones del cliente es corto y cerrado** — ver, crear un pedido, comentar,
  a veces cerrar o adjuntar. Ningún referente le da al cliente edición de estructura,
  planificación ni asignación. Opus (ver, crear requisito, comentar, suscribirse) está dentro de
  ese rango.
- **Crear un pedido es una acción de primer nivel, siempre visible** — Zendesk ("Submit a request"
  arriba de todo), Freshdesk, Productive ("open new tasks"), Height. No está escondida dentro de
  un flujo: para el cliente es la mitad del producto.
- **La lista del cliente ordena por actualización, no solo por estado** — Zendesk expone la fecha
  de actualización como columna por defecto. Para quien entra cada tanto, "qué se movió" es más
  útil que "qué existe".
- **Formulario de alta corto, con selección de tipo al inicio** — Zendesk (varios formularios según
  el tipo de pedido), Freshdesk (campos por defecto acotados). El tipo se elige primero para poder
  pedir pocos campos después.

## Diferenciadores

Formulados como oportunidades, no como decisiones.

- **Tres vistas del mismo tablero (lista, kanban, acordeones en mobile)** — Jiku ya las tiene
  implementadas, y ningún portal de cliente del set ofrece esa elección. Es un diferenciador real
  **y una pregunta abierta al mismo tiempo**: para un usuario esporádico, elegir entre tres
  representaciones es una decisión que no pidió tomar, y hay riesgo de que la primera visita
  empiece por una elección en vez de por una respuesta. Puede jugar a favor si hay un default claro
  por contexto y la elección queda como refinamiento, no como puerta de entrada.
- **Visibilidad decidida por el sistema, no por el autor** — Basecamp y Teamwork le piden al equipo
  que marque cada ítem. Jiku define por regla que estado, título y descripción son públicos y el
  resto interno, y solo deja elegir en los comentarios. **Elimina la clase de error más costosa del
  modelo Basecamp** —el ítem interno publicado por accidente— en todo salvo un punto. La
  oportunidad simétrica: como el equipo no marca nada, tampoco puede olvidarse de publicar, así que
  el cliente siempre ve avance real sin depender de la disciplina de nadie.
- **La conversación ocurre donde ocurre el trabajo** — el PRD identifica que hoy el pedido llega
  por Mattermost, mail o reunión y se pierde. Los referentes de ticketing resuelven el registro
  pero desconectan el pedido de la ejecución; los de agencia conectan pero con el equipo adentro de
  la herramienta del cliente. Jiku puede ofrecer que **el comentario del cliente aparezca en el
  mismo feed cronológico donde el equipo ve los cambios de estado**, sin exportar ni sincronizar.
- **Compartir un entregable con alguien que no tiene cuenta** — ~~Jiku tiene el único endpoint no
  autenticado del producto para servir un adjunto marcado como público~~ **REQ-002 eliminó ese
  endpoint (2026-08-20): hoy Jiku no lo tiene.** La oportunidad **sigue en pie y sigue siendo
  diferencial** —ningún referente del set ofrece compartir un entregable con alguien sin cuenta, y
  el cliente que necesita mostrarle algo a un tercero de su organización que nunca va a entrar a
  Opus no tiene salida en ninguna herramienta del set— pero **ya no es una capacidad existente que
  el producto pueda capitalizar**: es una capacidad a construir. La razón del borrado no fue
  desinterés en el caso de uso sino que la implementación era una superficie HTTP sin autenticación
  con ids secuenciales enumerables. El criterio acordado para retomarla está registrado en REQ-002:
  una URL prefirmada emitida por `core`, con vencimiento. **No está capturada ni planificada.**

## Anti-patrones Detectados

- **Suscribirse a algo que no notifica nada** — no es un anti-patrón de los referentes sino un
  riesgo propio, y el benchmark lo hace visible por contraste: en Zendesk, Freshdesk, Basecamp y
  Teamwork, seguir un ítem produce mail. En Jiku la suscripción **registra interés y nada más**,
  porque no hay canal de notificación en el producto. Un control que promete algo que el sistema
  no puede cumplir es peor que su ausencia, sobre todo con un usuario esporádico, que es
  precisamente el que se quedaría esperando el aviso en vez de volver a entrar.
- **Mostrarle al cliente el vocabulario interno del equipo** — el patrón de Freshdesk existe porque
  el problema es real y frecuente. Los 7 estados de Jiku están nombrados para el flujo del equipo;
  `en_cola` le dice al equipo que todavía no arrancó, y al cliente puede decirle algo bastante
  distinto.
- **Vistas de cliente que son vistas de equipo con cosas apagadas** — riesgo del modelo de permisos
  de Teamwork. Se manifiesta como columnas vacías, filtros sin sentido y secciones inaccesibles.
  Jiku está estructuralmente protegido (aplicación separada), **con una excepción documentada**:
  el portal no corta navegación por rol, así que un `user` o `admin` que entre puede operar ahí
  —incluso cambiar estado y prioridad inline. Es la pregunta abierta 4 del PRD, y desde el punto de
  vista del cliente significa que hay controles de edición en el portal cuya existencia no fue
  diseñada para él.
- **Compartir de más al compartir por link** — reportado en el foro de Height: compartir una lista
  públicamente expone el detalle completo de las tareas y toda la conversación. **Ya no aplica al
  producto vivo: REQ-002 eliminó el adjunto público (2026-08-20)** y no queda ninguna vía de
  compartir hacia afuera. Se conserva porque es el riesgo que hay que resolver **antes** de volver a
  ofrecer compartir: el link tiene que exponer el archivo y **nada de su contexto**, y con
  vencimiento. Es el anti-patrón que el REQ que retome la feature va a tener que atacar de frente.
- **Dejar al usuario esporádico sin punto de partida** — la lista de tickets de Zendesk y Freshdesk
  no dice si el proyecto avanza, solo qué items hay. Para el cliente de una consultora, que entra
  una vez cada varias semanas, la primera pregunta no es "qué requisitos existen" sino "¿esto va
  bien?".

## Limitaciones del Benchmark

- **Ningún portal se pudo recorrer desde la piel del cliente.** Todo lo documentado sale de la
  documentación de producto y de ayuda, que describe **capacidades y permisos**, no la experiencia
  de entrar. Lo que un cliente ve en su primera pantalla de Basecamp, Teamwork o Productive
  —qué hay arriba, qué se lee primero, cuánto tarda en orientarse— **no está verificado en ninguno
  de los cinco**. Es el gap más grande de este benchmark, y justamente sobre el JTBD más
  importante de la audiencia.
- **Shortcut quedó sin cubrir.** Se buscó vista de cliente o acceso externo y no apareció
  documentación específica; lo único encontrado fue material de migración desde Height. No hay
  evidencia de que Shortcut tenga un modo cliente, y se declara como no verificado en vez de
  asumirlo.
- **Height se documentó desde la ayuda y un hilo de foro**, no desde el producto. La distinción
  member/guest está clara; el aspecto concreto de la vista de un guest, no.
- **No se encontró benchmark de "portal de cliente en mobile".** Es un gap señalado porque `opus-web`
  bajo 768 px pierde la navegación por completo (el sidebar desaparece y no se monta reemplazo), y
  el cliente es la audiencia con más probabilidad de abrir un link desde el teléfono. Ningún
  referente aportó material sobre cómo resuelven el portal de cliente en pantalla chica.
- **El referente de "seguimiento esporádico" (envíos/trámites) es una analogía, no un producto
  verificado.** Se marca como tal y no debería tratarse como evidencia hasta contrastarlo con
  clientes reales.
- **No hay input de ningún cliente real de Grava Digital.** A diferencia del equipo interno —que es
  su propia audiencia y está a una reunión de distancia— esta audiencia **no está en la oficina**.
  Todo lo que sigue en el research-context depende de eso.

---

**Próximo artefacto:** Este benchmark alimenta `research-context.md` de la misma audiencia con
material concreto para inferir pains, gains y JTBDs.
