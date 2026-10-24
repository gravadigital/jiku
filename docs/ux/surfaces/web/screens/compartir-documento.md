---
name: compartir-documento
surface: web
route: /docs/[id] (overlay)
overlay: true
overlay_type: modal
triggered_by: documento
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: diseñada
version: "1.0"
date: 2026-10-24
---

# Overlay O-12: Compartir documento

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — quien administra la carpeta del documento (`manage`).
- **JTBD / Propósito:** darle a alguien sin cuenta un link de solo lectura que vence solo, y poder cortarlo antes si hace falta [REQ-016 RF-22, CA-31].
- **Viewports:**
  - **desktop** — único viewport de la superficie.

## Entrada y salida

**Entradas:**
- `documento` · `boton-compartir` (solo con la función configurada y permiso `manage`)

**Salidas user-driven:**
- Cierra y vuelve a `documento` · `boton-cerrar-compartir`, `Escape` o click fuera
- A O-02 Confirmación · `boton-revocar` de una fila

**Salidas automáticas:**
- Ninguna.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | modal-compartir | modal | — | layout | desktop | — | Contenedor del diálogo |
| 2 | titulo-compartir | heading | h2 | content | desktop | — | Título del diálogo |
| 3 | explicacion-compartir | paragraph | caption | content | desktop | hidden_in_states: link creado | Qué ve quien recibe el link |
| 4 | selector-vencimiento | dropdown | closed / open | input | desktop | hidden_in_states: link creado, compartir bloqueado | Cuánto dura el link |
| 5 | campo-nota | text-input | default | input | desktop | hidden_in_states: link creado, compartir bloqueado | Para quién o para qué es el link |
| 6 | selector-adjuntos | toggle | ToggleGroup segmentado | input | desktop | hidden_in_states: link creado, compartir bloqueado | Si el link incluye los adjuntos |
| 7 | boton-crear-link | button | primary / disabled | input | desktop | hidden_in_states: link creado, compartir bloqueado; state_overrides: creando→disabled | Crea el link |
| 8 | aviso-link-creado | alert | success | feedback | desktop | visible_only_in_states: link creado | El link, mostrado una sola vez |
| 9 | campo-link | text-input | locked | input | desktop | visible_only_in_states: link creado | La URL, de solo lectura y seleccionable |
| 10 | boton-copiar | button | primary | input | desktop | visible_only_in_states: link creado | Copia la URL |
| 11 | aviso-secreto | alert | warning | feedback | desktop | visible_only_in_states: confirmar posible secreto | El documento parece contener un secreto |
| 12 | boton-compartir-igual | button | primary | input | desktop | visible_only_in_states: confirmar posible secreto | Confirma y crea el link |
| 13 | aviso-bloqueado | alert | info | feedback | desktop | visible_only_in_states: compartir bloqueado | La carpeta no permite compartir |
| 14 | titulo-links | heading | h3 | content | desktop | — | Encabeza la lista |
| 15 | tabla-links | table | light | content | desktop | hidden_in_states: sin links | Links existentes, sin la URL |
| 16 | boton-revocar | button | secondary-dismiss | input | desktop | solo en filas activas | Corta el link |
| 17 | vacio-links | empty-state | list | feedback | desktop | visible_only_in_states: sin links | Todavía no hay links |
| 18 | boton-cerrar-compartir | button | secondary-dismiss | input | desktop | — | Cierra el diálogo |

## Layout por viewport

### desktop · 1440px

- modal-compartir *(640 px de ancho, centrado)*
  - titulo-compartir
  - explicacion-compartir
  - aviso-bloqueado · aviso-secreto · aviso-link-creado *(a lo sumo uno)*
  - row `link` *(solo con link creado)*: campo-link *(9/12)*, boton-copiar *(3/12)*
  - row `formulario`
    - col 4/12: selector-vencimiento
    - col 8/12: campo-nota
  - selector-adjuntos
  - row `crear` (`flex-end`): boton-compartir-igual *(solo al confirmar)*, boton-crear-link
  - titulo-links
  - tabla-links *(con boton-revocar en la última columna)* · vacio-links
  - row `pie` (`flex-end`): boton-cerrar-compartir

## Contenido

### modal-compartir
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: reutiliza la superficie, el overlay y las reglas de foco de `ConfirmDialog` con un cuerpo de formulario (ver `## Revisión UX` de REQ-016)

### titulo-compartir
- Texto/label: `"Compartir «{título del documento}»"`
- Icono: share
- Asset: nada
- Annotation: nada

### explicacion-compartir
- Texto/label: `"Cualquiera que tenga el link va a poder leer la última versión del documento, sin iniciar sesión, hasta que venza o lo revoques."`
- Icono: nada
- Asset: nada
- Annotation: "la última versión" es literal: el link sigue al documento (`mode: latest`), así que lo que se edite después también se ve

### selector-vencimiento
- Texto/label: label `"Vence en"`; opciones `"7 días"` · `"15 días"` · `"30 días"` · `"90 días"` · `"180 días"`; default `"30 días"`
- Icono: calendar
- Asset: nada
- Annotation: `Select`. 180 días es el máximo que acepta el módulo, así que no se ofrece más [REQ-016 Supuestos]

### campo-nota
- Texto/label: label `"Nota (opcional)"`; placeholder `"Ej.: para el equipo de soporte de ACME"`
- Icono: nada
- Asset: nada
- Annotation: es la única forma de reconocer después para quién era cada link, porque la URL no se vuelve a mostrar

### selector-adjuntos
- Texto/label: label `"Adjuntos"`; opciones `"Incluir adjuntos"` · `"Solo el texto"`; default `"Incluir adjuntos"`
- Icono: nada
- Asset: nada
- Annotation: `ToggleGroup` segmentado. Sin adjuntos, las imágenes del documento no cargan en la página pública

### boton-crear-link
- Texto/label: `"Crear link"`
- Icono: link
- Asset: nada
- Annotation: nada

### aviso-link-creado
- Texto/label: `"Copiá el link ahora: por seguridad, no lo vas a poder volver a ver."`
- Icono: success
- Asset: nada
- Annotation: `role="status"`. Si se pierde, la salida es revocarlo y crear otro

### campo-link
- Texto/label: label `"Link"`; valor: la URL completa
- Icono: link
- Asset: nada
- Annotation: `Input` `locked`; seleccionado entero al recibir foco

### boton-copiar
- Texto/label: `"Copiar"` → tras copiar, `"Copiado"` durante 2 s
- Icono: check (solo en `"Copiado"`)
- Asset: nada
- Annotation: nada

### aviso-secreto
- Texto/label: `"Este documento parece contener una clave o un token. Si lo compartís, cualquiera con el link lo va a poder leer."`
- Icono: warning
- Asset: nada
- Annotation: aparece cuando el módulo rechaza el alta con `secret_warning_not_acknowledged`. La salida segura es cerrar y corregir el documento

### boton-compartir-igual
- Texto/label: `"Compartir igual"`
- Icono: nada
- Asset: nada
- Annotation: reenvía el alta reconociendo el aviso. El `"Crear link"` queda oculto en este estado para que la confirmación sea una acción distinta y no el mismo click repetido

### aviso-bloqueado
- Texto/label: `"La carpeta de este documento no permite compartirlo fuera de Jiku."`
- Icono: lock
- Asset: nada
- Annotation: `sharing_blocked`. La lista de links existentes se sigue mostrando y se puede revocar

### titulo-links
- Texto/label: `"Links de este documento"`
- Icono: nada
- Asset: nada
- Annotation: nada

### tabla-links
- Texto/label: columnas `"Estado"` · `"Vence"` · `"Nota"` · `"Accesos"` · `"Último acceso"` · (acción). Estado con `Badge`: `"Activo"` · `"Vencido"` · `"Revocado"`. Sin nota: `"—"`. Sin accesos: `"Nunca"` en "Último acceso"
- Icono: nada
- Asset: nada
- Annotation: **la URL y el token no aparecen nunca en la lista** [REQ-016 CA-31]. Orden: más nuevo primero

### boton-revocar
- Texto/label: `"Revocar"`
- Icono: nada
- Asset: nada
- Annotation: abre O-02 con `"Revocar link"` · `"Quien tenga este link va a dejar de poder abrir el documento. No se puede deshacer."` · `"Revocar"` / `"Cancelar"`

### vacio-links
- Texto/label: `"Este documento todavía no tiene links."`
- Icono: link
- Asset: nada
- Annotation: `EmptyState` `list`

### boton-cerrar-compartir
- Texto/label: `"Cerrar"`
- Icono: nada
- Asset: nada
- Annotation: con un link recién creado, cerrar es lo que lo hace desaparecer para siempre; el aviso ya lo dijo, no se pide confirmación

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: formulario y lista visibles

### empty
- Aplica: Sí (sin links)
- Mensaje: `"Este documento todavía no tiene links."`
- Cambios:
  - vacio-links: visible; tabla-links: oculta

### loading
- Aplica: Sí
- Mensaje: —
- Cambios:
  - tabla-links: `Loader` `inline` en el cuerpo
  - boton-crear-link: disabled con `Loader` `inline` mientras crea

### error de validación
- Aplica: Sí
- Mensaje: `"El vencimiento no es válido. Elegí entre 7 y 180 días."` (`share_expiry_invalid`)
- Cambios:
  - selector-vencimiento: state=error

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo crear el link. Intentá de nuevo."` · lista: `"No se pudieron cargar los links."` · función no configurada: `"Compartir no está habilitado en esta instalación."` (`sharing_not_configured`)
- Cambios:
  - mensaje `role="alert"` sobre el formulario

### success
- Aplica: Sí (link creado — ver sub-estado)
- Mensaje: `"Copiá el link ahora: por seguridad, no lo vas a poder volver a ver."`
- Cambios: ver *link creado*

### not found
- Aplica: No — el documento ya está abierto; si dejó de existir, el error se muestra como error de sistema.

### estado terminal / readonly
- Aplica: Sí (compartir bloqueado — ver sub-estado)

### link creado (parent_state: success)
- Aplica: Sí [REQ-016 CA-31]
- Mensaje: `"Copiá el link ahora: por seguridad, no lo vas a poder volver a ver."`
- Cambios:
  - aviso-link-creado, campo-link, boton-copiar: visibles
  - explicacion-compartir, selector-vencimiento, campo-nota, selector-adjuntos, boton-crear-link: ocultos
  - tabla-links: suma la fila nueva, **sin la URL**

### confirmar posible secreto (parent_state: default)
- Aplica: Sí
- Mensaje: `"Este documento parece contener una clave o un token. Si lo compartís, cualquiera con el link lo va a poder leer."`
- Cambios:
  - aviso-secreto y boton-compartir-igual: visibles
  - boton-crear-link: oculto

### compartir bloqueado (parent_state: default)
- Aplica: Sí
- Mensaje: `"La carpeta de este documento no permite compartirlo fuera de Jiku."`
- Cambios:
  - aviso-bloqueado: visible
  - formulario: oculto; la lista sigue visible con boton-revocar operable

### sin links (parent_state: default)
- Aplica: Sí
- Mensaje: `"Este documento todavía no tiene links."`
- Cambios:
  - vacio-links: visible

## Interacciones

**Eventos:**
- boton-crear-link · on click → `POST /docs/documents/{id}/shares` con vencimiento, nota y adjuntos → *link creado*; `secret_warning_not_acknowledged` → *confirmar posible secreto*; `sharing_blocked` → *compartir bloqueado*
- boton-compartir-igual · on click → reenvía reconociendo el aviso → *link creado*
- boton-copiar · on click → copia al portapapeles; el label pasa a `"Copiado"` 2 s
- boton-revocar · on click → O-02; al confirmar, `DELETE /docs/shares/{id}` y la fila pasa a `"Revocado"`
- boton-cerrar-compartir / `Escape` · → cierra; la URL creada se descarta de memoria

**Validaciones:**
- Ninguna en el cliente: el vencimiento sale de una lista cerrada

**Feedback:**
- Revocar: el badge de la fila cambia a `"Revocado"`; sin toast (el resultado se ve)

## Accesibilidad

- **Orden de foco:** selector-vencimiento → campo-nota → selector-adjuntos → boton-crear-link → filas de tabla-links (boton-revocar) → boton-cerrar-compartir. Con link creado, el foco va a campo-link.
- **Landmarks y jerarquía:** `role="dialog"` con `aria-modal`, `aria-labelledby` hacia titulo-compartir (h2) y h3 para la lista.
- **Foco y teclado:** atrapa el foco; `Escape` cierra; al cerrar vuelve a `boton-compartir`. O-02 se apila encima y devuelve el foco a la fila revocada.
- **Propio de esta composición:** el cambio a *link creado* se anuncia (`role="status"`) porque reemplaza el formulario sin navegar; `"Copiado"` también se anuncia.

## Decisiones y descartes

### REQ-016 — Módulo opcional de documentación (2026-10-24)

**Decisiones tomadas:**
- **Crear y listar en el mismo diálogo.** Quien comparte casi siempre quiere ver qué links ya existen antes de crear otro; separarlos haría crear duplicados.
- **El link se muestra una sola vez, y el diálogo lo dice antes de que se pierda.** El módulo no lo vuelve a entregar; la nota es la que permite reconocer cada link después [REQ-016 Supuestos].
- **Vencimiento elegido de una lista, no con un calendario.** Cinco plazos cubren los casos y no hay fecha inválida posible; 15 días está porque es el caso del criterio de aceptación [REQ-016 CA-31].
- **La confirmación de posible secreto es un botón distinto.** Si fuera el mismo "Crear link", el segundo click sería un reflejo y no una decisión.
- **Adjuntos con `ToggleGroup` y no con checkbox.** El DS de `web` no tiene checkbox; el segmentado es el control existente para una elección entre dos opciones.

**Alternativas descartadas:**
- Mostrar la URL en la lista: el contrato no la devuelve y no debe guardarse en el navegador.
- Elegir una versión fija para el link: el pedido no lo pide y "sigue al documento" es lo que se espera de un link a documentación viva.

**Preguntas abiertas:**
- Ninguna.
