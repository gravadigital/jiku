---
document: UX Survey Screen
screen: _shell
route: "(dashboard)/*"
service: opus-web
source_files:
  - src/app/(dashboard)/layout.tsx
  - src/app/(dashboard)/layout.module.scss
  - src/features/projects/components/Sidebar/Sidebar.tsx
  - src/features/projects/components/Sidebar/Sidebar.module.scss
  - src/app/providers.tsx
  - src/app/(auth)/layout.tsx
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: _shell (chrome compartido)

> **Relevamiento as-is** del chrome del grupo `(dashboard)`, extraído de
> `src/app/(dashboard)/layout.tsx`. Describe lo que el código hace hoy, no lo que debería hacer.

No es una pantalla: es el marco que envuelve a `proyectos-redireccion`, `tablero-requisitos` y
`detalle-requisito`. Se releva aparte para no repetirlo en las tres.

## Identidad

- **Ruta:** todas las de `(dashboard)/`
- **Archivo:** `src/app/(dashboard)/layout.tsx`
- **Requiere auth:** sí — `middleware.ts:45-47`, matcher por exclusión
- **Audiencia:** no determinable desde el código
- **Propósito observado:** provee navegación entre proyectos, acceso a crear un requisito e
  identidad del usuario logueado, alrededor del contenido de cada ruta.
- **Viewports con tratamiento:** mobile, desktop — **con una diferencia estructural, no de
  layout**

## Entrada y salida

**Entradas:**
- Desde `/` tras validar sesión · `app/page.tsx:11` (`redirect('/projects')`)
- Desde `/login/enter` tras el callback de OIDC · `login/enter/page.tsx:6` (`redirect('/')`)

**Salidas:**
- A `/projects/{id}/requirements?view=list` · click en un proyecto del sidebar ·
  `Sidebar.tsx:39-41`
- A `/login` · click en el ícono de logout · `Sidebar.tsx:108` → `useLogout.ts:4`
  (`signOut({callbackUrl:'/login'})`)
- Abre el overlay "Nuevo requisito" · botón del sidebar · `Sidebar.tsx:96` →
  `(dashboard)/layout.tsx:13`

**Redirects automáticos:**
- A `/login` si la sesión no es válida o el access token venció · `middleware.ts:38-40`

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | sidebar-navegacion | `sidebar` | — | **solo desktop** | `<Sidebar>` | `(dashboard)/layout.tsx:13`; oculto en `Sidebar.module.scss:13-15` |
| 2 | logo-marca | `section` | — | solo desktop | `<div className={styles.logo}>` | `Sidebar.tsx:48-53` |
| 3 | etiqueta-proyectos | `heading` | h3 | solo desktop | `<span className={styles.navLabel}>` | `Sidebar.tsx:57` |
| 4 | lista-proyectos | `list` | — | solo desktop | `<div className={styles.navList}>` | `Sidebar.tsx:59-92` |
| 5 | boton-nuevo-requisito | `button` | primary | solo desktop | `<button className={styles.newOrderButton}>` | `Sidebar.tsx:96-99` |
| 6 | bloque-usuario | `section` | — | solo desktop | `<div className={styles.user}>` | `Sidebar.tsx:102-111` |
| 7 | avatar-usuario | `avatar` | iniciales | solo desktop | `<div className={styles.avatar}>` | `Sidebar.tsx:103` |
| 8 | boton-logout | `button` | icon-only | solo desktop | `<button className={styles.logoutButton}>` | `Sidebar.tsx:108-110` |
| 9 | contenido-principal | `main` | — | ambos | `<main className={styles.main}>` | `(dashboard)/layout.tsx:14` |
| 10 | contenedor-toasts | `toast` | — | ambos | `<ToastContainer>` | `providers.tsx:50` (portal a `document.body`) |

> `logo-marca`, `etiqueta-proyectos`, `bloque-usuario` y `contenido-principal` se relevaron como
> `section`/`main`: son contenedores estructurales sin un tipo más específico en el diccionario.

**El grupo `(auth)` no tiene chrome.** Su layout es un `<div>` con `display: contents`
(`(auth)/layout.module.scss:3-5`), que no genera caja: la pantalla de login ocupa el viewport
entero.

## Layout observado por viewport

### desktop · 1200px

- row `shell`
  - col 3/12: sidebar-navegacion
    - logo-marca
    - etiqueta-proyectos
    - lista-proyectos
    - boton-nuevo-requisito
    - bloque-usuario (avatar-usuario + nombre/email + boton-logout)
  - col 9/12: contenido-principal

**Origen:** `(dashboard)/layout.module.scss:3-15` — `.layout { display:flex; height:100vh;
overflow:hidden }` con `.main { flex:1 }` y `Sidebar.module.scss:4` con `width: 263px`.

La fracción 3/12 es una aproximación: **el sidebar es de ancho fijo (263px), no proporcional.** A
1200px eso es ~2.6/12; a 1600px, ~2/12. El `flex: 1` del main absorbe todo el resto.

Dentro del sidebar, `lista-proyectos` crece y `boton-nuevo-requisito` + `bloque-usuario` quedan
abajo, empujados por el `flex-grow` de la nav.

### mobile · 400px

- contenido-principal

**Origen:** `Sidebar.module.scss:13-15` — `@include mobile { display: none }`.

**No hay nada más.** El layout sigue siendo `display: flex`, pero con un solo hijo visible: el
`<main>` ocupa el ancho completo.

## Contenido

### logo-marca
- Texto/label: "Opus"
- Origen: `Sidebar.tsx:52` (hardcodeado)
- Icono: `src/assets/logo.png`, 26×26, con `alt="Opus"` · `Sidebar.tsx:50`
- Annotation: el contenedor tiene fondo `#2563eb` y `border-radius: 12px`
  (`Sidebar.module.scss:23-27`)

### etiqueta-proyectos
- Texto/label: "Proyectos"
- Origen: `Sidebar.tsx:57`

### lista-proyectos
- Texto/label: dinámico — `project.name` desde `GET /api/opus/projects`
- Origen: `Sidebar.tsx:86`
- Icono: SVG de carpeta inline, 15×15 · `Sidebar.tsx:76-85`
- Annotation: ordenados alfabéticamente con `localeCompare` (`Sidebar.tsx:25-28`). El activo se
  determina por regex sobre el pathname: `/\/projects\/(\d+)/` (`Sidebar.tsx:23`)

### boton-nuevo-requisito
- Texto/label: "Nuevo requisito"
- Origen: `Sidebar.tsx:98`
- Icono: `Plus` de lucide-react, 14px, `strokeWidth={2.5}` · `Sidebar.tsx:97`
- Annotation: **es el único acceso a crear un requisito en toda la aplicación** — ver Observaciones

### bloque-usuario
- Texto/label: dinámico — `session.user.name` y `session.user.email`
- Origen: `Sidebar.tsx:105-106`
- Annotation: las iniciales salen de las dos primeras palabras del nombre en mayúscula; sin
  nombre muestra `"?"` (`Sidebar.tsx:30-37`)

### boton-logout
- Texto/label: ninguno — solo ícono
- Origen: `Sidebar.tsx:108-110`
- Icono: `LogOut` de lucide-react, 15px
- Annotation: usa `title="Cerrar sesión"`, **no `aria-label`**

## Estados presentes

### loading (lista de proyectos)
- Mensaje: "Cargando proyectos..."
- Disparado por: `isLoading` de `useProjects()`
- Origen: `Sidebar.tsx:67-68`
- Cambios: reemplaza la lista por el texto

### error (lista de proyectos)
- Mensaje: "Error al cargar proyectos" + botón "Reintentar"
- Disparado por: `error` de `useProjects()`
- Origen: `Sidebar.tsx:60-66`
- Cambios: reemplaza la lista por el mensaje y el botón, que llama a `refetch()`

### empty (lista de proyectos)
- Mensaje: "No hay proyectos disponibles"
- Disparado por: `sortedProjects.length === 0` sin error ni loading
- Origen: `Sidebar.tsx:90`
- Cambios: reemplaza la lista por el texto

**El orden del ternario es error → loading → contenido → empty** (`Sidebar.tsx:60-91`), distinto
del `loading → error → empty` que usan las pantallas.

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| default (mobile) | **El chrome entero no se renderiza.** Sin navegación, sin logout, sin crear requisito | `Sidebar.module.scss:13-15` + `(dashboard)/layout.tsx:12-19` sin alternativa |
| error de validación | no aplica — el shell no tiene formulario | — |
| error de sistema / sin conexión | Cubierto parcialmente por el estado de error de la lista. Una caída total de red lleva al 401 → `window.location.href = '/login'` (`lib/axios.ts:31-36`) | — |
| success | no aplica | — |
| not found | no aplica — el shell no resuelve un recurso | — |
| estado terminal / readonly | no aplica | — |

## Interacciones

**Eventos:**
- lista-proyectos · click en un ítem → `router.push('/projects/{id}/requirements?view=list')` ·
  `Sidebar.tsx:39-41`
- boton-nuevo-requisito · click → abre el overlay de creación · `Sidebar.tsx:96` +
  `(dashboard)/layout.tsx:13`
- boton-logout · click → `signOut({callbackUrl:'/login'})` · `Sidebar.tsx:108`
- Reintentar (en error) · click → `refetch()` de `useProjects` · `Sidebar.tsx:63`

**Validaciones:**
- Ninguna: el shell no tiene inputs.

**Feedback:**
- El proyecto activo recibe la clase `styles.active` · `Sidebar.tsx:73`
- No hay indicador de navegación en curso: el click no muestra loading hasta que la ruta cambia

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | **presente** — `alt="Opus"` en el logo | `Sidebar.tsx:50` |
| Ítems de proyecto navegables por teclado | **ausente** — `<div onClick>` sin `role`, `tabIndex` ni `onKeyDown` | `Sidebar.tsx:71-75` |
| Label accesible del logout | **parcial** — usa `title`, no `aria-label`. Un lector de pantalla puede anunciarlo, pero no es el atributo previsto para un botón de solo ícono | `Sidebar.tsx:108` |
| Landmark de navegación | **presente** — `<nav>` y `<aside>` | `Sidebar.tsx:46`, `:56` |
| Landmark de contenido | **presente** — `<main>` | `(dashboard)/layout.tsx:14` |
| Estado activo anunciado | **ausente** — el proyecto activo se marca solo con una clase, sin `aria-current` | `Sidebar.tsx:73` |
| Avatar decorativo | el `<div>` de iniciales no tiene `aria-hidden`, así que un lector lee las iniciales sueltas | `Sidebar.tsx:103` |
| Contenedor de toasts | `role="alert"` por toast | `Toast.tsx:42` |

## Observaciones del relevamiento

- **En mobile el shell desaparece por completo y no hay reemplazo.** Existe `MobileMenu`
  (`shared/components/layout/MobileMenu/`), un drawer con dropdown de proyectos, "Nueva tarea" y
  logout — pero solo lo importa `Header`, que no lo usa nadie. Las dos piezas de un shell mobile
  funcional están escritas y desconectadas del árbol.

- **Hay dos shells en el código.** `Sidebar` (el que se renderiza, lateral) y `Header` (superior,
  con dropdown de proyectos, botón "Nueva tarea", logout y hamburguesa que abre `MobileMenu`).
  `Header` está completo y tiene tests. Cuál era el previsto no se puede determinar desde el
  código; a confirmar en consolidación.

- **El prop se llama `onNewObjective` y el botón dice "Nuevo requisito."** `Sidebar.tsx:14` y
  `(dashboard)/layout.tsx:13` usan "objective"; la UI dice "requisito". Vocabulario mezclado — el
  código muerto (`MobileMenu.tsx:150`) además dice "Nueva tarea".

- **El sidebar es la única vía a crear un requisito.** `BoardHeader` recibe un `onNewRequirement`
  y lo ignora (`BoardHeader.tsx:24`, renombrado a `_onNewRequirement`), aunque el tablero se lo
  pasa (`requirements/page.tsx:169`). Consecuencia combinada con lo anterior: **en mobile no hay
  ninguna forma de crear un requisito.**

- **Hay dos `CreateRequirementModal` montados a la vez.** Uno en el layout
  (`(dashboard)/layout.tsx:15-18`, abierto por el sidebar) y otro en la pantalla del tablero
  (`requirements/page.tsx:192-195`, que ningún control abre porque `BoardHeader` ignora el
  callback). Los dos existen en el DOM del tablero; solo el primero se puede abrir.

- **El ancho del sidebar (263px) no es un token** ni un valor de la escala. Está literal en
  `Sidebar.module.scss:4`.

- No se pudo determinar si el sidebar debería colapsar en desktop: no hay estado de colapso ni
  contexto que lo sugiera (a diferencia de `web`, que tiene un `SidebarContext` muerto).
