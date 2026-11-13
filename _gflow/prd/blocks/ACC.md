---
prefix: ACC
name: Acceso e identidad
surfaces: [Gestión interna, Portal de clientes]
covers: Ingreso con Zitadel a las dos superficies, sesión, qué rol entra a dónde, autorización por rol y por proyecto, y el espejo de identidades del producto
entities: [Usuario, Persona]
last_requirement: ACC-17
last_failure: ACC-E10
---

# ACC — Acceso e identidad

## Requisitos
| ID | Requisito | Actor | Origen |
|---|---|---|---|
| ACC-01 | Una persona entra a Gestión interna con su cuenta de Zitadel (OIDC con PKCE, botón único «Iniciar sesión»); sin sesión, cualquier pantalla lleva al login, y con sesión el login y la raíz llevan a Proyectos | U-01, U-02 | inicial |
| ACC-02 | Una persona entra al Portal de clientes con su cuenta de Zitadel; sin sesión válida o con el access token vencido va al login; con sesión entra al tablero de su primer proyecto en orden alfabético | U-03, U-02 | inicial |
| ACC-03 | Al terminar el login, cada superficie avisa a la api que la persona se presentó; el aviso no registra nada y responde vacío, y si falla el ingreso sigue igual | U-01, U-02, U-03 | inicial |
| ACC-04 | Un Cliente que entra a Gestión interna va a la pantalla «Acceso no autorizado», que solo ofrece cerrar sesión | U-03 | inicial |
| ACC-05 | Una cuenta autenticada sin ninguno de los roles `admin`, `user` o `external-user` entra a Gestión interna igual; cada operación la rechaza la api o core según su rol | — | inicial |
| ACC-06 | La sesión de Gestión interna dura como máximo **vida de la sesión de gestión** y termina antes si vence el access token de Zitadel, sin renovación; la del Portal de clientes termina cuando vence el access token | U-01, U-02, U-03 | inicial |
| ACC-07 | Cerrar sesión, desde cualquiera de las dos superficies, cierra la sesión local y vuelve al login, sin cerrar la sesión de Zitadel | U-01, U-02, U-03 | inicial |
| ACC-08 | Toda operación HTTP del producto exige un token Bearer de Zitadel, salvo los links públicos de documentación; se verifican solo la firma (contra las claves publicadas por Zitadel) y la vigencia del token, y los roles se toman de las claves del claim de roles del proyecto | — | inicial |
| ACC-09 | Las lecturas de clientes, proyectos, resumen de tareas por proyecto, tareas (con su actividad), personas y ausencias no exigen rol: cualquier token válido, incluido el de un Cliente, las obtiene completas | — | inicial |
| ACC-10 | Toda escritura hecha desde la api se ejecuta en core en nombre de la persona del token: la api agrega el sobre actor con su id, roles, nombre, usuario y email, que pisa cualquier actor del pedido, y core autoriza con esos roles | — | inicial |
| ACC-11 | Qué comandos puede ejecutar cada rol: `admin` todos los comandos internos más el reemplazo de la asignación semanal; `user` los comandos internos y además suscribir a un requisito; `external-user` solo, y siempre a través de la api, el alta de requisito, el comentario de requisito, suscribir, desuscribir y pedir subida y descarga de archivos; `internal-app` todos; cualquier otro rol, ninguno. Desuscribir de un requisito solo lo puede un `external-user` | — | inicial |
| ACC-12 | Un Cliente solo opera sobre entidades de proyectos donde tiene permiso de proyecto: en cada comando core resuelve el proyecto de la entidad y exige el permiso; en las lecturas, rige el recorte externo | U-03 | inicial |
| ACC-13 | Un Administrador sin el rol `user` no puede listar proyectos, ver requisitos ni previsualizar adjuntos en el Portal de clientes: esas lecturas aceptan solo `user` y `external-user` | U-01 | inicial |
| ACC-14 | El producto mantiene un espejo de cada identidad que se conecta al bus (id = sub de Zitadel, nombre, usuario, email, roles y tipo persona o servicio): cada evento de autenticación del bus reemplaza esos datos, y el sobre actor de cada comando los actualiza antes de autorizarlo | — | inicial |
| ACC-15 | Una identidad es de tipo servicio cuando su rol es `internal-app`, `core` o `docs`; las dos superficies muestran lo creado por una identidad de servicio con la marca «Automático» | — | inicial |
| ACC-16 | Una persona del equipo se vincula a su cuenta por el usuario de la persona; la carga de horas y ausencias usa ese vínculo para saber quién es la persona que opera, y la autoría de comentarios y cambios se registra con el usuario | U-01, U-02 | inicial |
| ACC-17 | Las operaciones de lectura del Portal de clientes filtran por permiso de proyecto solo a los Clientes; un Miembro del equipo ve cualquier proyecto activo en el portal | U-02, U-03 | inicial |

## Condiciones de falla
| ID | Condición | Resultado | Origen |
|---|---|---|---|
| ACC-E1 | Pedido sin token, con un token que no es Bearer, con firma inválida o vencido | 401 `unauthorized` | inicial |
| ACC-E2 | El rol del token no está entre los que acepta una lectura que exige rol | 403 `access_denied` | inicial |
| ACC-E3 | Un comando cuyo método no está permitido para los roles del actor (ACC-11), o una consulta del bus de una identidad cuyo rol no habilita consultas | Reply `caller_not_authorized`; la api responde 403 `caller_not_authorized` | inicial |
| ACC-E4 | Un Cliente opera sobre una entidad de un proyecto donde no tiene permiso de proyecto, o sobre un comando sin regla de proyecto | Reply `access_denied`; la api responde 403 `access_denied` | inicial |
| ACC-E5 | El sobre actor llega de una identidad que no es el publicador de confianza, sin id, sin lista de roles, o con un creador, autor, editor o uploader distinto del actor | Reply `invalid_fields` con `errorDetails` | inicial |
| ACC-E6 | Un Cliente entra a Gestión interna | Pantalla «Acceso no autorizado» / «Tu cuenta no tiene permisos para acceder a esta aplicación.» con «Cerrar sesión» | inicial |
| ACC-E7 | Un usuario del portal sin ningún proyecto accesible | Pantalla «Todavía no tenés acceso a ningún proyecto…» con «Cerrar sesión» | inicial |
| ACC-E8 | Un cuerpo, una query o un parámetro de ruta que no cumple el esquema de la operación | 400 `invalid_fields` con el primer error | inicial |
| ACC-E9 | Un cuerpo JSON que supera el tamaño admitido | 413 `payload_too_large` | inicial |
| ACC-E10 | Error inesperado al atender una operación | 500 `internal_error` | inicial |
