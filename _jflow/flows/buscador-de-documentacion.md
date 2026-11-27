---
flow: buscador-de-documentacion
requirements: [DOC-04, DOC-05, DOC-06, DOC-12]
modules: [api.docs, core.clients, core.projects, core.people]
---

# Buscador de documentación

Mientras la persona escribe en «Documentación», la api combina sugerencias de la base (proyectos, clientes, personas) con los temas del módulo; después lista los documentos filtrados y permite asignarle un proyecto a uno que no lo tiene.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | web → api.docs | Pide sugerencias con el texto escrito (1 a 100 caracteres) y, opcional, un cliente que limita solo los proyectos | `GET /docs/suggestions` | DOC-04 |
| 2 | api.docs → core.people, core.projects | Busca los proyectos `activo` en los que participa la Persona del usuario | `people`, `projects_persons`, `projects` | DOC-06 |
| 3 | api.docs → core.projects, core.clients, core.people | Busca por nombre o código los proyectos (los del usuario primero, después los `activo`), los clientes y las personas habilitadas con usuario | `projects`, `clients`, `people` | DOC-04 |
| 4 | api.docs → jiku-docs | Pide los temas que empiezan con el texto, con la identidad de la persona; si falla, no responde sugerencias parciales | `topics.list` | DOC-04 |
| 5 | web → api.docs → jiku-docs | Busca por texto o lista los documentos con los filtros elegidos; con «mis proyectos activos» y ninguno, responde la lista vacía sin llamar al módulo | `GET /docs/search` → `documents.search`; `GET /docs/documents` → `documents.list` | DOC-04, DOC-05, DOC-06, DOC-E10 |
| 6 | api.docs → core.clients, core.projects | Completa los nombres de clientes y proyectos de los resultados, una lectura por tipo | `clients`, `projects` | DOC-05 |
| 7 | web → api.docs → jiku-docs | Para un documento «Sin proyecto», pide las relaciones sugeridas y les completa los nombres | `GET /docs/documents/{id}/suggested-relations` → `documents.suggest-relations`; `projects`, `clients` | DOC-12 |
| 8 | web → api.docs → jiku-docs | «Asignar» agrega el proyecto sobre la versión base; el módulo suma el cliente del proyecto y crea una versión | `POST /docs/documents/{id}/relations` → `documents.{id}.relations.update` | DOC-12, DOC-E5, DOC-E9 |
