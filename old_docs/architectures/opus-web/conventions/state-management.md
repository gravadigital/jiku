---
id: state-management
display_name: Estado client-side (TanStack Query + ProjectContext + useState)
language: nextjs
description: TanStack Query para datos de servidor, un searchParam para la vista, contexto para el proyecto activo, useState para el resto
applies_to: [frontend]
required_by: [data-fetching]
package: "@tanstack/react-query"
---

# Estado client-side (opus-web)

> **Reemplaza** la convención `state-management` del catálogo, que usa Zustand + nuqs. Acá hay
> tres mecanismos: TanStack Query, un `searchParam`, un contexto y `useState`.

## Árbol de decisión

```
¿El dato viene de la api?
├── SÍ  → TanStack Query. Nunca copiarlo a useState.
└── NO
    ├── ¿Tiene que sobrevivir a un refresh o ser compartible por URL?
    │   ├── SÍ  → searchParams  (hoy: solo `?view=`)
    │   └── NO
    │       ├── ¿Lo necesitan componentes en ramas distintas del árbol?
    │       │   ├── SÍ  → ProjectContext  (hoy: solo el proyecto activo)
    │       │   └── NO  → useState en el componente más bajo que lo necesite
```

## Datos de servidor: TanStack Query, y nada más

**Regla dura:** un dato que vino de la api no se copia a `useState`. El cache es la fuente.

El código lo cumple. Lo que sí hace es **derivar** con `useMemo`:

```tsx
// src/app/(dashboard)/projects/page.tsx:14-17
const sortedProjects = useMemo(() => {
  if (!projects) return [];
  return [...projects].sort((a, b) => a.name.localeCompare(b.name));
}, [projects]);
```

Detalles del cache, query keys e invalidación en [data-fetching](./data-fetching.md) y
[mutations](./mutations.md).

## URL: solo la vista del tablero

Un único `searchParam` en toda la aplicación:

```tsx
// src/app/(dashboard)/projects/[projectId]/requirements/page.tsx:36
const view = searchParams?.get('view') || 'list';
```

Se escribe con `router.replace`, no `push`:

```tsx
// src/features/requirements/components/BoardHeader/BoardHeader.tsx:68-70
const handleViewChange = (view: 'list' | 'kanban') => {
  router.replace(`/projects/${projectId}/requirements?view=${view}`);
};
```

`replace` y no `push` porque alternar entre lista y kanban no debería llenar el historial: el back
del navegador vuelve al proyecto anterior, no a la vista anterior.

El default es `'list'`, y el `Sidebar` navega con `?view=list` explícito
(`Sidebar.tsx:40`), igual que la redirección de `/projects` (`projects/page.tsx:23`).

> **Nada más vive en la URL.** Ni filtros, ni el requisito abierto, ni los grupos colapsados. Es la
> diferencia grande contra `web`, donde todos los filtros de listado están en `searchParams`. Acá
> el tablero no tiene filtros — `RequirementFilters` existe y no se usa.

## Contexto: solo el proyecto activo

Un único contexto, `src/contexts/ProjectContext.tsx`:

```tsx
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  return (
    <ProjectContext.Provider value={{ activeProject, setActiveProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useActiveProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useActiveProject must be used within ProjectProvider');
  return context;
}
```

**Reglas que este contexto sí cumple:**

- El hook lanza si se usa fuera del provider. No devuelve `undefined` para que el consumidor
  adivine.
- Guarda lo mínimo: `{id, name}`, no el objeto de la api entero. El tipo `Project` del contexto es
  local, no el de `features/projects/types/`.
- **No persiste.** No hay `localStorage`. Un refresh lo vacía.

**Quién lo consume — dos lugares, con propósitos distintos:**

| Consumidor | Qué hace |
|---|---|
| `requirements/page.tsx:37` + el efecto de `:65-72` | **Escribe**: sincroniza el contexto con el `projectId` de la URL |
| `CreateRequirementModal.tsx:56` | **Lee**: preselecciona el proyecto del formulario |

El efecto de sincronización:

```tsx
// requirements/page.tsx:65-72
useEffect(() => {
  if (activeProject?.id !== projectId && projectId > 0 && projects) {
    const project = projects.find((p) => p.id === projectId);
    if (project) setActiveProject(project);
  }
}, [projectId, activeProject, setActiveProject, projects]);
```

**La URL es la fuente de verdad; el contexto es una copia** para que el modal de creación sepa qué
proyecto preseleccionar sin recibirlo por props desde el layout.

> `Header.tsx:20` también lo consume, pero `Header` es código muerto.
>
> **Comparación útil:** en `web` este mismo contexto está montado y **nadie** lo consume. Acá sí
> tiene función.

## Local: `useState`, todo lo demás

Lo que es efímero por diseño:

| Estado | Dónde | Sobrevive a un refresh |
|---|---|---|
| Requisito abierto en el modal | `requirements/page.tsx:40` | no |
| Modal de creación abierto | `requirements/page.tsx:41`, `(dashboard)/layout.tsx:9` | no |
| Grupos colapsados de la lista | `ListView.tsx:46` | no |
| Acordeones expandidos de mobile | `MobileRequirementsBoard.tsx:36` | no |
| Columna del kanban colapsada | `KanbanColumn.tsx:49` | no |
| Tab del modal en mobile | `RequirementDetailModal.tsx:22` | no |
| Todo el formulario de creación | `CreateRequirementModal.tsx:60-75` | no |
| Borrador del comentario y sus adjuntos | `CommentInput.tsx:52-57` | no |
| "Copiado" del botón de enlace | `ModalTopbar.tsx:31`, `BoardHeader.tsx:33` | no |
| Dropdown abierto y sus coordenadas | `Dropdown.tsx:33-36`, `CreateRequirementModal.tsx:68-69` | no |

**Consecuencia deliberada pero anotada:** un requisito abierto en el modal **no tiene URL**. Un
refresh vuelve al tablero. La vía para compartirlo es el botón "Enlace", que copia la URL de la
página de detalle (`ModalTopbar.tsx:62-68`) — que sí existe como ruta.

### El estado inicial derivado, y su límite

```tsx
// src/features/requirements/components/ListView/ListView.tsx:35-46
const initialCollapsed = useMemo(
  () => new Set([
    ...ALWAYS_COLLAPSED,
    ...LIST_SECTIONS.filter((s) => (sections[s.id]?.requirements.length ?? 0) === 0).map((s) => s.id),
  ]),
  [sections]
);
const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(initialCollapsed);
```

`initialCollapsed` se recalcula cuando cambian las secciones, pero **`useState` solo usa el valor
de la primera renderización**. Si los datos llegan después del primer render, los grupos vacíos no
arrancan colapsados.

En la práctica no se nota porque la pantalla no monta `ListView` hasta que las siete queries
terminaron (`requirements/page.tsx:153-162`). Pero el `useMemo` sugiere una reactividad que no
existe.

`KanbanColumn` tiene el mismo patrón con `defaultCollapsed` (`KanbanColumn.tsx:49`).

### Un `Set` como estado

Tanto `ListView` como `MobileRequirementsBoard` guardan qué está colapsado/expandido en un `Set`, y
lo actualizan copiando:

```tsx
// src/features/requirements/components/ListView/ListView.tsx:60-70
const toggleGroup = (id: string) => {
  setCollapsedGroups((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};
```

**El `new Set(prev)` es obligatorio**: mutar el `Set` anterior no cambia la referencia y React no
re-renderiza. Es el patrón correcto y está bien aplicado en los dos lugares.

## El estado del `Dropdown` es posicional

`Dropdown` guarda coordenadas absolutas porque renderiza el menú en un portal:

```tsx
// src/shared/components/ui/Dropdown/Dropdown.tsx:40-48
const updatePosition = useCallback(() => {
  if (!buttonRef.current) return;
  const rect = buttonRef.current.getBoundingClientRect();
  if (align === 'right') setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  else setMenuPos({ top: rect.bottom + 4, left: rect.left });
}, [align]);
```

Y se recalcula en scroll con captura (`Dropdown.tsx:65`) porque el disparador puede estar dentro de
un contenedor scrolleable — el caso real es una fila de `ListView`.

*Por qué el portal:* el menú tiene que escapar del `overflow: hidden` de la tabla. El precio es
mantener las coordenadas a mano.

`CreateRequirementModal` reimplementa esto mismo para sus tres dropdowns
(`CreateRequirementModal.tsx:68-69`, `:244-260`) en vez de usar el componente. Ver
[styling](./styling.md).

## `useIsMobile`: el responsive como estado

```ts
// src/shared/hooks/useIsMobile.ts:3-19
const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function checkIsMobile() { setIsMobile(window.innerWidth < MOBILE_BREAKPOINT); }
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);
  return isMobile;
}
```

Es el único lugar donde el responsive es estado de React y no una media query.

**Dos cosas a saber:**

- **Arranca en `false`.** En un teléfono hay un frame con el layout de desktop antes de que el
  efecto corrija. Es inevitable con este enfoque: en el servidor no hay `window`.
- **El valor 768 está duplicado** respecto a `$breakpoint-md` de `_mixins.scss:25`. Dos fuentes
  para el mismo corte.

Lo usan dos componentes, y en los dos casos para elegir **estructura**, no estilo:
`requirements/page.tsx:39` (qué tablero montar) y `RequirementDetailModal.tsx:21` (tabs o dos
paneles).

**Regla:** `useIsMobile` solo cuando el árbol de componentes cambia. Si lo único que cambia es el
layout, va con `@include mobile` en el SCSS.

## Lo que está montado

```tsx
// src/app/providers.tsx:46-54
<SessionProvider>
  <QueryClientProvider client={queryClient}>
    <ProjectProvider>{children}</ProjectProvider>
    <ToastContainer />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
</SessionProvider>
```

Cuatro providers y los tres tienen consumidores. `ReactQueryDevtools` se incluye sin guardar por
`NODE_ENV` — el propio paquete no monta nada en producción.

## Qué NO hacer

- No copiar datos de la api a `useState`. Derivar con `useMemo` si hace falta transformarlos.
- No agregar un contexto nuevo sin verificar que el dato lo necesiten ramas distintas del árbol.
  `ProjectContext` está justificado porque el modal de creación y la pantalla del tablero no se
  ven entre sí.
- No mutar un `Set` o un array de estado: copiar.
- No `useIsMobile` para lo que resuelve una media query.
- No poner en `useState` algo que debería sobrevivir a un refresh — eso va a la URL.
