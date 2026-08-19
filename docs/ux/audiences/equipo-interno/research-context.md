---
document: UX Research Context
audience: equipo-interno
version: 1.0
date: 2026-08-18
status: hipótesis-preliminar
---

# Research Context — Audiencia `equipo-interno`

> Caracterización de la audiencia. **Todo lo que sigue es hipótesis** hasta que se valide con
> usuarios reales. Cada item está trazado a su fuente (PRD, benchmark, código-existente). Items sin
> fuente trazable no se incluyen.

> **No hubo entrevistas.** Este documento se construyó leyendo el PRD, el benchmark de esta misma
> audiencia y el código del producto. No hay datos cuantitativos de uso de ningún tipo: el producto
> **no tiene analítica ni telemetría** en ninguno de sus cuatro servicios `[fuente: PRD § Métricas
> de Éxito]`. Cualquier afirmación sobre "cuánto" o "con qué frecuencia" que aparezca acá es
> intención declarada en el PRD, no medición.
>
> **Circunstancia atenuante y agravante a la vez:** esta audiencia es el propio equipo que
> construye el producto `[fuente: PRD § Stakeholders]`. Validar cada hipótesis de acá cuesta una
> reunión, no un estudio de campo — pero el mismo hecho vuelve tentador dar por sabido lo que
> nunca se preguntó, y el PRD ya advierte que el sesgo es inmediato igual que el feedback.

## Persona Genérica

- **Rol:** Miembro del equipo de una consultora de software que trabaja para varios clientes en
  simultáneo. Cubre los roles `user` (ejecuta el trabajo) y `admin` (además planifica capacidad
  semanal, imputa horas de terceros y consume reportes). Son **una sola audiencia** porque el
  trabajo de fondo es el mismo y `admin` solo suma dos capacidades sobre él
  `[fuente: PRD §Usuarios Objetivo U-01/U-02; product-overview.md § Inventario de Audiencias]`.
- **Contexto de uso:** En jornada de trabajo, alternando entre Jiku y el trabajo real —código,
  reuniones, las herramientas externas que Jiku enlaza pero no reemplaza (Mattermost,
  documentación, diseño, board) `[fuente: PRD § Sistemas Existentes]`. Jiku no es donde ocurre el
  trabajo: es donde queda registrado. Eso lo pone permanentemente en competencia con la tarea que
  sí es el trabajo.
- **Expertise técnico:** Alto. Es un equipo de desarrollo de software; conoce herramientas de
  gestión, atajos de teclado y jerga técnica sin necesidad de traducción. **Es la audiencia con más
  tolerancia a densidad de información y menos tolerancia a fricción innecesaria.**
- **Frecuencia de uso esperada:** Diaria e intensiva, con una distribución muy despareja entre
  tareas. La carga de horas se espera **una vez por día por persona**; la asignación semanal de
  capacidad, **una vez por semana y solo `admin`**; los reportes, esporádicos
  `[fuente: PRD §G-03/G-05 y § Alcance]`. **La duración de cada sesión no está medida**: el PRD
  propone "menos de 90 segundos" para la carga diaria como objetivo, no como observación
  `[fuente: PRD § Métricas de Éxito, declaradas explícitamente como propuestas]`.
- **Dispositivo principal:** Desktop, sin alternativa. No es una preferencia relevada sino una
  restricción del producto: el shell de `web` tiene sidebar de 290 px fijos y ningún media query,
  así que por debajo de ~1000 px no hay navegación posible
  `[fuente: código-existente — layout de (loggedin) en web; product-overview.md § Inventario de
  Superficies]`.

## Jobs To Be Done

1. **Cuando** termino la jornada (o me acuerdo de algo que hice hace unos días), **quiero** dejar
   registradas mis horas contra el proyecto y el requisito correctos en segundos, **para** que el
   registro exista sin haber interrumpido el trabajo por el que me pagan.
   `[fuente: PRD §G-05 "Baja fricción en la carga diaria de horas" — "tiene que costar segundos, no
   minutos, o deja de hacerse y G-01 se cae"; refuerza benchmark § Harvest/Toggl]`
   **Fuerza: fuerte.** El PRD lo declara objetivo primario, nombra el riesgo y el código muestra
   dónde se puso el esfuerzo (semáforo, botones de horas y minutos en vez de campos libres,
   selector agrupado proyecto/requisito/tarea).

2. **Cuando** un requisito de un cliente avanza, se traba o se resuelve, **quiero** moverlo de
   estado y dejar dicho qué pasó, **para** que el estado del tablero sea el estado real y nadie
   tenga que preguntarlo por otro canal.
   `[fuente: PRD §G-02 y § Alcance — workflow de 7 estados con reglas de transición, feed de
   actividad con visibilidad interno/público; benchmark § Jira]`
   **Fuerza: fuerte.** El requisito con su workflow es la entidad central del producto y la única
   que cruza las dos superficies.

3. **Cuando** empieza la semana, **quiero** reservar cuánto tiempo va cada persona a cada proyecto
   partiendo de lo que había la semana pasada, **para** poder después comparar lo planeado con lo
   que efectivamente pasó.
   `[fuente: PRD §G-03 "Planificación de capacidad separada del registro de lo ocurrido";
   código-existente — precarga desde la semana anterior en la grilla]`
   **Fuerza: media.** El objetivo y la mecánica están claros en el PRD y en el código. Lo que **no**
   está establecido es que alguien efectivamente compare después: el desvío es una métrica
   propuesta, no instrumentada. Este JTBD es de `admin` únicamente.

> No se documenta un cuarto JTBD sobre consumo de reportes. El reporte existe y tiene 4 niveles
> jerárquicos, pero el PRD no dice **quién lo mira, cuándo ni para responder qué pregunta**, y sin
> eso sería inventar el trabajo alrededor de una pantalla que existe. Queda en "Lo que NO sabemos".

## Pains

- Tiene que reconstruir de memoria en qué trabajó los días que no cargó, y el producto le da 11
  días de ventana (hoy + 10 previos) para hacerlo, con una sola vista por día: ponerse al día con
  varios días atrasados cuesta una navegación por día.
  `[fuente: código-existente — ventana de carga día actual + 10 previos; contrastado con benchmark
  § Harvest Week view / Toggl Timesheet view, donde cargar varios días es una sola pantalla]`
  **Fuerza: media.** La restricción y la ausencia de vista semanal son verificables en el código; lo
  que la ventana de 11 días implica es que **el producto asume que la gente se atrasa**. Cuánto y
  con qué costo, no está medido.

- Antes de escribir un número de horas tiene que elegir proyecto, requisito o tarea, aunque hace
  días que trabaje sobre lo mismo.
  `[fuente: código-existente — selector agrupado proyecto/requisito/tarea en la carga; benchmark §
  Harvest, mismo anti-patrón identificado]`
  **Fuerza: media.** La estructura del selector está en el código y el anti-patrón está documentado
  en el benchmark. Que en Grava efectivamente se repita el mismo proyecto día tras día es
  suposición razonable sobre una consultora chica, no dato.

- Cuando su día no entra en las reglas del producto —pasarse del tope de 24 h/persona/día, o
  necesitar cargar el día 12 hacia atrás— el producto se lo impide, y hoy los mensajes de error de
  api y core llegan al usuario tal cual, mezclados entre inglés y español.
  `[fuente: PRD § Restricciones — "los mensajes de error de api y core llegan al usuario tal cual y
  hoy están mezclados entre inglés y español"; código-existente — tope de 24 h y ventana de 11
  días; benchmark § Resource Guru, que ante conflicto ofrece salidas en vez de bloquear]`
  **Fuerza: fuerte** en cuanto al hecho (está declarado en el PRD y verificado en el código);
  **débil** en cuanto a con qué frecuencia el equipo choca contra esos límites en la práctica.

## Gains

- Registra las horas del día sabiendo, sin buscarlo, si el día quedó completo, parcial o vacío: el
  semáforo compara contra las horas por día configuradas y da la respuesta en la misma pantalla.
  `[fuente: PRD §G-05; código-existente — semáforo completo/parcial/vacío contra
  /settings/hours-per-day]`
  **Fuerza: fuerte.** Está implementado. Lo que no está establecido es si el semáforo se ve desde
  donde el usuario está parado el resto del día — hoy vive dentro de la pantalla de carga, y **el
  producto no tiene ningún canal de notificación** que lo complemente
  `[fuente: PRD § Fuera del Alcance]`.

- Responde "cuánto costó esto que pidió el cliente" bajando por el mismo reporte desde la persona
  hasta el requisito, sin reconstruir la relación a mano en una planilla.
  `[fuente: PRD §G-01 — reporte con 4 niveles persona → proyecto → requisito → tarea, y
  worked_times referenciando objective_id o requirement_id; benchmark § Diferenciadores]`
  **Fuerza: fuerte** en cuanto a la capacidad; **débil** en cuanto a que sea un gain buscado por
  esta audiencia y no por la conducción o por administración. Ver "Lo que NO sabemos".

- Deja de mantener a mano la sincronización entre tres herramientas —gestor de tareas, planilla de
  asignación y time tracker— porque las tres viven sobre el mismo modelo.
  `[fuente: PRD § Problema que Resuelve — "mantener las tres sincronizadas a mano es el trabajo que
  nadie hace"; benchmark § Diferenciadores, ningún referente une las tres familias]`
  **Fuerza: media.** El diagnóstico es del PRD y el benchmark confirma que el mercado no lo
  resuelve. Que el equipo de Grava viviera efectivamente ese problema antes de Jiku es plausible
  pero no está documentado.

## Hipótesis de Comportamiento

- La carga de horas se hace **al final del día o en tandas atrasadas**, no en el momento en que
  ocurre el trabajo. El producto está diseñado para eso: ofrece imputación manual con selector de
  día y ventana de 11 días hacia atrás, y **no tiene timer** de ninguna clase, a diferencia de
  Harvest y Toggl, que ofrecen las dos modalidades.
  `[estado: hipótesis | fuerza: inferida-PRD]`

- Ante un requisito, el usuario **no recuerda de memoria qué transiciones de estado son legales**
  desde donde está: con 7 estados y una regla condicional (las incidencias saltean `en_cola`), la
  UI tiene que mostrar las transiciones posibles en vez de dejar que el error aparezca al guardar.
  `[estado: hipótesis | fuerza: inferida-benchmark]` — el benchmark documenta este efecto en Jira,
  con el caso citado de una instancia de 25 estados vuelta inmanejable por su propio equipo.

- El equipo espera **guardado implícito** en la carga de horas y en la grilla de capacidad, porque
  es lo que hacen todos los referentes de time tracking (Harvest guarda solo, Toggl al salir del
  campo, Float al soltar el drag). Un formulario con botón de guardar en estas dos pantallas
  contradice la convención que el usuario ya trae.
  `[estado: hipótesis | fuerza: inferida-benchmark]`

- `admin` **no usa la grilla de asignación semanal con la misma pericia con que usa la carga
  diaria**: entra una vez por semana. Los atajos y las convenciones que se aprenden por repetición
  no aplican ahí, y la grilla necesita ser autoexplicativa de un modo que la pantalla de carga
  diaria no necesita.
  `[estado: hipótesis | fuerza: inferida-PRD]` — la diferencia de frecuencia (diaria vs. semanal)
  está en el PRD; el efecto sobre la pericia es inferencia.

- Para revisar la grilla proyecto × persona, el modelo mental de referencia es **la planilla de
  cálculo** —tabulación entre celdas, edición in-place, totales por fila visibles— porque es
  literalmente lo que la grilla vino a reemplazar según el propio PRD.
  `[estado: hipótesis | fuerza: por-analogía]` — **validación cara y obligatoria antes de actuar.**
  No hay evidencia de qué usaba Grava antes de Jiku para asignar capacidad; la analogía con Excel
  sale del vocabulario del PRD ("una planilla de asignación"), no de un relevamiento.

## Restricciones de Contexto

- **Desktop obligatorio, sin degradación** — el shell de `web` no tiene media queries y la sidebar
  ocupa 290 px fijos. Bajo ~1000 px no hay navegación. Cualquier hipótesis que asuma consulta desde
  el teléfono (por ejemplo, "cargar las horas volviendo de una reunión") es hoy imposible, no
  incómoda `[fuente: código-existente; product-overview.md]`.
- **Jiku compite con el trabajo real, no con otra herramienta de gestión** — el tiempo que se le
  dedica se le resta a la tarea facturable. Es el argumento explícito de G-05 y aplica igual al
  cambio de estado de un requisito `[fuente: PRD §G-05 y §U-02]`.
- **Sin notificaciones de ninguna clase** — no hay mail, push ni webhooks, y las tablas de mail que
  quedan en la base son huérfanas de una funcionalidad eliminada. Nada puede reclamarle al usuario
  que cargue sus horas ni avisarle que alguien comentó: **toda señal tiene que estar en pantalla o
  no existe** `[fuente: PRD § Fuera del Alcance]`.
- **Sin librería de componentes ni design system publicado** — Sass + CSS Modules + custom
  properties en los dos frontends. Cualquier patrón nuevo se construye desde cero
  `[fuente: PRD § Decisiones Clave Ya Tomadas]`.
- **La escritura no degrada: o funciona o no ocurrió** — sin JetStream, si `core` está caído la
  operación no se hace y el usuario recibe un 503, sin cola ni reintento ni reconciliación
  posterior. La UI tiene que poder decir eso de un modo que no invite a asumir que se guardó
  `[fuente: PRD § Decisiones Clave y § Restricciones]`.
- **El equipo no puede dar de alta a nadie desde el producto** — se requiere INSERT manual en la
  base; quien autentica bien contra Zitadel pero no tiene fila en `users` recibe 401
  `user_not_found` en todas las rutas. Toda incorporación al equipo pasa por alguien con acceso a
  la base `[fuente: PRD § Sistemas Existentes]`.

## Lo que NO Sabemos

- **¿En qué momento del día se cargan las horas, y cuántos días de atraso son lo normal?** La
  ventana de 11 días sugiere que el atraso se anticipó, pero no sabemos si el atraso típico es de
  un día o de una semana. De la respuesta depende si la prioridad de diseño es la pantalla del día
  o una vista semanal de recuperación. Se responde observando a tres personas del equipo cargar
  horas, o revisando `created_at` contra la fecha imputada en `worked_times` — **el dato existe en
  la base aunque no haya analytics**.
- **¿Cuál es la fricción real de la carga diaria hoy?** El PRD propone menos de 90 segundos como
  objetivo. Nadie cronometró la actual. Sin ese número, cualquier rediseño de esa pantalla no tiene
  contra qué compararse.
- **¿Contra qué se choca el equipo: el tope de 24 h, la ventana de 11 días, ninguno?** Los dos
  límites están en el código, pero no sabemos si se topan una vez por mes o nunca. Si nunca, el
  pain correspondiente hay que bajarlo de prioridad.
- **¿Quién mira los reportes de horas, cuándo y para responder qué?** Es la pantalla más compleja
  del producto y la que menos sustento tiene en el PRD respecto de su uso. Si el consumidor real es
  administración o conducción con una pregunta distinta a la del ejecutor, **podría ser una cuarta
  audiencia** y no una pantalla más de esta.
- **¿Alguien compara efectivamente lo asignado con lo cargado?** G-03 lo declara como objetivo y el
  desvío es métrica propuesta, pero no hay evidencia de que la comparación ocurra hoy ni de dónde
  la haría alguien. Si no ocurre, la grilla de asignación es planificación sin retroalimentación.
- **¿Qué usaba el equipo antes de Jiku para cada una de las tres cosas, y qué extraña?** Es la
  pregunta de mayor retorno y menor costo del set: sostiene o refuta el JTBD 3, el gain de la
  unificación y la hipótesis por analogía con la planilla de cálculo. Una reunión de una hora con
  el equipo.
- **¿Hay diferencia real de comportamiento entre `admin` y `user` más allá de las dos capacidades
  extra?** El product-overview ya deja planteado que si la conducción usara el producto para algo
  sustancialmente distinto —por ejemplo, solo mirar reportes— serían dos audiencias. Hoy están
  unidas por decisión, no por evidencia.
- **¿Cuánto pesa el teclado en la práctica?** El benchmark señala a Linear como referente de
  velocidad, pero no sabemos si este equipo usa atajos en las herramientas que ya tiene. Invertir
  en atajos que nadie descubre es gasto perdido; el equipo está a una pregunta de distancia.

---

**Estado:** Documento en estado `hipótesis-preliminar`. Para promoverlo a `validado`, ejecutar
entrevistas reales —en este caso, conversaciones con el propio equipo de Grava Digital, que es la
audiencia— y actualizar in-place el estado de cada hipótesis. Ninguna de las hipótesis de acá
debería sostener una decisión de diseño irreversible antes de esa validación.

**Consumido por:** Los `product-map.md` y `user-flows.md` de la superficie `web` (ver matriz en
`product-overview.md`).
