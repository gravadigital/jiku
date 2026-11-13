---
entity: Archivo
tables: [files]
describes: Bytes de un archivo subido al almacenamiento de objetos, con sus metadatos; existe por su cuenta y se vincula a entidades con adjuntos
---

# Archivo

## Atributos
| Atributo | Tipo | Obligatorio | Restricciones | Dato personal | Origen |
|---|---|---|---|---|---|
| nombre | texto | sí | nombre original, hasta 255 caracteres; su extensión debe estar entre las permitidas; no participa de la clave de almacenamiento | no | inicial |
| tamaño | número | sí | bytes, mayor o igual a 1 y no mayor que el máximo configurado | no | inicial |
| tipo MIME | texto | sí | hasta 100 caracteres; debe estar entre los permitidos | no | inicial |
| clave de almacenamiento | texto | sí | `{prefijo}/f/{uuid}{extensión}`, hasta 500 caracteres, única (INV-12) | no | inicial |
| bucket | texto | sí | hasta 100 caracteres | no | inicial |
| región | texto | sí | hasta 50 caracteres | no | inicial |
| checksum | texto | no | SHA-256 declarado por el cliente, hasta 64 caracteres; no se verifica | no | inicial |
| estado de los bytes | enum | sí | `pending`, `uploaded`; default `pending` | no | inicial |
| subido por | referencia | sí | Usuario que pidió la subida | no | inicial |
| estado de retención | enum | sí | `active`, `scheduled_for_deletion`, `deleted`; default `active` | no | inicial |
| borrado en | fecha y hora | no | ningún proceso lo escribe | no | inicial |
| borrado por | referencia | no | Usuario; ningún proceso lo escribe | no | inicial |

## Relaciones
- Un Archivo fue subido por 1 Usuario.
- Un Archivo tiene 0..n Adjunto.

## Baja
Nunca: borrar un adjunto deja el archivo retenido; no hay proceso de retención ni limpieza de archivos `pending` nunca vinculados. Un archivo con adjuntos no se puede borrar.

## Estados
| Estado | Tipo | Significado | Origen |
|---|---|---|---|
| byte_status: pending | inicial | se pidió la URL de subida; los bytes no están confirmados | inicial |
| byte_status: uploaded | final | se vinculó a una entidad; se da por subido sin verificar el almacenamiento | inicial |
| retention_status: active | inicial | disponible para vincular y descargar | inicial |
| retention_status: scheduled_for_deletion | intermedio | programado para borrar; ningún proceso lo escribe | inicial |
| retention_status: deleted | final | borrado; ningún proceso lo escribe | inicial |

## Transiciones
| Desde | Hacia | Disparado por | Origen |
|---|---|---|---|
| (alta) | byte_status: pending | ADJ-01 | inicial |
| byte_status: pending | byte_status: uploaded | ADJ-03 | inicial |
| byte_status: uploaded | byte_status: uploaded | ADJ-03 | inicial |
| (alta) | retention_status: active | ADJ-01 | inicial |
