---
document: UX Survey Screen
screen: login
route: /login
service: web
source_files:
  - src/app/login/page.tsx
  - src/app/login/layout.tsx
  - src/app/login/styles.module.scss
  - src/shared/components/ui/Spinner/Spinner.tsx
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: login

> **Relevamiento as-is** de `/login`, extraído de `src/app/login/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.

## Identidad

- **Ruta:** `/login`
- **Archivo:** `src/app/login/page.tsx` (`'use client'`), con layout propio en `src/app/login/layout.tsx`
- **Requiere auth:** no — está fuera del grupo `(loggedin)`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** un único botón que inicia el flujo OIDC contra el proveedor de identidad.
- **Viewports con tratamiento:** ninguno. Sin tratamiento responsive.

## Entrada y salida

**Entradas:**
- Redirect desde `(loggedin)/layout.tsx:16` cuando no hay sesión.
- Redirect desde el interceptor de axios ante un 401 · `src/lib/axios.ts:49`.
- `callbackUrl` de `signOut` desde el Navbar · `Navbar.tsx:184` y desde `sin-permisos` ·
  `unauthorized/page.tsx:21`.

**Salidas:**
- Al proveedor de identidad (Zitadel) · disparado por `boton-iniciar-sesion` ·
  `login/page.tsx:13` — `signIn('zitadel', { callbackUrl: '/login/enter' })`
- Tras autenticar, el proveedor devuelve a `/api/auth/callback/zitadel` y de ahí a `/login/enter`.

**Redirects automáticos:**
- Ninguno. **La pantalla no chequea si ya hay sesión:** un usuario logueado que navegue a `/login`
  ve el formulario igual.

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | panel-formulario | `section` | — | ambos | `<div className={styles.left}>` | `login/layout.tsx:7` |
| 2 | titulo-bienvenida | `heading` | h1 | ambos | `<h1 className={styles.loginTitle}>` | `login/page.tsx:26` |
| 3 | boton-iniciar-sesion | `button` | primary · default / loading | ambos | `<button type="submit">` | `login/page.tsx:29-31` |
| 4 | spinner-carga | `loader` | — | ambos | `<Spinner>` dentro del botón | `login/page.tsx:18` |
| 5 | panel-decorativo | `image` | — | ambos | `<div className={styles.right}>` con `background-image` | `login/layout.tsx:8`, `styles.module.scss:89-97` |

> `panel-formulario` y `panel-decorativo` se relevaron como `section` e `image`: son los dos mitades
> del layout, y el derecho no tiene contenido — solo una imagen de fondo por CSS.

> **El botón no usa `<Button>`** del design system: es un `<button>` con estilos propios en
> `styles.module.scss:74-87`.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive: el layout es el mismo a cualquier ancho.

- row `login` (`display: flex`, `width: 100vw`, `height: 100vh`)
  - col 6/12: panel-formulario
    - titulo-bienvenida
    - boton-iniciar-sesion
  - col 6/12: panel-decorativo

**Origen:** `login/styles.module.scss:1-16` y `:89-97`:

```scss
.container { display: flex; width: 100vw; height: 100vh; }
.left  { flex: 0 0 50%; align-items: center; justify-content: center; }
.right { flex: 0 0 50%; background-image: url('../../assets/loginBackground.png');
         background-size: cover; border-top-left-radius: 20px; border-bottom-left-radius: 20px; }
```

Las fracciones son exactas (`flex: 0 0 50%` = 6/12 cada una) y **no cambian a ningún ancho**. A
400px de viewport el panel del formulario mide 200px y el botón, que es `width: 100%` del
`.formContainer`, se encoge con él.

## Contenido

### titulo-bienvenida
- Texto/label: `"Bienvenido"`
- Origen: `login/page.tsx:26` (hardcodeado, sin i18n)
- Annotation: el estilo lo pinta con `--color-general-primary` (`#FF3C3C`), no con el color de
  título habitual · `styles.module.scss:36`

> **No hay ningún otro texto en la pantalla.** No hay nombre de producto, ni subtítulo, ni
> explicación de qué se está por hacer, ni mención del proveedor de identidad. El `.header` del
> SCSS tiene estilos para un `<p>` (`styles.module.scss:40-46`) que el JSX no renderiza.

### boton-iniciar-sesion
- Texto/label: `"Iniciar sesión"`
- Origen: `login/page.tsx:20`
- Icono: ninguno
- Annotation: es `type="submit"` dentro de un `<form>` sin `onSubmit`; el handler está en el
  `onClick` del botón y hace `event.preventDefault()`. Al hacer click setea `loading` y llama a
  `signIn`.

### spinner-carga
- Texto/label: ninguno — el spinner **reemplaza** el texto del botón
- Origen: `login/page.tsx:16-21`

## Estados presentes

### default
- Mensaje: `"Iniciar sesión"` en el botón
- Disparado por: `loading === false`
- Origen: `login/page.tsx:20`

### loading
- Mensaje: ninguno. El texto del botón se reemplaza por `<Spinner />`
- Disparado por: `setLoading(true)` en el click, antes de `signIn`
- Origen: `login/page.tsx:11-14`, `:16-21`
- Cambios: solo el contenido del botón. **El botón no se deshabilita**

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| empty | no aplica: no hay datos que listar | — |
| error de validación | no aplica: no hay inputs | — |
| error de sistema / sin conexión | **si `signIn` falla, `loading` queda en `true` para siempre.** No hay `.catch()`, no hay `finally`, no hay `error.tsx` en `/login`. El usuario queda mirando un spinner indefinido | `login/page.tsx:10-14`; no existe `login/error.tsx` |
| error de autenticación devuelto por el proveedor | **no se muestra.** Auth.js redirige a `/login?error=...` ante un fallo, y la pantalla **no lee `searchParams`**: el usuario vuelve al mismo botón sin saber qué pasó. El SCSS tiene una clase `.error` (`styles.module.scss:99-104`) que el JSX nunca usa | `login/page.tsx:7-34` |
| success | no aplica: el éxito es una navegación al proveedor | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |
| ya autenticado | **no se detecta.** Un usuario con sesión válida que navegue a `/login` ve el botón; al hacer click, el proveedor lo devuelve autenticado sin pedirle nada | `login/page.tsx` no llama a `auth()` ni a `useSession()` |
| doble click | **el botón no se deshabilita al entrar en loading**, así que se puede disparar `signIn` varias veces | `login/page.tsx:29-31` — sin `disabled` |

## Interacciones

**Eventos:**
- boton-iniciar-sesion · click → `preventDefault()`, `setLoading(true)`,
  `signIn('zitadel', { callbackUrl: '/login/enter' })` · `login/page.tsx:10-14`

**Validaciones:**
- Ninguna: la pantalla no tiene inputs validados.

**Feedback:**
- Único feedback: el spinner dentro del botón · `login/page.tsx:16-21`
- Sin toast, sin mensaje de error, sin deshabilitado.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | No aplica: la única imagen es un `background-image` decorativo en CSS | `styles.module.scss:92` |
| Nombre accesible del botón | Presente en estado default (`"Iniciar sesión"` como texto) | `login/page.tsx:20` |
| Nombre accesible en loading | **ausente:** el texto se reemplaza por el `<Spinner />`, que no tiene label. El botón queda sin nombre accesible mientras carga | `login/page.tsx:16-21` |
| `aria-busy` en loading | **ausente.** El `<Button>` compartido sí lo emite, pero esta pantalla usa un `<button>` propio | `login/page.tsx:29-31` vs `Button.tsx:48` |
| Estructura semántica | `<form>` + `<header>` + `<h1>`. Hay un `<h1>` y es el título | `login/page.tsx:24-27` |
| Landmark `main` | **ausente:** el layout de `/login` no tiene `<main>` | `login/layout.tsx:4-11` |
| Focus visible | El botón no aplica ningún mixin de `focus-ring`; queda el outline del navegador | `styles.module.scss:74-87` |
| `lang` del documento | **`lang="en"`** en el `<html>`, con todo el contenido en español | `app/layout.tsx:19` |
| Contraste | No verificado. `--color-general-primary` `#FF3C3C` sobre blanco para el `h1`, y blanco sobre `#FF3C3C` para el botón | `styles.module.scss:36`, `:80,85` |

## Observaciones del relevamiento

- **La pantalla tiene estilos para elementos que no renderiza.** `styles.module.scss` define
  `.inputSection`, `.inputBox` (con estilos de `input`, `:focus` y `::placeholder`) y `.error`
  (`líneas 24-72`, `99-104`). El JSX solo usa `.formContainer`, `.header`, `.loginTitle` y
  `.buttonBox`. Sugiere que antes había login con usuario y contraseña, pero **el código no lo dice**
  y no se puede confirmar desde acá.
- **El `alt` de la imagen de fondo no existe** porque es CSS. Si esa imagen comunica algo, no está
  disponible para lectores de pantalla — no se puede determinar qué muestra sin abrir el archivo
  `assets/loginBackground.png`.
- **`lang="en"` en un producto íntegramente en español** es global (`app/layout.tsx:19`), no de esta
  pantalla, pero se registra acá porque es la primera que ve el usuario.
- **A confirmar en consolidación:** si `"Bienvenido"` sin más contexto es intencional, y si hace
  falta comunicar el error de autenticación (hoy vuelve silenciosamente al botón).
- El flujo termina en `/login/enter`, que redirige a `/` — y `/` es la pantalla vacía. Ver
  [home-vacia.md](./home-vacia.md).
