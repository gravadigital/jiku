---
name: login
surface: opus-web
route: /login
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

# Pantalla: Login

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** El usuario inicia el flujo de autenticación OIDC contra Zitadel desde una pantalla de bienvenida con un único botón. No ingresa credenciales acá: las pide el proveedor de identidad.
- **Viewports:**
  - **mobile** — el layout es el mismo a cualquier ancho; el `padding: 0 24px` de la tarjeta evita que el contenido toque los bordes en un teléfono.
  - **desktop** — misma composición centrada, con la tarjeta limitada a `max-width: 480px`.
  - La pantalla **no tiene media queries**: el layout se adapta por centrado y `max-width`, no por breakpoint. Se declaran los dos viewports porque la pantalla existe y es usable en ambos, no porque haya tratamiento diferenciado.
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Desde cualquier ruta protegida sin sesión válida · `middleware.ts:38-40` [fuente: código-existente]
- Tras un 401 en cualquier llamada de datos · `lib/axios.ts:31-36` (`window.location.href = '/login'`)
- Tras el logout · `useLogout.ts:4` (`signOut({callbackUrl:'/login'})`)

**Salidas user-driven:**
- Al proveedor de identidad (Zitadel) · click en "Iniciar sesión" · `login/page.tsx:14` (`signIn('zitadel', { callbackUrl: '/login/enter' })`)

**Salidas automáticas:**
- A `/` si ya hay sesión válida · `middleware.ts:33-35` — entrar a `/login` logueado rebota al inicio.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | fondo-arcos | image | decorativo | content | ambos | — | SVG decorativo de fondo, capa absoluta detrás de todo |
| 2 | tarjeta-bienvenida | section | — | layout | ambos | — | Contenedor de composición centrado vertical y horizontalmente |
| 3 | logo-circular | image | — | content | ambos | — | Identidad de marca |
| 4 | titulo | heading | h1 | content | ambos | — | Bienvenida |
| 5 | descripcion | paragraph | body | content | ambos | — | Declaración de propósito de producto |
| 6 | flecha-descendente | icon | decorativo | content | ambos | — | Apunta al botón |
| 7 | boton-ingresar | button | primary | input | ambos | state_overrides: loading→disabled | Dispara el flujo OIDC |

**Origen:** `src/app/(auth)/login/page.tsx:20-136`, `src/app/(auth)/login/login.module.scss`, `src/app/(auth)/layout.tsx`, `src/middleware.ts` [fuente: código-existente].

Notas de tipificación del relevamiento: `fondo-arcos` y `tarjeta-bienvenida` se relevaron como `image` y `section` — el primero es un SVG decorativo de fondo (no un contenido), el segundo un contenedor de composición sin tipo propio en el diccionario. No es un `card` del diccionario: no tiene fondo, borde ni sombra — es un stack centrado.

## Layout por viewport

### mobile · 390px

- fondo-arcos *(capa absoluta, `inset: 0`, detrás de todo)*
- tarjeta-bienvenida *(centrada vertical y horizontalmente, `max-width: 480px`)*
  - logo-circular
  - titulo
  - descripcion *(`max-width: 360px`)*
  - flecha-descendente
  - boton-ingresar

**Origen:** `login.module.scss:4-13` — `.loginPage { min-height:100vh; display:flex; align-items:center; justify-content:center }` y `:30-40` — `.card { flex-direction:column; align-items:center; max-width:480px; width:100%; padding:0 24px }` [fuente: código-existente].

Por debajo de 480px la tarjeta ocupa el ancho disponible menos el `padding: 0 24px`. El SVG de fondo usa `preserveAspectRatio="xMidYMid slice"` (`login/page.tsx:23`), así que recorta en vez de deformarse.

**Las fracciones de columna no son derivables del código:** la pantalla no tiene grilla ni media queries; es un stack centrado con `max-width`.

### desktop · 1440px

Misma composición: **sin media queries, el layout es el mismo a cualquier ancho.** Stack vertical en el orden de Estructura, centrado en los dos ejes, con la tarjeta a `max-width: 480px` sobre el fondo de arcos.

**Origen:** `login.module.scss:4-13`, `:30-40` [fuente: código-existente].

**Las fracciones de columna no son derivables del código:** no hay grilla declarada.

## Contenido

### fondo-arcos
- Texto/label: sin texto
- Icono: nada
- Asset: SVG inline `viewBox="0 0 1440 900"` — ocho elipses con opacidades entre 0.04 y 0.08 y un gradiente `fadeToWhite`, escrito a mano en el JSX (`login/page.tsx:20-102`)
- Annotation: `preserveAspectRatio="xMidYMid slice"` — recorta en vez de deformarse. No está importado como asset: si el diseño cambia hay que editar el TSX

### tarjeta-bienvenida
- Texto/label: sin texto propio
- Icono: nada
- Asset: nada
- Annotation: contenedor sin fondo, borde ni sombra — es un stack centrado con `max-width: 480px` y `padding: 0 24px`

### logo-circular
- Texto/label: sin texto · `alt="Opus"`
- Icono: nada
- Asset: `src/assets/logo.png`, renderizado a 76×76 dentro de un círculo blanco de 120×120 (`login.module.scss:43-52`)
- Annotation: lleva `priority` para que Next lo cargue sin lazy

### titulo
- Texto/label: "¡Bienvenido a OPUS!"
- Icono: nada
- Asset: nada
- Annotation: hardcodeado, sin i18n (`login/page.tsx:111`). 40px, peso 800, blanco. Es la única vez en toda la aplicación que la marca se escribe "OPUS" en mayúsculas — en el sidebar y en el `<title>` es "Opus"

### descripcion
- Texto/label: "Seguí el avance de tu proyecto y conocé el estado de cada tarea al instante."
- Icono: nada
- Asset: nada
- Annotation: es la única declaración de propósito de producto en todo el código. Usa voseo ("Seguí", "conocé") y dice "tarea", no "requisito"

### flecha-descendente
- Texto/label: sin texto
- Icono: flecha hacia abajo dibujada a mano (línea + polilínea), 24×32, SVG inline
- Asset: nada
- Annotation: puramente decorativa — apunta al botón. Sin animación

### boton-ingresar
- Texto/label: "Iniciar sesión" · en carga: "Cargando..."
- Icono: nada
- Asset: nada
- Annotation: dispara `signIn('zitadel', {callbackUrl:'/login/enter'})`, que navega fuera de la aplicación al proveedor de identidad

## Estados

### default
- Aplica: Sí
- Mensaje: —
- Cambios: ninguno (estado base). Todos los bloques visibles, botón habilitado con "Iniciar sesión" · `login/page.tsx:17-138` [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: "Cargando..." (dentro del botón)
- Cambios:
  - boton-ingresar: content="Cargando...", variant=disabled (state_override) · `login/page.tsx:134-136`
  - Nada más cambia
- Annotation: el estado **no se revierte nunca**. No hay `finally` ni `catch`: si `signIn` no navega, el botón queda deshabilitado con "Cargando..." de forma permanente (`login/page.tsx:12-15`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). `signIn` no tiene `.catch()`: si el proveedor no responde o la red falla, el botón queda en "Cargando..." deshabilitado, sin mensaje ni forma de reintentar sin recargar (`login/page.tsx:12-15`). Tampoco se leen los `?error=...` que NextAuth devuelve del proveedor: la pantalla no lee `searchParams`

### success
- Aplica: No — no implementado (ver gaps-as-is.md)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). No hay `not-found.tsx` en ninguna ruta

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:**
- boton-ingresar · on click → `setLoading(true)` y `signIn('zitadel', {callbackUrl:'/login/enter'})` · `login/page.tsx:12-15` [fuente: código-existente]

**Validaciones:**
- Ninguna: la pantalla no tiene campos. Las credenciales las pide Zitadel.

**Feedback:**
- El botón cambia a "Cargando..." y se deshabilita · `login/page.tsx:134-136`
- No hay más feedback: el siguiente paso visible es la pantalla de Zitadel, fuera de este repositorio.

## Accesibilidad

- **Orden de foco:** boton-ingresar es el único elemento interactivo de la composición [fuente: código-existente].
- **Landmarks y jerarquía:** un solo `<h1>` (titulo) · `login/page.tsx:111`. El grupo `(auth)` no aporta landmarks: su layout es un `<div>` con `display: contents` que no genera caja (`(auth)/layout.module.scss:3-5`).
- **Foco y teclado:** la pantalla no monta overlays; no hay trampas de foco ni atajos propios.
- **Propio de esta composición:**
  - Los dos SVG decorativos —fondo-arcos y flecha-descendente— **no tienen `aria-hidden="true"` ni `role="presentation"`**: un lector de pantalla puede anunciarlos (`login/page.tsx:21-101`, `:119-131`).
  - El cambio a "Cargando..." **no se anuncia**: sin `aria-busy` ni `aria-live` (`login/page.tsx:134`).
  - El documento declara `<html lang="en">` con contenido en español (`app/layout.tsx:23`).
  - El logo sí tiene `alt="Opus"` (`login/page.tsx:108`) y el botón tiene texto visible, no solo ícono.

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
