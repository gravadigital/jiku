# Arquitectura: opus-web — Índice

> Generado a partir de `manifest.yaml`. No editar a mano.

Portal de clientes de Jiku. Un cliente ve sus proyectos y sus requisitos: nunca horas, comentarios
internos ni proyectos de otros clientes.

- **Tipo:** frontend · **Lenguaje:** nextjs (TypeScript) · **Path:** `opus-web/`

## Documentos

| Documento | Contenido |
|---|---|
| [overview.md](./overview.md) | Responsabilidades, estructura, decisiones estructurales, autenticación, reglas replicadas, limitaciones |
| [environment.md](./environment.md) | Variables de entorno, cuáles son obligatorias y qué rompe si faltan |
| [deployment.md](./deployment.md) | Imagen, publicación, composición, qué no hay |
| [developer-standards.md](./developer-standards.md) | TypeScript, nombres, imports, comentarios, accesibilidad, checklists |
| [manifest.yaml](./manifest.yaml) | Declaración de convenciones y módulos |

## Convenciones

Todas **custom**: el stack del servicio (Sass + CSS Modules, TanStack Query, axios de navegador
contra un proxy propio, GitHub Actions) difiere del que recomienda el catálogo de Next.js
(Tailwind, Zustand + nuqs, `fetch` nativo, Zod, GitLab CI). `opus-web` es un frontend existente
que se importó al workflow y su stack es anterior al catálogo.

`ci-github` y `dockerfile` no tienen equivalente en el catálogo: son convenciones nuevas, no
reemplazos.

**No se declara `forms`:** no hay una convención de formularios. Los dos del servicio usan
`useState` crudo y `react-hook-form` está declarado sin usarse. Ver
[overview.md](./overview.md#inconsistencias-estructurales).

| id | Display name | Qué cubre |
|---|---|---|
| [data-fetching](./conventions/data-fetching.md) | Obtención de datos (`apiClient` de navegador + TanStack Query) | Las dos capas, los dos clientes axios, query keys, paginación infinita |
| [mutations](./conventions/mutations.md) | Mutaciones (`useMutation` + invalidación explícita) | Las cinco mutaciones, qué invalidar, los tres enfoques de feedback |
| [api-routes](./conventions/api-routes.md) | Route Handlers (proxy catch-all) | El catch-all y sus cinco decisiones, los handlers de adjuntos, el público |
| [auth](./conventions/auth.md) | Autenticación (NextAuth v5 + Zitadel OIDC) | Provider, el guard en el middleware, roles, contrato de sesión |
| [state-management](./conventions/state-management.md) | Estado client-side | Árbol de decisión: URL, servidor, contexto, local. `useIsMobile` |
| [styling](./conventions/styling.md) | Estilado (Sass + CSS Modules + custom properties) | Tokens, variantes con `data-*`, breakpoints y su uso real |
| [error-handling](./conventions/error-handling.md) | Manejo de errores | `ApiError`, toasts, estados por pantalla, lo que no está cubierto |
| [testing-unit](./conventions/testing-unit.md) | Testing unitario (Vitest + Testing Library) | Config, `TZ=UTC`, las dos ubicaciones, el mock de `react-markdown` |
| [ci-github](./conventions/ci-github.md) | CI/CD (GitHub Actions) | Los tres workflows, matriz de servicios, tags |
| [dockerfile](./conventions/dockerfile.md) | Dockerfile (Next.js en workspace de monorepo) | Contexto en la raíz, etapas, `CMD opus-web/server.js`, config en runtime |

## Módulos

Cada módulo es una carpeta en `src/features/` con `components/`, `hooks/`, `services/`, `types/` y,
cuando hace falta, `constants/`. El barrel `index.ts` es su superficie pública.

| Módulo | Rutas que lo usan | Superficie |
|---|---|---|
| `auth` | `/login`, `/login/enter`, y el middleware | Config de NextAuth + `presentInApi` |
| `projects` | todas las del dashboard | El `Sidebar` vive acá, no en `shared/` |
| `requirements` | `/projects/[id]/requirements` y su subruta | El módulo grande: 11 componentes |
| `comments` | dentro del detalle de requisito | Solo `useCreateComment` + su api |
| `subscriptions` | detalle de requisito y modal de creación | Sin ruta propia |
| `attachments` | transversal | Sin componentes: solo servicio y tipos |

## Rutas

| Ruta | Tipo | Auth | Archivo |
|---|---|---|---|
| `/` | redirección | sí | `app/page.tsx` |
| `/login` | página | no | `app/(auth)/login/page.tsx` |
| `/login/enter` | redirección | sí | `app/(auth)/login/enter/page.tsx` |
| `/projects` | redirección | sí | `app/(dashboard)/projects/page.tsx` |
| `/projects/[projectId]/requirements` | página | sí | `.../requirements/page.tsx` |
| `/projects/[projectId]/requirements/[requirementId]` | página | sí | `.../[requirementId]/page.tsx` |
| `/api/opus/[...path]` | route handler | sí | proxy catch-all |
| `/api/auth/[...nextauth]` | route handler | — | NextAuth |
| `/api/attachments/[id]/preview` | route handler | sí | preview de adjunto |
| `/attachments/[id]/[fileName]` | route handler | **no** | descarga pública |

## Documentación relacionada

| Documento | Contenido |
|---|---|
| [../../analysis/services/opus-web.md](../../analysis/services/opus-web.md) | Análisis de importación |
| [../../analysis/ux/opus-web/index.md](../../analysis/ux/opus-web/index.md) | Relevamiento UX de la interfaz actual |
| [../web/index.md](../web/index.md) | El otro frontend: mismo stack, decisiones opuestas en datos y guard |
| [../../apis/core.yaml](../../apis/core.yaml) | Contrato de `core` |
