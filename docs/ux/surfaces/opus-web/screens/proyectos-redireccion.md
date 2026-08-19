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

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** Resolver a qué proyecto entrar. Con proyectos, redirige al primero alfabéticamente; sin proyectos, es la pantalla terminal del usuario.
- **Viewports:**
  - **mobile** — misma composición vertical; lo único que cambia es el padding del contenedor. En mobile **no hay chrome**: el sidebar del shell es `display: none` bajo 768px, así que el estado empty deja al usuario sin ninguna salida.
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
- *(no hay ninguna salida de navegación disparada por el usuario desde esta pantalla)*

**Salidas automáticas:**
- A `/projects/{primerId}/requirements?view=list` · sin interacción, en cuanto la lista llega con al menos un elemento · `projects/page.tsx:20-25`

La redirección hace `push`, no `replace` (`projects/page.tsx:23`): el botón "atrás" del navegador vuelve a `/projects`, que inmediatamente vuelve a redirigir.

## Estructura

La pantalla tiene **cuatro composiciones excluyentes**, una por estado. Ninguna comparte bloques con otra más allá del contenedor.

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | contenedor-centrado | section | — | layout | ambos | — | Contenedor de composición centrado en los dos ejes |
| 2 | indicador-carga | loader | lg | feedback | ambos | visible_only_in_states: loading, default (redirigiendo) | Señal de actividad |
| 3 | texto-estado | paragraph | body | content | ambos | state_overrides: contenido por estado | Mensaje del estado vigente |
| 4 | boton-reintentar | button | primary | input | ambos | visible_only_in_states: error de sistema / sin conexión | Reintentar la carga de proyectos |
| 5 | sidebar-navegacion | sidebar | — | layout | solo desktop | — | Chrome de `(dashboard)`: proyectos, alta y cerrar sesión. Bajo 768px no se renderiza |

**Origen:** `src/app/(dashboard)/projects/page.tsx:30-70`, `src/app/(dashboard)/projects/page.module.scss`, `src/features/projects/hooks/useProjects.ts`, `src/shared/components/ui/Spinner/Spinner.tsx` [fuente: código-existente].

Notas de tipificación del relevamiento: `contenedor-centrado` se relevó como `section` — es un contenedor de composición sin tipo propio en el diccionario.

**No hay un bloque de listado.** El componente `ProjectList` existe en el código (`features/projects/components/ProjectList/`) y esta pantalla no lo importa.

## Layout por viewport

### mobile · 390px

- contenedor-centrado *(ocupa el `<main>` completo, centrado en los dos ejes)*
  - indicador-carga *(en loading y en redirigiendo)*
  - texto-estado
  - boton-reintentar *(solo en error)*

Misma composición vertical que desktop. Lo único que cambia es el padding del contenedor.

**Origen:** `projects/page.module.scss:8` y `:26` — dos `@include mobile` sobre el contenedor externo, no sobre la disposición de los bloques [fuente: código-existente].

**Las fracciones de columna no son derivables del código:** el contenedor es un flex column centrado, sin grilla.

### desktop · 1440px

- contenedor-centrado *(ocupa el `<main>` completo, centrado en los dos ejes)*
  - indicador-carga *(en loading y en redirigiendo)*
  - texto-estado
  - boton-reintentar *(solo en error)*

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
  - empty: "No tienes proyectos asignados" · `projects/page.tsx:55`
  - redirigiendo: "Redirigiendo..." · `projects/page.tsx:67`
- Icono: nada
- Asset: nada
- Annotation: todos hardcodeados. El mensaje de empty **usa "tú" ("tienes"), mientras el resto de la aplicación vosea** — queda registrado como hallazgo de microcopy, no se corrige acá. El texto de error se pinta en `--color-error`. El comentario del código explica el de redirección: *"Si hay proyectos, el useEffect ya está redirigiendo / Mostramos spinner mientras redirige"* (`projects/page.tsx:61-62`)

### boton-reintentar
- Texto/label: "Reintentar"
- Icono: nada
- Asset: nada
- Annotation: llama a `refetch()` de `useProjects` (`projects/page.tsx:43`)

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
- Mensaje: "No tienes proyectos asignados"
- Cambios:
  - texto-estado: content="No tienes proyectos asignados" (state_override)
  - indicador-carga: oculto en este estado (hidden_in_states)
  - boton-reintentar: oculto en este estado (hidden_in_states)
- Annotation: disparado por `!projects || projects.length === 0` · `projects/page.tsx:51-59`. **Es un estado terminal de hecho:** no hay botón, ni link, ni forma de salir salvo el logout del sidebar — que en mobile no existe. No distingue "no tenés proyectos" de "no tenés permisos" ni de "el alta en la api falló" (`authApi.ts:24-31`)

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
- Aplica: No — no implementado (ver gaps-as-is.md). El empty es terminal de hecho (el usuario no tiene ninguna acción disponible desde ahí) pero no está tratado como tal en el código (`projects/page.tsx:51-59`)

## Interacciones

**Eventos:**
- boton-reintentar · on click → `refetch()` de `useProjects` · `projects/page.tsx:43` [fuente: código-existente]
- *(ninguna otra: el resto de la pantalla es no interactivo)*

**Validaciones:**
- Ninguna: la pantalla no tiene formulario.

**Feedback:**
- La redirección es automática y sin confirmación · `projects/page.tsx:20-25`
- No hay indicación de a qué proyecto se está entrando: el texto dice solo "Redirigiendo..."
- El ordenamiento usa `localeCompare` sin locale explícito (`projects/page.tsx:14-17`): usa el del entorno, y el destino de la redirección depende de ese orden.

## Accesibilidad

- **Orden de foco:** boton-reintentar es el único elemento interactivo de la composición, y solo existe en el estado de error [fuente: código-existente].
- **Landmarks y jerarquía:** el landmark `<main>` lo hereda del shell (`(dashboard)/layout.tsx:14`). **La pantalla no tiene `<h1>` en ningún estado** (`projects/page.tsx`).
- **Foco y teclado:** la pantalla no monta overlays; no hay trampas de foco ni atajos propios.
- **Propio de esta composición:**
  - La **redirección automática no se anuncia**: sin `aria-live`, un lector de pantalla no anuncia el cambio de contexto (`projects/page.tsx:20-25`).
  - El **mensaje de error no se anuncia**: el `<p>` de error no tiene `role="alert"` (`projects/page.tsx:42`).
  - El indicador de carga sí se anuncia: `role="status"` + `aria-label="Cargando"` + texto visualmente oculto (`Spinner.tsx:9-11`).
  - El botón de reintentar tiene texto, no solo ícono (`projects/page.tsx:44`).

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
