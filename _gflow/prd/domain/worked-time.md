---
entity: Hora trabajada
tables: [worked_times]
describes: Minutos que una persona trabajó un día en un proyecto, opcionalmente imputados a una tarea o a un requisito
---

# Hora trabajada

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| fecha | fecha | sí | día `YYYY-MM-DD`, dentro de la ventana de carga (el día actual y los diez previos, en UTC); se guarda como fecha y hora a medianoche; la base admite nulo | no | inicial |
| minutos | duración | sí | entero mayor o igual a 1; la suma diaria por persona tiene tope (INV-08); la base admite nulo | no | inicial |
| proyecto | referencia | sí | Proyecto existente; la base admite nulo | no | inicial |
| persona | referencia | sí | Persona; si no se indica, la del usuario que carga; solo un administrador carga horas de otra persona; la base admite nulo | no | inicial |
| tarea | referencia | no | Tarea existente; excluyente con requisito (INV-07) | no | inicial |
| requisito | referencia | no | Requisito del mismo proyecto (INV-06); excluyente con tarea (INV-07) | no | inicial |

## Relaciones
- Una Hora trabajada pertenece a 1 Persona y a 1 Proyecto.
- Una Hora trabajada se imputa a 0..1 Tarea o a 0..1 Requisito, nunca a los dos.

## Baja
Se elimina (borrado físico): la borra su titular, o un administrador, mientras su fecha esté dentro de la ventana de carga. Se borra en cascada con su persona o su proyecto; si se borrara la tarea o el requisito, queda sin imputar.
