---
entity: Persona
tables: [people]
describes: Integrante del equipo que carga horas, recibe asignaciones y es responsable de tareas y requisitos
---

# Persona

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| nombre | texto | sí | — | sí | inicial |
| apellido | texto | sí | — | sí | inicial |
| habilitada | booleano | sí | default verdadero | no | inicial |
| fecha de ingreso | fecha y hora | sí | — | no | inicial |
| fecha de egreso | fecha y hora | no | — | no | inicial |
| debe cargar horas | booleano | sí | default verdadero | no | inicial |
| usuario | referencia | no | Usuario con el que se identifica; sin usuario, la persona no es de nadie a los fines de cargar horas | no | inicial |

## Relaciones
- Una Persona se vincula con 0..1 Usuario.
- Una Persona es responsable de 0..n Requisito y 0..n Tarea.
- Una Persona integra 0..n Proyecto (personas del proyecto).
- Una Persona tiene 0..n Hora trabajada, 0..n Ausencia y 0..n Asignación semanal.

## Baja
Se desactiva (habilitada en falso, con fecha de egreso), fuera del producto: ningún comando ni ruta crea, modifica ni borra personas; se administran directamente en la base. Los listados de personas activas muestran solo las habilitadas. Si se borrara una fila a mano, la base borra en cascada sus horas trabajadas, asignaciones y participaciones en tareas y proyectos, y rechaza el borrado si tiene ausencias o es responsable de requisitos.
