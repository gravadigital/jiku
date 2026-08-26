---
name: login-entrada
surface: web
route: /login/enter
viewports:
  - desktop
audiences:
  - equipo-interno
fidelity: mid
status: as-is-sin-validar
version: "1.0"
date: 2026-08-18
---

# Pantalla: Login entrada

## Identidad

- **Audiencia primaria:** equipo-interno. No declara auth — está fuera de `(loggedin)` —, pero en la práctica solo se llega acá con sesión, porque es el `callbackUrl` de `signIn` [fuente: código-existente].
- **JTBD / Propósito:** pantalla de tránsito. Llama a `POST /auth/present` en la api y redirige a `/`. No tiene UI propia en el happy path [fuente: código-existente]. **Desde REQ-007 esa llamada no protege de nada**: el 401 `user_not_found` que justificaba el paso desapareció de las 61 rutas de la api (CA-12).
- **Viewports:**
  - **desktop** — único viewport. No renderiza nada en el happy path; los bloques de `loading.tsx` y `error.tsx` se muestran dentro del layout partido de `/login`, sin tratamiento responsive.
  - Mobile queda fuera de la superficie `web`: el shell tiene la sidebar fija en 290px sin ninguna media query, así que no hay navegación bajo ese ancho (evidencia: `web/src/app/(loggedin)/styles.module.scss:1-26`) [fuente: código-existente].
  - Tablet: se comporta como desktop.

## Entrada y salida

**Entradas:**
- `callbackUrl` de `signIn` en la pantalla de login · `login/page.tsx:13` [fuente: código-existente]

**Salidas user-driven:**
- Ninguna. La pantalla no tiene controles [fuente: código-existente].

**Salidas automáticas:**
- `/` · incondicional, después de `await presentInApi()` · `login/enter/page.tsx:7-8` — `redirect('/')` [fuente: código-existente]

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Categoría | Viewports | Visibilidad | Propósito |
|---|--------|------|---------------------|-----------|-----------|-------------|-----------|
| 1 | cargando-entrada | loader | — | feedback | desktop | visible_only_in_states: loading | Indicador mientras el Server Component resuelve |
| 2 | titulo-error | heading | h1 | content | desktop | visible_only_in_states: error de sistema / sin conexión | Encabezado del boundary de error |
| 3 | mensaje-error | paragraph | body | feedback | desktop | visible_only_in_states: error de sistema / sin conexión | Mensaje crudo de la excepción |

**Origen:** `login/enter/loading.tsx:5`, `login/enter/error.tsx:8`, `login/enter/error.tsx:9`

La pantalla tiene **cero bloques en el happy path**: la página no devuelve JSX, hace `redirect()` (`login/enter/page.tsx:6-9`). Los tres bloques listados pertenecen a los archivos `loading.tsx` y `error.tsx` de la ruta [fuente: código-existente].

## Layout por viewport

### desktop · 1440px

En el happy path no hay layout: no se renderiza nada antes del redirect (`login/enter/page.tsx:6-9`).

**Durante la carga** (`loading.tsx`):
- cargando-entrada

Centrado por `Loader.module.scss`. Sin el shell de `(loggedin)`; el layout de `login/layout.tsx` **sí** aplica, porque `enter/` está dentro de `login/`, así que el `<Loader>` se renderiza en el panel izquierdo (6/12 del ancho) con el panel decorativo al lado.

**En error** (`error.tsx`):
- titulo-error
- mensaje-error

También dentro del layout partido de `/login`, sin estilos propios (elementos `h1` y `p` desnudos, con los estilos globales de `globals.scss:189-201`).

**Origen:** `login/layout.tsx:4-11` — el layout de `/login` envuelve también esta subruta [fuente: código-existente].

## Contenido

### cargando-entrada
- Texto/label: `"Cargando..."`
- Icono: nada
- Asset: imagen del componente `<Loader>` con `alt="loader"`
- Annotation: `login/enter/loading.tsx:5` [fuente: código-existente]

### titulo-error
- Texto/label: `"Error"`
- Icono: nada
- Asset: nada
- Annotation: `login/enter/error.tsx:8`

### mensaje-error
- Texto/label: dinámico desde `error.message` — no hay copy fijo en el código
- Icono: nada
- Asset: nada
- Annotation: el tipo es `CustomError` de `@/shared/types`. Se muestra el mensaje crudo de la excepción (`login/enter/error.tsx:9`) [fuente: código-existente]

## Estados

### default
- Aplica: No — no implementado (ver gaps-as-is.md). La página nunca renderiza contenido propio, siempre redirige (`login/enter/page.tsx:6-9`) [fuente: código-existente].
- **Nota sobre el wireframe:** el canvas de la superficie **sí** dibuja un frame `default` para esta
  pantalla, rotulado "Login entrada (sin UI propia)" y con un único bloque que dice que no hay
  interfaz y que se redirige. No contradice lo de arriba: existe porque el generador ancla las
  flechas de transición contra el frame `default`, y sin él la flecha del redirect —que documenta
  una transición real— no se podría dibujar. El frame representa la **ausencia** de UI, no una UI.

### empty
- Aplica: No — no implementado (ver gaps-as-is.md)

### loading
- Aplica: Sí
- Mensaje: `"Cargando..."`
- Cambios:
  - cargando-entrada: solo visible en este estado (visible_only_in_states); es todo lo que se ve
- Disparado por el `loading.tsx` de la ruta mientras el Server Component resuelve `await presentInApi()` (`login/enter/loading.tsx`) [fuente: código-existente]

### error de validación
- Aplica: No — no implementado (ver gaps-as-is.md). No hay inputs.

### error de sistema / sin conexión
- Aplica: Sí
- Mensaje: `"Error"` como título y el `error.message` dinámico como cuerpo
- Cambios:
  - titulo-error y mensaje-error: solo visibles en este estado (visible_only_in_states); reemplazan la pantalla
- Disparado por una excepción no atrapada en el render del Server Component (`login/enter/error.tsx:5-11`). En la práctica este boundary casi no se dispara, porque el único trabajo de la página está envuelto en su propio `try/catch` (`authApi.ts:17-21`) [fuente: código-existente]

### success
- Aplica: No — no implementado (ver gaps-as-is.md). El éxito es el redirect.

### not found
- Aplica: No — no implementado (ver gaps-as-is.md)

### estado terminal / readonly
- Aplica: No — no implementado (ver gaps-as-is.md)

### fallo de `POST /auth/present`
- Aplica: No — no implementado (ver gaps-as-is.md). Se traga con `console.warn` y el flujo continúa al redirect (`authApi.ts:19-21`) [fuente: código-existente].
- **Precisión con REQ-005:** el alta automática de usuarios **ya existe en el producto**, pero no por este camino. Desde REQ-005 toda identidad que se autentica **en el bus** queda dada de alta sola, sin aprobación (RF-4); quien entra por `web` seguía sin alta y seguía cayendo en un bucle de 401 (CA-17). O sea: la pantalla no cambia, pero **la razón por la que el usuario queda afuera dejó de ser "el producto no da de alta a nadie" y pasó a ser "no da de alta por esta puerta"**.
- 🟢 **Y con REQ-007 la puerta se abrió: el bucle no existe más.** La api arma `req.user` **del claim** y deja de exigir fila previa, así que el 401 `user_not_found` desapareció de las 61 rutas (CA-12); y `core` crea o actualiza la fila de `users` con el sobre de identidad que viaja en cada comando, incluso con la tabla vacía (CA-9, CA-10, CA-11). El resultado observable: **una persona que se autentica por primera vez en `web` opera normalmente desde la primera pantalla**, aunque `presentInApi` falle entero. Lo que este REQ resuelve de FG-1 es exactamente esto —el alta automática—; **lo que queda abierto en FG-1 es otra cosa**: el alta de Personas y la administración de `user_project_permissions` por interfaz.
- El estado sigue sin implementarse y **ahora es correcto que siga así**: el fallo dejó de tener consecuencia para el usuario, así que no hay nada que informarle

## Interacciones

**Eventos:**
- Ninguno. La pantalla no tiene controles [fuente: código-existente].

**Validaciones:**
- Ninguna.

**Feedback:**
- Solo el `loading.tsx` mientras resuelve (`login/enter/loading.tsx`). El error de la api no produce ningún feedback visible [fuente: código-existente].

## Accesibilidad

- **Orden de foco:** no hay elementos interactivos en ninguno de los estados de esta pantalla [fuente: código-existente].
- **Landmarks y jerarquía:** en el estado de error hay un `<h1>Error</h1>` seguido de un `<p>`, dentro de un fragmento **sin `<main>`** (`login/enter/error.tsx:6-11`). En el estado de carga, el `<Loader>` no aporta landmark [fuente: código-existente].
- **Foco y teclado:** la pantalla no dispara overlays, así que no introduce focus traps.
- **Propio de esta composición:** el loader **no anuncia el cambio de estado**: no hay `aria-live` ni `role="status"`, así que un lector de pantalla no anuncia que se está cargando ni que terminó (`Loader.tsx:11-17`). El mensaje de error se renderiza como texto **sin `role="alert"`**, así que tampoco se anuncia al aparecer (`login/enter/error.tsx:9`). El redirect a `/` ocurre sin ningún aviso al usuario (`login/enter/page.tsx:8`) [fuente: código-existente].

## Decisiones y descartes

- Pantalla documentada desde el código existente [fuente: código-existente]. No hay registro del rationale original; las decisiones se van a documentar cuando la pantalla se modifique.

### REQ-005 — Sincronización de usuarios y roles desde el bus (2026-08-24)

- **No se agrega ningún bloque, y la revisión sirvió igual.** REQ-005 preguntó explícitamente si el 401 `user_not_found` seguía contándose igual. La respuesta es que sí para el usuario de esta superficie (CA-17), pero el enunciado que lo explicaba —"el producto no escribe `users`"— quedó falso: ahora sí lo escribe, por el evento del bus. Se corrigió la precisión del estado en vez de inventar un mensaje que el código no tiene.
- **Se descartó mostrarle al usuario que existe un camino de alta que no es el suyo.** Sería exacto y sería inútil: el usuario de `web` no puede conectarse al bus para provisionarse, así que la información no habilita ninguna acción. El silencio se mantiene, y sigue siendo un gap de FG-1, no de este REQ.
- **Se revisó `sin-permisos` y no cambia.** Es la pantalla del `external-user` redirigido desde `(loggedin)`, un corte por rol y no por ausencia de fila en `users`: REQ-005 no la toca.
- **Sin cambios en el Design System.** El delta no introduce ningún tipo de bloque en esta pantalla.

### REQ-007 — `jiku-commands` para personas (2026-08-25)

- **No cambia ningún bloque, y cierra el caso que REQ-005 dejó abierto.** Es la tercera revisión seguida sobre el mismo estado no implementado, y esta vez el cambio es de signo: el 401 `user_not_found` **desapareció** de las 61 rutas de la api (CA-12), y con él el bucle donde un usuario nuevo entraba, pedía datos y volvía a `/login` sin saber por qué. La cadena `login → login-entrada → /` funciona ahora para cualquier identidad autenticada, tenga o no fila previa en `users`.
- **Se descartó agregar un mensaje de éxito o cualquier bloque nuevo.** No hay nada que celebrar en una pantalla que el usuario no ve: el happy path de `login-entrada` es no verla, y sigue siéndolo. La mejora es la **ausencia** de un error, y las ausencias no se renderizan.
- **Se descartó marcar el estado como "ya no aplica" y borrarlo.** El estado se conserva declarado —el `POST` puede seguir fallando— y lo que se corrigió es su consecuencia. Borrarlo dejaría el documento sin registro de por qué esa llamada existe todavía.
- **Se verificó `sin-permisos` y no cambia.** Es el corte del `external-user` redirigido desde `(loggedin)`: depende del **rol**, no de la ausencia de fila en `users`. REQ-007 no toca ese corte —los `external-user` siguen sin poder entrar a `web`— así que la pantalla queda igual. Verificado, no asumido.
- **Sin cambios en el Design System.** El delta no introduce ningún tipo de bloque en esta pantalla.
