---
entity: Persona
tables: [people]
describes: Integrante del equipo a quien se imputan horas, ausencias, asignaciones y responsabilidades; puede no tener usuario
---

# Persona

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| nombre | texto | sí | hasta 255 caracteres | sí | initial |
| apellido | texto | sí | hasta 255 caracteres | sí | initial |
| habilitada | booleano | sí | por omisión verdadero; las listas de personas muestran solo las habilitadas | no | initial |
| fecha de ingreso | fecha y hora | sí | — | no | initial |
| fecha de egreso | fecha y hora | no | — | no | initial |
| debe cargar horas | booleano | sí | por omisión verdadero; decide si la persona aparece en la grilla de asignación semanal | no | initial |
| usuario | referencia | no | a Usuario; es lo que vincula a quien actúa con su Persona al cargar horas y ausencias | no | initial |

## Relationships
- Una Persona tiene 0..1 Usuario; un Usuario es 0..1 Persona.
- Una Persona tiene 0..N Horas trabajadas, 0..N Ausencias y 0..N Asignaciones semanales.
- Una Persona es responsable de 0..N Tareas y de 0..N Requisitos.
- Una Persona está en 0..N Proyectos (personas del proyecto).

## Removal
El producto no crea, edita ni elimina personas: se cargan por fuera de él, directamente en la base. Quien deja el equipo se marca no habilitada. Si se borrara por fuera, la base elimina en cascada sus horas trabajadas, asignaciones semanales, responsabilidades de tareas y pertenencias a proyectos, y rechaza el borrado si tiene ausencias o responsabilidades de requisitos. Si se borra su Usuario, la referencia pasa a nula.
