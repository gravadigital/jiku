---
entity: Configuración del sistema
tables: [system_settings]
describes: Valor de configuración del negocio editable en caliente, sin redespliegue, identificado por una clave
---

# Configuración del sistema

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| clave | texto | sí | única; hasta 255 caracteres; claves que el código lee: hours_per_day (publicada como hours-per-day), upload-url-ttl-seconds, download-url-ttl-seconds, file-max-size-bytes, file-allowed-extensions, file-allowed-mime-types, notification-dispatch-interval-seconds, notification-batch-size, notification-max-attempts | no | initial |
| valor | texto | sí | el valor como texto (números, o listas separadas por comas) | no | initial |

## Relationships
- Ninguna.

## Removal
El producto no crea, edita ni elimina configuraciones: se cargan directamente en la base. Sin fila, el código usa su valor por omisión, salvo hours_per_day, cuya falta hace fallar su lectura.
