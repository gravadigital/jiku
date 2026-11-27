---
flow: consulta-por-el-bus
requirements: [CON-02, CON-04, CON-06, CON-12, CON-13, CON-14]
modules: [core.identity, core.projects, core.clients, core.people, core.requirements, core.tasks, core.times, core.files, core.settings]
---

# Consulta por el bus: el recorrido de una lectura

Un conector o una persona lee datos de core publicando una consulta en el bus; core autoriza con los roles guardados del usuario, recorta lo que un caller externo no puede ver y responde por páginas. La api no usa estas consultas: lee la base directo.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | conector / persona → NATS | Publica la consulta bajo su propia identidad; el bus solo deja publicar en el subject propio | `{instance}.{userId}.jiku-queries.v1.{método}` (`{recurso}.list`, `{recurso}.get`, `requirements.tags`, `meta.describe`) | CON-02 |
| 2 | NATS → core | Una réplica de core la recibe por el grupo de cola; un cuerpo que no es JSON se rechaza | — | CON-E7 |
| 3 | core.identity | Lee los roles guardados del caller sin cache (siempre, también para la api) y autoriza el método; sin usuario guardado no hay roles | `users.roles` | CON-04, CON-12, CON-E2, CON-E14 |
| 4 | core.identity | Resuelve la clase del caller (conector, interno o externo, la más restrictiva); sin clase se rechaza | — | CON-06, CON-E3 |
| 5 | core | Busca la consulta (método inexistente rechazado) y valida filtro, orden, campos y relaciones contra lo que la clase del caller tiene permitido | — | CON-13, CON-E8, CON-E13 |
| 6 | core.identity, core.projects | Para un caller externo, recorta antes del filtro: solo filas de proyectos sobre los que tiene permiso y solo lo público; horas, ausencias, asignaciones y configuración devuelven vacío sin consultar la base. Solo un conector ve roles y tipo de los usuarios | `user_project_permissions` | CON-12, CON-14 |
| 7 | core → PostgreSQL | Ejecuta la consulta con la conexión de solo lectura, sin transacción y con tiempo máximo; si la base la cancela, se rechaza | tablas del recurso | CON-E12 |
| 8 | core → caller | Responde la página (50 por defecto, hasta 200, con tope de bytes) con el cursor de la siguiente y, si se pidió, el conteo; en un detalle, inexistente y no visible responden igual | — | CON-13 |
| 9 | caller → core | Pide la página siguiente reusando el cursor con el mismo filtro y orden; otro cursor se rechaza | la misma consulta | CON-E11 |
