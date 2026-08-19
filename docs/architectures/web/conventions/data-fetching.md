---
id: data-fetching
display_name: Obtención de datos (Server Actions + axios + TanStack Query)
language: nextjs
description: Lectura vía Server Action con axios de servidor, cacheada en TanStack Query
applies_to: [frontend]
required_by: []
package: "@tanstack/react-query"
---

# Obtención de datos (web)

> **Reemplaza** la convención `data-fetching` del catálogo, que usa `fetch` nativo en Server
> Components con `revalidateTag`. Este servicio usa axios en Server Actions y TanStack Query
> como cache. La regla transversal que sí se mantiene: **el token nunca sale del servidor**.

## Las tres capas

```
componente cliente
      │   useProjects({ filters })                 features/{m}/hooks/useProjects.ts
      ▼
  useQuery({ queryKey: ['projects', filters] })    ← cache
      │   queryFn
      ▼
  getProjects(filters)                             features/{m}/services/projectsApi.ts
      │   'use server'
      ▼
  apiClient.get('/projects?...')                   lib/axios.ts  (interceptor → Bearer)
      ▼
  api
```

Ninguna capa se saltea desde un componente cliente. Una página **de servidor** sí puede llamar
a la Server Action directamente, salteando el hook.

## Capa 1 — el cliente axios

Uno solo, en `src/lib/axios.ts`. Es de **servidor**: su interceptor llama a `auth()`.

```ts
const apiUrl = process.env.API_URL ?? '';
export const apiClient = axios.create({ baseURL: `${apiUrl.replace(/\/$/, '')}/api` });

apiClient.interceptors.request.use(async (config) => {
  const session = await auth();
  if (session?.accessToken) config.headers.Authorization = `Bearer ${session.accessToken}`;
  else console.warn('No access token available for request:', config.url);
  return config;
});
```

**Reglas:**

- `API_URL` se lee en runtime, **no** con prefijo `NEXT_PUBLIC_`. La misma imagen sirve para
  cualquier entorno.
- El `baseURL` ya incluye `/api`. Las rutas que se pasan a `apiClient` empiezan en `/`:
  `apiClient.get('/projects')`, no `/api/projects`.
- **Nunca importar `apiClient` desde un componente cliente.** `auth()` no corre ahí.
- La respuesta se normaliza a `ApiError` en el interceptor de respuesta; ver
  [`error-handling.md`](./error-handling.md).

## Capa 2 — la Server Action

Un archivo por recurso en `features/{módulo}/services/{recurso}Api.ts`, con `'use server'` en la
primera línea.

```ts
'use server';
import { apiClient } from '@/lib/axios';
import type { Project, ProjectFilters } from '../types/project.types';

export const getProjects = async (filters: ProjectFilters = {}): Promise<Project[]> => {
  const nonEmptyFilters = cleanFilters(filters);
  const queryParams = new URLSearchParams(nonEmptyFilters).toString();
  const response = await apiClient.get(`/projects?${queryParams}`);
  return response.data;
};
```

**Reglas:**

- Tipo de retorno explícito. Es el único contrato con la api que el compilador conoce.
- Devolver `response.data`, nunca la respuesta de axios: el objeto de axios no es serializable
  a través del límite servidor/cliente.
- Los filtros vacíos y los `'all'` se descartan antes de armar el query string. El helper
  `cleanFilters` está duplicado en `projectsApi.ts` y `clientsApi.ts` con el mismo cuerpo:

  ```ts
  const cleanFilters = (filters: F): Record<string, string> =>
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v && v !== 'all')) as Record<string, string>;
  ```

- Los parámetros van en el path, no en un objeto de opciones, salvo cuando axios lo necesita
  (`listAttachments` usa `{ params: { entityType, entityId } }`).

## Capa 3 — el hook de query

Un archivo por query en `features/{módulo}/hooks/use{Recurso}.ts`, con `'use client'`.

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { getProjects } from '../services/projectsApi';

interface UseProjectsOptions {
  filters?: ProjectFilters;
  enabled?: boolean;
}

export const useProjects = (options: UseProjectsOptions = {}) => {
  const { filters = {}, enabled = true } = options;
  return useQuery({
    enabled,
    queryFn: () => getProjects(filters),
    queryKey: ['projects', filters],
  });
};
```

**Reglas:**

- Un solo objeto `options` con defaults, no parámetros posicionales.
- `enabled` siempre expuesto: hay pantallas que montan el hook antes de tener el id
  (`useClients({ enabled: isOpen })`, `useProjects({ enabled: rawProjects.length > 0 })`).
- El hook no transforma datos. El mapeo a etiquetas y el agrupamiento van en el componente o en
  `features/{m}/utils/`.

## Query keys

Convención: `[recurso]` para la colección, `[recurso, id]` para el ítem, y los filtros como
segundo elemento cuando aplican.

| Key | Dónde |
|---|---|
| `['clients', filters]` | `useClients` |
| `['client', id]` | `useClient` |
| `['projects', filters]` | `useProjects` |
| `['project', id]` | `useProject` |
| `['objectives', filters]` | `useObjectives` |
| `['objective', id]` | `useObjective` |
| `['requirements', filters]` | `useRequirements` |
| `['requirement', reqid]` | `useRequirement` |
| `['attachments', entityType, entityId]` | `useAttachments` |
| `['worked-times', date, personId]` | `useWorkedTimes` |
| `['unworked-times', date, personId]` | `useUnworkedTimes` |
| `['week-assigned-times', weekStart]` | `useWeekAllocations` |

**Regla:** el singular es el ítem y el plural la colección. Invalidar `['requirements']`
invalida todos los listados filtrados, porque TanStack Query hace match por prefijo.

## Configuración del cache

```ts
// src/lib/queryClient.ts
queries:   { staleTime: 30_000, gcTime: 300_000, retry: 1,
             refetchOnReconnect: true, refetchOnWindowFocus: true }
mutations: { retry: 0 }
```

`getQueryClient()` devuelve una instancia nueva en el servidor y un singleton en el navegador.

**`retry: 0` en mutations es deliberado:** reintentar una escritura que ya pudo aplicarse
duplica registros.

## Suspense y estados de carga

Dos mecanismos conviven, y no son intercambiables:

1. **`<Suspense>` en la página de servidor**, con fallback `<Loader label="..." />`, para el
   primer render. Cuando la página depende de filtros de la URL, se le pasa una `key` derivada
   para que el fallback vuelva a aparecer en cada filtrado:

   ```tsx
   <Suspense key={JSON.stringify(filters)} fallback={<Loader label="Cargando..." />}>
   ```

2. **`isLoading` del hook**, para los refetch dentro de un componente cliente ya montado.

**Regla:** si la pantalla lee filtros de la URL, usar la `key` en el `Suspense`. Sin ella la
tabla vieja queda en pantalla durante el filtrado.

## Qué NO hacer

- No llamar `fetch` a la api directamente desde un componente cliente: no tiene el token.
- No usar `revalidatePath`/`revalidateTag` para invalidar datos de la api: el cache que importa
  es el de TanStack Query, no el de Next. No hay ningún uso de esas funciones en el servicio.
- No poner `staleTime` por query sin motivo escrito: el default de 30 s es la línea base.
