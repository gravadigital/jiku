---
document: UX Survey Screen
screen: _shell
route: "(loggedin)/* — chrome compartido, no es una ruta"
service: web
source_files:
  - src/app/(loggedin)/layout.tsx
  - src/app/(loggedin)/styles.module.scss
  - src/shared/components/layout/Navbar/Navbar.tsx
  - src/shared/components/layout/Navbar/Navbar.module.scss
  - src/shared/components/layout/NavItem/NavItem.tsx
  - src/shared/components/layout/NavSubItem/NavSubItem.tsx
  - src/shared/components/layout/PageLayout/PageLayout.tsx
viewports_detected:
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: _shell

> **Relevamiento as-is** del chrome compartido por las 21 pantallas autenticadas, extraído de
> `src/app/(loggedin)/layout.tsx`. Describe lo que el código hace hoy, no lo que debería hacer.
>
> **No es una pantalla.** Se releva aparte para no repetirlo en los 21 surveys. Cada survey de
> pantalla asume estos bloques presentes y solo documenta su contenido.

## Identidad

- **Ruta:** ninguna. Envuelve todo lo que está dentro de `src/app/(loggedin)/`
- **Archivo:** `src/app/(loggedin)/layout.tsx`
- **Requiere auth:** sí — este layout **es** el guard: `auth()` + `redirect` en las líneas 13-21
- **Audiencia:** no determinable desde el código
- **Propósito observado:** monta la navegación lateral persistente, el área de contenido con su
  fallback de carga, y el contenedor de notificaciones.
- **Viewports con tratamiento:** ninguno. Sin tratamiento responsive.

## Entrada y salida

**Entradas:**
- Cualquier navegación a una ruta bajo `(loggedin)/`.

**Salidas** (desde la navegación):
- `/` · logo de la aplicación · `Navbar.tsx:190`
- `/clients` · ítem "Actores" · `Navbar.tsx:49`
- `/projects` · ítem "Proyectos" · `Navbar.tsx:54`
- `/requirements` · ítem "Requisitos" · `Navbar.tsx:59`
- `/objectives` · ítem "Tareas" · `Navbar.tsx:64`
- `/objectives/by-project` · subítem "Por proyecto" · `Navbar.tsx:69`
- `/objectives/by-responsible` · subítem "Por responsable" · `Navbar.tsx:73`
- `/time-allocation` · ítem "Asignación de Tiempo" · `Navbar.tsx:79`
- `/worked-times` · ítem "Horas Trabajadas" y subítem "Carga" · `Navbar.tsx:84`, `:89`
- `/worked-times/report` · subítem "Visualización" · `Navbar.tsx:94`
- URLs externas configurables · bloque del pie, `target="_blank"` · `Navbar.tsx:228-239`
- `/login` · "Cerrar sesión" → `signOut({callbackUrl:'/login'})` · `Navbar.tsx:184`

**Redirects automáticos:**
- `/login` si no hay sesión · `(loggedin)/layout.tsx:15-17`
- `/unauthorized` si `session.user.roles` incluye `external-user` · `(loggedin)/layout.tsx:19-21`

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | sidebar-navegacion | `sidebar` | — | ambos | `<aside>` + `<Navbar>` | `(loggedin)/layout.tsx:25-27` |
| 2 | logo-aplicacion | `image` | — | ambos | `<Image src={appLogo}>` dentro de `<Link href="/">` | `Navbar.tsx:189-193` |
| 3 | lista-navegacion | `nav-bar` | — | ambos | `<ul>` con 6 `<NavItem>` | `Navbar.tsx:195-224` |
| 4 | subitem-navegacion | `link` | activo / inactivo | ambos | `<NavSubItem>` ×4 | `Navbar.tsx:209-220` |
| 5 | enlaces-externos | `section` | — | ambos | `<div>` con N `<Link target="_blank">` | `Navbar.tsx:227-240` |
| 6 | boton-cerrar-sesion | `button` | — | ambos | `<NavItem href="#" handleClick={handleLogout}>` | `Navbar.tsx:242-250` |
| 7 | area-contenido | `main` | — | ambos | `<main>` con `<Suspense>` | `(loggedin)/layout.tsx:28-30` |
| 8 | cargando-contenido | `loader` | — | ambos | `<Loader label="Cargando...">` como fallback | `(loggedin)/layout.tsx:29` |
| 9 | contenedor-toasts | `toast` | success / error | ambos | `<ToastContainer>` | `(loggedin)/layout.tsx:31-42` |
| 10 | monitor-sesion | — | — | — | `<SessionMonitor>` — **no renderiza nada** | `(loggedin)/layout.tsx:24` |

> `sidebar-navegacion` y `enlaces-externos` se relevaron con los tipos `sidebar` y `section`. El
> bloque de enlaces externos no mapea a ningún tipo del diccionario: es una grilla de iconos-link
> sin etiqueta visible, con el label solo en el atributo `title`.

> `monitor-sesion` monta un componente que devuelve `null` y cuyo hook es un no-op. No es un bloque
> de UI; se lista porque está en el árbol.

### Encabezado de página (`PageLayout`)

15 de las 21 pantallas autenticadas envuelven su contenido en `<PageLayout>`, que aporta tres
bloques más:

| # | Nombre | Tipo | Variant | Viewports | Componente real | Origen |
|---|--------|------|---------|-----------|-----------------|--------|
| 11 | etiqueta-pagina | `paragraph` | caption | ambos | `<p className={styles.label}>` | `PageLayout.tsx:24` |
| 12 | titulo-pagina | `heading` | h1 | ambos | `<h1>{title}</h1>` | `PageLayout.tsx:25` |
| 13 | acciones-pagina | `section` | — | ambos | `<div>` con el array `actions` | `PageLayout.tsx:27-31` |

`acciones-pagina` usa `flex-direction: row-reverse` (`PageLayout.module.scss:33`): **el primer
elemento del array aparece más a la derecha.**

Las 6 pantallas que **no** usan `PageLayout` y montan su propio header:
`detalle-proyecto`, `alta-proyecto`, `edicion-proyecto`, `detalle-requisito`, `alta-requisito`,
`edicion-requisito`.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- row `shell` (`display: flex`, `height: 100vh`, `overflow: hidden`)
  - col fija 290px: sidebar-navegacion
    - logo-aplicacion
    - lista-navegacion (columna, `gap: 0.5rem`)
    - enlaces-externos (fila con wrap, `margin-top: auto`)
    - boton-cerrar-sesion
  - col resto (`flex: 1`): area-contenido
    - etiqueta-pagina
    - titulo-pagina + acciones-pagina (fila, `space-between`)
    - contenido de la pantalla
- contenedor-toasts (fijo, `top-right`)

**Origen:** `(loggedin)/styles.module.scss:1-26`:

```scss
.layoutContainer { display: flex; height: 100vh; overflow: hidden; }
.sidebarContainer { position: relative; width: 290px; height: 100vh; overflow-y: auto; z-index: 10; }
.mainContainer { flex: 1; height: 100vh; overflow-y: auto; overflow-x: hidden; padding: 1rem 2rem; }
```

**No hay fracciones de 12 columnas derivables:** el shell es un flex con un ancho fijo en píxeles
y el resto elástico, no una grilla. A 1200px la sidebar es ~2.9/12 y el contenido ~9.1/12; a 1440px
es 2.4/12 y 9.6/12. La proporción cambia con el ancho porque la columna izquierda no escala.

**Consecuencia a cualquier ancho angosto:** la sidebar mantiene 290px, así que a 400px de viewport
el contenido queda con ~46px menos el padding de 2rem por lado — es decir, negativo. `overflow-x:
hidden` en el `body` (`globals.scss:172`) oculta el desborde en vez de permitir scroll horizontal.

## Contenido

### logo-aplicacion
- Texto/label: sin texto. `alt` = `appName ?? 'Jiku'`, desde `process.env.APP_NAME`
- Origen: `Navbar.tsx:191`, `(loggedin)/layout.tsx:26`
- Icono: `assets/logoLayout.png`, altura 55px
- Annotation: enlaza a `/`, que hoy es la pantalla vacía

### lista-navegacion
Seis ítems fijos, definidos en la constante `NAV_ITEMS` (`Navbar.tsx:47-99`):

| Label verbatim | href | Icono | Subítems |
|---|---|---|---|
| `"Actores"` | `/clients` | `assets/actoresLogo.svg` | — |
| `"Proyectos"` | `/projects` | `assets/proyectosLogo.svg` | — |
| `"Requisitos"` | `/requirements` | `assets/requisitosLogo.svg` | — |
| `"Tareas"` | `/objectives` | `assets/objetivosLogo.svg` | `"Por proyecto"`, `"Por responsable"` |
| `"Asignación de Tiempo"` | `/time-allocation` | `assets/schedule-icon.svg` | — |
| `"Horas Trabajadas"` | `/worked-times` | `assets/ExternalLogos/horas.svg` | `"Carga"`, `"Visualización"` |

- Origen: `Navbar.tsx:47-99` (hardcodeado, sin i18n)
- Annotation: el ítem activo se calcula con `pathname.startsWith(item.href)`
  (`isPathActive`, `Navbar.tsx:140-142`). El subítem `"Carga"` usa `exact: true` y compara con
  `===`, porque `/worked-times` es prefijo de `/worked-times/report`.

> **`"Horas Trabajadas"` reutiliza el icono de un enlace externo** (`ExternalLogos/horas.svg`), no
> tiene uno propio.

> **Los subítems siempre están visibles**, no se despliegan: el grupo renderiza el ítem padre y sus
> subítems juntos sin estado de expansión (`Navbar.tsx:200-221`).

### enlaces-externos
- Texto/label: dinámico desde `process.env.EXTERNAL_LINKS`, un JSON
  `[{"tool":"github","href":"https://…","label":"Código"}]`. **El label solo aparece en el atributo
  `title` y en el `alt` de la imagen, no como texto visible.**
- Origen: `Navbar.tsx:119-137` (parseo), `:227-240` (render)
- Iconos: mapeados por `tool` entre `github`, `gitlab`, `hedgedoc`, `mattermost`, `mail`. Sin
  coincidencia se usa el de GitHub.
- Annotation: sin la variable de entorno el bloque queda vacío. Un JSON inválido se ignora con
  `console.error` y devuelve `[]` — el comentario del código dice *"Una variable mal formada no
  debería tumbar la navegación entera."*

### boton-cerrar-sesion
- Texto/label: `"Cerrar sesión"`
- Origen: `Navbar.tsx:244`
- Icono: `assets/logoutLogo.svg`
- Annotation: es un `<NavItem href="#">` con `handleClick`, no un `<button>`. `signOut` con
  `callbackUrl: '/login'`.

### cargando-contenido
- Texto/label: `"Cargando..."`
- Origen: `(loggedin)/layout.tsx:29`

### contenedor-toasts
- Texto/label: dinámico, lo pone cada pantalla
- Origen: `(loggedin)/layout.tsx:31-42`
- Annotation: `position="top-right"`, `autoClose={2000}`, `closeOnClick`, `draggable`,
  `pauseOnHover`, `pauseOnFocusLoss`, `hideProgressBar={false}`, `newestOnTop={false}`,
  `theme="light"`

### etiqueta-pagina / titulo-pagina
- Texto/label: dinámico por pantalla, vía props `label` y `title` de `PageLayout`
- Origen: `PageLayout.tsx:24-25`
- Annotation: `label` renderiza `<p>{label || ''}</p>` — **siempre** ocupa 1rem de alto
  (`PageLayout.module.scss:16`), incluso vacío. Ninguna pantalla relevada pasa `label`.

## Estados presentes

### default
- Disparado por: sesión válida y rol distinto de `external-user`
- Origen: `(loggedin)/layout.tsx:22-43`
- Cambios: renderiza el shell completo

### loading
- Mensaje: `"Cargando..."`
- Disparado por: el `<Suspense>` que envuelve `{children}` mientras la pantalla resuelve
- Origen: `(loggedin)/layout.tsx:29`
- Cambios: reemplaza solo el área de contenido; la sidebar queda montada

### estado activo de navegación
- Disparado por: `isParentActive(pathname, item)` — coincidencia por prefijo del `href` del ítem o
  de cualquiera de sus subítems
- Origen: `Navbar.tsx:145-155`
- Cambios: clase `.active` en el ítem y `aria-current="page"` en el `<Link>`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty | no aplica: la navegación es una constante de 6 ítems, nunca está vacía | `Navbar.tsx:47-99` |
| error de validación | no aplica: el shell no tiene formulario | — |
| error de sistema / sin conexión | **no hay `error.tsx` a nivel del grupo `(loggedin)`.** Una excepción en el layout o en una pantalla sin boundary propio cae en la pantalla de error por defecto de Next, sin sidebar | no existe `(loggedin)/error.tsx` ni `app/error.tsx` |
| success | no aplica al shell; los toasts los dispara cada pantalla | — |
| not found | **no hay `not-found.tsx`.** Una URL inexistente bajo `(loggedin)` muestra el 404 por defecto de Next, sin navegación | no existe `not-found.tsx` en ningún nivel |
| estado terminal / readonly | no aplica | — |
| sesión expirada con la pestaña abierta | **nada visible.** `useSessionMonitor` es un no-op y `SessionProvider` tiene `refetchInterval={0}`: no hay aviso hasta que un request devuelve 401 y el interceptor navega a `/login` | `use-session-monitor.ts:8-10`, `providers.tsx:18`, `axios.ts:46-51` |
| sidebar colapsada | **no existe**, aunque `SidebarContext` expone `isCollapsed`, `collapse`, `expand` y `toggleCollapse`. Nadie consume el context y el shell tiene la sidebar fija en 290px | `SidebarContext.tsx:5-14`, `(loggedin)/styles.module.scss:11` |
| navegación en mobile | **no existe.** Sin drawer, sin hamburguesa, sin media query | `(loggedin)/styles.module.scss:1-26` |

## Interacciones

**Eventos:**
- logo-aplicacion · click → navega a `/` · `Navbar.tsx:190`
- ítem de navegación · click → navega al `href`. Si `disabled`, `preventDefault()` y no navega ·
  `NavItem.tsx:28-36`
- ítem de navegación · hover → el icono escala a 1.2 (`transform: scale(1.2)`, 250ms) ·
  `NavItem.module.scss:12-14`
- enlace externo · click → abre en pestaña nueva (`target="_blank"`, `rel="noopener noreferrer"`) ·
  `Navbar.tsx:229-236`
- boton-cerrar-sesion · click → `signOut({callbackUrl: '/login'})` · `Navbar.tsx:183-185`
- toast · click → se cierra (`closeOnClick`); drag → se descarta (`draggable`) ·
  `(loggedin)/layout.tsx:36,39`

**Validaciones:**
- Ninguna: el shell no tiene inputs.

**Feedback:**
- El ítem activo recibe la clase `.active` y `aria-current="page"`.
- Los toasts se cierran solos a los 2000ms, con barra de progreso visible.

**Filtrado por rol (código sin efecto en esta aplicación):**
```ts
// Navbar.tsx:158-165
function getVisibleNavItems(isExternalUser: boolean): NavItemConfig[] {
  if (isExternalUser) {
    return NAV_ITEMS.filter(i => i.href !== '/time-allocation' && i.href !== '/worked-times');
  }
  return NAV_ITEMS;
}
```
**Nunca se ejecuta la rama del `if`:** el layout ya redirigió a `/unauthorized` a cualquier
`external-user` antes de renderizar el `Navbar`.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | Correcto en los iconos de navegación: `alt=""` + `aria-hidden="true"` (decorativos) | `NavItem.tsx:54`, `NavSubItem.tsx:55` |
| Alt en el logo | Presente y con contenido real (`appName`) | `Navbar.tsx:191` |
| Alt en enlaces externos | Presente: `alt={link.label}` | `Navbar.tsx:237` |
| Estado activo anunciado | `aria-current="page"` en el `<Link>` del ítem activo | `NavItem.tsx:44`, `NavSubItem.tsx:44` |
| Estado deshabilitado anunciado | `aria-disabled={disabled \|\| undefined}` | `NavItem.tsx:45` |
| Enlace que abre pestaña nueva | Anunciado con `<span className="sr-only">(abre en nueva ventana)</span>` — **pero solo cuando `external={true}`, y ningún `NavItem` se renderiza con esa prop** | `NavItem.tsx:57-62`; los enlaces externos reales (`Navbar.tsx:228`) no lo tienen |
| Landmarks | `<nav>` en el Navbar, `<main>` en el contenido, `<aside>` en el contenedor de la sidebar, `<header>` en `PageLayout` | `Navbar.tsx:188`, `(loggedin)/layout.tsx:25,28`, `PageLayout.tsx:22` |
| Nombre del landmark de navegación | **ausente:** el `<nav>` no tiene `aria-label`. Con un solo `<nav>` no es crítico | `Navbar.tsx:188` |
| Focus ring | Presente vía `@include focus-ring` en `.navItem` | `NavItem.module.scss:10` |
| Skip link | **ausente:** no hay forma de saltar la navegación e ir al contenido | ningún `href="#main"` en el código |
| `boton-cerrar-sesion` semántica | Es un `<Link href="#">` con `onClick`, no un `<button>`. Se anuncia como enlace y aparece en la lista de links | `Navbar.tsx:243-249` |
| Clases condicionales rotas | `` `${styles.navItem} ${disabled && styles.disabled} ${active && styles.active}` `` escribe la cadena `"false"` en el atributo `class` cuando la condición no se cumple | `NavItem.tsx:48-51`, `NavSubItem.tsx:49-52` |
| Estructura de lista | `<ul>` con `<div className={styles.navGroup}>` como hijo directo, no `<li>`. HTML inválido y los lectores de pantalla no anuncian el conteo de ítems | `Navbar.tsx:195-200` |
| Segundo `<ul>` para logout | `<ul className={styles.logout}>` con un `<NavItem>` (que renderiza un `<Link>`) como hijo directo, sin `<li>` | `Navbar.tsx:242-250` |

## Observaciones del relevamiento

- **`<SessionMonitor />` está montado y no hace nada.** `useSessionMonitor` tiene el cuerpo real
  comentado, con la nota *"Local development — auth bypassed… Remove this comment and restore the
  redirect when deploying"* (`use-session-monitor.ts:3-10`). El guard del layout sigue funcionando;
  lo que falta es la vigilancia continua de la sesión.
- **El filtrado de navegación por `external-user` es código inalcanzable** en esta aplicación
  (`Navbar.tsx:158-165`). A confirmar en consolidación si es lógica que pertenece a `opus-web`, o si
  la intención original era que `external-user` sí entrara acá con navegación reducida — el README
  del servicio dice *"An `external-user` reaching this frontend sees a reduced navigation"*, lo que
  **contradice** el redirect del layout.
- **`SidebarContext` describe una sidebar colapsable que no existe.** Expone 8 miembros incluyendo
  `isCollapsed` y `toggleCollapse`, y no tiene consumidores. No se puede saber si es una feature
  planeada, una removida, o un provider copiado de otro proyecto.
- **`PageLayout` usa `next/head`** (`PageLayout.tsx:17-21`), que no tiene efecto en el App Router.
  El `<meta name="robots" content="noindex, nofollow">` y el `<link rel="icon" href="/public/favicon.ico">`
  que declara **no se aplican**. El `<title>` real viene de `metadata` en `app/layout.tsx:12-15`.
  Nota aparte: `/public/favicon.ico` sería una ruta incorrecta incluso si funcionara (sería
  `/favicon.ico`).
- **El `label` de `PageLayout` reserva altura siempre.** `<p>{label || ''}</p>` con
  `height: 1rem` fijo: hay 1rem de espacio vacío arriba de cada título. Ninguna pantalla relevada
  pasa la prop.
- **`acciones-pagina` invierte el orden visual** (`row-reverse`). Al leer un array de acciones en el
  código, el primer elemento es el de más a la derecha.
- **No se pudo determinar** qué enlaces externos ve cada instalación: dependen de `EXTERNAL_LINKS`.
- **A confirmar en consolidación:** si la sidebar de 290px fija es una decisión o una deuda, y si
  hace falta un skip link y un `not-found.tsx`.
