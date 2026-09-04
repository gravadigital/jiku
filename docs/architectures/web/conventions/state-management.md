---
id: state-management
display_name: Estado client-side (TanStack Query + searchParams + useState)
language: nextjs
description: Árbol de decisión — servidor en TanStack Query, filtros en la URL, resto local
applies_to: [frontend]
required_by: []
package: "@tanstack/react-query"
---

# Estado client-side (web)

> **Reemplaza** la convención `state-management` del catálogo, que usa Zustand para estado global
> y nuqs para estado de URL. Acá no hay Zustand y los searchParams se manipulan a mano. El árbol
> de decisión es el mismo del catálogo; cambian las herramientas.

## Árbol de decisión

```
¿De dónde viene el dato?
│
├── De la api  ─────────────────> TanStack Query.  NUNCA copiarlo a useState
│
├── Define qué se ve en la
│   pantalla y querés que sea
│   compartible / navegable  ───> searchParams (router.push)
│
├── Sesión ─────────────────────> useSession() / auth()
│
└── Solo le importa a este
    componente y a sus hijos ───> useState / useReducer
                                   ¿lo necesitan primos lejanos? -> props
```

**No hay una cuarta categoría.** No hay estado global de aplicación en este servicio: los dos
contexts que existen no se consumen (ver más abajo).

## Estado de servidor: TanStack Query

Todo dato de la api vive en el cache de queries. Ver [`data-fetching.md`](./data-fetching.md) para
query keys y configuración.

**Regla dura: no copiar datos de query a `useState`.** El antipatrón es este:

```tsx
// NO
const { data: client } = useClient({ id });
const [initialValues, setInitialValues] = useState(undefined);
useEffect(() => {
  if (client) setInitialValues({ name: client.name, description: client.description || '' });
}, [client]);
```

Existe hoy en `clients/edit/[id]/page.tsx:17-28` y es la razón de que esa pantalla necesite
`if (isLoadingClient || !initialValues)`: dos fuentes de verdad para el mismo dato.

**La excepción legítima son los borradores de formulario.** Un formulario de edición sí copia el
valor de la query a estado local, porque el usuario lo está modificando y el cache no debe
seguirlo. En ese caso el patrón es inicializar con un initializer de `useState`, no con un efecto:

```tsx
// SÍ — RequirementStatusCard.tsx:231
const [drafts, setDrafts] = useState<FieldDrafts>(() => draftsFromRequirement(requirement));
```

## Estado de URL: searchParams

Los filtros, el orden, la página y el tamaño de página van en la URL. No hay librería: se usa
`useSearchParams` para leer y `router.push` para escribir.

### Patrón de escritura

```tsx
'use client';
const router = useRouter();
const searchParams = useSearchParams();

const createQueryString = useCallback((name: string, value: string) => {
  const params = new URLSearchParams(searchParams?.toString());
  if (!value || value === 'all') params.delete(name);
  else params.set(name, value);
  return params.toString();
}, [searchParams]);

const changeFilter = useCallback((field: string, value: string) => {
  router.push(`/clients?${createQueryString(field, value)}`);
}, [router, createQueryString]);
```

**Reglas:**

- Partir de los params actuales (`new URLSearchParams(searchParams?.toString())`), no de vacío:
  cambiar un filtro no debe borrar los otros.
- El valor `'all'` **borra** el parámetro en vez de escribirlo. Es el sentinel de "sin filtro".
- Al cambiar cualquier filtro, **resetear `page` a 1**. `ObjectiveSearchFilters.tsx:55-56` lo hace;
  `ClientListFilters` y `ProjectListFilters` no — ahí un filtro nuevo puede dejar al usuario en una
  página que ya no existe.
- El destino del `push` es la ruta actual, escrita literal. No hay helper: `ClientListFilters`
  pushea `/clients`, `ProjectListFilters` pushea `/projects`. **Es la razón por la que estos
  componentes no son reutilizables entre rutas.**

### Búsqueda con debounce

El input de búsqueda no toca la URL en cada tecla:

```tsx
const [debouncedSearch, setDebouncedSearch] = useState({ value: searchParams?.get('search') || '' });

useEffect(() => {
  const timer = setTimeout(() => { /* changeFilter('search', debouncedSearch.value) */ }, 500);
  return () => clearTimeout(timer);
}, [debouncedSearch]);
```

**Reglas:**

- 500 ms es el valor usado en las tres pantallas de listado. Mantenerlo.
- El estado del debounce es un **objeto** `{ value }`, no un string. Es deliberado: permite
  re-disparar el efecto al re-tipear el mismo texto, porque la identidad del objeto cambia.
- El valor inicial se lee de la URL, para que un reload preserve la búsqueda.

### Lectura en la página de servidor

```tsx
export default async function Clients({
  searchParams,
}: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const resolvedSearchParams = await searchParams;
  const filters: ClientFilters = {
    search: resolvedSearchParams.search || undefined,
    sort: resolvedSearchParams.sort || 'status-name',
    status: (resolvedSearchParams.status as ClientFilters['status']) || undefined,
  };
```

**Reglas:**

- `searchParams` es una **promesa** en Next 15+. Hacer `await`.
- Los defaults se aplican acá, en un solo lugar, no en cada componente que lea el filtro.
- El objeto `filters` resultante es lo que se pasa al componente cliente y lo que entra en la
  query key.

## Estado local

`useState` para todo lo demás: acordeones abiertos, dropdowns, filas expandidas, tabs, drafts,
modales.

**Reglas:**

- Cuando el estado local depende de datos de la api, inicializarlo con un initializer
  (`useState(() => ...)`), no con `useEffect`.
- `useCallback` en los handlers que se pasan a hijos memoizados o que entran en deps de efectos.
  No en todos por reflejo.
- `useMemo` para derivaciones caras sobre listas (agrupamientos, ordenamientos, totales) — es lo
  que hacen `WeeklyAllocationTable`, `HierarchicalTable` y `ObjectivesGroup`.

### Tabs y filtros que NO van a la URL

Hay filtros que viven en estado local a propósito, porque son de una sección dentro de una
pantalla, no de la pantalla:

- Los tabs por estado de `ProjectObjectivesSection` y `ProjectRequirementsSection` (dentro del
  detalle de proyecto).
- El tab de tareas de `RequirementDetail`.
- El período y la vista de `ReportPage`.

**Regla:** si el filtro identifica *la pantalla*, va a la URL. Si identifica *una sección de la
pantalla*, puede quedar local. La consecuencia de dejarlo local es que no se puede compartir por
link.

## Estado de sesión

```tsx
// cliente
const { data: session } = useSession();
const user = useCurrentUser();               // { id, name } o null

// servidor
const session = await auth();
```

**Regla:** `useSession()` no refresca (`refetchInterval={0}` en `providers.tsx:18`). No sirve para
detectar que la sesión murió; ver [`auth.md`](./auth.md).

## Los contexts que no se usan

`providers.tsx` monta dos providers cuyos hooks **nadie llama**:

| Context | Qué expone | Consumidores |
|---|---|---|
| `ProjectContext` | `activeProject`, `setActiveProject`, `clearActiveProject`, `isProjectSelected`. Persiste `activeProjectId` en `localStorage` | ninguno |
| `SidebarContext` | `isOpen`, `isCollapsed`, `open`, `close`, `toggle`, `collapse`, `expand`, `toggleCollapse` | ninguno |

`SidebarContext` describe un sidebar colapsable que no existe: el shell tiene la sidebar fija en
300 px (la declara `SidebarNav.module.scss`).

**Regla:** es código muerto, no la extensión natural para estado global. Si aparece la necesidad
de estado global compartido, decidir explícitamente si se revive uno de estos o se introduce otra
herramienta — no asumir que estos son el camino.

## Qué NO hacer

- No copiar datos de query a `useState` salvo que sea un borrador editable.
- No guardar filtros de listado en estado local: rompe el link compartible y el back del navegador.
- No leer `window.location.search` a mano. La excepción existente es `ScrollToProject.tsx`, que
  lee `window.location.hash` — el hash no está en `searchParams`.
- No agregar un provider sin un consumidor. Ya hay dos así.
