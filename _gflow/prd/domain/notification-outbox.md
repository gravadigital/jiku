---
entity: Notificación pendiente
tables: [notification_outbox]
describes: Mail a un destinatario encolado junto con el cambio que lo origina, que un proceso periódico envía con reintentos
---

# Notificación pendiente

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| tipo | texto | sí | `requirement.created`, `requirement.resolved`, `requirement.reopened`, `requirement.comment.created`; hasta 100 caracteres | no | inicial |
| canal | texto | sí | `email`; default `email` | no | inicial |
| destinatario | referencia | sí | Usuario | no | inicial |
| email del destinatario | email | sí | copiado al encolar; hasta 255 caracteres | sí | inicial |
| contenido | texto | sí | JSON: entidad, actor (con su nombre), título del requisito, nombre del proyecto, link al portal, datos del evento | sí | inicial |
| estado | enum | sí | `pending`, `sent`; default `pending`; se guarda como texto | no | inicial |
| intentos | número | sí | default 0 | no | inicial |
| próximo intento | fecha y hora | sí | default el instante del alta; tras un fallo, ahora más 60 s × 2^intentos, con tope de un día | no | inicial |
| último error | texto | no | mensaje del último fallo de envío | no | inicial |
| enviada en | fecha y hora | no | instante del envío | no | inicial |

## Relaciones
- Una Notificación pendiente tiene 1 Usuario destinatario.
- Una Notificación pendiente se refiere a 1 Requisito (dentro del contenido, sin referencia en la base).

## Baja
Se elimina (borrado físico) al agotar los intentos de envío; queda solo un registro en el log. Las enviadas no se borran.

## Estados
| Estado | Tipo | Significado | Origen |
|---|---|---|---|
| pending | inicial | encolada, esperando envío o reintento | inicial |
| sent | final | enviada por SMTP | inicial |
| (descartada) | final | agotó los intentos; la fila se borra | inicial |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
|---|---|---|---|
| (alta) | pending | NOT-01, NOT-02, NOT-03, NOT-04, NOT-05, NOT-06 | inicial |
| pending | sent | NOT-06 | inicial |
| pending | pending | NOT-E1 | inicial |
| pending | (descartada) | NOT-E2 | inicial |
