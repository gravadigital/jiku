---
flow: carga-de-horas
requirements: [HOR-01, HOR-02, HOR-03, HOR-04, HOR-05, HOR-06, HOR-07, HOR-08, HOR-09, HOR-E1, HOR-E2, HOR-E3, HOR-E8, HOR-E9, HOR-E11, HOR-E14]
modules: [api.worked-times, api.unworked-times, core.times, core.identity]
---

# Carga de horas trabajadas y ausencias

La pantalla de carga envía horas o una ausencia; core resuelve la persona, aplica titularidad, ventana y tope diario en la transacción del comando.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | web → api | Carga horas de un día con minutos, proyecto y tarea o requisito | `POST /api/worked-times` | HOR-01 |
| 2 | api → core | Publica el comando (`objectiveId` → `taskId`) con el sobre actor | `{instance}.{user-id}.jiku-commands.v1.worked-times.new` | ACC-10 |
| 3 | core → PostgreSQL | Sin `personId`, usa la persona vinculada al usuario del actor; si no es suya y el actor no es `admin`, rechaza | `people` (`user_id` = actor) | HOR-02, HOR-03, HOR-E1, HOR-E2, GAR-48 |
| 4 | core → PostgreSQL | Verifica proyecto, tarea y requisito, y que el requisito sea del proyecto (tarea o requisito, nunca los dos, ya lo exigió el esquema) | `projects`, `objectives`, `requirements` | INV-06, INV-07, HOR-06, HOR-E8, GAR-08, GAR-09 |
| 5 | core → core | Exige el día dentro de la **ventana de carga de horas** | — | HOR-04, HOR-E9, GAR-45 |
| 6 | core → PostgreSQL | Suma los minutos trabajados de la persona en ese día y compara con el **tope diario de minutos**, sin bloqueo | `worked_times` | INV-08, HOR-05, HOR-E11, GAR-10 |
| 7 | core → PostgreSQL | Inserta y confirma | `worked_times`; `COMMIT` | GAR-27 |
| 8 | web → api | Registra una ausencia; la api completa `personId` con la persona del usuario si falta | `POST /api/unworked-times` → `unworked-times.new` | HOR-02, HOR-07, HOR-E1 |
| 9 | core → PostgreSQL | Titularidad y suma de horas trabajadas más ausencias del día contra el **tope diario de minutos**; inserta y confirma | `worked_times`, `unworked_times` | INV-09, HOR-03, HOR-08, HOR-E3, GAR-11, GAR-48 |
| 10 | web → api | Borra una ausencia: la api rechaza si se registró antes del **plazo de borrado de ausencias** y después publica | `DELETE /api/unworked-times/{id}` → `unworked-times.{id}.delete` | HOR-09, HOR-E14, GAR-47 |
