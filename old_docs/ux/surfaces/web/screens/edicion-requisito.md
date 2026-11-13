---
name: edicion-requisito
surface: web
route: /requirements/[reqid]/edit
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Edición de requisito

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** editar un requisito existente en dos paneles: detalle (título, contexto, etiquetas) e información general [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. Mismo formulario a dos paneles que el alta, con la columna derecha de 420px fijos (`EditRequirementForm.module.scss:89-90`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. El formulario declara cortes propios en 1024px y 640px que no acompaña ningún tratamiento del chrome.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde detalle-requisito · link `"Editar"` del encabezado (`RequirementHeader.tsx:210-212`)

**Salidas user-driven:**
- A `/requirements/{id}` · click en el link `"Volver"` (`:346-348`)

**Salidas automáticas:**
- A `/requirements/{id}` · tras guardar con éxito (`:308`)
- A la pantalla de not found de Next · `notFound()` si el `reqid` de la URL no es numérico (`requirements/[reqid]/edit/page.tsx:14`)

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | encabezado-pagina | header | — | layout | desktop | — | Título y acciones de la edición |
| 2 | titulo-pagina | heading | h1 | content | desktop | — | Identifica la pantalla |
| 3 | boton-volver | link | — | navigation | desktop | — | Salida al detalle |
| 4 | boton-guardar | button | primary · default / loading | input | desktop | state_overrides: loading→disabled + aria-busy | Submit del formulario |
| 5 | panel-detalle | card | — | layout | desktop | — | Agrupa título, contexto y etiquetas |
| 6 | titulo-panel-detalle | heading | h2 | content | desktop | — | Encabeza el panel izquierdo |
| 7 | campo-titulo | text-input | default | input | desktop | — | Título del requisito |
| 8 | campo-contexto | text-input | default | input | desktop | — | Contexto en markdown con adjuntos |
| 9 | seccion-etiquetas | section | — | layout | desktop | — | Agrupa el bloque de etiquetas |
| 10 | chip-etiqueta | badge | — | content | desktop | — | Etiqueta existente, con borrado |
| 11 | campo-clave-etiqueta | text-input | default | input | desktop | — | Clave de la etiqueta nueva |
| 12 | campo-valor-etiqueta | text-input | default | input | desktop | — | Valor de la etiqueta nueva |
| 13 | boton-agregar-etiqueta | button | secondary · disabled | input | desktop | state_overrides: clave o valor vacíos→disabled | Agrega la etiqueta al array |
| 14 | panel-informacion | card | — | layout | desktop | — | Agrupa los campos de clasificación |
| 15 | titulo-panel-informacion | heading | h2 | content | desktop | — | Encabeza el panel derecho |
| 16 | campo-proyecto | dropdown | closed / open | input | desktop | — | Proyecto al que pertenece |
| 17 | campo-estado | dropdown | closed / open | input | desktop | — | Estado del requisito |
| 18 | campo-tipo | dropdown | closed / open | input | desktop | — | Tipo del requisito |
| 19 | campo-prioridad | dropdown | closed / open | input | desktop | — | Prioridad del requisito |
| 20 | campo-visibilidad | dropdown | closed / open | input | desktop | — | Público o interno |
| 21 | campo-responsables | dropdown | multi · closed / open | input | desktop | — | Personas responsables |
| 22 | campo-fecha-creacion | text-input | disabled · readonly | content | desktop | — | Muestra la fecha real de creación, no editable |
| 23 | campo-fecha-estimada | date-picker | default | input | desktop | — | Fecha estimada de finalización |

**Origen:** `src/app/(loggedin)/requirements/[reqid]/edit/page.tsx`, `src/features/requirements/components/EditRequirementForm/EditRequirementForm.tsx:341-607`, `src/features/requirements/components/EditRequirementForm/EditRequirementForm.module.scss`, `src/features/requirements/hooks/useUpdateRequirement.ts`.

Notas de transcripción [fuente: código-existente]:
- **No hay `sugerencias-etiqueta`** en esta pantalla: el bloque de `useRequirementTagSuggestions` existe solo en el alta.
- No usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos, igual que el alta.
- `panel-informacion` es un `<aside>` (`:477`) que contiene el campo obligatorio `campo-proyecto`.

## Layout por viewport

### desktop · 1440px

- encabezado-pagina
  - row `acciones-encabezado` (`space-between`)
    - titulo-pagina
    - boton-volver
    - boton-guardar
- row `paneles`
  - col ~7/12: panel-detalle
    - titulo-panel-detalle
    - campo-titulo
    - campo-contexto
    - seccion-etiquetas
      - chip-etiqueta
      - row `nueva-etiqueta`
        - campo-clave-etiqueta
        - campo-valor-etiqueta
        - boton-agregar-etiqueta
  - col ~5/12: panel-informacion
    - titulo-panel-informacion
    - campo-proyecto
    - campo-estado
    - campo-tipo
    - campo-prioridad
    - campo-visibilidad
    - campo-responsables
    - campo-fecha-creacion
    - campo-fecha-estimada

**Origen:** `EditRequirementForm.module.scss:89-90` — `grid-template-columns: minmax(0, 1fr) 420px` [fuente: código-existente].

**Las fracciones son aproximadas y no derivables exactamente del código:** la columna derecha es de **420px fijos**, no una fracción de 12. A 1440px de viewport equivale a ~7.5/12 + ~4.5/12.

El módulo declara un corte propio en 1024px (`@media (max-width: 1024px) { grid-template-columns: 1fr; }`, `:94-96`) y un segundo en 640px con ajustes de las etiquetas (`:416`), fuera de los viewports de la superficie.

## Contenido

### encabezado-pagina
- Texto/label: contiene titulo-pagina, boton-volver y boton-guardar
- Icono: nada
- Asset: nada
- Annotation: `<header className={styles.pageHeader}>` propio (`:341`)

### titulo-pagina
- Texto/label: `"Editar Requisito"` (`:343`)
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-volver
- Texto/label: `"Volver"` (`:347`)
- Icono: nada
- Asset: nada
- Annotation: `<Link href="/requirements/{id}">`; descarta lo editado sin confirmar. **Con REQ-001 lo que se descarta es la vinculación, no el archivo**: los archivos ya subidos siguen existiendo sin vínculo, que es un estado válido (RF-1)

### boton-guardar
- Texto/label: `"Guardar"`; en loading `"Guardando..."` (`:356`)
- Icono: nada
- Asset: nada
- Annotation: `<button type="submit">` con `disabled` y `aria-busy` durante el guardado (`:349-357`)

### panel-detalle
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.panelCard}>` (`:~362`)

### titulo-panel-detalle
- Texto/label: `"Detalle"` (`:~363`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-titulo
- Texto/label: label visible `"Título"`, `aria-label="Título"` (`:~372`, `:375`)
- Icono: nada
- Asset: nada
- Annotation: sin placeholder. Valor inicial desde `requirement.title`

### campo-contexto
- Texto/label: label visible `"Contexto"` con `id="edit-description-label"`, `ariaLabel="Contexto"` (`:390`). Placeholder: `"Describe el requisito..."` (`:391`)
- Icono: nada
- Asset: nada
- Annotation: mismo editor markdown con adjuntos que el alta, y **mismo cambio de mecanismo con REQ-001**: el adjunto deja de ser un borrador anclado al usuario y pasa a ser un archivo que existe solo, vinculado al guardar (RF-1, RF-3). Tuteo peninsular (`"Describe"`), a diferencia del voseo del resto del producto

### seccion-etiquetas
- Texto/label: contenedor de los controles de etiqueta
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.tagsSection}>` (`:~400`)

### chip-etiqueta
- Texto/label: `` `${tag.key}:${tag.value}` `` (`:~424-433`)
- Icono: nada
- Asset: nada
- Annotation: botón de borrar con `aria-label={`Eliminar tag ${k}:${v}`}` (`:429`)

### campo-clave-etiqueta
- Texto/label: label `"Clave"`, `aria-label="Clave"` (`:446`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-valor-etiqueta
- Texto/label: label `"Valor"`, `aria-label="Valor"` (`:459`)
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-agregar-etiqueta
- Texto/label: `"Agregar"` (`:~468`)
- Icono: nada
- Asset: nada
- Annotation: deshabilitado hasta que clave y valor tengan contenido

### panel-informacion
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<aside className={styles.panelRight}>` (`:477`)

### titulo-panel-informacion
- Texto/label: `"Información general"` (`:~478`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-proyecto
- Texto/label: label `"Proyecto"`, `aria-label="Proyecto"`
- Icono: nada
- Asset: nada
- Annotation: `<Select inputId="edit-project">` (`:~485-493`)

### campo-estado
- Texto/label: label `"Estado"`, `aria-label="Estado"`. Opciones: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`
- Icono: nada
- Asset: nada
- Annotation: permite cualquier transición entre los 7 estados sin restricción, salteando el workflow que `detalle-requisito` modela con el stepper (`:500-506`)

### campo-tipo
- Texto/label: label `"Tipo"`, `aria-label="Tipo"`. Opciones: `"Sin tipo"` · `"Funcionalidad"` · `"Mejora"` · `"Incidencia"` · `"Otro"`
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-prioridad
- Texto/label: label `"Prioridad"`, `aria-label="Prioridad"`. Opciones: `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"`
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-visibilidad
- Texto/label: label `"Visibilidad"`, `aria-label="Visibilidad"`. Opciones: `"Público"` (`public`) · `"Interno"` (`internal`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-responsables
- Texto/label: label `"Responsable(s)"`, `aria-label="Responsable(s)"`; placeholder `"Seleccionar responsable(s)..."`
- Icono: nada
- Asset: nada
- Annotation: `<Select isMulti isClearable={false}>` (`:563-580`)

### campo-fecha-creacion
- Texto/label: label `"Fecha de creación"`, `aria-label="Fecha de creación"`; valor `formatDate(requirement.createdAt)`
- Icono: nada
- Asset: nada
- Annotation: `<input type="text" disabled readOnly>` (`:579-586`). En el alta el equivalente es `type="date"` con la fecha de hoy

### campo-fecha-estimada
- Texto/label: label visible `"Fecha de finalización estimada"`; **`aria-label="Fecha estimada"`** (`:601`, `:606`)
- Icono: nada
- Asset: nada
- Annotation: el `aria-label` no coincide con el label visible. El `aria-label` gana, así que un lector de pantalla anuncia un nombre distinto del que se ve

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). El requisito llega del Server Component como prop `requirement` (`requirements/[reqid]/edit/page.tsx:16-18`) y el estado local del formulario se inicializa desde esa prop (`EditRequirementForm.tsx:~230`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: `"Guardando..."` (en el botón, `:356`)
- Cambios:
  - boton-guardar: content=`"Guardando..."`, variant=disabled, `aria-busy` (state_override)
  - Los campos siguen editables
- Nota: **no hay loading inicial.** No existe `requirements/[reqid]/edit/loading.tsx`, así que la navegación desde el detalle no tiene feedback mientras el Server Component espera el dato

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). Mismo patrón que el alta: el schema define los tres mensajes y el estado de errores se declara con el getter descartado, así que ningún campo se marca. Con tres campos obligatorios no hay indicación de cuál falta [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast con el mensaje compuesto de la api o el fallback del componente (`:311-317`)
- Cambios:
  - Solo el toast; el formulario queda con los datos cargados
  - `useProjects` y `usePersons` sin manejo de `isError`: los selects quedan vacíos sin explicación (`:~222-224`)

### success
- Aplica: Sí
- Mensaje: toast `"Requisito actualizado correctamente"` (`:307`)
- Cambios: navega al detalle del requisito (`:308`)

### not found
- Aplica: Sí (parcialmente)
- Mensaje: la pantalla de not found por defecto de Next; no hay mensaje propio
- Cambios:
  - `if (isNaN(id)) notFound()` cubre el id no numérico (`requirements/[reqid]/edit/page.tsx:14`)
  - **Un id numérico inexistente no está cubierto:** `getRequirementById` corre sin try/catch y no hay `requirements/error.tsx`, así que cae en la pantalla de error por defecto de Next, sin sidebar (`requirements/[reqid]/edit/page.tsx:16`) [fuente: código-existente]

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md). Un requisito `resuelto` o `cancelado` se edita igual y el select de estado permite cualquier transición (`:500-506`)

## Interacciones

**Eventos:** [fuente: código-existente]
- Cada campo · on change → `setForm` sobre el estado local del formulario
- boton-agregar-etiqueta · click → `handleAddTag` con el `disabled` preventivo
- chip-etiqueta · click en la cruz → quita del array por índice
- boton-volver · click → navega a `/requirements/{id}` (`:346-348`)
- boton-guardar · click → submit del `<form onSubmit={handleSubmit}>` con `noValidate` (`:340`)

**Validaciones:**
- campo-titulo · `required` + `.test('not-blank')` → mensaje `"El título es requerido"` — **definido en el schema pero nunca mostrado**
- campo-contexto · `required` + `.test('not-blank')` → mensaje `"La descripción es requerida"` — **definido pero nunca mostrado**
- campo-proyecto · `typeError` + `required` → mensaje `"El proyecto es requerido"` — **definido pero nunca mostrado**
- boton-agregar-etiqueta · clave o valor vacíos → el botón queda `disabled`, sin mensaje
- Etiqueta duplicada: no se controla, igual que en el alta

**Feedback:**
- Guardado en curso: `"Guardando..."` + `disabled` + `aria-busy` en el botón
- Resultado: toast, ya sobre el detalle en el caso de éxito

## Accesibilidad

- **Orden de foco:** boton-volver → boton-guardar → campo-titulo → campo-contexto → botones de borrado de chip-etiqueta → campo-clave-etiqueta → campo-valor-etiqueta → boton-agregar-etiqueta → campo-proyecto → campo-estado → campo-tipo → campo-prioridad → campo-visibilidad → campo-responsables → campo-fecha-estimada. `campo-fecha-creacion` **queda fuera del orden de tabulación y del árbol de accesibilidad** por tener `disabled` además de `readOnly` (`:584-585`): la fecha de creación se ve pero no se lee [fuente: código-existente].
- **Landmarks y jerarquía:** `<header>` propio de la pantalla (`:341`), `<aside>` para el panel derecho (`:477`), más el `<main>` del shell. Un solo `<h1>` (titulo-pagina, `:343`) y dos `<h2>`, uno por panel (`:~363`, `:~478`). **El `<aside>` contiene `campo-proyecto`, que es obligatorio.**
- **Foco y teclado:** los menús de `react-select` de los seis selects son los overlays de esta composición; su comportamiento de foco lo aporta la librería. No hay atajos propios.
- **Propio de esta composición:** el formulario declara `noValidate` (`:340`) pero los mensajes de validación no se muestran: sin `aria-invalid`, sin `aria-describedby`, sin región live. Ninguno de los campos declara `required` nativo (`:~370-378`, `:~485-493`). **`campo-fecha-estimada` tiene un `aria-label` que contradice su label visible** (`"Fecha estimada"` vs `"Fecha de finalización estimada"`, `:601`, `:606`): el `aria-label` gana y anuncia un nombre distinto del visible [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-001 — Rediseño de archivos y adjuntos (2026-08-19)

- **Los adjuntos embebidos del editor dejan de subirse como borrador.** El archivo pasa a existir por sí solo y el vínculo con el requisito se crea al guardar, en la misma operación (RF-1, RF-3, RF-4). **Para el usuario el gesto no cambia** —sigue pudiendo adjuntar antes de que el requisito exista, que es lo que RF-1 preserva a propósito— así que no se modificó la estructura ni el layout de la pantalla: se corrigió la anotación de mecanismo, que describía un patrón eliminado.
- **El límite de tamaño y las extensiones dejan de decidirse en el cliente.** Son configurables en caliente y los valida `core` (RF-6, RF-15). El mensaje de rechazo llega del servidor.
- **Se agrega un modo de fallo que antes no existía:** intentar adjuntar un archivo subido por otra persona falla con *"No podés adjuntar un archivo que subió otra persona"* (RF-12, CA-10). En esta pantalla es improbable —el usuario adjunta lo que acaba de subir— pero es alcanzable si se recupera un formulario de otra sesión.
- **Descartar la edición deja de descartar los archivos.** La anotación de `boton-volver` decía que se pierden "los adjuntos ya subidos": con el modelo nuevo los archivos siguen existiendo sin vínculo (RF-1). Lo que se pierde es la vinculación, no el archivo. No cambia lo que el usuario ve, pero sí lo que la documentación afirma.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El selector de tema vive en el shell, no en esta pantalla.** La superficie gana modo oscuro con un control para elegirlo, ubicado en el pie de la sidebar junto a Cerrar sesión. Como es parte del shell de `(loggedin)`, está presente acá pero **no se declara como bloque de esta ficha**: declararlo en las 21 pantallas autenticadas repetiría veintiuna veces el mismo control. En modo oscuro esta pantalla usa la paleta propia del DS —canvas `#0E121A`, superficies `#1B202C` separadas por contraste y sin borde—, no una inversión de la clara [REQ-013 RF-7, CA-11].
- **[REQ-013] El corte de 1024px se unifica con el 1023px del detalle.** El formulario colapsa a una columna en `max-width: 1024px` y `detalle-requisito` lo hace en `1023px`: un píxel de diferencia entre pantallas hermanas del mismo dominio, que el CHANGELOG del DS marca como error puntual y no como avance parcial del mobile pendiente. Se unifican en un único valor. **El segundo corte en 640px no se toca**, como no se toca el resto de la deuda de breakpoints: sigue en FG-5 junto con la decisión de fondo sobre mobile [REQ-013 RF-9, CA-15].
