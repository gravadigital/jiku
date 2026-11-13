---
document: UX Survey Screen
screen: proyectos-redireccion
route: /projects
service: opus-web
source_files:
  - src/app/(dashboard)/projects/page.tsx
  - src/app/(dashboard)/projects/page.module.scss
  - src/features/projects/hooks/useProjects.ts
  - src/shared/components/ui/Spinner/Spinner.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: proyectos-redireccion

> **Relevamiento as-is** de `/projects`, extraído de
> `src/app/(dashboard)/projects/page.tsx`. Describe lo que el código hace hoy, no lo que debería
> hacer.

**Esta pantalla no muestra proyectos.** Es una pantalla de tránsito: si el usuario tiene al menos
un proyecto, redirige al primero por orden alfabético. Lo único que se llega a ver son sus estados
de excepción.

## Identidad

- **Ruta:** `/projects`
- **Archivo:** `src/app/(dashboard)/projects/page.tsx`
- **Requiere auth:** sí — `middleware.ts:45-47`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** resolver a qué proyecto entrar. Con proyectos, redirige al primero
  alfabéticamente; sin proyectos, es la pantalla terminal del usuario.
- **Viewports con tratamiento:** mobile, desktop — dos `@include mobile` que solo ajustan padding

Envuelta por el [chrome de `(dashboard)`](./_shell.md): con sidebar en desktop, sin nada en
mobile.

## Entrada y salida

**Entradas:**
- Desde `/` tras validar sesión · `app/page.tsx:11` (`redirect('/projects')`)
- Es el destino indirecto de todo el flujo de login: `Zitadel → /login/enter → / → /projects`

**Salidas:**
- A `/projects/{primerId}/requirements?view=list` · automático, sin interacción ·
  `projects/page.tsx:23`

**Redirects automáticos:**
- Al primer proyecto ordenado alfabéticamente, en cuanto la lista llega con al menos un elemento ·
  `projects/page.tsx:20-25`

```tsx
// src/app/(dashboard)/projects/page.tsx:20-25
useEffect(() => {
  if (sortedProjects.length > 0) {
    const firstProject = sortedProjects[0];
    router.push(`/projects/${firstProject.id}/requirements?view=list`);
  }
}, [sortedProjects, router]);
```

## Estructura

La pantalla tiene **cuatro composiciones excluyentes**, una por estado. Ninguna comparte bloques
con otra más allá del contenedor.

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | contenedor-centrado | `section` | — | ambos | `<div className={styles.centered}>` | `projects/page.tsx:30`, `:41`, `:54`, `:65` |
| 2 | indicador-carga | `loader` | lg | ambos | `<Spinner size="lg">` | `projects/page.tsx:31`, `:66` |
| 3 | texto-estado | `paragraph` | body | ambos | `<p>` con clase según el estado | `projects/page.tsx:32`, `:42`, `:55`, `:67` |
| 4 | boton-reintentar | `button` | primary | ambos | `<Button variant="primary">` | `projects/page.tsx:43-45` |

> `contenedor-centrado` se relevó como `section`: es un contenedor de composición sin tipo propio
> en el diccionario.

**No hay un bloque de listado.** El componente `ProjectList` existe en el código
(`features/projects/components/ProjectList/`) y esta pantalla no lo importa.

## Layout observado por viewport

### desktop · 1200px

- (chrome: sidebar-navegacion a la izquierda — ver [_shell](./_shell.md))
- contenedor-centrado (ocupa el `<main>` completo, centrado en los dos ejes)
  - indicador-carga *(en loading y en redirigiendo)*
  - texto-estado
  - boton-reintentar *(solo en error)*

**Origen:** `projects/page.module.scss:15-23` — `.centered { display:flex;
flex-direction:column; align-items:center; justify-content:center; min-height:300px;
gap: var(--spacing-md); height:100% }`.

### mobile · 400px

Misma composición vertical. Lo único que cambia es el padding del contenedor.

**Origen:** `projects/page.module.scss:8` y `:26` — dos `@include mobile` sobre el contenedor
externo, no sobre la disposición de los bloques.

**El contenido no cambia entre viewports.** El stack centrado es idéntico; lo que falta en mobile
es el chrome, no esta pantalla.

## Contenido

### texto-estado (loading)
- Texto/label: "Cargando proyectos..."
- Origen: `projects/page.tsx:32` (hardcodeado)

### texto-estado (error)
- Texto/label: "Error al cargar los proyectos"
- Origen: `projects/page.tsx:42`

### boton-reintentar
- Texto/label: "Reintentar"
- Origen: `projects/page.tsx:44`
- Annotation: llama a `refetch()` de `useProjects` (`projects/page.tsx:43`)

### texto-estado (empty)
- Texto/label: "No tienes proyectos asignados"
- Origen: `projects/page.tsx:55`
- Annotation: **usa "tú" ("tienes"), mientras el resto de la aplicación vosea.** Ver Gaps del
  índice

### texto-estado (redirigiendo)
- Texto/label: "Redirigiendo..."
- Origen: `projects/page.tsx:67`
- Annotation: el comentario del código lo explica — *"Si hay proyectos, el useEffect ya está
  redirigiendo / Mostramos spinner mientras redirige"* (`projects/page.tsx:61-62`)

### indicador-carga
- Texto/label: texto oculto "Cargando..." dentro del spinner
- Origen: `Spinner.tsx:11`
- Annotation: `role="status"` + `aria-label="Cargando"` (`Spinner.tsx:9`)

## Estados presentes

Los cuatro son excluyentes y se evalúan en este orden.

### loading
- Mensaje: "Cargando proyectos..."
- Disparado por: `isLoading` de `useProjects()`
- Origen: `projects/page.tsx:27-36`
- Cambios: spinner grande + texto, centrados

### error de sistema
- Mensaje: "Error al cargar los proyectos"
- Disparado por: `isError` de `useProjects()`
- Origen: `projects/page.tsx:38-49`
- Cambios: texto en `--color-error` + botón "Reintentar"

### empty
- Mensaje: "No tienes proyectos asignados"
- Disparado por: `!projects || projects.length === 0`
- Origen: `projects/page.tsx:51-59`
- Cambios: solo el texto, sin spinner ni acción
- Annotation: **es un estado terminal.** No hay botón, ni link, ni forma de salir salvo el logout
  del sidebar — que en mobile no existe

### default → redirigiendo
- Mensaje: "Redirigiendo..."
- Disparado por: hay al menos un proyecto; el `useEffect` ya disparó el `router.push`
- Origen: `projects/page.tsx:63-70`
- Cambios: spinner grande + texto

**No existe un estado "default con contenido":** el camino feliz de esta pantalla es no verla.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| error de validación | no aplica — la pantalla no tiene formulario | — |
| not found | no aplica — no resuelve un recurso por id | — |
| success | no aplica | — |
| estado terminal / readonly | **presente de hecho, sin tratarse como tal.** El empty es terminal: el usuario no tiene ninguna acción disponible desde ahí | `projects/page.tsx:51-59` |
| permiso/acceso denegado | **no se distingue del empty.** Un usuario sin permisos, uno cuya alta en la api falló, y uno legítimamente sin proyectos ven exactamente el mismo mensaje | `projects/page.tsx:55` + `authApi.ts:24-31` |

**El caso más notable:** un `error` en la query se muestra correctamente, pero **un error de alta
en `/login/enter` se presenta como empty.** Son situaciones distintas con el mismo mensaje y sin
salida.

## Interacciones

**Eventos:**
- boton-reintentar · click → `refetch()` de `useProjects` · `projects/page.tsx:43`
- *(ninguna otra: el resto de la pantalla es no interactivo)*

**Validaciones:**
- Ninguna.

**Feedback:**
- La redirección es automática y sin confirmación · `projects/page.tsx:20-25`
- No hay indicación de a qué proyecto se está entrando: el texto dice solo "Redirigiendo..."

**Ordenamiento** (`projects/page.tsx:14-17`):

```tsx
const sortedProjects = useMemo(() => {
  if (!projects) return [];
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}, [projects]);
```

`localeCompare` sin locale explícito: usa el del entorno. El destino de la redirección depende de
ese orden.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Indicador de carga anunciado | **presente** — `role="status"` + `aria-label="Cargando"` + texto visualmente oculto | `Spinner.tsx:9-11` |
| Redirección automática anunciada | **ausente** — sin `aria-live`. Un lector de pantalla no anuncia el cambio de contexto | `projects/page.tsx:20-25` |
| Encabezado de página | **ausente** — la pantalla no tiene `<h1>` en ningún estado | `projects/page.tsx` |
| Botón con texto | **presente** — "Reintentar" es texto, no ícono | `projects/page.tsx:44` |
| Mensaje de error anunciado | **ausente** — el `<p>` de error no tiene `role="alert"` | `projects/page.tsx:42` |
| Landmark | heredado del `<main>` del shell | `(dashboard)/layout.tsx:14` |

## Observaciones del relevamiento

- **Es la pantalla mejor cubierta en estados de toda la aplicación** —loading, error con
  reintentar, empty y una transición explícita— y es la que menos se ve. Las pantallas donde el
  usuario pasa el tiempo (el tablero) no tienen ni error ni empty.

- **`ProjectList` y `ProjectCard` existen y no se usan.** Los dos están completos, con estilos
  responsive (`ProjectList.module.scss:11-17` es el único lugar de la aplicación que usa
  `@include tablet` y `@include desktop`, con grillas de 2 y 3 columnas) y con tests. Sugieren que
  esta pantalla iba a ser un listado de proyectos. Cuándo cambió, o por qué, no se puede
  determinar desde el código.

- **Los tres breakpoints de la aplicación viva se reducen a uno por esta decisión.** La grilla
  responsive de `ProjectList` era el único consumidor de `tablet` y `desktop`; al no renderizarse,
  el único corte real que queda es 768px.

- **La redirección hace `push`, no `replace`** (`projects/page.tsx:23`). Consecuencia: el botón
  "atrás" del navegador vuelve a `/projects`, que inmediatamente vuelve a redirigir. **El usuario
  no puede volver atrás desde el tablero del primer proyecto.**

- **El empty es terminal y ambiguo.** No distingue "no tenés proyectos", "no tenés permisos" y "el
  alta falló". A confirmar en consolidación qué debería ver un usuario en cada caso.

- No se pudo determinar si el orden alfabético es el criterio deseado para elegir el proyecto de
  entrada, o si es un default provisorio. El código no lo justifica.
