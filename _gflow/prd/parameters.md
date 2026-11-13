# Parámetros

| Parámetro | Valor | Variable | Origen |
|---|---|---|---|
| ventana de carga de horas | 10 días previos al actual (más el actual), en UTC | — | inicial |
| tope diario de minutos | 1440 minutos por persona y día | — | inicial |
| plazo de borrado de ausencias | 10 días desde el registro de la ausencia | — | inicial |
| horas por día | 6 horas | `system_settings.hours_per_day` | inicial |
| días hábiles de carga | 8 días hábiles hacia atrás desde hoy | — | inicial |
| vigencia de destinos cerrados | 7 días desde la resolución o la finalización | — | inicial |
| días de aviso de vencimiento | 4 días hábiles | — | inicial |
| tamaño máximo de archivo | 10 MiB (10485760 bytes) | `system_settings.file-max-size-bytes` | inicial |
| extensiones permitidas | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.txt`, `.csv` | `system_settings.file-allowed-extensions` | inicial |
| tipos MIME permitidos | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`, `text/csv` | `system_settings.file-allowed-mime-types` | inicial |
| vida de la URL de subida | 300 segundos | `system_settings.upload-url-ttl-seconds` | inicial |
| vida de la URL de descarga | 300 segundos | `system_settings.download-url-ttl-seconds` | inicial |
| archivos por entidad | 10 archivos por pedido | — | inicial |
| intervalo de envío de notificaciones | 60 segundos | `system_settings.notification-dispatch-interval-seconds` | inicial |
| lote de envío de notificaciones | 50 notificaciones por ciclo | `system_settings.notification-batch-size` | inicial |
| intentos de envío de notificaciones | 5 intentos | `system_settings.notification-max-attempts` | inicial |
| backoff de notificaciones | 60 × 2^intentos previos segundos, con tope de 1 día | — | inicial |
| límite de página por defecto | 50 filas | — | inicial |
| límite de página máximo | 200 filas | — | inicial |
| tiempo máximo de consulta | 8000 ms | `POSTGRESQL_STATEMENT_TIMEOUT_MS=8000` | inicial |
| tiempo de espera de comandos | 5000 ms | `NATS_REQUEST_TIMEOUT_MS=5000` | inicial |
| retención de eventos | 7 días | — | inicial |
| vida de la sesión de gestión | 12 horas | — | inicial |
| tamaño de página del portal | 20 requisitos por estado | — | inicial |
| intervalo de chequeo de módulos | 30 segundos | — | inicial |
| duración de la reserva de edición | Entre 30 y 300 segundos (si no se indica, la que fija el módulo) | — | inicial |
| vencimientos de links compartidos | Un instante futuro, como máximo a 180 días (lo valida jiku-docs); la pantalla de Gestión interna ofrece 7, 15, 30 (por defecto), 90 o 180 días | — | inicial |
| límite de pedidos de links públicos | 60 pedidos por minuto por dirección IP, por réplica de la api | — | inicial |
