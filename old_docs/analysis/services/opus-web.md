---
document: Service Analysis
service: opus-web
type: frontend
repo_path: opus-web/
date: 2026-08-18
status: analizado
---

# Análisis de servicio: opus-web

> Análisis temporal producido por `/product-analyze-service`. Es insumo para
> `/product-consolidate-services`, no documentación final.

## Identificación

| Campo | Valor |
|---|---|
| **Nombre** | `opus-web` (paquete `@jiku/opus-web`) |
| **Tipo** | Frontend |
| **Path** | `opus-web/` — workspace del monorepo `jiku` |
| **Propósito** | Portal de clientes: un cliente sigue el avance de sus proyectos, crea requisitos, comenta y se suscribe |
| **Responsabilidad** | Única interfaz de cara al cliente sobre `jiku-api`. Expone un subconjunto acotado del modelo — proyectos con permiso, requisitos y su actividad pública — y resuelve la autenticación OIDC del lado del servidor |
| **Audiencia declarada en código** | Roles `admin`, `user`, `external-user` (claim del token). El portal **no corta navegación por rol**: el filtro real es de datos, del lado de `api`. El rol solo cambia qué controles se renderizan |

Del README del servicio: *"The client portal: what a client sees. […] They never see hours,
internal comments or other clients' projects."*

### Stack técnico

| Capa | Tecnología | Versión | Origen |
|---|---|---|---|
| Framework | Next.js — App Router, `output: 'standalone'` | 16.1.1 | `opus-web/package.json`, `next.config.js:4` |
| UI | React | 19 | `opus-web/package.json` |
| Lenguaje | TypeScript, `strict: true`, target ES2017 | 5.x | `opus-web/tsconfig.json:11` |
| Estado de servidor | TanStack Query (con `useInfiniteQuery`) | 5.90.16 | `src/app/providers.tsx:14-29` |
| Estado de cliente | React Context (1 provider) + `useState` | — | `src/contexts/ProjectContext.tsx` |
| Autenticación | NextAuth v5 (beta) + provider Zitadel, PKCE | 5.0.0-beta.32 | `src/features/auth/config/nextauth.config.ts` |
| Cliente HTTP | axios — dos instancias: navegador (mismo origen) y servidor | 1.13.2 | `src/lib/axios.ts` |
| Estilos | Sass + CSS Modules + custom properties | sass 1.97.2 | `src/styles/`, 33 `*.module.scss` |
| Formularios | **Ninguna librería**: `useState` crudo con validación inline | — | `react-hook-form` 7.70 declarado y **nunca importado** |
| Iconos | `lucide-react` + SVG inline | 0.563.0 | — |
| Fechas | `date-fns` con locale `es` | 4.1.0 | `ActivityPanel.tsx:3-4` |
| Markdown | `react-markdown` (mockeado en tests) | 10.1.0 | `src/shared/components/ui/MarkdownRenderer/` |
| Testing | Vitest + Testing Library, jsdom, `TZ=UTC` | vitest 4.0.18 | `opus-web/vitest.config.mts` |
| Lint/format | ESLint 9 (flat config) + `eslint-config-next` + Prettier | eslint 9 | `opus-web/eslint.config.mjs` |
| Empaquetado | Docker multi-stage, node 24.12-alpine3.23, contexto = raíz del monorepo | — | `opus-web/Dockerfile` |

## Estructura

Arquitectura **feature-first** con una capa compartida transversal — la misma forma que `web`.

```
opus-web/src/
  app/           5 páginas (App Router) + 4 route handlers + 3 layouts
    (auth)/      login y callback de entrada
    (dashboard)/ shell con Sidebar + <main>
    api/         proxy catch-all, NextAuth, preview de adjuntos
    attachments/ descarga pública por nombre
  features/      6 dominios con components/ hooks/ services/ types/ constants/
  shared/        12 componentes ui/ + 3 layout/ (los tres sin uso) + hooks/ + types/
  lib/           axios.ts, queryClient.ts
  contexts/      ProjectContext
  styles/        _variables.scss (tokens), _mixins.scss (mixins + breakpoints)
  middleware.ts  el guard de toda la aplicación
```

**Dominios en `features/`:** `attachments`, `auth`, `comments`, `projects`, `requirements`,
`subscriptions`.

**Sin `error.tsx`, `not-found.tsx` ni `loading.tsx`** en ninguna ruta.

## Features principales

### Autenticación (`auth`)
- Login con un botón que delega en Zitadel (`signIn('zitadel')`), con `callbackUrl` a
  `/login/enter`.
- `/login/enter` es un server component que llama a `POST /api/auth/present` y redirige a `/`.
  **Los errores se tragan a propósito**, documentado (`authApi.ts:24-31`).
- Guard en `middleware.ts` por exclusión: todo protegido salvo `/login`, `api/*`, `attachments/*`
  y estáticos.
- La validación no es solo "hay cookie": rechaza sesiones con el access token vencido
  (`middleware.ts:14-23`).
- Logout con `signOut({ callbackUrl: '/login' })`.

### Proyectos (`projects`)
- `GET /api/opus/projects` devuelve solo los proyectos con permiso. El tipo es mínimo:
  `{id, name}`.
- `/projects` **no muestra un listado**: es una pantalla de redirección que navega al primer
  proyecto por orden alfabético (`projects/page.tsx:20-25`).
- El `Sidebar` lista los proyectos ordenados, marca el activo por regex sobre el pathname
  (`Sidebar.tsx:23`), y contiene el botón "Nuevo requisito" y el bloque de usuario con logout.
- `ProjectList` y `ProjectCard` implementan un listado en grilla y **no se usan**.

### Requisitos (`requirements`)
El módulo grande: 11 componentes, 6 hooks.

- **Tres vistas del mismo tablero**, elegidas por viewport y por `?view=`:
  - `ListView` (default en desktop): tabla de 7 columnas agrupada por estado, con secciones
    colapsables.
  - `KanbanBoard`: 7 columnas colapsables en horizontal.
  - `MobileRequirementsBoard` (< 768px, forzado por JS): acordeones por estado.
- **Siete estados**: `analisis`, `planificacion`, `en_cola`, `desarrollo`, `revision`, `resuelto`,
  `cancelado`. La lista está declarada **tres veces**, una por vista.
- **Paginación infinita por estado**: siete `useInfiniteQuery` en paralelo, 20 por página, botón
  "Ver más" por columna. `resuelto` y `cancelado` arrancan colapsados.
- **Cambio de estado y prioridad inline** desde dropdowns en la fila o la card — **solo para roles
  internos** (`user`/`admin`). Un `external-user` ve los mismos pills sin dropdown.
- **Detalle implementado dos veces**: modal sobre el tablero (`RequirementDetailModal`) y página
  propia (`RequirementDetailView`). Los dos componen los mismos tres paneles.
- **Creación** en `CreateRequirementModal`: título (único campo obligatorio), descripción con
  adjuntos, proyecto, prioridad, tipo y suscriptores. El estado es un chip fijo "Análisis" no
  editable. Al crear muestra una pantalla de éxito 1.8 s y cierra.

### Comentarios (`comments`)
- Un solo hook, `useCreateComment`, contra `POST /api/opus/requirements/{id}/comments`.
- El feed (`ActivityPanel`) mezcla comentarios y cambios de campo en orden cronológico
  **ascendente**, con fechas relativas en español (`date-fns` + locale `es`).
- Los cambios se renderizan como *"{Autor} cambió {Campo} de {X} a {Y}"* con etiquetas legibles.
- **Conserva un fallback para el enum viejo** (`programado`, `finalizado`), con el motivo escrito:
  *"Valores del enum viejo (ADR-009), conservados como fallback legible para historial de
  actividad persistido antes de REQ-040/S-064 (CA-4)"* (`ActivityPanel.tsx:48-51`).

### Suscripciones (`subscriptions`)
- Suscribir/desuscribir a un requisito; el botón solo aparece para `external-user`.
- `UserSelector` para elegir suscriptores al crear un requisito, contra
  `GET /api/opus/projects/{id}/users`.
- `SubscribersList` muestra los nombres en el panel de información.
- **Implementado dos veces**: `subscriptionsApi` (el que corre) y `requirementsApi.subscribe`
  (sin uso).

### Adjuntos (`attachments`)
- Subida con `FormData` a `/api/opus/attachments`, con `entityType` de borrador
  (`requirement_draft` o `requirement_comment_draft`).
- **Límite de 10 MB y 12 extensiones**, validado en el cliente. La validación está **duplicada
  literalmente** entre `CommentInput` y `CreateRequirementModal`.
- Los adjuntos se insertan en el texto como placeholders `![attach:N]` (imagen) o `[attach:N]`
  (archivo), y `RichTextEditor` / `RichContentRenderer` los parsean para renderizar preview o
  descarga.
- `RichContentRenderer` soporta **dos formatos**: el de `opus-web` (`[attach:N]`) y el del gestor
  interno (`[nombre](/api/attachments/N/preview)`) — evidencia de contenido compartido entre los
  dos frontends.
- Los metadatos (nombre, tamaño) se resuelven con un `HEAD` al preview, leyendo
  `Content-Disposition` y `Content-Length`.

## Decisiones técnicas identificadas

### 1. Proxy catch-all en vez de Server Actions
**Qué:** el navegador llama a `/api/opus/*` de su propio origen y un route handler catch-all
reenvía a la api agregando el `Bearer`.

**Por qué (inferido del comentario en `lib/axios.ts:43-47`):** *"Así el bundle no necesita saber
dónde está la api —no habría forma de decírselo en runtime— y el access token no sale del
servidor."*

**Es la decisión que más separa a `opus-web` de `web`**, que resuelve lo mismo con Server Actions
y axios de servidor. Consecuencia: acá un endpoint nuevo de la api **no requiere código**, pero
tampoco hay allowlist — el proxy expone toda la superficie de `/api/opus/*` a cualquier usuario
logueado, y la autorización queda enteramente del lado de `api`.

### 2. Guard en `middleware.ts` en vez de en un layout
**Qué:** un middleware con matcher por exclusión protege todo salvo lo listado.

**Consecuencia:** la protección es por defecto — una ruta nueva queda protegida sin registrarla.
`web` hace lo opuesto (guard en el layout de `(loggedin)/`), donde una ruta fuera del grupo queda
sin guard.

### 3. Sin corte de navegación por rol
**Qué:** cualquier usuario autenticado ve las mismas rutas. El rol solo cambia controles.

**Por qué (inferido):** el portal es de clientes y el filtro real es de datos — `api` solo devuelve
los proyectos con permiso. Cortar por rol sería redundante.

### 4. Una query por estado, siete en paralelo
**Qué:** la pantalla del tablero monta siete `useInfiniteQuery`, una por columna.

**Por qué:** cada columna pagina por separado; con una sola query no se puede.

**Consecuencia:** siete requests al abrir, y `isLoading` es un `some` — la pantalla entera espera a
la más lenta.

### 5. El responsive del modal se decide en JS
**Qué:** `RequirementDetailModal` usa `useIsMobile()` para elegir entre fullscreen con tabs y dos
paneles.

**Por qué (inferido):** no es un cambio de layout sino de **árbol de componentes** — en mobile los
paneles son tabs excluyentes, no dos columnas. Una media query no puede hacer eso.

**Consecuencia:** `useIsMobile` arranca en `false`, así que en un teléfono hay un frame con el
layout de desktop antes de corregir. Y el valor 768 queda duplicado entre JS y SCSS.

### 6. Variantes con atributos `data-*`
**Qué:** `<button data-variant="primary" data-size="md">` y `&[data-variant='primary']` en el SCSS,
en vez de clases.

**Consecuencia:** no hay que mapear valores a nombres de clase en JS, y la variante queda visible
en el DOM al depurar. Es consistente en todo `shared/ui/`.

### 7. Configuración enteramente en runtime
**Qué:** ninguna variable se hornea en la imagen; no hay `ARG` ni `NEXT_PUBLIC_*` funcional.

**Por qué:** una sola imagen para todos los entornos. Es coherente con la decisión 1 — el bundle no
necesita saber dónde está la api.

## Interfaces

### Expone

| Tipo | Detalle |
|---|---|
| **Web UI** | 5 páginas: login, callback de entrada, redirección de proyectos, tablero de requisitos, detalle de requisito |
| **Route handler (proxy)** | `GET/POST/PATCH/PUT/DELETE /api/opus/[...path]` — reenvía todo a la api con el token. Requiere sesión |
| **Route handler (auth)** | `GET/POST /api/auth/[...nextauth]` — NextAuth |
| **Route handler (adjuntos)** | `GET /api/attachments/[id]/preview` — requiere sesión; reenvía `Content-Type`, `Content-Disposition`, `Content-Length` |
| **Route handler (público)** | `GET /attachments/[id]/[fileName]` — **sin autenticación**; llama a `/api/opus/attachments/{id}/public`. El `fileName` se ignora |

### Consume

| Tipo | Target | Detalle |
|---|---|---|
| **API REST** | `jiku-api` vía `API_URL` (`http://api:3000/` en deploy) | 10 endpoints bajo `/api/opus/*` + `POST /api/auth/present` |
| **OIDC** | Zitadel vía `ZITADEL_ISSUER` | Authorization Code + PKCE, y un fetch a `/oidc/v1/userinfo` cuando el ID token viene incompleto |

### Endpoints de `api` consumidos

| Método | Path | Desde |
|---|---|---|
| `GET` | `/api/opus/projects` | `projectsApi.getAll` |
| `GET` | `/api/opus/projects/{id}/requirements` | `requirementsApi.getByProject`, `getByStatus` (con `state`, `limit`, `skip`) |
| `GET` | `/api/opus/projects/{id}/users` | `subscriptionsApi.getProjectUsers` |
| `GET` | `/api/opus/requirements/{id}` | `requirementsApi.getById` |
| `POST` | `/api/opus/requirements` | `requirementsApi.create` |
| `PATCH` | `/api/opus/requirements/{id}` | `requirementsApi.updateRequirement` (state, priority) |
| `POST` | `/api/opus/requirements/{id}/comments` | `commentsApi.create` |
| `POST` | `/api/opus/requirements/{id}/comment` | `requirementsApi.addActivity` — **sin uso** |
| `POST` | `/api/opus/requirements/{id}/subscriptors` | `subscriptionsApi.subscribe` |
| `DELETE` | `/api/opus/requirements/{id}/subscriptors/{userId}` | `subscriptionsApi.unsubscribe` |
| `POST` | `/api/opus/attachments` | `attachmentsApi.uploadFile` (multipart) |
| `GET` | `/api/opus/attachments/{id}/preview` | route handler de preview |
| `GET` | `/api/opus/attachments/{id}/public` | route handler público |
| `POST` | `/api/auth/present` | `presentInApi` (server-side, `apiClientBase`) |

## Flujos detectados (parciales)

Interacciones entre servicios encontradas en el código. No hay publicación ni consumo de eventos:
`opus-web` no habla con NATS.

| # | Origen | Destino | Disparador | Datos |
|---|---|---|---|---|
| 1 | navegador | `opus-web` → `api` | Cualquier lectura o escritura de la UI | Proxy catch-all con `Bearer` del usuario |
| 2 | `opus-web` | Zitadel | Login | Authorization Code + PKCE; scope con audiencia del proyecto |
| 3 | `opus-web` | Zitadel | `profile()` con ID token incompleto | `GET /oidc/v1/userinfo` con el access token |
| 4 | `opus-web` | `api` | Callback de login (`/login/enter`) | `POST /api/auth/present`, server-side. **Errores tragados** |
| 5 | navegador | `opus-web` → `api` | Subida de adjunto | `multipart/form-data` reenviado como `ArrayBuffer` con `duplex: 'half'` |
| 6 | navegador | `opus-web` → `api` | `<img src>` de un adjunto | `GET /api/attachments/{id}/preview`, con sesión |
| 7 | cualquiera | `opus-web` → `api` | Link de descarga pública | `GET /attachments/{id}/{fileName}` → `/public`, **sin sesión** |

**Para la consolidación:** el flujo 7 es el único punto de la plataforma donde este frontend sirve
contenido sin autenticar. Hay que confirmar contra `api` qué valida el endpoint `/public`.

## Información para consolidación del PRD

### Capacidades de producto que este servicio evidencia

1. **Portal de seguimiento para clientes** — un cliente externo entra con su identidad y ve el
   estado de los proyectos que le asignaron.
2. **Alta de requisitos por el cliente** — el cliente crea el requisito, elige tipo y prioridad y
   adjunta archivos. Nace siempre en `analisis`.
3. **Conversación sobre el requisito** — comentarios con adjuntos embebidos, en un feed que mezcla
   comentarios y cambios de estado.
4. **Suscripción a un requisito** — un cliente pide seguir un requisito para enterarse de los
   cambios. (El canal de notificación no está en este servicio.)
5. **Visibilidad diferenciada** — el feed solo muestra actividad pública; el tipo
   `visibilityLevel: 'internal'` existe en los tipos y nunca se crea desde acá.
6. **Gestión desde el portal por parte del equipo** — un usuario interno que entre a este portal
   puede cambiar estado y prioridad inline. **No es una capacidad de cliente**; conviene confirmar
   si es intencional.

### Vocabulario de dominio observado

| Término en código | Etiqueta en UI | Nota |
|---|---|---|
| `requirement` | "Requisito" / "requisito" | En `MobileMenu` (código muerto) aparece como "Nueva tarea" |
| `project` | "Proyecto" | — |
| `requirementActivity` | "Actividad" | Comentarios + cambios de campo |
| `subscriptor` | "Suscriptor" | El endpoint usa `subscriptors` (sic) |
| `state` | "Estado" | 7 valores |
| `priority` | "Prioridad" | 5 valores, incluido `sin_prioridad` |
| `type` | "Tipo" | `funcionalidad`, `mejora`, `incidencia`, `otro`; `sin_tipo` como ausencia |
| `resolutionComment` | "Resolución" | Solo se muestra en `incidencia` |

**Descripciones de tipo, verbatim de `CreateRequirementModal.types.ts:32-61`** — sirven como
definición funcional:

- **Funcionalidad**: "nueva función del sistema"
- **Mejora**: "optimización de algo existente"
- **Incidencia**: "bug, error o comportamiento inesperado"
- **Otro**: "tarea operativa, documentación, gestión, etc."

### Reglas de negocio replicadas (no autoritativas)

| Regla | Dónde |
|---|---|
| Los 7 estados y su orden | tres listas separadas en `KanbanBoard`, `ListView`, `MobileRequirementsBoard` |
| Un requisito nace en `analisis` | `CreateRequirementModal.tsx:314-318` |
| Tipo por defecto `otro` | `CreateRequirementModal.tsx:227` |
| Solo el título es obligatorio | `CreateRequirementModal.tsx:217-221` |
| `resuelto` y `cancelado` colapsados por defecto | `ListView.tsx:32`, `KanbanBoard.tsx:35` |
| Solo rol interno cambia estado/prioridad | `ListRequirementRow.tsx:119`, `KanbanCard.tsx:102` |
| Adjuntos: 10 MB, 12 extensiones | duplicado en dos componentes |
| La resolución solo se muestra en incidencias | `RequirementInfoPanel.tsx:154` |
| Los comentarios se crean como `public` | `requirementsApi.ts:71-77` |

### Relación con `web`

Los dos frontends comparten stack y **difieren en tres decisiones estructurales**:

| | `web` | `opus-web` |
|---|---|---|
| Datos | Server Actions + axios de servidor | axios de navegador + proxy catch-all |
| Guard | layout de `(loggedin)/` | `middleware.ts` |
| Corte por rol | redirige `external-user` a `/unauthorized` | ninguno |
| Variables de NextAuth | `AUTH_*` (v5) | `NEXTAUTH_*` (v4) |

Comparten la app OIDC de Zitadel (mismo `ZITADEL_CLIENT_ID`) con secretos de sesión distintos.

`RichContentRenderer` parsea el formato de adjuntos de los dos frontends, lo que confirma que el
contenido creado en uno se lee en el otro.

## Configuración

| Variable | Obligatoria | Nota |
|---|---|---|
| `API_URL` | sí | **Debe terminar en `/`**: dos de los cuatro consumidores lo interpolan directo |
| `NEXTAUTH_SECRET` | sí | Distinto del de `web` |
| `NEXTAUTH_URL` | sí en producción | Nombres de v4 |
| `ZITADEL_ISSUER` | sí | Compartido con `web` |
| `ZITADEL_CLIENT_ID` | sí | Compartido con `web` |
| `ZITADEL_PROJECT_ID` | sí | Si está mal, **los roles llegan vacíos y no falla nada visiblemente** |

Sin `ZITADEL_CLIENT_SECRET`: cliente público con PKCE.
Sin validación de configuración al arrancar.

## Testing

**296 tests en 51 archivos. Todos pasan** (`npx vitest run`, ~13 s).

- Vitest + Testing Library + jsdom, `TZ=UTC` fijado.
- CSS Modules procesados de verdad con `generateScopedName: '[local]'`, para poder asertar sobre
  clases sin hashear.
- **Mock manual de `react-markdown`** (~190 líneas) porque la librería no funciona en jsdom.
- **Los cuatro route handlers tienen test** — lo más valioso del set.
- **Tests en dos ubicaciones**: `__tests__/` (34) y junto al código (17). El README lo reconoce
  como convención a unificar.

**Sin cobertura:** `middleware.ts` (el guard de toda la aplicación), la config de NextAuth,
`presentInApi`, `ProjectContext`, `lib/axios.ts` (los interceptores) y los seis hooks de
`requirements`.

## Deploy

- Imagen `gravadigital/jiku-opus-web`, multi-stage, node 24.12-alpine3.23, usuario no-root.
- **Contexto de build = raíz del monorepo.** `CMD ["node", "opus-web/server.js"]`.
- Publicada por `dev-images.yml` (tags `dev` + `dev-{sha}`) y `release.yml`, en una matriz de
  cuatro servicios.
- En producción: puerto 3000, solo en `ingress-network`, detrás de `nginx-proxy` + Let's Encrypt.
  Local: publicado en el 3001.
- Sin healthcheck, sin límites de recursos, sin deploy automático.

> `deploy/README.md:230` dice "opus-web on 3002"; el compose publica **3001**. Inconsistencia en la
> documentación de deploy.

## Deuda técnica detectada

### Bloqueante para uso real en mobile

- **No hay navegación en mobile.** El `Sidebar` es `display:none` bajo 768px
  (`Sidebar.module.scss:13`) y el layout del dashboard no monta ningún reemplazo. El `MobileMenu`
  que cumpliría ese rol es código muerto. En un teléfono no se puede cambiar de proyecto ni cerrar
  sesión.

### Código muerto (9 componentes)

`Header`, `MobileMenu`, `PageContainer`, `ProjectList`, `ProjectCard`, `RequirementFilters`,
`SubscribeButton`, `Card`, `Badge`. Seis están exportados desde un barrel, así que aparecen como
disponibles. Ocho tienen tests que pasan.

**`Header` no es un componente suelto:** es un shell de navegación superior completo (dropdown de
proyectos, "Nueva tarea", logout, menú mobile), en paralelo a `Sidebar`. Cuál se pensaba usar no se
puede determinar desde el código.

### Duplicaciones

| Qué | Dónde |
|---|---|
| Suscripción | `requirementsApi.subscribe/unsubscribe` (sin uso) vs `subscriptionsApi` |
| Comentario | `requirementsApi.addActivity` → `/comment` (sin uso) vs `commentsApi.create` → `/comments` |
| Lista de estados | tres declaraciones + etiquetas en cinco archivos más |
| Validación de adjuntos | literal entre `CommentInput.tsx:11-25` y `CreateRequirementModal.tsx:22-36` |
| Config de TanStack Query | `lib/queryClient.ts` (sin uso) vs `providers.tsx` |
| Dropdown | componente `Dropdown` con portal vs tres paneles inline en `CreateRequirementModal` |
| Paleta de estados/prioridades | 5 módulos SCSS + `requirement.constants.ts` |
| Breakpoint 768 | `_mixins.scss:25` y `useIsMobile.ts:3` |
| Detalle de requisito | `RequirementDetailModal` y `RequirementDetailView` (paneles de 558 y 559 px) |

### Bugs latentes y restos

- **`StateAccordion` mapea etiquetas inexistentes.** `getStateDataAttribute` traduce `Backlog`,
  `Activo`, `En revisión`, `Finalizado` — ninguna está en el enum actual. Siempre cae al fallback
  `'backlog'`: todos los acordeones de mobile se pintan igual.
- **`BoardHeader` recibe `onNewRequirement` y lo ignora** (`:24`). La pantalla se lo pasa y no hay
  botón que lo dispare.
- **El botón "Nueva tarea" de `MobileMenu` no tiene `onClick`** (`:149-151`).
- **`useCreateRequirement` invalida `['requirements', projectId]`**, la key de un hook que nadie
  monta. Funciona igualmente porque es prefijo de las keys del tablero — verificado contra la
  librería. Vale saberlo antes de "arreglarlo".
- **`react-hook-form` declarado y nunca importado.**
- **`NEXT_PUBLIC_APP_VERSION` inyectada y nunca leída.**
- **La fuente Geist Mono se carga y no se aplica**: `--font-geist-mono` no aparece en ningún SCSS.
- **`token.error = null`** se setea en el callback `jwt` y nunca se lee.
- **`<html lang="en">`** en una interfaz enteramente en español.
- **Tuteo inconsistente**: "No tienes proyectos asignados" (tú) contra "Intentá de nuevo más tarde"
  (vos).

### Estados de UI ausentes

- `/projects/[id]/requirements` no tiene estado de error ni de empty.
- `CreateRequirementModal` no muestra el error de creación: el botón vuelve de "Creando..." a
  "Crear elemento" sin mensaje.
- Las mutaciones de suscripción no avisan: el error es la palabra "Error" en el propio botón.
- `UserSelector` muestra "Sin usuarios disponibles" tanto si la lista está vacía como si falló.
- Sin `error.tsx` ni `not-found.tsx` en ninguna ruta.

Detalle por pantalla en el relevamiento UX.

### Accesibilidad

- **Elementos clickeables que no son botones**, sin `role`/`tabIndex`/teclado: los proyectos del
  `Sidebar` (`:71-75`), las filas de `ListRequirementRow` (`:143`), las opciones de los dropdowns
  inline de `CreateRequirementModal`. (`ProjectCard` y `RequirementCard` sí lo hacen bien.)
- **Ningún modal atrapa el foco** ni lo devuelve al cerrar.
- **`ListView` es una tabla hecha con `<div>` + `display:grid`**, sin roles ARIA de tabla.

### Seguridad — a verificar contra `api`

- **El proxy catch-all no filtra paths ni métodos.** Expone toda la superficie de `/api/opus/*` a
  cualquier usuario logueado. Válido solo si `api` autoriza por rol en cada endpoint.
- **`GET /attachments/{id}/{fileName}` es público.** La autorización la decide `api` en
  `/attachments/{id}/public`.
- **Un usuario interno en este portal puede cambiar estado y prioridad.** Confirmar si es
  intencional.

## Documentación generada

- [`docs/architectures/opus-web/`](../../architectures/opus-web/index.md) — 16 archivos: overview,
  environment, deployment, developer-standards, manifest y 10 convenciones
- [`docs/analysis/ux/opus-web/`](../ux/opus-web/index.md) — relevamiento UX: índice + pantallas

No se generó API spec ni esquema de base: es un frontend.

## A confirmar en consolidación

1. **¿Un usuario interno debería poder operar desde el portal de clientes?** Hoy puede cambiar
   estado y prioridad inline.
2. **¿Qué valida `GET /api/opus/attachments/{id}/public`?** Es el único punto sin autenticar.
3. **¿El proxy catch-all debería tener allowlist?** Depende de que `api` autorice por rol en cada
   endpoint de `/api/opus/*`.
4. **¿Cuál era el shell previsto: `Sidebar` o `Header`?** Están los dos; solo uno se renderiza.
5. **¿El portal debe usarse en mobile?** Si sí, hoy no hay navegación bajo 768px.
6. **¿Qué canal usa la suscripción?** El portal permite suscribirse pero no muestra ninguna
   notificación.
7. **¿"Requisito" o "tarea"?** La UI viva dice requisito; el código muerto dice tarea.
8. **¿Los comentarios internos se van a exponer alguna vez?** El tipo `visibilityLevel: 'internal'`
   existe en los tipos y nunca se usa acá.
