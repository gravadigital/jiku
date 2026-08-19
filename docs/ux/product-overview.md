---
document: UX Product Overview
product: Jiku
version: 1.0
date: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — brownfield
---

> Documentación UX de **Jiku**, producida por `/product-consolidate-services` desde el
> relevamiento del código existente. **Las superficies y los viewports salen del código**; las
> audiencias no —el código no dice para quién es cada pantalla— y fueron inferidas del PRD y
> confirmadas con el equipo el 2026-08-18.
>
> Las pantallas están en `status: as-is-sin-validar`: documentan lo que hay, no un diseño
> validado. Lo que falta está en [`gaps-as-is.md`](gaps-as-is.md).

## Visión del Producto

Jiku resuelve tres preguntas que las herramientas genéricas obligan a elegir de a dos: **qué pidió
cada cliente y en qué estado está**, **quién trabaja en qué esta semana**, y **cuánto tiempo real
costó cada cosa**. Las une sobre un mismo modelo, de modo que un reporte de horas pueda bajar
hasta el requisito que las originó.

De esa unión salen las dos superficies. El equipo necesita ver todo —horas incluidas— y el cliente
no puede ver casi nada de eso, así que la separación no es de secciones dentro de una aplicación
sino de **dos aplicaciones distintas** sobre la misma API.

## Inventario de Superficies

- **web** — Gestor interno del equipo de Grava Digital: actores, proyectos, requisitos, tareas,
  asignación semanal de capacidad y carga de horas
  - Platform: `web` — Next.js 16 (App Router) + React 19
  - Viewports: `desktop` (único) — **el shell impone un solo viewport**: la sidebar mide 290 px
    fijos y el layout de `(loggedin)` no tiene ningún media query, así que bajo ~1000 px no hay
    navegación posible. Tablet se comporta como desktop.
  - Accent: `#DA2C6A` — magenta, tomado del código (`--color-button`), es el color de los botones
    primarios. **No es color de marca declarado**: es el que el producto usa hoy.
  - 25 pantallas · 10 overlays

- **opus-web** — Portal de clientes (marca **Opus**): un cliente sigue el avance de sus proyectos,
  crea requisitos, comenta y se suscribe
  - Platform: `web` — mismo stack
  - Viewports: `desktop` (primario), `mobile` — **el corte real está en 768px**, y no es solo de
    layout: `useIsMobile()` decide **qué árbol de componentes montar**. Tablet se comporta como
    desktop (`$breakpoint-lg` no separa nada en la aplicación viva).
  - Accent: `#2563eb` — azul, tomado del código (`--color-primary`).
  - 5 pantallas · 7 overlays

> **Las dos superficies tienen color de marca distinto** —magenta y azul— y tipografía distinta
> —Archivo cargada de Google Fonts contra un stack de fuentes de sistema. No hay evidencia en el
> código de si es deliberado (dos productos con identidad propia, uno interno y uno de cara al
> cliente) o divergencia acumulada. Registrado como pregunta abierta.

## Inventario de Audiencias

- **equipo-interno** — Miembros del equipo de Grava Digital (`user`) y conducción (`admin`). Uso
  diario e intensivo; su interacción de mayor frecuencia no es la más compleja sino la más
  cotidiana: **cargar las horas del día**, que compite con el trabajo real. La conducción suma dos
  capacidades —planificar capacidad semanal e imputar horas de terceros— sobre el mismo trabajo de
  fondo.
- **cliente** — Contraparte del proyecto en la organización cliente (`external-user`). Uso
  **esporádico y de baja frecuencia**: entra a ver cómo va lo que pidió, o a pedir algo nuevo. No
  conoce el producto ni lo usa lo suficiente para aprenderlo, así que cada visita empieza casi de
  cero.

> **Por qué `admin` y `user` son una sola audiencia:** las audiencias se separan por JTBD, no por
> etiqueta de rol. Los dos hacen el mismo trabajo de fondo —gestionar proyectos, requisitos y
> tareas, y cargar sus horas— y `admin` solo agrega dos capacidades. Si en la práctica la
> conducción usara el producto para algo sustancialmente distinto (por ejemplo, solo mirar
> reportes), serían dos audiencias.

## Matriz Audiencia ↔ Superficie

| Audiencia \ Superficie | web | opus-web |
|---|---|---|
| **equipo-interno** | Trabajo diario completo: gestión de actores, proyectos, requisitos y tareas; planificación de capacidad; carga de horas y reportes | *(acceso técnico posible, no es su superficie prevista)* |
| **cliente** | — | Seguimiento de sus proyectos, alta de requisitos, comentarios y suscripciones |

> **La celda gris:** `opus-web` **no corta navegación por rol**, así que un `user` o `admin` que
> abra el portal puede operar ahí —incluso cambiar estado y prioridad inline. No hay evidencia de
> si es intencional. Es la pregunta abierta 4 de [`requirements.md`](../prd/requirements.md).

## Glosario de Dominio

Extraído del PRD. La columna de equivalencias importa porque **el producto y su base de datos
llaman a las cosas distinto**, y las tres capas no coinciden.

- **Actor** — Organización o contraparte para la que se trabaja; raíz de la jerarquía. En la base
  y en el bus se llama `client`.
- **Proyecto** — Unidad de trabajo y de permiso. Todo cuelga de un proyecto, y es la entidad sobre
  la que se concede acceso a un cliente externo.
- **Requisito** — Lo que pide el cliente. Entidad central: la única que cruza las dos superficies,
  con workflow explícito de 7 estados. Es lo único que un cliente puede crear.
- **Tarea** — Unidad de ejecución del equipo, con área y responsables. En la base se llama
  `objective`; en el bus, `task`.
- **Actividad** — Registro unificado de **cambios de campo y comentarios** sobre un requisito o
  una tarea. Un comentario es una actividad de tipo `comment`. Es lo que permite el feed
  cronológico único.
- **Visibilidad** — `public` o `internal` por actividad. Define qué ve un cliente en el portal.
  **La decide el sistema, no el usuario**: estado, título y descripción son públicos; el resto,
  interno. Solo los comentarios permiten elegir.
- **Hora trabajada** — Registro de tiempo imputado a una tarea **o** a un requisito, nunca a
  ambos. Tope de 24 h por persona y día, sumando ausencias.
- **Ausencia** — Tiempo no trabajado con motivo (9 valores). Comparte el tope diario con las horas
  trabajadas.
- **Asignación semanal** — Capacidad reservada por persona y proyecto para una semana. Es lo
  planeado, contra las horas trabajadas que son lo ocurrido. Solo la edita `admin`.
- **Suscriptor** — Usuario que pidió seguir un requisito. **Registra interés y nada más: no hay
  canal de notificación en el producto.**
- **Permiso de proyecto** — Fila en `user_project_permissions`. Es lo que sostiene todo el
  aislamiento del portal: un cliente solo ve los proyectos que tienen una.
- **Archivo** — Contenido subido al sistema. **Existe por sí solo**, sin depender de ninguna
  entidad, y solo lo puede adjuntar quien lo subió [REQ-001 RF-1, RF-12].
- **Adjunto** — El **vínculo** entre un archivo y una entidad. Un archivo puede tener cero, uno o
  varios; el vínculo se crea cuando la entidad ya existe, en la misma operación que la crea o la
  edita. El concepto de **borrador de adjunto** se eliminó con REQ-001: subir ya no obliga a
  declarar a qué se va a colgar.
- **Etapa** — Concepto **eliminado** del modelo de datos. Quedan restos en el código y en los
  tokens de color.

---

El detalle de cada audiencia está en [`audiences/`](audiences/) (benchmark e hipótesis de
investigación) y el de cada superficie en [`surfaces/`](surfaces/) (mapa de producto, flujos y
pantallas). Los flujos que cruzan superficies están en
[`cross-surface-flows.md`](cross-surface-flows.md), y lo que falta en la UI actual en
[`gaps-as-is.md`](gaps-as-is.md).
