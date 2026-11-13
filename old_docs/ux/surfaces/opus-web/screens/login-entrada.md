---
name: login-entrada
surface: opus-web
route: /login/enter
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

# Pantalla: Login entrada

> **Esta pantalla no tiene interfaz.** Es un server component de siete líneas que ejecuta un efecto y redirige. Se documenta igual porque es un paso obligado del flujo de entrada y porque lo que hace —o deja de hacer— tiene consecuencias visibles en las pantallas siguientes [fuente: código-existente].

## Identidad

- **Audiencia primaria:**
  - [cliente](../../../audiences/cliente/research-context.md) — la audiencia no es determinable desde el código; se transcribe la declarada para la superficie [fuente: código-existente].
- **JTBD / Propósito:** Redirigir al inicio tras el login OIDC. Es el `callbackUrl` que `/login` le pasa a `signIn`. **Desde REQ-007 ya no da de alta a nadie**: el alta la resuelve `core` al espejar la identidad del comando, así que `POST /api/auth/present` sigue siendo un no-op pero **perdió su razón de ser** (CA-9, CA-11, CA-12).
- **Viewports:**
  - **mobile** — la ruta existe y se atraviesa en mobile, pero **no renderiza nada**: no hay tratamiento por viewport porque no hay DOM.
  - **desktop** — ídem: se atraviesa sin pintar nada.
  - El relevamiento registra `viewports_detected: []` — el componente no devuelve JSX. Se declaran los dos viewports porque la ruta es parte del flujo en ambos, no porque exista una composición distinta en cada uno.

## Entrada y salida

**Entradas:**
- Desde el callback de Zitadel, tras autenticar · `login/page.tsx:14` — `signIn('zitadel', { callbackUrl: '/login/enter' })` [fuente: código-existente]

**Salidas user-driven:**
- Ninguna: no hay elementos interactivos.

**Salidas automáticas:**
- A `/` · siempre, sin condición, tanto si el alta funcionó como si falló · `login/enter/page.tsx:6`
- Y desde `/`, la cadena sigue: a `/projects` si hay sesión, a `/login` si no · `app/page.tsx:7-11`
- Y desde `/projects`, al primer proyecto por orden alfabético · `projects/page.tsx:20-25`

**La cadena completa de entrada son cuatro redirecciones:**

```
Zitadel → /login/enter → / → /projects → /projects/{primerId}/requirements?view=list
```

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| — | — | — | — | — | — | — | **ninguno** — el componente no devuelve JSX |

**Origen:** `src/app/(auth)/login/enter/page.tsx:4-7`, `src/features/auth/services/authApi.ts`, `src/app/(auth)/layout.tsx` [fuente: código-existente].

No hay bloques que documentar. La función `redirect()` de Next lanza una excepción de control antes de que haya nada que renderizar.

## Layout por viewport

### mobile · 390px

Sin layout: la pantalla no pinta nada. El usuario ve el estado de transición del navegador entre la respuesta de Zitadel y la primera pantalla real.

**Origen:** `login/enter/page.tsx:4-7` — el componente no tiene `return` de JSX [fuente: código-existente].

### desktop · 1440px

Sin layout: idéntico al anterior — la pantalla no pinta nada.

**Origen:** `login/enter/page.tsx:4-7` [fuente: código-existente].

## Contenido

Ninguno. **No hay microcopy en esta pantalla** [fuente: código-existente].

Lo único que un usuario podría llegar a percibir es el tiempo de espera: `presentInApi()` es un `POST` a la api con un `timeout` de 10 s (`lib/axios.ts:17`), y la redirección no ocurre hasta que esa promesa se resuelve o falla.

## Estados

### default
- Aplica: Sí
- Mensaje: ninguno
- Cambios: ejecuta `presentInApi()` y redirige a `/` · `login/enter/page.tsx:4-7` [fuente: código-existente]

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: No — no implementado (ver gaps-as-is.md). No hay ninguna indicación de progreso: es un server component sin `loading.tsx` en la ruta, así que durante el `POST` (hasta 10 s de timeout) el navegador queda mostrando la pantalla anterior sin señal de actividad (`login/enter/page.tsx:5`; no existe `app/(auth)/login/enter/loading.tsx`)

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md)

### error de sistema / sin conexión
- Aplica: No — no implementado (ver gaps-as-is.md). El error se captura y no se muestra: `presentInApi` hace `console.warn` y devuelve `null`; la redirección ocurre igual (`authApi.ts:24-31`). El código registra que ese tragado es deliberado y corrige un bug anterior en el que la pantalla quedaba en blanco bloqueando el ingreso (`authApi.ts:26-28`)
- **Precisión con REQ-007:** el tragado **dejó de tener consecuencia aguas abajo**. Hasta acá, un `presentInApi` fallido dejaba al usuario sin fila en `users` y el problema reaparecía en la primera pantalla que pidiera datos, como 401 `user_not_found`. Ese 401 ya no existe en ninguna ruta de la api (CA-12), así que la llamada puede fallar entera y el cliente entra igual y opera igual. El estado sigue sin implementarse, y ahora **es correcto que siga así**: no hay nada que informarle al usuario

### success
- Aplica: No — no implementado (ver gaps-as-is.md)

### not found
- Aplica: No — no implementado (ver gaps-as-is.md). No hay `not-found.tsx` en ninguna ruta

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

## Interacciones

**Eventos:**
- Ninguno: no hay elementos interactivos [fuente: código-existente].

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno visible. El único efecto observable es la navegación.

Comportamiento de `presentInApi` (`authApi.ts:5-32`), que es todo lo que esta pantalla hace:

1. Lee la sesión con `auth()`.
2. Si no hay sesión o no hay `accessToken`: `console.warn('presentInApi: sin sesión ni access token')` y devuelve `null` sin llamar a la api.
3. Si la hay: `POST /api/auth/present` con `Authorization: Bearer {accessToken}` y cuerpo vacío, usando `apiClientBase`.
4. Si falla: `console.warn` y `null`.

## Accesibilidad

- **Orden de foco:** no aplica — no hay elementos interactivos ni DOM propio [fuente: código-existente].
- **Landmarks y jerarquía:** ninguno — la pantalla no renderiza nada. El grupo `(auth)` tampoco aporta caja (`display: contents`).
- **Foco y teclado:** el foco tras la redirección no lo maneja esta pantalla: lo resuelve la navegación del navegador.
- **Propio de esta composición:** la transición **no se anuncia** — sin `aria-live` ni contenido, un lector de pantalla no tiene nada que anunciar durante la espera (`login/enter/page.tsx`). Sin DOM no hay superficie accesible que evaluar.

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-007 — `jiku-commands` para personas (2026-08-25)

- **No cambia ningún bloque, y la revisión sirvió igual.** Esta pantalla existía para dar de alta al usuario y evitar un 401 que ya no existe. Se corrigió el propósito declarado en vez de dejar un JTBD que describe un trabajo que la pantalla ya no hace.
- **Se descartó proponer eliminar la ruta.** Que `POST /api/auth/present` haya perdido su razón de ser es un hallazgo técnico del REQ, no una decisión de UX: la cadena de cuatro redirecciones del login es la misma y el usuario no percibe la diferencia. Si la ruta se borra, es un cambio de `opus-web` y de la api, fuera del alcance de esta revisión.
- **Sin cambios en el Design System.** El delta no introduce ningún tipo de bloque en esta pantalla — no introduce ninguno en absoluto.
