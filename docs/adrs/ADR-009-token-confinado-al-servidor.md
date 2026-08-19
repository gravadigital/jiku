# ADR-009: Next.js App Router con el access token confinado al servidor

**Estado:** Aceptado (implementado, con dos implementaciones divergentes)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** frontend, nextjs, seguridad, tokens
**Detectado desde:** `web`, `opus-web`

---

## Contexto

Los dos frontends necesitan llamar a una api autenticada con Bearer token. En una SPA clásica el
token vive en el navegador —en memoria, `localStorage` o una cookie legible por JS— y cada request
lo adjunta. Eso tiene dos costos: el token es alcanzable por cualquier script que corra en la
página, y **la URL de la api tiene que estar en el bundle**, así que se hornea en tiempo de build y
una imagen sirve para un solo entorno.

El segundo costo no es menor en este producto: se despliega en local, dev y producción con la
misma imagen, y en producción la api es alcanzable por la **red interna de Docker**
(`http://api:3000/`), una dirección que no tiene sentido en el navegador.

Next.js con App Router permite resolver ambas cosas ejecutando la llamada en el servidor.

## Decisión

**El access token nunca llega al navegador. Toda llamada a la api sale del servidor de Next.**

El principio es el mismo en los dos frontends; **la implementación difiere**, y esa divergencia es
parte de lo que este ADR registra.

### `web`: Server Actions con axios de servidor

Los `services/*Api.ts` llevan `'use server'` y usan un `apiClient` cuyo interceptor llama a
`auth()` —que solo corre en el servidor— para inyectar el Bearer. El comentario en `axios.ts:15-16`
lo declara: por eso la URL puede leerse de `API_URL` **en runtime** sin embeberse en el bundle.

Complementa con un **BFF selectivo** en `app/api/`: seis route handlers **solo** para lo que un
Server Action no puede resolver — streaming de uploads con `duplex: 'half'`, descarga y preview con
header `Authorization`, el PATCH optimista de requisitos, el alta de actores desde un componente
cliente, y un proxy a `/oidc/v1/userinfo`.

### `opus-web`: proxy catch-all

El navegador llama a `/api/opus/*` de **su propio origen** y un route handler catch-all
(`/api/opus/[...path]`) reenvía a la api agregando el Bearer de la sesión. El comentario en
`lib/axios.ts:43-47` da la misma razón: *"así el bundle no necesita saber dónde está la api —no
habría forma de decírselo en runtime— y el access token no sale del servidor"*.

### Consecuencia común

**Ninguna variable se hornea en las imágenes.** No hay `ARG` ni `NEXT_PUBLIC_*` funcional: una
sola imagen sirve para todos los entornos, configurada enteramente en runtime.

## Implementation Rules

- El access token **NO DEBE** llegar al navegador por ningún camino: ni en el bundle, ni en una
  respuesta, ni en una cookie legible por JS.
- La URL de la api **DEBE** leerse de `API_URL` **en el servidor, en runtime**. **NO SE DEBE**
  usar `NEXT_PUBLIC_API_URL` ni ninguna variable horneada en build.
- En `web`, toda llamada de dominio **DEBE** ir por un Server Action (`'use server'`) con
  `apiClient`. Un route handler en `app/api/` **DEBE** justificarse por una capacidad que el Server
  Action no tenga (streaming, headers de respuesta, llamada desde componente cliente).
- En `opus-web`, toda llamada **DEBE** ir por el proxy `/api/opus/[...path]`. **NO SE DEBE**
  agregar un cliente axios que apunte directo a `API_URL` desde el navegador.
- Todo route handler que reenvíe a la api **DEBE** exigir sesión y responder
  `401 {"error":"Unauthorized"}` si no hay `accessToken`. La única excepción vigente es
  `GET /attachments/[id]/[fileName]` de `opus-web`, cuya autorización la decide la api.
- Al reenviar respuestas binarias, **DEBEN** propagarse `Content-Type`, `Content-Disposition` y
  `Content-Length`.
- Al reenviar uploads **DEBE** usarse streaming con `duplex: 'half'`, no bufferizar el archivo
  entero en memoria.
- Un 401 de la api **DEBE** redirigir el navegador a `/login`.
- **NO SE DEBE** agregar `NEXT_PUBLIC_*` funcional: rompería la premisa de una imagen por todos los
  entornos.

## Consecuencias

### Positivas

- **El token no es alcanzable desde el navegador.** Un XSS en la página no puede robarlo, porque no
  está ahí.
- **Una sola imagen para todos los entornos.** La configuración es enteramente de runtime, lo que
  simplifica el despliegue y elimina la clase de bug "imagen construida para el entorno
  equivocado".
- **La api puede vivir en la red interna** (`http://api:3000/`), sin exponerse al navegador.
- **El bundle no revela la topología del backend.**

### Negativas

- **Todo pasa por el servidor de Next**, que se vuelve un salto adicional en cada request y un
  punto de carga.
- **Cada frontend resolvió lo mismo de forma distinta.** No hay evidencia de cuál se prefiere, y
  las dos tienen consecuencias opuestas:

  | | `web` (Server Actions) | `opus-web` (proxy catch-all) |
  |---|---|---|
  | Endpoint nuevo | Requiere escribir el service | **No requiere código** |
  | Superficie expuesta | Solo lo que cada service llama | **Toda** la de `/api/opus/*` |
  | Allowlist | Implícita, por lo que existe | **Ninguna** |

- **El proxy catch-all no filtra paths ni métodos**: expone toda la superficie de `/api/opus/*` a
  cualquier usuario logueado. Es válido solo porque la api autoriza por rol y entidad en cada
  endpoint.
- **Debugging más indirecto:** un error de la api atraviesa dos capas antes de llegar al usuario.

### Riesgos

- **Riesgo:** un endpoint nuevo bajo `/api/opus/*` queda accesible desde el portal sin que nadie lo
  decida, por el catch-all.
  - **Mitigación:** la autorización de la api. Registrado en NFR-S08 y FG-4.
- **Riesgo:** la divergencia entre los dos frontends se profundiza y el conocimiento no se
  transfiere entre ellos.
  - **Mitigación:** documentada en [`docs/prd/architecture.md`](../prd/architecture.md). Converger
    sería una decisión nueva, con su propio ADR.
- **Riesgo:** alguien agrega `NEXT_PUBLIC_API_URL` para "simplificar" y rompe la premisa de imagen
  única. Ya hay un resto de esto: `web/.env.test` declara `NEXT_PUBLIC_API_URL`, que no se usa en
  ningún archivo de `src/`.
  - **Mitigación:** la regla explícita de arriba.

## Alternativas Consideradas

### Alternativa 1: SPA clásica con el token en el navegador

**Pros:**
- Sin salto intermedio: el navegador habla directo con la api
- Modelo mental simple y muy conocido

**Cons:**
- El token es alcanzable por cualquier script de la página
- La URL de la api tiene que estar en el bundle: una imagen por entorno
- La api tendría que exponerse públicamente, no podría vivir solo en la red interna

**Por qué se descartó:** los dos costos aplicaban de lleno, y el segundo chocaba con el modelo de
despliegue.

---

### Alternativa 2: Cookie `httpOnly` con el token, y llamadas directas del navegador

**Pros:**
- El token tampoco sería legible por JS
- Sin salto por el servidor de Next

**Cons:**
- La api tendría que aceptar cookies y resolver CSRF
- Requiere mismo dominio o CORS con credenciales
- La URL de la api seguiría teniendo que estar en el bundle

**Por qué se descartó:** resuelve solo la mitad del problema —protege el token pero no la
configuración en runtime— y agrega CSRF a un producto que hoy no lo tiene por usar Bearer.

---

### Alternativa 3: Un BFF completo por frontend

**Pros:**
- Contrato a medida de cada UI, con agregación y menos requests
- Allowlist natural: solo existe lo que el BFF expone

**Cons:**
- Una capa entera que mantener y versionar en paralelo a la api
- Duplicaría tipos y validación

**Por qué se descartó:** desproporcionado para el tamaño del equipo. `web` terminó adoptando una
versión mínima de esto —seis handlers, solo donde hacía falta— que es el punto medio razonable.

## Referencias

- Implementación: `web/src/lib/axios.ts:15-16`, `web/src/app/api/`,
  `opus-web/src/lib/axios.ts:43-47`, `opus-web/src/app/api/opus/[...path]/`
- Arquitectura: [`docs/prd/architecture.md`](../prd/architecture.md)
- ADRs relacionados: [ADR-006](ADR-006-dos-frontends-una-api.md), [ADR-011](ADR-011-tanstack-query.md)
