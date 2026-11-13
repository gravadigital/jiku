---
prefix: NOT
name: Notificaciones
surfaces: []
covers: Mails a los suscriptores con permiso de proyecto de un requisito público, por una cola de salida con reintentos, cuando se crea, se resuelve, se reabre o recibe un comentario público
entities: [Notificación pendiente, Requisito, Usuario, Permiso de proyecto]
last_requirement: NOT-06
last_failure: NOT-E3
---

# NOT — Notificaciones

## Requisitos
| ID | Evento | Canal | Destinatario | Contenido | Origen |
|---|---|---|---|---|---|
| NOT-01 | Se crea un requisito público | email | Sus suscriptores con email y permiso de proyecto sobre el proyecto, sin quien lo creó | Asunto «Nuevo requisito: {título}»; título, proyecto, autor y link al requisito en el Portal de clientes | inicial |
| NOT-02 | Se agrega un suscriptor a un requisito público | email | Solo el nuevo suscriptor, si tiene email y permiso de proyecto y no es quien lo suscribió | El mismo mail de NOT-01 | inicial |
| NOT-03 | Un requisito público pasa a `resuelto` (por edición o por resolución directa) | email | Sus suscriptores con email y permiso de proyecto, sin quien lo resolvió | Asunto «Requisito resuelto: {título}»; título, proyecto, autor, comentario de resolución y link | inicial |
| NOT-04 | Un requisito público sale de `resuelto` hacia un estado que no es `cancelado` | email | Sus suscriptores con email y permiso de proyecto, sin quien lo reabrió | Asunto «Requisito reabierto: {título}»; título, proyecto, autor y link | inicial |
| NOT-05 | Se publica un comentario público en un requisito público | email | Sus suscriptores con email y permiso de proyecto, sin quien comentó | Asunto «Nuevo comentario en: {título}»; título, proyecto, autor, texto del comentario y link | inicial |
| NOT-06 | Cada notificación queda en la cola de salida en la misma transacción que el cambio que la origina; cada **intervalo de envío de notificaciones** se toman hasta **lote de envío de notificaciones** pendientes vencidas, en orden, y se envían por SMTP | email | — | Mail en HTML y en texto, con el contenido escapado | inicial |

## No se notifica
- Nada de un requisito interno, ni un comentario interno.
- Los cambios de estado que no son resolver ni reabrir, ni pasar de `resuelto` a `cancelado`, ni volver a resolver uno ya resuelto.
- La edición de campos de un requisito, la edición de comentarios ni los cambios de responsables.
- Nada de tareas (ni a sus suscriptores) ni de horas, ausencias, asignaciones, proyectos o clientes.
- A quien hizo el cambio, a un usuario sin email ni a un usuario sin permiso de proyecto sobre el proyecto (en la práctica, a ningún usuario interno).
- Al desuscribirse.
- Por ningún canal que no sea email.

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| NOT-E1 | Falla el envío SMTP de una notificación | Queda pendiente con el error registrado y un intento más, y se reintenta según el **backoff de notificaciones** | inicial |
| NOT-E2 | Una notificación llega a los **intentos de envío de notificaciones** sin enviarse | Se descarta: se borra de la cola y solo queda una línea `[notifications] discard` en el log | inicial |
| NOT-E3 | No se puede leer la configuración del envío | El ciclo siguiente se programa a los 5 s | inicial |

## Ejemplos
- NOT-E1: una notificación que falla por primera vez (0 intentos previos) se reintenta a los 60 s; la segunda vez, a los 120 s; la tercera, a los 240 s; la cuarta, a los 480 s. Con 5 intentos se descarta. Si se subiera el máximo de intentos, la espera crece hasta un tope de 1 día (86 400 s).
