---
document: UX Cross-Surface Flows
product: Jiku
version: 1.0
date: 2026-08-18
status: relevado-desde-código
origin: relevamiento de código — brownfield
---

> Flujos que **cruzan las dos superficies** del producto. Derivados de los flujos cross-service de
> [`docs/flows/`](../flows/) y de la navegación relevada [fuente: código-existente].
>
> Lo que los hace distintos de los flujos internos: **ningún usuario los recorre completos**. Cada
> uno tiene dos mitades, y cada mitad la ejecuta una persona distinta que no ve la otra.

## Flujos Documentados

| # | Flujo | Superficies | Qué lo hace cross-surface |
|---|---|---|---|
| 1 | Del pedido del cliente al trabajo del equipo | opus-web → web | El cliente crea, el equipo descompone |
| 2 | Del avance del equipo a la vista del cliente | web → opus-web | El equipo cambia estado, el cliente lo ve sin que nadie avise |
| 3 | Conversación sobre un requisito | opus-web ↔ web | El mismo feed, filtrado distinto según quién mira |

---

## Flujo 1: Del pedido del cliente al trabajo del equipo

**Superficies:** `opus-web` (inicio) → `web` (continuación)
**Audiencias:** cliente → equipo-interno

Es el flujo que justifica que el producto tenga dos superficies: **el pedido entra por un lado y el
trabajo ocurre por el otro**, sobre la misma entidad.

### Recorrido

| # | Superficie | Quién | Acción |
|---|---|---|---|
| 1 | opus-web | cliente | Crea un requisito con título (único obligatorio), y opcionalmente tipo, prioridad y adjuntos |
| 2 | — | *(sistema)* | Nace en `analisis`, con `created_by` del cliente y `visibility_level: public` |
| 3 | web | equipo-interno | Lo ve aparecer en **listado-requisitos** entre los demás, **sin marca de origen** |
| 4 | web | equipo-interno | Lo abre, completa el alcance y avanza el workflow |
| 5 | web | equipo-interno | Lo descompone en tareas (flujo 4 de `web`) |
| 6 | web | equipo-interno | Imputa horas contra el requisito o sus tareas |

### La discontinuidad

🔴 **El equipo no se entera de que llegó un pedido nuevo.** No hay notificación, ni badge, ni
sección de "nuevos" en el listado. **Un requisito creado por un cliente es indistinguible de uno
creado internamente** salvo por su `created_by`, que la interfaz no destaca
[fuente: código-existente].

En la práctica esto significa que el flujo **depende de que alguien del equipo mire el listado**.
Si nadie mira, el pedido del cliente espera indefinidamente sin que nada lo señale.

Es el argumento más fuerte para FG-2 (notificaciones): el canal formal con el cliente existe y
**su primera milla no avisa a nadie**.

**Y desde [REQ-004] hay un segundo modo de falla en esa misma primera milla.** Si el alta del
cliente vuelve con `504 gateway_timeout` —*"La operación tardó demasiado"*—, el requisito **pudo
haberse creado igual**: la escritura llegó a `jiku-commands` y la respuesta se perdió. El cliente
no ve ningún mensaje (el modal de Opus no muestra error alguno, flujo 2 de `opus-web`), así que
reintenta; y lo que aparece en **listado-requisitos** de `web` son **dos pedidos idénticos**, sin
`created_by` destacado ni nada que los relacione. Las dos discontinuidades se suman: nadie del
equipo sabe que el pedido llegó, y cuando alguien lo encuentra puede estar duplicado — y no hay
forma en la interfaz de saber cuál de los dos mirar (RF-16, CA-9). El caso contrario también existe:
el cliente asume que su pedido falló y no reintenta, mientras el equipo lo ve en el listado. En los
dos casos el dato cruzó y la certeza no.

**Y desde [REQ-005] el pedido puede tener un tercer origen.** Hasta ahora un requisito lo creaba
un cliente en `opus-web` o alguien del equipo en `web`. Desde REQ-005 toda identidad que se
autentica en el bus tiene fila en `users`, así que el **conector externo** de REQ-001 puede crear
requisitos de verdad —antes no podía: sin fila en `users` la escritura violaba la FK— y aparece
como autor en las dos superficies. Ese tercer origen **sí se distingue**: donde el producto muestra
autor, el nombre viene con un badge *"Automático"* — en el detalle del requisito de `web` y en la
columna "AUTOR" del tablero de `opus-web`. Donde no muestra autor no hay nada que marcar, y el paso
3 de este recorrido es justamente uno de esos casos: **listado-requisitos** no tiene columna de
autor, así que ahí el pedido del conector sigue siendo indistinguible del resto (RF-3, RF-10).

**La ironía vale registrarla:** el origen que nadie pidió distinguir —el del servicio— quedó
marcado, y el que el criterio de éxito de este flujo pide desde el relevamiento —el del cliente
contra el del equipo— **sigue sin marca**. No es una decisión de REQ-005: es que el service user
introduce un riesgo de lectura (creer que un servicio es una persona) que el par cliente/equipo no
tiene, porque los dos son personas. El criterio de éxito sigue abierto.

### Criterios de éxito

- Un pedido del cliente debería **llegarle a alguien**, no quedar esperando que lo encuentren
- El equipo debería poder distinguir lo que pidió un cliente de lo que se generó internamente
- **Nuevo:** el equipo y el cliente deberían poder distinguir lo que creó un **servicio** de lo que
  creó una persona — **se cumple desde REQ-005** en el detalle de las dos superficies y en el
  tablero de `opus-web`; **no se cumple** en `listado-requisitos` de `web` (sin columna de autor)
  ni en el tablero mobile de `opus-web` (la card no muestra autor)

---

## Flujo 2: Del avance del equipo a la vista del cliente

**Superficies:** `web` (origen) → `opus-web` (destino)
**Audiencias:** equipo-interno → cliente

Es el flujo que hace que el producto reemplace los mails de status.

### Recorrido

| # | Superficie | Quién | Acción |
|---|---|---|---|
| 1 | web | equipo-interno | Avanza el estado de un requisito en el stepper |
| 2 | — | *(sistema)* | Registra la actividad y **decide su visibilidad automáticamente**: `state`, `title` y `description` → `public`; el resto → `internal` |
| 3 | opus-web | cliente | La próxima vez que entra, ve el estado nuevo en el tablero y el cambio en el feed |

### Qué cruza y qué no

**La regla de visibilidad es lo que define este flujo**, y es del sistema, no del usuario
[fuente: código-existente]:

| Cambio en `web` | ¿Lo ve el cliente? |
|---|---|
| Estado del requisito | ✅ Sí — es `public` |
| Título | ✅ Sí |
| Descripción | ✅ Sí |
| Prioridad | ❌ No — es `internal` |
| Tipo | ❌ No |
| Responsables | ❌ No |
| Fecha estimada | ❌ No |
| Comentario | Depende: **es el único donde el usuario elige** |
| Horas imputadas | ❌ Nunca — no existen en la superficie del cliente |
| Tareas | ❌ Nunca — el cliente no las ve |

### La discontinuidad

🔴 **El cliente tampoco se entera.** El cambio de estado es visible **solo si el cliente entra a
mirar**. Y como su uso es esporádico, puede pasar semanas sin ver un avance que ocurrió el primer
día.

**La suscripción existe precisamente para resolver esto y no hace nada**: registra interés en la
base y no hay canal por el que llegue nada (FG-2).

### Criterios de éxito

- Un cambio de estado debería **llegar** al cliente, no esperar a que entre
- El equipo debería saber, al cambiar algo, **si el cliente lo va a ver o no**. Hoy la regla es
  automática y correcta, pero **la interfaz no la muestra**: nada indica que la prioridad es
  interna y el estado es público

---

## Flujo 3: Conversación sobre un requisito

**Superficies:** `opus-web` ↔ `web` (bidireccional)
**Audiencias:** cliente ↔ equipo-interno

El único flujo genuinamente bidireccional del producto.

### Recorrido

| # | Superficie | Quién | Acción |
|---|---|---|---|
| 1 | cualquiera | cualquiera | Escribe un comentario en el feed del requisito |
| 2 | — | *(sistema)* | El del cliente **siempre es `public`**; el del equipo permite elegir |
| 3 | opus-web | cliente | Ve **solo los públicos**, mezclados con los cambios públicos, en orden cronológico ascendente |
| 4 | web | equipo-interno | Ve **todos** — públicos e internos — con marca de visibilidad |

### El mecanismo que lo sostiene

Es el **mismo feed** (`requirement_activity`), filtrado del lado del servidor según quién pregunta.
Un comentario interno no llega al navegador del cliente: no se oculta con CSS, **no se envía**
[fuente: código-existente].

Los adjuntos también cruzan: `RichContentRenderer` de `opus-web` **parsea los dos formatos de
placeholder** —el suyo (`[attach:N]`) y el del gestor interno
(`[nombre](/api/attachments/N/preview)`)— lo que confirma que el contenido creado en una superficie
se lee en la otra.

**Pero el archivo cruza para leerse, no para reusarse** [REQ-001 RF-12, RF-13, CA-11, CA-12]. Un
archivo **solo lo puede adjuntar quien lo subió**, y la regla **no tiene excepción por rol**: un
administrador tampoco puede adjuntar un archivo ajeno. Esto corta tres cruces que el modelo de
datos permitiría:

| Quién subió | Quién intenta adjuntar | Resultado |
|---|---|---|
| Cliente en `opus-web` | Miembro del equipo en `web` | Rechazado |
| Miembro del equipo en `web` | Cliente en `opus-web` | Rechazado |
| Un servicio externo | Cualquier persona, y viceversa | Rechazado |

**Y desde [REQ-005] la fila "un servicio externo" dejó de ser hipotética** [REQ-005 RF-2, RF-6, CA-3,
CA-4]. Ese cruce se documentaba como regla, pero el canal **no funcionaba**: sin fila en `users` el
`INSERT` de `files` violaba la FK de `uploaded_by`, así que el publicador externo no podía subir
nada que después alguien intentara reusar. Desde REQ-005 el conector tiene fila —se la crea su
propio evento de autenticación— y el cruce se vuelve alcanzable de verdad: **un archivo cuyo autor
es un servicio, visible en las dos superficies, y que ninguna persona puede reusar.** La regla no
cambió; lo que cambió es que ahora se puede llegar a ella.

**Lo que sí cruza distinto es la autoría.** El mismo feed que las dos superficies leen puede tener
entradas de un autor que no es una persona, y **las dos lo marcan con la misma palabra**:
`"Automático"`. `opus-web` suma una segunda señal que `web` no necesita —el avatar del comentario,
que en vez de iniciales muestra un icono— porque su tarjeta de comentario **tiene** avatar y el
feed de `web` no. Es la misma decisión adaptada a dos composiciones distintas, no dos decisiones.

La asimetría es deliberada y vale nombrarla: **el contenido de una superficie se ve en la otra, y
el archivo también se ve en la otra —lo que no cruza es el permiso de volver a usarlo.** Ver un
adjunto del cliente y adjuntarlo a otra cosa son dos cosas distintas, y solo la primera cruza.

**Y desde REQ-002 el archivo cruza entre las dos superficies, pero no sale del producto**
[REQ-002 RF-8, CA-8]. Había un tercer cruce, y era el único que salía hacia afuera: un link
`/attachments/{id}/{fileName}` servía el adjunto **sin sesión**, así que un tercero sin cuenta —el
gerente del cliente, un proveedor suyo— podía abrir el archivo con solo tener la URL. Ese camino se
eliminó y **no se reemplazó**: cualquier acceso a un archivo exige sesión, y la visibilidad de la
entidad vinculada gobierna qué ve un usuario **autenticado**, no si un anónimo puede entrar.

| Cruce | Antes | Ahora |
|---|---|---|
| `opus-web` ↔ `web`, ver un adjunto | Con sesión y permiso | **Sin cambios** |
| `opus-web` ↔ `web`, reusar un adjunto ajeno | Rechazado (REQ-001) | **Sin cambios** |
| Hacia afuera del producto, sin cuenta | Link público, sin sesión | **No existe** |

Los links que ya circulan en correos y documentos **dejan de abrir el día del deploy**, sin
transición ni aviso: quien los abra cae en el login de `opus-web`. No es un flujo que se degrada,
es un flujo que se cierra, y el reemplazo —compartir con una prefirmada con vencimiento— queda
fuera de alcance de forma explícita.

### La discontinuidad

🔴 **Ninguna de las dos partes se entera de que la otra escribió.** Un comentario del cliente no le
llega a nadie del equipo; una respuesta del equipo no le llega al cliente. **La conversación
funciona solo si las dos partes entran a mirar por su cuenta**, que es exactamente el problema que
un canal formal debería resolver.

Además, del lado del cliente el error de suscripción es **la palabra "Error" en un botón**, con el
motivo en un `title` invisible en touch.

### Criterios de éxito

- Un comentario debería **notificar a la otra parte** (FG-2)
- El equipo debería poder ver claramente **qué comentarios ve el cliente** antes de escribir
- El cliente no debería poder inferir que existe actividad interna — **hoy se cumple**
- Las dos partes deberían leer **la misma marca** para un autor que no es una persona —
  **se cumple desde REQ-005**: el mismo badge `"Automático"` en las dos superficies

---

## Lo que los tres flujos tienen en común

Los tres cruzan bien **el dato** y ninguno cruza **el aviso**.

El modelo de visibilidad funciona: lo público llega, lo interno no se filtra, y el filtrado ocurre
del lado del servidor. La arquitectura del producto resuelve la parte difícil.

Lo que falta es la parte fácil y no está: **nadie se entera de nada**. Los tres flujos terminan en
"la próxima vez que entre a mirar", y en los tres el producto ya tiene la entidad que lo
resolvería —el suscriptor— sin ningún canal detrás.

Es el contenido del feature group **FG-2**, y estos tres flujos son la mejor justificación de su
prioridad.
