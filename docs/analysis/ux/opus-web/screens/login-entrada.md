---
document: UX Survey Screen
screen: login-entrada
route: /login/enter
service: opus-web
source_files:
  - src/app/(auth)/login/enter/page.tsx
  - src/features/auth/services/authApi.ts
  - src/app/(auth)/layout.tsx
viewports_detected: []
status: as-is-sin-validar
date: 2026-08-18
---

# UX Survey: login-entrada

> **Relevamiento as-is** de `/login/enter`, extraído de
> `src/app/(auth)/login/enter/page.tsx`. Describe lo que el código hace hoy, no lo que debería
> hacer.

**Esta pantalla no tiene interfaz.** Es un server component de siete líneas que ejecuta un efecto
y redirige. Se releva igual porque es un paso obligado del flujo de entrada y porque lo que hace
—o deja de hacer— tiene consecuencias visibles en las pantallas siguientes.

## Identidad

- **Ruta:** `/login/enter`
- **Archivo:** `src/app/(auth)/login/enter/page.tsx`
- **Requiere auth:** sí — está dentro del matcher del middleware. En la práctica se llega acá
  recién autenticado
- **Audiencia:** no determinable desde el código
- **Propósito observado:** dar de alta al usuario en la api tras el login OIDC, y redirigir al
  inicio. Es el `callbackUrl` que `/login` le pasa a `signIn`.
- **Viewports con tratamiento:** ninguno — **no renderiza nada**

```tsx
// src/app/(auth)/login/enter/page.tsx — el archivo completo
import { redirect } from 'next/navigation';
import { presentInApi } from '@/features/auth/services/authApi';

export default async function LoginEnterPage() {
  await presentInApi();
  redirect('/');
}
```

## Entrada y salida

**Entradas:**
- Desde el callback de Zitadel, tras autenticar · `login/page.tsx:14` —
  `signIn('zitadel', { callbackUrl: '/login/enter' })`

**Salidas:**
- A `/` · siempre, sin condición · `login/enter/page.tsx:6`

**Redirects automáticos:**
- A `/` incondicionalmente, tanto si el alta funcionó como si falló ·
  `login/enter/page.tsx:6`
- Y desde `/`, la cadena sigue: a `/projects` si hay sesión, a `/login` si no ·
  `app/page.tsx:7-11`
- Y desde `/projects`, al primer proyecto por orden alfabético · `projects/page.tsx:20-25`

**La cadena completa de entrada son cuatro redirecciones:**

```
Zitadel → /login/enter → / → /projects → /projects/{primerId}/requirements?view=list
```

## Estructura

| # | Nombre | Tipo | Variant/Level/State | Viewports | Componente real | Origen |
|---|--------|------|---------------------|-----------|-----------------|--------|
| — | — | — | — | — | **ninguno** | el componente no devuelve JSX |

No hay bloques que relevar. La función `redirect()` de Next lanza una excepción de control antes
de que haya nada que renderizar.

## Layout observado por viewport

### todos los anchos

Sin layout: la pantalla no pinta nada. El usuario ve el estado de transición del navegador entre
la respuesta de Zitadel y la primera pantalla real.

**Origen:** `login/enter/page.tsx:4-7` — el componente no tiene `return` de JSX.

## Contenido

Ninguno. **No hay microcopy en esta pantalla.**

Lo único que un usuario podría llegar a percibir es el tiempo de espera: `presentInApi()` es un
`POST` a la api con un `timeout` de 10 s (`lib/axios.ts:17`), y la redirección no ocurre hasta que
esa promesa se resuelve o falla.

## Estados presentes

### default (único)
- Mensaje: ninguno
- Disparado por: la carga de la ruta
- Origen: `login/enter/page.tsx:4-7`
- Cambios: ejecuta `presentInApi()` y redirige a `/`

## Estados ausentes

| Estado | Qué pasa hoy | Evidencia |
|---|---|---|
| loading | **No hay ninguna indicación de progreso.** Es un server component sin `loading.tsx` en la ruta: durante el `POST` (hasta 10 s de timeout) el navegador queda mostrando la pantalla anterior sin señal de actividad | `login/enter/page.tsx:5`; no existe `app/(auth)/login/enter/loading.tsx` |
| error de sistema | **El error se traga a propósito y no se muestra.** `presentInApi` captura, hace `console.warn` y devuelve `null`; la redirección ocurre igual | `authApi.ts:24-31` |
| permiso/acceso denegado | No se detecta acá. Un usuario dado de alta sin proyectos asignados es indistinguible de uno cuya alta falló: los dos terminan viendo "No tienes proyectos asignados" en `/projects` | `authApi.ts:24-31` + `projects/page.tsx:55` |
| success | no aplica — el éxito es la redirección | — |
| empty · not found · error de validación · terminal | no aplican | — |

**El tragado de errores es deliberado y está documentado en el código:**

```ts
// src/features/auth/services/authApi.ts:26-28
// No es fatal: si el alta falla, el usuario igual tiene sesión y las pantallas
// resuelven solas si le falta permiso. Antes se relanzaba y /login/enter quedaba en
// una pantalla blanca de error, sin poder entrar. La web ya lo trataba así.
```

Es decir: la ausencia de estado de error **es la corrección de un bug anterior**, no un olvido. El
comentario dice que antes esta pantalla mostraba una pantalla blanca de error que bloqueaba el
ingreso.

El costo que queda registrado: si el alta falla de verdad, no hay señal en ningún lado salvo un
`console.warn` del servidor.

## Interacciones

**Eventos:**
- Ninguno: no hay elementos interactivos.

**Validaciones:**
- Ninguna.

**Feedback:**
- Ninguno visible. El único efecto observable es la navegación.

**Comportamiento de `presentInApi`** (`authApi.ts:5-32`), que es todo lo que esta pantalla hace:

1. Lee la sesión con `auth()`.
2. Si no hay sesión o no hay `accessToken`: `console.warn('presentInApi: sin sesión ni access
   token')` y devuelve `null` sin llamar a la api.
3. Si la hay: `POST /api/auth/present` con `Authorization: Bearer {accessToken}` y cuerpo vacío,
   usando `apiClientBase` (el cliente de servidor).
4. Si falla: `console.warn` y `null`.

## Accesibilidad observada

| Aspecto | Estado | Evidencia |
|---|---|---|
| Anuncio de la transición | **ausente** — sin `aria-live` ni contenido. Un lector de pantalla no tiene nada que anunciar durante la espera | `login/enter/page.tsx` |
| Foco tras la redirección | no manejado por esta pantalla: lo resuelve la navegación del navegador | — |

No hay más que evaluar: sin DOM no hay superficie accesible.

## Observaciones del relevamiento

- **Es la pantalla más corta del servicio y la que más consecuencias tiene.** Todo lo que un
  usuario nuevo necesita para existir en la api pasa por acá, y si falla no se entera nadie.

- **Cuatro redirecciones encadenadas para entrar.** `/login/enter → / → /projects →
  /projects/{id}/requirements`. Cada salto es un round-trip al servidor. No se pudo determinar si
  la cadena es intencional o el resultado de agregar pasos de a uno.

- **La cadena falla en un caso concreto:** si el usuario no tiene proyectos, se detiene en
  `/projects` mostrando "No tienes proyectos asignados" (`projects/page.tsx:51-59`). Ese es el
  destino real de un usuario nuevo cuya alta no funcionó.

- **Sin `loading.tsx` en toda la aplicación.** Esta ruta es donde más se notaría: es la única que
  hace una llamada bloqueante en el servidor antes de redirigir.

- **A confirmar en consolidación:** qué hace `POST /api/auth/present` del lado de `api`. En `web`
  el análisis registró que ese endpoint es un no-op documentado; si acá también lo es, el paso
  entero no tiene efecto y el usuario nuevo depende de que lo den de alta por otra vía.
