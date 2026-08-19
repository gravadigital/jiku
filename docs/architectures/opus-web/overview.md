# Arquitectura: opus-web

Portal de clientes de Jiku. Es lo que ve un cliente: **sus proyectos, sus requisitos, y nada
más.** Nunca ve horas, comentarios internos ni proyectos de otros clientes.

- **Tipo:** frontend
- **Lenguaje:** TypeScript 5 (`strict`, target ES2017, JSX `react-jsx`)
- **Framework:** Next.js 16.1.1 (App Router) + React 19
- **Runtime:** Node.js 24 (imagen `node:24.12-alpine3.23`)
- **Path en el monorepo:** `opus-web/` (workspace npm `@jiku/opus-web`)

## La regla central: el token se queda en el servidor

Igual que en `web`, el access token nunca llega al navegador. **Pero el mecanismo es otro.**

```
navegador ──/api/opus/*──> opus-web (route handler) ──Bearer──> api ──NATS──> core
   │                            │
   │                            └──> Zitadel (OIDC: authorize, token, userinfo)
   └── cookie de sesión NextAuth (JWT firmado)
```

`web` resuelve esto con Server Actions: los `services/*Api.ts` llevan `'use server'` y el axios
es de servidor. `opus-web` hace lo contrario: **el axios es de navegador, y lo que se queda en el
servidor es el destino.** El cliente pide a su propio origen y un route handler catch-all reenvía
agregando el token.

```ts
// src/lib/axios.ts:43-54
// Cliente para uso en el navegador.
//
// Apunta al MISMO ORIGEN, no a la api: `/api/opus/...` lo atiende un route handler de este
// front, que reenvía agregando el token. Así el bundle no necesita saber dónde está la api
// —no habría forma de decírselo en runtime— y el access token no sale del servidor.
export const apiClient = axios.create({ baseURL: '/', timeout: 10000, /* ... */ });
```

El handler que lo recibe:

```ts
// src/app/api/opus/[...path]/route.ts:18-40
async function forward(req: NextRequest, path: string[]) {
  const session = await auth();
  if (!session?.accessToken) {
    return NextResponse.json({ code: 'unauthorized', message: 'Unauthorized' }, { status: 401 });
  }
  const target = new URL(`api/opus/${path.join('/')}${req.nextUrl.search}`, /* base */);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  // ...
}
```

Consecuencias que importan al operar:

- **`API_URL` es una variable de servidor y se lee en cada request** (`API_URL()` es una función,
  no una constante: `route.ts:16`). La misma imagen sirve para cualquier entorno sin rebuild.
- **No hay CORS entre navegador y api.** Todo el tráfico sale del proceso de Next.js.
- **Un endpoint nuevo de `/api/opus/*` no requiere código acá.** El catch-all lo cubre solo. Es la
  diferencia práctica más grande contra el BFF selectivo de `web`, que necesita un handler por
  operación.

### El precio del catch-all

El handler reenvía **cualquier** path bajo `/api/opus/*` con el token del usuario, en cinco
métodos (`GET`, `POST`, `PATCH`, `PUT`, `DELETE`). No hay allowlist. La superficie que el
navegador puede alcanzar es la superficie completa de `/api/opus/*` en la api, no la que este
frontend usa.

Eso está bien **siempre que `api` autorice por rol en cada endpoint**, que es donde vive la
autoridad. Pero conviene tenerlo explícito: acá no hay una segunda barrera. Si un endpoint de
`/api/opus/*` no chequea el rol, este proxy lo expone a cualquier usuario logueado.

### Los dos handlers que no pasan por el catch-all

| Handler | Por qué existe aparte |
|---|---|
| `GET /api/attachments/[id]/preview` | El navegador pone la URL en un `src`/`href` y no puede mandar el `Authorization`. Chequea sesión y reenvía `Content-Type`, `Content-Disposition` y `Content-Length` |
| `GET /attachments/[id]/[fileName]` | **Sin autenticación.** Llama a `/api/opus/attachments/{id}/public` de la api. El `fileName` de la URL se ignora: sirve para que el archivo baje con nombre legible |

El segundo está fuera del matcher del middleware (`middleware.ts:46`), a propósito. **La
autorización de ese archivo la decide `api` en el endpoint `/public`, no este frontend.**

## Responsabilidades

Lo que `opus-web` **sí** hace:

1. **Autenticación OIDC.** Flujo con Zitadel vía NextAuth v5, sesión JWT, y expiración forzada
   cuando el access token caduca.
2. **Guard de navegación.** `middleware.ts` protege todo salvo `/login`, `api/*`, `attachments/*`
   y los estáticos.
3. **Composición de las pantallas del cliente.** Tres vistas del mismo tablero de requisitos
   (lista agrupada, kanban, acordeón mobile), detalle en modal y en página.
4. **Proxy autenticado** hacia `/api/opus/*` y para adjuntos.

Lo que **no** hace: reglas de negocio autoritativas. Lo que parece una regla acá —qué estados
existen, quién puede cambiar el estado— es presentación; la autoridad está en `api` y `core`. Ver
"Reglas replicadas".

## Estructura del proyecto

```
opus-web/
├── next.config.js              standalone, sassOptions includePaths
├── vitest.config.mts           jsdom, TZ=UTC, alias @/, mock de react-markdown
├── Dockerfile                  multi-stage; contexto = raíz del monorepo
├── __mocks__/react-markdown.tsx
├── __tests__/                  la mayoría de los tests
├── tests/setup.ts
└── src/
    ├── app/                    App Router — 5 páginas, 4 route handlers, 3 layouts
    │   ├── layout.tsx          root: fuente Geist Mono, <Providers>, lang="en"
    │   ├── providers.tsx       SessionProvider + QueryClient + ProjectProvider + ToastContainer
    │   ├── page.tsx            redirige a /projects o /login
    │   ├── globals.scss        @use de styles/
    │   ├── (auth)/             login y callback de entrada
    │   ├── (dashboard)/        shell con Sidebar + <main>
    │   ├── api/                proxy catch-all, NextAuth, preview de adjuntos
    │   └── attachments/        descarga pública por nombre
    ├── features/               6 dominios; ver "Módulos de dominio"
    ├── shared/
    │   ├── components/ui/      12 componentes de interfaz
    │   ├── components/layout/  Header, MobileMenu, PageContainer — los tres sin uso
    │   ├── hooks/              useIsMobile, useLogout
    │   └── types/              augmentación de next-auth
    ├── lib/                    axios.ts, queryClient.ts
    ├── contexts/               ProjectContext
    ├── styles/                 _variables.scss (tokens), _mixins.scss (mixins, breakpoints)
    ├── assets/                 logo.png
    └── middleware.ts
```

### Módulos de dominio

Cada módulo es una carpeta en `src/features/` con `components/`, `hooks/`, `services/`, `types/`
y, cuando hace falta, `constants/`. El barrel `index.ts` es la superficie pública.

| Módulo | Rutas que lo usan | Superficie |
|---|---|---|
| `auth` | `/login`, `/login/enter`, y el middleware | Config de NextAuth + `presentInApi` |
| `projects` | todas las del dashboard | El `Sidebar` vive acá, no en `shared/` |
| `requirements` | `/projects/[id]/requirements` y su subruta | El módulo grande: 11 componentes |
| `comments` | dentro del detalle de requisito | Solo `useCreateComment` + su api |
| `subscriptions` | detalle de requisito y modal de creación | Sin ruta propia |
| `attachments` | transversal | Sin ruta propia, sin componentes: solo servicio y tipos |

> **`Sidebar` está en `features/projects/`, no en `shared/components/layout/`.** Es el shell de
> navegación de toda la aplicación, pero vive en el módulo de proyectos porque lista proyectos.
> Los tres componentes que sí están en `shared/components/layout/` (`Header`, `MobileMenu`,
> `PageContainer`) no los usa nadie.

## Paquetes compartidos del monorepo

**Ninguno**, igual que `web`. No consume `@jiku/models`, `@jiku/nats-protocol` ni
`@jiku/zitadel-auth`. Los tipos de dominio están escritos a mano en `src/features/*/types/`.

El Dockerfile instala con `--ignore-scripts` para saltear el `postinstall` de la raíz que compila
`packages/*` (`Dockerfile:14-16`).

**Consecuencia:** los tipos pueden divergir del esquema real sin fallar en compilación. Si `api`
cambia la forma de una respuesta, se descubre en runtime.

## Decisiones estructurales

### El guard vive en `middleware.ts`, no en un layout

Al revés que `web`, que lo pone en el layout de `(loggedin)/`.

```ts
// src/middleware.ts:25-47
export default async function middleware(request: NextRequest) {
  const session = await auth();
  const isValid = isSessionValid(session);
  const isLoginPage = request.nextUrl.pathname === '/login';

  if (isValid && isLoginPage) return NextResponse.redirect(new URL('/', request.url));
  if (!isValid && !isLoginPage) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|attachments|_next/static|_next/image|favicon.ico).*)',
};
```

*Consecuencia:* la protección es por defecto y por exclusión. Una página nueva queda protegida
sin registrarla en ningún lado — lo contrario de `web`, donde una ruta fuera de `(loggedin)/`
queda sin guard. El precio es que las exclusiones son un regex: agregar una ruta pública implica
editarlo.

*Nota sobre la validación:* además de la cookie, el middleware chequea `expiresAt` de la sesión
(`middleware.ts:14-23`). Una cookie válida con el access token vencido no alcanza.

### El rol no se usa para autorizar navegación

`web` redirige `external-user` a `/unauthorized`. Acá **no hay ningún corte por rol en la
navegación**: cualquier usuario autenticado ve las mismas rutas. El rol solo cambia qué se
renderiza dentro:

| Rol | Qué habilita | Dónde |
|---|---|---|
| `user` o `admin` (interno) | Los pills de estado y prioridad se vuelven dropdowns editables | `ListRequirementRow.tsx:119-120`, `KanbanCard.tsx:102-103` |
| `external-user` | Aparece el botón de suscripción | `ModalTopbar.tsx:98`, `BoardHeader.tsx:111` |

Esto es coherente con que el portal sea de clientes: el filtro real es de datos —`api` solo
devuelve los proyectos con permiso— y no de rutas.

### Datos en dos capas: apiClient de navegador → TanStack Query

```
componente cliente
      │  useRequirementsByStatus({projectId, status})    hooks/
      ▼
  useInfiniteQuery({queryKey: ['requirements', projectId, 'byStatus', status]})
      │  queryFn                                          services/requirementsApi.ts
      ▼
  apiClient.get('/api/opus/projects/1/requirements?...')  lib/axios.ts (mismo origen)
      ▼
  route handler catch-all ──Bearer──> api
```

Una capa menos que `web` (no hay Server Actions). Todo componente que pide datos es `'use client'`.

**El único dato que se pide desde el servidor** es la sesión: `page.tsx` y `login/enter/page.tsx`
llaman a `auth()` directo, y `presentInApi()` lleva `'use server'`.

### Un `useInfiniteQuery` por estado, siete en paralelo

La pantalla de requisitos monta **siete queries independientes**, una por cada estado del tablero:

```tsx
// src/app/(dashboard)/projects/[projectId]/requirements/page.tsx:43-52
const analisisQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.analisis });
const planificacionQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.planificacion });
// ... 5 más
const isLoading = queries.some((q) => q.isLoading);
```

*Por qué:* cada columna pagina por separado ("Ver más" trae 20 más de ese estado, no del tablero).
Con una sola query eso no se puede.

*Consecuencias:* siete requests HTTP al abrir la pantalla, y `isLoading` es un `some`, así que la
pantalla entera espera a la más lenta. No hay carga progresiva por columna.

### `page.tsx` de `/projects` no muestra proyectos

Es una pantalla de redirección: si hay proyectos, un `useEffect` navega al primero por orden
alfabético.

```tsx
// src/app/(dashboard)/projects/page.tsx:20-25
useEffect(() => {
  if (sortedProjects.length > 0) {
    router.push(`/projects/${sortedProjects[0].id}/requirements?view=list`);
  }
}, [sortedProjects, router]);
```

Sus tres estados visibles (`loading`, `error`, `empty`) son los del camino donde **no** redirige.
El componente `ProjectList`, que sí renderizaría un listado, existe y no se usa desde ningún lado.

### La vista del tablero vive en la URL, el resto en estado local

`?view=list` o `?view=kanban` (`requirements/page.tsx:36`, default `list`). El cambio usa
`router.replace`, así que no ensucia el historial (`BoardHeader.tsx:69`).

Todo lo demás es `useState` local: qué requisito está abierto en el modal, qué grupos están
colapsados, qué acordeones expandidos. **Nada de eso sobrevive a un refresh.**

### El detalle de requisito está implementado dos veces

| Dónde | Componente | Cómo se llega |
|---|---|---|
| Modal sobre el tablero | `RequirementDetailModal` | Click en una fila o card en desktop |
| Página completa | `/projects/[id]/requirements/[reqId]` → `RequirementDetailView` | Link en mobile, botón "Abrir", o URL directa |

Los dos componen los mismos tres paneles (`RequirementInfoPanel`, `ActivityPanel`,
`CommentInput`), pero el layout y el header están duplicados: el modal usa `ModalTopbar` y la
página `BoardHeader`, con botones y comportamiento casi iguales. El ancho del panel derecho es
558px en uno y 559px en el otro (`RequirementDetailModal.module.scss:56` vs
`RequirementDetailView.module.scss:42`).

### El modal decide su layout con JS, no con CSS

```tsx
// src/features/requirements/components/RequirementDetailModal/RequirementDetailModal.tsx:21
const isMobile = useIsMobile();
// ...:63  mobile → fullscreen con tabs Detalle/Actividad
// ...:122 desktop → dos paneles lado a lado
```

Es la única parte de la aplicación donde el responsive es una rama de JavaScript y no una media
query. `useIsMobile` arranca en `false` y corrige en el primer `useEffect`
(`useIsMobile.ts:6-13`): en mobile hay un frame con el layout de desktop antes de corregir.

## Autenticación

| Qué | Cómo |
|---|---|
| Proveedor | Zitadel, provider `zitadel` de NextAuth v5 |
| Flujo | Authorization Code + PKCE. App OIDC de tipo *User Agent / PKCE* con el redirect URI exacto |
| Scope | `openid profile email urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:{ZITADEL_PROJECT_ID}:aud` |
| Roles | Claves del claim `urn:zitadel:iam:org:project:{ZITADEL_PROJECT_ID}:roles` |
| Sesión | JWT firmado en cookie. **Sin `maxAge` explícito** → default de NextAuth (30 días) |
| Identidad para la api | El `accessToken` de Zitadel, reenviado como `Bearer` por el proxy |

Dos detalles propios:

**El `profile()` hace un fetch extra si faltan datos.** Si el ID token no trae `name` o `email`,
va al `userinfo` de Zitadel a buscarlos, y si eso falla usa lo que tenga
(`nextauth.config.ts:60-78`).

**Los callbacks usan `??=`** (`nextauth.config.ts:20-23`). El token solo se completa la primera
vez; en refrescos posteriores conserva los valores. Es lo que hace que `expiresAt` refleje el
vencimiento original y el middleware pueda rechazarlo.

**El vencimiento se chequea en el middleware, no en el callback.** `web` invalida la cookie desde
el callback `jwt`. Acá el callback deja pasar y `isSessionValid()` corta
(`middleware.ts:14-23`). El efecto para el usuario es el mismo; el punto de control, no.

### `presentInApi` traga los errores, a propósito

```ts
// src/features/auth/services/authApi.ts:24-31
} catch (error) {
  // No es fatal: si el alta falla, el usuario igual tiene sesión y las pantallas
  // resuelven solas si le falta permiso. Antes se relanzaba y /login/enter quedaba en
  // una pantalla blanca de error, sin poder entrar. La web ya lo trataba así.
  console.warn('Failed to present in API, but continuing:', apiError.message);
  return null;
}
```

Está documentado y es deliberado. El costo: si `POST /api/auth/present` no da de alta al usuario,
no hay señal — entra y ve un portal vacío.

## Reglas de negocio replicadas en el frontend

Implementadas acá. **No son autoritativas**: hay que verificar que `api`/`core` las impongan.

| Regla | Dónde |
|---|---|
| Los siete estados del requisito y su orden en el tablero | `KanbanBoard.tsx:25-33`, `ListView.tsx:22-30`, `MobileRequirementsBoard.tsx:25-33` — **tres listas separadas** |
| `resuelto` y `cancelado` arrancan colapsados | `ListView.tsx:32`, `KanbanBoard.tsx:35` |
| Solo un rol interno cambia estado y prioridad | `ListRequirementRow.tsx:119-120`, `KanbanCard.tsx:102-103` |
| Un requisito nuevo nace en `analisis` | `CreateRequirementModal.tsx:314-318` (chip fijo, `tabIndex={-1}`) |
| Tipo por defecto `otro` si no se elige | `CreateRequirementModal.tsx:227` |
| El título es obligatorio; lo demás no | `CreateRequirementModal.tsx:217-221` |
| Adjuntos: 10 MB y 12 extensiones | `CommentInput.tsx:11-25`, `CreateRequirementModal.tsx:22-36` — **duplicado literal** |
| La resolución solo se muestra en incidencias | `RequirementInfoPanel.tsx:154` |
| Los comentarios se crean con `visibilityLevel: 'public'` | `requirementsApi.ts:71-77` |

## Convenciones

Todas son **custom** y viven en [`conventions/`](./conventions/). El catálogo de Next.js del
workflow recomienda Tailwind, Zustand + nuqs, `fetch` nativo en Server Components, Server Actions
con `useActionState` + Zod y CI en GitLab; este servicio usa Sass + CSS Modules, TanStack Query,
axios de navegador contra un proxy propio y GitHub Actions.

Las reglas transversales del catálogo —TypeScript strict, el token nunca en el cliente, tipado
explícito de la sesión— sí aplican y están recogidas en cada convención.

| id | Qué cubre |
|---|---|
| [data-fetching](./conventions/data-fetching.md) | `apiClient` de navegador + TanStack Query, query keys, paginación infinita |
| [mutations](./conventions/mutations.md) | `useMutation`, qué invalidar, feedback, las dos APIs duplicadas |
| [api-routes](./conventions/api-routes.md) | El proxy catch-all, sus dos excepciones y el handler público |
| [auth](./conventions/auth.md) | NextAuth v5 + Zitadel, guard en el middleware, roles, contrato de sesión |
| [state-management](./conventions/state-management.md) | Árbol de decisión: URL, servidor, contexto, local |
| [styling](./conventions/styling.md) | Sass + CSS Modules, tokens, breakpoints y su uso real |
| [error-handling](./conventions/error-handling.md) | `ApiError`, toasts, estados por pantalla, lo que queda sin cubrir |
| [testing-unit](./conventions/testing-unit.md) | Vitest + Testing Library, las dos ubicaciones de tests, `TZ=UTC` |
| [ci-github](./conventions/ci-github.md) | CI y publicación de imágenes en GitHub Actions |
| [dockerfile](./conventions/dockerfile.md) | Multi-stage con contexto en la raíz del monorepo |

**No hay convención de formularios.** Los dos formularios del servicio usan `useState` crudo con
validación inline; `react-hook-form` está en `package.json` y no se importa en ningún archivo. Ver
"Limitaciones conocidas".

## Configuración

Ver [environment.md](./environment.md).

## Deployment

Ver [deployment.md](./deployment.md).

## Limitaciones conocidas

Hallazgos del relevamiento del código, con evidencia. No son propuestas de solución.

### En mobile no hay navegación

El `Sidebar` —única forma de cambiar de proyecto y de cerrar sesión— se oculta por debajo de
768px:

```scss
// src/features/projects/components/Sidebar/Sidebar.module.scss:13-15
@include mobile {
  display: none;
}
```

`(dashboard)/layout.tsx:12-19` monta `<Sidebar>` y `<main>`, y nada más. **No hay hamburguesa, ni
bottom nav, ni ningún reemplazo.** El `MobileMenu` que cumpliría ese rol existe
(`shared/components/layout/MobileMenu/`) pero solo lo usa `Header`, que a su vez no lo usa nadie.

Efecto concreto: en un teléfono, el usuario ve el tablero del proyecto al que entró y no puede
cambiar de proyecto ni desloguearse desde la UI.

### Código muerto

Nueve componentes sin ningún uso en JSX, verificado por búsqueda de referencias fuera de su propia
carpeta y de los tests:

| Componente | Ubicación | Nota |
|---|---|---|
| `Header` | `shared/components/layout/Header/` | Es el shell alternativo completo; usa `MobileMenu` |
| `MobileMenu` | `shared/components/layout/MobileMenu/` | Solo lo usa `Header` |
| `PageContainer` | `shared/components/layout/PageContainer/` | Cero referencias |
| `ProjectList` | `features/projects/components/ProjectList/` | Solo exportado en el barrel |
| `ProjectCard` | `features/projects/components/ProjectCard/` | Solo lo usa `ProjectList` |
| `RequirementFilters` | `features/requirements/components/RequirementFilters/` | Solo exportado en el barrel |
| `SubscribeButton` | `features/subscriptions/components/SubscribeButton/` | Solo exportado en el barrel |
| `Card` | `shared/components/ui/Card/` | Exportado en el barrel de `ui/` |
| `Badge` | `shared/components/ui/Badge/` | Exportado en el barrel de `ui/` |

Seis de los nueve están exportados desde un barrel, así que aparecen como disponibles al importar.
Ocho tienen tests, que pasan.

**`Header` merece una nota:** no es un componente suelto sino un shell de navegación superior
completo, con dropdown de proyectos, botón "Nueva tarea", logout y menú mobile. Es una segunda
implementación del shell, en paralelo a `Sidebar`. Cuál se pensaba usar no se puede determinar
desde el código.

### Inconsistencias estructurales

- **`react-hook-form` está declarado y no se importa nunca.** Los dos formularios
  (`CreateRequirementModal`, `CommentInput`) usan `useState` con validación inline.
- **Las suscripciones están implementadas dos veces.** `requirementsApi.subscribe/unsubscribe`
  (`requirementsApi.ts:79-85`) y `subscriptionsApi.subscribe/unsubscribe`
  (`subscriptionsApi.ts:5-11`) llaman al mismo endpoint con el mismo cuerpo. Los hooks usan la
  segunda; la primera no la usa nadie.
- **Dos implementaciones de dropdown.** El componente `Dropdown` (`shared/components/ui/`, con
  portal y posicionamiento) y los tres paneles inline de `CreateRequirementModal` (`:581-645`),
  que reimplementan portal, coordenadas y cierre por click afuera.
- **La lista de estados está tres veces**, con etiquetas duplicadas en cinco archivos más
  (`ListRequirementRow`, `KanbanCard`, `RequirementInfoPanel`, `ActivityPanel`,
  `RequirementGroupRow`). `constants/requirement.constants.ts` existe con la lista canónica y solo
  la usan los dropdowns.
- **La validación de adjuntos está duplicada literalmente** entre `CommentInput.tsx:11-25` y
  `CreateRequirementModal.tsx:22-36`: mismas 12 extensiones, mismo límite, mismos mensajes.
- **`StateAccordion` mapea etiquetas que ya no existen.** `getStateDataAttribute`
  (`StateAccordion.tsx:15-23`) traduce `Backlog`, `Activo`, `En revisión`, `Finalizado` — ninguna
  está en el enum actual. Siempre cae al fallback `'backlog'`, así que todos los acordeones de
  mobile se pintan con el mismo color.
- **`BoardHeader` recibe `onNewRequirement` y lo ignora** (`BoardHeader.tsx:24`, renombrado a
  `_onNewRequirement`). La pantalla se lo pasa (`requirements/page.tsx:169`) y no hay botón que lo
  dispare: en desktop, el único acceso a "crear requisito" es el botón del `Sidebar`.
- **El botón "Nueva tarea" de `MobileMenu` no tiene `onClick`** (`MobileMenu.tsx:149-151`). Código
  muerto dentro de código muerto.
- **`useUpdateRequirement` recibe `_projectId` y no lo usa** (`useUpdateRequirement.ts:6`);
  invalida con el `projectId` de la respuesta.
- **`lib/queryClient.ts` está duplicado en `providers.tsx`.** Las dos definen la misma
  configuración; la que corre es la de `providers.tsx` (`providers.tsx:14-29`). `lib/queryClient.ts`
  no lo importa nadie.
- **El `<html lang="en">`** (`layout.tsx:23`) en una aplicación cuya interfaz está enteramente en
  español.
- **Dos reglas de ESLint bajadas a warning** por decisión documentada:
  `@typescript-eslint/no-explicit-any` y `react-hooks/set-state-in-effect`, esta última con el
  motivo en el comentario (`eslint.config.mjs:13-20`).

### Estados de UI ausentes

El detalle por pantalla está en el relevamiento UX. Lo transversal:

- **`useProjects` no maneja error en la pantalla de requisitos.** Si falla, `currentProjectName`
  cae a `'Proyecto'` y el tablero se muestra igual (`requirements/page.tsx:132-135`).
- **Las mutaciones de suscripción no avisan al usuario.** `useSubscribe`/`useUnsubscribe` no tienen
  `onError`; el error se refleja como la palabra "Error" dentro del propio botón
  (`ModalTopbar.tsx:118`).
- **`CreateRequirementModal` no muestra el error de creación.** `useCreateRequirement` no tiene
  `onError` y el modal solo mira `isPending`: si la creación falla, el botón vuelve de "Creando..."
  a "Crear elemento" sin ningún mensaje.
- **La pantalla de requisitos no tiene estado empty.** Con el proyecto sin requisitos se ven las
  siete secciones en cero; no hay un mensaje de "todavía no hay nada acá".

### Accesibilidad

- **Los ítems de proyecto del `Sidebar` son `<div>` con `onClick`** (`Sidebar.tsx:71-75`): sin
  `role`, sin `tabIndex`, sin handler de teclado. No se puede navegar entre proyectos con el
  teclado.
- **Las filas de `ListRequirementRow` son `<div>` con `onClick`** (`ListRequirementRow.tsx:143`),
  mismo problema.
- **Las opciones de los dropdowns inline de `CreateRequirementModal` son `<div>` con `onClick`**
  (`:584-594`, `:602-624`, `:631-642`).
- **Ningún modal atrapa el foco.** `Modal`, `RequirementDetailModal` y `CreateRequirementModal`
  manejan `Escape` y el click en el overlay, pero no hay focus trap ni devolución del foco al
  cerrar. `MobileMenu` es el único que enfoca algo al abrir (`MobileMenu.tsx:32-36`).
- **`ListView` y `ListRequirementRow` usan `<div>` con `display: grid`** para una tabla de datos,
  sin roles ARIA de tabla.

### Contrato con la api

- **Los tipos están escritos a mano** y no derivan de `@jiku/models`.
- **`Attachment` declara nueve campos** (`attachment.types.ts`) y el código solo usa `id`,
  `fileName`, `mimeType` y `fileSize`.
- **`comment.types.ts` declara `Comment`** y no se usa: el feed de actividad tipa con
  `RequirementActivity`.
- **Dos endpoints distintos para comentar.** `requirementsApi.addActivity` postea a
  `/requirements/{id}/comment` (singular) y `commentsApi.create` a `/requirements/{id}/comments`
  (plural). El que corre es el segundo; el primero no lo usa nadie.
