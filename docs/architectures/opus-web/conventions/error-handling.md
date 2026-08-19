---
id: error-handling
display_name: Manejo de errores
language: nextjs
description: ApiError normalizado en el interceptor, toasts, estados por pantalla, sin error boundaries
applies_to: [frontend]
required_by: [data-fetching]
package: axios
---

# Manejo de errores (opus-web)

> **Reemplaza** la convención `error-handling` del catálogo, que usa `error.tsx` por ruta.
> **Este servicio no tiene ningún `error.tsx`**, ni `not-found.tsx`, ni `global-error.tsx`.

## `ApiError`: la forma normalizada

Todo error de red pasa por el mismo interceptor y sale con la misma forma:

```ts
// src/lib/axios.ts:5-9
export interface ApiError {
  code: string;
  message: string;
  status: number;
}
```

```ts
// src/lib/axios.ts:24-38
const errorInterceptor = (error: AxiosError<ApiError>) => {
  const apiError: ApiError = {
    code: error.response?.data?.code ?? 'unknown_error',
    message: error.response?.data?.message ?? 'Error desconocido',
    status: error.response?.status ?? 500,
  };

  // Redirect a login si es 401 (solo en cliente)
  if (error.response?.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/login';
  }

  return Promise.reject(apiError);
};
```

Está registrado en los dos clientes (`axios.ts:41` y `:68`).

**Tres consecuencias:**

1. **Un `catch` nunca recibe un `AxiosError`.** Recibe un `ApiError` plano. Por eso el patrón para
   tiparlo es `const apiError = error as ApiError`, no un `isAxiosError`.
2. **Los tres campos siempre existen.** Un fallo de red sin respuesta da
   `{code:'unknown_error', message:'Error desconocido', status:500}`.
3. **El 401 no llega al componente como un error a mostrar**: el interceptor ya sacó al usuario
   con `window.location.href`. Es una recarga completa, que además limpia el cache de TanStack
   Query.

**Regla:** un servicio no atrapa errores. Los deja subir para que el hook o el componente decidan.
La única excepción justificada es `attachmentsApi.uploadFile`, que usa `fetch` y arma el error a
mano (`attachmentsApi.ts:18-25`) porque no pasa por el interceptor.

## Toasts

```ts
// src/shared/components/ui/Toast/Toast.tsx:16-19
export function showToast(message: string, type: 'error' | 'success' = 'error') {
  const toast = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(toast));
}
```

Es un pub/sub de módulo: `showToast` se llama desde cualquier lado sin hook ni contexto, y el
`ToastContainer` montado en `providers.tsx:50` los renderiza en un portal.

- **El default es `'error'`.** `showToast('Algo falló')` sale rojo.
- Se auto-descartan a los **4 segundos** (`Toast.tsx:27-29`).
- `role="alert"` en cada uno (`Toast.tsx:42`).
- No se pueden cerrar a mano ni hay límite de cuántos se apilan.

**El único lugar que los usa es `useUpdateRequirement`** (`:19`, `:28`, `:30`). Tres mensajes en
toda la aplicación:

| Mensaje | Tipo | Cuándo |
|---|---|---|
| "Requisito actualizado correctamente" | success | `onSuccess` |
| "Error al actualizar el estado" | error | `onError` con `payload.state` |
| "Error al actualizar la prioridad" | error | `onError` sin `payload.state` |

**Regla para código nuevo:** un error de mutación se avisa con `showToast` desde el `onError` del
hook. Es el patrón correcto y hoy lo cumple una de cinco mutaciones.

## Estados por pantalla

El patrón dominante es el `if` temprano con retorno: el componente devuelve una pantalla completa
por estado, antes del render principal.

```tsx
// src/app/(dashboard)/projects/page.tsx:27-59
if (isLoading) {
  return (<div className={styles.container}><div className={styles.centered}>
    <Spinner size="lg" /><p className={styles.loadingText}>Cargando proyectos...</p>
  </div></div>);
}

if (isError) {
  return (<div className={styles.container}><div className={styles.centered}>
    <p className={styles.errorText}>Error al cargar los proyectos</p>
    <Button variant="primary" onClick={() => refetch()}>Reintentar</Button>
  </div></div>);
}

if (!projects || projects.length === 0) {
  return (<div className={styles.container}><div className={styles.centered}>
    <p className={styles.emptyText}>No tienes proyectos asignados</p>
  </div></div>);
}
```

**El orden es siempre `loading` → `error` → `empty` → contenido.** Se cumple donde los tres
existen.

### Quién implementa qué

| Pantalla / componente | loading | error | empty | Reintentar |
|---|---|---|---|---|
| `/projects` | sí | sí | sí | sí |
| `/projects/[id]/requirements` | sí | **no** | **no** | — |
| `/projects/[id]/requirements/[reqId]` | sí | sí | sí (`not found`) | sí + "Volver al listado" |
| `RequirementDetailModal` | sí | sí | — | **no** |
| `Sidebar` | sí | sí | sí | sí |
| `Header` *(código muerto)* | sí | sí | — | sí |
| `MobileMenu` *(código muerto)* | sí | sí | — | sí |
| `ActivityPanel` | — | — | sí | — |
| `SubscribersList` | — | — | sí | — |
| `UserSelector` | sí | **no** | sí | — |

Los mensajes, verbatim:

| Contexto | Mensaje |
|---|---|
| `/projects` loading | "Cargando proyectos..." |
| `/projects` error | "Error al cargar los proyectos" |
| `/projects` empty | "No tienes proyectos asignados" |
| `/projects` redirigiendo | "Redirigiendo..." |
| requisitos loading | "Cargando requisitos..." |
| detalle loading | "Cargando requisito..." |
| detalle error | "Error al cargar el requisito" |
| detalle not found | "Requisito no encontrado" |
| modal error | "Error al cargar el requisito. Intentá de nuevo más tarde." |
| `Sidebar` empty | "No hay proyectos disponibles" |
| `ActivityPanel` empty | "No hay actividad registrada" |
| `SubscribersList` empty | "Sin suscriptores" |
| `ListView` sección vacía | "Sin elementos" |
| `MobileRequirementsBoard` sección vacía | "Sin requisitos en este estado" |

> **El tuteo es inconsistente.** "No tienes proyectos asignados" (tú) contra "Intentá de nuevo más
> tarde" (vos). Conviven en la misma aplicación.

## Errores de formulario: estado local

Ni toast ni `ApiError` directo. El componente arma el mensaje.

**`CommentInput`** distingue el 403:

```ts
// CommentInput.tsx:38-45
function getErrorMessage(error: unknown): string {
  const apiError = error as ApiError | null;
  if (!apiError) return '';
  if (apiError.status === 403 || apiError.code === 'access_denied') return 'Sin permiso para comentar';
  return apiError.message || 'Error al enviar el comentario';
}
```

Y combina dos fuentes en un solo lugar de render (`:134`):

```tsx
const displayError = uploadError || (isError ? getErrorMessage(error) : '');
```

**Validación de adjuntos**, con los mensajes exactos:

```ts
// CommentInput.tsx:74-83 — idéntico en CreateRequirementModal.tsx:123-131
if (file.size > MAX_SIZE_BYTES) { setUploadError('El archivo supera el límite de 10MB'); return; }
const ext = getExtension(file.name);
if (!ALLOWED_EXTENSIONS.includes(ext)) { setUploadError('Tipo de archivo no permitido'); return; }
```

**Validación de título** en `CreateRequirementModal` — la única validación de campo del servicio:

```tsx
// CreateRequirementModal.tsx:217-221
if (!title.trim()) {
  setTitleError(true);
  titleRef.current?.focus();
  return;
}
```

Sin mensaje de texto: solo un borde rojo (`styles.hasError`) y el foco. El error se limpia al
escribir (`:331`).

## Lo que no está cubierto

Estos son hallazgos, no propuestas.

- **`/projects/[id]/requirements` no maneja error ni empty.** Las siete queries pueden fallar y la
  pantalla muestra el tablero vacío igual. Si `useProjects` falla, `currentProjectName` cae a
  `'Proyecto'` (`requirements/page.tsx:132-135`) y nada avisa.
- **`CreateRequirementModal` no muestra el error de creación.** `useCreateRequirement` no tiene
  `onError` y el modal solo mira `isPending`: si falla, el botón vuelve de "Creando..." a "Crear
  elemento" sin explicación.
- **Las mutaciones de suscripción no avisan.** El error se refleja como la palabra "Error" dentro
  del botón (`ModalTopbar.tsx:118`) y el motivo en un `title` — que en un touch no se ve.
- **`RequirementDetailModal` en error no ofrece reintentar**, a diferencia de la página de detalle.
- **`UserSelector` no maneja error**: si `useProjectUsers` falla, muestra "Sin usuarios
  disponibles", igual que si la lista estuviera vacía (`UserSelector.tsx:68-70`).
- **Sin `error.tsx` en ninguna ruta.** Un throw en el render de un client component sube hasta el
  error boundary por defecto de Next.
- **Sin `not-found.tsx`.** Una URL inexistente da el 404 por defecto de Next, sin el shell de la
  aplicación.
- **`presentInApi` traga el error a propósito** y está documentado (`authApi.ts:24-31`). El costo:
  un alta fallida es indistinguible de un usuario sin proyectos.
- **`RichContentRenderer` traga los fallos de metadatos.** Los `fetch` con `HEAD` para el nombre y
  el tamaño del adjunto tienen `.catch(() => {})` (`:107-109`, `:135`): si fallan, el adjunto se
  muestra sin nombre y sin tamaño, sin señal.

## Qué NO hacer

- No atrapar errores en un servicio para devolver `null`. Que suba.
- No mostrar `error.message` crudo de un error que no pasó por el interceptor.
- No dejar una mutación sin `onError`.
- No usar `alert()` ni `console.log` para reportar: `showToast` o estado local.
- No inventar un formato de error nuevo en un route handler: `{code, message}`, que es lo que el
  interceptor sabe leer.
