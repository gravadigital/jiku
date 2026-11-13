---
name: proyectos-redireccion
surface: opus-web
route: /projects
viewports:
  - mobile
  - desktop
audiences:
  - cliente
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Proyectos (redirección)

> **Esta pantalla no muestra proyectos.** Es una pantalla de tránsito: si el usuario tiene al menos un proyecto, redirige al primero por orden alfabético. Lo único que se llega a ver son sus estados de excepción [fuente: código-existente].
>
> **Desde REQ-007 uno de esos estados dejó de ser una excepción.** Al desaparecer el 401 `user_not_found` de todas las rutas de la api, un cliente autenticado sin permisos de proyecto ya no queda afuera con un error: entra y recibe `200 []` (REQ-007 CA-12, CA-13). El estado `empty` de esta pantalla pasa a ser **la primera pantalla de todo cliente nuevo**, y se diseña como tal.

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** Resolver a qué proyecto entrar. Con proyectos, redirige al primero alfabéticamente; sin proyectos, es la pantalla donde el cliente entiende que su acceso todavía no está y sabe qué hacer con eso [REQ-007 CA-13].
- **Viewports:**
  - **mobile** — misma composición vertical; lo único que cambia es el padding del contenedor. En mobile **no hay chrome**: el sidebar del shell es `display: none` bajo 768px, así que el estado `empty` dejaba al usuario sin ninguna salida. **Desde REQ-007 la salida está dentro de la pantalla** (`boton-cerrar-sesion`), justamente porque ese estado pasó a ser el primero que ve un cliente nuevo y en mobile no hay dónde más ponerla.
  - **desktop** — el stack centrado ocupa el `<main>`, con el sidebar de navegación a la izquierda.
  - Tratamiento observado: dos `@include mobile` (max-width 767px) que solo ajustan padding. El contenido no cambia entre viewports.
  - Tablet: se comporta como desktop.

Envuelta por el chrome de `(dashboard)`: con sidebar en desktop, sin nada en mobile.

## Entrada y salida

**Entradas:**
- Desde `/` tras validar sesión · `app/page.tsx:11` (`redirect('/projects')`) [fuente: código-existente]
- Es el destino indirecto de todo el flujo de login: `Zitadel → /login/enter → / → /projects`

**Salidas user-driven:**
- boton-reintentar · click → `refetch()` de `useProjects` (no navega) · `projects/page.tsx:43`
- boton-cerrar-sesion · click → cierra la sesión y vuelve a `/login` · solo en el estado `empty` [REQ-007 CA-13]
- *(no hay ninguna otra salida de navegación disparada por el usuario desde esta pantalla)*

**Salidas automáticas:**
- A `/projects/{primerId}/requirements?view=list` · sin interacción, en cuanto la lista llega con al menos un elemento · `projects/page.tsx:20-25`

La redirección hace `push`, no `replace` (`projects/page.tsx:23`): el botón "atrás" del navegador vuelve a `/projects`, que inmediatamente vuelve a redirigir.

## Estructura

La pantalla tiene **cuatro composiciones excluyentes**, una por estado. Ninguna comparte bloques con otra más allá del contenedor. La del estado `empty` es la que más creció con REQ-007: pasó de un párrafo suelto a una composición con encabezado, explicación y salida.

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | contenedor-centrado | section | — | layout | ambos | — | Contenedor de composición centrado en los dos ejes |
| 2 | indicador-carga | loader | lg | feedback | ambos | visible_only_in_states: loading, default (redirigiendo) | Señal de actividad |
| 3 | texto-estado | paragraph | body | content | ambos | state_overrides: contenido por estado | Mensaje del estado vigente |
| 4 | boton-reintentar | button | primary | input | ambos | visible_only_in_states: error de sistema / sin conexión | Reintentar la carga de proyectos |
| 5 | titulo-sin-acceso | heading | h1 | content | ambos | visible_only_in_states: empty | Nombra el estado en el que quedó el cliente, en vez de dejarlo deducir de un párrafo |
| 6 | boton-cerrar-sesion | button | secondary | input | ambos | visible_only_in_states: empty | Única salida de la pantalla en el estado terminal, y la única salida de la superficie en mobile |
| 7 | sidebar-navegacion | sidebar | — | layout | solo desktop | — | Chrome de `(dashboard)`: proyectos, alta y cerrar sesión. Bajo 768px no se renderiza |

**Origen:** `src/app/(dashboard)/projects/page.tsx:30-70`, `src/app/(dashboard)/projects/page.module.scss`, `src/features/projects/hooks/useProjects.ts`, `src/shared/components/ui/Spinner/Spinner.tsx` [fuente: código-existente].

Notas de tipificación del relevamiento: `contenedor-centrado` se relevó como `section` — es un contenedor de composición sin tipo propio en el diccionario.

**No hay un bloque de listado.** El componente `ProjectList` existe en el código (`features/projects/components/ProjectList/`) y esta pantalla no lo importa.

## Layout por viewport

### mobile · 390px

- contenedor-centrado *(ocupa el `<main>` completo, centrado en los dos ejes)*
  - indicador-carga *(en loading y en redirigiendo)*
  - titulo-sin-acceso *(solo en empty)*
  - texto-estado
  - boton-reintentar *(solo en error)*
  - boton-cerrar-sesion *(solo en empty)*

Misma composición vertical que desktop. Lo único que cambia es el padding del contenedor.

**En mobile esta composición es toda la superficie**: no hay sidebar, así que en el estado `empty` los tres bloques del centro son lo único que existe. Es la razón por la que `boton-cerrar-sesion` vive en la pantalla y no en el chrome [REQ-007].

**Origen:** `projects/page.module.scss:8` y `:26` — dos `@include mobile` sobre el contenedor externo, no sobre la disposición de los bloques [fuente: código-existente].

**Las fracciones de columna no son derivables del código:** el contenedor es un flex column centrado, sin grilla.

### desktop · 1440px

- contenedor-centrado *(ocupa el `<main>` completo, centrado en los dos ejes)*
  - indicador-carga *(en loading y en redirigiendo)*
  - titulo-sin-acceso *(solo en empty)*
  - texto-estado
  - boton-reintentar *(solo en error)*
  - boton-cerrar-sesion *(solo en empty)*

En desktop `boton-cerrar-sesion` **duplica** una acción que el sidebar ya ofrece. Se mantiene igual: el estado `empty` es terminal y la salida tiene que estar donde el usuario está mirando, no en un chrome que en ese momento está vacío de proyectos [REQ-007].

**Origen:** `projects/page.module.scss:15-23` — `.centered { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300px; gap: var(--spacing-md); height:100% }` [fuente: código-existente].

**Las fracciones de columna no son derivables del código:** el contenedor es un flex column centrado, sin grilla. Lo que falta en mobile es el chrome, no esta pantalla.

## Contenido

### contenedor-centrado
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: flex column centrado en los dos ejes, `min-height: 300px`, `gap: var(--spacing-md)`

### indicador-carga
- Texto/label: texto visualmente oculto "Cargando..." dentro del spinner (`Spinner.tsx:11`)
- Icono: spinner, `size="lg"`
- Asset: nada
- Annotation: `role="status"` + `aria-label="Cargando"` (`Spinner.tsx:9`)

### texto-estado
- Texto/label, según el estado vigente (verbatim):
  - loading: "Cargando proyectos..." · `projects/page.tsx:32`
  - error: "Error al cargar los proyectos" · `projects/page.tsx:42`
  - empty: "Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora, escribile a tu contacto en Grava Digital." — **cambia con REQ-007** (antes: "No tienes proyectos asignados", `projects/page.tsx:55`)
  - redirigiendo: "Redirigiendo..." · `projects/page.tsx:67`
- Icono: nada
- Asset: nada
- Annotation: todos hardcodeados. El mensaje de empty **usaba "tú" ("tienes") mientras el resto de la aplicación vosea**; REQ-007 lo reescribe entero, así que la corrección de voseo entra con el cambio de contenido y no como arreglo suelto. El texto de error se pinta en `--color-error`. El comentario del código explica el de redirección: *"Si hay proyectos, el useEffect ya está redirigiendo / Mostramos spinner mientras redirige"* (`projects/page.tsx:61-62`)

### boton-reintentar
- Texto/label: "Reintentar"
- Icono: nada
- Asset: nada
- Annotation: llama a `refetch()` de `useProjects` (`projects/page.tsx:43`)

### titulo-sin-acceso
- Texto/label: "Todavía no tenés acceso a ningún proyecto"
- Icono: nada
- Asset: nada
- Annotation: `<h1>`, visible solo en el estado `empty`. Es el primer `<h1>` que tiene esta pantalla en cualquiera de sus estados: hasta REQ-007 la composición era un párrafo suelto, lo que en el estado terminal dejaba al cliente sin encabezado de página. El tamaño y el peso salen de [`typography.md`](../../../design-system/opus-web/foundations/typography.md) (`font.size.3xl`, `semibold`, `line-height` tight) [REQ-007 CA-13]

### boton-cerrar-sesion
- Texto/label: "Cerrar sesión"
- Icono: nada
- Asset: nada
- Annotation: `variant="secondary"` del [`Button`](../../../design-system/opus-web/components/button.md) de la superficie. Visible solo en el estado `empty`. **Es la única salida disponible en mobile**, donde el sidebar no se renderiza: sin este bloque, el primer estado de todo cliente nuevo sería un callejón sin salida [REQ-007 CA-13]

### sidebar-navegacion
- Texto/label: "Opus" + la lista de proyectos + "Nuevo requisito" + "Cerrar sesión"
- Icono: folder por proyecto · plus en el alta · lock en cerrar sesión
- Asset: nada
- Annotation: chrome del grupo `(dashboard)`, no de esta pantalla. `display:none` bajo 768px (`Sidebar.module.scss:13`) **sin reemplazo**: en mobile no hay ninguna navegación

## Estados

Los cuatro estados implementados son excluyentes y se evalúan en el orden loading → error → empty → redirigiendo.

### default
- Aplica: Sí — el default de esta pantalla es "redirigiendo"
- Mensaje: "Redirigiendo..."
- Cambios:
  - indicador-carga: visible
  - texto-estado: content="Redirigiendo..." (state_override)
  - boton-reintentar: oculto en este estado (hidden_in_states)
- Annotation: disparado por haber al menos un proyecto, con el `useEffect` ya habiendo disparado el `router.push` · `projects/page.tsx:63-70`. **No existe un estado "default con contenido": el camino feliz de esta pantalla es no verla.** No hay indicación de a qué proyecto se está entrando [fuente: código-existente]

### empty
- Aplica: Sí
- Mensaje: "Todavía no tenés acceso a ningún proyecto" (título) + "Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora, escribile a tu contacto en Grava Digital." (cuerpo)
- Cambios:
  - titulo-sin-acceso: solo visible en este estado (visible_only_in_states)
  - texto-estado: content="Cuando el equipo te dé acceso a un proyecto, lo vas a ver acá. Si esperabas verlo ahora, escribile a tu contacto en Grava Digital." (state_override)
  - boton-cerrar-sesion: solo visible en este estado (visible_only_in_states)
  - indicador-carga: oculto en este estado (hidden_in_states)
  - boton-reintentar: oculto en este estado (hidden_in_states)
- Annotation: disparado por `!projects || projects.length === 0` · `projects/page.tsx:51-59`.
- **Qué cambió con REQ-007.** Este estado se alcanzaba solo por accidente: quien no tenía fila en `users` chocaba antes contra el 401 `user_not_found` y ni siquiera llegaba. Al eliminarse ese 401 de las 61 rutas, un `external-user` autenticado sin fila y sin permisos recibe `200 []` y **aterriza acá** — es ahora el primer estado de todo cliente nuevo, no un borde (REQ-007 CA-12, CA-13). Por eso deja de ser un párrafo suelto: gana encabezado, un cuerpo que nombra la causa y dice qué esperar, y una salida.
- **Sigue siendo terminal, y ahora se admite como tal.** El cliente no puede desbloquearse solo: el permiso lo concede el equipo desde afuera del portal —`user_project_permissions` no tiene interfaz de administración, sigue siendo FG-1—. El texto no promete una acción que el producto no tiene: apunta a la vía que sí funciona (pedirlo por fuera) y ofrece lo único accionable desde acá, cerrar sesión.
- **Deja de ser ambiguo en una de las tres direcciones.** Antes no distinguía "no te asignaron ninguno", "perdiste el permiso" y "tu alta falló". La tercera **ya no existe**: con REQ-007 el alta no puede fallar porque no hay alta que hacer — `core` espeja la identidad desde el comando (CA-9, CA-11). Las otras dos siguen sin distinguirse, y es deliberado: el portal no le confirma a un externo qué existe del otro lado (coherente con REQ-006 §22)

### loading
- Aplica: Sí
- Mensaje: "Cargando proyectos..."
- Cambios:
  - indicador-carga: visible
  - texto-estado: content="Cargando proyectos..." (state_override)
  - boton-reintentar: oculto en este estado (hidden_in_states)
- Annotation: disparado por `isLoading` de `useProjects()` · `projects/page.tsx:27-36`

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: "Error al cargar los proyectos"
- Cambios:
  - texto-estado: content="Error al cargar los proyectos", color `--color-error` (state_override)
  - boton-reintentar: solo visible en este estado (visible_only_in_states)
  - indicador-carga: oculto en este estado (hidden_in_states)
- Annotation: disparado por `isError` de `useProjects()` · `projects/page.tsx:38-49` [fuente: código-existente]

### success
- Aplica: No — no implementado (ver gaps-as-is.md)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). No hay `not-found.tsx` en ninguna ruta

### estado terminal / readonly
- Aplica: No — **y desde REQ-007 es por una razón distinta**. No se declara como estado propio porque sería un duplicado exacto de `empty`: es el mismo frame, con los mismos bloques. Lo que cambió es que el carácter terminal dejó de ser un accidente y pasó a estar diseñado —encabezado que nombra la situación, texto que dice quién la resuelve, y una acción disponible en vez de ninguna—, y eso vive en `empty` [REQ-007 CA-13]. Ver `empty`.

## Interacciones

**Eventos:**
- boton-reintentar · on click → `refetch()` de `useProjects` · `projects/page.tsx:43` [fuente: código-existente]
- boton-cerrar-sesion · on click → cierra la sesión y devuelve a `/login` · solo alcanzable en el estado `empty` [REQ-007]
- *(ninguna otra: el resto de la pantalla es no interactivo)*

**Validaciones:**
- Ninguna: la pantalla no tiene formulario.

**Feedback:**
- La redirección es automática y sin confirmación · `projects/page.tsx:20-25`
- No hay indicación de a qué proyecto se está entrando: el texto dice solo "Redirigiendo..."
- El ordenamiento usa `localeCompare` sin locale explícito (`projects/page.tsx:14-17`): usa el del entorno, y el destino de la redirección depende de ese orden.
- En el estado `empty` no hay ningún feedback diferido: la pantalla es su propio desenlace. **No hay reintento ni polling**: el permiso llega por fuera del portal y el cliente lo verá la próxima vez que entre [REQ-007].

## Accesibilidad

- **Orden de foco:** en el estado de error, boton-reintentar es el único elemento interactivo. En el estado `empty`, boton-cerrar-sesion es el único, y por lo tanto el primer y último foco de la pantalla [REQ-007]. En los otros dos estados no hay ninguno.
- **Landmarks y jerarquía:** el landmark `<main>` lo hereda del shell (`(dashboard)/layout.tsx:14`). **La pantalla sigue sin `<h1>` en los estados `loading`, `error` y `redirigiendo`**; en `empty` lo tiene desde REQ-007 (`titulo-sin-acceso`). Que el estado terminal sea el único con encabezado no es una inconsistencia: es el único que el usuario mira más de un instante.
- **Foco y teclado:** la pantalla no monta overlays; no hay trampas de foco ni atajos propios.
- **Propio de esta composición:**
  - La **redirección automática no se anuncia**: sin `aria-live`, un lector de pantalla no anuncia el cambio de contexto (`projects/page.tsx:20-25`).
  - El **mensaje de error no se anuncia**: el `<p>` de error no tiene `role="alert"` (`projects/page.tsx:42`).
  - El indicador de carga sí se anuncia: `role="status"` + `aria-label="Cargando"` + texto visualmente oculto (`Spinner.tsx:9-11`).
  - El botón de reintentar tiene texto, no solo ícono (`projects/page.tsx:44`).
  - **El estado `empty` tiene que anunciarse.** Es la pantalla terminal de un cliente nuevo y llega después de un spinner, así que el bloque de texto necesita `aria-live="polite"` o el foco tiene que moverse al `<h1>`: sin eso, un lector de pantalla anuncia el fin de la carga y nada más [REQ-007].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-007 — `jiku-commands` para personas (2026-08-25)

- **Se diseña el estado `empty` porque cambió de frecuencia, no porque cambió de forma.** El código que lo produce es el mismo de antes. Lo que cambió está del otro lado: al eliminarse el 401 `user_not_found` de las 61 rutas de la api (CA-12), un `external-user` autenticado sin fila y sin permisos deja de rebotar y recibe `200 []` (CA-13). Un estado que se alcanzaba por accidente pasó a ser **la primera pantalla de todo cliente nuevo**, y un listado vacío sin estado vacío se lee como una pantalla rota.
- **Se agregó `boton-cerrar-sesion` en los dos viewports, y en mobile es la razón de todo el cambio.** El sidebar es `display: none` bajo 768px sin reemplazo, así que hasta acá el estado `empty` era literalmente un callejón: ni cambiar de proyecto ni cerrar sesión. Mientras el estado era inalcanzable eso era un gap teórico; ahora es el recorrido garantizado de todo cliente nuevo que entre desde un teléfono. **Se descartó dejarlo para el arreglo del `MobileMenu`** (la pregunta abierta 1 de la superficie): esa es una decisión de producto que no se toma acá, y hasta que se tome esta pantalla no puede ser una trampa.
- **Se descartó ofrecer un botón de "pedir acceso".** Sería el arreglo obvio y no tiene a dónde ir: el permiso vive en `user_project_permissions`, que no tiene interfaz de administración en ninguna de las dos superficies —es FG-1, todavía pendiente— y no hay canal de notificación en el producto (FG-2). Un botón que no dispara nada es peor que un texto que dice a quién escribirle.
- **Se descartó distinguir "no te asignaron ninguno" de "perdiste el permiso".** REQ-006 §22 ya decidió que el recorte del modo externo devuelve cero resultados en vez de error, precisamente para no confirmarle a un externo qué existe del otro lado. Un mensaje que distinga esos dos casos filtra esa información.
- **Sí desapareció una de las tres ambigüedades, y sin escribir microcopy para ella.** El caso "tu alta falló" dejó de existir: con REQ-007 no hay alta que fallar, porque `core` espeja la identidad desde el propio comando (CA-9, CA-11). Se registra acá porque el `.md` anterior lo listaba como una de las tres lecturas posibles del mensaje.
- **Se corrigió el voseo de paso, no como arreglo suelto.** El mensaje anterior era el único "tú" de una aplicación que vosea. Se reescribió entero por otro motivo; corregirlo en ese mismo movimiento no agrega alcance, y dejarlo habría fijado el error en el texto nuevo.
- **Design System — `heading` sin componente, resuelto sin crear uno.** `titulo-sin-acceso` es el primer bloque `heading` de esta pantalla y el catálogo de `opus-web` (v0.1.0: `Button`, `Dropdown`, `Spinner`) no tiene un componente de encabezado. **No se crea:** la escala de `h1` ya está especificada en `foundations/typography.md` (`font.size.3xl`, `semibold`, `line-height` tight), que es donde corresponde que viva. Queda anotado como gap conocido, no como pendiente bloqueante. `boton-cerrar-sesion` sí tiene componente: `Button`, variant `secondary`.
