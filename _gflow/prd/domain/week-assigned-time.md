---
entity: Asignación semanal
tables: [week_assigned_times]
describes: Minutos planificados para una persona en un proyecto durante una semana laboral
---

# Asignación semanal

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| desde | fecha | sí | lunes de la semana (INV-20); no anterior a la semana actual al guardar; se guarda como fecha y hora; la base admite nulo | no | inicial |
| minutos | duración | sí | entero mayor que 0 (una celda en 0 no se guarda); la base admite nulo | no | inicial |
| proyecto | referencia | sí | Proyecto existente; la base admite nulo | no | inicial |
| persona | referencia | sí | Persona existente; la base admite nulo | no | inicial |

## Atributos derivados
| Atributo | Regla de cálculo | Origen |
|---|---|---|
| hasta | viernes de la semana de `desde`; se guarda | inicial |
| interna | verdadero si el proyecto es de tipo `interno` al momento de guardar; se guarda y no se recalcula si el proyecto cambia de tipo | inicial |

## Relaciones
- Una Asignación semanal pertenece a 1 Persona y a 1 Proyecto.

## Baja
Se elimina (borrado físico): guardar una semana reemplaza todas las asignaciones de esa semana, de todas las personas, por las enviadas. Se borra en cascada con su persona o su proyecto.
