# Glosario

| Término | Definición | Origen |
|---|---|---|
| Actor (en pantalla) | Nombre que Gestión interna le da al Cliente (la entidad): menú «Actores», «Nuevo actor». No es un actor del producto | inicial |
| Sobre actor | Datos de la persona del token (id, roles, nombre, usuario, email) que la api agrega a cada comando; core autoriza con esos roles y actualiza con ellos el espejo de identidades | inicial |
| Publicador de confianza | La identidad del bus de la api: la única que puede mandar el sobre actor; si publica sin sobre, core no le aplica la compuerta de rol | inicial |
| Clase de caller | Clasificación de quien publica en el bus según su rol: `connector` (`internal-app`), `internal` (`admin`, `user`) o `external` (`external-user`); con varios roles gana `external`, después `internal` | inicial |
| Conector | Sistema externo que opera directo sobre el bus con una identidad de servicio de rol `internal-app`: consulta, ejecuta comandos, lee eventos y tiene su espacio clave-valor | inicial |
| Identidad de servicio | Identidad del bus que no es una persona (roles `internal-app`, `core`, `docs`); lo que crea se marca «Automático» | inicial |
| Espejo de identidades | Copia en el producto de cada identidad que se conecta al bus (id = sub de Zitadel, nombre, usuario, email, roles, tipo); es lo que permite resolver nombres, autores y la clase de caller | inicial |
| Permiso de proyecto (dar acceso) | Que un usuario tenga una fila de permiso sobre un proyecto: es lo único que habilita a un Cliente a ver y operar ese proyecto, y la condición para recibir notificaciones | inicial |
| Recorte externo | Filtro que core aplica a toda consulta de un Cliente: solo filas de proyectos con permiso de proyecto y solo contenido público; en algunos recursos, nada | inicial |
| Visibilidad pública / interna | Marca de requisitos, tareas, comentarios y actividad: lo público llega al Portal de clientes y a las consultas de un Cliente; lo interno, solo al equipo | inicial |
| Módulo opcional | Servicio externo que extiende el producto por el bus y se anuncia en el registro de módulos (hoy, solo la documentación); el producto funciona sin él | inicial |
| Link público | Link compartido de un documento (`/p/docs/{token}`) que cualquiera abre sin autenticarse hasta que vence o se revoca, solo en el host público configurado | inicial |
| Ticket de subida | Respuesta a un pedido de subida: el id del archivo y una URL firmada a la que el navegador sube los bytes directo al almacenamiento | inicial |
| Archivo pendiente | Archivo registrado al pedir la subida que todavía no se vinculó a ninguna entidad | inicial |
| Vínculo (adjunto) | Relación entre un archivo y una entidad (proyecto, requisito, tarea o comentario); desvincular no borra el archivo | inicial |
| Líder | El primer responsable de un requisito o de una tarea | inicial |
| Incidencia | Requisito de tipo `incidencia`: el único al que resolver le exige tipo de resolución y conclusión | inicial |
| Tipo de resolución | Clasificación del cierre de un requisito (`error_interno`, `fuera_de_alcance`, `error_externo`, `discutible`, `otro`); distinto del tipo de requisito | inicial |
| Nota para el cliente | El comentario de resolución de un requisito: el portal lo muestra en el bloque «Resolución» y va en el mail de requisito resuelto | inicial |
| Reabrir | Sacar un requisito de `resuelto` hacia un estado que no es `cancelado` | inicial |
| Fechas de etapa | Fechas que un requisito registra al entrar a `planificacion`, `desarrollo`, `revision` y `resuelto` | inicial |
| Etiqueta | Par clave-valor libre de un requisito; se filtra como `clave:valor` | inicial |
| Propiedad de proyecto | Una de las cuatro claves fijas de un proyecto (`documentacion`, `diseño`, `board_de_tareas`, `mattermost_group_name`) | inicial |
| Destino de horas | A qué se imputan horas trabajadas: un proyecto, un requisito del proyecto o una tarea | inicial |
| Persona efectiva | La persona sobre la que opera la pantalla de carga de horas: la elegida por un `admin`, o la del propio usuario | inicial |
| Semana de asignación | Lunes a viernes, identificada por la fecha de su lunes | inicial |
| Capacidad semanal | Horas que una persona puede asignar en una semana: las horas por día por 5 | inicial |
| Sobreasignación | Una persona con más del 100 % de su capacidad semanal asignado | inicial |
| Semana pasada | Semana cuyo lunes es anterior al lunes de la semana actual, contado en UTC | inicial |
| Ausencia (en reportes) | Pseudo-proyecto «Ausencia» (código `AUS`) con que el reporte de horas por persona muestra las ausencias | inicial |
| Evento de dominio | Mensaje que core publica en el stream de eventos después de confirmar un cambio de requisito o tarea | inicial |
| Instancia | Primer segmento de todos los subjects del bus; separa instalaciones que comparten un servidor NATS | inicial |
| Reserva de edición | Bloqueo temporal de un documento a nombre de una sesión de edición; nadie más lo guarda mientras está vigente | inicial |
| Versión base | La versión de un documento sobre la que se editó; guardar sobre otra da conflicto | inicial |
| Documento restringido | Documento visible solo para la conducción (`admin`), que no se comparte por link | inicial |
