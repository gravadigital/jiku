---
document: UX User Flows
surface: opus-web
version: 1.0
date: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — brownfield
---

> Flujos críticos internos de la superficie **opus-web**, el portal de clientes. La superficie
> tiene 5 pantallas, así que los flujos son pocos y cortos por diseño. Inferidos de la navegación
> relevada [fuente: código-existente].
>
> Los flujos que cruzan a `web` viven en
> [`cross-surface-flows.md`](../../cross-surface-flows.md).

## Flujos Documentados

| # | Flujo | JTBD que resuelve | Audiencia |
|---|---|---|---|
| 1 | Consultar el avance de mis proyectos | Saber en qué está lo que pedí, sin preguntar | cliente |
| 2 | Pedir algo nuevo | Registrar un pedido para que quede formalizado | cliente |
| 3 | Conversar sobre un requisito | Aclarar o aportar contexto sobre un pedido | cliente |

---

## Flujo 1: Consultar el avance de mis proyectos

**JTBD que resuelve:** "Cuando quiero saber en qué está lo que pedí, quiero verlo yo mismo, para
no tener que escribirle a alguien y esperar."
**Audiencia:** cliente ([research-context](../../audiences/cliente/research-context.md))
**Trigger:** el cliente entra al portal, típicamente después de bastante tiempo sin entrar.

Es el flujo principal de la superficie y el que justifica su existencia. Todo el resto es
secundario.

### Happy path

1. **login** → botón único que delega en Zitadel
2. **login-entrada** → callback, sin UI propia
3. **proyectos-redireccion** → **redirige automáticamente al primer proyecto por orden
   alfabético** [fuente: código-existente]
4. **tablero-requisitos** → el cliente ve todos los requisitos del proyecto agrupados por estado,
   con `resuelto` y `cancelado` **colapsados** para que lo activo quede arriba
5. Abre uno → **detalle-requisito** (o su modal) → ve la descripción y el feed de actividad pública

### Caminos alternativos

- **Cambiar de proyecto** — Desde el **sidebar**, que lista los proyectos ordenados. Es la única
  navegación de la superficie.
- **Cambiar de vista** — Toggle entre **lista** (default) y **kanban** vía `?view=`.
- **En mobile** — Bajo 768 px monta `MobileRequirementsBoard`: **acordeones por estado, todos
  colapsados al abrir**. Es otro árbol de componentes, no un reflow.
- **Ver más de un estado** — Cada estado pagina **independientemente**, de a 20, con su propio
  "Ver más".
- **Ver un requisito que no pidió una persona** — Camino de lectura **nuevo desde REQ-005**. La
  columna "AUTOR" del tablero puede traer una identidad de servicio: un conector externo que crea
  requisitos por el bus. Va acompañada de un badge **"Automático"**, para que el cliente no lea el
  nombre de un servicio creyendo que es alguien del equipo. **En mobile no aparece**, porque la card
  del acordeón no muestra autor: ahí el cliente lo descubre recién al abrir el requisito (RF-3,
  RF-10).
- **Primera entrada de un cliente al que todavía no le dieron acceso** — Camino de entrada **nuevo
  desde REQ-007**, y el que más gente nueva va a recorrer. Hasta acá, una identidad autenticada sin
  fila en `users` chocaba contra un 401 `user_not_found` y no entraba; ese 401 desapareció de las 61
  rutas de la api, así que ahora **entra** y la api le devuelve `200 []` porque no tiene ninguna fila
  en `user_project_permissions` (CA-12, CA-13). Recorre `login → login-entrada → proyectos-redireccion`
  y **se queda ahí**: es el estado `empty`, que dejó de ser un borde para ser la pantalla de
  bienvenida de todo cliente nuevo. Ve *"Todavía no tenés acceso a ningún proyecto"*, un texto que le
  dice que el acceso lo concede el equipo y a quién escribirle, y un botón de **Cerrar sesión** —que
  en mobile es la única salida que existe, porque el sidebar no se renderiza. **El happy path arranca
  recién cuando alguien le concede el permiso desde afuera del portal**, y el cliente lo descubre en
  su próxima visita: no hay notificación ni polling.
- **Entrar desde un link viejo de adjunto** — Camino de entrada **nuevo desde REQ-002**. Alguien
  abre `/attachments/123/informe.pdf` desde un correo de hace meses: la ruta ya no existe y
  `attachments` salió del matcher, así que el guard lo alcanza y lo manda a **login** (RF-1, RF-2,
  CA-1). Si tiene cuenta, entra y sigue el happy path hasta el requisito que tiene el adjunto y lo
  abre por el camino autenticado. **Es el único camino del flujo que empieza sin intención de
  entrar al portal:** el usuario venía a abrir un archivo. La pantalla de login no se lo dice —no
  hay mensaje contextual, es un descarte explícito del REQ— así que la orientación depende de que
  reconozca el portal.

### Errores y recuperación

- **Sin proyectos asignados** — **Ya no es un error: es el estado de entrada de todo cliente nuevo**
  [REQ-007 CA-13]. Se mantiene listado acá porque el cliente lo puede leer como una falla si la
  pantalla no le explica nada, que es exactamente lo que pasaba antes. El sidebar queda vacío y la
  pantalla dice **"Todavía no tenés acceso a ningún proyecto"** más un cuerpo que nombra la causa y
  la vía de resolución. De las tres lecturas ambiguas que tenía el mensaje anterior, **"tu alta
  falló" dejó de existir** —con REQ-007 no hay alta que fallar, `core` espeja la identidad desde el
  comando (CA-9, CA-11)—; las otras dos, "no te asignaron ninguno todavía" y "perdiste el permiso",
  siguen sin distinguirse **a propósito**: el portal no le confirma a un externo qué existe del otro
  lado (REQ-006 §22). El cliente ahora sí tiene una acción posible: **cerrar sesión**. Lo que no
  tiene es forma de pedir el acceso desde el producto — `user_project_permissions` no tiene interfaz
  de administración (FG-1) y no hay canal de notificación (FG-2).
- **Fallan las 7 queries del tablero** — **Se ve un tablero vacío, indistinguible de un proyecto
  sin requisitos** [fuente: código-existente]. No hay estado de error.
- **`projectId` inexistente** — **No da 404**: no hay `not-found.tsx` en ninguna ruta.
- **Link viejo de adjunto, ya con sesión** — Un cliente logueado que pegue
  `/attachments/123/informe.pdf` pasa el guard y cae en el **404 por defecto de Next**, sin chrome
  ni forma de volver [REQ-002 CA-2]. **No hay recuperación guiada:** tiene que volver atrás en el
  navegador o reescribir la URL del portal. El adjunto sigue estando —dentro del requisito que lo
  tiene— pero nada en esa página lo lleva ahí.
- **Sin cuenta en el portal** — Quien abra un link viejo y **no tenga usuario** queda en login sin
  poder pasar. **Es el resultado buscado, no una falla:** el REQ decide que el acceso a un archivo
  exige sesión sin excepciones (RF-8) y acepta que los links en circulación rompan sin transición
  ni aviso (RF-7). Lo que el flujo no ofrece es una salida: no hay texto que explique por qué no
  puede entrar ni a quién pedirle acceso.
- **En mobile** — 🔴 **No hay navegación.** El sidebar desaparece y no se monta reemplazo: el
  cliente **no puede cambiar de proyecto ni cerrar sesión**. Si entró desde un link a un proyecto,
  queda encerrado en él. **Con una excepción desde REQ-007:** en el estado sin proyectos, el botón
  de cerrar sesión vive en la pantalla y no en el chrome, así que ahí sí hay salida. Es un parche
  puntual sobre el recorrido que el REQ vuelve frecuente, **no** la solución del gap: montar el
  `MobileMenu` sigue pendiente (pregunta abierta 1 de la superficie).

### Estado final

El cliente sabe en qué estado está cada requisito de su proyecto, y puede leer la actividad pública
de cualquiera de ellos.

### Criterios de éxito

- Un cliente que entra **cada varias semanas** debería orientarse sin recordar nada de la visita
  anterior
- La pregunta "¿avanzó lo que pedí?" debería responderse **desde la primera pantalla**, sin abrir
  nada
- El flujo debería funcionar desde un teléfono — **hoy no funciona**
- Un cliente que entra por primera vez y todavía no tiene acceso debería entender **que el producto
  funciona y que le falta un permiso**, no creer que se rompió — criterio **nuevo desde REQ-007**,
  que es el que convierte ese recorrido en el más frecuente de los primeros

---

## Flujo 2: Pedir algo nuevo

**JTBD que resuelve:** "Cuando necesito algo del equipo, quiero dejarlo registrado en un lugar que
los dos miremos, para que no se pierda en un chat."
**Audiencia:** cliente
**Trigger:** botón **"Nuevo requisito"** del sidebar, o desde el tablero.

### Happy path

1. Abre el **modal de creación** (overlay O-02)
2. Escribe el **título** — es el **único campo obligatorio** [fuente: código-existente]
3. Opcionalmente: descripción con adjuntos, proyecto, prioridad, tipo, suscriptores
4. El **estado se muestra como un chip fijo "Análisis"**, no editable
5. Crea → **pantalla de éxito durante 1,8 segundos** → el modal cierra y el requisito aparece en la
   columna Análisis

### Caminos alternativos

- **Adjuntar archivos** — Se suben **antes de que el requisito exista**, de a uno por vez y con
  progreso real, y el vínculo se crea al guardar (REQ-001 RF-1, RF-4, RF-7, RF-8). El archivo ya no
  es un borrador esperando una entidad: **existe por sí solo**, así que si el cliente abandona el
  modal el archivo no queda huérfano ni se pierde. El tamaño máximo y los tipos permitidos los
  decide el servidor y son **configurables** (RF-6, RF-15): la interfaz no los anticipa.
- **Elegir suscriptores** — Selector contra los usuarios del proyecto.
- **Elegir tipo** — 4 valores con descripción propia: funcionalidad ("nueva función del sistema"),
  mejora ("optimización de algo existente"), incidencia ("bug, error o comportamiento
  inesperado"), otro ("tarea operativa, documentación, gestión"). **El default es `otro`.**

### Errores y recuperación

- 🔴 **Fallo de creación** — **El modal no muestra ningún error.** El botón vuelve de "Creando..."
  a "Crear elemento" **sin mensaje** [fuente: código-existente]. El cliente no sabe si se creó, y
  la recuperación probable es reintentar — con riesgo de duplicar.
- 🔴 **Y desde [REQ-004] hay dos fallas distintas detrás de ese silencio.** La api separa
  `503 service_unavailable` (*"El servicio no está disponible en este momento"* — el requisito
  **no** se creó, reintentar es seguro) de `504 gateway_timeout` (*"La operación tardó demasiado"*
  — **pudo** haberse creado, reintentar duplica) — RF-16, CA-8, CA-9. **El portal no muestra
  ninguno de los dos.** El desdoblamiento mejora el diagnóstico del lado del servidor y **no cambia
  nada de lo que el cliente ve**: la información que resolvería el gap de arriba ya existe y la
  superficie la descarta. Y el duplicado no se queda acá — aparece en `listado-requisitos` de `web`
  como dos pedidos idénticos (ver [cross-surface-flows](../../cross-surface-flows.md), flujo 1).
- **Adjunto inválido** — Lo rechaza el servidor con *"El archivo supera el tamaño máximo
  permitido"* o *"Ese tipo de archivo no está permitido"* (REQ-001 RF-6, RF-15). El mensaje llega
  **después** de intentar subir, no antes.
- **Un adjunto falló del lado del servidor** — Se descarta **toda** la creación del requisito. Los
  archivos ya subidos **no se pierden**: siguen existiendo y se pueden volver a usar (RF-1).
- **Adjunto de otro actor** — Un archivo subido por otra persona o por otro servicio **no se puede
  adjuntar**, sin excepción por rol (REQ-001 RF-12, RF-13, CA-11, CA-12).

### Estado final

El requisito existe en estado `analisis` y aparece en el tablero. **El equipo lo ve en `web` con
el mismo estado.**

### Criterios de éxito

- Pedir algo debería costar **un título**: todo lo demás es opcional a propósito
- El cliente debería saber **con certeza** si su pedido se registró — hoy, ante un fallo, no lo sabe

---

## Flujo 3: Conversar sobre un requisito

**JTBD que resuelve:** "Cuando el equipo necesita contexto o yo tengo algo que aclarar, quiero
dejarlo escrito junto al pedido, no en un mail aparte."
**Audiencia:** cliente
**Trigger:** el cliente abre un requisito y escribe en el editor del panel de actividad.

### Happy path

1. **detalle-requisito** → el feed muestra comentarios y cambios de campo mezclados en orden
   **cronológico ascendente**, con fechas relativas en español [fuente: código-existente]
2. Escribe un comentario, opcionalmente con adjuntos embebidos — se suben de a uno, con progreso real (REQ-001 RF-7, RF-8)
3. Envía → el comentario aparece en el feed
4. Los comentarios del cliente **se crean siempre como `public`**

### Caminos alternativos

- **Suscribirse al requisito** — Botón visible **solo para `external-user`**. 🔴 **No dispara
  ninguna notificación**: no hay canal en el producto. Desde la interfaz, la acción **no tiene
  consecuencia observable**.
- **Ver un cambio de campo** — Se renderiza como *"{Autor} cambió {Campo} de {X} a {Y}"*. **Desde
  REQ-005** ese `{Autor}` puede ser una identidad de servicio, y entonces lleva el badge
  **"Automático"** al lado del nombre. En un comentario la marca es doble: el badge y el avatar,
  que en vez de iniciales muestra un icono — las iniciales de "Conector Portal" son "CP" y se leen
  como una persona (RF-3, RF-10).
- **Abrir un adjunto** — Preview embebido para imágenes, descarga para el resto. Si el contenido
  del archivo nunca llegó al sistema, dice *"El archivo no está disponible"* en lugar de fallar de
  forma opaca (REQ-001 RF-21, CA-15). **Desde REQ-002 este es el único camino a un archivo:** abrir
  un adjunto **exige sesión en todos los casos** y `visibilityLevel: 'public'` sobre el requisito
  ya no habilita acceso anónimo — pasa a significar solo *"visible para usuarios externos
  autenticados"*, que es lo que ya significaba en el resto del producto (RF-8, CA-8).
- **Compartir un adjunto hacia afuera** — **No existe, y su ausencia es deliberada.** Hasta REQ-002
  el cliente podía copiar la URL de un adjunto y mandársela a alguien de su organización que no
  tuviera cuenta; ese camino se eliminó y **no se reemplazó por nada** (RF-8). No hay botón de
  compartir, ni link con vencimiento, ni copia de URL: para que un tercero vea el archivo hay que
  darle acceso al proyecto. El REQ deja anotado el criterio para el día que se retome —lo que
  circule afuera debería ser una prefirmada emitida por `core`, con vencimiento— pero **no lo
  captura ni lo planifica**.

### Errores y recuperación

- **Comentario vacío** — No se envía, **sin mensaje**.
- 🔴 **Fallo de suscripción** — El error es **la palabra "Error" en el propio botón**, con el
  motivo en un atributo `title` — **invisible en touch** [fuente: código-existente].
- **Falla del bus al comentar** — El comentario es un comando del bus, así que hereda el
  desdoblamiento de [REQ-004 RF-16, CA-8, CA-9]: con `503 service_unavailable` el comentario **no**
  se agregó y reintentar es seguro; con `504 gateway_timeout` **pudo** haberse agregado y reintentar
  deja **dos comentarios iguales** en un feed que el equipo también lee. El mensaje llega al
  `<p role="alert">` del editor, que ya renderiza el `message` del `ApiError` — no hace falta tocar
  nada. Lo que falta es lo de siempre: como el envío exitoso **no tiene confirmación**, el cliente
  tiene que releer el feed para saber si duplicar o no.
- **Foco tras enviar** — No vuelve al editor: el cliente tiene que volver a hacer clic para
  escribir otro comentario.

### Estado final

El comentario está en el feed, visible para el equipo en `web` y para cualquier otro usuario del
proyecto.

### Criterios de éxito

- El cliente debería ver **solo lo público**, y no debería poder inferir que existe actividad
  interna — **hoy se cumple**: el feed filtra del lado del servidor
- Suscribirse debería producir **algo**. Hoy no produce nada (FG-2)
- El cliente no debería creer que le escribió una persona cuando le escribió un servicio —
  **se cumple desde REQ-005** con la marca de autoría automática, en el badge y en el avatar

---

El detalle de cada pantalla está en [`screens/`](screens/), y lo que falta en la interfaz actual en
[`gaps-as-is.md`](../../gaps-as-is.md).
