---
prefix: CON
name: Conectores por el bus
surfaces: []
covers: Lo que un conector externo y las personas con acceso al bus pueden hacer publicando directo comandos y consultas, cómo core identifica y autoriza a quien publica, el sobre de identidad del publicador de confianza, los eventos de dominio y el espacio de datos propio del conector
entities: [Usuario, Permiso de proyecto]
last_requirement: CON-20
last_failure: CON-E15
---

# CON — Conectores por el bus

## Requirements
| ID | Requirement | Actor | Origin |
|---|---|---|---|
| CON-01 | Un conector es una identidad de máquina del proveedor de identidad con el rol `internal-app`. Se conecta al bus presentando un token del proveedor, y el bus le da los permisos de la primera regla de rol que coincide, en este orden: `docs`, `internal-app`, `core`, `admin`, `user`, `external-user`. Una identidad sin ninguno de esos roles no se conecta | U-04 | initial |
| CON-02 | Cada publicación lleva la identidad de quien publica como segundo segmento del subject, y el bus solo deja publicar bajo la identidad propia: core toma a ese segmento como el caller | U-04 | initial |
| CON-03 | El rol `internal-app` autoriza todos los comandos y todas las consultas de core, incluidos los que se agreguen después | U-04 | initial |
| CON-04 | Al recibir un comando o una consulta directa, core lee en ese momento los roles guardados del usuario que publica, sin cache; la autorización es la unión de sus roles: alcanza con que uno autorice el método. Un rol desconocido no autoriza nada | — | initial |
| CON-05 | Las personas también pueden publicar directo en el bus con su identidad: `user` publica los 20 comandos del equipo (clientes, proyectos, tareas, requisitos, comentarios, adjuntos, archivos, horas y ausencias), `admin` además la asignación semanal, y `external-user` solo consultas, ningún comando | U-01, U-02, U-03 | initial |
| CON-06 | Cada caller tiene una clase según sus roles: `internal-app` es conector, `admin` y `user` son internos, `external-user` es externo; con varios roles gana la clase más restrictiva (externo, después interno, después conector) | — | initial |
| CON-07 | En un comando directo, la autoría (creador, autor, editor, quien sube el archivo) es siempre el caller del subject; lo que el cuerpo declare se ignora | U-04 | initial |
| CON-08 | Solo el publicador de confianza (la api) puede agregar a un comando el sobre de identidad con id, roles y, opcionales, nombre, usuario y email de la persona en cuyo nombre publica. Con sobre, los roles que deciden son los del sobre, y el creador, autor, editor o quien sube que traiga el cuerpo tiene que ser el id del sobre | — | initial |
| CON-09 | Con sobre, `user` alcanza además la suscripción de un usuario a un requisito, y `external-user` alcanza solo seis comandos: crear requisito, comentar requisito, suscribir y desuscribir a un requisito, pedir subida de archivo y pedir descarga de archivo | U-02, U-03 | initial |
| CON-10 | El publicador de confianza sin sobre pasa sin consultar la base y se trata como conector | — | initial |
| CON-11 | Un comando de un caller externo se ejecuta solo si el usuario tiene permiso sobre el proyecto de la entidad que toca (el requisito, el proyecto del alta, o el proyecto de alguna entidad a la que el archivo o el adjunto está vinculado; un archivo sin vínculos, solo si lo subió él) | U-03 | initial |
| CON-12 | Toda identidad con rol `admin`, `user`, `external-user` o `internal-app` puede usar las 23 consultas de core. Un caller externo ve solo filas de proyectos sobre los que tiene permiso y, en requisitos, tareas, comentarios y actividad, solo lo público; horas trabajadas, ausencias, asignación semanal y configuración le devuelven vacío. Los callers internos y los conectores ven todo | U-01, U-02, U-03, U-04 | initial |
| CON-13 | Las consultas de lista aceptan filtro, orden, campos, relaciones a incluir, conteo y paginación por cursor; traen 50 por página por defecto y como máximo 200, y un límite mayor se recorta sin error. Las de detalle reciben el id en el cuerpo; un id inexistente y uno no visible responden igual. Una consulta describe los recursos, campos y filtros disponibles | U-04 | initial |
| CON-14 | Solo un conector puede pedir los roles y el tipo de identidad (persona o servicio) de los usuarios | U-04 | initial |
| CON-15 | Después de confirmar un comando, core publica sus eventos de dominio (16 tipos, de requisitos y de tareas) en el flujo de eventos del bus, que los guarda 7 días; un conector puede crear consumidores y leerlos. Si la publicación de un evento falla, el comando queda hecho y la falla solo se registra | U-04 | initial |
| CON-16 | Un conector tiene un espacio de datos clave/valor propio en el bus, limitado a las claves bajo su instancia y su identidad; además puede leer el registro de módulos instalados y consultar si un servicio responde | U-04 | initial |
| CON-17 | Un conector puede publicar comandos y consultas del módulo de documentación; las reglas de ese módulo las aplica el módulo | U-04 | initial |
| CON-18 | La titularidad de horas y ausencias se evalúa con la identidad del caller: un conector sin rol `admin` solo carga o borra horas y ausencias de la persona vinculada a su propia identidad | U-04 | initial |
| CON-19 | Una acción publicada directo, sin sobre, no excluye a su autor de los destinatarios de las notificaciones que genera | — | initial |
| CON-20 | Los comandos no son idempotentes: repetir un comando lo ejecuta de nuevo. Toda falla se responde con estado `failure`, un `errorCode`, un `errorMessage` y, cuando aplica, `errorDetails` | — | initial |

## Failure conditions
| ID | Condition | Result | Origin |
|---|---|---|---|
| CON-E1 | Publicar con una identidad ajena en el subject, o un método que la plantilla del rol no permite (por ejemplo, un comando con rol `external-user`) | El bus rechaza la publicación por permisos; no llega a core | initial |
| CON-E2 | Comando o consulta de un caller sin usuario guardado, o cuyos roles no autorizan el método | `caller_not_authorized` «El caller no está autorizado a ejecutar este método» | initial |
| CON-E3 | Consulta de un caller cuyos roles no tienen clase (incluido el publicador de confianza sin usuario guardado) | `unknown_caller` «No se pudo resolver la identidad del caller» | initial |
| CON-E4 | Comando con sobre de identidad publicado por alguien que no es el publicador de confianza | `invalid_fields` «El campo `actor` solo lo puede declarar el publicador de confianza» | initial |
| CON-E5 | Sobre sin id, o con roles que no son una lista | `invalid_fields` «El sobre `actor` tiene que declarar un `id` no vacío» / «El sobre `actor` tiene que declarar `roles` como lista» | initial |
| CON-E6 | Creador, autor, editor o quien sube distinto del id del sobre | `invalid_fields` «El campo `{campo}` no coincide con el actor declarado en el sobre» | initial |
| CON-E7 | Cuerpo que no es JSON válido | `invalid_fields` «Malformed JSON payload» | initial |
| CON-E8 | Método inexistente | `unknown_command` «Unknown command: {método}» / «Unknown query: {método}» | initial |
| CON-E9 | Caller externo sin permiso sobre el proyecto de la entidad | `access_denied` «No tenés permiso sobre esta entidad» | initial |
| CON-E10 | Conector sin rol `admin` que carga o borra horas o ausencias de otra persona | `access_denied` «Solo podés cargar tus propias horas» / «Solo podés eliminar tus propios registros» / «Solo podés cargar tus propias ausencias» | initial |
| CON-E11 | Consulta con un cursor que no salió de la respuesta anterior con el mismo filtro y orden | `invalid_cursor` «El cursor no es válido para esta consulta: se obtiene de la respuesta anterior y hay que reusarlo con el mismo filtro y el mismo orden» | initial |
| CON-E12 | Consulta que la base cancela por tardar demasiado | `query_timeout` «La consulta tardó demasiado y la base la canceló. Acotá el filtro o pedí menos items por página» | initial |
| CON-E13 | Consulta con un campo, filtro, orden o relación que no existe o que la clase del caller no tiene | `invalid_fields` con los nombres permitidos en `errorDetails.allowed` | initial |
| CON-E14 | No se pueden leer los roles del caller (por ejemplo, la base no responde) | `internal_error` «Internal error»: el método no se ejecuta | initial |
| CON-E15 | Falla inesperada al ejecutar un comando o una consulta (por ejemplo, la base rechaza una escritura): la transacción se deshace | `internal_error` «Internal error»: el método no tiene efecto | initial |
