---
document: UX Gaps (as-is)
version: 1.0
date: 2026-08-18
status: abierto
origin: relevamiento de código — brownfield
---

> Diferencia entre lo que el producto tiene hoy y lo que la metodología espera, relevada desde el
> código. Cada fila cita su evidencia. **No es una crítica de diseño**: es la lista de lo que falta
> implementar, para que entre al ciclo de requerimientos en vez de descubrirse story por story.
>
> Este documento se encoge: cuando un gap se cierra, se borra la fila y se anota en el historial.

## Resumen

**Superficies relevadas:** 2 · **Pantallas relevadas:** 30 (25 en `web`, 5 en `opus-web`)

| Categoría | Gaps | Severidad dominante |
|---|---|---|
| Estados no implementados | 34 | **Alta** |
| Accesibilidad | 24 | Media |
| Sin tratamiento responsive / navegación | 4 | **Alta** |
| Funcionalidad ausente o parcial | 12 | Media |
| Fuera del design system (tokens, duplicación) | 14 | Baja |
| Microcopy e i18n | 7 | Baja |
| Navegación y flujo | 6 | Media |

**Total: 101 gaps** sobre 30 pantallas.

**Los tres más frecuentes:**

1. **Estado de error de query no implementado** — 11 pantallas en `web`, todo el tablero en
   `opus-web`. El patrón es siempre el mismo: desestructurar solo `isLoading` de `useQuery` e
   ignorar `isError`. **La consecuencia es que un fallo de la api se ve idéntico a "no hay datos".**
2. **Elementos interactivos que no son botones** — 24 casos entre las dos superficies: `<div
   onClick>` y `<tr onClick>` sin `role`, `tabIndex` ni handler de teclado. En varias pantallas
   esto hace que una acción sea **inalcanzable sin mouse**.
3. **Estados de UI ausentes en las mutaciones** — 3 de las 5 mutaciones de `opus-web` no le dicen
   nada al usuario cuando fallan.

> **Dato que cambia cómo leer esto:** en las dos superficies **el patrón correcto ya existe escrito
> en el código** y no está aplicado. En `web`, `asignacion-tiempo` implementa los tres estados
> completos. En `opus-web`, `ProjectCard` y `RequirementCard` tienen `role="button"`, `tabIndex` y
> `onKeyDown` bien hechos. **No es que el equipo no sepa cómo: es que no se aplicó de forma
> consistente.** Eso hace que la mayoría de estos gaps sean trabajo mecánico, no diseño nuevo.

## Criterio de severidad

| Severidad | Criterio |
|---|---|
| **Alta** | El usuario queda sin salida: error de sistema sin manejar, pantalla en blanco, pérdida de datos |
| **Media** | El usuario se confunde o pierde tiempo, pero puede seguir: empty state ausente, viewport sin tratamiento, foco no manejado |
| **Baja** | Deuda interna sin impacto directo en el usuario: componente duplicado, estilo inline en vez de token |

## Gaps por superficie

### opus-web

| Pantalla | Gap | Categoría | Severidad | Acción | Evidencia |
|---|---|---|---|---|---|
| _shell (mobile) | **Sin navegación alguna bajo 768px**: no se puede cambiar de proyecto ni cerrar sesión | responsive | **Alta** | story | `Sidebar.module.scss:13-15` + `(dashboard)/layout.tsx:12-19` |
| todas | Sin `error.tsx`, `not-found.tsx` ni `loading.tsx` en **ninguna** ruta | estado ausente | **Alta** | story | `find src/app -name "error.tsx"` → vacío |
| tablero-requisitos | Sin estado de error: si fallan las 7 queries se ve un tablero vacío indistinguible de un proyecto sin requisitos | estado ausente | **Alta** | story | `requirements/page.tsx:153-162` |
| overlay: nuevo requisito | **Sin estado de error de creación**: el botón vuelve de "Creando..." a "Crear elemento" sin mensaje | estado ausente | **Alta** | story | `CreateRequirementModal.tsx:571-573` |
| overlay: suscripción | El error es la palabra "Error" en el botón y el motivo en un `title` — **invisible en touch** | estado ausente | **Alta** | story | `ModalTopbar.tsx:105-118` |
| tablero-requisitos | Un `projectId` inexistente no da 404 | not found ausente | **Alta** | story | sin `not-found.tsx` |
| tablero-requisitos | Sin estado empty: un proyecto sin requisitos muestra 7 secciones en cero | estado ausente | Media | story | `requirements/page.tsx:164-196` |
| tablero-requisitos | Si `useProjects` falla, el nombre del proyecto cae al literal "Proyecto" sin avisar | estado ausente | Media | story | `requirements/page.tsx:132-135` |
| overlay: detalle | Sin reintentar en error, a diferencia de la página equivalente | estado ausente | Media | story | `RequirementDetailModal.tsx:48-60` |
| overlay: selector de suscriptores | "Sin usuarios disponibles" tanto si la lista está vacía como si la query falló | estado ausente | Media | story | `UserSelector.tsx:68-70` |
| tablero-requisitos (mobile) | **Los 7 acordeones se pintan igual**: el mapa de estados usa etiquetas de un enum que ya no existe | bug visual | Media | story | `StateAccordion.tsx:15-23` |
| _shell | Los proyectos del sidebar son `<div onClick>` sin `role`, `tabIndex` ni teclado | accesibilidad | Media | story | `Sidebar.tsx:71-75` |
| tablero-requisitos | Las filas de la tabla son `<div onClick>` sin rol ni teclado | accesibilidad | Media | story | `ListRequirementRow.tsx:143` |
| tablero-requisitos | La tabla se construye con `<div>` + `display:grid`, sin roles ARIA de tabla | accesibilidad | Media | story | `ListView.tsx:76-85` |
| overlay: nuevo requisito | Las opciones de los 3 dropdowns son `<div onClick>` sin rol ni teclado | accesibilidad | Media | componente DS | `CreateRequirementModal.tsx:584,602,631` |
| todos los overlays | Ningún modal atrapa el foco ni lo devuelve al cerrar | accesibilidad | Media | componente DS | `Modal.tsx:34-44` |
| overlay: nuevo requisito | El error de título obligatorio es solo un borde rojo: sin mensaje ni `aria-invalid` | accesibilidad | Media | story | `CreateRequirementModal.tsx:217-221` |
| dropdowns | `aria-selected="false"` **fijo en todas** las opciones, incluida la activa | accesibilidad | Media | componente DS | relevamiento de pantalla |
| todas | `<html lang="en">` en una interfaz enteramente en español | i18n | Media | story | `app/layout.tsx:23` |
| tablero-requisitos | En desktop **no hay botón de "nuevo requisito" en la pantalla**: el único acceso es el sidebar | navegación | Media | decisión UX | `BoardHeader.tsx:24` recibe `onNewRequirement` y lo ignora |
| tablero-requisitos | Un requisito abierto en el modal **no tiene URL**: un refresh vuelve al tablero | navegación | Media | decisión UX | `requirements/page.tsx:40` |
| detalle-requisito | Estado/tipo/prioridad son readonly acá **para todos los roles**, incluidos los internos que sí los editan en el tablero | inconsistencia | Media | decisión UX | relevamiento de pantalla |
| detalle-requisito | Sin `<h1>`: la jerarquía arranca en `<h2>` | accesibilidad | Media | story | relevamiento de pantalla |
| detalle-requisito | `<textarea>` de comentario sin label ni `aria-label`; el foco no vuelve al editor tras enviar | accesibilidad | Media | story | relevamiento de pantalla |
| proyectos-redireccion | El empty es **ambiguo**: no distingue "sin proyectos", "sin permisos" y "alta fallida" | estado ausente | Media | decisión UX | relevamiento de pantalla |
| login | `signIn` sin `.catch()`: el loading es **irreversible**, el botón queda deshabilitado para siempre | estado ausente | **Alta** | story | relevamiento de pantalla |
| login | No lee `?error=` de NextAuth: un fallo de OIDC no se comunica | estado ausente | Media | story | relevamiento de pantalla |
| login-entrada | Sin `loading.tsx` pese a un POST bloqueante de hasta 10 s | estado ausente | Media | story | relevamiento de pantalla |
| todas | Estilos inline con color en vez de token en los indicadores de estado y prioridad | token | Baja | story | `ListRequirementRow.tsx:82-110` |
| todas | **La paleta de estados/prioridades vive duplicada en 6 archivos, con valores divergentes** | token | Baja | story | `requirement.constants.ts` + 5 módulos SCSS |
| detalle-requisito | Título a 28px en la página y 26px en el modal, mismo contenido | consistencia | Baja | story | `RequirementDetailView.module.scss:27-29` |
| detalle-requisito | Panel de actividad de 559px en la página y 558px en el modal | consistencia | Baja | story | `RequirementDetailView.module.scss:42` |
| todas | Tuteo inconsistente: "No tienes proyectos asignados" (tú) vs "Intentá de nuevo más tarde" (vos) | microcopy | Baja | decisión UX | `projects/page.tsx:55` |
| tablero-requisitos | El `aria-label` del acordeón dice **"objetivos"** en una UI que dice "requisitos" | microcopy | Baja | story | relevamiento de pantalla |
| detalle-requisito | El pie de autoría dice "Elemento", no "Requisito"; "ACTIVIDAD" en mayúsculas acá y "Actividad" en el modal | microcopy | Baja | story | relevamiento de pantalla |
| login | "OPUS" en mayúsculas (única vez en la app); "tarea" en la descripción vs "requisito" en el resto | microcopy | Baja | decisión UX | relevamiento de pantalla |

### web

| Pantalla | Gap | Categoría | Severidad | Acción | Evidencia |
|---|---|---|---|---|---|
| todas las autenticadas | **Sin navegación en mobile**: sidebar de 290px fija, sin drawer ni hamburguesa | responsive | **Alta** | decisión UX | `(loggedin)/styles.module.scss:1-26` |
| detalle-proyecto, edicion-proyecto, edicion-actor | **Loader infinito** ante error de carga: la condición nunca se resuelve | estado ausente | **Alta** | story | `projects/[id]/page.tsx:25-27` |
| home-vacia | La pantalla no hace nada: `<h1>Home</h1>` con el `redirect('/clients')` **comentado** — y **es el destino del login** | flujo roto | **Alta** | decisión UX | `app/page.tsx:3-13`, `login/enter/page.tsx:8` |
| carga-horas | **Sin tope diario**: se pueden registrar 20 horas en un día sin advertencia en la UI | validación ausente | **Alta** | story | `WorkedTimesPage.tsx:160` |
| alta-tareas | El envío múltiple usa `Promise.all`: falla con el primero, las creadas quedan, **y reintentar duplica** | correctness | **Alta** | story | `objectives/new/page.tsx:136,149-151` |
| asignacion-tiempo | Los cambios sin guardar **se pierden al cambiar de semana, sin aviso** | confirmación ausente | **Alta** | story | `WeeklyAllocationTable.tsx:190-199` |
| detalle-requisito | "Resolver" y "Cancelar" (transiciones terminales) **no piden confirmación**, mientras borrar un adjunto sí | confirmación ausente | **Alta** | decisión UX | `RequirementResolutionCard.tsx:81,85` |
| tareas-por-proyecto, tareas-por-responsable | Fallo de la api **indistinguible de "no hay datos"**: `catch` → `console.error`, lista vacía sin mensaje | estado ausente | **Alta** | story | `objectives/by-project/page.tsx:9-13` |
| listado-actores, listado-proyectos, listado-requisitos, listado-tareas, detalle-requisito, carga-horas | Sin estado de error de query (6 pantallas más) | estado ausente | Media | story | `ClientsBoard.tsx:70` y 5 más |
| detalle-proyecto, detalle-tarea | Sin manejo de entidad inexistente: sin `notFound()` ni `isError` | not found ausente | Media | story | `objectives/[id]/page.tsx:12` |
| listado-tareas | `error.tsx` **descarta el error** y muestra "Error inesperado" fijo | estado degradado | Media | story | `objectives/error.tsx:5-11` |
| reporte-horas | Sin estado empty y error solo por toast de 2 s: un fallo se ve igual que un período sin horas | estado ausente | Media | story | `ReportPage.tsx:96-99` |
| alta-requisito, edicion-requisito | **Los mensajes de validación existen y no se muestran**: el getter está descartado (`const [, setErrors]`) | error de validación | Media | story | `CreateRequirementForm.tsx:236` |
| alta-proyecto, edicion-proyecto | Los errores del schema se descartan a favor de un toast genérico | error de validación | Media | story | `projects/new/page.tsx:183-188` |
| alta-tareas, edicion-tarea | Mensaje genérico "Revisá que no haya campos incompletos" sin decir cuáles | error de validación | Media | story | `objectives/new/page.tsx:408` |
| reporte-horas | La tabla jerárquica de 4 niveles se expande con `<div>` sin `role`, `tabIndex`, `aria-expanded` ni teclado | accesibilidad | Media | story | `HierarchicalTable.tsx:111-395` |
| asignacion-tiempo | Los inputs de la grilla N×M **sin `<label>` ni `aria-label`**, y la primera celda es `<td>` en vez de `<th scope="row">` | accesibilidad | Media | story | `EditableCell.tsx:37-44` |
| carga-horas | El semáforo del día se comunica **solo por color**: `<span>` vacío sin texto ni `aria-label` | accesibilidad | Media | story | `DaySelector.tsx:76` |
| listado-tareas y 2 más | El área de la tarea se comunica **solo por color**, con el nombre en un tooltip de `:hover` | accesibilidad | Media | story | `AreaTag.tsx:32-34` |
| transversal | **6 tablas con `<tr onClick>`** sin `role`, `tabIndex` ni teclado | accesibilidad | Media | componente DS | `TableRow.tsx:20` y 5 más |
| transversal | **4 dropdowns propios con 4 niveles distintos de ARIA**, ninguno con navegación por flechas | accesibilidad | Media | componente DS | `StateTag.tsx` y 3 más |
| transversal | El `Tooltip` se activa solo con `:hover`, sin `:focus` ni `aria-describedby` — y comunica por qué una opción está deshabilitada | accesibilidad | Media | componente DS | `Tooltip.module.scss:37` |
| todos los overlays | Ningún modal atrapa el foco salvo `ConfirmDialog` (que usa `<dialog>` nativo) | accesibilidad | Media | componente DS | `PreviewModal.tsx:80` |
| tareas-por-proyecto, tareas-por-responsable | El date-picker se abre desde un `<div onClick>`: **escritura inalcanzable por teclado** | accesibilidad | Media | story | `FinishDateLabel.tsx:162-167` |
| reporte-requisitos | La tabla de 12 columnas tiene `overflow-x: auto` pero la región **no es enfocable** | accesibilidad | Media | story | `RequirementsReportTable.module.scss:1-5` |
| asignacion-tiempo | La sobreasignación se marca **solo por color**, sin texto ni `aria-invalid`, y no bloquea el guardado | accesibilidad | Media | story | `EditableCell.module.scss:34-39` |
| reporte-requisitos | **No hay forma de llegar desde la UI**: no está en la navegación ni la enlaza ninguna pantalla | navegación | Media | decisión UX | `Navbar.tsx:58-62` |
| detalle-tarea | "Volver" va siempre a `/objectives/by-project`, sin importar desde dónde se entró (4 entradas) | navegación | Media | story | `objectives/[id]/page.tsx:21` |
| carga-horas | La ventana de carga **no tiene navegador de períodos**: no hay forma de corregir una carga más vieja | funcionalidad ausente | Media | decisión UX | `DaySelector.tsx:38-56` |
| tareas-por-responsable | **Las tareas sin responsable no aparecen en ningún grupo**: quedan fuera de la vista | funcionalidad ausente | Media | story | `objectives/by-responsible/page.tsx:38-48` |
| detalle-tarea | No se puede borrar una tarea ni un comentario; `<DeleteObjectiveButton>` es código muerto | funcionalidad ausente | Media | decisión UX | `features/objectives/index.ts:3` |
| reporte-horas | Sin exportación, a diferencia de reporte-requisitos que sí tiene CSV | funcionalidad ausente | Media | decisión UX | `ReportPage.tsx:115-141` |
| edicion-requisito | El select de estado **permite cualquier transición**, salteando el workflow que el detalle modela | regla inconsistente | Media | story | `EditRequirementForm.tsx:500-506` |
| asignacion-tiempo | No se explica **por qué** no se puede editar (rol, semana pasada, o domingo) | estado ausente | Media | story | `WeeklyAllocationTable.tsx:296` |
| edicion-tarea | El proyecto no es editable y **nada explica por qué** ni cómo mover la tarea | estado ausente | Media | decisión UX | `objectives/edit/[id]/page.tsx:254-261` |
| listado-actores, listado-proyectos | Al cambiar filtro **no se resetea `page`** | estado inconsistente | Media | story | `ClientListFilters.tsx:21-34` |
| reporte-requisitos | Los filtros viven en estado local, no en la URL: **el reporte filtrado no se puede compartir** | estado inconsistente | Media | story | `RequirementsReportPage.tsx:18-23` |
| listado-requisitos | La paginación no sabe el total: "siguiente" se habilita comparando `length >= limit` | funcionalidad parcial | Media | story | `RequirementList.tsx:218,231` |
| listado-tareas | La barra de filtros suma **140% de ancho** con `nowrap`: los últimos quedan recortados sin scroll | responsive | Media | story | `ObjectiveSearchFilters.module.scss:9-21` |
| carga-horas | La lógica de los 8 días está **duplicada en dos archivos**: si divergen, el semáforo deja de corresponder a los botones | duplicación | Media | story | `DaySelector.tsx:38-56` |
| listado-actores | El filtro por estado se aplica **en memoria después de traer todo** | performance | Baja | story | `ClientsBoard.tsx:17-45` |
| tareas-por-proyecto | Sin límite de volumen: renderiza todos los proyectos con todas sus tareas | performance | Baja | story | `objectives/by-project/page.tsx:19` |
| alta-tareas | Los N formularios no tienen encabezado ni número: los botones "Borrar"/"Clonar" son indistinguibles | accesibilidad | Baja | story | `objectives/new/page.tsx:269-424` |
| detalle-proyecto | Card vacía renderizada entre secciones | bloque residual | Baja | story | `projects/[id]/page.tsx:51` |
| listado-actores, listado-proyectos | Typos en microcopy: `"Cargando  ..."` (doble espacio) y **`"Cagando..."`** | microcopy | Baja | story | `clients/page.tsx:29`, `projects/page.tsx:30` |
| detalle-proyecto, sin-permisos | Estilos inline en vez de tokens/módulo | token | Baja | story | `unauthorized/page.tsx:6-38` |
| 3 componentes de navegación | Clases condicionales con template string: escriben **`"false"`** en el atributo `class` | bug latente | Baja | story | `NavItem.tsx:48-51` |

## Gaps transversales

Estos pesan más que los de pantalla: **cerrarlos arregla muchas pantallas a la vez.**

| Gap | Alcance | Severidad | Acción | Evidencia |
|---|---|---|---|---|
| **Sin manejo de error de query** — el patrón es desestructurar solo `isLoading` e ignorar `isError` | 11 pantallas en `web` + todo el tablero de `opus-web` | **Alta** | story | 12 archivos |
| **Sin i18n**: todos los textos hardcodeados en JSX, en español | las dos superficies | Media | decisión UX | sin dependencia de i18n |
| **Elementos interactivos sin semántica**: `<div onClick>` / `<tr onClick>` sin `role`, `tabIndex` ni teclado | 24 casos en las dos superficies | Media | componente DS | 12 archivos |
| **Ningún modal atrapa el foco** (salvo `ConfirmDialog` de `web`) | todos los overlays de las dos superficies | Media | componente DS | 6 archivos |
| **Los dropdowns no tienen navegación por flechas** y tienen 4 niveles distintos de ARIA | 4 en `web`, 2 implementaciones en `opus-web` | Media | componente DS | 6 archivos |
| **Información comunicada solo por color** (área, semáforo de horas, sobreasignación, período activo) | 4 casos en `web` | Media | story | 4 archivos |
| **Tres formas de hacer un select** (`InputSelect`, `Select`, `react-select` con `selectStyles` duplicado en 5 archivos) | `web` | Baja | componente DS | 5 archivos |
| **Tres enfoques de formulario** conviviendo (`react-hook-form`, `yup` manual, `useState` crudo) | `web` | Baja | decisión UX | 3 archivos |
| **Tokens declarados dos veces** con los mismos valores | `web` | Baja | story | `globals.scss:4-77` vs `_variables.scss:6-160` |
| **`--z-index-navbar` (400) > `-modal` (200) y `-tooltip` (300)** — orden invertido, latente | `web` | Baja | story | `_variables.scss:196-199` |
| **Dos pares de colores de estado idénticos**: `inactivo`=`backlog`, `analisis`=`en_revision` | `web` | Baja | decisión UX | `_variables.scss:44-50` |
| **`line-height` igual al `font-size`** en `h1`, `h2`, `p` globales: el texto multilínea se toca | `web` | Baja | story | `globals.scss:189-207` |
| **20 componentes muertos** exportados desde barrels, así que aparecen como disponibles | 11 en `web`, 9 en `opus-web` | Baja | story | 2 barrels |
| **`Pagination` no es reutilizable** (hardcodea `/objectives`): causa 4 paginaciones reimplementadas | `web` | Baja | componente DS | `Pagination.tsx:35` |

## Siguiente paso sugerido

Agrupaciones candidatas para capturar como requerimiento con `/product-new-request`. **Agrupadas
por causa, no por pantalla**, porque la causa es lo que se arregla una vez:

1. **Implementar el estado de error de query en todas las pantallas** — 12+ gaps, severidad
   **Alta**. Es un solo patrón repetido: leer `isError` y renderizar un bloque de error. El patrón
   correcto ya existe en `asignacion-tiempo`. Es el requerimiento de **mayor impacto por esfuerzo**
   de toda la lista.

2. **Dar navegación mobile al portal de clientes** — 1 gap, severidad **Alta**. Es un solo gap y es
   el más grave del producto: hoy un cliente en un teléfono queda encerrado en el proyecto al que
   entró. **El componente que lo resuelve (`MobileMenu`) ya está escrito y es código muerto.**

3. **Comunicar el resultado de las mutaciones** — 6 gaps, severidad **Alta**. Creación de requisito
   sin mensaje de error, suscripción cuyo error es invisible en touch, validaciones que se calculan
   y se descartan. Todas comparten la causa: **el error existe y no llega al usuario.**

4. **Hacer accesibles los elementos interactivos** — 24 gaps, severidad Media. `role`, `tabIndex` y
   `onKeyDown` en filas, cards y opciones de dropdown. El patrón correcto ya está escrito en
   `ProjectCard` y `RequirementCard` de `opus-web`.

5. **Unificar los overlays en componentes del DS** — 10 gaps, severidad Media. Un `Modal` con focus
   trap y un `Dropdown` con navegación por flechas resuelven de una vez los 6 modales y los 6
   dropdowns de las dos superficies.

6. **Decidir el responsive del gestor interno** — 2 gaps, severidad **Alta**, acción **decisión UX**
   antes que story. No es trabajo de implementación hasta que alguien responda si `web` debe ser
   usable en mobile. Si la respuesta es sí, el shell es lo primero.

7. **Consolidar los tokens de color** — 5 gaps, severidad Baja. La paleta de dominio de `opus-web`
   en 6 lugares con valores divergentes, los tokens duplicados de `web`, el z-index invertido y los
   pares de colores idénticos.

## Historial

*(Vacío: ningún gap cerrado todavía. Cuando se cierre uno, se borra su fila y se anota acá el
REQ/story que lo cerró.)*
