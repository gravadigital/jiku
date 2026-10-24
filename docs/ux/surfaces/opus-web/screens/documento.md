---
name: documento
surface: opus-web
route: /projects/[projectId]/docs/[documentId]
viewports:
  - mobile
  - desktop
audiences:
  - cliente
fidelity: mid
status: diseñada
version: "1.1"
date: 2026-10-24
---

# Pantalla: Documento

## Identidad

- **Audiencia primaria:** [cliente](../../../audiences/cliente/research-context.md) — entra de a ratos a ver cómo va lo que pidió; un documento del equipo (una guía, un manual, el resultado de un análisis) es parte de esa respuesta.
- **JTBD / Propósito:** leer un documento que el equipo publicó para el proyecto, con sus imágenes y adjuntos, sin poder editarlo [REQ-016 RF-24, CA-34].
- **Viewports:**
  - **mobile** — lectura a ancho completo; el documento es texto y se lee bien a 390 px. Sin chrome, como el resto de la superficie bajo 768 px.
  - **desktop** — el texto a un ancho de lectura cómodo (máx. ~760 px) con los adjuntos a la derecha.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- `tablero-requisitos` · fila de `seccion-documentos`
- `detalle-requisito` (pantalla y overlay O-01) · fila de `seccion-documentos`
- URL directa

**Salidas user-driven:**
- A `tablero-requisitos` del proyecto · `boton-volver` o el nivel de proyecto del breadcrumb
- Descarga de un adjunto · click en un ítem de `lista-adjuntos` (`/api/docs/documents/{documentId}/attachments/{id}` de opus-web → 302) [REQ-017 DD-2]

**Salidas automáticas:**
- Ninguna. Con el módulo `not_installed` la ruta responde 404.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | sidebar-navegacion | sidebar | — | layout | solo desktop | — | Chrome de `(dashboard)` |
| 2 | encabezado-documento | header | — | layout | ambos | — | Breadcrumb y volver |
| 3 | breadcrumb | breadcrumbs | 3 niveles | navigation | ambos | hidden_in_states: loading | Proyecto › Documentación › título |
| 4 | boton-volver | button | secondary | input | ambos | — | Vuelve al tablero del proyecto |
| 5 | titulo-documento | heading | h1 | content | ambos | visible_only_in_states: default, módulo no disponible | Título del documento |
| 6 | fecha-actualizacion | paragraph | caption | content | ambos | visible_only_in_states: default | Cuándo se actualizó |
| 7 | contenido-documento | paragraph | body (markdown renderizado) | content | ambos | visible_only_in_states: default | El documento, sin HTML ni scripts |
| 8 | titulo-adjuntos | heading | h3 | content | ambos | visible_only_in_states: default; oculto sin adjuntos | Encabeza los adjuntos |
| 9 | lista-adjuntos | list | — | content | ambos | visible_only_in_states: default; oculto sin adjuntos | Un enlace por adjunto |
| 10 | indicador-carga | loader | lg | feedback | ambos | visible_only_in_states: loading | Carga del documento |
| 11 | alerta-not-found | alert | error | feedback | ambos | visible_only_in_states: not found | Documento inexistente o no compartido |
| 12 | alerta-sistema | alert | error | feedback | ambos | visible_only_in_states: error de sistema / sin conexión | Fallo de carga |
| 13 | alerta-no-disponible | alert | warning | feedback | ambos | visible_only_in_states: módulo no disponible | El módulo no responde |
| 14 | boton-reintentar | button | primary | input | ambos | visible_only_in_states: error de sistema / sin conexión, módulo no disponible | Reintentar la carga |

## Layout por viewport

### mobile · 390px

- *(sin chrome)*
- encabezado-documento
  - breadcrumb
  - boton-volver
- titulo-documento
- fecha-actualizacion
- contenido-documento
- titulo-adjuntos
- lista-adjuntos
- indicador-carga · alerta-not-found · alerta-sistema · alerta-no-disponible · boton-reintentar *(según el estado)*

### desktop · 1440px

- *(chrome: sidebar-navegacion 263 px)*
- encabezado-documento *(61 px)*
  - row `header`
    - col 8/12: breadcrumb
    - col 4/12: boton-volver *(a la derecha)*
- row `cuerpo`
  - col 8/12: titulo-documento, fecha-actualizacion, contenido-documento *(ancho máximo de lectura ~760 px)*
  - col 4/12: titulo-adjuntos, lista-adjuntos
- indicador-carga · alerta-not-found · alerta-sistema · alerta-no-disponible · boton-reintentar *(centrados, según el estado)*

## Contenido

### sidebar-navegacion
- Texto/label: el del shell
- Icono: nada
- Asset: nada
- Annotation: el proyecto del documento queda marcado como activo

### encabezado-documento
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: mismo alto y estructura que el `BoardHeader` del resto de la superficie

### breadcrumb
- Texto/label: `"{proyecto}"` › `"Documentación"` › `"{título}"`
- Icono: nada
- Asset: nada
- Annotation: `"{proyecto}"` y `"Documentación"` llevan al tablero del proyecto, donde está la sección de documentos

### boton-volver
- Texto/label: `"Volver"`
- Icono: arrow-left
- Asset: nada
- Annotation: `Button` `secondary`

### titulo-documento
- Texto/label: dinámico desde el título del documento
- Icono: nada
- Asset: nada
- Annotation: nada

### fecha-actualizacion
- Texto/label: `"Actualizado el {DD/MM/AAAA}"`
- Icono: nada
- Asset: nada
- Annotation: **sin autor ni versión**: al cliente le sirve saber si es reciente, no quién del equipo lo tocó ni cuántas veces

### contenido-documento
- Texto/label: el markdown del documento, renderizado; el frontmatter no se muestra
- Icono: nada
- Asset: imágenes a ancho máximo de la columna
- Annotation: **nunca ejecuta HTML ni scripts**; los enlaces solo pueden ser `http(s)`, `mailto` o adjuntos. Todo enlace o imagen cuyo path sea `/docs/attachments/{id}` se reescribe a `/api/docs/documents/{documentId}/attachments/{id}` de opus-web —con el id **del documento abierto**—, que lo resuelve con la sesión del cliente [REQ-016 Escenario F, REQ-017 DD-2, CA-11]. Un enlace o imagen que apunta al adjunto de **otro** documento se renderiza igual, pero no abre: el proxy responde 404 (enlace que no descarga, imagen rota) [REQ-017 R-3]. Los títulos del markdown se desplazan un nivel para no competir con el h1

### titulo-adjuntos
- Texto/label: `"Adjuntos"`
- Icono: nada
- Asset: nada
- Annotation: nada

### lista-adjuntos
- Texto/label: un enlace por adjunto con su nombre de archivo
- Icono: download
- Asset: nada
- Annotation: abre en pestaña nueva. El `href` lleva el documento y el adjunto: `/api/docs/documents/{documentId}/attachments/{id}`, con el `documentId` que trae cada adjunto (o, si faltara, el del documento abierto) [REQ-017 DD-2]

### indicador-carga
- Texto/label: `"Cargando documento..."`
- Icono: nada
- Asset: nada
- Annotation: `Spinner` `lg`

### alerta-not-found
- Texto/label: `"Este documento no existe o no está compartido con vos."`
- Icono: error
- Asset: nada
- Annotation: mismo texto para inexistente, interno o de otro proyecto: el portal no revela que un documento interno existe [REQ-016 DD-3]

### alerta-sistema
- Texto/label: `"No se pudo cargar el documento."`
- Icono: error
- Asset: nada
- Annotation: `role="alert"`

### alerta-no-disponible
- Texto/label: `"Los documentos no están disponibles en este momento. Probá de nuevo en unos minutos."`
- Icono: warning
- Asset: nada
- Annotation: mismo texto en las tres vistas del portal que muestran documentos

### boton-reintentar
- Texto/label: `"Reintentar"`
- Icono: refresh
- Asset: nada
- Annotation: nada

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base)

### empty
- Aplica: No — un documento siempre tiene contenido; sin adjuntos, su sección no se muestra.

### loading
- Aplica: Sí
- Mensaje: `"Cargando documento..."`
- Cambios:
  - indicador-carga: visible; contenido oculto

### error de validación
- Aplica: No — la pantalla es de solo lectura.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo cargar el documento."`
- Cambios:
  - alerta-sistema y boton-reintentar: visibles

### success
- Aplica: No — no hay acciones.

### not found
- Aplica: Sí
- Mensaje: `"Este documento no existe o no está compartido con vos."`
- Cambios:
  - alerta-not-found: visible; boton-volver como salida

### estado terminal / readonly
- Aplica: Sí — la pantalla entera es de solo lectura, para todos los roles; no hay nada que marcar porque no hay nada editable.

### módulo no disponible (parent_state: default)
- Aplica: Sí [REQ-016 RF-24]
- Mensaje: `"Los documentos no están disponibles en este momento. Probá de nuevo en unos minutos."`
- Cambios:
  - alerta-no-disponible y boton-reintentar: visibles; contenido oculto

## Interacciones

**Eventos:**
- boton-volver / breadcrumb (proyecto o "Documentación") · on click → navega a `/projects/{projectId}/requirements`
- adjunto de lista-adjuntos o enlace de adjunto en el contenido · on click → abre `/api/docs/documents/{documentId}/attachments/{id}` en pestaña nueva (302 a la descarga; 404 si el adjunto no pertenece a este documento público) [REQ-017 DD-2, CA-8, CA-9]
- boton-reintentar · on click → vuelve a pedir el documento (y el estado del módulo)

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno más allá de los estados.

## Accesibilidad

- **Orden de foco:** breadcrumb → boton-volver → enlaces del contenido → lista-adjuntos.
- **Landmarks y jerarquía:** `main` con un único h1 (titulo-documento); h3 para "Adjuntos".
- **Foco y teclado:** sin overlays propios.
- **Propio de esta composición:** al terminar de cargar, el foco no se mueve (la página se abrió por navegación); las alertas de error llevan `role="alert"`.

## Decisiones y descartes

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas:**
- **Una página propia, dentro del proyecto, y no un modal.** El documento puede ser largo y tener imágenes; un modal sobre el tablero se queda chico y no se puede pasar por link. La ruta cuelga de `/projects/[projectId]/` porque toda la superficie ocurre dentro de un proyecto.
- **Solo lectura, sin búsqueda ni compartir.** Es el alcance del pedido para el portal [REQ-016 §Fuera de Alcance].
- **Sin autor ni versión.** Son datos internos del equipo; el cliente necesita saber si el documento es reciente, y eso lo dice la fecha.
- **El mismo mensaje para "no existe" y "es interno".** El portal recorta a `public` por superficie, igual que con los requisitos; decir "es interno" revelaría que existe [REQ-016 DD-3].
- **Mobile entra.** Leer un documento en el teléfono es un caso real del cliente y el texto se acomoda solo; la pantalla no depende de la navegación que falta en mobile, porque se llega por un enlace.

**Alternativas descartadas:**
- Listado de todos los documentos del proyecto en una pantalla aparte: el cliente tiene pocos documentos por proyecto y la sección del tablero ya los muestra.

**Preguntas abiertas:**
- Ninguna.

### REQ-017 — Roles para conectores y cierre de brechas de docs (2026-10-24)

**Decisiones tomadas:**
- **El adjunto se pide bajo su documento.** El proxy pasa de `/api/docs/attachments/{id}` a `/api/docs/documents/{documentId}/attachments/{id}`, y la api verifica que el documento sea `public` y que el adjunto le pertenezca antes de generar la descarga. Cierra la brecha F-13: un rol interno que conocía el id de un adjunto de un documento `internal` podía bajarlo por el portal [REQ-017 RF-7, RF-8, CA-8, DD-2]. **Para el cliente no cambia nada visible**: los adjuntos del propio documento se ven y se descargan como antes [CA-9, CA-11].
- **Un enlace al adjunto de otro documento deja de abrir, y no se le da tratamiento visible.** Es el único efecto observable del cambio: el enlace sigue en el texto y al abrirlo el proxy responde 404 (en una imagen, se ve rota). Se acepta porque es el comportamiento correcto para una superficie compartida con el cliente, y porque es un caso raro: el editor de la web inserta los adjuntos del documento que se está editando [REQ-017 DD-2, R-3]. Queda registrado en `known-limitations.md`.
- **Sin cambios de layout, bloques ni estados, en ningún viewport.** Es un cambio de URL y de autorización; mobile y desktop quedan igual.

**Alternativas descartadas:**
- Detectar en el visor los enlaces a adjuntos que no están en la lista del documento y mostrarlos como texto sin enlace (o con un aviso "Adjunto no disponible"): agrega lógica al renderizador de markdown para un caso marginal que el REQ acepta como límite conocido. Si aparece en la práctica, se diseña aparte.

**Preguntas abiertas:**
- Ninguna.
