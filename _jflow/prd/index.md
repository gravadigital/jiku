# Jiku

Gestión de proyectos para un equipo de servicios: clientes, proyectos, requisitos, tareas, horas trabajadas, ausencias y asignación semanal, en un gestor interno para el equipo y un portal aparte donde cada cliente sigue y crea los requisitos de sus proyectos. Se extiende por un bus (conectores, eventos de dominio y el módulo opcional de documentación).

## Actors

| ID | Actor | Access | Access recovery | Origin |
|---|---|---|---|---|
| U-01 | Administrador | Cuenta del proveedor de identidad (Zitadel) con el rol `admin` del proyecto. Ingresa al Gestor interno por OIDC (código de autorización con PKCE) | La gestiona el proveedor de identidad: el producto no ofrece alta, cambio ni recuperación de contraseña | initial |
| U-02 | Miembro del equipo | Cuenta del proveedor de identidad con el rol `user` del proyecto. Ingresa al Gestor interno y al Portal de clientes por OIDC (código de autorización con PKCE) | La gestiona el proveedor de identidad: el producto no ofrece alta, cambio ni recuperación de contraseña | initial |
| U-03 | Usuario de cliente | Cuenta del proveedor de identidad con el rol `external-user` del proyecto. Ingresa solo al Portal de clientes por OIDC (código de autorización con PKCE); ve los proyectos sobre los que tiene un permiso de proyecto, que se carga directamente en la base | La gestiona el proveedor de identidad: el producto no ofrece alta, cambio ni recuperación de contraseña | initial |
| U-04 | Conector externo | Usuario de máquina del proveedor de identidad con el rol `internal-app` y una key JSON. Se conecta al bus con las credenciales sentinel y un token del proveedor obtenido con esa key; la api es uno | Se genera una key nueva para el usuario de máquina en el proveedor de identidad | initial |
| U-05 | Visitante con link compartido | Sin cuenta: abre `/p/docs/{token}` con el link que le pasó un miembro del equipo | Pedir un link nuevo a quien lo compartió: un link vencido o revocado no se renueva | initial |

## Surfaces

| Surface | Platform | Actors | Viewports | Service | Origin |
|---|---|---|---|---|---|
| Gestor interno | web | U-01, U-02 | desktop | web | initial |
| Portal de clientes | web | U-03, U-02 | desktop, mobile | opus-web | initial |
| Documento compartido | web | U-05 | desktop, mobile | api | initial |

## Documentation

Paths are relative to `_jflow/prd/`. The context of a task is assembled with `python3 .claude/scripts/jflow.py load` (see the Product Definition spec).

| Document | Contains | Load when |
|---|---|---|
| blocks/index.md | One block per line: prefix, name, surfaces, what it covers | You need to find which block covers a feature |
| blocks/{PREFIX}.md | Requirements, failure conditions and examples of the block | The task cites an ID `{PREFIX}-NN` or `{PREFIX}-EN`, or touches that block |
| decisions.md | Product and technical decisions, with what was rejected and why | Any block, module or service is loaded (filtered by Affects) |
| parameters.md | Value and variable of each parameter | A loaded file names a parameter in bold |
| nfr.md | Non-functional requirements | A task on a surface or a service (filtered by Scope) |
| out-of-scope.md | What the product does not do | Something new is defined |
| domain/index.md | One entity per line, with its tables | You need to find an entity |
| domain/glossary.md | Domain terms | Any block is loaded |
| domain/{entity}.md | Attributes, relationships, removal, states and transitions | A loaded block names it in entities |
| domain/invariants.md | Rules that always hold | One of its entities is touched |
| architecture/services.md | Services, modules and interactions | You need to find where the code goes |
| architecture/integration.md | Persistence, communication and external integrations | The task uses the database, a channel or an external system |
| architecture/auth.md | Credentials, their use and the roles | The task authenticates or authorizes |
| architecture/guarantees.md | How each rule that always holds is kept | A rule, an invariant or a module is touched |
| architecture/testing.md | How each entry point is tested end to end: test identities and replaced external systems | Something is implemented (always when a requirement closes) |
| ../apis/ | Contracts of each service (OpenAPI, AsyncAPI) | The task exposes or consumes an operation |
| ../db-schemas/ | Database schema of each service | The task touches tables |
| ../flows/index.md | Flows between modules and services | The task crosses modules or depends on a guarantee |
