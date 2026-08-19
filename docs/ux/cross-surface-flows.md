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

### Criterios de éxito

- Un pedido del cliente debería **llegarle a alguien**, no quedar esperando que lo encuentren
- El equipo debería poder distinguir lo que pidió un cliente de lo que se generó internamente

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

La asimetría es deliberada y vale nombrarla: **el contenido de una superficie se ve en la otra, y
el archivo también se ve en la otra —lo que no cruza es el permiso de volver a usarlo.** Ver un
adjunto del cliente y adjuntarlo a otra cosa son dos cosas distintas, y solo la primera cruza.

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
