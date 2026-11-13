---
entity: Ajuste del sistema
tables: [system_settings]
describes: Valor de configuración guardado en la base (política de archivos, envío de notificaciones, horas por día)
---

# Ajuste del sistema

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| clave | texto | sí | hasta 255 caracteres, única (INV-18); claves sembradas: `hours_per_day`, `file-max-size-bytes`, `file-allowed-extensions`, `file-allowed-mime-types`, `upload-url-ttl-seconds`, `download-url-ttl-seconds`, `notification-dispatch-interval-seconds`, `notification-batch-size`, `notification-max-attempts` | no | inicial |
| valor | texto | sí | texto libre; las listas van separadas por comas | no | inicial |

## Relaciones
- Sin relaciones con otras entidades.

## Baja
Fuera del producto: las filas las siembran las migraciones; ningún comando las crea, modifica ni borra. Se leen por el bus y al validar subidas y enviar notificaciones.
