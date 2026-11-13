# ADR-011: TanStack Query como única capa de estado de servidor

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** frontend, estado, cache, react
**Detectado desde:** `web`, `opus-web`

---

## Contexto

Los dos frontends son, en esencia, vistas sobre datos remotos: listados con filtros, detalles,
formularios que escriben y vuelven a leer. Casi todo su estado **es estado de servidor**, no
estado propio de la interfaz.

La forma tradicional de manejarlo es un store global (Redux, Zustand) donde se copian las
respuestas de la api. Eso convierte cada pantalla en un problema de sincronización: cuándo
refrescar, qué invalidar tras una escritura, cómo evitar mostrar datos viejos. Es el trabajo que
más bugs genera en aplicaciones de este tipo, y la mayoría son invisibles hasta que un usuario ve
un número desactualizado.

## Decisión

**TanStack Query es la única capa de estado de servidor.** No hay Redux, Zustand ni ningún store
global de datos remotos.

**Configuración** (`web/src/lib/queryClient.ts`):
- `staleTime`: **30 s** · `gcTime`: **5 min**
- `retry`: **1** en queries, **0** en mutations

Las query keys se organizan **por dominio**: `['projects', filters]`, `['requirement', reqid]`.
La invalidación tras una escritura usa el prefijo de la key.

El **update optimista se usa con moderación**: solo en `useUpdateRequirement` de `web`. El resto
espera la respuesta.

`opus-web` agrega `useInfiniteQuery` para el tablero: **siete queries en paralelo**, una por estado
de requisito, porque cada columna pagina por separado y con una sola query no se puede.

**Para el estado propio de UI** (qué acordeón está abierto, qué modal se muestra) se usa `useState`
local. React Context se reserva para lo que de verdad es transversal — y en la práctica quedó
**casi sin uso**: `web` monta `ProjectContext` y `SidebarContext` en `providers.tsx` y **ningún
componente los consume**.

## Implementation Rules

- Todo dato que venga de la api **DEBE** manejarse con TanStack Query. **NO SE DEBE** copiar una
  respuesta a `useState` ni a un store global.
- Las query keys **DEBEN** seguir el patrón por dominio: `['<dominio>', <identificador o filtros>]`.
- Tras una mutación exitosa **DEBE** invalidarse la key afectada. Al invalidar por prefijo, hay que
  verificar que el prefijo cubra lo que se pretende.
- Las mutations **DEBEN** mantener `retry: 0`. Reintentar una escritura sin idempotencia
  garantizada duplicaría datos ([ADR-002](ADR-002-comandos-nats-sin-jetstream.md)).
- El update optimista **DEBE** usarse solo donde el rollback sea trivial y la latencia se note. **NO
  SE DEBE** aplicar por default.
- El estado propio de la interfaz **DEBE** usar `useState` local. Un Context nuevo **DEBE**
  justificarse por tener consumidores reales.
- En listados paginados por categoría, **DEBE** evaluarse el costo de montar N queries en paralelo:
  el tablero del portal monta 7 y su `isLoading` es un `some`, así que la pantalla espera a la más
  lenta.

## Consecuencias

### Positivas

- **La sincronización deja de ser código propio.** Cache, invalidación, deduplicación de requests
  en vuelo y refetch los resuelve la librería.
- **Sin estado remoto duplicado.** No hay una copia en un store que pueda quedar desactualizada
  respecto de la api.
- **`staleTime` de 30 s corta el ruido de refetch** sin que los datos se sientan viejos en una
  herramienta de trabajo.
- **`retry: 0` en mutations es la decisión correcta** dado que los comandos no son idempotentes:
  reintentar una carga de horas la duplicaría.
- **Menos código por pantalla:** un hook por consulta, sin acciones, reducers ni selectores.

### Negativas

- **La invalidación por prefijo es implícita y frágil.** Funciona, pero entender qué se invalida
  exige conocer la convención. En `opus-web` hay un caso donde `useCreateRequirement` invalida
  `['requirements', projectId]` —la key de un hook que **nadie monta**— y funciona igual porque es
  prefijo de las keys del tablero. Es correcto por accidente.
- **Siete queries en paralelo en el tablero del portal**, con `isLoading` como `some`: la pantalla
  entera espera a la columna más lenta.
- **Contexts montados sin consumidores** en `web`: `ProjectContext` y `SidebarContext` están en el
  árbol y nadie los usa. Es código muerto que sugiere una capa de estado que no existe.
- **Configuración duplicada** en `opus-web`: `lib/queryClient.ts` está definido y sin uso, mientras
  la configuración real vive en `providers.tsx`.

### Riesgos

- **Riesgo:** una invalidación por prefijo deja de cubrir una key tras un renombre, y la pantalla
  muestra datos viejos sin error visible.
  - **Mitigación:** ninguna automática. Los tests de hooks lo detectarían, pero **los seis hooks de
    requisitos de `opus-web` no tienen cobertura** (NFR-M07).
- **Riesgo:** alguien agrega un store global para un caso puntual y el producto termina con dos
  fuentes de verdad.
  - **Mitigación:** la regla explícita de arriba.
- **Riesgo:** `retry: 0` se cambia a un valor mayor "para mejorar la resiliencia" y duplica
  escrituras.
  - **Mitigación:** la regla lo prohíbe explícitamente, con su razón.

## Alternativas Consideradas

### Alternativa 1: Redux Toolkit (con o sin RTK Query)

**Pros:**
- Ecosistema maduro, devtools excelentes
- RTK Query cubre lo mismo que TanStack Query
- Un solo lugar para estado remoto y de UI

**Cons:**
- Mucho boilerplate para el estado de UI, que acá es mínimo
- Sin RTK Query, la sincronización vuelve a ser código propio

**Por qué se descartó:** el producto casi no tiene estado de cliente. Un store global habría sido
infraestructura para un problema que no existe.

---

### Alternativa 2: Solo Server Components y `fetch` de Next, sin cache de cliente

**Pros:**
- Menos JavaScript en el navegador
- La cache la maneja Next

**Cons:**
- Toda interacción que refresque datos exige un round-trip completo al servidor
- Los filtros con debounce, la paginación infinita y los updates optimistas se vuelven torpes
- Las pantallas más usadas (listados con 7 filtros, tablero paginado por columna) son intensamente
  interactivas

**Por qué se descartó:** el producto tiene pantallas muy interactivas donde la cache de cliente es
lo que hace que se sientan rápidas.

---

### Alternativa 3: SWR

**Pros:**
- Más liviano y simple
- Cubre el caso básico de fetch con cache

**Cons:**
- Sin `useInfiniteQuery` tan desarrollado, que el tablero del portal necesita
- Menos control sobre invalidación y mutations

**Por qué se descartó:** no hay evidencia de que se haya evaluado. TanStack Query cubre más casos
del producto, en particular la paginación infinita por columna.

## Referencias

- Configuración: `web/src/lib/queryClient.ts`, `opus-web/src/app/providers.tsx:14-29`
- ADRs relacionados: [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-009](ADR-009-token-confinado-al-servidor.md)
