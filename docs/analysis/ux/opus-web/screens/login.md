---
document: UX Survey Screen
screen: login
route: /login
service: opus-web
source_files:
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/login/login.module.scss
  - src/app/(auth)/layout.tsx
  - src/middleware.ts
viewports_detected:
  - mobile
  - desktop
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: login

> **Relevamiento as-is** de `/login`, extraído de `src/app/(auth)/login/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.

## Identidad

- **Ruta:** `/login`
- **Archivo:** `src/app/(auth)/login/page.tsx`
- **Requiere auth:** no — es la única ruta pública con UI. `middleware.ts:30` la trata como caso
  especial
- **Audiencia:** no determinable desde el código
- **Propósito observado:** una pantalla de bienvenida con un único botón que inicia el flujo OIDC
  contra Zitadel. No pide credenciales: las pide el proveedor de identidad.
- **Viewports con tratamiento:** mobile, desktop — **sin media queries**; el layout es fluido y se
  adapta por `max-width` y centrado

## Entrada y salida

**Entradas:**
- Desde cualquier ruta protegida sin sesión válida · `middleware.ts:38-40`
- Tras un 401 en cualquier llamada de datos · `lib/axios.ts:31-36`
  (`window.location.href = '/login'`)
- Tras el logout · `useLogout.ts:4` (`signOut({callbackUrl:'/login'})`)

**Salidas:**
- Al proveedor de identidad (Zitadel) · click en "Iniciar sesión" · `login/page.tsx:14`
  (`signIn('zitadel', { callbackUrl: '/login/enter' })`)

**Redirects automáticos:**
- A `/` si ya hay sesión válida · `middleware.ts:33-35` — entrar a `/login` logueado rebota al
  inicio

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | fondo-arcos | `image` | decorativo | ambos | `<svg viewBox="0 0 1440 900">` inline | `login/page.tsx:20-102` |
| 2 | tarjeta-bienvenida | `section` | — | ambos | `<div className={styles.card}>` | `login/page.tsx:105` |
| 3 | logo-circular | `image` | — | ambos | `<Image src={logo}>` en `<div className={styles.logoWrap}>` | `login/page.tsx:107-109` |
| 4 | titulo | `heading` | h1 | ambos | `<h1 className={styles.title}>` | `login/page.tsx:111` |
| 5 | descripcion | `paragraph` | body | ambos | `<p className={styles.description}>` | `login/page.tsx:113-115` |
| 6 | flecha-descendente | `icon` | decorativo | ambos | `<svg>` inline, 24×32 | `login/page.tsx:118-132` |
| 7 | boton-ingresar | `button` | primary | ambos | `<button className={styles.loginBtn}>` | `login/page.tsx:134-136` |

> `fondo-arcos` y `tarjeta-bienvenida` se relevaron como `image` y `section`: el primero es un SVG
> decorativo de fondo (no un contenido), el segundo un contenedor de composición sin tipo propio en
> el diccionario. No es un `card` del diccionario: no tiene fondo, borde ni sombra — es un stack
> centrado.

## Layout observado por viewport

### todos los anchos

Sin media queries: **el layout es el mismo a cualquier ancho.** Se adapta por centrado y
`max-width`, no por breakpoint.

- fondo-arcos (capa absoluta, `inset: 0`, detrás de todo)
- tarjeta-bienvenida (centrada vertical y horizontalmente, `max-width: 480px`)
  - logo-circular
  - titulo
  - descripcion (`max-width: 360px`)
  - flecha-descendente
  - boton-ingresar

**Origen:** `login.module.scss:4-13` — `.loginPage { min-height:100vh; display:flex;
align-items:center; justify-content:center }` y `:30-40` — `.card { flex-direction:column;
align-items:center; max-width:480px; width:100%; padding:0 24px }`.

El `padding: 0 24px` de la tarjeta es lo que evita que el contenido toque los bordes en un
teléfono. Por debajo de 480px la tarjeta ocupa el ancho disponible menos ese padding.

El SVG de fondo usa `preserveAspectRatio="xMidYMid slice"` (`login/page.tsx:23`), así que recorta
en vez de deformarse: los arcos se ven distintos según la relación de aspecto, pero nunca
estirados.

## Contenido

### logo-circular
- Texto/label: sin texto
- Origen: `login/page.tsx:108`
- Icono: `src/assets/logo.png`, renderizado a 76×76 dentro de un círculo blanco de 120×120
  (`login.module.scss:43-52`)
- Annotation: lleva `priority` para que Next lo cargue sin lazy

### titulo
- Texto/label: "¡Bienvenido a OPUS!"
- Origen: `login/page.tsx:111` (hardcodeado, sin i18n)
- Annotation: 40px, peso 800, blanco (`login.module.scss:55-62`). **Es la única vez en toda la
  aplicación que la marca se escribe "OPUS" en mayúsculas** — en el sidebar y en el `<title>` es
  "Opus"

### descripcion
- Texto/label: "Seguí el avance de tu proyecto y conocé el estado de cada tarea al instante."
- Origen: `login/page.tsx:114`
- Annotation: **es la única declaración de propósito de producto en todo el código.** Usa voseo
  ("Seguí", "conocé") y dice "tarea", no "requisito"

### flecha-descendente
- Texto/label: sin texto
- Origen: `login/page.tsx:118-132`
- Icono: flecha hacia abajo dibujada a mano (línea + polilínea), 24×32
- Annotation: es puramente decorativa — apunta al botón. Sin animación

### boton-ingresar
- Texto/label: "Iniciar sesión" · en carga: "Cargando..."
- Origen: `login/page.tsx:135`
- Annotation: dispara `signIn('zitadel')`, que **navega fuera de la aplicación** al proveedor de
  identidad

## Estados presentes

### default
- Origen: `login/page.tsx:17-138`
- Todos los bloques visibles, botón habilitado con "Iniciar sesión"

### loading
- Mensaje: "Cargando..." (dentro del botón)
- Disparado por: `loading === true`, seteado en `handleLogin` antes de `signIn`
  (`login/page.tsx:13`)
- Origen: `login/page.tsx:134-136`
- Cambios: el botón cambia su texto y pasa a `disabled`. Nada más cambia
- Annotation: **el estado no se revierte nunca.** No hay `finally` ni `catch`: si `signIn` no
  navega, el botón queda deshabilitado con "Cargando..." de forma permanente

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| error de sistema | **`signIn` no tiene `.catch()`.** Si el proveedor no responde o la red falla, el botón queda en "Cargando..." deshabilitado, sin mensaje ni forma de reintentar sin recargar | `login/page.tsx:12-15` |
| error de validación | no aplica — la pantalla no tiene inputs. Las credenciales las pide Zitadel | — |
| empty | no aplica — no hay colección que pueda estar vacía | — |
| not found | no aplica | — |
| success | no aplica — el éxito es una navegación fuera de la aplicación | — |
| estado terminal / readonly | no aplica | — |
| permiso/acceso denegado | **no se maneja acá.** Un usuario que autentica pero no tiene permisos entra igual: `presentInApi` traga el error y `/projects` muestra "No tienes proyectos asignados" | `authApi.ts:24-31` |

**No se muestra el error de OIDC.** NextAuth devuelve los fallos del proveedor como
`?error=...` en la query string, y esta pantalla **no lee `searchParams`**: un
`AccessDenied` o un `Configuration` vuelven a la pantalla de bienvenida como si nada hubiera
pasado.

## Interacciones

**Eventos:**
- boton-ingresar · click → `setLoading(true)` y `signIn('zitadel', {callbackUrl:'/login/enter'})`
  · `login/page.tsx:12-15`

**Validaciones:**
- Ninguna: la pantalla no tiene campos.

**Feedback:**
- El botón cambia a "Cargando..." y se deshabilita · `login/page.tsx:134-136`
- No hay más feedback: el siguiente paso visible es la pantalla de Zitadel

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | **presente** — `alt="Opus"` en el logo | `login/page.tsx:108` |
| SVG decorativos | **ausente** — ni el fondo de arcos ni la flecha tienen `aria-hidden="true"` ni `role="presentation"`. Un lector de pantalla puede anunciarlos | `login/page.tsx:21-101`, `:119-131` |
| Encabezado de página | **presente** — un `<h1>` | `login/page.tsx:111` |
| Botón con texto | **presente** — texto visible, no solo ícono | `login/page.tsx:134` |
| Estado de carga anunciado | **ausente** — sin `aria-busy` ni `aria-live`. El cambio a "Cargando..." no se anuncia | `login/page.tsx:134` |
| Contraste del botón | no verificable desde el código sin renderizar | `login.module.scss:80+` |
| `lang` del documento | **incorrecto** — `<html lang="en">` con contenido en español | `app/layout.tsx:23` |

## Observaciones del relevamiento

- **La descripción es la única declaración de propósito de producto en el código.** "Seguí el
  avance de tu proyecto y conocé el estado de cada tarea al instante" es lo más cercano a un
  posicionamiento que existe en el repositorio del frontend. Vale llevarla a la entrevista de
  consolidación para confirmar si sigue vigente.

- **Vocabulario inconsistente en la propia pantalla.** El título dice "OPUS" (la marca es "Opus"
  en el resto) y la descripción dice "tarea" (la UI dice "requisito" en todas las pantallas
  vivas).

- **El SVG de fondo son ~80 líneas de JSX inline** — ocho elipses con opacidades entre 0.04 y 0.08
  y un gradiente `fadeToWhite`. Está escrito a mano en el componente, no importado como asset. Si
  el diseño cambia hay que editar el TSX.

- **El `loading` es irreversible.** Es el único estado de la pantalla y no tiene salida. A
  confirmar si importa: en el camino feliz `signIn` navega fuera enseguida y el usuario nunca ve
  el botón deshabilitado más de un instante.

- **El grupo `(auth)` tiene un layout que no hace nada visualmente:** `display: contents`
  (`(auth)/layout.module.scss:3-5`) no genera caja. Está para envolver el grupo, no para
  maquetar.

- No se pudo determinar cómo se ve la pantalla de credenciales: la sirve Zitadel, fuera de este
  repositorio.
