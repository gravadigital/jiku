---
name: alta-requisito
surface: web
route: /requirements/new
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Alta de requisito

## Identidad

- **Audiencia primaria:** equipo-interno.
- **JTBD / Propósito:** dar de alta un requisito en dos paneles: detalle (título, contexto markdown, etiquetas) e información general (proyecto, estado, tipo, prioridad, visibilidad, responsables, fechas) [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport de la superficie. El formulario a dos paneles necesita ancho: la columna derecha es de 420px fijos y la izquierda toma el resto (`CreateRequirementForm.module.scss:89-90`) [fuente: código-existente].
  - Mobile queda fuera de la superficie `web`: el shell tiene una sidebar de 290px fija sin ninguna media query, así que por debajo de ese ancho no hay navegación disponible (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente]. El formulario sí declara cortes propios en 1024px y 640px, pero no los acompaña ningún tratamiento del chrome.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde listado-requisitos · botón `"Nuevo requisito"` del encabezado (`requirements/page.tsx:35`)
- Desde detalle-proyecto · botón `+` de la sección de requisitos, con `?projectId={id}` (`ProjectRequirementsSection.tsx:92`)

**Salidas user-driven:**
- A `/requirements` · click en el link `"Volver"` (`CreateRequirementForm.tsx:382-384`)

**Salidas automáticas:**
- A `/requirements` · tras crear con éxito (`CreateRequirementForm.tsx:345`)

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | encabezado-pagina | header | — | layout | desktop | — | Título y acciones del alta |
| 2 | titulo-pagina | heading | h1 | content | desktop | — | Identifica la pantalla |
| 3 | boton-volver | link | — | navigation | desktop | — | Salida al listado |
| 4 | boton-crear | button | primary · default / loading | input | desktop | state_overrides: loading→disabled + aria-busy | Submit del formulario |
| 5 | panel-detalle | card | — | layout | desktop | — | Agrupa título, contexto y etiquetas |
| 6 | titulo-panel-detalle | heading | h2 | content | desktop | — | Encabeza el panel izquierdo |
| 7 | campo-titulo | text-input | default | input | desktop | — | Título del requisito |
| 8 | campo-contexto | text-input | default | input | desktop | — | Contexto en markdown con adjuntos |
| 9 | seccion-etiquetas | section | — | layout | desktop | — | Agrupa el bloque de etiquetas |
| 10 | sugerencias-etiqueta | list | — | input | desktop | visible_only_in_states: default (cuando hay sugerencias) | Atajo a etiquetas ya usadas |
| 11 | chip-etiqueta | badge | — | content | desktop | — | Etiqueta agregada, con borrado |
| 12 | campo-clave-etiqueta | text-input | default | input | desktop | — | Clave de la etiqueta nueva |
| 13 | campo-valor-etiqueta | text-input | default | input | desktop | — | Valor de la etiqueta nueva |
| 14 | boton-agregar-etiqueta | button | secondary · disabled | input | desktop | state_overrides: clave o valor vacíos→disabled | Agrega la etiqueta al array |
| 15 | panel-informacion | card | — | layout | desktop | — | Agrupa los campos de clasificación |
| 16 | titulo-panel-informacion | heading | h2 | content | desktop | — | Encabeza el panel derecho |
| 17 | campo-proyecto | dropdown | closed / open | input | desktop | — | Proyecto al que pertenece |
| 18 | campo-estado | dropdown | closed / open | input | desktop | — | Estado inicial del requisito |
| 19 | campo-tipo | dropdown | closed / open | input | desktop | — | Tipo del requisito |
| 20 | campo-prioridad | dropdown | closed / open | input | desktop | — | Prioridad del requisito |
| 21 | campo-visibilidad | dropdown | closed / open | input | desktop | — | Público o interno |
| 22 | campo-responsables | dropdown | multi · closed / open | input | desktop | — | Personas responsables |
| 23 | campo-fecha-creacion | date-picker | disabled · readonly | input | desktop | — | Muestra la fecha de hoy, no editable |
| 24 | campo-fecha-estimada | date-picker | default | input | desktop | — | Fecha estimada de finalización |

**Origen:** `src/app/(loggedin)/requirements/new/page.tsx`, `src/features/requirements/components/CreateRequirementForm/CreateRequirementForm.tsx:377-646`, `src/features/requirements/components/CreateRequirementForm/CreateRequirementForm.module.scss`, `src/features/requirements/components/RequirementRichTextEditor/RequirementRichTextEditor.tsx`, `src/features/requirements/hooks/useCreateRequirement.ts`, `src/features/requirements/hooks/useRequirementTagSuggestions.ts`.

Notas de transcripción [fuente: código-existente]:
- `panel-informacion` es un `<aside>` aunque contiene el campo obligatorio principal (proyecto) (`:513`).
- La pantalla no usa `<PageLayout>`, `<Button>` ni los `Input*` compartidos: monta su propio encabezado, `<input>` nativos y `react-select` (importado como `Select`, que no es el `<Select>` de `shared/components/ui`).

## Layout por viewport

### desktop · 1440px

- encabezado-pagina
  - row `acciones-encabezado` (`space-between`)
    - titulo-pagina
    - boton-volver
    - boton-crear
- row `paneles`
  - col ~7/12: panel-detalle
    - titulo-panel-detalle
    - campo-titulo
    - campo-contexto
    - seccion-etiquetas
      - sugerencias-etiqueta
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

**Origen:** `CreateRequirementForm.module.scss:89-90` — `.panels { display: grid; grid-template-columns: minmax(0, 1fr) 420px; }` [fuente: código-existente].

**Las fracciones son aproximadas y no derivables exactamente del código:** la columna derecha es de **420px fijos**, no una fracción de 12. A 1440px de viewport (contenido ~1118px) equivale a ~7.5/12 + ~4.5/12, y la proporción cambia con el ancho porque la columna derecha no escala.

El módulo declara además dos cortes propios (`@media (max-width: 1024px)` que colapsa a una columna, y un segundo en 640px con ajustes de los bloques de etiquetas, `CreateRequirementForm.module.scss:94-96`, `:322`, `:479`), pero quedan fuera de los viewports de la superficie porque el shell no acompaña esos anchos.

## Contenido

### encabezado-pagina
- Texto/label: contiene titulo-pagina, boton-volver y boton-crear
- Icono: nada
- Asset: nada
- Annotation: `<header className={styles.pageHeader}>` propio, no `PageLayout` (`:377`)

### titulo-pagina
- Texto/label: `"Nuevo Requisito"` (`:379`)
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-volver
- Texto/label: `"Volver"` (`:383`)
- Icono: nada
- Asset: nada
- Annotation: `<Link href="/requirements">`; descarta todo lo escrito sin confirmar

### boton-crear
- Texto/label: `"Crear Requisito"`; en loading `"Creando..."` (`:391`)
- Icono: nada
- Asset: nada
- Annotation: `<button type="submit">` con `disabled` y `aria-busy` durante la creación (`:385-392`)

### panel-detalle
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<div className={styles.panelCard}>` (`:399`)

### titulo-panel-detalle
- Texto/label: `"Detalle"` (`:400`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-titulo
- Texto/label: label visible `"Título"`, `aria-label="Título"` (`:404`, `:411`)
- Icono: nada
- Asset: nada
- Annotation: sin placeholder (`:402-415`)

### campo-contexto
- Texto/label: label visible `"Contexto"` con `id="description-label"`, `ariaLabel="Contexto"` (`:419-423`, `:426`). Placeholder: `"Describe el requisito..."` (`:427`)
- Icono: nada
- Asset: nada
- Annotation: editor markdown con soporte de adjuntos embebidos, que se pueden subir **antes de que el requisito exista**. **Con REQ-001 el mecanismo cambia** (RF-1, RF-3): dejan de subirse como borrador anclado al usuario (`entityType="requirement_draft"`) y pasan a ser archivos que existen por sí solos; el vínculo con el requisito se crea al guardar. El placeholder usa tuteo peninsular (`"Describe"`), a diferencia del voseo del resto del producto

### seccion-etiquetas
- Texto/label: label `"Etiquetas"` (`:436`)
- Icono: nada
- Asset: nada
- Annotation: hay un SVG de etiqueta declarado en el archivo (`:362-372`, con `aria-hidden="true"`) que no se renderiza en ningún lado

### sugerencias-etiqueta
- Texto/label: dinámico — los pares clave:valor sugeridos por `useRequirementTagSuggestions`, como botones clickeables (`:438-453`)
- Icono: nada
- Asset: nada
- Annotation: la fila aparece solo si `tagSuggestions.length > 0`

### chip-etiqueta
- Texto/label: `` `${tag.key}:${tag.value}` `` (`:457-471`)
- Icono: nada
- Asset: nada
- Annotation: botón de borrar con `aria-label={`Eliminar tag ${tag.key}:${tag.value}`}` (`:465`)

### campo-clave-etiqueta
- Texto/label: label `"Clave"`, `aria-label="Clave"` (`:476`, `:482`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-valor-etiqueta
- Texto/label: label `"Valor"`, `aria-label="Valor"` (`:488`, `:495`)
- Icono: nada
- Asset: nada
- Annotation: nada

### boton-agregar-etiqueta
- Texto/label: `"Agregar"` (`:506`)
- Icono: nada
- Asset: nada
- Annotation: deshabilitado hasta que clave y valor tengan contenido tras `trim()` (`disabled={!tagKey.trim() || !tagValue.trim()}`, `:504`). Es el único control del formulario con validación efectiva en la UI

### panel-informacion
- Texto/label: contenedor sin texto propio
- Icono: nada
- Asset: nada
- Annotation: `<aside className={styles.panelRight}>` (`:513`)

### titulo-panel-informacion
- Texto/label: `"Información general"` (`:514`)
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-proyecto
- Texto/label: label `"Proyecto"`; placeholder `"Seleccionar proyecto..."`. Opciones: `"Seleccionar proyecto..."` (`''`) + los proyectos en estado `analisis` o `activo`
- Icono: nada
- Asset: nada
- Annotation: si la URL trae `?projectId=`, se precarga con ese valor una vez que la lista de proyectos llegó (`:220`, `:277-278`)

### campo-estado
- Texto/label: label `"Estado"`. Opciones: `"Análisis"` · `"Planificación"` · `"En cola"` · `"Desarrollo"` · `"Revisión"` · `"Resuelto"` · `"Cancelado"`
- Icono: nada
- Asset: nada
- Annotation: default `analisis` (`:229-231`). Ofrece los 7 estados en el alta, incluidos `"Resuelto"` y `"Cancelado"`: se puede crear un requisito ya cerrado

### campo-tipo
- Texto/label: label `"Tipo"`. Opciones: `"Sin tipo"` (`''`) · `"Funcionalidad"` · `"Mejora"` · `"Incidencia"` · `"Otro"`
- Icono: nada
- Asset: nada
- Annotation: nada

### campo-prioridad
- Texto/label: label `"Prioridad"`. Opciones: `"Sin prioridad"` · `"Baja"` · `"Media"` · `"Alta"` · `"Urgente"`
- Icono: nada
- Asset: nada
- Annotation: default `sin_prioridad` (`:229-231`)

### campo-visibilidad
- Texto/label: label `"Visibilidad"`. Opciones: `"Público"` (`public`) · `"Interno"` (`internal`)
- Icono: nada
- Asset: nada
- Annotation: default `public` (`:229-231`). En el formulario de comentario del detalle el default es `internal` (`RequirementActivityForm.tsx:19`)

### campo-responsables
- Texto/label: label `"Responsable(s)"`; placeholder `"Seleccionar responsable(s)..."`. Opciones: las personas de `usePersons`
- Icono: nada
- Asset: nada
- Annotation: `<Select isMulti isClearable={false}>` (`:599-616`)

### campo-fecha-creacion
- Texto/label: label `"Fecha de creación"`; valor `todayISO`
- Icono: nada
- Asset: nada
- Annotation: `<input type="date" disabled readOnly>` (`:623-631`). Campo de solo lectura en un formulario de alta que muestra la fecha de hoy

### campo-fecha-estimada
- Texto/label: label `"Fecha de finalización estimada"`
- Icono: nada
- Asset: nada
- Annotation: `<input type="date">` editable (`:638-646`)

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). `form` inicial en `:225-234`; sugerencias-etiqueta aparece solo si `tagSuggestions.length > 0` (`:438-453`)

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: `"Creando..."` (en el botón, `:391`)
- Cambios:
  - boton-crear: content=`"Creando..."`, variant=disabled, `aria-busy` (state_override)
  - El resto de los campos sigue editable

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). El schema yup define tres mensajes (`"El título es requerido"`, `"La descripción es requerida"`, `"El proyecto es requerido"`, `:194-203`) pero el estado de errores se declara como `const [, setErrors] = useState<Record<string, string>>({})` (`:236`): el getter está descartado y los errores nunca se leen ni se muestran [fuente: código-existente]

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: toast con `error.message` o `"Error al crear el requisito"` (`:348-353`)
- Cambios:
  - Solo el toast; el formulario queda con los datos cargados
  - No hay manejo de `isError` de `useProjects` ni de `usePersons`: ante un fallo los selects quedan vacíos sin explicación (`:222`, `:~223`)

### success
- Aplica: Sí
- Mensaje: toast `"Requisito creado correctamente"` (`:344`)
- Cambios: navega a `/requirements` (`:345`)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:** [fuente: código-existente]
- campo-titulo · on change → `setForm` (`:412`)
- campo-contexto · on change → `setForm` vía el editor (`:428`)
- campo-proyecto / campo-estado / campo-tipo / campo-prioridad / campo-visibilidad · on change → `setForm({[campo]: opt?.value ?? default})` (`:529`, `:544`, `:558`, `:571`, `:590`)
- campo-responsables · on change → `setForm({responsiblePersonIds: opts.map(o => o.value)})` (`:611-615`)
- campo-fecha-estimada · on change → `setForm({estimatedFinishDate: e.target.value})` (`:645`)
- sugerencias-etiqueta · click en una sugerencia → agrega el chip (`:444-450`)
- boton-agregar-etiqueta · click → `handleAddTag`: retorna si clave o valor están vacíos tras `trim()`, si no agrega `{key, value}` a `tags` y limpia los inputs (`:292-296`)
- chip-etiqueta · click en la cruz → quita del array por índice (`:462-468`, `:299`)
- boton-volver · click → navega a `/requirements` (`:382-384`)
- boton-crear · click → submit del `<form>`: valida, arma el payload y llama a `createRequirement` (`:~330-355`)

**Validaciones:**
- campo-titulo · `required` + `.test('not-blank')` → mensaje `"El título es requerido"` — **definido en el schema pero nunca mostrado** (`:194-203`, `:236`)
- campo-contexto · `required` + `.test('not-blank')` → mensaje `"La descripción es requerida"` — **definido pero nunca mostrado**
- campo-proyecto · `typeError` + `required` → mensaje `"El proyecto es requerido"` — **definido pero nunca mostrado**
- boton-agregar-etiqueta · clave o valor vacíos tras `trim()` → el botón queda `disabled`, sin mensaje (`:504`)
- Etiqueta duplicada: no se controla. `handleAddTag` hace `setTags(prev => [...prev, {key, value}])` sin chequear si el par ya existe (`:292-293`)

**Feedback:**
- Creación en curso: `"Creando..."` + `disabled` + `aria-busy` en el botón
- Resultado: toast, ya sobre el listado en el caso de éxito
- Payload condicional: `responsiblePersonIds` y `tags` se incluyen solo si hay al menos uno (`:335-338`)

## Accesibilidad

- **Orden de foco:** boton-volver → boton-crear → campo-titulo → campo-contexto → sugerencias-etiqueta → botones de borrado de chip-etiqueta → campo-clave-etiqueta → campo-valor-etiqueta → boton-agregar-etiqueta → campo-proyecto → campo-estado → campo-tipo → campo-prioridad → campo-visibilidad → campo-responsables → campo-fecha-estimada. `campo-fecha-creacion` **queda fuera del orden de tabulación**: tiene `disabled` además de `readOnly`, lo que lo saca del árbol de accesibilidad (`:629-630`) [fuente: código-existente].
- **Landmarks y jerarquía:** `<header>` propio de la pantalla (`:377`), `<aside>` para el panel derecho (`:513`), más el `<main>` del shell. Un solo `<h1>` (titulo-pagina, `:379`) y dos `<h2>`, uno por panel (`:400`, `:514`). **El `<aside>` es un landmark complementario que contiene `campo-proyecto`, que es obligatorio**: semánticamente sugiere contenido secundario.
- **Foco y teclado:** los menús de `react-select` de los seis selects son los overlays de esta composición; su comportamiento de foco lo aporta la librería. No hay atajos de teclado propios. El foco no se mueve tras un intento de submit fallido (`:~330`).
- **Propio de esta composición:** el formulario declara `noValidate` (`:376`) porque la validación es propia, **pero los mensajes de error no se muestran en ningún lado**: no hay `aria-invalid`, ni `aria-describedby`, ni `role="alert"`, ni región live (`:236`). Ninguno de los tres campos obligatorios declara `required` nativo (`:408-414`, `:520-528`). El `aria-label` de casi todos los campos duplica el label visible con el mismo texto (`:411`, `:482`, `:495`, `:522`, `:537`, `:552`, `:566`, `:582`, `:605`, `:628`, `:644`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-001 — Rediseño de archivos y adjuntos (2026-08-19)

- **Los adjuntos embebidos del editor dejan de subirse como borrador.** El archivo pasa a existir por sí solo y el vínculo con el requisito se crea al guardar, en la misma operación (RF-1, RF-3, RF-4). **Para el usuario el gesto no cambia** —sigue pudiendo adjuntar antes de que el requisito exista, que es lo que RF-1 preserva a propósito— así que no se modificó la estructura ni el layout de la pantalla: se corrigió la anotación de mecanismo, que describía un patrón eliminado.
- **El límite de tamaño y las extensiones dejan de decidirse en el cliente.** Son configurables en caliente y los valida `core` (RF-6, RF-15). El mensaje de rechazo llega del servidor.
- **Se agrega un modo de fallo que antes no existía:** intentar adjuntar un archivo subido por otra persona falla con *"No podés adjuntar un archivo que subió otra persona"* (RF-12, CA-10). En esta pantalla es improbable —el usuario adjunta lo que acaba de subir— pero es alcanzable si se recupera un formulario de otra sesión.

