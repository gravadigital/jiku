---
document: UX Survey Screen
screen: login-entrada
route: /login/enter
service: web
source_files:
  - src/app/login/enter/page.tsx
  - src/app/login/enter/loading.tsx
  - src/app/login/enter/error.tsx
  - src/features/auth/services/authApi.ts
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: login-entrada

> **Relevamiento as-is** de `/login/enter`, extraído de `src/app/login/enter/page.tsx`.
> Describe lo que el código hace hoy, no lo que debería hacer.

## Identidad

- **Ruta:** `/login/enter`
- **Archivo:** `src/app/login/enter/page.tsx` (Server Component, `dynamic = 'force-dynamic'`)
- **Requiere auth:** no declarado — está fuera de `(loggedin)`. En la práctica solo se llega acá
  con sesión, porque es el `callbackUrl` de `signIn`
- **Audiencia:** no determinable desde el código
- **Propósito observado:** pantalla de tránsito. Llama a `POST /auth/present` en la api y redirige.
  No tiene UI propia.
- **Viewports con tratamiento:** no aplica — no renderiza nada.

## Entrada y salida

**Entradas:**
- `callbackUrl` de `signIn` en la pantalla de login · `login/page.tsx:13`

**Salidas:**
- `/` · siempre, sin condición · `login/enter/page.tsx:8` — `redirect('/')`

**Redirects automáticos:**
- `/` incondicional, después de `await presentInApi()` · `login/enter/page.tsx:7-8`

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| 1 | (ninguno) | — | — | — | la página no devuelve JSX: hace `redirect()` | `login/enter/page.tsx:6-9` |
| 2 | cargando-entrada | `loader` | — | ambos | `<Loader label="Cargando...">` | `login/enter/loading.tsx:5` |
| 3 | titulo-error | `heading` | h1 | ambos | `<h1>Error</h1>` | `login/enter/error.tsx:8` |
| 4 | mensaje-error | `paragraph` | body | ambos | `<p>{error.message}</p>` | `login/enter/error.tsx:9` |

La pantalla tiene **cero bloques en el happy path**. Los tres bloques listados pertenecen a los
archivos `loading.tsx` y `error.tsx` de la ruta.

## Layout observado por viewport

### todos los anchos

Sin tratamiento responsive. No hay layout: en el happy path no se renderiza nada antes del
redirect.

**Durante la carga** (`loading.tsx`): solo `cargando-entrada`, centrado por
`Loader.module.scss`. **Sin el shell de `(loggedin)` y sin el layout de `/login`** — el layout de
`login/layout.tsx` sí aplica, porque `enter/` está dentro de `login/`, así que el `<Loader>` se
renderiza en el panel izquierdo (50% del ancho) con el panel decorativo al lado.

**En error** (`error.tsx`): `titulo-error` y `mensaje-error`, también dentro del layout partido de
`/login`, sin estilos propios (elementos `h1` y `p` desnudos, con los estilos globales de
`globals.scss:189-201`).

**Origen:** `login/layout.tsx:4-11` — el layout de `/login` envuelve también esta subruta.

## Contenido

### cargando-entrada
- Texto/label: `"Cargando..."`
- Origen: `login/enter/loading.tsx:5`

### titulo-error
- Texto/label: `"Error"`
- Origen: `login/enter/error.tsx:8`

### mensaje-error
- Texto/label: dinámico desde `error.message` — no hay copy fijo en el código
- Origen: `login/enter/error.tsx:9`
- Annotation: el tipo es `CustomError` de `@/shared/types`. Se muestra el mensaje crudo de la
  excepción.

## Estados presentes

### loading
- Mensaje: `"Cargando..."`
- Disparado por: el `loading.tsx` de la ruta mientras el Server Component resuelve
  `await presentInApi()`
- Origen: `login/enter/loading.tsx`
- Cambios: es todo lo que se ve

### error de sistema
- Mensaje: dinámico, `error.message`
- Disparado por: una excepción no atrapada en el render del Server Component
- Origen: `login/enter/error.tsx:5-11`
- Cambios: reemplaza la pantalla por título y mensaje

> **En la práctica este boundary casi no se dispara**, porque el único trabajo de la página está
> envuelto en su propio `try/catch`:
> ```ts
> // authApi.ts:17-21
> try { await apiClient.post('/auth/present', {}); }
> catch (error) { console.warn('Failed to present in API, but continuing:', error); }
> ```

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| default | **no existe:** la página nunca renderiza contenido propio, siempre redirige | `login/enter/page.tsx:6-9` |
| empty | no aplica | — |
| error de validación | no aplica: no hay inputs | — |
| fallo de `POST /auth/present` | **invisible.** Se traga con `console.warn` y el flujo continúa al redirect. Un usuario que no quedó registrado en la api entra igual, y recién falla en la primera pantalla que pida datos (401 → el interceptor lo devuelve a `/login`) | `authApi.ts:19-21`, `axios.ts:46-51` |
| success | no aplica: el éxito es el redirect | — |
| not found | no aplica | — |
| estado terminal / readonly | no aplica | — |

## Interacciones

**Eventos:**
- Ninguno. La pantalla no tiene controles.

**Validaciones:**
- Ninguna.

**Feedback:**
- Solo el `loading.tsx` mientras resuelve · `login/enter/loading.tsx`
- El error de la api no produce ningún feedback visible.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Alt en imágenes | El `<Loader>` tiene `alt="loader"` en su `<Image>` — es texto descriptivo de un elemento decorativo, debería ser `alt=""` | `Loader.tsx:14` |
| Anuncio del cambio de estado | **ausente:** no hay `aria-live` ni `role="status"` en el loader. Un lector de pantalla no anuncia que se está cargando ni que terminó | `Loader.tsx:11-17` |
| Estructura semántica en error | `<h1>Error</h1>` + `<p>`, dentro de un fragmento sin `<main>` | `login/enter/error.tsx:6-11` |
| Mensaje de error accesible | Se renderiza como texto, sin `role="alert"`: no se anuncia al aparecer | `login/enter/error.tsx:9` |
| Redirect sin aviso | El usuario es redirigido a `/` sin ningún anuncio | `login/enter/page.tsx:8` |

## Observaciones del relevamiento

- **Es la única pantalla del producto sin UI propia.** Se releva porque es un paso obligado del
  flujo de entrada y porque su `loading.tsx` y su `error.tsx` sí se ven.
- **El redirect va a `/`, que es la pantalla vacía.** El flujo de login completo termina en
  `<h1>Home</h1>`. Ver [home-vacia.md](./home-vacia.md). No se puede determinar desde el código si
  la intención era llegar a `/clients` — el `redirect('/clients')` de `app/page.tsx:4-8` está
  comentado, lo que lo sugiere pero no lo confirma.
- **`presentInApi` puede imprimir el access token completo por consola** si `LOG_ACCESS_TOKEN=true`
  (`authApi.ts:6-15`), con el comentario *"Temporal (entorno local)… Sacar antes de mergear"*. No es
  un hallazgo de UX pero ocurre en esta pantalla.
- **A confirmar en consolidación:** si el fallo de registro en la api debería frenar la entrada en
  vez de tragarse. Hoy el usuario entra y descubre el problema como un 401 que lo devuelve a
  `/login`, sin explicación — un bucle silencioso.
