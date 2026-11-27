---
flow: eventos-de-dominio
requirements: [CON-15, TAR-30]
modules: [core.requirements, core.tasks]
---

# Eventos de dominio de requisitos y tareas

Cuando un comando sobre requisitos o tareas se confirma, core publica sus eventos de dominio en el flujo de eventos del bus, de donde los leen los conectores.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | core.requirements, core.tasks | El comando escribe y declara en su respuesta los eventos del cambio, sin publicarlos: alta, cambio de estado, edición, responsables, comentario, edición de comentario, suscripción, resolución y reapertura | `requirements.new`, `requirements.{id}.edit`, `requirements.{id}.resolve`, `requirements.{id}.comment`, `requirements.{id}.comment.{cid}.edit`, `requirements.{id}.subscriptors.new`, `requirements.{id}.subscriptors.{userId}.delete`, `tasks.new`, `tasks.{id}.edit`, `tasks.{id}.comment`, `tasks.{id}.comment.{cid}.edit` | TAR-30 |
| 2 | core | El despachador confirma la transacción; si el comando falló no se publica nada | — | CON-15 |
| 3 | core → NATS | Después de confirmar, completa cada evento con id único, fecha, versión y un id de correlación por comando, y lo publica en el flujo de eventos; si la publicación falla, el comando queda hecho y la falla solo se registra | `requirement.created`, `requirement.state.changed`, `requirement.updated`, `requirement.assigned`, `requirement.comment.created`, `requirement.comment.edited`, `requirement.subscriptor.added`, `requirement.subscriptor.removed`, `requirement.resolved`, `requirement.reopened`, `task.created`, `task.state.changed`, `task.updated`, `task.assigned`, `task.comment.created`, `task.comment.edited` | CON-15 |
| 4 | NATS | El flujo `JIKU_EVENTS` guarda los eventos 7 días | `{instance}.events.v1.{tipo}` | CON-15 |
| 5 | NATS → conector | El conector crea su consumidor y lee los eventos; no hay garantía de entrega para los eventos que no se pudieron publicar | `{instance}.events.v1.{tipo}` | CON-15 |
