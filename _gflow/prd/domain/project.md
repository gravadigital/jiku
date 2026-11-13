---
entity: Proyecto
tables: [projects, projects_persons]
describes: Trabajo para un cliente o interno, con estado, propiedades y personas; contiene requisitos y tareas
---

# Proyecto

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| código | texto | sí | exigido al crear; la base lo admite nulo | no | inicial |
| nombre | texto | sí | exigido al crear; la base lo admite nulo | no | inicial |
| tipo | enum | sí | `interno`, `comercial`, `investigacion`, `propuesta`; al crear, `comercial` si no viene | no | inicial |
| descripción | texto | no | admite vacío | no | inicial |
| estado | enum | sí | `analisis`, `activo`, `inactivo`, `finalizado`, `cancelado`; al crear, `analisis` si no viene; la base de producción lo admite nulo | no | inicial |
| fecha de inicio | fecha y hora | sí | al crear, el instante actual si no viene | no | inicial |
| fecha de fin | fecha y hora | no | — | no | inicial |
| prioridad | número | no | default 0; ningún comando la escribe | no | inicial |
| propiedades | texto | no | lista de pares código/valor; códigos permitidos `documentacion`, `diseño`, `board_de_tareas` (valor URI) y `mattermost_group_name` (texto libre); se guarda como JSON | no | inicial |
| identificador de tickets | texto | no | único entre proyectos cuando existe; ningún comando lo escribe | no | inicial |
| creador | referencia | sí | Usuario que lo creó; lo fija el alta, no cambia | no | inicial |
| cliente | referencia | no | Cliente existente | no | inicial |
| origen | número | no | columna legada sin referencia ni uso | no | inicial |
| personas del proyecto | referencia | no | lista de Persona; ningún comando la escribe, solo se lee | no | inicial |

## Relaciones
- Un Proyecto pertenece a 0..1 Cliente.
- Un Proyecto fue creado por 1 Usuario.
- Un Proyecto contiene 0..n Requisito y 0..n Tarea.
- Un Proyecto tiene 0..n Persona como personas del proyecto (tabla `projects_persons`).
- Un Proyecto tiene 0..n Permiso de proyecto, 0..n Hora trabajada y 0..n Asignación semanal.
- Un Proyecto tiene 0..n Adjunto (tipo de entidad `project`; ningún comando los crea).

## Baja
Nunca: no hay borrado de proyectos; `cancelado` y `finalizado` son estados, no bajas. Si se borrara una fila a mano, la base borra en cascada sus horas trabajadas, asignaciones semanales, permisos y personas del proyecto, y rechaza el borrado si tiene requisitos.

## Estados
| Estado | Tipo | Significado | Origen |
|---|---|---|---|
| analisis | inicial | en análisis, todavía no activo | inicial |
| activo | intermedio | en curso | inicial |
| inactivo | intermedio | pausado | inicial |
| finalizado | final | terminado | inicial |
| cancelado | final | abandonado | inicial |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
|---|---|---|---|
| (alta) | cualquiera | PRY-01 | inicial |
| cualquiera | cualquiera | PRY-02, PRY-03 | inicial |
