---
prefix: ACC
name: Ingreso y sesión
surfaces: [Gestor interno, Portal de clientes]
covers: Ingreso por el proveedor de identidad en el gestor y en el portal, quién entra a cada superficie, presentación de la identidad, duración y cierre de la sesión, autenticación de la api y espejo del usuario
entities: [Usuario]
last_requirement: ACC-19
last_failure: ACC-E7
---

# ACC — Ingreso y sesión

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| ACC-01 | En el gestor interno, la pantalla de ingreso muestra «Bienvenido», «Gestión de proyectos, requisitos y horas del equipo. Entrá con tu cuenta para ver lo que tenés asignado.» y el botón «Iniciar sesión», que lleva al proveedor de identidad. Al volver, el gestor presenta la identidad ante la api y abre «Proyectos» | U-01, U-02 | initial |
| ACC-02 | En el portal de clientes, la pantalla de ingreso muestra «¡Bienvenido a OPUS!», «Seguí el avance de tu proyecto y conocé el estado de cada tarea al instante.» y el botón «Iniciar sesión» («Cargando...» mientras redirige), que lleva al proveedor de identidad. Al volver, el portal presenta la identidad ante la api y abre la lista de proyectos | U-03, U-02 | initial |
| ACC-03 | Los dos frontends ingresan con el flujo de código de autorización con PKCE contra el proveedor de identidad, pidiendo los roles del proyecto. Los roles de la sesión son las claves del claim de roles del proyecto que trae el token de identidad; el id de la persona es el `sub` del proveedor | — | initial |
| ACC-04 | La presentación de la identidad ante la api no registra nada: responde 200 con un cuerpo vacío a cualquier identidad autenticada | — | initial |
| ACC-05 | En el gestor interno, sin sesión cualquier pantalla redirige a la pantalla de ingreso; con sesión, la pantalla de ingreso redirige al inicio, y el inicio abre «Proyectos» | U-01, U-02 | initial |
| ACC-06 | El gestor interno deja entrar a cualquier identidad autenticada que no tenga el rol `external-user`, aunque no tenga ningún rol del proyecto. Los permisos por rol dentro del gestor los decide la api en cada operación | U-01, U-02 | initial |
| ACC-07 | En el gestor interno, una identidad con el rol `external-user`, sola o junto a otros roles, es enviada a «Acceso no autorizado»: «Tu cuenta no tiene permisos para acceder a esta aplicación.», con el botón «Cerrar sesión» | U-03 | initial |
| ACC-08 | El portal de clientes no corta por rol: deja entrar a cualquier identidad autenticada, también a las del equipo interno. Lo que cada una ve lo decide la api por rol y por permiso de proyecto | U-03, U-02, U-01 | initial |
| ACC-09 | En el portal, la sesión es válida mientras tenga un usuario identificado y su token de acceso no haya vencido; sin sesión válida cualquier pantalla redirige al ingreso, y con sesión válida el ingreso redirige al inicio, que abre la lista de proyectos | U-03, U-02 | initial |
| ACC-10 | La sesión del gestor interno dura como máximo 12 horas y termina antes si vence el token de acceso. No se renueva: al terminar hay que volver a ingresar | U-01, U-02 | initial |
| ACC-11 | La sesión del portal termina cuando vence el token de acceso. No se renueva: al terminar hay que volver a ingresar | U-03, U-02 | initial |
| ACC-12 | El portal muestra en la barra lateral las iniciales, el nombre y el email de la identidad, tomados del token de identidad o, si faltan, de la información de usuario del proveedor. El gestor interno no muestra la identidad | U-03, U-02 | initial |
| ACC-13 | «Cerrar sesión» (barra lateral del gestor, barra lateral del portal, «Acceso no autorizado» y portal sin proyectos) borra solo la sesión de la aplicación y vuelve al ingreso; la sesión en el proveedor de identidad queda abierta | U-01, U-02, U-03 | initial |
| ACC-14 | La barra lateral del gestor ofrece Actores, Proyectos, Requisitos (Reporte), Tareas (Por proyecto, Por responsable), Asignación de Tiempo, Horas Trabajadas (Carga, Visualización) y, solo si el módulo de documentación está instalado, Documentación; debajo, un bloque opcional de links externos definido por configuración | U-01, U-02 | initial |
| ACC-15 | La api exige un token de acceso como `Authorization: Bearer` en toda operación, salvo la lectura de documentos compartidos por link | — | initial |
| ACC-16 | La api valida la firma del token contra las claves públicas del proveedor de identidad, que el emisor sea el de la instancia configurada y que la audiencia incluya el proyecto del producto, en todo token, de persona o de máquina. Toma los roles solo del claim de roles de ese proyecto (sin ese claim, la identidad queda sin roles) y arma la identidad (id, nombre, usuario, email) solo con el token, sin consultar la base. Ante una clave desconocida vuelve a descargar las claves del proveedor antes de rechazar | — | #626 |
| ACC-17 | En los dos frontends, la sesión que la aplicación entrega al navegador incluye el token de acceso de la persona | — | initial |
| ACC-18 | Cada vez que una identidad se autentica en el bus, core crea o actualiza su usuario con el id del proveedor, nombre, usuario, email, roles y tipo (persona o servicio), reemplazando todos esos datos. Las identidades con rol `internal-app`, `core` o `docs` quedan como servicio y pueden no tener email | — | initial |
| ACC-19 | Cuando la api publica un comando en nombre de una persona, core crea o actualiza el usuario de esa persona con los datos del token: los roles siempre; nombre, usuario y email solo si vienen; al crearlo, lo que falte se completa con el email o, sin email, con el id. Una persona sin usuario guardado opera igual desde su primera pantalla | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| ACC-E1 | Operación de la api sin token, o con un token mal firmado, vencido, firmado con una clave que el proveedor no publica, de otro emisor o sin la audiencia del proyecto | 401 `unauthorized` «Unauthorized», sin decir el motivo; el log de la api registra el motivo | #626 |
| ACC-E2 | Operación de la api que chequea rol, llamada sin ninguno de los roles que admite | 403 `access_denied` «Access denied» | initial |
| ACC-E3 | La presentación de la identidad ante la api falla | Se ignora: el ingreso sigue y abre el inicio | initial |
| ACC-E4 | Pantalla del gestor o del portal pedida sin sesión, o con la sesión terminada | Redirige a la pantalla de ingreso | initial |
| ACC-E5 | La api rechaza con 401 una operación del gestor mientras la sesión sigue vigente | No redirige al ingreso: la pantalla muestra el error de la operación | initial |
| ACC-E6 | Comando publicado en nombre de una persona cuyos roles del token no autorizan ese comando (por ejemplo, sin roles) | 403 `caller_not_authorized` «El caller no está autorizado a ejecutar este método» | initial |
| ACC-E7 | La api arranca sin el emisor esperado o sin el id del proyecto configurados | No arranca, y el error nombra la variable que falta | #626 |
