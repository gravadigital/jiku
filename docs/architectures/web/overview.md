# Arquitectura: web

Frontend interno de Jiku. Es la interfaz que usa el equipo: **renderiza en el servidor,
autentica ahí, y el access token nunca llega al navegador.**

- **Tipo:** frontend
- **Lenguaje:** TypeScript 5.9.3 (`strict`, target ES2017, JSX `react-jsx`)
- **Framework:** Next.js 16.1.1 (App Router) + React 19.2.3
- **Runtime:** Node.js >= 24
- **Path en el monorepo:** `web/` (workspace npm `@jiku/web`)

## La regla central: el token se queda en el servidor

```
navegador ──HTTP──> web (Next.js server) ──Bearer──> api ──NATS──> core
   │                      │
   │                      └──> Zitadel (OIDC: authorize, token, userinfo)
   └── cookie de sesión NextAuth (JWT firmado, 12 h)
```

El navegador **nunca ve el access token**. Lo hace posible una decisión concreta: los
`services/*Api.ts` llevan `'use server'`, y el interceptor de `apiClient` llama a `auth()`,
que solo corre en el servidor.

```ts
// src/lib/axios.ts:15-22
// Este cliente es de SERVIDOR: el interceptor de abajo llama a `auth()`, que solo corre
// ahí. Por eso la URL puede leerse de `API_URL` en runtime, sin embeberse en el bundle.
const apiUrl = process.env.API_URL ?? '';
export const apiClient = axios.create({ baseURL: `${apiUrl.replace(/\/$/, '')}/api` });
```

Dos consecuencias que importan al operar:

- **`API_URL` es una variable de servidor, no `NEXT_PUBLIC_*`.** Se lee en runtime, así que la
  misma imagen sirve para cualquier entorno sin rebuild. En producción apunta a la red interna
  de Docker (`http://api:3000/`), que el navegador no puede alcanzar — y no necesita.
- **No hay CORS entre navegador y api.** Todo el tráfico de **datos** sale del proceso de Next.js.
  La excepción es el **byte de un archivo**, que desde REQ-001 va del navegador directo al storage
  S3 con una URL prefirmada (y por eso el bucket sí necesita CORS, no la api).

### Cuándo se rompe la regla, y por qué

Hay tres cosas que el navegador sí tiene que iniciar, y para eso existe el **BFF** en
`src/app/api/`: son operaciones que el servidor no puede hacer *por* el cliente.

| Handler | Por qué no puede ser Server Action |
|---|---|
| `GET`/`HEAD` `/api/attachments/[id]/download` | El navegador tiene que recibir el archivo, y no puede mandar el `Authorization` |
| `GET`/`HEAD` `/api/attachments/[id]/preview` | Igual que download: la URL va en un `src`/`href` |
| `PATCH /api/requirements/[reqid]` | Update optimista de TanStack Query: necesita rollback en el cliente ante error |

Los tres repiten el mismo preámbulo: `decodedToken()`, y `401 {"error":"Unauthorized"}` si no
hay `accessToken`. Detalle en [`conventions/api-routes.md`](./conventions/api-routes.md).

> **`POST /api/attachments` existía y se eliminó (REQ-001, S-006).** Su única justificación era el
> progreso incremental de la subida (`XMLHttpRequest` + `duplex: 'half'`). Con el byte viajando
> directo a S3 el navegador tiene ese progreso sin que nada atraviese el BFF, y el handler perdió
> su razón de ser. **Ningún binario atraviesa el proceso de Next**, ni subiendo ni bajando: los dos
> handlers de lectura que quedan propagan el **302** de la api en vez de proxear el stream.

## Responsabilidades

Lo que `web` **sí** hace:

1. **Autenticación OIDC.** Flujo con Zitadel vía Auth.js v5, sesión JWT de 12 h, y expiración
   forzada cuando el access token caduca.
2. **Autorización de navegación.** Redirige sin sesión a `/login`, y a `/unauthorized` si el rol
   es `external-user`. Filtra ítems de la navegación por rol.
3. **Composición de pantallas.** Traduce el modelo de la api a las vistas de trabajo del equipo:
   listados filtrables, detalles compuestos, grillas de carga, reportes.
4. **Estado de UI.** Filtros en la URL, cache de servidor en TanStack Query, borradores de
   formulario en el cliente.
5. **Proxy autenticado** para adjuntos y para el `userinfo` del proveedor de identidad.

Lo que `web` **no** hace: reglas de negocio autoritativas. Las validaciones que implementa
(transiciones de estado de requisito, campos obligatorios, quién puede editar) son **de UI**;
la autoridad está en `api` y `core`. Ver "Reglas replicadas" más abajo.

## Estructura del proyecto

```
web/
├── next.config.js              standalone, sassOptions
├── vitest.config.mts           jsdom, TZ=UTC, alias @/ @root/ @public/
├── Dockerfile                  multi-stage; contexto = raíz del monorepo
├── tests/setup.ts              jest-dom + polyfills (ResizeObserver, HTMLDialogElement)
└── src/
    ├── app/                    App Router — 25 rutas, 7 route handlers, 3 layouts
    │   ├── layout.tsx          root: fuente Archivo, <Providers>
    │   ├── providers.tsx       QueryClient + Session + Project + Sidebar
    │   ├── globals.scss        reset + tokens en :root
    │   ├── (loggedin)/         grupo protegido: auth() + redirect + Navbar + ToastContainer
    │   ├── login/              login OIDC y callback de entrada
    │   ├── unauthorized/       corte para external-user
    │   └── api/                BFF (7 handlers)
    ├── features/               8 dominios; ver "Módulos de dominio"
    ├── shared/
    │   ├── components/ui/      33 componentes de interfaz
    │   ├── components/layout/  Navbar, NavItem, NavSubItem, PageLayout, Header
    │   ├── utils/              cn, fechas, mappers de enum a etiqueta, decodedToken
    │   └── types/              re-exports + augmentación de next-auth
    ├── lib/                    auth.ts, axios.ts, queryClient.ts
    ├── contexts/               ProjectContext, SidebarContext
    ├── hooks/                  use-current-user, use-logout, use-session-monitor
    ├── styles/                 _variables.scss (tokens), _mixins.scss (mixins, breakpoints)
    └── assets/                 SVG/PNG de navegación, logos externos, iconos de etapa
```

### Módulos de dominio

Cada módulo es una carpeta en `src/features/` con la misma forma interna: `components/`,
`hooks/`, `services/`, `types/` y, cuando hace falta, `utils/`. El barrel `index.ts` de cada uno
es la superficie pública; las rutas importan de ahí, no de rutas profundas.

| Módulo | Rutas que lo usan | Superficie |
|---|---|---|
| `clients` | `/clients`, `/clients/new`, `/clients/edit/[id]` | "Actores" en la UI |
| `projects` | `/projects` y sus 3 subrutas, más las vistas agregadas de tareas | — |
| `requirements` | `/requirements` y sus 4 subrutas | — |
| `objectives` | `/objectives` y sus 5 subrutas | "Tareas" en la UI |
| `time-allocation` | `/time-allocation` | Solo `admin` edita |
| `worked-times` | `/worked-times`, `/worked-times/report` | Oculto para `external-user` |
| `attachments` | transversal: proyectos, requisitos, tareas, comentarios | Sin ruta propia |
| `auth` | `/login/enter`, y `usePersons` desde varios módulos | — |

> **`clients` vive en dos lugares.** Existe `features/clients/` (el módulo completo) y
> `features/projects/services/clientsApi.ts` + `features/projects/hooks/useClients.ts` (una
> versión reducida que los formularios de proyecto usan para poblar el select). Son dos
> implementaciones del mismo recurso. A unificar; hoy hay que saber cuál se está importando.

## Paquetes compartidos del monorepo

**Ninguno.** A diferencia de `api` y `core`, este servicio no consume `@jiku/models`,
`@jiku/nats-protocol` ni `@jiku/zitadel-auth`. Sus tipos de dominio están declarados a mano en
`src/features/*/types/`.

Es visible en el Dockerfile, que instala con `--ignore-scripts` justamente para saltear el
`postinstall` de la raíz que compila `packages/*`:

```dockerfile
# web/Dockerfile:24-26
# --ignore-scripts: el postinstall del root compila packages/*, que estos fronts no
# consumen, y acá solo están los package.json (sin código que compilar).
```

**Consecuencia:** los tipos de `web` pueden divergir del esquema real sin que nada falle en
compilación. Si `api` cambia la forma de una respuesta, se descubre en runtime.

## Decisiones estructurales

### La autorización vive en el layout, no en un middleware

No hay `middleware.ts`. El guard está en el layout del grupo de rutas:

```tsx
// src/app/(loggedin)/layout.tsx:10-21
export const dynamic = 'force-dynamic';

const session = await auth();
if (!session) redirect('/login');
if (session.user?.roles?.includes('external-user')) redirect('/unauthorized');
```

*Consecuencia:* todo lo que esté dentro de `(loggedin)/` queda protegido por el solo hecho de
estar ahí, sin registrarlo en ninguna lista. El precio es `force-dynamic` en el grupo entero: no
hay renderizado estático de ninguna pantalla interna.

*El corolario incómodo:* **una ruta nueva fuera de `(loggedin)/` no tiene ningún guard.** Hoy las
cuatro que están afuera son intencionalmente públicas (`/`, `/login`, `/login/enter`,
`/unauthorized`), pero nada lo impide estructuralmente.

Tres páginas repiten además un chequeo propio, porque el rol no basta con el del grupo:
`time-allocation`, `worked-times` y `worked-times/report` redirigen `external-user` a
`/projects`.

### Datos en tres capas: Server Action → axios → TanStack Query

```
componente cliente
      │  useProjects({filters})            hooks/useProjects.ts
      ▼
  useQuery({queryKey: ['projects', filters]})
      │  queryFn                            services/projectsApi.ts ('use server')
      ▼
  apiClient.get('/projects?...')            lib/axios.ts (interceptor: auth() -> Bearer)
      ▼
  api
```

Las Server Actions son el único lugar donde se habla con la api, y TanStack Query es el único
cache. Las páginas de servidor pueden llamar a la Server Action directamente y saltear la capa
de hooks: `objectives/by-project` y `by-responsible` lo hacen.

*Por qué así y no `fetch` nativo con `revalidateTag`:* no está explicado en el código. Lo que sí
está es la consecuencia: la invalidación es explícita y por query key, no por tag de Next.

### El estado de los filtros vive en la URL

Los listados no guardan filtros en estado local: los escriben en `searchParams` con
`router.push` y la página de servidor los lee de `searchParams`. La búsqueda va con debounce de
500 ms antes de tocar la URL.

*Consecuencia buena:* cada vista filtrada es una URL compartible y el back del navegador
funciona. *Consecuencia mala:* cada cambio de filtro es una navegación, y con `force-dynamic`
eso es un render de servidor completo.

### `Suspense` con `key` para forzar el re-fetch al cambiar filtros

```tsx
// src/app/(loggedin)/objectives/page.tsx:34
<Suspense key={JSON.stringify(filters)} fallback={<Loader label="Cargando..." />}>
```

La `key` derivada de los filtros remonta el subárbol cuando cambian, y así el fallback vuelve a
mostrarse en cada filtrado en vez de dejar la tabla vieja en pantalla.

### Dos providers montados que nadie consume

`providers.tsx` monta `ProjectProvider` y `SidebarProvider`. **Ningún componente llama a
`useActiveProject` ni a `useSidebar`.** `ProjectContext` persiste `activeProjectId` en
`localStorage` y `SidebarContext` expone `isOpen`/`isCollapsed` para un sidebar colapsable que no
existe: el shell tiene la sidebar fija en 290 px.

Es código muerto con un provider activo, no una decisión. Ver
[`conventions/state-management.md`](./conventions/state-management.md).

### El estado del actor se calcula en el cliente

```ts
// src/features/clients/components/ClientsBoard/ClientsBoard.tsx:17
const hasActive = client.projects?.some(p => p.status === 'activo' || p.status === 'analisis');
```

La api no devuelve un estado de actor: se deriva de sus proyectos. El filtro "Estado" del listado
y el badge de cada fila salen de ahí.

*Consecuencia:* el filtro se aplica **después** de traer todos los actores con sus proyectos, no
en la query. Y el orden por defecto (`status-name`, "Activos primero") también se ordena en
memoria.

## Autenticación

Un solo plano, a diferencia de `api` (que tiene HTTP y bus).

| Qué | Cómo |
|---|---|
| Proveedor | Zitadel, provider `zitadel` de Auth.js v5 |
| Flujo | Authorization Code + PKCE. La app OIDC debe ser de tipo *User Agent / PKCE* y declarar el redirect URI exacto |
| Scope | `openid profile email urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:{ZITADEL_PROJECT_ID}:aud` |
| Roles | Del claim `urn:zitadel:iam:org:project:{ZITADEL_PROJECT_ID}:roles`, tomando sus **claves**: `admin`, `user`, `external-user` |
| Sesión | JWT firmado en cookie, `maxAge` 12 h |
| Identidad para la api | El `accessToken` de Zitadel, reenviado como `Bearer` |
| Identidad de persona | `zitadelSub` (el `sub` del access token) se resuelve contra `GET /persons` para saber qué persona es |

La sesión expira sola: el callback `jwt` devuelve `null` si `Date.now()` pasó `expiresAt * 1000`,
lo que invalida la cookie y fuerza re-login.

**El `SessionProvider` no refresca** (`refetchInterval={0}`, `refetchOnWindowFocus={false}`), así
que una sesión que caduca con la pestaña abierta se descubre en el próximo request: la api
responde 401 y el interceptor manda el navegador a `/login`.

Detalle en [`conventions/auth.md`](./conventions/auth.md).

## Reglas de negocio replicadas en el frontend

Estas reglas están implementadas en `web`. **No son autoritativas** — hay que verificar que
`api`/`core` las impongan. Si no lo hacen, son validaciones que un cliente HTTP directo saltea.

| Regla | Dónde |
|---|---|
| Recorrido habitual de trabajo `analisis → planificacion → en_cola → desarrollo → revision` — desde REQ-012 es una sugerencia del stepper y del botón de transición, no una restricción: la pill de estado permite ir a cualquiera de los siete estados, en cualquier orden | `RequirementStatusCard.tsx:44-51` |
| Para incidencias, el atajo de transición saltea `en_cola` por costumbre del recorrido — no es una restricción: la pill sigue ofreciendo `en_cola` para cualquier tipo | `RequirementStatusCard.tsx:60-67` |
| El cierre a `resuelto`/`cancelado` se sugiere desde la card de estado (botón de transición) y se confirma desde la card de resolución; desde REQ-012 ambos estados dejaron de ser terminales y se reabren con `"Reabrir"` | `RequirementStatusCard.tsx:44-67`, `RequirementResolutionCard.tsx:115-121` |
| Los campos de resolución solo se piden para incidencias | `RequirementResolutionCard.tsx:58` |
| Solo `admin` edita la grilla de asignación semanal | `WeeklyAllocationTable.tsx:79` |
| La precarga de la semana anterior solo ocurre para `admin` y con la semana vacía | `WeeklyAllocationTable.tsx:176`, `:203-205` |
| `external-user` no accede a asignación de tiempo ni horas trabajadas | `Navbar.tsx:158-165` y las 3 páginas |
| Campos obligatorios de proyecto, requisito y tarea | esquemas yup en cada formulario |

## Convenciones

Todas son **custom** y viven en [`conventions/`](./conventions/). El catálogo de Next.js del
workflow recomienda Tailwind, Zustand + nuqs, `fetch` nativo en Server Components, Server
Actions con `useActionState` + Zod y CI en GitLab; este servicio usa Sass + CSS Modules,
TanStack Query, axios de servidor, react-hook-form/yup y GitHub Actions.

No es una desviación a corregir: `web` es un frontend existente que se importó al workflow y su
stack es anterior al catálogo. Las reglas transversales del catálogo —Server Components por
defecto, TypeScript strict, el token nunca en el cliente, boundaries de error por ruta— sí
aplican y están recogidas en cada convención custom.

| id | Qué cubre |
|---|---|
| [data-fetching](./conventions/data-fetching.md) | Server Action + axios de servidor + TanStack Query; query keys |
| [mutations](./conventions/mutations.md) | Cuándo Server Action y cuándo BFF; invalidación; update optimista |
| [api-routes](./conventions/api-routes.md) | El criterio del BFF selectivo y el preámbulo de auth |
| [auth](./conventions/auth.md) | Auth.js v5 + Zitadel, guard en el layout, roles, contrato de sesión |
| [state-management](./conventions/state-management.md) | Árbol de decisión: URL, servidor, local. Los contexts muertos |
| [forms](./conventions/forms.md) | Los tres enfoques que conviven y cuál usar en código nuevo |
| [styling](./conventions/styling.md) | Sass + CSS Modules, tokens, mixins, breakpoints y su uso real |
| [error-handling](./conventions/error-handling.md) | `error.tsx`, `ApiError`, toasts, qué queda sin cubrir |
| [testing-unit](./conventions/testing-unit.md) | Vitest + Testing Library, tests junto al código, `TZ=UTC` |
| [ci-github](./conventions/ci-github.md) | CI y publicación de imágenes en GitHub Actions |
| [dockerfile](./conventions/dockerfile.md) | Multi-stage con contexto en la raíz del monorepo |

## Configuración

Ver [environment.md](./environment.md) para el detalle de cada variable.

## Deployment

Ver [deployment.md](./deployment.md) para el Dockerfile y la publicación de imágenes.

## Limitaciones conocidas

Hallazgos del relevamiento del código, con evidencia. No son propuestas de solución.

### Bloqueantes antes de un deploy real

- **`useSessionMonitor` es un no-op.** El cuerpo está comentado y el comentario dice *"Local
  development — auth bypassed… Remove this comment and restore the redirect when deploying."*
  El componente `<SessionMonitor />` se monta en el layout protegido y no hace nada
  (`src/hooks/use-session-monitor.ts:3-10`). El guard del layout sigue funcionando, así que el
  agujero no es el acceso inicial: es que una sesión que muere con la pestaña abierta no
  redirige hasta el próximo request.
- **`presentInApi` puede imprimir el access token completo** por consola si
  `LOG_ACCESS_TOKEN=true`, con el comentario *"Temporal (entorno local)… Sacar antes de
  mergear"* (`src/features/auth/services/authApi.ts:6-15`).
- **La home no lleva a ningún lado.** `/` renderiza `<h1>Home</h1>`; el `redirect('/clients')`
  está comentado (`src/app/page.tsx:3-13`). Y `/login/enter` redirige a `/` al terminar el
  login, así que el flujo de entrada termina en esa pantalla.

### Superficie sin tratamiento responsive

`_mixins.scss` declara cuatro breakpoints (`mobile` ≤767, `tablet` 768-1023, `desktop` ≥1024,
`large-desktop` ≥1440) y **solo `mobile` se usa**, 6 veces en 5 archivos — uno de ellos código
muerto. En paralelo hay 14 `@media` crudas con 8 valores distintos (640, 767, 900, 1023, 1024,
1200, 1440, 1680) que no pasan por los mixins. El shell de `(loggedin)` tiene la sidebar fija en
290 px sin ningún media query. Detalle por pantalla en el relevamiento UX.

### Código muerto

- **11 componentes sin ningún uso en JSX:** `Card`, `Header`, `Input`, `Textarea`,
  `MarkdownEditor`, `MultiSelect`, `AttachmentDownload`, `ClientsDrawer`, `ProjectDetails`,
  `ProjectActiveObjectives`, `ProjectInactiveObjectivesTable`. Ocho de ellos están exportados
  desde el barrel de `shared/components/ui/`, así que aparecen como disponibles.
- **`ProjectContext` y `SidebarContext`**, montados y sin consumidores.
- **`GET /api/userinfo`** no tiene consumidores en el frontend.

### Inconsistencias estructurales

- **Tres enfoques de formulario** conviviendo: `react-hook-form` + resolvers, yup manual con
  `validateSync`, y `useState` crudo. Ver [`conventions/forms.md`](./conventions/forms.md).
- **Dos enfoques de select**, con el objeto `selectStyles` de `react-select` duplicado en cinco
  archivos.
- **`Pagination` hardcodea `/objectives`** como destino (`Pagination.tsx:35`), así que solo sirve
  en esa ruta. Las otras cuatro pantallas paginadas reimplementan su propia paginación inline.
- **Los tokens de color están duplicados**: `globals.scss:4-77` y `_variables.scss:6-160`
  declaran el mismo `:root` con los mismos valores.
- **`PageLayout` usa `next/head`**, que no tiene efecto en el App Router (`PageLayout.tsx:17-21`).
  El `<title>` real lo pone `metadata` en `layout.tsx`.
- **Sin cobertura de tests:** `clients`, `time-allocation`, `contexts/`, `lib/` y
  `shared/components/layout/` salvo `Navbar`.

### Contrato con la api

- **Los tipos de dominio están escritos a mano** en `features/*/types/` y no derivan de
  `@jiku/models`. Pueden divergir del esquema real sin fallar en compilación.
- **`POST /auth/present` se llama y sus errores se tragan** (`console.warn` y continúa). Del
  lado de `api` ese endpoint es un no-op documentado, así que un usuario nuevo del proveedor de
  identidad no queda dado de alta y el resto de las rutas le responden 401.
