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
version: "2.1"
date: 2026-10-26
---

# Pantalla: Documento

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — lee la documentación de un proyecto, requisito o tarea, la corrige o la amplía sin pisar lo que otro esté escribiendo, y recupera lo que había antes si hace falta.
- **JTBD / Propósito:** leer un documento renderizado de forma segura sabiendo a qué cliente y proyecto pertenece, editar su texto y sus propiedades con la garantía de que nadie lo pisa en silencio, ver su historial de versiones, adjuntarle archivos y compartirlo por un link de solo lectura [REQ-016 RF-19, RF-20, RF-22; REQ-021 RF-10 a RF-15].
- **Viewports:**
  - **desktop** — único viewport de la superficie.
  - Tablet: se comporta como desktop.

Lectura (pantalla 06 de la propuesta B) y edición (pantalla 08) son **estados de la misma ruta**, como desde REQ-016.

## Entrada y salida

**Entradas:**
- `documentacion` · fila de `tabla-documentos`
- `detalle-proyecto`, `detalle-requisito`, `detalle-tarea` · fila de `lista-documentos-card`
- O-11 Nuevo documento · "Crear y editar" → `/docs/{id}?editar=1`, que entra en *editando* con la reserva tomada **sin recarga completa** [REQ-021 RF-10, CA-14]
- O-13 Historial de versiones · "Ver" de una versión → `/docs/{id}?version={n}`
- URL directa (`/docs/{id}`), por ejemplo un link pegado en un comentario

**Salidas user-driven:**
- A `documentacion` · primer nivel de `breadcrumb-documento`
- A `detalle-proyecto` / `detalle-requisito` / `detalle-tarea` · el proyecto de `linea-cliente-proyecto` o un vínculo de `lista-vinculos`
- A `documentacion` filtrada por un tema · click en un pill de `temas-documento` (`/docs?tema={tema}`)
- A O-12 Compartir documento · `boton-compartir`
- A O-13 Historial de versiones · `boton-historial`
- Descarga de un adjunto · click en un ítem de `lista-adjuntos-documento` (`/docs/attachments/{id}` → 302)

**Salidas automáticas:**
- Ninguna. Guardar y cancelar vuelven a *default* en la misma ruta.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | breadcrumb-documento | breadcrumbs | — | navigation | desktop | hidden_in_states: loading; en not found solo `"Documentación"` | `"Documentación / {título}"`, sin carpetas |
| 2 | titulo-documento | heading | h1 | content | desktop | hidden_in_states: loading, not found | Título del documento |
| 3 | badge-visibilidad | badge | public / internal / restricted | content | desktop | hidden_in_states: loading, not found | Quién puede verlo |
| 4 | linea-cliente-proyecto | label | — | content | desktop | hidden_in_states: loading, not found | Cliente y proyecto del documento, en lugar de la ruta |
| 5 | temas-documento | chips | — | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida; oculto sin temas | Temas del documento |
| 6 | meta-version | label | — | content | desktop | hidden_in_states: loading, not found | Versión, fecha y quién la guardó |
| 7 | boton-historial | button | secondary-nav / disabled | navigation | desktop | hidden_in_states: editando, conflicto de versión, reserva perdida, loading, not found; state_overrides: módulo no disponible→disabled | Abre O-13 |
| 8 | boton-compartir | button | secondary-nav / disabled | input | desktop | visible solo con la función de compartir configurada; hidden_in_states: editando, conflicto de versión, reserva perdida; state_overrides: restringido→disabled, módulo no disponible→disabled | Abre O-12 |
| 9 | nota-sin-compartir | paragraph | caption | feedback | desktop | visible_only_in_states: restringido | Por qué no se puede compartir |
| 10 | boton-editar | button | primary / disabled | input | desktop | visible solo con documento ≤ 256 KiB; hidden_in_states: editando, conflicto de versión, reserva perdida, viendo una versión anterior; state_overrides: bloqueado por otra persona→disabled, módulo no disponible→disabled | Entra en edición tomando la reserva |
| 11 | aviso-version-anterior | alert | info | feedback | desktop | visible_only_in_states: viendo una versión anterior | Aclara que no es la versión actual |
| 12 | aviso-version-compactada | alert | warning | feedback | desktop | visible_only_in_states: versión compactada | La versión pedida ya no se conserva |
| 13 | aviso-bloqueado | alert | info | feedback | desktop | visible_only_in_states: bloqueado por otra persona | Quién lo está editando y hasta cuándo |
| 14 | aviso-documento-grande | alert | info | feedback | desktop | visible solo si el documento llega por `contentUrl` | Explica por qué no se puede editar |
| 15 | aviso-no-disponible | alert | warning | feedback | desktop | visible_only_in_states: módulo no disponible | El módulo no responde |
| 16 | contenido-documento | paragraph | body (markdown renderizado) | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida, versión compactada | El documento, sin frontmatter ni HTML ni scripts |
| 17 | card-indice | card | panel | navigation | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida; oculto sin encabezados | "En este documento" |
| 18 | lista-indice | list | — | navigation | desktop | igual que card-indice | Un enlace por encabezado |
| 19 | card-vinculos | card | panel | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | "Vinculado a" |
| 20 | lista-vinculos | list | — | navigation | desktop | igual que card-vinculos | Cliente, proyecto, requisitos y tareas con nombre |
| 21 | card-propiedades | card | panel | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | "Propiedades", sin ruta |
| 22 | lista-propiedades | list | — | content | desktop | igual que card-propiedades | Visibilidad y versión |
| 23 | card-adjuntos-documento | card | panel | content | desktop | hidden_in_states: loading, not found, editando, conflicto de versión, reserva perdida | Adjuntos del documento |
| 24 | lista-adjuntos-documento | list | — | content | desktop | igual que card-adjuntos-documento | Un enlace por adjunto |
| 25 | indicador-reserva | alert | success | feedback | desktop | visible_only_in_states: editando | Confirma que la persona tiene la reserva de edición |
| 26 | campo-titulo | text-input | default / error | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida; oculto con frontmatter ilegible | Título |
| 27 | selector-visibilidad | toggle | ToggleGroup segmentado | input | desktop | igual que campo-titulo | Interno · Visible para el cliente · Restringido (solo `admin`) |
| 28 | campo-temas | text-input | default (con chips) | input | desktop | igual que campo-titulo | Temas libres con sugerencias |
| 29 | selector-cliente | dropdown | Select searchable | input | desktop | igual que campo-titulo | Cliente vinculado |
| 30 | selector-proyecto | dropdown | Select searchable | input | desktop | igual que campo-titulo | Proyecto vinculado |
| 31 | aviso-frontmatter-ilegible | alert | warning | feedback | desktop | visible_only_in_states: propiedades ilegibles | Explica por qué se edita el texto completo |
| 32 | editor-markdown | textarea | default / disabled | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Cuerpo del documento en markdown |
| 33 | vista-previa | paragraph | body (markdown renderizado) | content | desktop | visible_only_in_states: editando, reserva perdida | Cómo se va a ver, sin frontmatter |
| 34 | version-actual | paragraph | body (texto plano) | content | desktop | visible_only_in_states: conflicto de versión | La versión que otra persona guardó, para copiar de ella |
| 35 | zona-adjuntar | section | Dropzone · default / uploading / error | input | desktop | visible_only_in_states: editando | Sube un archivo e inserta su enlace en el texto |
| 36 | campo-mensaje | text-input | default | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Mensaje opcional que protege la versión |
| 37 | boton-guardar | button | primary / disabled | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida; state_overrides: guardando→disabled | Guarda una versión nueva |
| 38 | boton-cancelar | button | secondary-dismiss | input | desktop | visible_only_in_states: editando, conflicto de versión, reserva perdida | Descarta los cambios y libera la reserva |
| 39 | aviso-conflicto | alert | warning | feedback | desktop | visible_only_in_states: conflicto de versión | Otra persona guardó una versión nueva |
| 40 | aviso-reserva-perdida | alert | warning | feedback | desktop | visible_only_in_states: reserva perdida | La reserva venció o la tomó otra persona |
| 41 | cargando-documento | loader | block | feedback | desktop | visible_only_in_states: loading | Carga inicial |
| 42 | aviso-not-found | alert | error | feedback | desktop | visible_only_in_states: not found | Documento inexistente o sin permiso |
| 43 | toast-resultado | toast | success / warning / error | feedback | desktop | visible_only_in_states: success, error de sistema / sin conexión | Confirmación o fallo de guardado |

## Layout por viewport

### desktop · 1440px

- breadcrumb-documento
- row `encabezado` (`space-between`)
  - col 8/12: row de titulo-documento + badge-visibilidad · row de linea-cliente-proyecto + temas-documento · meta-version
  - col 4/12: boton-historial *(solo icono)*, boton-compartir, boton-editar *(alineados a la derecha; primario último)* · nota-sin-compartir *(debajo, solo restringido)* · en edición: boton-cancelar, boton-guardar
- aviso-version-anterior · aviso-version-compactada · aviso-no-disponible · aviso-bloqueado · aviso-documento-grande · aviso-conflicto · aviso-reserva-perdida · indicador-reserva *(a lo sumo uno visible por vez, ancho completo)*
- row `lectura` *(default, bloqueado, restringido, versión anterior, no disponible)*
  - col 8/12: contenido-documento *(card `panel`)*
  - col 4/12:
    - card-indice (lista-indice)
    - card-vinculos (lista-vinculos)
    - card-propiedades (lista-propiedades)
    - card-adjuntos-documento (lista-adjuntos-documento)
- row `propiedades` *(editando, conflicto, reserva perdida; card `panel`)*
  - col 4/12: campo-titulo
  - col 3/12: selector-visibilidad
  - col 2/12: campo-temas
  - col 3/12: selector-cliente, selector-proyecto *(bajo el label "Vinculado a")*
  - aviso-frontmatter-ilegible *(en lugar de los campos, si aplica)*
- row `edicion` *(editando, reserva perdida)*
  - col 6/12: editor-markdown, zona-adjuntar
  - col 6/12: vista-previa
- row `conflicto` *(conflicto de versión)*
  - col 6/12: editor-markdown *(con el texto propio intacto)*
  - col 6/12: version-actual
- row `acciones-edicion` (`flex-end`): campo-mensaje *(8/12)*

## Contenido

### breadcrumb-documento
- Texto/label: `"Documentación"` / `"{título}"` · en edición, `"Documentación"` / `"{título}"` / `"Editando"`
- Icono: nada
- Asset: nada
- Annotation: `ViewHeader` con breadcrumb. **Sin carpetas ni cliente/proyecto como segmentos**: el primer nivel va a `/docs` [REQ-021 decisión 2, Supuestos "Pantalla 06"]

### titulo-documento
- Texto/label: dinámico desde el título del documento; sin título, `"Sin título"`
- Icono: nada
- Asset: nada
- Annotation: `ViewHeader` (Sora 30/700). Ya no se cae al nombre de archivo: la web no lo muestra en ningún lado

### badge-visibilidad
- Texto/label: `"Visible para el cliente"` (`public`) · `"Interno"` (`internal`) · `"Restringido"` (`restricted`)
- Icono: eye (público) · eye-off (interno) · lock (restringido)
- Asset: nada
- Annotation: `Badge` `outline`. Siempre visible: es la señal, antes de compartir o de escribir algo sensible, de que el texto llega al portal (o de que solo lo ve la conducción)

### linea-cliente-proyecto
- Texto/label: `"{cliente} · {proyecto} #{id}"` · sin proyecto `"{cliente} · Sin proyecto"` · sin nada `"Sin cliente · Sin proyecto"`. Con varios, el primero y `"+{n}"`
- Icono: nada
- Asset: nada
- Annotation: el proyecto es un enlace a su ficha. Un id que la base no conoce se muestra `#id` sin nombre ni enlace [REQ-021 RF-11, CA-17]

### temas-documento
- Texto/label: un pill por tema
- Icono: nada
- Asset: nada
- Annotation: `Badge` `outline`; cada pill lleva a la documentación filtrada por ese tema

### meta-version
- Texto/label: `"Versión {n} · actualizado {DD/MM/AAAA HH:mm} por {nombre}"` · si la guardó la persona actual, `"por vos"` · sin nombre, `"por —"` se omite y queda `"Versión {n} · actualizado {fecha}"`
- Icono: nada
- Asset: nada
- Annotation: el nombre es el que manda el servicio (`updatedByName`), **nunca** `"otra persona"` [REQ-021 RF-15, CA-18]. "La persona actual" se reconoce por su identidad de acceso (la misma que el módulo guarda como autor), no por su id de Jiku; si la sesión no la trae, nunca se muestra `"vos"` [REQ-022 RF-7, CA-9, CA-10]. Fecha en mono

### boton-historial
- Texto/label: nombre accesible `"Historial de versiones"` (botón solo icono)
- Icono: clock
- Asset: nada
- Annotation: `Button` `secondary-nav` cuadrado; abre O-13 como panel lateral sobre la lectura [REQ-021 decisión 10]

### boton-compartir
- Texto/label: `"Compartir"`
- Icono: share
- Asset: nada
- Annotation: **no se renderiza** si la api no tiene la función de compartir configurada (`features.sharing: false`) [REQ-016 CA-32]. Lo ve toda persona interna: con 1.3.0 la carpeta dejó de decidir quién comparte. Con un documento `restricted` queda **deshabilitado** y nota-sin-compartir explica por qué [REQ-021 RF-13, CA-22]

### nota-sin-compartir
- Texto/label: `"Los documentos restringidos no se pueden compartir por link."`
- Icono: nada
- Asset: nada
- Annotation: asociado al botón con `aria-describedby`; texto visible y no tooltip, porque un `:hover` no llega por teclado

### boton-editar
- Texto/label: `"Editar"`
- Icono: edit
- Asset: nada
- Annotation: al pulsarlo pide la reserva de edición; mientras responde, el botón queda deshabilitado con `Loader` `inline`. No se renderiza para un documento grande ni mientras se ve una versión anterior

### aviso-version-anterior
- Texto/label: `"Estás viendo la versión {n}, guardada el {DD/MM/AAAA HH:mm} por {nombre}."` · enlace `"Ver la versión actual"`
- Icono: clock
- Asset: nada
- Annotation: se llega desde O-13 ("Ver"). La restauración se hace desde el historial, no desde acá, para que haya un solo lugar donde se decide

### aviso-version-compactada
- Texto/label: `"La versión {n} ya no se conserva: se compactó al limpiar el historial."` · `"Versiones más cercanas:"` enlaces `"Versión {anterior}"` · `"Versión {siguiente}"` (solo las que existan)
- Icono: warning
- Asset: nada
- Annotation: respuesta `version_pruned` con las versiones conservadas más cercanas [REQ-021 RF-14, CA-21]

### aviso-bloqueado
- Texto/label: `"{nombre} lo está editando hasta las {HH:mm}. Podés leerlo mientras tanto."` · sin nombre: `"Otra persona lo está editando hasta las {HH:mm}…"` · agente: `"Un agente lo está editando hasta las {HH:mm}…"`
- Icono: lock
- Asset: nada
- Annotation: el nombre sale de `lock.holderName` (o de `details.holderName` al chocar con la reserva). Si el holder es la persona actual en otra pestaña: `"Lo estás editando en otra pestaña o ventana."` [REQ-021 RF-15, CA-18]. La persona se reconoce por su identidad de acceso, no por su id de Jiku; sin esa identidad en la sesión, el aviso es siempre el de otra persona, nunca `"Lo estás editando…"` por error [REQ-022 RF-7, CA-8, CA-10]

### aviso-documento-grande
- Texto/label: `"Este documento es demasiado grande para editarlo desde acá. Podés leerlo y editarlo con jiku-go."`
- Icono: info
- Asset: nada
- Annotation: documentos de más de 256 KiB llegan por URL de contenido; se muestran en solo lectura [REQ-016 Supuestos]

### aviso-no-disponible
- Texto/label: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Icono: warning
- Asset: nada
- Annotation: mismo texto en todas las pantallas que muestran documentación

### contenido-documento
- Texto/label: el markdown del documento, renderizado; **el frontmatter se quita antes de renderizar**
- Icono: nada
- Asset: imágenes adjuntas a ancho máximo del panel
- Annotation: corrige el bug del frontmatter visible como texto [REQ-021 decisión 9, RF-11, CA-16]. **Nunca ejecuta HTML ni scripts**: el HTML crudo se muestra como texto y los enlaces solo pueden ser `http(s)`, `mailto` o adjuntos. Todo enlace o imagen cuyo path sea `/docs/attachments/{id}` se reescribe al link estable de la web [REQ-016 CA-28, CA-33]. Los encabezados llevan ancla para lista-indice

### card-indice
- Texto/label: título `"En este documento"`
- Icono: nada
- Asset: nada
- Annotation: `Card` `panel`. Sin encabezados en el documento, la card no se renderiza

### lista-indice
- Texto/label: un enlace por encabezado de nivel 1 y 2 del documento, con su texto; el nivel 2 sangrado
- Icono: nada
- Asset: nada
- Annotation: lleva al ancla dentro de la página; marca el encabezado visible al hacer scroll

### card-vinculos
- Texto/label: título `"Vinculado a"`; vacío `"Este documento no está vinculado a ningún cliente, proyecto, requisito ni tarea."`
- Icono: link
- Asset: nada
- Annotation: `Card` `panel`

### lista-vinculos
- Texto/label: una fila por vínculo con su tipo y su nombre: `"Cliente"` `"{nombre}"` · `"Proyecto"` `"{nombre}"` `#{id}` · `"Requisito"` `"{título}"` `#{id}` · `"Tarea"` `"{título}"` `#{id}`
- Icono: nada
- Asset: nada
- Annotation: proyecto, requisito y tarea son enlaces a su ficha. Los nombres los resuelve la api; uno que no conoce se muestra `#id` sin enlace [REQ-021 RF-11]

### card-propiedades
- Texto/label: título `"Propiedades"`
- Icono: nada
- Asset: nada
- Annotation: `Card` `panel`. **Sin "Ruta de almacenamiento"** [REQ-021 decisión 2, CA-17]

### lista-propiedades
- Texto/label: `"Visibilidad"` `"{Interno | Visible para el cliente | Restringido}"` · `"Versión"` `"{n}"`
- Icono: nada
- Asset: nada
- Annotation: la versión en mono

### card-adjuntos-documento
- Texto/label: título `"Adjuntos"` con la cantidad; vacío `"Sin adjuntos."`
- Icono: file
- Asset: nada
- Annotation: `Card` `panel`

### lista-adjuntos-documento
- Texto/label: un enlace por adjunto con su nombre de archivo
- Icono: download
- Asset: nada
- Annotation: cada enlace apunta a `/docs/attachments/{id}`, el link estable de la web (sesión → api → 302) [REQ-016 RF-16]

### indicador-reserva
- Texto/label: `"Estás editando. Nadie más puede guardar este documento hasta que guardes o canceles."`
- Icono: lock
- Asset: nada
- Annotation: la reserva dura 120 s y se renueva sola cada 60 s mientras el editor está abierto [REQ-016 CA-29]

### campo-titulo
- Texto/label: label `"Título"`; sin placeholder
- Icono: nada
- Asset: nada
- Annotation: `Input` `text`. Vacío → error `"El título no puede quedar vacío."`

### selector-visibilidad
- Texto/label: label `"Visibilidad"`; opciones `"Interno"` · `"Visible para el cliente"` · `"Restringido"`
- Icono: nada
- Asset: nada
- Annotation: `ToggleGroup` segmentado. **"Restringido" solo se ofrece a `admin`**; si un `user` abre un documento ya restringido, ve la opción marcada y deshabilitada, y no puede cambiar la visibilidad [REQ-021 decisión 5, CA-13]. Pasar a `"Restringido"` revoca los links activos: al elegirla aparece la ayuda `"Al guardar, los links compartidos de este documento dejan de funcionar."`

### campo-temas
- Texto/label: label `"Temas"`; placeholder `"Agregar temas"`; cada tema como chip con ×; sugerencias `"{tema}"` con `"{n} documentos"`; sin coincidencias `"Enter para agregar «{texto}»"`
- Icono: nada
- Asset: nada
- Annotation: temas **libres**: sugiere los existentes por prefijo mientras se escribe y Enter agrega uno nuevo. No hay "Proponer tema nuevo" [REQ-021 decisión 4, CA-15]. Backspace con el campo vacío quita el último chip

### selector-cliente
- Texto/label: label `"Cliente"`; placeholder `"Sin cliente"`
- Icono: nada
- Asset: nada
- Annotation: `Select` `single` `searchable`, con opción de dejarlo vacío. Al entrar en edición muestra el cliente del documento. Elegir el cliente del proyecto ya elegido lo conserva; elegir otro cliente lo vacía; `"Sin cliente"` lo vacía siempre [REQ-022 RF-3, CA-3, CA-5]

### selector-proyecto
- Texto/label: label `"Proyecto"`; placeholder `"Sin proyecto"`; opción `"{proyecto} · {cliente}"` (solo `"{proyecto}"` si no tiene cliente)
- Icono: nada
- Asset: nada
- Annotation: `Select` `single` `searchable`, limitado a los proyectos del cliente elegido (más `"Sin proyecto"`); al entrar en edición muestra el proyecto del documento; elegir un proyecto completa su cliente [REQ-022 RF-1, RF-2, CA-5]. Los requisitos y las tareas vinculados **no se editan acá**: se conservan tal cual y se siguen viendo en lista-vinculos al volver a lectura

### aviso-frontmatter-ilegible
- Texto/label: `"No pudimos leer las propiedades de este documento. Editá el texto completo, propiedades incluidas, y al guardar el módulo te va a decir si algo no es válido."`
- Icono: warning
- Asset: nada
- Annotation: si el frontmatter no se puede interpretar, la edición por campos se deshabilita y editor-markdown muestra el contenido completo, frontmatter incluido [REQ-021 Riesgos]

### editor-markdown
- Texto/label: label `"Markdown"`; sin placeholder
- Icono: nada
- Asset: nada
- Annotation: `Input` `textarea`, fuente monoespaciada, alto mínimo de la ventana. Edita **el cuerpo**: las propiedades van por campos y al guardar se reescriben en el frontmatter conservando claves desconocidas y comentarios. En *conflicto de versión* conserva el texto propio, sin tocarlo

### vista-previa
- Texto/label: título `"Vista previa"`; ayuda `"Se actualiza mientras escribís"`
- Icono: eye
- Asset: nada
- Annotation: mismo render que contenido-documento, sin frontmatter (debounce 300 ms)

### version-actual
- Texto/label: título `"Versión {n}, guardada por {nombre}"`; el contenido de esa versión en texto plano, seleccionable
- Icono: nada
- Asset: nada
- Annotation: se muestra como texto y no renderizado, para copiar fragmentos exactos

### zona-adjuntar
- Texto/label: `"Arrastrá un archivo acá o hacé click para adjuntarlo"`. Subiendo: `"Subiendo {nombre del archivo}…"`. Rechazado: `"Ese tipo de archivo no está permitido."` · `"El archivo supera el tamaño máximo permitido."`
- Icono: upload
- Asset: nada
- Annotation: `Dropzone`. Al terminar inserta en el cursor `![nombre](/docs/attachments/{id})` para imágenes y `[nombre](/docs/attachments/{id})` para el resto

### campo-mensaje
- Texto/label: label `"Mensaje de la versión (opcional)"`; placeholder `"Ej.: cierre de sprint"`; ayuda `"Con mensaje, esta versión queda protegida: no se borra al compactar el historial."`
- Icono: nada
- Asset: nada
- Annotation: viaja como mensaje de la versión nueva [REQ-021 decisión 10, RF-12, CA-19]

### boton-guardar
- Texto/label: `"Guardar"`; en *conflicto de versión*, `"Guardar sobre la versión {n}"`
- Icono: check
- Asset: nada
- Annotation: un solo guardado con propiedades, cuerpo y mensaje: todo en **una** versión. En *conflicto de versión* la base pasa a ser la versión actual: guardar ahí es una decisión explícita, nunca un reintento automático [REQ-016 CA-30]

### boton-cancelar
- Texto/label: `"Cancelar"`
- Icono: nada
- Asset: nada
- Annotation: con cambios sin guardar pide confirmación con O-02 (`"Descartar cambios"` · `"Vas a perder lo que escribiste desde la última vez que guardaste."` · `"Descartar"` / `"Seguir editando"`). Libera la reserva

### aviso-conflicto
- Texto/label: `"{nombre} guardó la versión {n} mientras editabas. Tu texto sigue acá: compará con la versión actual y guardá cuando estés listo."`
- Icono: warning
- Asset: nada
- Annotation: `role="alert"`; nombre del servicio, `"Otra persona"` solo si no lo manda

### aviso-reserva-perdida
- Texto/label: `"Se perdió la reserva de edición. Tu texto sigue acá; si nadie más lo tomó, vas a poder guardar igual."`
- Icono: warning
- Asset: nada
- Annotation: aparece si una renovación falla

### cargando-documento
- Texto/label: `"Cargando documento…"`
- Icono: nada
- Asset: nada
- Annotation: `Loader` `block`

### aviso-not-found
- Texto/label: `"Este documento no existe o no tenés permiso para verlo."`
- Icono: error
- Asset: nada
- Annotation: mismo texto para inexistente, sin permiso y restringido sin acceso; breadcrumb-documento queda como salida con solo `"Documentación"`

### toast-resultado
- Texto/label: éxito `"Guardaste la versión {n}."` · con mensaje `"Guardaste la versión {n}. Quedó protegida."` · éxito con aviso `"Guardaste la versión {n}. Revisalo: parece contener una clave o un token."` · sin permiso para restringir `"Solo la conducción puede restringir un documento."` · error `"No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo."`
- Icono: nada
- Asset: nada
- Annotation: el aviso de posible secreto no bloquea el guardado

## Estados

### default
- Aplica: Sí (lectura, pantalla 06)
- Mensaje: —
- Cambios: ninguno (estado base)

### empty
- Aplica: No — un documento vacío se muestra vacío dentro del panel.

### loading
- Aplica: Sí
- Mensaje: `"Cargando documento…"`
- Cambios:
  - cargando-documento: visible
  - el resto: oculto

### error de validación
- Aplica: Sí
- Mensaje: `"El título no puede quedar vacío."` · del módulo al guardar: `"Las propiedades no son válidas: {detalle}."` (`frontmatter_invalid`) · `"Uno de los vínculos no existe: {detalle}."` (`invalid_relation`) · `"El documento supera los 256 KiB que se pueden guardar desde acá."` (`content_too_large`)
- Cambios:
  - campo-titulo o editor-markdown: state=error, con el mensaje debajo
  - boton-guardar: habilitado para reintentar

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo guardar. Tu texto sigue en el editor; intentá de nuevo."`
- Cambios:
  - toast-resultado: variant=error
  - editor-markdown y los campos conservan lo escrito

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
  - todo lo demás salvo breadcrumb-documento: oculto

### estado terminal / readonly
- Aplica: Sí (documento grande)
- Mensaje: `"Este documento es demasiado grande para editarlo desde acá…"`
- Cambios:
  - boton-editar: no se renderiza
  - aviso-documento-grande: visible

### restringido (parent_state: default)
- Aplica: Sí [REQ-021 RF-13, CA-22]
- Mensaje: `"Los documentos restringidos no se pueden compartir por link."`
- Cambios:
  - badge-visibilidad: variant=restricted
  - boton-compartir: disabled
  - nota-sin-compartir: visible

### viendo una versión anterior (parent_state: default)
- Aplica: Sí [REQ-021 RF-14]
- Mensaje: `"Estás viendo la versión {n}…"`
- Cambios:
  - aviso-version-anterior: visible
  - contenido-documento: el de esa versión
  - meta-version: la de esa versión
  - boton-editar: oculto

### versión compactada (parent_state: viendo una versión anterior)
- Aplica: Sí [REQ-021 CA-21]
- Mensaje: `"La versión {n} ya no se conserva: se compactó al limpiar el historial."`
- Cambios:
  - aviso-version-compactada: visible
  - contenido-documento: oculto

### bloqueado por otra persona (parent_state: default)
- Aplica: Sí [REQ-016 CA-18; REQ-021 CA-18]
- Mensaje: `"{nombre} lo está editando hasta las {HH:mm}. Podés leerlo mientras tanto."`
- Cambios:
  - aviso-bloqueado: visible
  - boton-editar: disabled
- Se revisa al volver a la pestaña y cada 60 s

### editando (parent_state: default)
- Aplica: Sí (pantalla 08) [REQ-016 CA-29; REQ-021 RF-12]
- Mensaje: `"Estás editando. Nadie más puede guardar este documento hasta que guardes o canceles."`
- Cambios:
  - indicador-reserva, campo-titulo, selector-visibilidad, campo-temas, selector-cliente, selector-proyecto, editor-markdown, vista-previa, zona-adjuntar, campo-mensaje, boton-guardar, boton-cancelar: visibles
  - contenido-documento, temas-documento, las cuatro cards de la columna derecha, boton-historial, boton-compartir y boton-editar: ocultos
  - se entra también desde "Crear y editar" de O-11 **sin recarga**: la vista toma la reserva primero y recién después limpia `?editar=1` de la URL [REQ-021 CA-14]

### conflicto de versión (parent_state: editando)
- Aplica: Sí [REQ-016 CA-17, CA-30]
- Mensaje: `"{nombre} guardó la versión {n} mientras editabas…"`
- Cambios:
  - aviso-conflicto: visible
  - version-actual: visible en lugar de vista-previa
  - boton-guardar: content=`"Guardar sobre la versión {n}"`
  - zona-adjuntar: oculta

### propiedades ilegibles (parent_state: editando)
- Aplica: Sí [REQ-021 Riesgos]
- Mensaje: `"No pudimos leer las propiedades de este documento…"`
- Cambios:
  - aviso-frontmatter-ilegible: visible
  - campo-titulo, selector-visibilidad, campo-temas, selector-cliente y selector-proyecto: ocultos
  - editor-markdown: muestra el contenido completo, frontmatter incluido

### reserva perdida (parent_state: editando)
- Aplica: Sí
- Mensaje: `"Se perdió la reserva de edición…"`
- Cambios:
  - aviso-reserva-perdida: visible
  - indicador-reserva: oculto

### módulo no disponible (parent_state: default)
- Aplica: Sí [REQ-016 RF-23, CA-27]
- Mensaje: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - aviso-no-disponible: visible
  - boton-editar, boton-compartir y boton-historial: disabled
  - contenido-documento: se muestra si ya estaba cargado; si no, oculto

## Interacciones

**Eventos:**
- boton-editar · on click → toma la reserva; éxito → *editando*; `document_locked` → *bloqueado por otra persona*
- `?editar=1` al entrar → toma la reserva una vez y después limpia la URL sin navegar → *editando* [CA-14]
- editor abierto · cada 60 s → renueva la reserva; si falla → *reserva perdida*
- boton-guardar · on click → guarda propiedades + cuerpo + mensaje en una versión; éxito → *default*; `version_conflict` → *conflicto de versión*; `document_locked` → *bloqueado por otra persona* conservando lo escrito; `permission_denied` al restringir → toast `"Solo la conducción puede restringir un documento."`
- boton-cancelar · on click → (confirmación si hay cambios) libera la reserva y vuelve a *default*
- cerrar la pestaña con el editor abierto → libera la reserva con un pedido `keepalive`; si no llega, vence a los 120 s
- selector-proyecto · on change → completa selector-cliente con el cliente del proyecto
- campo-temas · on input → sugiere temas existentes por prefijo; Enter → agrega el tema
- zona-adjuntar · on drop / click → sube el archivo e inserta el enlace en el cursor
- boton-historial · on click → abre O-13
- boton-compartir · on click → abre O-12
- ítem de lista-indice · on click → lleva al encabezado
- pill de temas-documento · on click → `/docs?tema={tema}`
- vínculo de lista-vinculos o proyecto de linea-cliente-proyecto · on click → navega a la ficha
- enlace "Ver la versión actual" / versiones cercanas · on click → `/docs/{id}` / `/docs/{id}?version={n}`

**Validaciones:**
- campo-titulo · vacío → error al guardar, sin llamar al servicio
- el resto lo valida el módulo al guardar (ver *error de validación*)

**Feedback:**
- Guardado: toast y vuelta a lectura con la versión nueva en meta-version
- Navegar fuera con cambios sin guardar: confirmación del navegador

## Accesibilidad

- **Orden de foco:** breadcrumb-documento → linea-cliente-proyecto → temas-documento → boton-historial → boton-compartir (con nota-sin-compartir como descripción) → boton-editar → aviso visible → enlaces de contenido-documento → lista-indice → lista-vinculos → lista-adjuntos-documento. En edición: campo-titulo → selector-visibilidad → campo-temas → selector-cliente → selector-proyecto → editor-markdown → zona-adjuntar → campo-mensaje → boton-cancelar → boton-guardar.
- **Landmarks y jerarquía:** `main` con un único h1; la columna derecha es `<aside>`; card-indice es `<nav aria-label="En este documento">`. Los títulos del markdown se desplazan un nivel.
- **Foco y teclado:** al entrar en edición el foco va a editor-markdown; al guardar o cancelar vuelve a boton-editar. O-12 y O-13 atrapan el foco y lo devuelven a su botón al cerrar.
- **Propio de esta composición:** boton-historial es solo icono y lleva nombre accesible. aviso-conflicto, aviso-reserva-perdida y aviso-version-compactada se anuncian con `role="alert"`.

## Decisiones y descartes

### REQ-022 — Arreglos e2e de la documentación sin carpetas (2026-10-26)

**Decisiones tomadas:**
- **"Vos" y "Lo estás editando" dependen de la identidad de acceso.** El módulo guarda quién reserva y quién guarda con la identidad de acceso de la persona; compararla con el id de Jiku hacía que nadie se reconociera nunca (la e2e veía "Otra persona lo está editando…" con la reserva propia en otra pestaña). La regla falla cerrada: sin identidad, el texto es el de otra persona o el nombre, nunca "vos" [REQ-022 JIKU-WEB-4, CA-8 a CA-10].
- **La edición muestra el cliente y el proyecto del documento en sus selectores**, con la misma relación Cliente ↔ Proyecto que el alta (O-11) [REQ-022 CA-5].

**Alternativas descartadas:**
- Ninguna: el comportamiento esperado ya estaba diseñado en REQ-021; esto lo hace explícito.

**Preguntas abiertas:**
- Ninguna.

### REQ-021 — Documentación sin carpetas (propuesta B) (2026-10-26)

**Decisiones tomadas:**
- **Cliente · Proyecto en lugar de la ruta, en la cabecera, en "Vinculado a" y en las propiedades.** La ubicación la genera el servicio y deja de mostrarse en todos lados; lo que orienta es a quién pertenece el documento [REQ-021 decisión 2, CA-17]. Se quitó `boton-volver`: el breadcrumb `"Documentación"` cumple esa salida, como en la maqueta.
- **Propiedades por campos en la edición y el editor sobre el cuerpo.** Así título, visibilidad, temas y vínculos cambian en la misma versión que el texto, y nadie tiene que escribir YAML para cambiar un proyecto. Si el frontmatter no se puede leer, se vuelve al texto completo en vez de arriesgarse a perder claves [REQ-021 Diseño de la web, "Frontmatter"].
- **Requisitos y tareas no se editan desde los campos.** El pedido nombra cliente y proyecto; los otros vínculos se conservan y se ven en lectura. Editarlos sigue siendo posible en el texto completo solo en el caso de frontmatter ilegible.
- **"Restringido" visible para todos, elegible solo por `admin`.** Un `user` necesita saber que un documento es restringido aunque no pueda cambiarlo; esconderle la opción marcada lo dejaría sin explicación [REQ-021 decisión 5].
- **Compartir deshabilitado con nota visible, no oculto, en un restringido.** Un botón que desaparece según el documento parece un fallo; uno deshabilitado con el motivo al lado explica la regla [REQ-021 CA-22].
- **El historial es un panel lateral (O-13), y "Ver" abre la versión en esta misma pantalla.** El panel deja leer la lista sin perder el documento; ver una versión a ancho completo necesita la columna de lectura. Restaurar vive solo en el panel.
- **El mensaje de la versión explica que protege.** Sin la ayuda, "mensaje" parece un comentario opcional; con ella, es la forma de marcar un hito que la compactación no borra [REQ-021 decisión 10].
- **Nombres del servicio en meta, lock y conflicto.** `"otra persona"` queda solo para el lock ajeno sin nombre [REQ-021 decisión 9, RF-15].
- **Sin "Origen HedgeDoc".** La maqueta lo muestra pero el contrato no tiene esa fuente [REQ-021 Supuestos "Pantalla 08"].

**Alternativas descartadas:**
- Historial como pantalla propia: alejaría al documento justo cuando se compara.
- Mostrar la ruta como "dato técnico" en Propiedades (como la maqueta): decisión 2 del dueño.

**Preguntas abiertas:**
- ¿Hace falta editar requisitos y tareas vinculados por campos? Hoy solo se ven.

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas (vigentes):**
- **Editor de markdown plano con vista previa al lado, no WYSIWYG**, en columna y no en pestaña.
- **Un visor y un editor en la misma ruta**: editar es un estado del documento.
- **La reserva es invisible mientras funciona.**
- **El conflicto conserva el texto propio y muestra el ajeno al lado, en texto plano.**
- **"Inexistente" y "sin permiso" comparten mensaje.**
- **El badge de visibilidad está siempre visible.**

**Reemplazadas por REQ-021:** el breadcrumb de carpetas, el permiso `manage` para compartir, el editor con frontmatter incluido y la exclusión del historial de versiones.
