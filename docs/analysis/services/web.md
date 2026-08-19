---
document: Service Analysis
service: web
type: frontend
repo_path: web/
date: 2026-08-18
status: analizado
---

# Análisis de servicio: web

> Análisis temporal producido por `/product-analyze-service`. Es insumo para
> `/product-consolidate-services`, no documentación final.

## Identificación

| Campo | Valor |
|---|---|
| **Nombre** | `web` (paquete `@jiku/web`) |
| **Tipo** | Frontend |
| **Path** | `web/` — workspace del monorepo `jiku` |
| **Propósito** | Frontend interno del equipo: gestión de actores, proyectos, requisitos, tareas, asignación de tiempo y horas trabajadas |
| **Responsabilidad** | Única interfaz de uso interno sobre la API `jiku-api`. Traduce el modelo de la API a las pantallas de trabajo diario del equipo y resuelve la autenticación OIDC del lado del servidor |
| **Audiencia declarada en código** | Roles `admin`, `user`, `external-user` (claim del token). Un `external-user` ve navegación reducida y es redirigido fuera de las secciones de tiempo — su portal es `opus-web` |

### Stack técnico

| Capa | Tecnología | Versión | Origen |
|---|---|---|---|
| Framework | Next.js — App Router, `output: 'standalone'` | 16.1.1 | `web/package.json`, `web/next.config.js:14` |
| UI | React | 19.2.3 | `web/package.json` |
| Lenguaje | TypeScript, `strict: true` | 5.9.3 | `web/tsconfig.json:11` |
| Estado de servidor | TanStack Query | 5.90.12 | `web/src/lib/queryClient.ts` |
| Estado de cliente | React Context (2 providers) | — | `web/src/contexts/` |
| Autenticación | NextAuth v5 (beta) + provider Zitadel | 5.0.0-beta.32 | `web/src/lib/auth.ts` |
| Cliente HTTP | axios (servidor) + `fetch`/`XMLHttpRequest` (cliente) | axios 1.13.2 | `web/src/lib/axios.ts` |
| Estilos | Sass + CSS Modules + custom properties | sass 1.97.1 | `web/src/styles/`, 117 `*.module.scss` |
| Formularios | `react-hook-form` + `yup` + estado manual (tres enfoques conviviendo) | rhf 7.69, yup 1.7 | ver Deuda técnica |
| Selects | `InputSelect` propio + `react-select` | react-select 5.10.2 | ver Deuda técnica |
| Markdown | `react-markdown` + `remark-gfm` + `remark-breaks`; edición con `easymde` | — | `web/src/features/attachments/components/MarkdownViewer/` |
| Testing | Vitest + Testing Library, entorno jsdom, `TZ=UTC` fijado | vitest 4.0.18 | `web/vitest.config.mts` |
| Lint/format | ESLint 9 (flat config) + `import/order` alfabético, Prettier | eslint 9.39.2 | `web/eslint.config.mjs` |
| Empaquetado | Docker multi-stage, node 24.12-alpine3.23, contexto = raíz del monorepo | — | `web/Dockerfile` |

## Estructura

Arquitectura **feature-first** con una capa compartida transversal.

```
web/src/
  app/           25 rutas (App Router) + 7 route handlers + 3 layouts + 4 loading + 5 error
    (loggedin)/  grupo protegido: auth + redirect en el layout
    api/         BFF: lo que el navegador no puede hacer server-side
    login/       login OIDC y callback de entrada
  features/      7 dominios, cada uno con components/ hooks/ services/ types/ utils/
  shared/        33 componentes ui/ + 5 layout/ + utils/ + types/
  lib/           auth.ts, axios.ts, queryClient.ts
  contexts/      ProjectContext, SidebarContext
  styles/        _variables.scss (tokens), _mixins.scss (mixins + breakpoints)
  assets/        SVG/PNG de navegación, logos externos, iconos de etapa
```

**Dominios en `features/`:** `attachments`, `auth`, `clients`, `objectives`, `projects`,
`requirements`, `time-allocation`, `worked-times`.

## Features principales

### Actores (`clients`)
- Listado con búsqueda con debounce, filtro por estado y 5 órdenes; filtros en la URL.
- Board de filas expandibles: al abrir un actor muestra su descripción en markdown y las cards
  de sus proyectos. Paginación por "Ver más" calculada según el alto disponible.
- El estado del actor (`activo`/`inactivo`) **se deriva en el cliente** de si tiene algún
  proyecto en `activo` o `analisis` — no viene de la API (`ClientsBoard.tsx:17`).
- Alta y edición con nombre + descripción markdown.

### Proyectos
- Listado filtrable por búsqueda, tipo, estado y orden, en grilla de cards.
- Detalle a dos columnas: descripción, sección de requisitos y de tareas (ambas con tabs por
  estado, paginación y contadores), e información general, propiedades y adjuntos.
- Alta y edición con `keyValuePairs`: tres claves fijas (`documentacion`, `board_de_tareas`,
  `diseño`) más propiedades dinámicas que el usuario agrega y borra.

### Requisitos
- Listado paginado (15/20/25) con filtros y tooltip de responsables múltiples.
- Detalle: header con pills-dropdown editables (estado, tipo, prioridad) + card de estado con
  **stepper de workflow** y campos en acordeón que se abren según el estado
  (`analisis`→alcance, `planificacion`→propuesta y criterios, `en_cola`→cierre estimado).
- Reglas de flujo en código: `analisis → planificacion → en_cola → desarrollo → revision`, y
  para `type: incidencia` se saltea `en_cola` (`RequirementStatusCard.tsx:44-58`).
- Card de resolución: cierre a `resuelto`/`cancelado`; campos de resolución solo para incidencias.
- Feed de actividad con comentarios interno/público y adjuntos embebidos en el markdown.
- Etiquetas clave:valor con sugerencias desde la API.
- Reporte con filtros y export CSV client-side.

### Tareas (`objectives`)
- Tabla paginada con 7 filtros (búsqueda, estado múltiple, proyecto, responsable, área, orden).
- Dos vistas agregadas: **por proyecto** (con horas del mes por proyecto y scroll al ancla) y
  **por responsable** (agrupado y ordenado por fecha estimada).
- Detalle con metadatos, historial de cambios y comentarios editables.
- Alta **multi-formulario**: se pueden clonar y borrar formularios para crear varias tareas en
  un submit.
- Cambio de estado inline desde el tag de la tabla y de las cards.

### Asignación de tiempo
- Grilla semanal proyecto × persona con celdas editables en horas.
- Agrupada en "Comerciales activos", "Internos activos", "En análisis".
- Precarga los valores de la semana anterior cuando la semana actual está vacía y el usuario es
  `admin` (`WeeklyAllocationTable.tsx:203-205`).
- Solo `admin` edita y guarda.

### Horas trabajadas
- Carga diaria: selector de día con semáforo (completo/parcial/vacío según
  `/settings/hours-per-day`), modo Presente/Ausente, selector agrupado de
  proyecto/requisito/tarea, botones de horas y minutos, y listado del día con borrado
  confirmado.
- `admin` puede cargar en nombre de otra persona.
- Reporte: filtros de período (esta semana / semana pasada / este mes / mes pasado / rango),
  toggle por persona o por proyecto, filtro por tipo de proyecto, 4 cards de resumen y tabla
  jerárquica de 4 niveles (persona → proyecto → requisito → tarea, más rama de ausencias).

### Adjuntos (transversal)
- Uploader con drag & drop, barra de progreso vía `XMLHttpRequest`, validación de tipo/tamaño.
- Listado con "Ver más", preview modal (imagen y PDF), descarga y borrado confirmado.
- Placeholders `placeholder:` y `fileplaceholder:` que el `MarkdownViewer` resuelve a
  componentes de preview embebidos.
- Soporta adjuntar a borradores sin entidad (`requirement_draft` anclado al usuario).

## Decisiones técnicas identificadas

> El "por qué" está **inferido del código y de sus comentarios**. Donde el código no lo
> explica, se marca como no determinable.

1. **Server Actions con axios de servidor.** Los `services/*Api.ts` llevan `'use server'` y usan
   un `apiClient` cuyo interceptor llama a `auth()` — que solo corre en el servidor. El comentario
   en `axios.ts:15-16` lo dice explícito: por eso la URL puede leerse de `API_URL` en runtime sin
   embeberse en el bundle. **Consecuencia:** el access token nunca llega al navegador.

2. **BFF selectivo en `app/api/`, no generalizado.** Solo existen route handlers para lo que el
   cliente no puede resolver server-side: streaming de uploads con `duplex: 'half'`, descarga y
   preview con header `Authorization`, el PATCH optimista de requisitos, el alta de actores desde
   un componente cliente y el proxy a `/oidc/v1/userinfo`. El resto va por Server Action.

3. **Autorización en el layout, no en middleware.** No hay `middleware.ts`. El grupo
   `(loggedin)/layout.tsx` hace `await auth()`, redirige a `/login` sin sesión y a
   `/unauthorized` si el rol es `external-user`, con `export const dynamic = 'force-dynamic'`.
   Tres rutas repiten el chequeo de `external-user` a nivel de página (`time-allocation`,
   `worked-times`, `worked-times/report`) redirigiendo a `/projects`.

4. **CSS Modules + custom properties, sin librería de componentes.** 117 módulos SCSS y un
   `:root` con ~70 tokens en `_variables.scss`. Los mixins de `_mixins.scss` encapsulan
   tipografía, botones, inputs, tags y focus rings. No hay Tailwind ni MUI.

5. **TanStack Query como única capa de cache**, con query keys por dominio
   (`['projects', filters]`, `['requirement', reqid]`), `staleTime` 30s, `gcTime` 5min,
   `retry: 1` en queries y `0` en mutations. Update optimista solo en `useUpdateRequirement`.

6. **Sesión JWT de 12 horas** (`auth.ts:21`) y el callback `jwt` devuelve `null` cuando el
   `expiresAt` del access token pasó, forzando re-login.

7. **`SessionProvider` con refetch desactivado** (`refetchInterval={0}`,
   `refetchOnWindowFocus={false}`) — `providers.tsx:18`. Motivo no determinable desde el código.

8. **Timezone fijada en los tests** a UTC, con el comentario explicando que un literal
   `'2026-08-01'` se parsea como medianoche UTC y sin esto los tests pasan local y fallan en CI
   (`vitest.config.mts:10-14`).

9. **Docker con contexto en la raíz del monorepo.** El Dockerfile documenta que `output:
   'standalone'` en un workspace emite el árbol completo, con `node_modules` hoisteados en la
   raíz de `standalone/` y el server en `standalone/web/` — de ahí el `CMD ["node",
   "web/server.js"]`.

## Interfaces

### Expone

| Tipo | Detalle |
|---|---|
| `web_ui` | 25 rutas. 21 protegidas bajo `(loggedin)`, 4 públicas (`/`, `/login`, `/login/enter`, `/unauthorized`) |
| `http_api` (BFF) | `POST /api/attachments` · `GET /api/attachments/[id]/download` · `GET /api/attachments/[id]/preview` · `POST /api/clients` · `PATCH /api/requirements/[reqid]` · `GET /api/userinfo` · `GET|POST /api/auth/[...nextauth]` |

Los 6 primeros exigen sesión: devuelven `401 {"error":"Unauthorized"}` si `decodedToken()` no
trae `accessToken`.

### Consume

| Tipo | Target | Detalle |
|---|---|---|
| `api` | `jiku-api` vía `API_URL` | ~45 endpoints REST bajo `{API_URL}/api`. Ver detalle abajo |
| `external_service` | Zitadel (OIDC) | Authorization code + PKCE; scope incluye `urn:zitadel:iam:org:project:id:{PROJECT_ID}:aud`. Además `GET {ZITADEL_ISSUER}/oidc/v1/userinfo` desde el BFF |
| `external_service` | Google Fonts | Tipografía `Archivo` vía `next/font/google` (`layout.tsx:3`) |

**Endpoints de `jiku-api` consumidos**, agrupados por dominio:

- **auth/persons:** `POST /auth/present` · `GET /persons`
- **clients:** `GET /clients` · `GET /clients/{id}` · `POST /clients` · `PATCH /clients/{id}`
- **projects:** `GET /projects` · `GET /projects/{id}` · `POST /projects` ·
  `PATCH /projects/{id}` · `DELETE /projects/{id}` · `GET /projects/objectives-summary`
- **objectives:** `GET /objectives` (y `&count=true`) · `GET /objectives/{id}` ·
  `POST /objectives` · `PATCH /objectives/{id}` · `DELETE /objectives/{id}` ·
  `POST /objectives/{id}/comments` · `PATCH /objectives/{id}/comment/{commentId}`
- **requirements:** `GET /requirements` · `GET /requirements/{reqid}` · `POST /requirements` ·
  `PATCH /requirements/{reqid}` · `POST /requirements/{reqid}/comments` ·
  `GET /requirements/report` · `GET /requirements/tags/suggestions`
- **worked-times:** `GET /worked-times` · `POST /worked-times` · `DELETE /worked-times/{id}` ·
  `GET /worked-times/person-objectives` · `GET /worked-times/person-requirements` · reportes por
  persona y por proyecto
- **unworked-times:** `GET /unworked-times` · `POST /unworked-times` ·
  `DELETE /unworked-times/{id}` · `GET /unworked-times/reasons` · reportes
- **time-allocation:** `GET /week-assigned-times` · `PUT /week-assigned-times` ·
  `GET /settings/hours-per-day`
- **attachments:** `GET /attachments` · `GET /attachments/{id}` ·
  `DELETE /attachments/{id}` · `POST /attachments` · `GET /attachments/{id}/download` ·
  `GET /attachments/{id}/preview`

## Flujos detectados (parciales)

Interacciones entre servicios encontradas en el código de este frontend. Los contratos exactos
se confirman al analizar `api`.

| # | Origen | Destino | Disparador | Detalle |
|---|---|---|---|---|
| 1 | `web` | Zitadel | click en "Iniciar sesión" (`login/page.tsx:13`) | `signIn('zitadel', {callbackUrl: '/login/enter'})`. El `profile()` extrae `id` del `sub` y los roles del claim `urn:zitadel:iam:org:project:{PROJECT_ID}:roles` |
| 2 | `web` | `api` | tras el callback OIDC (`login/enter/page.tsx:7`) | `POST /auth/present` con body vacío. **Los errores se tragan** (`console.warn` y sigue) — `authApi.ts:19-21` |
| 3 | `web` | `api` | toda lectura/escritura de dominio | axios con `Authorization: Bearer {session.accessToken}`. Un `401` de la API redirige el navegador a `/login` (`axios.ts:46-51`) |
| 4 | `web` (BFF) | `api` | upload de adjuntos | `POST {API_URL}api/attachments` reenviando el body como stream (`duplex: 'half'`) y el `Content-Type` original |
| 5 | `web` (BFF) | `api` | preview/descarga de adjunto | reenvía el body de la respuesta y propaga `Content-Type`, `Content-Disposition`, `Content-Length` |
| 6 | `web` (BFF) | Zitadel | `GET /api/userinfo` | proxy a `{ZITADEL_ISSUER}/oidc/v1/userinfo`. **No se detectó ningún consumidor de este handler en el código del front** |

**Contrato de sesión** (`shared/types/next-auth.d.ts`): `session.user = {id, roles[],
zitadelId?}` y `session.accessToken`. El `zitadelId` se usa para resolver la persona propia
contra `/persons` en `WorkedTimesPage`.

## Información para consolidación del PRD

### Capacidades de producto que expone este servicio

1. Gestión de actores/clientes y su cartera de proyectos.
2. Gestión de proyectos con propiedades extensibles y enlaces a herramientas externas.
3. Gestión de requisitos con un workflow de estados explícito y trazabilidad de actividad.
4. Gestión de tareas, con vistas por proyecto y por responsable.
5. Planificación de capacidad semanal por persona y proyecto.
6. Registro de horas trabajadas y de ausencias, con reportes jerárquicos.
7. Adjuntos transversales a proyectos, requisitos, tareas y comentarios.
8. Visibilidad interno/público por comentario, requisito y tarea — el mecanismo por el que
   `opus-web` (portal externo) ve un subconjunto.

### Reglas de negocio visibles en el frontend

Estas reglas están **implementadas en el front** y deben verificarse contra `api` en la
consolidación: si la API no las replica, son validaciones solo de UI.

- Los requisitos de tipo `incidencia` saltean el estado `en_cola`.
- El paso a `resuelto`/`cancelado` no está en el stepper: vive en la card de resolución.
- Los campos de resolución (`resolutionType`, `resolutionConclusion`) solo se piden para
  incidencias.
- El estado de un actor se deriva de sus proyectos, no se almacena.
- Un `external-user` no accede a asignación de tiempo ni a horas trabajadas.
- Solo `admin` edita la grilla de asignación semanal y carga horas de otra persona.
- La precarga de asignaciones desde la semana anterior solo ocurre para `admin` y con la semana
  actual vacía.

### Vocabulario de dominio (etiquetas de UI → valores de API)

| Concepto | Valores |
|---|---|
| Estado de proyecto | `analisis`, `activo`, `inactivo`, `finalizado`, `cancelado` |
| Tipo de proyecto | `interno`, `comercial`, `investigacion`, `propuesta` |
| Estado de requisito | `analisis`, `planificacion`, `en_cola`, `desarrollo`, `revision`, `resuelto`, `cancelado` |
| Tipo de requisito | `funcionalidad`, `mejora`, `incidencia`, `otro` |
| Prioridad de requisito | `sin_prioridad`, `baja`, `media`, `alta`, `urgente` |
| Estado de tarea | `backlog`, `activo`, `en_revision`, `finalizado`, `cancelado` |
| Área de tarea | `diseño`, `desarrollo`, `gestion`, `investigacion` |
| Visibilidad | `public`, `internal` |
| Motivo de ausencia | `tramite`, `corte_servicios`, `vacaciones`, `dia_no_laborable`, `personal`, `medico`, `estudio`, `enfermedad`, `otro` |
| Tipo de entidad de adjunto | `project`, `objective`, `stage`, `requirement_draft`, `comment_draft`, `objective_comment`, `requirement_comment`, `objective_comment_draft`, `requirement_comment_draft` |

Nota terminológica: la UI dice **"Actores"** donde la API y la base dicen `clients`, y
**"Tareas"** donde dicen `objectives`. Esto ya está registrado en `docs/apis/core.yaml`.

## Configuración

| Variable | Uso | Origen |
|---|---|---|
| `API_URL` | base de la API, leída en runtime en el servidor | `src/lib/axios.ts:17` y 6 route handlers |
| `AUTH_URL`, `AUTH_SECRET` | NextAuth v5 | `deploy/docker-compose.yml:20-21`, README |
| `ZITADEL_ISSUER` | issuer OIDC y base de `/oidc/v1/userinfo` | `src/lib/auth.ts:70`, `api/userinfo/route.ts:5` |
| `ZITADEL_CLIENT_ID`, `ZITADEL_CLIENT_SECRET`, `ZITADEL_PROJECT_ID` | aplicación OIDC; el project id arma el scope de audiencia y la clave del claim de roles | `src/lib/auth.ts:4` |
| `APP_NAME`, `APP_DESCRIPTION` | metadata del documento y `alt` del logo | `src/app/layout.tsx:12-15` |
| `EXTERNAL_LINKS` | JSON con accesos a herramientas del equipo en el pie de la navegación; vacío = bloque oculto | `Navbar.tsx:119-137` |
| `LOG_ACCESS_TOKEN` | imprime el access token por consola | `authApi.ts:8` — ver Deuda técnica |

**Inconsistencia detectada:** `web/.env.test` define `NEXTAUTH_URL` / `NEXTAUTH_SECRET` (nombres
de NextAuth v4) mientras el deploy y el README usan `AUTH_URL` / `AUTH_SECRET` (v5). También
declara `NEXT_PUBLIC_API_URL`, que no se usa en ningún archivo de `src/`.

## Testing

| Métrica | Valor |
|---|---|
| Archivos de test | 73 |
| Casos (`it`/`test`) | 644 |
| Bloques `describe` | 109 |
| Runner | Vitest 4, entorno jsdom, `globals: true` |
| Setup | `tests/setup.ts`: jest-dom, polyfill de `ResizeObserver` y de `HTMLDialogElement.showModal`/`close` |

Los tests viven junto al código (`*.test.tsx`). Cobertura por área: `requirements` es la más
cubierta (17 archivos), luego `worked-times` (9) y `shared/components/ui` (10). Cubre además 9
páginas de ruta y los 2 route handlers de adjuntos.

**Sin cobertura:** ningún test para `clients`, `time-allocation`, `contexts/`, `lib/` (auth,
axios, queryClient) ni `shared/components/layout` salvo `Navbar`.

## Deploy

- Imagen `gravadigital/jiku-web:${WEB_VERSION}`, puerto 3000, usuario no-root `nextjs` (uid 1001).
- Build multi-stage con `npm ci --ignore-scripts --workspace web --include-workspace-root`; el
  `--ignore-scripts` evita el `postinstall` de la raíz que compila `packages/*`, que este front
  no consume.
- En producción `API_URL=http://api:3000/` (red interna de Docker), TLS y virtual host por
  `nginx-proxy` + `letsencrypt` vía `VIRTUAL_HOST` / `LETSENCRYPT_HOST`.
- CI: `.github/workflows/ci.yml` corre lint + test de los 4 workspaces;
  `dev-images.yml` publica `dev` y `dev-<sha>` en cada push.

## Deuda técnica detectada

Hallazgos factuales, con evidencia. No son propuestas de solución.

### Bloqueantes para producción

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | `useSessionMonitor` es un no-op. El cuerpo real está comentado y el comentario dice *"Local development — auth bypassed… Remove this comment and restore the redirect when deploying."* El componente `SessionMonitor` se monta en el layout protegido y no hace nada | `src/hooks/use-session-monitor.ts:3-10`, `src/app/(loggedin)/layout.tsx:24` |
| 2 | `presentInApi` imprime el access token completo por consola si `LOG_ACCESS_TOKEN=true`. El comentario dice *"Temporal (entorno local)… Sacar antes de mergear."* | `src/features/auth/services/authApi.ts:6-15` |
| 3 | La home renderiza `<h1>Home</h1>`; el `redirect('/clients')` está comentado | `src/app/page.tsx:3-13` |

### Código muerto

| Elemento | Evidencia |
|---|---|
| 11 componentes sin ningún uso en JSX: `Card`, `Header`, `Input`, `Textarea`, `MarkdownEditor`, `MultiSelect`, `AttachmentDownload`, `ClientsDrawer`, `ProjectDetails`, `ProjectActiveObjectives`, `ProjectInactiveObjectivesTable` | 8 de ellos exportados desde `src/shared/components/ui/index.ts` |
| `ProjectContext` y `SidebarContext` se montan en `providers.tsx:19-20` y **ningún componente llama a `useActiveProject` ni a `useSidebar`** | `src/contexts/`, sin consumidores |
| `GET /api/userinfo` no tiene consumidores en el front | `src/app/api/userinfo/route.ts` |
| `ProjectDetails.module.scss` es uno de los 5 archivos con tratamiento responsive — y su componente es código muerto | `ProjectDetails.module.scss:25` |

### Inconsistencias de implementación

| # | Hallazgo | Evidencia |
|---|---|---|
| 1 | **Tres enfoques de formulario** conviviendo: `react-hook-form` + `@hookform/resolvers`, validación `yup` manual con `validateSync`, y `useState` crudo con validación ad-hoc | `projects/new/page.tsx:184`, `CreateRequirementForm.tsx`, `NewClientForm.tsx` |
| 2 | **Dos enfoques de select**: `InputSelect`/`InputMultipleSelect` propios y `react-select` directo. El objeto `selectStyles` de `react-select` está duplicado en 5 archivos | `projects/new/page.tsx:87-138`, `RequirementFilters.tsx:40-95`, `CreateRequirementForm.tsx:60-190`, `WorkedTimesPage.tsx:33-45`, `TargetSelector.tsx:30-50` |
| 3 | `Pagination` hardcodea el destino `/objectives`, así que solo funciona en esa ruta. Las demás pantallas paginadas reimplementan su propia paginación inline (3 veces) | `Pagination.tsx:35`; reimplementaciones en `RequirementList.tsx:196`, `ProjectObjectivesSection.tsx:159`, `ProjectRequirementsSection.tsx:164`, `RequirementDetail.tsx:227` |
| 4 | Los tokens de color están **duplicados**: `globals.scss` y `_variables.scss` declaran el mismo `:root` con los mismos valores | `src/app/globals.scss:4-77` vs `src/styles/_variables.scss:6-160` |
| 5 | `PageLayout` usa `next/head`, que no tiene efecto en el App Router — el `<title>` real lo pone `metadata` en `layout.tsx` | `PageLayout.tsx:17-21` |
| 6 | Barrel incompleto: 8 componentes de `shared/components/ui/` no están en el `index.ts` y se importan por path directo | `AttachFileButton`, `AttachmentDownload`, `AttachmentPreview`, `AttachmentSkeleton`, `InlineCommentEditor`, `MarkdownEditorWithPreview`, `RichTextEditor`, `TintedIcon` |
| 7 | `any` explícito en handlers de submit y de click, con la regla en `warn` | `clients/edit/[id]/page.tsx:30`, `NavItem.tsx:28`, `NavSubItem.tsx:28`, `projectsApi.ts:53` |
| 8 | Typos en microcopy visible: `"Cagando..."`, `"Cargando  ..."` (doble espacio) | `projects/page.tsx:30`, `clients/page.tsx:29` |

### Responsive

El detalle completo está en el relevamiento UX. En resumen: `_mixins.scss` declara 4
breakpoints y **solo `mobile` se usa**, 6 veces en 5 archivos (uno de ellos código muerto).
En paralelo hay 14 `@media` crudas con 8 valores distintos que no pasan por los mixins. El
shell de `(loggedin)` tiene una sidebar de 290px fija sin ningún media query.

## Documentación generada

- Arquitectura: [../../architectures/web/index.md](../../architectures/web/index.md)
- Relevamiento UX: [../ux/web/index.md](../ux/web/index.md)
- No aplica API spec ni DB schema: es un frontend sin base de datos propia.

## A confirmar en consolidación

1. **Audiencias y JTBD** — el código distingue tres roles pero no dice quién es cada uno ni
   para qué usa cada pantalla.
2. **Si el desktop-only es intencional.** El código no tiene tratamiento responsive coherente;
   no se puede saber desde el código si es una decisión o una deuda.
3. **Si `/` debe redirigir** a `/clients` como sugiere el código comentado.
4. **Qué reglas de workflow de requisitos son autoritativas en `api`** y cuáles son solo
   validación de UI.
5. **Relación con `opus-web`**: ambos consumen la misma API y comparten el modelo de
   visibilidad `public`/`internal`. El reparto de responsabilidades entre los dos frontends se
   define al analizar `opus-web`.
6. **Terminología**: si "Actores"/"Tareas" es el vocabulario de producto definitivo frente a
   `clients`/`objectives` de la API.
