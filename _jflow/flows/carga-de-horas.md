---
flow: carga-de-horas
requirements: [HOR-01, HOR-02, HOR-03, HOR-04, HOR-05, HOR-06, HOR-11, AUS-01, AUS-02, AUS-04, AUS-06, CON-18]
modules: [api.times, core.times, core.people, core.projects, core.tasks, core.requirements]
---

# Carga y borrado de horas trabajadas y ausencias

Una persona del equipo (o el administrador a nombre de otra) registra horas trabajadas o una ausencia de un día, o borra un registro. La api solo valida la forma y publica; las reglas de ventana, titularidad y tope diario las aplica core.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web → api.times | En «Horas Trabajadas», modo «Presente», la persona guarda la carga; el gestor la envía desde el servidor con el token de la sesión | `POST /worked-times` | HOR-01, HOR-02, HOR-11 |
| 2 | api.times → core.times | La api valida solo la forma del cuerpo (no chequea rol), renombra `objectiveId` a `taskId`, agrega el sobre de identidad de la persona y publica el comando | `worked-times.new` | Sin core escuchando responde 503 (no se hizo); sin respuesta a tiempo, 504 (pudo hacerse) |
| 3 | core.times | El esquema del comando rechaza tarea y requisito a la vez, antes de abrir la transacción | `worked-times.new` | HOR-E9 |
| 4 | core.times → core.people | Resuelve la persona: la indicada o, si no viene, la vinculada al usuario del actor | `people` (`people.user_id` = id del actor) | HOR-E1 |
| 5 | core.times | Si la persona no es la del actor y el actor no tiene rol `admin`, rechaza; se evalúa antes que las referencias | — | HOR-02, HOR-E2, CON-18 |
| 6 | core.times → core.projects, core.tasks, core.requirements | Verifica que existan el proyecto, la tarea y el requisito, y que el requisito sea del proyecto; la tarea no se compara con el proyecto | `projects`, `objectives`, `requirements` | HOR-05, HOR-E3, HOR-E4, HOR-E5, HOR-E6 |
| 7 | core.times | Ventana de carga: el día actual y los 10 previos, en UTC, para todos los roles | — | HOR-03, HOR-E7 |
| 8 | core.times | Suma los minutos de horas trabajadas de la persona ese día y rechaza si con la carga pasa de 1440; sin bloqueo de filas | `worked_times` | HOR-04, HOR-E8, HOR-E18 |
| 9 | core.times | Inserta el registro, confirma la transacción y responde su id | `worked_times` | `worked_times.id` → paso 10 |
| 10 | api.times → web | Relee el registro con su proyecto, tarea y requisito y responde 201 | `worked_times`, `projects`, `objectives`, `requirements` | — |
| 11 | web → api.times | La persona borra un registro de la lista del día; la api responde 404 si no existe y si existe publica el borrado | `DELETE /worked-times/{id}` → `worked-times.{id}.delete` | HOR-06, HOR-E11 |
| 12 | core.times | Titularidad (salvo `admin`) y ventana sobre la fecha del registro, en ese orden; borra | `worked_times` | HOR-E12, HOR-E13 |
| 13 | web → api.times | En modo «Ausente» la persona registra una ausencia | `POST /unworked-times` | AUS-01, AUS-02 |
| 14 | api.times → core.people | Si no viene la persona, la api la busca por el usuario del token y la agrega al comando | `people` | AUS-E1 |
| 15 | api.times → core.times | Publica el alta con la persona y el sobre de identidad | `unworked-times.new` | — |
| 16 | core.times | Verifica que la persona exista y la titularidad (salvo `admin`); suma horas trabajadas y ausencias de la persona ese día y rechaza si pasa de 1440; sin ventana de fechas | `people`, `worked_times`, `unworked_times` | AUS-04, AUS-E2, AUS-E3, AUS-E4, AUS-E9 |
| 17 | core.times → api.times → web | Inserta la ausencia y confirma; la api la relee y responde 201 | `unworked_times` | `unworked_times.id` → relectura |
| 18 | web → api.times | La persona borra una ausencia; la api exige que exista y que se haya creado hace no más de 10 días (hora del servidor) | `DELETE /unworked-times/{id}`, `unworked_times` | AUS-06, AUS-E6, AUS-E7 |
| 19 | api.times → core.times | Publica el borrado; core verifica la titularidad (salvo `admin`) y borra, sin ventana | `unworked-times.{id}.delete`, `unworked_times` | AUS-E8 |
