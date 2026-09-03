---
name: login
surface: web
route: /login
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.1"
date: 2026-09-02
---

# Pantalla: Login

## Identidad

- **Audiencia primaria:** equipo-interno. La pantalla está fuera del grupo `(loggedin)`, así que no requiere sesión [fuente: código-existente].
- **JTBD / Propósito:** un único botón que inicia el flujo OIDC contra el proveedor de identidad (Zitadel) [fuente: código-existente].
- **Viewports:**
  - **desktop** — único viewport. Sin tratamiento responsive: las dos mitades (`flex: 0 0 50%`) no cambian a ningún ancho.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- Redirect desde el shell `(loggedin)/layout.tsx:16` cuando no hay sesión [fuente: código-existente]
- Redirect desde el interceptor de axios ante un 401 · `src/lib/axios.ts:49`
- `callbackUrl` de `signOut` desde el Navbar · `Navbar.tsx:184` y desde `sin-permisos` · `unauthorized/page.tsx:21`

**Salidas user-driven:**
- Al proveedor de identidad (Zitadel) · click en `boton-iniciar-sesion` · `login/page.tsx:13` — `signIn('zitadel', { callbackUrl: '/login/enter' })` [fuente: código-existente]
- Tras autenticar, el proveedor devuelve a `/api/auth/callback/zitadel` y de ahí a `/login/enter`

**Salidas automáticas:**
- Ninguna. La pantalla no chequea si ya hay sesión: un usuario logueado que navegue a `/login` ve el formulario igual [fuente: código-existente].

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | panel-formulario | section | — | layout | desktop | todos los estados | Mitad izquierda: contiene título y botón |
| 2 | titulo-bienvenida | heading | h1 | content | desktop | todos los estados | Único texto de la pantalla |
| 3 | boton-iniciar-sesion | button | primary · default / loading | input | desktop | state_overrides: loading→spinner en lugar del texto | Dispara el flujo OIDC |
| 4 | spinner-carga | loader | — | feedback | desktop | visible_only_in_states: loading | Reemplaza el texto del botón mientras carga |
| 5 | panel-decorativo | image | — | content | desktop | todos los estados | Mitad derecha, imagen de fondo por CSS |

**Origen:** `login/layout.tsx:7`, `login/page.tsx:26`, `login/page.tsx:29-31`, `login/page.tsx:18`, `login/layout.tsx:8`, `login/styles.module.scss:89-97`

`panel-formulario` y `panel-decorativo` se relevaron como `section` e `image`: son las dos mitades del layout, y el derecho no tiene contenido — solo una imagen de fondo por CSS. El botón **no usa `<Button>`** del design system: es un `<button>` con estilos propios en `styles.module.scss:74-87` [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

- row `login` (`display: flex`, `width: 100vw`, `height: 100vh`)
  - col 6/12: panel-formulario
    - titulo-bienvenida
    - boton-iniciar-sesion
  - col 6/12: panel-decorativo

**Origen:** `login/styles.module.scss:1-16` y `:89-97`. Las fracciones son exactas (`flex: 0 0 50%` = 6/12 cada una) y no cambian a ningún ancho [fuente: código-existente].

## Contenido

### panel-formulario
- Texto/label: sin texto propio — es el contenedor de la mitad izquierda
- Icono: nada
- Asset: nada
- Annotation: `flex: 0 0 50%`, centrado en ambos ejes (`login/styles.module.scss:1-16`)

### titulo-bienvenida
- Texto/label: `"Bienvenido"`
- Icono: nada
- Asset: nada
- Annotation: hardcodeado sin i18n (`login/page.tsx:26`). El estilo lo pinta con `--color-general-primary` (`#FF3C3C`), no con el color de título habitual (`styles.module.scss:36`). **No hay ningún otro texto en la pantalla:** ni nombre de producto, ni subtítulo, ni explicación, ni mención del proveedor de identidad. El `.header` del SCSS tiene estilos para un `<p>` (`styles.module.scss:40-46`) que el JSX no renderiza [fuente: código-existente]

### boton-iniciar-sesion
- Texto/label: `"Iniciar sesión"`
- Icono: nada
- Asset: nada
- Annotation: es `type="submit"` dentro de un `<form>` sin `onSubmit`; el handler está en el `onClick` del botón y hace `event.preventDefault()`. Al hacer click setea `loading` y llama a `signIn` (`login/page.tsx:20`, `:10-14`) [fuente: código-existente]

### spinner-carga
- Texto/label: ninguno — el spinner **reemplaza** el texto del botón
- Icono: nada
- Asset: nada
- Annotation: `login/page.tsx:16-21`

### panel-decorativo
- Texto/label: sin texto
- Icono: nada
- Asset: `assets/loginBackground.png` como `background-image` con `background-size: cover`, mitad derecha de la pantalla, con `border-top-left-radius` y `border-bottom-left-radius` de 20px (`styles.module.scss:89-97`)
- Annotation: al ser CSS, la imagen no tiene `alt`: si comunica algo, no está disponible para lectores de pantalla [fuente: código-existente]

## Estados

### default
- Aplica: Sí
- Mensaje: `"Iniciar sesión"` en el botón
- Cambios: ninguno (estado base). Disparado por `loading === false` (`login/page.tsx:20`) [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: ninguno. El texto del botón se reemplaza por `<Spinner />`
- Cambios:
  - boton-iniciar-sesion: content=spinner (state_override). **El botón no se deshabilita**, así que se puede disparar `signIn` varias veces (`login/page.tsx:29-31`, sin `disabled`)
  - spinner-carga: solo visible en este estado (visible_only_in_states)
- Origen: `login/page.tsx:11-14`, `:16-21` [fuente: código-existente]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). La pantalla no tiene inputs.

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). Si `signIn` falla, `loading` queda en `true` para siempre: no hay `.catch()`, no hay `finally`, no existe `login/error.tsx`. El usuario queda mirando un spinner indefinido (`login/page.tsx:10-14`) [fuente: código-existente].

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El éxito es una navegación al proveedor.

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de autenticación devuelto por el proveedor
- Aplica: No — no implementado (ver gaps-as-is.md). Auth.js redirige a `/login?error=...` ante un fallo y la pantalla **no lee `searchParams`**: el usuario vuelve al mismo botón sin saber qué pasó. El SCSS tiene una clase `.error` (`styles.module.scss:99-104`) que el JSX nunca usa (`login/page.tsx:7-34`) [fuente: código-existente].

### ya autenticado
- Aplica: No — no implementado (ver gaps-as-is.md). `login/page.tsx` no llama a `auth()` ni a `useSession()` [fuente: código-existente].

## Interacciones

**Eventos:**
- boton-iniciar-sesion · on click → `preventDefault()`, `setLoading(true)`, `signIn('zitadel', { callbackUrl: '/login/enter' })` · `login/page.tsx:10-14` [fuente: código-existente]

**Validaciones:**
- Ninguna: la pantalla no tiene inputs validados.

**Feedback:**
- Único feedback: el spinner dentro del botón (`login/page.tsx:16-21`). Sin toast, sin mensaje de error, sin deshabilitado [fuente: código-existente].

## Accesibilidad

- **Orden de foco:** boton-iniciar-sesion es el único elemento enfocable de la pantalla [fuente: código-existente].
- **Landmarks y jerarquía:** `<form>` + `<header>` + `<h1>` (titulo-bienvenida), un solo h1. **El landmark `main` está ausente:** el layout de `/login` no tiene `<main>` (`login/layout.tsx:4-11`) [fuente: código-existente].
- **Foco y teclado:** la pantalla no dispara overlays, así que no introduce focus traps. El botón no aplica ningún mixin de `focus-ring`; queda el outline por defecto del navegador (`styles.module.scss:74-87`) [fuente: código-existente].
- **Propio de esta composición:** en estado `loading` el botón **queda sin nombre accesible**, porque su texto se reemplaza por el `<Spinner />`, que no tiene label, y no emite `aria-busy` — al usar un `<button>` propio en vez del `<Button>` compartido, que sí lo emite (`login/page.tsx:16-21` vs `Button.tsx:48`). El `<html>` declara `lang="en"` con todo el contenido en español (`app/layout.tsx:19`); se registra acá por ser la primera pantalla que ve el usuario [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.
- **[REQ-013] La identidad cambia; la pantalla, no.** Esta ficha documenta *qué* hay en la pantalla y *para qué* está; el Manual de marca Jiku v1.0 cambia **con qué está construido**. El accent pasa del magenta `#DA2C6A` al verde agua `#61CCB9` sobre azul oscuro `#0B1934` con fondo niebla `#F6F6F9`, y Archivo se reemplaza por Sora (títulos de vista) + Gabarito (interfaz, datos, microcopy). Ningún bloque de esta pantalla se agrega, se elimina ni cambia de propósito por ese motivo [REQ-013 RF-1, RF-2, CA-1].
- **[REQ-013] Cada elemento hecho a mano pasa a su componente del Design System.** Los bloques que esta ficha declara —botones, campos, selects, tarjetas, tablas, badges— se implementan con los componentes normativos de `docs/design-system/web/components/`, no con marcado propio. Es un cambio de implementación con consecuencia visible —dejan de haber dos botones que se ven distinto haciendo lo mismo— pero **no cambia la estructura declarada acá**: un bloque que ya existía sigue existiendo, con el mismo tipo y el mismo propósito [REQ-013 RF-3, RF-4, CA-5, CA-10].
- **[REQ-013] Los estados declarados en esta ficha se conservan.** La migración es de presentación: ningún estado se agrega, se quita ni cambia su condición de disparo. Lo que cambia es cómo se ve cada uno —el loader es ahora uno solo, el vacío tiene componente `EmptyState` disponible— sin que la ficha declare estados nuevos. **Cablear `EmptyState` en las pantallas que hoy no tienen estado vacío queda fuera de este REQ** y sigue registrado en `gaps-as-is.md` [REQ-013 §Fuera de Alcance].
- **[REQ-013] `desktop` sigue siendo el viewport único.** El requerimiento **no** habilita mobile: el DS mantiene el responsive del shell como objetivo declarado sin fecha y no declara el viewport `mobile` hasta que el shell lo cumpla. El layout por viewport de esta ficha no cambia [REQ-013 §Fuera de Alcance, CA-15].
- **[REQ-013] El botón deja de ser un `<button>` con estilos propios.** Esta ficha registra que `boton-iniciar-sesion` no usa el componente compartido, y que por eso en estado `loading` queda sin nombre accesible y sin `aria-busy`. Al migrarlo al `Button` del DS —variant `session`, el que el spec define justamente para la entrada al sistema— el defecto de accesibilidad se cierra de paso: el componente emite `aria-busy` y conserva su nombre mientras carga. **El comportamiento no cambia:** sigue disparando el flujo OIDC, y que el botón no se deshabilite al cargar es un defecto aparte, registrado en `gaps-as-is.md`, que este REQ no resuelve [REQ-013 RF-4, CA-10].
- **[REQ-013] El logo del manual entra donde hoy no hay ninguno.** La pantalla no muestra hoy ni nombre de producto ni logotipo: el único texto es `"Bienvenido"`, pintado con `--color-general-primary` (`#FF3C3C`), un color que la tabla de mapeo del DS manda al verde agua. Con la identidad nueva la firma Jiku aparece acá, con el SVG correspondiente al modo y respetando el área de resguardo que especifica `foundations/logo.md`. Es la primera pantalla que ve el usuario y hasta acá no decía de qué producto es [REQ-013 RF-1, CA-4].
