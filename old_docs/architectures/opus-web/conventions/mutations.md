---
id: mutations
display_name: Mutaciones (useMutation + invalidación explícita)
language: nextjs
description: useMutation contra el proxy del mismo origen, invalidación por query key, feedback desigual
applies_to: [frontend]
required_by: [data-fetching]
package: "@tanstack/react-query"
---

# Mutaciones (opus-web)

> **Reemplaza** la convención `mutations` del catálogo, que usa Server Actions con
> `useActionState` + Zod y `revalidateTag`. Acá todo pasa por `useMutation` de TanStack Query
> contra el proxy del mismo origen, y la invalidación es explícita por query key.

## El patrón

Un hook por mutación, en `features/{modulo}/hooks/`:

```ts
// src/features/comments/hooks/useCreateComment.ts:5-14
export function useCreateComment(requirementId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCommentPayload) => commentsApi.create(requirementId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirement', requirementId] });
    },
  });
}
```

**Reglas:**

- `mutationFn` llama al servicio, no a `apiClient` directo.
- `onSuccess` invalida lo que quedó viejo. Siempre explícito: no hay invalidación automática.
- El hook devuelve el `useMutation` entero. El componente usa `mutate`, `isPending`, `isError`.
- **Sin reintentos.** `mutations: { retry: 0 }` es el default del cliente
  (`providers.tsx:25-27`) y ninguna mutación lo sobreescribe. Correcto: reintentar un POST no es
  idempotente.

## Las cinco mutaciones

| Hook | Qué hace | Invalida | Feedback al usuario |
|---|---|---|---|
| `useCreateRequirement` | `POST /requirements` | `['requirements', projectId]` | Pantalla de éxito en el modal, 1.8 s |
| `useUpdateRequirement` | `PATCH /requirements/{id}` | `['requirement', id]` + `['requirements', projectId, 'byStatus']` | Toast de éxito y de error |
| `useCreateComment` | `POST /requirements/{id}/comments` | `['requirement', requirementId]` | El input se limpia |
| `useSubscribe` | `POST /requirements/{id}/subscriptors` | `['requirement', requirementId]` | Ninguno |
| `useUnsubscribe` | `DELETE /requirements/{id}/subscriptors/{userId}` | `['requirement', requirementId]` | Ninguno |

## Qué invalidar

La regla es: **invalidar todo árbol de query donde el dato mutado aparece.**

`useUpdateRequirement` es el ejemplo completo, porque un requisito vive en dos árboles:

```ts
// src/features/requirements/hooks/useUpdateRequirement.ts:18-24
onSuccess: (updatedRequirement: Requirement) => {
  showToast('Requisito actualizado correctamente', 'success');
  queryClient.invalidateQueries({ queryKey: ['requirement', updatedRequirement.id] });
  queryClient.invalidateQueries({
    queryKey: ['requirements', updatedRequirement.projectId, 'byStatus'],
  });
},
```

Dos cosas a notar:

- **La segunda key es un prefijo.** `['requirements', projectId, 'byStatus']` matchea las siete
  queries de estado sin enumerarlas. Es lo que hace que al pasar un requisito de `analisis` a
  `desarrollo` se refresquen las dos columnas.
- **Los ids salen de la respuesta**, no de las variables. Por eso el hook recibe `_projectId` y no
  lo usa (`useUpdateRequirement.ts:6`): el `projectId` que importa es el que devuelve el servidor.

> **`useCreateRequirement` invalida una key que nadie tiene montada.** Invalida
> `['requirements', variables.projectId]` (`useCreateRequirement.ts:16-18`), que es la key de
> `useRequirements` — un hook que no consume ninguna pantalla. Las queries reales del tablero son
> `['requirements', projectId, 'byStatus', status]`, y **esa key no matchea con la invalidada**:
> `invalidateQueries` hace prefix match, y `['requirements', projectId]` sí es prefijo de
> `['requirements', projectId, 'byStatus', ...]`.
>
> Es decir: **funciona por prefijo, no por la key que el autor apuntaba.** El tablero se refresca
> igual. Vale saberlo antes de "arreglar" la key.

## Feedback: tres enfoques distintos

No hay una convención. Las cinco mutaciones resuelven el feedback de tres formas.

### Toast — el patrón a seguir

Solo `useUpdateRequirement`:

```ts
// src/features/requirements/hooks/useUpdateRequirement.ts:26-32
onError: (_error, variables) => {
  if (variables.payload.state !== undefined) {
    showToast('Error al actualizar el estado');
  } else {
    showToast('Error al actualizar la prioridad');
  }
},
```

Es el único hook con `onError`. El mensaje distingue qué falló según el payload.

`showToast(mensaje, tipo)` viene de `shared/components/ui/Toast/Toast.tsx:16-19`; el
`ToastContainer` está montado en `providers.tsx:50`.

### Estado local en el componente

`CommentInput` no usa toast: lee `isError` y `error` del hook y arma el mensaje en el componente
(`CommentInput.tsx:38-45`, `:134`), con un caso especial para el 403:

```ts
if (apiError.status === 403 || apiError.code === 'access_denied') {
  return 'Sin permiso para comentar';
}
```

### Nada

`useSubscribe` y `useUnsubscribe` no tienen `onError`. El componente refleja el fallo cambiando el
texto del propio botón a "Error" (`ModalTopbar.tsx:118`, `BoardHeader.tsx:128`) y poniendo el
motivo en el `title`. No hay toast ni mensaje persistente.

`useCreateRequirement` tampoco tiene `onError`, y el modal solo mira `isPending`: **si la creación
falla, el botón vuelve de "Creando..." a "Crear elemento" sin ningún mensaje.**

**Regla para código nuevo:** toast desde `onError` en el hook, como `useUpdateRequirement`. Es el
único de los tres que le dice al usuario qué pasó sin depender de que el componente lo recuerde.

## Sin updates optimistas

Ninguna mutación usa `onMutate` ni `setQueryData`. El flujo es siempre: mutar → esperar → invalidar
→ refetch.

*Consecuencia:* cambiar el estado de un requisito desde el dropdown tiene una latencia visible —
el pill no cambia hasta que vuelve el refetch de las siete queries del tablero.

`web` sí hace update optimista para el `PATCH` de requisito, y por eso necesita un route handler
propio. Acá no.

## Un caso aparte: las subidas de archivo

`attachmentsApi.uploadFile` **no es un `useMutation`.** Se llama con `await` desde un handler del
componente:

```ts
// src/features/requirements/components/RequirementDetailModal/components/CommentInput/CommentInput.tsx:85-112
try {
  setUploading(true);
  const [attachment] = await attachmentsApi.uploadFile('requirement_comment_draft', requirementId, file);
  // inserta el placeholder en el texto
  setComment((prev) => prev + placeholder);
  setPendingAttachments((prev) => [...prev, { /* ... */ }]);
} catch {
  setUploadError('Error al subir el archivo');
} finally {
  setUploading(false);
}
```

*Por qué:* el resultado no va a un cache de query sino al estado local del editor — el adjunto es
un borrador hasta que se manda el comentario. Un `useMutation` no aportaría nada acá.

*El precio:* el manejo de `uploading`/`error` es manual y está **duplicado literalmente** entre
`CommentInput.tsx:66-113` y `CreateRequirementModal.tsx:117-160`, incluidas las 12 extensiones
permitidas, el límite de 10 MB y los mensajes.

## Servicios duplicados

Antes de agregar un método de mutación, revisar que no exista. Hoy hay dos pares:

| Operación | Implementación A | Implementación B | Cuál corre |
|---|---|---|---|
| Suscribir / desuscribir | `requirementsApi.subscribe/unsubscribe` (`:79-85`) | `subscriptionsApi.subscribe/unsubscribe` (`:5-11`) | **B** — los hooks usan `subscriptionsApi` |
| Comentar | `requirementsApi.addActivity` → `POST /requirements/{id}/comment` (`:71-77`) | `commentsApi.create` → `POST /requirements/{id}/comments` (`:5-14`) | **B** |

Las dos de A no las llama nadie. La de comentarios además apunta a **otro endpoint** (singular vs
plural) y manda `typeOfActivity` y `visibilityLevel` explícitos, que la que corre no manda.

## Qué NO hacer

- No mutar sin invalidar. Si nada quedó viejo, probablemente la mutación no hacía falta.
- No invalidar `queryClient.invalidateQueries()` sin argumentos: refetchea todo, incluidas las
  siete queries del tablero.
- No poner `retry` en una mutación. El default es 0 y está bien.
- No agregar un método a un servicio sin revisar si ya existe en otro.
- No dejar una mutación sin feedback de error. Hoy tres de las cinco lo hacen; no es el patrón a
  copiar.
