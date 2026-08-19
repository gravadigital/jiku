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

### Errores y recuperación

- **Sin proyectos asignados** — El sidebar queda vacío y aparece **"No tienes proyectos
  asignados"**. El mensaje es **ambiguo**: no distingue entre "no te asignaron ninguno todavía",
  "perdiste el permiso" y "tu alta falló". El cliente no tiene ninguna acción posible desde acá.
- **Fallan las 7 queries del tablero** — **Se ve un tablero vacío, indistinguible de un proyecto
  sin requisitos** [fuente: código-existente]. No hay estado de error.
- **`projectId` inexistente** — **No da 404**: no hay `not-found.tsx` en ninguna ruta.
- **En mobile** — 🔴 **No hay navegación.** El sidebar desaparece y no se monta reemplazo: el
  cliente **no puede cambiar de proyecto ni cerrar sesión**. Si entró desde un link a un proyecto,
  queda encerrado en él.

### Estado final

El cliente sabe en qué estado está cada requisito de su proyecto, y puede leer la actividad pública
de cualquiera de ellos.

### Criterios de éxito

- Un cliente que entra **cada varias semanas** debería orientarse sin recordar nada de la visita
  anterior
- La pregunta "¿avanzó lo que pedí?" debería responderse **desde la primera pantalla**, sin abrir
  nada
- El flujo debería funcionar desde un teléfono — **hoy no funciona**

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
- **Ver un cambio de campo** — Se renderiza como *"{Autor} cambió {Campo} de {X} a {Y}"*.
- **Abrir un adjunto** — Preview embebido para imágenes, descarga para el resto. Si el contenido
  del archivo nunca llegó al sistema, dice *"El archivo no está disponible"* en lugar de fallar de
  forma opaca (REQ-001 RF-21, CA-15).

### Errores y recuperación

- **Comentario vacío** — No se envía, **sin mensaje**.
- 🔴 **Fallo de suscripción** — El error es **la palabra "Error" en el propio botón**, con el
  motivo en un atributo `title` — **invisible en touch** [fuente: código-existente].
- **Foco tras enviar** — No vuelve al editor: el cliente tiene que volver a hacer clic para
  escribir otro comentario.

### Estado final

El comentario está en el feed, visible para el equipo en `web` y para cualquier otro usuario del
proyecto.

### Criterios de éxito

- El cliente debería ver **solo lo público**, y no debería poder inferir que existe actividad
  interna — **hoy se cumple**: el feed filtra del lado del servidor
- Suscribirse debería producir **algo**. Hoy no produce nada (FG-2)

---

El detalle de cada pantalla está en [`screens/`](screens/), y lo que falta en la interfaz actual en
[`gaps-as-is.md`](../../gaps-as-is.md).
