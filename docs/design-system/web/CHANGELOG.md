# Design System — Changelog

Sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y el versionado [Semantic Versioning](https://semver.org/lang/es/).

## [4.0.0] - 2026-09-04

Ajustes visuales contra `design_handoff_jiku_identity`, verificados **renderizando la aplicación
real** (Chromium sobre el dev server, con sesión) en vez de leyendo CSS. Ese método es lo que
encontró la mayoría de estos defectos: varios eran invisibles en el código y sólo aparecían en
pantalla.

**MAJOR** por cuatro cambios que rompen contrato: el criterio de variant de `Table`, la baja del
divisor de `ViewHeader`, el remapeo de `--avatar-bg` y la remoción de dos tokens.

### Corregido

- **Modo oscuro: las 6 familias de estado fallaban contraste AA.** S-059 derivó los tintes con la
  fórmula del DS pero **nunca redeclaró el TEXTO**, así que cada familia conservaba su profundo
  del modo claro sobre un tinte oscuro. Medido: violeta 1.38:1, ámbar 2.07:1, rojo 2.53:1, verde
  3.24:1, neutro 3.98:1 — las seis por debajo del mínimo de 4.5:1. Los tríos explícitos del
  manual dan entre 7.2:1 y 9.9:1. Es el defecto de mayor impacto de esta entrada.
- **`--text-link` no alcanzaba AA en oscuro** (3.79:1 sobre la superficie de card). Pasa al verde
  agua, que es lo que el manual pide: «en oscuro el *texto* verde pasa a verde agua». El acento
  de **relleno** sigue sin cambiar entre modos.
- **`globals.scss`: `span { font-size: 1.25rem }`** ponía **20px en todo `<span>`** de la
  aplicación. Como los componentes declaran su tipografía en el contenedor, el span interno se la
  comía: el texto de un `Badge` de estado renderizaba a 20px en vez de los 11px de su clase. Es
  la misma deuda que S-060 cerró para `h1`/`h2`/`p`; S-059 la había anotado como «fuera de
  alcance». Dada de baja.
- **`globals.scss`: `td { max-width: 9.4rem }` con `overflow: hidden`** recortaba toda celda a
  150px, y la pill «Planificación» mide 151px: **todas las pills de estado salían cortadas** en
  el listado de requisitos. Junto con `border: 3px` y `text-align: center`, que contradecían el
  manual. Dadas de baja las cinco reglas (`table`, `th`, `td`, `tr:hover`, `span`); `Table` del
  DS es la única tabla del producto y estila sus propias celdas.
- **La cabecera de `Table` heredaba su tipografía del contexto:** 16px en el listado de tareas y
  14px en el de requisitos, para la misma cabecera. Ahora la declara (11px/600 versalitas,
  tracking .08em).
- **El pie de la card de tarea desbordaba la card** (`scrollWidth` 331 sobre `clientWidth` 253) y
  en la card vencida el texto quedaba en gris sobre rojo, ilegible.
- **El FAB no mostraba su glifo:** `.fab .label { display: none }` ocultaba el propio «+», que es
  el contenido visible de los cuatro FAB del producto.
- **El nodo actual del `Stepper` quedaba vacío** (sin número) y la lista encogía al contenido, con
  las etiquetas pegadas entre sí.
- **El `Select` había perdido la búsqueda** al migrar de `react-select` en S-057. Con ~100
  proyectos, el filtro era impracticable.
- **El semáforo del chip de día era texto, no color:** el estado viajaba dentro del label («Vie 4
  ○ sin carga») y cada chip se leía como una frase. Vuelve a ser un punto de color con el estado
  en `sr-only`. Y el peso visual estaba invertido —el gris de «sin carga» pesaba más que el verde
  de «completa», con 1.52:1 entre ellos— así que se reasignaron los colores.

### Cambiado

- **`components/table.md` — BREAKING: el criterio de variant.** El spec asignaba `dense`
  (cabecera azul) a «tablas densas de seguimiento — tareas» y `light` a «listados navegables —
  requisitos». El listado de tareas y el reporte de requisitos pasan a `light`, y **`dense` queda
  sin consumidores**. Motivo: el propio criterio del spec fallaba —las filas de tareas SÍ navegan,
  el título linkea al detalle— y en pantalla la cabecera azul era lo único oscuro del producto:
  se leía como error, no como señal de densidad.
- **`components/view-header.md` — BREAKING: sin divisor.** Se le quita el `border-bottom`. El
  prototipo no lo lleva y el spec tampoco lo pedía: se había agregado en la implementación. La
  separación del contenido la da el gap de la columna de contenido del shell.
- **`tokens/component.md` — BREAKING: `--avatar-bg` pasa de `--bg-inverse` a `--bg-brand-deep`.**
  El spec dice «fondo azul oscuro» y ese azul no cambia entre modos, pero `--bg-inverse` en oscuro
  se remapea a la superficie del tema: el avatar perdía su azul.
- **`components/card.md`**: el pie de métricas pasa a grilla de 3 columnas a sangre; la card
  vencida rellena el pie de rojo pleno con texto blanco. Las cards de una fila igualan alto.
- **`components/badge.md`**: la etiqueta de card pasa a radio 8 con borde — la única pill del
  sistema que no es redonda.
- **`components/toggle-group.md`**: el contenedor `segmented` pasa a radio 10 (era pill).
- **`components/select.md`**, **`components/tabs.md`**, **`components/stepper.md`**,
  **`components/accordion.md`**, **`components/sidebar-nav.md`**: ver «Agregado» y «Corregido».
- **`tokens/semantic.md`**: se separa **`--bg-brand-deep`** de `--bg-inverse`. Tenían dos trabajos
  incompatibles: overlays y tooltips que deben seguir al tema, y superficies de marca (panel del
  login, avatares, cabecera densa, cifra destacada) que el manual fija en azul oscuro **fijo**.
  Confundirlos dejaba la card de métrica destacada idéntica a las otras tres en oscuro.
- **`tokens/semantic.md`**: se separa **`--bg-accent-soft`** (.14 claro / .16 oscuro) de
  `--bg-active-subtle` (.08). Son dos roles: relleno con presencia propia contra hover apenas
  perceptible. Subir el existente habría oscurecido doce hovers y skeletons.

### Agregado

- **`Select`: prop `searchable`** — buscador en el menú con filtrado insensible a acentos. Opt-in.
  La navegación por teclado opera sobre las opciones **visibles**, no sobre la lista completa.
- **`Badge`: prop `glyph`** (`'square' | 'round'`) para el glifo de `card-tag`. La forma la
  declara el consumidor: no es derivable de `family` («Prioridad 0» es `neutral` igual que
  «Interno» y sin embargo lleva círculo).
- **`Card`: prop `emphasis`** para destacar una card de métrica. Es prop y no una sexta variant,
  para no abrir el set cerrado de cinco.
- **`ToggleGroup`: props `status` y `statusLabel`** para el semáforo del `day-chip`.
- **Tier 1**: la paleta completa de modo oscuro del manual (superficies propias más los tríos
  tinte/borde/texto de las 6 familias), tamaños 9/10/12/17/44, trackings de .08em y .14em,
  `--font-leading-display`, `--space-26`, `--size-19/28/34`, `--radius-glyph`,
  `--border-width-emphasis`, `--shadow-step-ring`, `--layout-app-min-width`, `--color-aqua-hover`
  y la geometría del panel de login.
- **Tier 2**: `--bg-brand-deep`, `--bg-accent-soft`, `--status-load-*`, `--surface-sidebar`,
  `--bg-field`, `--bg-row-alt`, `--border-dashed`, `--text-on-urgent`, `--text-on-inverse-muted`,
  y las familias tipográficas `--text-login-title-*`, `--text-entity-title-*`,
  `--text-table-header-*`.
- **Tier 3**: familias de `button` (fab, flow, hover), `card` (footer, metric emphasis), `table`
  (tipografía de cabecera), `nav` (bg, logout), `tab` (gap, count), `stepper` (node, ring),
  `toggle` (status), `accordion` (bar, mark), `login-panel` y `avatar`.

### Removido

- **`--card-bg-dark` y `--card-border-dark`**, con el bloque `:root[data-theme='dark'] .card` que
  los consumía. No aportaban nada al fondo (`--card-bg-dark` resolvía al mismo `--bg-surface` que
  `--card-bg`), pero por especificidad (0,2,1 contra 0,1,0) **borraban el borde de toda card en
  oscuro** —incluido el rojo de 1,5px de la card vencida— y pisaban el fondo azul de la card de
  métrica destacada.

### Corregido (documentación)

- **`components/accordion.md` y `components/sidebar-nav.md` tenían el `version:` del frontmatter
  desalineado con su propio Historial:** decía `1.0.0` mientras el Historial ya registraba el
  `1.1.0` de S-058, que esta CHANGELOG también había registrado. Los dos quedan en `1.2.0`, que
  reconcilia el frontmatter, el Historial y esta entrada.
- **`tokens/component.md` documentaba `table.header.light.bg` como `bg.canvas`**, y el código usa
  `bg.row-alt` — el mismo token que la fila alterna, que es la misma superficie. Corregido.
- **`tokens/semantic.md` documentaba `text.metric-unit` en 12px con `tracking.caps`**, y el código
  lo tiene en 10px con `caps-wide`. Corregido.
- **`components/sidebar-nav.md` tenía una «Nota pendiente (S-059)»** que pedía normalizar el slot
  del pie en la próxima actualización del DS. Resuelta: el slot pasa a sección normativa con su
  fila en la API.

### Notas para quien mantenga el DS

- **`ToggleGroup` acopla `status` y `statusLabel` en el tipo.** Eran dos props opcionales
  independientes, así que un `status` sin label pintaba el punto de color y no emitía el texto
  `sr-only`: el estado quedaba comunicado **sólo por color**, justo lo que la regla de
  accesibilidad del propio spec prohíbe, y sin error de compilación ni aviso en runtime. Ahora es
  una unión discriminada: o van los dos, o no va ninguno.
- **`dense` de `Table` queda declarado pero sin consumidores.** No se remueve todavía: la política
  pide un release de gracia. Si en el próximo nadie lo usa, corresponde darlo de baja.
- **Los tests son la garantía, no la documentación.** `tests/tokens.test.ts` verifica el
  encadenamiento de los tres tiers y `design-system-migration.guard.test.ts` que no reentre la
  paleta anterior. Los cuatro guardias que contradecían estos cambios se actualizaron **con el
  motivo escrito en el propio test**, no relajados.
- **Contraste medido, no estimado.** `styles/dark-mode-tints.test.ts` calcula el ratio WCAG de las
  6 familias en vez de asumir los valores del manual.

## [3.0.0] - 2026-09-03

Cierre de REQ-013: última story del split (S-060). El DS pasa de «normativo — en implementación»
a **normativo — implementado**: la identidad nueva y los 21 componentes que el manual describía
están efectivamente en el código de `web`, sin código deprecado pendiente.

### Removido

- **`components/input-select.md`** (v2.0.0 → removido): el spec declaraba «se conserva al menos
  un release para que los 18 usos existentes tengan una referencia mientras se migran» —
  condición cumplida: S-053 construyó `Select` único, y S-056/S-057/S-058 migraron todas las
  pantallas. El componente `InputSelect` (`web/src/shared/components/ui/InputSelect/`) se eliminó
  del código en la misma story, con **cero usos verificados** antes de la baja. Remover un
  componente es breaking change según la política de versionado de este DS (**MAJOR**).

### Cambiado

- **`README.md`**: estado de «normativo — en implementación (S-058 en curso)» a **implementado**.
  La cita inicial sobre la paleta rosa y la tipografía Archivo, que ya no era cierta, se
  reescribe. La tabla «Lo que queda» pierde las filas de migración de paleta/tipografía y de
  código muerto del barrel (cerradas); conserva el microcopy de toasts, la clasificación de
  `secondary` de `Button` y el shell responsive, que siguen fuera del alcance de REQ-013.
- **`components/README.md`**: `components/` pasa de «20 specs + 1 deprecado» a **20 specs**, todos
  `status: normativo`.

### Notas de cierre (informativas, no versionadas)

Como parte del mismo cierre (S-060), quedaron saldados fuera de este DS pero relevantes para su
estado real:

- El magenta descontinuado (`#DA2C6A`, `--color-button`) que sobrevivía en producción vía
  `InputMultipleSelect` → `RequirementFilters` se migró a tokens semánticos — era el último uso
  en pantalla del color que este DS vino a dar de baja.
- `docs/architectures/web/conventions/styling.md`, `overview.md` y `docs/ux/gaps-as-is.md` se
  actualizaron para reflejar el estado real del código (ver esos documentos).
- No existe primitivo tipográfico (`Heading`/`Text`) en este DS — queda anotado como candidato a
  `/product-design-system-update`, fuera del alcance de esta story.

## [2.5.0] - 2026-09-03

Ampliaciones additivas de `Accordion` y `SidebarNav` durante la implementación de la story S-058.

### Cambiado

- **`components/accordion.md`** (v1.0.0 → v1.1.0): `title` amplía su tipo de `string` a
  `ReactNode` — todo uso existente con `string` sigue siendo válido, no rompe. Se agrega
  `showStatus` (default `true`) para omitir la marca de completitud `!`/`✓` y su eco accesible en
  consumidores sin ese concepto. Motivo: una fila expandible de tabla jerárquica (ícono + texto +
  cifra) necesitaba el patrón de disclosure accesible de `Accordion` (`<button
  aria-expanded aria-controls>` + panel `role="region"` con `hidden`) sin forzar contenido rico
  dentro de un `title: string`, y sin la marca de completitud, ajena a una fila de datos (MINOR).
- **`components/sidebar-nav.md`** (v1.0.0 → v1.1.0): se agrega `mode` (`"light" | "dark"`,
  default `"light"`) para resolver la firma correcta según el modo (CA-3 de S-058: `jikuLogo.svg`
  en claro, `jikuLogoDark.svg` en oscuro). El componente no detecta el tema por sí mismo — lo
  decide el consumidor. Backward compatible (MINOR).
- **`components/input.md`** (v1.0.0 → v1.1.0): se agrega `hideLabel` (default `false`) para
  ocultar el label visualmente sin sacarlo del nombre accesible, pensado para grillas densas de
  campos repetidos (la celda editable de `Table` variant `matrix` en `asignacion-tiempo`).
  Backward compatible (MINOR).

### Corregido

- **`components/button.md`** (v2.0.1 → v2.0.2): la implementación no cumplía lo que el spec ya
  declaraba («el label del botón no cambia de significado» en `loading`) — el nombre accesible
  pasaba a "Cargando" mientras el spinner reemplazaba el contenido visible. Ahora, cuando
  `children` es texto plano, `loading` fija ese texto como `aria-label` explícito. Es el defecto
  que motivó la CA-4 de S-058 en el botón de `login`. Sin cambio de contrato de API (PATCH).

## [2.4.1] - 2026-09-02

Corrección de un hecho documental, sin cambio normativo (story S-052).

### Corregido

- **`foundations/logo.md`** (v1.0.0 → v1.0.1): decía que los SVG de interfaz «no viven en este
  repositorio» y que los provee diseño externamente. Es falso desde S-052: los 5 SVG (firma
  horizontal y completa, claro y oscuro, más el símbolo) ya viven en `web/src/assets/`, migrados
  desde `_new-design/`. Ninguna regla normativa cambia (variantes, mínimos, resguardo, usos
  incorrectos).

## [2.4.0] - 2026-09-02

Cierre de la última decisión abierta: **el comportamiento responsive**. Era la **pregunta abierta 6
del PRD**, no un hueco del manual.

### Cambiado

- **Mobile es un objetivo declarado sin fecha** para `web`. No prioritario; queda en FG-5. El
  desktop-only de hoy pasa de *deuda ambigua* a **estado transitorio reconocido**.

  **`mobile` NO se declara como viewport todavía**, y es deliberado: el shell no provee navegación
  bajo ~1000 px, así que declararlo haría que el DS **afirme algo que el código no cumple** — el
  error que este Design System evita por diseño.

  **El primer trabajo es el shell** (navegación colapsable o drawer), no las pantallas interiores:
  un media query en una pantalla de adentro no la vuelve alcanzable desde un teléfono.
  `foundations/grid.md`

- **La deuda de breakpoints queda abierta por decisión, no por olvido.** Como mobile se va a
  encarar, los 3 mixins sin uso y las 10 `@media` crudas son **avance parcial de trabajo futuro**,
  no código a borrar. Se revisan cuando se toque el shell.

  **Con una excepción:** el par **1023 / 1024 px** —dos pantallas hermanas que cambian de layout
  con un píxel de diferencia— no es avance parcial de nada, es un error. Unificarlo no compromete
  ninguna decisión futura.

### Corregido

Gaps de `grid.md` verificados contra el código (antes venían del relevamiento de agosto):

- **3 de 4 mixins sin uso:** `mobile` se usa 6 veces; `tablet`, `desktop` y `large-desktop` tienen
  **0 usos**.
- **10 `@media` crudas con 6 valores** fuera de los mixins: 640 · 900 · 1023 · 1024 · 1200 ·
  1680 px, con los números de línea corregidos. El PRD dice «14 con 8 valores»: **las otras 4 son
  las definiciones de los propios mixins** (767/768/1023/1024/1440), que son legítimas y no deuda.
  El conteo del documento anterior las mezclaba.

### Notas para la implementación

- **El manual de marca no dice nada de mobile.** Con sidebar de 300 px fijos y grilla de 4
  columnas, especifica un sistema de escritorio. Cuando se encare, **hay que decidir desde cero
  cómo se ve Jiku en un teléfono**: ninguna fuente de diseño lo responde hoy.
- **El caso de `opus-web` es otro y ya está decidido:** es **bloqueante** —bajo 768 px el `Sidebar`
  desaparece sin reemplazo, así que no se puede cambiar de proyecto ni cerrar sesión— y es
  postcondición de FG-5. Además Opus es **otra marca** (ver `2.2.0`): su responsive no lo decide
  este Design System.

### Fuera de este Design System

- **Cerrada la pregunta abierta 6** del PRD (`docs/prd/requirements.md`), y con ella el supuesto
  «el desktop-only se asume deuda, no decisión».
- **NFR-U03** pasa de `[hueco conocido]` a `[objetivo declarado sin fecha]`.
- **FG-5** deja de tener «decidir si el gestor interno debe ser usable en mobile» como
  precondición: ahora **ejecuta** la decisión en vez de tomarla.

---

## [2.3.0] - 2026-09-02

Cierre de la segunda decisión abierta: **el tono por contexto**. El manual define personalidad y
vocabulario pero no la forma de cada mensaje; se decidió a partir de esa personalidad y del
relevamiento de los **52 toasts** de `web`.

### Cambiado

- **`guidelines/content.md` pasa a normativo** y fija **una forma por contexto**, como se hizo con
  «Cargando…» en el Loader. Reemplaza el placeholder genérico.

  | Contexto | Forma |
  |---|---|
  | Éxito | `{entidad} {participio}`, **sin sufijo** — «Proyecto creado» |
  | Error de operación | «No se pudo… **+ qué hacer**» |
  | Error de validación | La condición a corregir, **sin** «qué hacer» |
  | Error de permiso | Qué no se puede, **sin** «qué hacer» |
  | Confirmación destructiva | Entidad nombrada + irreversibilidad |
  | Estado vacío | Negativa neutra, sin ilustración |
  | Carga | «Cargando…», texto único |

  **Los errores se tratan en tres familias, no una.** Exigir un «qué hacer» en un error de permiso
  produce relleno: no hay nada que el usuario pueda hacer. Los tres mensajes de validación y
  permiso que el producto ya tiene **cumplen y no se tocan**.

- **`foundations/voice-tone.md` deja de estar `parcial`.** Se agrega la tabla de siete contextos y
  las tres reglas que la sostienen: el tono es **uno solo** (no hay registro «cálido» ni
  «empático»); nunca se culpa ni se disculpa; el «qué hacer» va sólo donde hay algo que hacer.

- **Se corrige el placeholder donde contradecía la marca.** Decía «empático, no culpabilizante» con
  el ejemplo «Probá con otro», y pedía ilustración en los estados vacíos. La personalidad de marca
  es **serena y sin adorno**, y `empty-state.md` ya especificaba **sin ilustración**.

### Corregido

Inconsistencias medidas sobre los 52 toasts del producto:

- **Tres sufijos para decir lo mismo:** «con éxito» (6) · «exitosamente» (4) · «correctamente» (3).
  Quedan **prohibidos**: el sufijo no agrega información a un toast de éxito.
- **Dos prefijos para lo mismo:** «Error al…» (6) y «Hubo un error al…» (4) → **«No se pudo…»**.
- **Duplicados literales:** «Comentario agregado» y «Comentario agregado exitosamente» convivían.
- **Ninguno de los 33 errores decía qué hacer.**

### Notas para la implementación

- **52 toasts a revisar, en dos grupos de esfuerzo muy distinto.** Los **13** éxitos con sufijo son
  mecánicos: **es borrar palabras**, no redactar. Los **10** errores de operación requieren decidir
  el «qué hacer» de cada caso — ahí está el trabajo real.
- **3 mensajes no se tocan** (validación y permiso): ya cumplen la norma.
- **Sin toast cuando el resultado ya está en pantalla.** Si el usuario ve el badge cambiar, el toast
  es ruido; el toast es para lo que **no** se ve.
- **Preferir el error junto al campo** antes que el toast: un `error` en `Input` llega con
  `aria-describedby` y señala **dónde**.

---

## [2.2.0] - 2026-09-02

Cierre de la pregunta abierta sobre el alcance del manual. **Ningún cambio en los specs de `web`:**
la decisión define qué **no** entra en este Design System.

### Cambiado

- **El Manual de marca Jiku no aplica a `opus-web`.** Son dos marcas distintas: **Jiku** firma el
  gestor interno y **Opus** el portal de clientes. Los dos Design Systems quedan independientes,
  sin intención de unificarse.

  El criterio es la audiencia: Opus es de **cara al cliente** —se presenta como «¡Bienvenido a
  OPUS!», con su propio `logo.png` y `title: 'Opus'`— y Jiku es **interno**. Unificar la identidad
  haría que el cliente viera la marca interna de Grava. El manual ya razona así: «Jiku firma el
  producto; Grava firma la organización. Nunca se combinan en un mismo bloque.»

  Registrado fuera de este DS, donde la pregunta estaba planteada:
  [ADR-006](../../adrs/ADR-006-dos-frontends-una-api.md#identidad-visual-dos-marcas-separadas)
  (con su Implementation Rule), `docs/ux/product-overview.md`,
  `docs/design-system/README.md` y `docs/design-system/opus-web/foundations/color.md`.

### Notas para la implementación

- **Un cambio de Design System se aplica a una superficie, nunca a las dos.** Es Implementation
  Rule de ADR-006: no se porta la paleta, la tipografía ni la firma de Jiku a `opus-web`, ni al
  revés.
- **`opus-web` seguirá en `relevado-desde-código`** hasta que exista un manual de marca de Opus.
  Ese es su estado correcto, no un pendiente.
- **La escala neutral de `opus-web` (la `slate` de Tailwind) es coherente y única**, a diferencia de
  las tres escalas superpuestas que tenía `web`. Si algún día Opus recibe manual, es la parte que
  no conviene tocar.

---

## [2.1.0] - 2026-09-02

Resolución de las dos decisiones que `2.0.0` había dejado marcadas como pendientes. **Ningún
cambio de paleta ni de geometría:** las dos son decisiones de comportamiento y de reparto de
responsabilidades entre componentes.

### Cambiado

- **El stepper muestra los cinco pasos de trabajo y no es el control de cambio de estado.**
  Queda explícito el reparto: el **stepper** informa *dónde está* el requisito (cinco pasos); el
  **badge editable** de la cabecera decide *a dónde va* (los siete estados, sin recorte de
  secuencia, también en estado terminal); la **card de resolución** cierra y reabre.
  `components/stepper.md`, `components/badge.md`, `components/view-header.md`

  > **No había discrepancia con el producto.** `2.0.0` registró un conflicto entre el manual
  > («cinco etapas fijas») y la story S-050 («el stepper ofrece los siete estados»). Verificado
  > contra `RequirementStatusCard.tsx`: el stepper **ya renderiza cinco pasos** (`INLINE_STEPS`) y
  > los siete los ofrece la pill de estado. El título de S-050 describe la **capacidad del
  > sistema** —ningún estado recortado por secuencia, tras eliminarse `state-transitions.ts` en
  > S-049— no la cantidad de nodos. El manual y la implementación coinciden.

- **La acción destructiva se confirma con secundario de borde claro, y la advertencia la carga el
  texto.** No se agrega variant `destructive` a Button: el rojo `#F72C25` sigue significando
  únicamente estado de vencimiento. Ambas acciones del diálogo van al mismo peso visual, para que
  **ningún botón compita por el clic** en una operación irreversible — el usuario tiene que leer, y
  lo que lee nombra la entidad y la irreversibilidad.
  `components/confirm-dialog.md`, `components/button.md`

  > **Corolario operativo:** el microcopy del diálogo pasa a ser **parte del mecanismo de
  > seguridad**, no una recomendación de estilo. Al migrar los 3 usos actuales hay que revisar el
  > texto y no sólo el color: un «¿Estás seguro?» deja el diálogo sin nada que advierta.

### Notas para la implementación

- **El stepper informativo no entra en el orden de foco.** Si no cambia el estado —el caso por
  defecto— se expone como lista, no como grupo de controles.
- **El badge editable no se deshabilita en `resuelto` ni `cancelado`** (S-050, CA-2), y su nombre
  accesible incluye qué cambia: «Estado: Desarrollo».
- **`ConfirmDialog`:** foco inicial en *cancelar*, nunca en confirmar.

---

## [2.0.0] - 2026-09-02

Aplicación completa del **Manual de marca Jiku v1.0** (septiembre 2026). El
Design System pasa de **describir el código existente** (`status: relevado-desde-código`) a
**especificar lo que el producto debe ser** (`status: normativo`). La paleta rosa queda
descontinuada.

> **Ningún documento describe ya el estado del código.** Cada spec afectado lleva una sección
> **Migración** con la conversión desde el estado actual, y
> `foundations/color.md` tiene la tabla de mapeo viejo → nuevo.

### Cambiado

- **Paleta completa.** El primario pasa de magenta `#DA2C6A` a **verde agua `#61CCB9`** con texto
  azul oscuro `#0B1934`; el fondo de aplicación, de `#F6F2EF` a **niebla `#F6F6F9`**. Se agregan
  modo oscuro propio (no invertido), cuatro colores de sistema con tintes al 12 % y bordes al 26 %,
  y la tabla de mapeo del sistema anterior. `foundations/color.md`
- **Tipografía.** De **Archivo** al par **Sora** (logotipo y títulos de vista) + **Gabarito**
  (interfaz, datos, microcopy), con escala de siete estilos de tamaño, peso y color fijos.
  `foundations/typography.md`
- **Geometría.** Radios fijados en **8 / 10 / 14 / 999 px** sin intermedios; alturas de control
  (input 44 px, botón 40 px, fila de tabla 48 px, ítem de sidebar 48 px); **sidebar de 290 → 300 px**
  y padding de contenido a 32 px; dos sombras y un único anillo de foco verde agua al 22 %.
  `foundations/spacing.md`, `foundations/grid.md`, `foundations/elevation.md`
- **Iconografía.** Trazo de 1,6 px sobre grilla de 24 px, sin relleno; set de navegación de 12
  iconos, cinco tamaños por contexto y color por estado. Reemplaza el placeholder que sugería
  elegir un set open-source. `foundations/iconography.md`
- **Motion.** Duraciones fijadas en 150 / 200 / 300 ms `ease`; se eliminan `motion.instant` y
  `motion.lazy`. Se agrega la regla de `prefers-reduced-motion`. `foundations/motion.md`
- **Los tres tiers de tokens** dejan de ser placeholders y pasan a los valores reales.
  `bg.action.primary` se remapea a verde agua, `text.link` a verde profundo `#12897A`, y se corrige
  el orden de `z-index` (`navbar` estaba por encima de `modal`). `tokens/*.md`
- **Button** reespecificado: cinco variants semánticos (`primary`, `secondary-nav`,
  `secondary-dismiss`, `session`, `flow`) que reemplazan a `primary`/`secondary`; **se elimina la
  prop `size`**; sin variant destructivo, porque el rojo pasa a ser estado de vencimiento y no
  color de acción. `components/button.md`
- **Loader** reespecificado: absorbe a `Spinner` en dos variants (`block` / `inline`) con regla
  explícita de cuándo usar cada una, fija **«Cargando…» como único texto** —hoy hay 12 variantes,
  incluidos los typos «Cagando...» y «Cargando  ...»— y especifica `role="status"`, `aria-live` y
  `aria-busy`, que no existían. `components/loader.md`
- **Voice & tone** pasa a personalidad de marca y vocabulario de dominio reales.
  `foundations/voice-tone.md`

### Agregado

- **`foundations/logo.md`** — foundation nueva: tres variantes de firma con sus tamaños mínimos,
  área de resguardo de `1x`, reglas del símbolo, fondos permitidos, seis usos incorrectos y
  coexistencia con Grava y marcas de terceros.
- **17 specs de componente nuevos:** `input`, `select`, `badge`, `card`, `table`, `sidebar-nav`,
  `view-header`, `tabs`, `stepper`, `toggle-group`, `empty-state`, `dropzone`, `accordion`,
  `avatar`, `pagination`, `week-nav`, `tooltip`, `confirm-dialog`.
- **`patterns/login.md`** — primer pattern: panel decorativo en azul oscuro con trama (el único
  fondo con textura del sistema) reemplazando el gradiente `#EB1433 → #FEAE97`.

### Deprecado

- **`InputSelect`** (18 usos) en favor de `Select`, con migration path. Se conserva al menos un
  release. `components/input-select.md`

### Corregido

Tres duplicaciones que `docs/ux/gaps-as-is.md` registraba tienen ahora destino único:

- **Tres formas de hacer un select** — `InputSelect` (18 usos), `Select` (15) y `react-select`
  directo en 5 pantallas con `selectStyles` **duplicado literalmente en los 5 archivos** →
  `components/select.md`, cuatro variants.
- **Dos componentes de carga** sin regla de cuándo usar cada uno → `components/loader.md`.
- **`Pagination` hardcodeaba `router.push('/objectives?...')`**, lo que la hacía inservible fuera
  de esa ruta y causó **4 paginaciones reimplementadas inline** → `components/pagination.md`, con
  `onPageChange` como callback y sin prop de ruta.

### Decisiones pendientes

Dos huecos del manual quedan **marcados en sus specs, no rellenados**:

- **Conteo de etapas del stepper.** El manual dice **cinco** etapas fijas (Análisis ·
  Planificación · En cola · Desarrollo · Revisión); la story **S-050** (`Completed`, 2026-09-01)
  implementó **siete**, incluidos Resuelto y Cancelado, que `badge.md` también documenta. Es qué
  estados puede recorrer un requisito, no un detalle visual. `components/stepper.md`
- **Presentación de la acción destructiva.** El manual retira el rojo de la paleta de acción sin
  proponer reemplazo para un botón de borrado. `components/confirm-dialog.md` documenta las tres
  opciones y usa la más conservadora mientras no haya decisión.

También quedan parciales el tono por contexto (`foundations/voice-tone.md`) y el comportamiento
responsive, que el manual no menciona (`foundations/grid.md`).

### Notas para la implementación

- **El código no cambió con esta versión.** El DS ahora describe el destino; la migración es
  trabajo de implementación.
- **`_variables.scss` y `globals.scss` declaran el mismo `:root` dos veces.** La migración debe
  dejar **un solo origen** de tokens.
- **Los estilos de elemento de `globals.scss`** (`h1`, `h2`, `p`, `span`) compiten con la escala y
  tienen `line-height` igual al `font-size`. La escala normativa los reemplaza.
- **`z-index` hay que corregirlo antes de usar los tokens:** `navbar` no puede estar por encima de
  `modal`.
- **Los 29 usos de `Button` con `secondary` no se migran automáticamente:** un `#D9D9D9` puede ser
  un «Volver» o un «Cancelar», y el sistema nuevo los distingue.
- **Código muerto con nombres que colisionan:** `Card`, `Input` y `Textarea` existen sin usos y
  **están exportados desde el barrel**. Hay que sacarlos antes de crear los componentes nuevos, o
  el import resolverá al muerto.
- **Assets:** `logo-grava.png` → `logo-jiku.png`. Los SVG los provee diseño y **no están en el
  repositorio**; al implementar van a `web/src/assets/` y `web/public/`.

---

## [0.1.1] - 2026-09-01

### Eliminado
- Tokens de etapa `--color-stage-{scope,support,date,hours,month}` y sus `-bg` (10 en total).
  El concepto de etapas ya no existe en el producto y no tenían ningún consumidor.

### Cambiado
- `--color-stage-{active,finished}` (+ `-bg`) renombrados a `--color-success` / `--color-danger`
  (+ `-bg`), con los mismos valores. No eran colores de etapa: `clients/edit/[id]` los usaba como
  verde/rojo genéricos de los botones agregar/quitar par clave-valor.

> Remover tokens es breaking bajo la política de versionado de este DS. Se registra como PATCH
> porque `0.1.0` es el scaffold de bootstrap —su propia nota dice que el primer DS real se versiona
> `0.2.0` o superior— y bumpear a `1.0.0` por una limpieza daría una señal equivocada.

---

## [0.1.0] - 2026-08-18

### Agregado
- Estructura inicial del Design System (bootstrap automático).
- Archivos placeholder en foundations/, tokens/, guidelines/.
- Carpetas vacías components/ y patterns/.

> **Nota:** esta versión `0.1.0` es solo la estructura inicial. El primer DS
> "real" se versiona como `0.2.0` o superior cuando el equipo de diseño
> reemplace los placeholders con valores definitivos.

---

## Cómo registrar cambios

Cada vez que se ejecuta `/product-design-system-update`, el agente:

1. Aplica el cambio pedido.
2. Bumpea versión semver según naturaleza:
   - **MAJOR**: breaking (remover variant, renombrar componente)
   - **MINOR**: agregar (componente, variant, foundation)
   - **PATCH**: corrección, ajuste de spec
3. Agrega entrada en este CHANGELOG con formato:

```
## [X.Y.Z] - YYYY-MM-DD

### Agregado / Cambiado / Eliminado / Corregido / Deprecado
- {descripción concisa del cambio}
```
