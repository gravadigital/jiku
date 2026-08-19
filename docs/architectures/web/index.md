# Arquitectura: web — Índice

> Generado a partir de `manifest.yaml`. No editar a mano.

Frontend interno de Jiku. Renderiza en el servidor, autentica ahí, y el access token nunca llega
al navegador.

- **Tipo:** frontend · **Lenguaje:** nextjs (TypeScript) · **Path:** `web/`

## Documentos

| Documento | Contenido |
|---|---|
| [overview.md](./overview.md) | Responsabilidades, estructura, decisiones estructurales, autenticación, reglas replicadas, limitaciones |
| [environment.md](./environment.md) | Variables de entorno, cuáles son obligatorias y qué rompe si faltan |
| [deployment.md](./deployment.md) | Imagen, publicación, composición, qué no hay |
| [developer-standards.md](./developer-standards.md) | TypeScript, nombres, imports, comentarios, accesibilidad, checklists |
| [manifest.yaml](./manifest.yaml) | Declaración de convenciones y módulos |

## Convenciones

Todas **custom**: el stack del servicio (Sass + CSS Modules, TanStack Query, axios de servidor,
yup, GitHub Actions) difiere del que recomienda el catálogo de Next.js (Tailwind, Zustand + nuqs,
`fetch` nativo, Zod, GitLab CI). `web` es un frontend existente que se importó al workflow y su
stack es anterior al catálogo.

`ci-github` no tiene equivalente en el catálogo: es una convención nueva, no un reemplazo.

| id | Display name | Qué cubre |
|---|---|---|
| [data-fetching](./conventions/data-fetching.md) | Obtención de datos (Server Actions + axios + TanStack Query) | Las tres capas, query keys, configuración del cache, Suspense |
| [mutations](./conventions/mutations.md) | Mutaciones (Server Action o BFF + invalidación) | Cómo elegir la vía, qué invalidar, feedback, update optimista |
| [api-routes](./conventions/api-routes.md) | Route Handlers (BFF selectivo) | El criterio, el preámbulo de auth, streaming binario, params dinámicos |
| [auth](./conventions/auth.md) | Autenticación (Auth.js v5 + Zitadel OIDC) | Provider, scopes, sesión, el guard en el layout, roles, login/logout |
| [state-management](./conventions/state-management.md) | Estado client-side (TanStack Query + searchParams + useState) | Árbol de decisión, filtros en la URL, debounce, los contexts muertos |
| [forms](./conventions/forms.md) | Formularios (yup + estado controlado) | Los tres enfoques que conviven, cuál usar, mensajes, `react-select` |
| [styling](./conventions/styling.md) | Estilado (Sass + CSS Modules + custom properties) | Tokens, mixins, breakpoints y su uso real, `cn()`, estilos globales |
| [error-handling](./conventions/error-handling.md) | Manejo de errores | `ApiError`, toasts, `error.tsx`, estados de datos, errores tragados |
| [testing-unit](./conventions/testing-unit.md) | Testing unitario (Vitest + Testing Library) | Config, `TZ=UTC`, ubicación, mocks, cobertura faltante |
| [ci-github](./conventions/ci-github.md) | CI/CD (GitHub Actions) | Los tres workflows, matriz de servicios, tags |
| [dockerfile](./conventions/dockerfile.md) | Dockerfile (Next.js en workspace de monorepo) | Contexto en la raíz, etapas, `CMD web/server.js`, config en runtime |

## Módulos

Cada módulo es una carpeta en `src/features/` con `components/`, `hooks/`, `services/`, `types/` y,
cuando hace falta, `utils/`. El barrel `index.ts` es su superficie pública.

| Módulo | Rutas que lo usan | Superficie |
|---|---|---|
| `clients` | `/clients`, `/clients/new`, `/clients/edit/[id]` | "Actores" en la UI |
| `projects` | `/projects` y sus 3 subrutas | — |
| `requirements` | `/requirements` y sus 4 subrutas | — |
| `objectives` | `/objectives` y sus 5 subrutas | "Tareas" en la UI |
| `time-allocation` | `/time-allocation` | Solo `admin` edita |
| `worked-times` | `/worked-times`, `/worked-times/report` | Oculto para `external-user` |
| `attachments` | transversal | Sin ruta propia |
| `auth` | `/login/enter`, y `usePersons` desde varios módulos | — |

## Documentación relacionada

| Documento | Contenido |
|---|---|
| [../../analysis/services/web.md](../../analysis/services/web.md) | Análisis de importación |
| [../../analysis/ux/web/index.md](../../analysis/ux/web/index.md) | Relevamiento UX de la interfaz actual |
| [../../apis/core.yaml](../../apis/core.yaml) | Contrato de `core` |
