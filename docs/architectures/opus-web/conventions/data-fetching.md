---
id: data-fetching
display_name: Obtención de datos (apiClient de navegador + TanStack Query)
language: nextjs
description: Todo se pide desde el cliente contra el proxy del mismo origen, con TanStack Query como único cache
applies_to: [frontend]
required_by: []
package: "@tanstack/react-query"
---

# Obtención de datos (opus-web)

> **Reemplaza** la convención `data-fetching` del catálogo, que usa `fetch` nativo en Server
> Components con `revalidateTag`. Acá todo se pide desde el navegador contra un proxy propio, y
> el cache es TanStack Query.

## Las dos capas

```
componente cliente
      │  useRequirements({projectId})              features/{modulo}/hooks/
      ▼
  useQuery({queryKey: ['requirements', projectId]})
      │  queryFn                                   features/{modulo}/services/{modulo}Api.ts
      ▼
  apiClient.get('/api/opus/projects/1/requirements')   lib/axios.ts — MISMO ORIGEN
      ▼
  route handler catch-all ──Bearer──> api
```

Una capa menos que `web`, que mete Server Actions entre el hook y axios. Acá el hook llama al
servicio y el servicio llama a axios desde el navegador.

**Consecuencia práctica:** todo componente que pide datos es `'use client'`. No hay data fetching
en server components salvo la sesión (`app/page.tsx:5`, `login/enter/page.tsx:5`).

## El cliente HTTP

`lib/axios.ts` exporta **dos** clientes. Elegir mal rompe en runtime.

| Cliente | `baseURL` | Dónde se usa | Token |
|---|---|---|---|
| `apiClient` | `/` (mismo origen) | Todos los servicios de `features/*/services/` | Lo agrega el route handler en el servidor |
| `apiClientBase` | `process.env.API_URL` | Solo `authApi.ts` (`'use server'`) | Explícito en la llamada |

```ts
// src/lib/axios.ts:48-54
export const apiClient = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});
```

**Regla:** un servicio nuevo usa `apiClient` y una URL que empieza con `/api/opus/`. `apiClientBase`
es solo para código con `'use server'`.

> **El interceptor de request de `apiClient` es redundante.** Llama a `getSession()` y agrega
> `Authorization` (`axios.ts:57-66`), pero el destino es el propio origen y el route handler
> agrega el token de todas formas desde la sesión del servidor. El header viaja del navegador a
> Next y ahí se descarta. Funciona; es una llamada de más por request.

## Servicios

Un objeto por dominio, con métodos que devuelven datos ya desempaquetados:

```ts
// src/features/requirements/services/requirementsApi.ts:21-36
export const requirementsApi = {
  getByProject: async (projectId: number, params?: GetRequirementsParams): Promise<Requirement[]> => {
    const { data } = await apiClient.get<Requirement[]>(
      `/api/opus/projects/${projectId}/requirements`, { params }
    );
    return data;
  },
  getById: async (id: number): Promise<RequirementDetail> => {
    const { data } = await apiClient.get<RequirementDetail>(`/api/opus/requirements/${id}`);
    return data;
  },
};
```

**Reglas:**

- El servicio devuelve `data`, no la respuesta de axios. El hook nunca ve `AxiosResponse`.
- El tipo genérico va en la llamada (`apiClient.get<Requirement[]>`) y también como retorno de la
  función. Redundante pero es el patrón en los cinco servicios.
- Los query params van por la opción `params` de axios, no concatenados a mano.
- **Un método por operación, y revisar que no exista ya.** Hoy hay tres pares duplicados
  (suscripción en dos servicios, comentario en dos endpoints); no agregar un cuarto.

`attachmentsApi` es la excepción: usa `fetch` nativo en vez de axios, porque manda `FormData` y
necesita que el navegador arme el boundary del multipart (`attachmentsApi.ts:14-17`).

## Hooks

Un hook por archivo, en `features/{modulo}/hooks/`.

```ts
// src/features/requirements/hooks/useRequirement.ts:9-15
export function useRequirement({ requirementId }: UseRequirementOptions) {
  return useQuery<RequirementDetail>({
    queryKey: ['requirement', requirementId],
    queryFn: () => requirementsApi.getById(requirementId),
    enabled: !!requirementId && requirementId > 0,
  });
}
```

**Reglas:**

- El hook devuelve el resultado de `useQuery` entero, sin desestructurar. El componente elige qué
  usar (`isLoading`, `isError`, `data`, `refetch`).
- **Parámetros como objeto**, no posicionales — salvo `useProjectUsers(projectId)`, que es la
  excepción.
- **`enabled` para evitar la query con un id inválido.** El patrón es `projectId > 0` o
  `!!requirementId && requirementId > 0`. Sin eso, la primera renderización dispara una query con
  `NaN` o `0`.

## Query keys

Jerárquicas, de lo general a lo específico. La jerarquía es lo que hace que la invalidación por
prefijo funcione.

| Key | Hook | Invalidada por |
|---|---|---|
| `['projects']` | `useProjects` | nadie |
| `['projectUsers', projectId]` | `useProjectUsers` | nadie |
| `['requirements', projectId]` | `useRequirements` | crear requisito |
| `['requirements', projectId, 'byStatus', status]` | `useRequirementsByStatus` | actualizar requisito (por prefijo `['requirements', projectId, 'byStatus']`) |
| `['requirement', id]` | `useRequirement` | actualizar requisito, comentar, suscribir, desuscribir |

**Regla:** el singular es el detalle (`['requirement', id]`), el plural el listado
(`['requirements', projectId]`). Son dos árboles separados: invalidar el listado no refresca el
detalle abierto, y por eso las mutaciones invalidan los dos cuando corresponde.

> **`useRequirements` está en un tercer árbol y nadie lo consume.** La pantalla usa siete
> `useRequirementsByStatus`. `useCreateRequirement` invalida `['requirements', projectId]`, que es
> justamente la key que nadie tiene montada — ver [mutations](./mutations.md).

## Configuración del cache

```ts
// src/app/providers.tsx:14-29
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,      // 30 s
        gcTime: 5 * 60 * 1000,     // 5 min
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  });
}
```

Qué significa en la práctica: los datos se consideran frescos 30 segundos; volver a la pestaña
después de eso dispara un refetch. Las queries reintentan una vez; las mutaciones ninguna.

El cliente se crea una vez por proceso en el servidor y se memoiza en el navegador
(`providers.tsx:31-41`), que es el patrón recomendado para no compartir cache entre requests en
SSR.

> **Esta configuración está duplicada.** `lib/queryClient.ts` exporta `defaultQueryClientOptions`
> y `makeQueryClient()` con los mismos valores, y **no lo importa nadie**. La que corre es la de
> `providers.tsx`. Al cambiar un valor hay que saber cuál de los dos archivos toca.

## Paginación infinita

Es el patrón del tablero: cada estado pagina por separado.

```ts
// src/features/requirements/hooks/useRequirementsByStatus.ts:18-34
return useInfiniteQuery<Requirement[]>({
  queryKey: ['requirements', projectId, 'byStatus', status],
  queryFn: ({ pageParam = 0 }) =>
    requirementsApi.getByStatus(projectId, { status, limit, skip: pageParam as number }),
  initialPageParam: 0,
  getNextPageParam: (lastPage, allPages) => {
    if (lastPage.length === limit) return allPages.flat().length;
    return undefined;
  },
  enabled: projectId > 0 && status.length > 0,
});
```

**Cómo sabe si hay más:** si la última página vino llena (`length === limit`), asume que hay más y
el próximo `skip` es el total acumulado. Si vino corta, devuelve `undefined` y `hasNextPage` pasa a
`false`.

*Consecuencia:* cuando el total es múltiplo exacto del límite, hace una request de más que vuelve
vacía. Es el costo de que la api no devuelva un total.

El componente aplana con `data?.pages.flat() ?? []` (`requirements/page.tsx:77`).

**Regla:** un listado paginado usa `useInfiniteQuery` con este patrón de `getNextPageParam`, no
`useQuery` con estado de página aparte.

## Siete queries en paralelo

La pantalla de requisitos monta una query por estado:

```tsx
// src/app/(dashboard)/projects/[projectId]/requirements/page.tsx:43-63
const analisisQuery = useRequirementsByStatus({ projectId, status: COLUMN_STATES.analisis });
// ... seis más
const isLoading = queries.some((q) => q.isLoading);
```

Es lo que permite que "Ver más" traiga 20 requisitos **de ese estado**. Con una sola query
paginada no se puede.

**El costo, explícito:** siete requests HTTP al abrir la pantalla, y `isLoading` es un `some`, así
que la pantalla entera espera a la más lenta. No hay carga progresiva por columna.

**Regla:** este patrón se justifica cuando cada sección pagina por separado. Para un listado con
una sola paginación, una query.

## Qué NO hacer

- No llamar a `apiClient` desde un componente. El servicio y el hook existen para eso.
- No `useEffect` + `useState` para pedir datos: `useQuery`.
- No `apiClientBase` fuera de un archivo con `'use server'` — lee `API_URL`, que no existe en el
  navegador.
- No inventar una query key nueva para datos que ya tienen una. Reusar la key es lo que hace que
  la invalidación funcione.
- No desestructurar el retorno del hook dentro del hook. Devolver `useQuery` entero.
