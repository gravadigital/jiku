---
name: documento
surface: web
route: /docs/[id]
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: diseñada
version: "1.0"
date: 2026-10-24
---

# Pantalla: Documento

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — lee la documentación de un proyecto, requisito o tarea, y la corrige o la amplía sin pisar lo que otro esté escribiendo.
- **JTBD / Propósito:** leer un documento renderizado de forma segura, editarlo con la garantía de que nadie lo pisa en silencio, adjuntarle archivos y compartirlo por un link de solo lectura [REQ-016 RF-19, RF-20, RF-22].
- **Viewports:**
  - **desktop** — único viewport de la superficie.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- `documentacion` · fila de documento o resultado de búsqueda
- `detalle-proyecto`, `detalle-requisito`, `detalle-tarea` · fila de `card-documentacion`
- O-11 Nuevo documento · tras crear, entra directo en *editando*
- URL directa (`/docs/{id}`), por ejemplo un link pegado en un comentario

**Salidas user-driven:**
- A `documentacion` · `boton-volver` o un nivel de `breadcrumb-documento`
- A `detalle-proyecto` / `detalle-requisito` / `detalle-tarea` · click en un vínculo de `lista-vinculos`
- A O-12 Compartir documento · click en `boton-compartir`
- Descarga de un adjunto · click en un ítem de `lista-adjuntos-documento` (`/docs/attachments/{id}` → 302)

**Salidas automáticas:**
- Ninguna. Guardar y cancelar vuelven a *default* en la misma ruta.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | breadcrumb-documento | breadcrumbs | — | navigation | desktop | hidden_in_states: loading, not found | Carpeta del documento; cada nivel lleva a `documentacion` en esa carpeta |
| 2 | titulo-documento | heading | h1 | content | desktop | hidden_in_states: loading, not found | Título del documento |
| 3 | badge-visibilidad | badge | public / internal | content | desktop | hidden_in_states: loading, not found | Si el cliente puede verlo en el portal |
| 4 | meta-version | label | — | content | desktop | hidden_in_states: loading, not found | Versión, fecha y autor de la última actualización |
| 5 | boton-volver | button | secondary-nav | navigation | desktop | — | Vuelve a la documentación |
| 6 | boton-compartir | button | secondary-nav / disabled | input | desktop | visible solo con la función de compartir configurada **y** permiso `manage`; hidden_in_states: editando, conflicto de versión, reserva perdida; state_overrides: módulo no disponible→disabled | Abre O-12 |
| 7 | boton-editar | button | primary / disabled | input | desktop | visible solo con permiso `write` o `manage` y documento ≤ 256 KiB; hidden_in_states: editando, conflicto de versión, reserva perdida; state_overrides: bloqueado por otra persona→disabled, módulo no disponible→disabled | Entra en edición tomando la reserva |
| 8 | aviso-bloqueado | alert | info | feedback | desktop | visible_only_in_states: bloqueado por otra persona | Quién lo está editando y hasta cuándo |
| 9 | aviso-documento-grande | alert | info | feedback | desktop | visible solo si el documento llega por `contentUrl` | Explica por qué no se puede editar |
| 10 | aviso-no-disponible | alert | warning | feedback | desktop | visible_only_in_states: módulo no disponible | El módulo no responde |
| 11 | contenido-documento | paragraph | body (markdown renderizado) | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | El documento, renderizado sin HTML ni scripts |
| 12 | card-vinculos | card | panel | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | A qué cliente, proyecto, requisito o tarea está vinculado |
| 13 | lista-vinculos | list | — | navigation | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | Un enlace por vínculo |
| 14 | lista-temas | chips | — | content | desktop | hidden_in_states: loading, not found; oculto sin temas | Temas del documento |
| 15 | card-adjuntos-documento | card | panel | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | Adjuntos del documento |
| 16 | lista-adjuntos-documento | list | — | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | Un enlace por adjunto |
| 17 | indicador-reserva | label | — | feedback | desktop | visible_only_in_states: editando | Confirma que la persona tiene la reserva de edición |
| 18 | editor-markdown | textarea | default / disabled | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Texto markdown del documento, frontmatter incluido |
| 19 | vista-previa | paragraph | body (markdown renderizado) | content | desktop | visible_only_in_states: editando, reserva perdida | Cómo se va a ver lo que se está escribiendo |
| 20 | version-actual | paragraph | body (markdown renderizado) | content | desktop | visible_only_in_states: conflicto de versión | La versión que otra persona guardó, para copiar de ella |
| 21 | zona-adjuntar | section | Dropzone · default / uploading / error | input | desktop | visible_only_in_states: editando | Sube un archivo e inserta su enlace en el texto |
| 22 | campo-mensaje | text-input | default | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Descripción opcional del cambio |
| 23 | boton-guardar | button | primary / disabled | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida; state_overrides: guardando→disabled | Guarda una versión nueva |
| 24 | boton-cancelar | button | secondary-dismiss | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Descarta los cambios y libera la reserva |
| 25 | aviso-conflicto | alert | warning | feedback | desktop | visible_only_in_states: conflicto de versión | Otra persona guardó una versión nueva |
| 26 | aviso-reserva-perdida | alert | warning | feedback | desktop | visible_only_in_states: reserva perdida | La reserva venció o la tomó otra persona |
| 27 | cargando-documento | loader | block | feedback | desktop | visible_only_in_states: loading | Carga inicial |
| 28 | aviso-not-found | alert | error | feedback | desktop | visible_only_in_states: not found | Documento inexistente o sin permiso |
| 29 | toast-resultado | toast | success / warning / error | feedback | desktop | visible_only_in_states: success, error de sistema / sin conexión | Confirmación o fallo de guardado |

## Layout por viewport

### desktop · 1440px

- row `encabezado` (`space-between`)
  - col 8/12: breadcrumb-documento, titulo-documento, row de badge-visibilidad + meta-version
  - col 4/12: boton-volver, boton-compartir, boton-editar *(alineados a la derecha; primario último)*
- aviso-no-disponible · aviso-bloqueado · aviso-documento-grande · aviso-conflicto · aviso-reserva-perdida *(a lo sumo uno visible por vez, ancho completo)*
- row `lectura` *(default, bloqueado, no disponible)*
  - col 8/12: contenido-documento *(card `panel`)*
  - col 4/12:
    - card-vinculos (lista-vinculos, lista-temas)
    - card-adjuntos-documento (lista-adjuntos-documento)
- row `edicion` *(editando, reserva perdida)*
  - col 6/12: indicador-reserva, editor-markdown, zona-adjuntar
  - col 6/12: vista-previa
- row `conflicto` *(conflicto de versión)*
  - col 6/12: editor-markdown *(con el texto propio intacto)*
  - col 6/12: version-actual
- row `acciones-edicion` (`flex-end`): campo-mensaje *(8/12)*, boton-cancelar, boton-guardar

## Contenido

### breadcrumb-documento
- Texto/label: `"Documentación"` como primer nivel, luego la ruta de carpetas del documento
- Icono: nada
- Asset: nada
- Annotation: cada nivel navega a `/docs?folder={id}`; es la forma de llegar a los documentos vecinos

### titulo-documento
- Texto/label: dinámico desde el título del documento; sin título, el nombre de archivo sin `.md`
- Icono: nada
- Asset: nada
- Annotation: `ViewHeader` (Sora 30/700)

### badge-visibilidad
- Texto/label: `"Visible para el cliente"` (`public`) · `"Interno"` (`internal`)
- Icono: eye (público) · lock (interno)
- Asset: nada
- Annotation: lo decide el frontmatter del documento y la carpeta, no un control de esta pantalla; el badge es la única señal, antes de compartir o de escribir algo sensible, de que el texto llega al portal

### meta-version
- Texto/label: `"Versión {n} · actualizado el {DD/MM/AAAA HH:mm} por {persona}"`
- Icono: nada
- Asset: nada
- Annotation: `{persona}` se resuelve contra las personas de Jiku; si no se encuentra, `"otra persona"`

### boton-volver
- Texto/label: `"Volver"`
- Icono: arrow-left
- Asset: nada
- Annotation: `Button` `secondary-nav`; vuelve a la carpeta del documento en `documentacion`

### boton-compartir
- Texto/label: `"Compartir"`
- Icono: share
- Asset: nada
- Annotation: **no se renderiza** si la api no tiene la función de compartir configurada (`features.sharing: false`) ni si la persona no tiene `manage` en la carpeta [REQ-016 CA-32]. Si la carpeta bloquea el compartir, se renderiza y O-12 lo explica

### boton-editar
- Texto/label: `"Editar"`
- Icono: edit
- Asset: nada
- Annotation: al pulsarlo pide la reserva de edición; mientras responde, el botón queda deshabilitado con `Loader` `inline`. No se renderiza para quien solo puede leer ni para un documento grande

### aviso-bloqueado
- Texto/label: `"{persona} lo está editando hasta las {HH:mm}. Podés leerlo mientras tanto."`
- Icono: lock
- Asset: nada
- Annotation: aparece al abrir el documento si ya tiene una reserva vigente, o al pulsar "Editar" si otro la tomó antes. Si la reserva es de un agente (`via: agent`), `"Un agente lo está editando hasta las {HH:mm}…"` [REQ-016 CA-18]

### aviso-documento-grande
- Texto/label: `"Este documento es demasiado grande para editarlo desde acá. Podés leerlo y editarlo con jiku-go."`
- Icono: info
- Asset: nada
- Annotation: documentos de más de 256 KiB llegan por URL de contenido; se muestran en solo lectura [REQ-016 Supuestos]

### aviso-no-disponible
- Texto/label: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Icono: warning
- Asset: nada
- Annotation: mismo texto en las cinco pantallas que muestran documentación

### contenido-documento
- Texto/label: el markdown del documento, renderizado; el frontmatter no se muestra
- Icono: nada
- Asset: imágenes adjuntas a ancho máximo del panel
- Annotation: **nunca ejecuta HTML ni scripts**: el HTML crudo se muestra como texto y los enlaces solo pueden ser `http(s)`, `mailto` o adjuntos. Todo enlace o imagen cuyo path sea `/docs/attachments/{id}` —relativo o con cualquier host— se reescribe a `/docs/attachments/{id}` de la web, que lo resuelve con la sesión [REQ-016 CA-28, CA-33]

### card-vinculos
- Texto/label: título `"Vinculado a"`; vacío `"Este documento no está vinculado a ningún proyecto, requisito ni tarea."`
- Icono: link
- Asset: nada
- Annotation: `Card` `panel`

### lista-vinculos
- Texto/label: una fila por vínculo, con su tipo: `"Cliente"` · `"Proyecto"` · `"Requisito"` · `"Tarea"` y el nombre como enlace
- Icono: nada
- Asset: nada
- Annotation: los vínculos se escriben en el frontmatter; esta lista los muestra, no los edita

### lista-temas
- Texto/label: título `"Temas"`; un `Badge` por tema
- Icono: nada
- Asset: nada
- Annotation: sin temas, el bloque no se renderiza

### card-adjuntos-documento
- Texto/label: título `"Adjuntos"`; vacío `"Sin adjuntos."`
- Icono: file
- Asset: nada
- Annotation: `Card` `panel`

### lista-adjuntos-documento
- Texto/label: un enlace por adjunto con su nombre de archivo
- Icono: download
- Asset: nada
- Annotation: cada enlace apunta a `/docs/attachments/{id}`, el link estable de la web (sesión → api → 302) [REQ-016 RF-16]

### indicador-reserva
- Texto/label: `"Lo estás editando. Nadie más puede guardar hasta que termines."`
- Icono: lock
- Asset: nada
- Annotation: la reserva dura 120 s y se renueva sola cada 60 s mientras el editor está abierto; la persona no tiene que hacer nada [REQ-016 CA-29]

### editor-markdown
- Texto/label: label `"Contenido (markdown)"`; sin placeholder
- Icono: nada
- Asset: nada
- Annotation: `Input` `textarea`, fuente monoespaciada, alto mínimo de la ventana. Incluye el frontmatter: es donde se cambian vínculos, temas y visibilidad. En *conflicto de versión* conserva el texto propio, sin tocarlo

### vista-previa
- Texto/label: título `"Vista previa"`; mismo render que contenido-documento
- Icono: eye
- Asset: nada
- Annotation: se actualiza mientras se escribe (debounce 300 ms), con las mismas reglas de seguridad que el visor

### version-actual
- Texto/label: título `"Versión {n}, guardada por {persona}"`; el contenido de esa versión en texto plano, seleccionable
- Icono: nada
- Asset: nada
- Annotation: se muestra como texto y no renderizado, para poder copiar fragmentos exactos al editor

### zona-adjuntar
- Texto/label: `"Arrastrá un archivo acá o hacé click para adjuntarlo"`. Subiendo: `"Subiendo {nombre del archivo}…"`. Rechazado: el mensaje del módulo — `"Ese tipo de archivo no está permitido."` · `"El archivo supera el tamaño máximo permitido."`
- Icono: upload
- Asset: nada
- Annotation: `Dropzone`. Al terminar la subida inserta en la posición del cursor `![nombre](/docs/attachments/{id})` para imágenes y `[nombre](/docs/attachments/{id})` para el resto. De a un archivo por vez, como en el resto de la superficie

### campo-mensaje
- Texto/label: label `"Qué cambiaste (opcional)"`; placeholder `"Ej.: agrego los pasos de despliegue"`
- Icono: nada
- Asset: nada
- Annotation: queda como mensaje de la versión nueva

### boton-guardar
- Texto/label: `"Guardar"`; en *conflicto de versión*, `"Guardar sobre la versión {n}"`
- Icono: check
- Asset: nada
- Annotation: guarda con la versión sobre la que se empezó a editar. En *conflicto de versión* la base pasa a ser la versión actual: guardar ahí es una decisión explícita después de ver lo que el otro escribió, nunca un reintento automático [REQ-016 CA-30]

### boton-cancelar
- Texto/label: `"Cancelar"`
- Icono: nada
- Asset: nada
- Annotation: con cambios sin guardar pide confirmación con O-02 (`"Descartar cambios"` · `"Vas a perder lo que escribiste desde la última vez que guardaste."` · `"Descartar"` / `"Seguir editando"`). Libera la reserva

### aviso-conflicto
- Texto/label: `"{persona} guardó la versión {n} mientras editabas. Tu texto sigue acá: compará con la versión actual y guardá cuando estés listo."`
- Icono: warning
- Asset: nada
- Annotation: `role="alert"`

### aviso-reserva-perdida
- Texto/label: `"Se perdió la reserva de edición. Tu texto sigue acá; si nadie más lo tomó, vas a poder guardar igual."`
- Icono: warning
- Asset: nada
- Annotation: aparece si una renovación falla (venció por falta de conexión o la tomó otra persona). Al guardar, si otra persona tiene la reserva, pasa a *bloqueado por otra persona* conservando el texto en el editor

### cargando-documento
- Texto/label: `"Cargando documento…"`
- Icono: nada
- Asset: nada
- Annotation: `Loader` `block`

### aviso-not-found
- Texto/label: `"Este documento no existe o no tenés permiso para verlo."`
- Icono: error
- Asset: nada
- Annotation: mismo texto para inexistente y sin permiso: la diferencia no le sirve a quien lo lee y sí le serviría a quien prueba ids. boton-volver queda como salida

### toast-resultado
- Texto/label: éxito `"Guardaste la versión {n}."` · éxito con aviso `"Guardaste la versión {n}. Revisalo: parece contener una clave o un token."` · error `"No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo."`
- Icono: nada
- Asset: nada
- Annotation: el aviso de posible secreto no bloquea el guardado [REQ-016 Cambios de API, ruta 9]

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base, lectura)

### empty
- Aplica: No — un documento siempre tiene contenido; un documento vacío se muestra vacío dentro del panel.

### loading
- Aplica: Sí
- Mensaje: `"Cargando documento…"`
- Cambios:
  - cargando-documento: visible
  - el resto, salvo boton-volver: oculto

### error de validación
- Aplica: Sí
- Mensaje: errores del módulo al guardar — `"El frontmatter no es válido: {detalle}. Corregilo y volvé a guardar."` (`frontmatter_invalid`) · `"Uno de los vínculos no existe: {detalle}."` (`invalid_relation`) · `"El documento supera los 256 KiB que se pueden guardar desde acá."` (`content_too_large`)
- Cambios:
  - editor-markdown: state=error, con el mensaje debajo
  - boton-guardar: habilitado para reintentar

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo."`
- Cambios:
  - toast-resultado: variant=error
  - editor-markdown: conserva el texto

### success
- Aplica: Sí
- Mensaje: `"Guardaste la versión {n}."`
- Cambios:
  - toast-resultado: variant=success
  - vuelve a *default* con la versión nueva y la reserva liberada

### not found
- Aplica: Sí
- Mensaje: `"Este documento no existe o no tenés permiso para verlo."`
- Cambios:
  - aviso-not-found: visible
  - todo lo demás salvo boton-volver: oculto

### estado terminal / readonly
- Aplica: Sí
- Mensaje: — (sin permiso de escritura) · `"Este documento es demasiado grande para editarlo desde acá…"` (documento grande)
- Cambios:
  - boton-editar: no se renderiza
  - aviso-documento-grande: visible solo en el caso del documento grande

### bloqueado por otra persona (parent_state: default)
- Aplica: Sí [REQ-016 CA-18]
- Mensaje: `"{persona} lo está editando hasta las {HH:mm}. Podés leerlo mientras tanto."`
- Cambios:
  - aviso-bloqueado: visible
  - boton-editar: disabled
- Se revisa al volver a la pestaña y cada 60 s: cuando la reserva vence, el aviso desaparece y "Editar" se habilita

### editando (parent_state: default)
- Aplica: Sí [REQ-016 CA-29]
- Mensaje: `"Lo estás editando. Nadie más puede guardar hasta que termines."`
- Cambios:
  - indicador-reserva, editor-markdown, vista-previa, zona-adjuntar, campo-mensaje, boton-guardar, boton-cancelar: visibles
  - contenido-documento, boton-editar, boton-compartir: ocultos
  - card-vinculos y card-adjuntos-documento: ocultos (la columna derecha la ocupa la vista previa)

### conflicto de versión (parent_state: editando)
- Aplica: Sí [REQ-016 CA-17, CA-30]
- Mensaje: `"{persona} guardó la versión {n} mientras editabas. Tu texto sigue acá: compará con la versión actual y guardá cuando estés listo."`
- Cambios:
  - aviso-conflicto: visible
  - version-actual: visible en lugar de vista-previa
  - boton-guardar: content=`"Guardar sobre la versión {n}"`
  - zona-adjuntar: oculta

### reserva perdida (parent_state: editando)
- Aplica: Sí
- Mensaje: `"Se perdió la reserva de edición. Tu texto sigue acá; si nadie más lo tomó, vas a poder guardar igual."`
- Cambios:
  - aviso-reserva-perdida: visible
  - indicador-reserva: oculto

### módulo no disponible (parent_state: default)
- Aplica: Sí [REQ-016 RF-23, CA-27]
- Mensaje: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - aviso-no-disponible: visible
  - boton-editar y boton-compartir: disabled
  - contenido-documento: se muestra si ya estaba cargado; si no, oculto

## Interacciones

**Eventos:**
- boton-editar · on click → toma la reserva (`POST …/lock` con un id de sesión nuevo); éxito → *editando*; `document_locked` → *bloqueado por otra persona*
- editor abierto · cada 60 s → renueva la reserva con el mismo id de sesión; si falla → *reserva perdida*
- boton-guardar · on click → `PUT /docs/documents/{id}` con la versión base; éxito → libera la reserva y vuelve a *default*; `version_conflict` → *conflicto de versión*; `document_locked` → *bloqueado por otra persona* conservando el texto
- boton-cancelar · on click → (confirmación si hay cambios) libera la reserva y vuelve a *default*
- cerrar la pestaña o salir de la ruta con el editor abierto → libera la reserva con un pedido `keepalive`; si no llega, vence a los 120 s
- zona-adjuntar · on drop / click → pide la subida, sube el archivo, confirma e inserta el enlace en el cursor
- boton-compartir · on click → abre O-12
- vínculo de lista-vinculos · on click → navega a la ficha correspondiente
- adjunto de lista-adjuntos-documento · on click → abre `/docs/attachments/{id}` en pestaña nueva

**Validaciones:**
- editor-markdown · las valida el módulo al guardar (ver *error de validación*); la web no anticipa el formato del frontmatter

**Feedback:**
- Guardado: toast y vuelta a lectura con la versión nueva en meta-version
- Posible secreto detectado: toast de aviso, sin bloquear
- Navegar fuera con cambios sin guardar: confirmación del navegador

## Accesibilidad

- **Orden de foco:** boton-volver → boton-compartir → boton-editar → aviso visible (si lo hay) → enlaces de contenido-documento → lista-vinculos → lista-adjuntos-documento. En edición: editor-markdown → zona-adjuntar → campo-mensaje → boton-cancelar → boton-guardar.
- **Landmarks y jerarquía:** `main` con un único h1 (titulo-documento). Los títulos del markdown se desplazan un nivel (el `#` del documento se renderiza como h2) para no competir con el h1 de la pantalla.
- **Foco y teclado:** al entrar en edición el foco va a editor-markdown; al guardar o cancelar vuelve a boton-editar. O-12 atrapa el foco mientras está abierto.
- **Propio de esta composición:** aviso-conflicto, aviso-reserva-perdida y aviso-bloqueado (cuando aparece al pulsar "Editar") se anuncian con `role="alert"`; la renovación silenciosa de la reserva no se anuncia.

## Decisiones y descartes

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas:**
- **Editor de markdown plano con vista previa al lado, no WYSIWYG.** Es el supuesto del pedido, y el frontmatter —que es donde viven vínculos, temas y visibilidad— no tiene representación en un editor visual [REQ-016 Supuestos].
- **Vista previa en columna y no en una pestaña.** A 1440 px entran las dos mitades legibles, y alternar pestañas para ver cómo queda una tabla es justo el ida y vuelta que la vista previa viene a evitar.
- **Un visor y un editor en la misma ruta.** Editar es un estado del documento, no otro lugar; una ruta `/edit` separada haría que recargar la página soltara la reserva sin que la persona lo decida.
- **La reserva es invisible mientras funciona.** Se toma al pulsar "Editar", se renueva sola y se libera al salir; la persona solo la ve cuando algo sale mal. Una cuenta regresiva visible convertiría un mecanismo técnico en una tarea.
- **El conflicto conserva el texto propio y muestra el ajeno al lado, en texto plano.** Nunca se reintenta solo y nunca se descarta lo escrito [REQ-016 CA-30]. Se descartó un diff automático: es un componente nuevo y el caso es infrecuente; copiar y pegar entre dos columnas resuelve lo mismo.
- **"Inexistente" y "sin permiso" comparten mensaje.** El módulo responde distinto, pero la diferencia solo le sirve a quien prueba ids.
- **El badge de visibilidad está siempre visible.** Es la única señal antes de compartir o escribir algo sensible de que el documento llega al portal del cliente.
- **Sin historial de versiones, mover, borrar ni restaurar en esta entrega.** La api los expone; el pedido no los pone en la interfaz y la administración vive en jiku-go [REQ-016 RF-12, §Fuera de Alcance].

**Alternativas descartadas:**
- Overlay de edición a pantalla completa: escondería los vínculos y los adjuntos justo cuando se insertan enlaces a ellos.
- Notificar en vivo que otra persona guardó: la web no escucha el bus; se ve al guardar o al recargar [REQ-016 Supuestos].

**Preguntas abiertas:**
- ¿Conviene ofrecer "Nuevo documento" prellenado desde el panel de una ficha (con el vínculo ya escrito en el frontmatter)? Hoy el alta solo existe en `documentacion`.
