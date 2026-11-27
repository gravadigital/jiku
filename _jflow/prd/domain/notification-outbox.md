---
entity: Notificación pendiente
tables: [notification_outbox]
describes: Email por enviar a un destinatario, escrito en la misma transacción que el hecho que lo origina y enviado después por un proceso periódico
---

# Notificación pendiente

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| tipo | texto | sí | requirement.created, requirement.resolved, requirement.reopened, requirement.comment.created; hasta 100 caracteres | no | initial |
| canal | texto | sí | email (único valor); hasta 20 caracteres | no | initial |
| destinatario | referencia | sí | a Usuario | no | initial |
| email del destinatario | email | sí | copiado del Usuario al escribirla; hasta 255 caracteres | sí | initial |
| contenido | estructura libre | sí | los datos con que se arma el email (incluye nombres de personas y textos del requisito o comentario) | sí | initial |
| estado | texto | sí | pending, sent; por omisión pending | no | initial |
| intentos | número | sí | por omisión 0 | no | initial |
| próximo intento | fecha y hora | sí | por omisión, el momento de la creación | no | initial |
| último error | texto | no | — | no | initial |
| fecha de envío | fecha y hora | no | — | no | initial |

## Relationships
- Una Notificación pendiente tiene 1 Usuario destinatario.

## Removal
Se elimina físicamente cuando agota el máximo de intentos sin poder enviarse (solo queda un registro en el log). Las enviadas se conservan.

## States
| State | Type | Meaning | Origin |
|---|---|---|---|
| pending | initial | Por enviar; tras un fallo sigue pendiente con un intento más y el próximo intento postergado | initial |
| sent | final | Enviada | initial |

## Transitions
| From | To | Triggered by | Origin |
|---|---|---|---|
| — | pending | NOT-08 | initial |
| pending | pending (reintento) | NOT-E2 | initial |
| pending | sent | NOT-08 | initial |
| pending | eliminada (máximo de intentos) | NOT-E3 | initial |
