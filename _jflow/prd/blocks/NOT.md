---
prefix: NOT
name: Notificaciones
surfaces: []
covers: Avisos por email a los suscriptores de un requisito público cuando se crea, se los suscribe, se resuelve, se reabre o recibe un comentario público, encolados con el cambio y enviados por un proceso periódico con reintentos
entities: [Notificación pendiente, Requisito, Actividad de requisito, Usuario, Permiso de proyecto, Proyecto, Configuración del sistema]
last_requirement: NOT-08
last_failure: NOT-E7
---

# NOT — Notificaciones

## Requirements
| ID | Event | Channel | Recipient | Content | Origin |
|---|---|---|---|---|---|
| NOT-01 | Se crea un requisito | email | Los suscriptores del requisito al crearlo | Asunto «Nuevo requisito: {título}». «{actor} creó un nuevo requisito en {proyecto}: "{título}".» y el botón «Ver el requisito» | initial |
| NOT-02 | Se suscribe a un usuario a un requisito | email | El usuario suscripto | El mismo aviso que NOT-01: asunto «Nuevo requisito: {título}» | initial |
| NOT-03 | Un requisito entra en `resuelto` (por edición o por el comando de resolución) | email | Los suscriptores del requisito | Asunto «Requisito resuelto: {título}». «{actor} resolvió el requisito "{título}" en {proyecto}.» y «Comentario de resolución: {comentario}» («sin comentario de resolución» si no hay), con el botón «Ver el requisito» | initial |
| NOT-04 | Un requisito sale de `resuelto` hacia otro estado | email | Los suscriptores del requisito | Asunto «Requisito reabierto: {título}». «{actor} reabrió el requisito "{título}" en {proyecto}.» y «Volvió a estar activo, así que puede necesitar tu atención de nuevo.», con el botón «Ver el requisito» | initial |
| NOT-05 | Se agrega un comentario `public` a un requisito `public` | email | Los suscriptores del requisito | Asunto «Nuevo comentario en: {título}». «{actor} comentó en el requisito "{título}" de {proyecto}:» y el texto del comentario («sin contenido» si está vacío), con el botón «Ver el comentario» | initial |
| NOT-06 | Toda notificación | email | Solo si el requisito es `public` (y, para NOT-05, el comentario también). De los candidatos se excluye al autor del cambio cuando el cambio llegó por la api en nombre de una persona, se quitan duplicados, se descartan los usuarios sin email y se conservan solo los que tienen permiso sobre el proyecto del requisito | — | initial |
| NOT-07 | Toda notificación | email | — | Mail en HTML y texto con la marca Jiku, en español; el enlace lleva al requisito en el Portal de clientes (`{URL del portal}/projects/{proyecto}/requirements/{id}`). Sin nombre de autor dice «Alguien», sin título «un requisito sin título», sin proyecto «sin proyecto». Pie: «Correo automático enviado por Jiku. No respondas a esta dirección: los mensajes no se leen.» | initial |
| NOT-08 | Toda notificación | email | — | Se encola en la misma transacción que el cambio que la origina, una fila por destinatario; un proceso la envía cada **intervalo de envío de notificaciones**, hasta **lote de notificaciones** filas por ciclo, en orden de próximo intento. La entrega es al menos una vez | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| NOT-E1 | El cambio que origina la notificación falla | No se encola ninguna notificación | initial |
| NOT-E2 | El envío por SMTP falla, o el tipo no tiene plantilla | La fila queda pendiente con el error registrado y se reintenta después de 60 s × 2^(intentos previos), con un tope de 24 horas | initial |
| NOT-E3 | Una fila acumula **intentos máximos de notificación** fallos | La fila se borra y el descarte queda en el log con tipo, entidad, destinatario y motivo | initial |
| NOT-E4 | El ciclo falla después de haber enviado algunos mails (por ejemplo, al confirmar) | Se deshace el ciclo: esas filas vuelven a quedar pendientes y sus mails se reenvían en un ciclo siguiente | initial |
| NOT-E5 | No se puede leer la configuración o tomar el lote | Ese ciclo no envía nada y queda en el log; el siguiente vuelve a intentar | initial |
| NOT-E6 | Una clave de configuración falta, no es numérica o no es mayor que cero | Se usa el valor por defecto de ese parámetro | initial |
| NOT-E7 | Falta la URL del portal (`OPUS_URL`) al arrancar core | core no arranca: «Falta la variable de entorno OPUS_URL: es la base absoluta con esquema del portal …» | initial |

## Not notified
- Cambios de estado que no entran ni salen de `resuelto` (incluido pasar a `cancelado` desde un estado que no es `resuelto`).
- Cambios de título, descripción, tipo, prioridad, fecha estimada, etiquetas, responsables, visibilidad, alcance, solución técnica o criterios de aceptación.
- Comentarios `internal`, cualquier comentario sobre un requisito `internal` y la edición de comentarios.
- Cualquier evento de un requisito `internal`.
- Desuscribirse de un requisito.
- Tareas, proyectos, clientes, personas, horas trabajadas, ausencias, asignaciones semanales, archivos y documentación.
- El autor del cambio, cuando el cambio llegó por la api (incluido quien se suscribe a sí mismo y quien crea un requisito en el portal).
- Usuarios sin email (identidades de servicio) y suscriptores sin permiso sobre el proyecto del requisito, entre ellos los miembros del equipo que no tienen permiso asignado.
- Ningún canal distinto del email.

## Examples
- NOT-E2 / NOT-E3: con **intentos máximos de notificación** = 5, un mail que falla siempre se reintenta a los 60 s, 120 s, 240 s y 480 s de cada fallo; el quinto fallo lo descarta.
- NOT-06: un requisito público de un proyecto tiene como suscriptores a Laura (usuaria de cliente con permiso), Martín (miembro del equipo sin permiso sobre el proyecto) y a quien lo comenta desde el portal; un comentario público le llega solo a Laura.
- NOT-02: Laura se suscribe a sí misma desde el portal: no recibe ningún mail (es la autora del cambio).
