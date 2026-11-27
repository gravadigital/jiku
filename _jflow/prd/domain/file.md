---
entity: Archivo
tables: [files]
describes: Archivo subido al almacenamiento de objetos (S3), que existe por sí solo y se vincula a 0..N entidades mediante adjuntos
---

# Archivo

## Attributes
| Attribute | Type | Required | Constraints | Personal data | Origin |
|---|---|---|---|---|---|
| nombre del archivo | texto | sí | el nombre original; hasta 255 caracteres | no | initial |
| tamaño | número | sí | en bytes, el que declara quien sube; no puede superar el tamaño máximo configurado | no | initial |
| tipo MIME | texto | sí | hasta 100 caracteres; la extensión y el tipo MIME tienen que estar los dos en sus listas de permitidos | no | initial |
| clave de almacenamiento | texto | sí | la arma el sistema ({prefijo}/f/{uuid}{extensión}; los archivos migrados conservan una clave anterior); hasta 500 caracteres; única | no | initial |
| bucket | texto | sí | hasta 100 caracteres | no | initial |
| región | texto | sí | hasta 50 caracteres | no | initial |
| checksum | texto | no | sha256 que declara quien sube; nadie lo verifica | no | initial |
| estado del contenido | enum | sí | pending, uploaded; por omisión pending | no | initial |
| subido por | referencia | sí | a Usuario; solo quien lo subió puede vincularlo | no | initial |
| estado de retención | enum | sí | active, scheduled_for_deletion, deleted; por omisión active; ningún comando escribe otro valor que active; un archivo que no está active no se puede vincular | no | initial |
| fecha de baja | fecha y hora | no | ningún comando la escribe | no | initial |
| dado de baja por | referencia | no | a Usuario; ningún comando la escribe | no | initial |

## Relationships
- Un Archivo tiene 0..N Adjuntos; un Archivo sin adjuntos es un estado válido.
- Un Archivo lo sube 1 Usuario.

## Removal
Nunca: los archivos se conservan. Desvincular borra el Adjunto, no el Archivo. Ningún proceso limpia los archivos pendientes que nunca se vincularon ni los objetos del almacenamiento. La base rechaza borrar el Usuario que lo subió.

## States
| State | Type | Meaning | Origin |
|---|---|---|---|
| pending | initial | Se pidió la URL de subida; el contenido puede no haber llegado | initial |
| uploaded | final | Se vinculó al menos una vez; se marca sin comprobar que el objeto exista en el almacenamiento | initial |

## Transitions
| From | To | Triggered by | Origin |
|---|---|---|---|
| — | pending | ARC-01, ARC-02 | initial |
| pending | uploaded | ARC-08, ARC-10 | initial |
