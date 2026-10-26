---
name: nuevo-documento
surface: web
route: /docs (overlay)
overlay: true
overlay_type: modal
triggered_by: documentacion
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: diseñada
version: "2.0"
date: 2026-10-26
---

# Overlay O-11: Nuevo documento

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md).
- **JTBD / Propósito:** crear un documento ya clasificado —título, cliente, proyecto, temas y visibilidad— y pasar directo a escribirlo, sin elegir carpeta ni nombre de archivo [REQ-021 RF-9, RF-10, pantalla 07 de la propuesta B].
- **Viewports:**
  - **desktop** — único viewport de la superficie.

## Entrada y salida

**Entradas:**
- `documentacion` · `boton-nuevo-documento` (vacío, o con las relaciones del filtro de origen)
- `detalle-proyecto` · `boton-nuevo-documento-card` (con el proyecto y su cliente) [REQ-021 RF-16, CA-9]
- `detalle-requisito` · `boton-nuevo-documento-card` (con el requisito, su proyecto y su cliente)
- `detalle-tarea` · `boton-nuevo-documento-card` (con la tarea, su proyecto y su cliente)

**Salidas user-driven:**
- A `documento` en estado *editando*, con la reserva tomada y sin recarga · `boton-crear` con éxito [REQ-021 CA-14]
- Cierra y vuelve a la pantalla de origen · `boton-cancelar-alta`, `Escape` o click fuera

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | modal-nuevo-documento | modal | — | layout | desktop | — | Contenedor del diálogo |
| 2 | titulo-modal | heading | h2 | content | desktop | — | Título del diálogo |
| 3 | campo-titulo | text-input | default / error | input | desktop | state_overrides: error de validación→error | Título del documento |
| 4 | selector-cliente | dropdown | Select searchable | input | desktop | — | Cliente |
| 5 | selector-proyecto | dropdown | Select searchable | input | desktop | — | Proyecto, limitado al cliente |
| 6 | vinculo-precargado | label | — | content | desktop | visible solo al abrir desde una ficha de requisito o tarea | Requisito o tarea que se vincula |
| 7 | campo-temas | text-input | default (con chips) | input | desktop | — | Temas libres con sugerencias |
| 8 | selector-visibilidad | toggle | ToggleGroup segmentado | input | desktop | — | Interno · Visible para el cliente · Restringido (solo `admin`) |
| 9 | aviso-error-alta | alert | error | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Fallo del alta |
| 10 | boton-cancelar-alta | button | secondary-dismiss | input | desktop | — | Cierra sin crear |
| 11 | boton-crear | button | primary / disabled | input | desktop | state_overrides: creando→disabled; título vacío→disabled | Crea el documento y abre el editor |

## Layout por viewport

### desktop · 1440px

- modal-nuevo-documento *(560 px de ancho, centrado)*
  - titulo-modal
  - campo-titulo
  - row `relaciones`
    - col 6/12: selector-cliente
    - col 6/12: selector-proyecto
  - vinculo-precargado *(solo desde requisito o tarea)*
  - campo-temas
  - selector-visibilidad
  - aviso-error-alta
  - row `acciones` (`flex-end`): boton-cancelar-alta, boton-crear

## Contenido

### modal-nuevo-documento
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: reutiliza la superficie, el overlay y las reglas de foco de `ConfirmDialog` con un cuerpo de formulario (gap de `modal` anotado desde REQ-016)

### titulo-modal
- Texto/label: `"Nuevo documento"`
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-titulo
- Texto/label: label `"Título"`; placeholder `"Ej.: Guía de despliegue"`
- Icono: nada
- Asset: nada
- Annotation: obligatorio. El contenido inicial es `# {Título}`

### selector-cliente
- Texto/label: label `"Cliente"`; placeholder `"Sin cliente"`
- Icono: nada
- Asset: nada
- Annotation: `Select` `single` `searchable`. Opcional. Cambiar el cliente vacía el proyecto si no es de ese cliente

### selector-proyecto
- Texto/label: label `"Proyecto"`; placeholder `"Sin proyecto"`; ayuda con cliente elegido `"Solo los proyectos de {cliente}"`
- Icono: nada
- Asset: nada
- Annotation: `Select` `single` `searchable`; elegir un proyecto completa el cliente. Opcional: un documento sin proyecto aparece en "Sin proyecto" para clasificarlo después

### vinculo-precargado
- Texto/label: `"También se vincula a: Requisito {título} #{id}"` · `"También se vincula a: Tarea {título} #{id}"`
- Icono: link
- Asset: nada
- Annotation: informativo: el vínculo con el requisito o la tarea de la ficha viaja en el alta y no se edita acá

### campo-temas
- Texto/label: label `"Temas"`; placeholder `"Agregar temas"`; sugerencias `"{tema}"` con `"{n} documentos"`; sin coincidencias `"Enter para agregar «{texto}»"`
- Icono: nada
- Asset: nada
- Annotation: temas libres: sugiere los existentes por prefijo y Enter agrega uno nuevo. Sin "Proponer tema nuevo" [REQ-021 decisión 4, CA-15]

### selector-visibilidad
- Texto/label: label `"Visibilidad"`; opciones `"Interno"` · `"Visible para el cliente"` · `"Restringido"`; default `"Interno"`; ayuda por opción: `"Solo el equipo."` · `"Llega al portal del cliente del proyecto."` · `"Solo la conducción. No se puede compartir."`
- Icono: nada
- Asset: nada
- Annotation: `ToggleGroup` segmentado. **"Restringido" solo se renderiza para `admin`** [REQ-021 decisión 5, CA-13]

### aviso-error-alta
- Texto/label: `"No se pudo crear el documento. Intentá de nuevo."` · módulo caído `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."` · sin permiso `"Solo la conducción puede crear un documento restringido."` · vínculo inválido `"El proyecto o el cliente elegido ya no existe. Elegí otro."`
- Icono: error
- Asset: nada
- Annotation: `role="alert"`; los campos conservan lo escrito

### boton-cancelar-alta
- Texto/label: `"Cancelar"`
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-crear
- Texto/label: `"Crear y editar"`
- Icono: nada
- Asset: nada
- Annotation: crea el documento **sin carpeta ni nombre de archivo** (los genera el servicio), navega a `/docs/{id}?editar=1` y cierra el diálogo **después** de navegar, así el documento queda en edición con la reserva tomada sin recargar la página [REQ-021 decisión 9, CA-14]

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno. Desde una ficha, cliente y proyecto llegan elegidos

### empty
- Aplica: No — es un formulario.

### loading
- Aplica: Sí (creando)
- Mensaje: —
- Cambios:
  - boton-crear: disabled con `Loader` `inline`

### error de validación
- Aplica: Sí
- Mensaje: `"El título no puede quedar vacío."`
- Cambios:
  - campo-titulo: state=error con el mensaje

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo crear el documento. Intentá de nuevo."`
- Cambios:
  - aviso-error-alta: visible

### success
- Aplica: No — el éxito es navegar al documento en edición.

### not found
- Aplica: No — el diálogo no depende de una entidad cargada; un vínculo que dejó de existir llega como error de sistema (`invalid_relation`).

### estado terminal / readonly
- Aplica: No — toda persona interna puede crear documentos.

## Interacciones

**Eventos:**
- selector-proyecto · on change → completa selector-cliente
- selector-cliente · on change → vacía selector-proyecto si no es de ese cliente
- campo-temas · on input → sugiere temas; Enter → agrega
- boton-crear · on click → alta con el contenido inicial y las propiedades en el frontmatter → navega a `/docs/{id}?editar=1` → cierra
- boton-cancelar-alta / `Escape` · → cierra sin crear

**Validaciones:**
- campo-titulo · vacío → boton-crear deshabilitado, sin mensaje hasta intentar
- el resto lo valida el módulo (ver *error de sistema*)

**Feedback:**
- Navegación directa al editor; sin toast (el resultado se ve)

## Accesibilidad

- **Orden de foco:** campo-titulo → selector-cliente → selector-proyecto → campo-temas → selector-visibilidad → boton-cancelar-alta → boton-crear.
- **Landmarks y jerarquía:** `role="dialog"` con `aria-modal` y `aria-labelledby` hacia titulo-modal (h2).
- **Foco y teclado:** atrapa el foco; `Escape` cierra; al cerrar sin crear, el foco vuelve al botón que lo abrió.
- **Propio de esta composición:** la ayuda de cada opción de visibilidad se asocia con `aria-describedby`.

## Decisiones y descartes

### REQ-021 — Documentación sin carpetas (propuesta B) (2026-10-26)

**Decisiones tomadas:**
- **Sin carpeta, sin nombre de archivo, sin plantilla.** El servicio 1.3.0 genera la ubicación y el nombre; pedirlos sería pedir algo que ya no se usa [REQ-021 decisión 2, RF-9].
- **El diálogo clasifica, porque ya no hay carpeta que clasifique.** Cliente, proyecto, temas y visibilidad reemplazan lo que antes decía la carpeta; se piden acá para que el documento aparezca bien filtrado desde el primer guardado.
- **Abre con relaciones precargadas desde las fichas.** Responde la pregunta abierta de REQ-016 sobre un alta prellenada desde la ficha [REQ-021 RF-16, CA-9].
- **Cerrar después de navegar.** Es el arreglo del bug de "Crear y editar": cerrar primero dejaba que el efecto de la vista corriera con el diálogo todavía desmontándose [REQ-021 decisión 9].

**Alternativas descartadas:**
- Lista controlada de temas: decisión 4 del dueño.
- Elegir requisitos y tareas en el alta: el pedido nombra cliente y proyecto; requisito o tarea solo llegan precargados desde su ficha.

**Preguntas abiertas:**
- Ninguna.

### REQ-016 — Módulo opcional de documentación (2026-10-24)

Diálogo de dos campos (título y nombre de archivo) en la carpeta actual. **Reemplazado por REQ-021.**
