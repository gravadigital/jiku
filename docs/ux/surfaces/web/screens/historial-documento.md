---
name: historial-documento
surface: web
route: /docs/[id] (overlay)
overlay: true
overlay_type: drawer
triggered_by: documento
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: diseñada
version: "1.1"
date: 2026-10-26
---

# Overlay O-13: Historial de versiones

## Identidad

- **Audiencia primaria:** [equipo-interno](../../../audiences/equipo-interno/research-context.md) — quiere saber quién cambió un documento y cuándo, ver cómo estaba antes, o volver a una versión anterior.
- **JTBD / Propósito:** listar las versiones de un documento con autor, fecha, tipo, mensaje y si están protegidas; abrir una en lectura y restaurarla; saber cuántas versiones intermedias se compactaron [REQ-021 decisión 10, RF-14, CA-20; `compactacion-historial-v1.md` §5].
- **Viewports:**
  - **desktop** — único viewport de la superficie.

## Entrada y salida

**Entradas:**
- `documento` · `boton-historial` (en lectura)

**Salidas user-driven:**
- A `documento` en *viendo una versión anterior* · `boton-ver-version` de una fila (`/docs/{id}?version={n}`); el panel se cierra
- A O-02 Confirmación · `boton-restaurar-version` de una fila
- Cierra y vuelve a `documento` · `boton-cerrar-historial`, `Escape` o click fuera

**Salidas automáticas:**
- Tras restaurar con éxito, el panel se cierra y `documento` muestra la versión nueva.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | panel-historial | modal | drawer lateral derecho | layout | desktop | — | Contenedor del panel |
| 2 | titulo-historial | heading | h2 | content | desktop | — | Título del panel |
| 3 | boton-cerrar-historial | button | secondary-dismiss | input | desktop | — | Cierra el panel |
| 4 | lista-versiones | list | — | content | desktop | hidden_in_states: loading, error de sistema / sin conexión | Una entrada por versión, la más nueva primero |
| 5 | marca-version-actual | badge | — | content | desktop | solo en la entrada de la versión actual | Cuál es la versión vigente |
| 6 | marca-protegida | badge | — | content | desktop | solo en versiones protegidas | La versión no se compacta |
| 7 | boton-ver-version | button | secondary-nav | navigation | desktop | en cada entrada salvo la actual | Abre la versión en lectura |
| 8 | boton-restaurar-version | button | secondary-dismiss / disabled | input | desktop | en cada entrada salvo la actual; state_overrides: restaurando→disabled, documento bloqueado→disabled | Crea una versión nueva con ese contenido |
| 9 | boton-mas-versiones | button | secondary-dismiss | input | desktop | visible solo cuando hay más versiones | Trae las anteriores |
| 10 | pie-compactadas | paragraph | caption | content | desktop | visible solo con versiones compactadas | Cuántas versiones intermedias se compactaron |
| 11 | cargando-historial | loader | block | feedback | desktop | visible_only_in_states: loading | Carga de la lista |
| 12 | aviso-error-historial | alert | error | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Fallo de la consulta o de la restauración |

## Layout por viewport

### desktop · 1440px

- panel-historial *(480 px, anclado a la derecha, alto completo, sobre la lectura del documento)*
  - row `cabecera` (`space-between`): titulo-historial, boton-cerrar-historial
  - aviso-error-historial
  - lista-versiones *(scroll propio; en cada entrada: número y marcas arriba, autor y fecha, tipo y mensaje, y abajo boton-ver-version + boton-restaurar-version)* · cargando-historial
  - boton-mas-versiones
  - pie-compactadas *(fijo al pie)*

## Contenido

### panel-historial
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: panel lateral con overlay; reutiliza el armazón de foco de `ConfirmDialog` (gap de `modal` anotado desde REQ-016)

### titulo-historial
- Texto/label: `"Historial de versiones"`
- Icono: clock
- Asset: nada
- Annotation: nada

### boton-cerrar-historial
- Texto/label: nombre accesible `"Cerrar historial"`
- Icono: close
- Asset: nada
- Annotation: botón solo icono

### lista-versiones
- Texto/label: por entrada: `"Versión {n}"` · `"{autor}"` · `"{DD/MM/AAAA HH:mm}"` · tipo `"Creación"` / `"Edición"` / `"Restauración"` (`"Restauración de la versión {m}"` cuando se conoce el origen) · el mensaje entre comillas si lo tiene. Autor sin nombre: `"—"`; si es la persona actual, `"vos"`
- Icono: nada
- Asset: nada
- Annotation: autor del servicio (`authorName`), nunca `"otra persona"` [REQ-021 RF-15, CA-18]. `"vos"` cuando el autor es la persona actual, reconocida por su identidad de acceso; sin ella, nunca `"vos"` [REQ-022 RF-7, CA-9, CA-10]. 50 por pedido, la más nueva primero

### marca-version-actual
- Texto/label: `"Actual"`
- Icono: nada
- Asset: nada
- Annotation: `Badge` `outline`

### marca-protegida
- Texto/label: `"Protegida"`
- Icono: lock
- Asset: nada
- Annotation: `Badge` `outline`. Nombre accesible `"Protegida: no se borra al compactar el historial"`. Una versión con mensaje queda protegida [REQ-021 CA-19, CA-20]

### boton-ver-version
- Texto/label: `"Ver"`
- Icono: eye
- Asset: nada
- Annotation: abre `/docs/{id}?version={n}` y cierra el panel

### boton-restaurar-version
- Texto/label: `"Restaurar"`
- Icono: refresh
- Asset: nada
- Annotation: abre O-02 con `"Restaurar la versión {n}"` · `"Se va a guardar una versión nueva con el contenido de la versión {n}. La versión actual no se pierde: queda en el historial."` · `"Restaurar"` / `"Cancelar"`. Deshabilitado si alguien tiene la reserva de edición, con la ayuda `"{nombre} lo está editando."`

### boton-mas-versiones
- Texto/label: `"Ver versiones anteriores"`
- Icono: nada
- Asset: nada
- Annotation: la consulta pagina por cursor; no hay total que mostrar

### pie-compactadas
- Texto/label: `"{n} versiones intermedias compactadas."` · con 1: `"1 versión intermedia compactada."`
- Icono: info
- Asset: nada
- Annotation: dato del documento (`prunedVersionsCount`). Sin versiones compactadas, el pie no se muestra

### cargando-historial
- Texto/label: `"Cargando versiones…"`
- Icono: nada
- Asset: nada
- Annotation: `Loader` `block`

### aviso-error-historial
- Texto/label: `"No se pudo cargar el historial. Intentá de nuevo."` · al restaurar: `"No se pudo restaurar la versión {n}. Intentá de nuevo."` · versión compactada: `"La versión {n} ya no se conserva."` · cambió mientras tanto: `"El documento cambió mientras restaurabas; actualizamos el historial."`
- Icono: error
- Asset: nada
- Annotation: `role="alert"`

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno

### empty
- Aplica: No — todo documento tiene al menos la versión de creación.

### loading
- Aplica: Sí
- Mensaje: `"Cargando versiones…"`
- Cambios:
  - cargando-historial: visible
  - lista-versiones: oculta

### error de validación
- Aplica: No — el panel no tiene campos.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"No se pudo cargar el historial. Intentá de nuevo."`
- Cambios:
  - aviso-error-historial: visible

### success
- Aplica: Sí (restaurada)
- Mensaje: `"Restauraste la versión {n} como versión {nueva}."` (toast de `documento`)
- Cambios:
  - el panel se cierra; `documento` muestra la versión nueva

### not found
- Aplica: No — el documento ya está abierto; si dejó de existir, el error se muestra como error de sistema.

### estado terminal / readonly
- Aplica: Sí (documento bloqueado)
- Mensaje: `"{nombre} lo está editando."`
- Cambios:
  - boton-restaurar-version: disabled en todas las entradas

### restaurando (parent_state: default)
- Aplica: Sí
- Mensaje: —
- Cambios:
  - boton-restaurar-version de esa entrada: disabled con `Loader` `inline`

## Interacciones

**Eventos:**
- boton-ver-version · on click → navega a `/docs/{id}?version={n}` y cierra
- boton-restaurar-version · on click → O-02; al confirmar, restaura sobre la versión actual → *success*; `version_conflict` → recarga la lista y avisa; `version_pruned` → aviso
- boton-mas-versiones · on click → pide la página siguiente
- boton-cerrar-historial / `Escape` · → cierra

**Validaciones:**
- Ninguna.

**Feedback:**
- Restaurar: toast en `documento` y meta-version con la versión nueva

## Accesibilidad

- **Orden de foco:** boton-cerrar-historial → entradas de lista-versiones (boton-ver-version, boton-restaurar-version) → boton-mas-versiones.
- **Landmarks y jerarquía:** `role="dialog"` con `aria-modal` y `aria-labelledby` hacia titulo-historial (h2); la lista es `<ol>` con una entrada por versión.
- **Foco y teclado:** al abrir, el foco va al título; atrapa el foco; `Escape` cierra y devuelve el foco a `boton-historial`. O-02 se apila encima.
- **Propio de esta composición:** "Protegida" y "Actual" llevan texto visible, no solo un icono.

## Decisiones y descartes

### REQ-022 — Arreglos e2e de la documentación sin carpetas (2026-10-26)

**Decisiones tomadas:**
- **El autor propio se reconoce por la identidad de acceso**, la misma que el módulo guarda en cada versión; el id de Jiku no coincide nunca [REQ-022 JIKU-WEB-4, CA-9].

**Alternativas descartadas:**
- Ninguna.

**Preguntas abiertas:**
- Ninguna.

### REQ-021 — Documentación sin carpetas (propuesta B) (2026-10-26)

**Decisiones tomadas:**
- **Panel lateral y no pantalla.** Se consulta con el documento a la vista; una ruta propia obligaría a ir y volver para comparar [REQ-021 Diseño de la web, "Historial"].
- **"Ver" abre la versión en la pantalla del documento.** El panel es angosto para leer un documento entero; la lectura ya tiene el render seguro y el índice.
- **Restaurar con confirmación, y la confirmación aclara que no se pierde nada.** Restaurar crea una versión nueva; sin decirlo, parece una operación destructiva. Entra en alcance porque la api ya lo expone [REQ-021 Supuestos "Historial"].
- **El conteo de compactadas va al pie, no intercalado.** El servicio no dice *dónde* están los huecos, solo cuántos hubo; intercalar marcas inventaría posiciones.

**Alternativas descartadas:**
- Diff entre versiones: componente nuevo y el pedido no lo pide.

**Preguntas abiertas:**
- Ninguna.
