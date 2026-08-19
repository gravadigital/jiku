---
id: mutations
display_name: Mutaciones (Server Action o BFF + invalidación de queries)
language: nextjs
description: Escrituras vía Server Action o route handler, con invalidación explícita de query keys
applies_to: [frontend]
required_by: []
package: "@tanstack/react-query"
---

# Mutaciones (web)

> **Reemplaza** la convención `mutations` del catálogo, que usa Server Actions con
> `revalidatePath`/`revalidateTag`. Acá la invalidación es por query key de TanStack Query. La
> regla transversal que sí se mantiene: la escritura se origina en el servidor salvo que haya un
> motivo técnico para lo contrario.

## Decidir la vía: Server Action o BFF

```
¿El cliente necesita algo del transporte que el servidor no le puede dar?
        │
        ├── NO  ──> Server Action ('use server' en services/*Api.ts)     ← default
        │
        └── SÍ  ──> Route handler en src/app/api/
                    Motivos válidos hoy:
                      · progreso de subida incremental
                      · el navegador tiene que recibir el archivo
                      · update optimista con rollback en el cliente
```

**El default es Server Action.** El BFF se justifica por escrito; ver
[`api-routes.md`](./api-routes.md) para los cuatro casos que existen y por qué.

## Server Action de escritura

```ts
'use server';
export const createProject = async (payload: CreateProjectPayload): Promise<Project> => {
  const response = await apiClient.post('/projects', payload);
  return response.data;
};

export const updateProject = async (id: number, payload: UpdateProjectPayload): Promise<Project> => {
  const response = await apiClient.patch(`/projects/${id}`, payload);
  return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
  await apiClient.delete(`/projects/${id}`);
};
```

**Reglas:**

- `POST` para alta, `PATCH` para modificación parcial, `DELETE` para baja. No hay `PUT` salvo
  `PUT /week-assigned-times`, que es el contrato de la api para el guardado de la grilla completa.
- El alta devuelve la entidad creada; el borrado devuelve `void`.
- Un payload por operación, tipado en `types/{recurso}.types.ts`:
  `CreateXPayload` / `UpdateXPayload`.

## Hook de mutación

Un archivo por operación en `features/{módulo}/hooks/use{Verbo}{Recurso}.ts`.

```ts
'use client';
export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
```

**Reglas:**

- **Invalidar en `onSuccess` del hook, no en el componente.** El hook sabe qué keys tocó; el
  componente no tiene por qué.
- Invalidar la **colección** (prefijo plural) y, si la mutación afecta un ítem concreto, también
  `[recurso, id]`.
- El hook **no** navega ni muestra toasts. Eso es del componente, que tiene el contexto de la
  pantalla.

### Qué invalidar

| Mutación | Keys invalidadas |
|---|---|
| `useCreateClient`, `useUpdateClient` | `['clients']` |
| `useCreateProject`, `useUpdateProject`, `useDeleteProject` | `['projects']` |
| `useCreateObjective`, `useUpdateObjective`, `useDeleteObjective` | `['objectives']` |
| `useCreateRequirement` | `['requirements']` |
| `useUpdateRequirement` | `['requirements']` y `['requirement', reqid]` |
| `useAddRequirementActivity` | `['requirement', reqid]` |
| `useUploadAttachment`, `useDeleteAttachment` | `['attachments', entityType, entityId]` |
| `useCreateWorkedTime`, `useDeleteWorkedTime` | `['worked-times', ...]` y los reportes |
| `useSaveAllocations` | `['week-assigned-times', weekStart]` |

## Feedback en el componente

El patrón es siempre el mismo: `mutate` con callbacks locales.

```tsx
createClientMutation.mutate(payload, {
  onError: (error: unknown) => {
    const err = error as { message?: string };
    toast.error(err?.message || 'Hubo un error al crear el actor');
  },
  onSuccess: () => {
    push('/clients');
    toast.success('Actor creado con éxito');
  },
});
```

**Reglas:**

- Un toast de éxito y uno de error por acción del usuario.
- El mensaje de error prioriza el de la api (`err.message`) y cae a un texto propio. Nunca se
  muestra un error crudo de axios.
- La navegación va en `onSuccess`, después del toast o antes, pero nunca en `onSettled`.
- `isPending` del hook alimenta el `loading`/`disabled` del botón. `<Button>` ya traduce
  `loading` a spinner + `aria-busy` + texto `sr-only` "Cargando...".

## Update optimista

Solo `useUpdateRequirement` lo hace, y es el único caso que justifica el BFF de escritura:

```ts
onMutate: async ({ reqid, payload }) => {
  await queryClient.cancelQueries({ queryKey: ['requirement', reqid] });
  const previousRequirement = queryClient.getQueryData<Requirement>(['requirement', reqid]);
  if (previousRequirement) {
    queryClient.setQueryData(['requirement', reqid], { ...previousRequirement, ...payload });
  }
  return { previousRequirement };
},
onError: (_error, { reqid }, context) => {
  if (context?.previousRequirement) {
    queryClient.setQueryData(['requirement', reqid], context.previousRequirement);
  }
},
onSuccess: (_data, { reqid }) => {
  queryClient.invalidateQueries({ queryKey: ['requirements'] });
  queryClient.invalidateQueries({ queryKey: ['requirement', reqid] });
},
```

**Regla:** si se agrega otro update optimista, el trío `onMutate` / `onError` / `onSuccess` va
completo. Un `onMutate` sin rollback en `onError` deja la UI mintiendo.

**Por qué acá sí:** el detalle de requisito cambia estado, tipo y prioridad desde pills en el
header. Sin optimismo, cada click deja la pill en el valor viejo hasta que vuelve la respuesta.

## Qué NO hacer

- No invalidar `queryClient.invalidateQueries()` sin key: barre todo el cache.
- No mutar y navegar sin invalidar: la pantalla destino puede leer datos viejos del cache.
- No usar `revalidatePath`/`revalidateTag`: no hay ningún uso en el servicio y no interactúan con
  el cache de TanStack Query.
- No poner `retry` en una mutación. El default es `0` a propósito.
