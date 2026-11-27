# Parameters

Values of business rules, cited by name in bold. In this product most of them live in the `system_settings` table, read from the database on every use (a change applies without a restart); the column says which key holds each one. A fixed constant has `—`.

| Parameter | Value | Variable | Origin |
|---|---|---|---|
| horas por día | 6 | system_settings: hours_per_day | initial |
| máximo de archivos por operación | 10 | — | initial |
| tamaño máximo de archivo | 10485760 bytes (10 MiB) | system_settings: file-max-size-bytes | initial |
| extensiones de archivo permitidas | .jpg .jpeg .png .gif .webp .svg .pdf .doc .docx .xls .xlsx .txt .csv | system_settings: file-allowed-extensions | initial |
| tipos MIME permitidos | image/jpeg, image/png, image/gif, image/webp, image/svg+xml, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/plain, text/csv | system_settings: file-allowed-mime-types | initial |
| vigencia del link de subida | 300 s | system_settings: upload-url-ttl-seconds | initial |
| vigencia del link de descarga | 300 s | system_settings: download-url-ttl-seconds | initial |
| intervalo de envío de notificaciones | 60 s | system_settings: notification-dispatch-interval-seconds | initial |
| lote de notificaciones | 50 | system_settings: notification-batch-size | initial |
| intentos máximos de notificación | 5 | system_settings: notification-max-attempts | initial |
