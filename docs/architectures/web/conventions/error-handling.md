---
id: error-handling
display_name: Manejo de errores
language: nextjs
description: error.tsx por ruta, ApiError normalizado en el interceptor, toasts para errores de acción
applies_to: [frontend]
required_by: [data-fetching, mutations, forms]
package: null
---

# Manejo de errores (web)

> **Reemplaza** la convención `error-handling` del catálogo. La estructura es la misma
> (`error.tsx` como boundary, error esperado vs inesperado); cambia el contrato con el backend,
> que acá se normaliza en el interceptor de axios, y el canal de feedback, que es
> `react-toastify`.

## Tres niveles

| Nivel | Mecanismo | Para qué |
|---|---|---|
| Transporte | Interceptor de respuesta de axios → `ApiError` | Normalizar cualquier fallo de la api a una forma estable |
| Acción del usuario | `toast.error(...)` en el `onError` del `mutate` | Errores recuperables: el usuario reintenta |
| Render | `error.tsx` de la ruta | Excepciones no atrapadas durante el render de servidor |

## Nivel 1 — `ApiError`

```ts
// src/lib/axios.ts
export interface ApiErrorResponse { code?: string; message?: string; }
export interface ApiError { code: string; message: string; status: number; }

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const apiError: ApiError = {
      code: error.response?.data?.code ?? 'internal_error',
      message: error.response?.data?.message ?? 'Internal error',
      status: error.response?.status ?? 500,
    };
    if (error.response?.status === 401) {
      console.error('Unauthorized request detected - token may be expired');
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    return Promise.reject(apiError);
  }
);
```

**Reglas:**

- El error que llega a un hook o a un componente es **siempre** un `ApiError`, nunca un
  `AxiosError`. El interceptor lo garantiza para todo lo que pase por `apiClient`.
- El contrato con la api es `{ code, message }`. Es el formato que la api documenta en su
  convención `error-handling`. Los defaults (`internal_error` / `Internal error` / `500`) cubren el
  caso de una respuesta sin body parseable.
- El `401` se maneja acá y en un solo lugar: redirige a `/login`. **No** repetir ese chequeo en
  cada hook.
- La guarda `typeof window !== 'undefined'` es necesaria porque el interceptor corre en el
  servidor. Ahí el error se propaga y lo agarra el `error.tsx` de la ruta.

**Los errores que NO pasan por el interceptor:** los que vienen de un `ClientApi` (fetch o XHR
contra el BFF). Ahí el patrón es lanzar un `Error` con mensaje legible:

```ts
if (!response.ok) {
  const message = parsed.message || response.statusText || 'Unknown error';
  throw new Error(`Error creating client: ${message}`);
}
```

Por eso el `onError` de los componentes hace un cast defensivo: puede recibir un `ApiError` o un
`Error`.

## Nivel 2 — toasts

`<ToastContainer>` se monta una vez, en `(loggedin)/layout.tsx:31-42`: posición `top-right`,
`autoClose` 2000 ms, `closeOnClick`, `pauseOnHover`, tema `light`.

```tsx
mutation.mutate(payload, {
  onError: (error: unknown) => {
    const err = error as { message?: string; code?: string; status?: number };
    toast.error(err?.message || 'Hubo un error al crear el actor');
  },
  onSuccess: () => {
    push('/clients');
    toast.success('Actor creado con éxito');
  },
});
```

**Reglas:**

- El mensaje prioriza el de la api (`err.message`) y cae a un texto propio en español. **Nunca**
  se muestra un error crudo.
- Un toast por acción. No encadenar varios.
- Los mensajes de éxito establecidos siguen el patrón `"{Entidad} {participio} con éxito"`:
  `"Actor creado con éxito"`, `"Proyecto editado con éxito"`, `"Tarea editada con éxito"`. Los de
  error, `"Hubo un error al {infinitivo}"`.

  Hay excepciones ya en el código: `"Horas cargadas exitosamente"`, `"Comentario editado
  exitosamente"`, `"Cambios guardados correctamente"`, `"Comentario agregado"`, `"Registro
  eliminado"`. No unificado.

## Nivel 3 — `error.tsx`

Cinco boundaries hoy:

| Archivo | Cubre |
|---|---|
| `(loggedin)/objectives/error.tsx` | `/objectives` y sus subrutas |
| `(loggedin)/objectives/by-project/error.tsx` | esa vista |
| `(loggedin)/objectives/by-responsible/error.tsx` | esa vista |
| `(loggedin)/projects/error.tsx` | `/projects` y sus subrutas |
| `login/enter/error.tsx` | el callback de login |

```tsx
'use client';
export default function ErrorPage({ error }: { readonly error: CustomError }) {
  return (<><h1>Error</h1><p>{error.message}</p></>);
}
```

**Reglas:**

- `'use client'` obligatorio: un boundary es un Client Component.
- El tipo es `CustomError` de `@/shared/types`.
- **`/objectives/error.tsx` descarta el error y muestra `"Error inesperado"`** fijo, con el
  parámetro renombrado a `_error`. Los otros muestran `error.message`. Decisión no explicada en el
  código.

**Cobertura faltante:** no hay `error.tsx` en `clients`, `requirements`, `time-allocation`,
`worked-times`, ni uno global en `app/`. Una excepción en el render de servidor de esas rutas cae
en la pantalla de error por defecto de Next.

## `loading.tsx`

Cuatro archivos, todos el mismo cuerpo:

```tsx
export default function Loading() { return <Loader label="Cargando..." />; }
```

En `(loggedin)/`, `objectives/by-project/`, `objectives/by-responsible/` y `login/enter/`.

**Regla:** para el resto de las rutas el fallback viene de un `<Suspense>` explícito en la página,
con un label específico (`"Cargando reporte..."`, `"Cargando asignaciones..."`). Es preferible al
`loading.tsx` genérico porque dice qué se está cargando.

## `notFound()`

Solo en las dos rutas de requisito, para el id no numérico:

```tsx
const id = Number(reqid);
if (isNaN(id)) notFound();
```

**Regla:** validar el parámetro dinámico antes de usarlo. Las rutas de proyecto, actor y tarea
**no** lo hacen: `/projects/abc` pasa `NaN` a la api.

## Estados de datos en el componente

El patrón completo, de `AttachmentsList.tsx:31-46`:

```tsx
if (isLoading) return (<div className={styles.loading}><Spinner /><span>Cargando archivos...</span></div>);
if (error)     return <div className={styles.error}>Error al cargar archivos</div>;
if (!attachments || attachments.length === 0) return <div className={styles.empty}>No hay archivos adjuntos</div>;
```

**Reglas:**

- Los tres estados en ese orden: loading, error, empty. Después el happy path.
- El chequeo de vacío incluye el nulo: `!data || data.length === 0`.
- Los mensajes de vacío son afirmaciones, no instrucciones: `"No hay archivos adjuntos"`,
  `"No hay actores que coincidan con estos filtros."`, `"No se encontraron requisitos"`,
  `"Sin actividad registrada"`.

**Cobertura real:** la mayoría de las pantallas implementa loading y empty; **el estado de error de
query casi no se maneja**. Los que sí: `AttachmentsList` (`error`), `WeeklyAllocationTable`
(`isError` → mensaje + toast), `ReportPage` (`isError` → toast), `RequirementsReportPage`
(`isError` → mensaje). El resto de los listados deja la tabla vacía y es indistinguible de "no hay
datos". Detalle por pantalla en el relevamiento UX.

## Errores tragados a propósito

Tres lugares capturan y siguen. Los tres están documentados en el código:

| Dónde | Qué hace | Comentario en el código |
|---|---|---|
| `authApi.ts:19-21` | `POST /auth/present` falla → `console.warn` y continúa | `'Failed to present in API, but continuing'` |
| `shared/utils/parse-external-links.ts` | `EXTERNAL_LINKS` mal formado → `console.error` y devuelve `[]` | *"Una variable mal formada no debería tumbar la navegación entera."* |
| `objectives/by-project/page.tsx:11-13`, `by-responsible/page.tsx:23-25` | fallo de la api → `console.error`, `projectsList` queda `[]` | sin comentario |

**Regla:** tragar un error requiere comentario que diga por qué. Los dos primeros lo tienen. Los
últimos hacen que un fallo de la api sea indistinguible de "no hay datos" — la pantalla se
renderiza vacía y sin aviso.

## Logging

ESLint permite solo `console.warn` y `console.error` (`no-console` con
`allow: ['warn', 'error']`).

**Reglas:**

- `console.error` para lo que no debería pasar; `console.warn` para lo degradado pero esperado.
- **Nunca loguear el token, el payload de una sesión ni datos personales.** Hay una violación
  activa: `authApi.ts:8-15` imprime el access token completo si `LOG_ACCESS_TOKEN=true`, con el
  comentario *"Temporal (entorno local)… Sacar antes de mergear"*.

## Qué NO hacer

- No atrapar el `401` en un hook: ya lo maneja el interceptor.
- No mostrar `JSON.stringify(error)` al usuario. `clients/new/page.tsx:20` lo hace como último
  fallback.
- No renderizar una lista sin chequear largo. Es el gap más frecuente del relevamiento.
- No agregar un `try/catch` que solo hace `console.error` sin cambiar la UI: convierte un fallo en
  una pantalla vacía silenciosa.
