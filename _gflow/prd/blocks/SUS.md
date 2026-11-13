---
prefix: SUS
name: Suscripciones
surfaces: [Portal de clientes]
covers: Suscribirse y desuscribirse de un requisito desde el portal, suscriptores al crear un requisito y las suscripciones a tareas, que solo existen como dato
entities: [Suscripción a requisito, Suscripción a tarea, Requisito, Usuario]
last_requirement: SUS-06
last_failure: SUS-E8
---

# SUS — Suscripciones

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| SUS-01 | Suscribir a un requisito público a un usuario con permiso de proyecto sobre su proyecto; el botón «Suscribirse» del portal suscribe a quien lo pulsa | U-03 | inicial |
| SUS-02 | Desuscribirse de un requisito desde el portal («Desuscribirse»); cada uno solo se desuscribe a sí mismo | U-03 | inicial |
| SUS-03 | Los botones «Suscribirse» y «Desuscribirse» del portal los ven solo los Clientes; un Miembro del equipo puede suscribir por la api, y ningún rol interno puede desuscribir | U-03, U-02 | inicial |
| SUS-04 | Al crear un requisito se indican suscriptores; en el portal se eligen entre los usuarios de tipo persona con permiso sobre el proyecto, y quien crea queda siempre suscripto | U-01, U-02, U-03 | inicial |
| SUS-05 | El detalle de un requisito en el portal muestra sus suscriptores, o «Sin suscriptores» | U-03, U-02 | inicial |
| SUS-06 | Las suscripciones a tareas existen solo como dato cargado fuera del producto: no hay operación que las cree ni las borre, y un Cliente consulta por el bus solo las propias | — | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| SUS-E1 | El requisito es interno o no existe | 404 `requirement_not_found` | inicial |
| SUS-E2 | El usuario a suscribir no existe | 404 `user_not_found` | inicial |
| SUS-E3 | El usuario a suscribir no tiene permiso sobre el proyecto del requisito | 403 `no_permission` | inicial |
| SUS-E4 | El usuario ya está suscripto | 400 `already_subscribed` | inicial |
| SUS-E5 | Desuscribir a otro usuario | 403 `access_denied` | inicial |
| SUS-E6 | La suscripción no existe | 404 `subscription_not_found` | inicial |
| SUS-E7 | Falla la suscripción o la desuscripción en la pantalla | El botón pasa a «Error» | inicial |
| SUS-E8 | En el portal, se piden los usuarios de un proyecto que no existe | 404 `project_not_found` | inicial |
