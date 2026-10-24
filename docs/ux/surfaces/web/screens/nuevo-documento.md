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
version: "1.0"
date: 2026-10-24
---

# Overlay O-11: Nuevo documento

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md).
- **JTBD / Propósito:** crear un documento en la carpeta en la que se está parado y pasar directo a escribirlo [REQ-016 RF-12, Supuestos "Rutas de administración de carpetas"].
- **Viewports:**
  - **desktop** — único viewport de la superficie.

## Entrada y salida

**Entradas:**
- `documentacion` · `boton-nuevo-documento` (solo en carpetas con `write` o `manage`)

**Salidas user-driven:**
- A `documento` en estado *editando* · `boton-crear` con éxito
- Cierra y vuelve a `documentacion` · `boton-cancelar-alta`, `Escape` o click fuera

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | modal-nuevo-documento | modal | — | layout | desktop | — | Contenedor del diálogo |
| 2 | titulo-modal | heading | h2 | content | desktop | — | Título del diálogo |
| 3 | carpeta-destino | label | — | content | desktop | — | Carpeta donde se crea, fija |
| 4 | campo-nombre-archivo | text-input | default / error | input | desktop | state_overrides: error de validación→error | Nombre del archivo `.md` |
| 5 | campo-titulo | text-input | default | input | desktop | — | Título inicial del documento |
| 6 | boton-cancelar-alta | button | secondary-dismiss | input | desktop | — | Cierra sin crear |
| 7 | boton-crear | button | primary / disabled | input | desktop | state_overrides: creando→disabled; nombre vacío→disabled | Crea el documento |

## Layout por viewport

### desktop · 1440px

- modal-nuevo-documento *(480 px de ancho, centrado)*
  - titulo-modal
  - carpeta-destino
  - campo-nombre-archivo
  - campo-titulo
  - row `acciones` (`flex-end`): boton-cancelar-alta, boton-crear

## Contenido

### modal-nuevo-documento
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: reutiliza la superficie, el overlay y las reglas de foco de `ConfirmDialog` con un cuerpo de formulario (ver `## Revisión UX` de REQ-016)

### titulo-modal
- Texto/label: `"Nuevo documento"`
- Icono: nada
- Asset: nada
- Annotation: nada

### carpeta-destino
- Texto/label: `"Se crea en {ruta de la carpeta}"`
- Icono: folder
- Asset: nada
- Annotation: no es editable: para crear en otra carpeta se navega hasta ella

### campo-nombre-archivo
- Texto/label: label `"Nombre del archivo"`; placeholder `"guia-de-despliegue.md"`; ayuda `"Minúsculas, números y guiones. Si no termina en .md, se lo agregamos."`
- Icono: file
- Asset: nada
- Annotation: se completa solo a partir del título mientras la persona no lo toque

### campo-titulo
- Texto/label: label `"Título"`; placeholder `"Guía de despliegue"`
- Icono: nada
- Asset: nada
- Annotation: el contenido inicial es `# {Título}`. Opcional: sin título, el documento arranca vacío

### boton-cancelar-alta
- Texto/label: `"Cancelar"`
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-crear
- Texto/label: `"Crear y editar"`
- Icono: nada
- Asset: nada
- Annotation: crea el documento, cierra el diálogo y abre `/docs/{id}` ya en edición, con la reserva tomada

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno

### empty
- Aplica: No — es un formulario.

### loading
- Aplica: Sí (creando)
- Mensaje: —
- Cambios:
  - boton-crear: disabled con `Loader` `inline`

### error de validación
- Aplica: Sí
- Mensaje: `"Ya hay un documento con ese nombre en esta carpeta."` (`already_exists`) · `"Ese nombre no es válido. Usá minúsculas, números y guiones."` (`file_name_invalid`)
- Cambios:
  - campo-nombre-archivo: state=error con el mensaje

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo crear el documento. Intentá de nuevo."` · con el módulo caído: `"La documentación no está disponible en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - mensaje debajo de los campos, `role="alert"`; los campos conservan lo escrito

### success
- Aplica: No — el éxito es navegar al documento en edición.

### not found
- Aplica: No — la carpeta ya está cargada; si dejó de existir, el error llega como `folder_not_found` y se muestra como error de sistema.

### estado terminal / readonly
- Aplica: No — el diálogo no se ofrece sin permiso de escritura.

## Interacciones

**Eventos:**
- campo-titulo · on input → sugiere el nombre de archivo (minúsculas, guiones, `.md`) si campo-nombre-archivo no fue editado a mano
- boton-crear · on click → `POST /docs/documents` con la carpeta, el nombre y el contenido inicial → navega a `/docs/{id}` en edición
- boton-cancelar-alta / `Escape` · → cierra sin crear

**Validaciones:**
- campo-nombre-archivo · vacío → boton-crear deshabilitado, sin mensaje
- campo-nombre-archivo · el resto lo valida el módulo (ver *error de validación*)

**Feedback:**
- Navegación directa al editor; sin toast (el resultado se ve)

## Accesibilidad

- **Orden de foco:** campo-titulo → campo-nombre-archivo → boton-cancelar-alta → boton-crear.
- **Landmarks y jerarquía:** `role="dialog"` con `aria-modal` y `aria-labelledby` hacia titulo-modal (h2).
- **Foco y teclado:** atrapa el foco; `Escape` cierra; al cerrar sin crear, el foco vuelve a `boton-nuevo-documento`.
- **Propio de esta composición:** el foco inicial va a campo-titulo y no al nombre de archivo, porque el nombre se deriva de él.

## Decisiones y descartes

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas:**
- **Un diálogo de dos campos y no una pantalla de alta.** Lo único que se decide al crear es dónde y cómo se llama; el resto se escribe en el editor, que es adonde el diálogo lleva.
- **La carpeta no se elige acá.** Es la carpeta en la que se está; elegir otra en un selector duplicaría la navegación de `documentacion` y obligaría a filtrar por permiso de escritura.
- **El título propone el nombre de archivo.** Es el campo que la persona piensa primero; pedir primero un nombre con reglas de formato es empezar por la parte técnica.

**Alternativas descartadas:**
- Prellenar vínculos (proyecto, requisito, tarea) desde el diálogo: los vínculos viven en el frontmatter y se editan en el editor; un selector acá sería una segunda forma de escribir lo mismo.

**Preguntas abiertas:**
- Ninguna.
