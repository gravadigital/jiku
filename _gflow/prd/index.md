# Jiku

Gestor interno de proyectos de una consultora de software: clientes, proyectos, requisitos, tareas,
horas trabajadas, ausencias y asignación semanal de capacidad, con un portal donde cada cliente sigue
y crea los requisitos de sus proyectos. Toda escritura pasa por un servicio de dominio en un bus NATS
que también usan conectores externos; la documentación es un módulo opcional.

## Actores
| ID | Actor | Acceso | Recuperación de acceso | Origen |
|---|---|---|---|---|
| U-01 | Administrador | Cuenta de Zitadel con el rol `admin`, por OIDC con PKCE en Gestión interna; en el Portal de clientes solo opera si además tiene el rol `user` | La de Zitadel | inicial |
| U-02 | Miembro del equipo | Cuenta de Zitadel con el rol `user`, por OIDC con PKCE en Gestión interna y en el Portal de clientes | La de Zitadel | inicial |
| U-03 | Cliente | Cuenta de Zitadel con el rol `external-user`, por OIDC con PKCE en el Portal de clientes; ve solo los proyectos donde tiene permiso de proyecto | La de Zitadel | inicial |
| U-04 | Conector | Service user de Zitadel con el rol `internal-app` (token JWT) más las credenciales NATS del sentinel; opera directamente sobre el bus | — | inicial |
| U-05 | Visitante con link público | Sin autenticación: abre un link compartido de un documento en el host público de links | — | inicial |

## Superficies
| Superficie | Plataforma | Actores | Viewports | Servicio | Origen |
|---|---|---|---|---|---|
| Gestión interna | web | U-01, U-02 | Escritorio, ancho mínimo 1400 px (por debajo, scroll horizontal) | web | inicial |
| Portal de clientes | web | U-03, U-02, U-01 | Móvil (menos de 768 px) y escritorio | opus-web | inicial |

## Documentación

Las rutas son relativas a `_gflow/prd/`. El contexto de una tarea se arma con `python3 .claude/scripts/grava.py load` (ver la spec Product Definition).

| Documento | Contiene | Cargar cuando |
|---|---|---|
| blocks/index.md | Un bloque por línea: prefijo, nombre, estado, superficies, qué cubre | Hay que ubicar qué bloque cubre una funcionalidad |
| blocks/{PREFIJO}.md | Requisitos, condiciones de falla y ejemplos del bloque | La tarea cita un ID `{PREFIJO}-NN` o `{PREFIJO}-EN`, o toca ese bloque |
| decisions.md | Decisiones de producto y técnicas, con lo descartado y su motivo | Se carga cualquier bloque, módulo o servicio (filtrado por Afecta) |
| parameters.md | Valor y variable de cada parámetro | Un archivo cargado nombra un parámetro en negrita |
| nfr.md | Requisitos no funcionales | Tarea de una superficie o un servicio (filtrado por Alcance) |
| out-of-scope.md | Lo que el producto no hace | Se define algo nuevo |
| domain/index.md | Una entidad por línea, con sus tablas | Hay que ubicar una entidad |
| domain/glossary.md | Términos del dominio | Se carga cualquier bloque |
| domain/{entidad}.md | Atributos, relaciones, baja, estados y transiciones | Un bloque cargado la nombra en entities |
| domain/invariants.md | Reglas que valen siempre | Se toca una de sus entidades |
| architecture/services.md | Servicios, módulos e interacciones | Hay que ubicar dónde va el código |
| architecture/integration.md | Persistencia, comunicación e integraciones externas | La tarea usa la base, un canal o un sistema externo |
| architecture/auth.md | Credenciales, su uso y los roles | La tarea autentica o autoriza |
| architecture/guarantees.md | Cómo se cumple cada regla que vale siempre | Se toca una regla, un invariante o un módulo |
| ../apis/ | Contratos de cada servicio (OpenAPI, AsyncAPI) | La tarea expone o consume una operación |
| ../db-schemas/ | Esquema de base de cada servicio | La tarea toca tablas |
| ../flows/index.md | Flujos entre módulos y servicios | La tarea cruza módulos o depende de una garantía |
