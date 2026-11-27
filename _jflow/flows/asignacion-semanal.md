---
flow: asignacion-semanal
requirements: [ASG-01, ASG-03, ASG-05, ASG-06, ASG-07, ASG-08, ASG-10, ASG-11]
modules: [api.times, core.times, core.people, core.projects, core.settings]
---

# Asignación semanal de capacidad

El administrador abre una semana, reparte la capacidad de cada persona entre los proyectos y guarda la semana completa; el resto del equipo la ve en solo lectura.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web → api.times | La pantalla «Asignación de Tiempo» pide la semana por su lunes; un usuario de cliente es redirigido antes a «Proyectos» | `GET /week-assigned-times` | ASG-01, ASG-11, ASG-E7 |
| 2 | api.times → core.times, core.people, core.projects | La api lee las asignaciones de lunes a viernes de esa semana, las personas habilitadas que deben cargar horas y los proyectos `activo` o `analisis` | `week_assigned_times`, `people`, `projects` | ASG-01 |
| 3 | web → api.times → core.settings | La pantalla pide las horas por día para calcular la capacidad semanal de cada persona | `GET /settings/hours-per-day`, `system_settings` | ASG-03, ASG-E8 |
| 4 | web | Decide si la semana es editable (la en curso de lunes a sábado y las futuras) y, si el administrador abre una editable sin asignaciones, precarga las de la semana anterior con una segunda lectura; nada se guarda todavía | `GET /week-assigned-times` | ASG-08, ASG-10 |
| 5 | web → api.times | Al pulsar «Guardar», el administrador envía la semana con todas las asignaciones, ya convertidas de porcentaje a minutos | `PUT /week-assigned-times` | ASG-05 |
| 6 | api.times → core.times | La api valida solo la forma (no chequea rol), renombra `weekStart` y `allocations` a `dateFrom` y `assignments` y publica con el sobre de identidad | `week-assigned-times.replace` | — |
| 7 | core.times | Solo el rol `admin` tiene este comando; el esquema exige que la semana empiece un lunes | `week-assigned-times.replace` | ASG-E1, ASG-E3, ASG-E6 |
| 8 | core.times | Rechaza las semanas anteriores a la semana en curso, calculada en UTC | — | ASG-07, ASG-E2 |
| 9 | core.times → core.projects, core.people | Verifica que existan los proyectos y las personas de las asignaciones con minutos, y toma de cada proyecto si es `interno` | `projects`, `people` | ASG-E4, ASG-E5 |
| 10 | core.times | En la misma transacción borra todas las asignaciones de esa semana, de todas las personas, e inserta las enviadas con minutos mayores que 0, de lunes a viernes | `week_assigned_times` | ASG-06 |
| 11 | api.times → web | Relee la semana y responde; la pantalla avisa «Cambios guardados correctamente» | `week_assigned_times` | ASG-05 |
