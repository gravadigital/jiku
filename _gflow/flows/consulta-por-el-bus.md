---
flow: consulta-por-el-bus
requirements: [BUS-01, BUS-02, BUS-03, BUS-04, BUS-05, BUS-07, BUS-E3, BUS-E4, BUS-E5, BUS-E6, BUS-E7, BUS-E8, ACC-E3]
modules: [core.queries, core.identity]
---

# Consulta genérica por el bus

Un conector o una persona con cliente NATS lista o lee un recurso con su propia identidad; core clasifica al caller, valida la consulta, arma el SQL con el recorte externo y lo ejecuta con la conexión de solo lectura.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | conector o persona → NATS | Conecta con las credenciales del sentinel más su token de Zitadel; el auth-callout valida el token y mintea los permisos de su rol | Plantillas `connector`, `person-internal`, `person-external` | BUS-07, GAR-53 |
| 2 | conector o persona → core | Publica la consulta bajo su propio id | `{instance}.{user-id}.jiku-queries.v1.{recurso}.list` o `.get`, por ejemplo `requirements.list`, `tasks.get`, `requirements.tags`, `meta.describe` | BUS-01 |
| 3 | core → core | Autoriza la consulta por rol (todos los roles de persona y `internal-app`) | Mapa rol → método | ACC-E3, GAR-31 |
| 4 | core → PostgreSQL | Resuelve la clase de caller (`connector`, `internal`, `external`) por los roles de su fila; sin clase responde `unknown_caller` (sin exención para la api) | `users` | BUS-E3 |
| 5 | core → core | Valida la consulta contra la ficha del recurso: filtros, orden, campos, relaciones, conteo, filtros obligatorios y ausencia de campos de identidad | Ficha del recurso | BUS-02, BUS-05, BUS-E4, GAR-55 |
| 6 | core → core | Arma el SQL explícito; para la clase `external` agrega el recorte (proyectos permitidos y visibilidad pública, filas propias o ninguna) | `user_project_permissions` y la tabla del recurso | BUS-04, GAR-33 |
| 7 | core → PostgreSQL | Ejecuta sin transacción con el rol de solo lectura; la búsqueda de texto en tareas usa trigramas | Conexión de solo lectura con `statement_timeout` = **tiempo máximo de consulta** | BUS-03, BUS-E6, GAR-28, GAR-37 |
| 8 | core → core | Pagina por cursor opaco con huella de filtro y orden, con **límite de página por defecto** y **límite de página máximo**, y corta por presupuesto de bytes truncando campos largos | Cursor | BUS-02, BUS-E5, GAR-38, GAR-39 |
| 9 | core → conector o persona | Responde `{ items, page: { limit, returned, cursor?, total? } }`, o la fila de un `get` (`{recurso}_not_found` si no existe) | Reply | BUS-E7, BUS-E8 |
