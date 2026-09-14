# Auth-callout: política de acceso al bus

Este directorio es **la política de autorización del bus**: qué puede publicar y escuchar cada
identidad que se conecta a NATS. Está versionado a propósito — es una decisión de producto, no un
secreto (los secretos viven en `../creds/`, fuera de git).

El auth-callout **no vive en este repositorio**: se consume como imagen publicada
(`gravadigital/nats-zitadel-auth-callout`) y lee estos archivos montados por path al arrancar.

> **Todo cambio acá es un cambio de seguridad** ([ADR-007](../../../docs/adrs/ADR-007-identidad-zitadel-auth-callout.md)):
> es lo que define quién puede escribir en el producto. Revisalo como tal.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `rules.yaml` | Rol de Zitadel → plantilla. Se evalúa en orden, gana la primera coincidencia. |
| `templates/connector.yaml` | La api y cualquier servicio externo (`internal-app`). |
| `templates/core.yaml` | El servicio `core`. |
| `templates/person-internal.yaml` | Personas con rol `admin` o `user`. |
| `templates/person-external.yaml` | Personas con rol `external-user`. |

## Cómo se evalúa

Se recorren las reglas **en orden** y gana la **primera** cuyo `match` coincida con algún rol del
token. **Sin coincidencia, la conexión se rechaza**: no hay catch-all ni permisos por defecto.

Una regla son dos campos: `match` (el rol) y `template` (los permisos). Nada más.

**El orden importa y no es alfabético.** Las reglas de servicio van arriba de las de persona: un
machine user al que alguien le asignó `admin` por error tiene que caer en la regla de servicio, que
es la que tiene el permiso correcto para lo que ese usuario hace. Si reordenás el archivo "para
agrupar", rompés esto sin enterarte.

## La gramática de los subjects

```
<instance>.<user-id>.<svc>.<version>.<method>

  instance   despliegue (dev / prod)
  user-id    QUIÉN llama: el `sub` del token de Zitadel, crudo
  svc        A QUIÉN le habla: `jiku-commands` (escrituras) o `jiku-queries` (lecturas)
  version    versión del protocolo: v1
  method     clients.new, requirements.{id}.edit, ...

  ej: dev.323332022539911171.jiku-commands.v1.requirements.new
```

El plano de **eventos** no sigue esta gramática: es `<instance>.events.v1.<tipo>`, sin user id,
porque un evento es *sobre* algo y no lo publica nadie en nombre de nadie. El evento de
autenticación del callout es `<instance>.events.auth` — tres segmentos, sin versión, otro
publicador y otra semántica.

### Placeholders

| Placeholder | Qué expande |
| --- | --- |
| `{{instance}}` | La instancia del despliegue |
| `{{user_id}}` | El `sub` del token, crudo (guion **bajo**) |
| `{{user_id_hash}}` | Hash estable del user id — solo para el prefijo de inbox |

**El comodín va al final del prefijo de servicio, nunca un segmento más arriba.**
`{{instance}}.{{user_id}}.jiku-commands.v1.>` está bien; `{{instance}}.{{user_id}}.>` da todos los
servicios del bus, presentes y futuros. Es el error de un carácter que más cuesta ver en revisión.

## Quién puede qué

| Rol | Plantilla | Comandos | Consultas | Eventos |
| --- | --- | --- | --- | --- |
| `internal-app` | `connector` | prefijo completo | prefijo completo | consume `JIKU_EVENTS` |
| `core` | `core` | *atiende* los dos planos | *atiende* | publica |
| `admin` / `user` | `person-internal` | prefijo completo, recortado por core | prefijo completo | — |
| `external-user` | `person-external` | **ninguno** | prefijo completo | — |

**La plantilla es el transporte; el recorte fino es de `core`.** La plantilla abre el prefijo de
comandos entero: qué método puede ejecutar cada rol lo decide el mapa rol → método de
[`core/src/authorize-caller.ts`](../../../core/src/authorize-caller.ts), que enumera una lista
distinta para `admin` que para `user`. **Un rol nuevo con acceso al bus se declara en los dos
lugares.**

### `external-user` no escribe, y hay dos capas independientes que lo garantizan

Cada una alcanza por sí sola:

1. `person-external.yaml` no le da permiso de publicación sobre el prefijo de comandos → el
   servidor NATS le rechaza la publicación con una violación de permisos, en el momento.
2. El mapa de core tiene `commands: []` para `external-user` → si ese permiso existiera por un
   error de plantilla, core responde `caller_not_authorized`.

Tener las plantillas partidas —en vez de una compartida más ancha— es lo que mantiene las dos
defensas independientes.

**Sus 6 `envelopeCommands` no son una excepción.** En el mapa de core `external-user` tiene seis
comandos por el canal del *sobre*, pero ese canal no sale de su conexión: el sobre `actor` solo lo
puede declarar el publicador de confianza ([`core/src/bus/actor.ts`](../../../core/src/bus/actor.ts)),
o sea la api. Son los comandos que la api publica **por** la persona cuando entra por HTTP al
portal.

### Verificación manual, ante cualquier cambio de plantillas o reglas

1. Token `user` publicando un comando que su mapa permite → **aceptado**, core lo ejecuta.
2. Token `external-user` intentando publicar cualquier comando → **violación de permisos**, en el
   acto, en el servidor NATS.
3. `commands: []` sigue estando para `external-user` en `authorize-caller.ts`.

## El permiso de JetStream va acotado al stream

`$JS.API.>` **no se usa en ninguna plantilla, y no debe volver.** Es un subject *global a la
cuenta*: no está acotado ni a la identidad ni al stream, y concede administración completa de
JetStream — `STREAM.DELETE.JIKU_EVENTS` (borrar el stream de eventos), `STREAM.PURGE` (vaciarlo),
`STREAM.UPDATE` (cambiarle retención o subjects), y lo mismo sobre cualquier otro stream de la
cuenta.

Un conector es un **lector** del stream. `connector.yaml` enumera solo lo que un consumidor durable
usa, acotado a `JIKU_EVENTS`:

| Subject | Para qué |
| --- | --- |
| `$JS.API.INFO` | `jetstreamManager()` — el único que no nombra un stream |
| `$JS.API.CONSUMER.CREATE.JIKU_EVENTS.>` | Crear el durable (el cliente usa una de tres formas) |
| `$JS.API.CONSUMER.DURABLE.CREATE.JIKU_EVENTS.>` | Idem, forma legacy |
| `$JS.API.CONSUMER.INFO.JIKU_EVENTS.>` | `consumers.get()` |
| `$JS.API.CONSUMER.MSG.NEXT.JIKU_EVENTS.>` | El pull de mensajes |

Ninguno lleva `{{instance}}`: son subjects globales a la cuenta y prefijarlos rompe el protocolo
igual que omitirlos. Lo que los acota es el nombre del stream, que es el mismo en todas las
instancias porque cada despliegue tiene su propia cuenta NATS.

**`core` no tiene ningún permiso de `$JS.API`, y no lo necesita.** `js.publish()` es un `request`
al subject del evento y el `PubAck` vuelve por el inbox del publicador — las dos líneas que `core`
ya tiene son todo lo que un publicador necesita. Si algún día `core` además *consume*, lo que hay
que agregar son los subjects acotados de la tabla, no el comodín.

## El wildcard de eventos lleva la versión, siempre

`{{instance}}.events.v1.>` — **nunca** `{{instance}}.events.>`, que se come
`{{instance}}.events.auth`, el evento de autenticación del callout: otro publicador, otra
semántica, y un consumidor empezaría a recibirlo sin que nadie se lo haya pedido.

Que el permiso sea por *versión del contrato* y no por tipo de evento es la excepción declarada a
la política de subjects literales (D-8 de REQ-014 / ADR-008): todos los consumidores de este plano
son internos, sin corte por visibilidad. Una `v2` sí costaría su propia línea.

Hay un test que lo hace cumplir:
[`core/tests/bus/events-structure.test.ts`](../../../core/tests/bus/events-structure.test.ts).

## El inbox, y el error más caro de diagnosticar

Las respuestas vuelven por `_INBOX.{{user_id_hash}}.>`, que es el único inbox que las plantillas
autorizan. Va en `sub.allow`, no en `pub.allow`: un cliente *se suscribe* a su propio inbox.

**El cliente DEBE fijar `inboxPrefix` al conectar.** Si no lo hace, la librería genera un
`_INBOX.<aleatorio>` que ningún permiso autoriza y las respuestas nunca llegan. **El síntoma es un
timeout, no un error de permisos**, lo que manda a buscar el problema al lugar equivocado. La api
lo deriva de la key de su service user con `inboxPrefix()` (`packages/nats-protocol`).

Para saber qué hash le toca a un usuario: `go run ./cmd/session <sub>` en el repo del auth-callout.

## Los modos de fallo de un permiso que falta

**Una violación de permisos de suscripción es asíncrona.** No falla la llamada a `subscribe()` —
que resuelve bien, y hasta alcanza a imprimir su línea de log. Sale en el log del **servidor NATS**
(`Subscription Violation ... Subject ...`), y con el cliente nats.js actual llega como
`uncaughtException` y **tira el proceso**.

O sea: el síntoma de un `sub.allow` incompleto es **el servicio reiniciando en loop**, no un error
claro. Medido en S-016. Si ves ese loop, revisá los permisos antes que el código.

Lo mismo del lado de la publicación: `js.publish()` no falla localmente, la violación sale como
`Publish Violation` en el log del servidor.

Dos ausencias que fallan **en silencio**, sin loop y sin error:

- **Sin `$SRV.>`** (solo lo tiene `core`): los servicios levantan, atienden requests y son
  invisibles para `nats micro ls`. Se pierde la observabilidad, nada más.
- **Sin el permiso de eventos**: el conector arranca, pide su durable y no le llega nada.

## Habilitar un conector nuevo

1. Crear un **machine user** en Zitadel con **Access Token Type = JWT** (el `Bearer` por defecto
   emite tokens opacos que el callout rechaza).
2. Asignarle el rol **`internal-app`** en `GESTION_ZITADEL_PROJECT_ID`.
3. Darle una JSON key y entregársela al servicio.

**Nada de este directorio hay que tocar**: la regla y la plantilla ya están versionadas.

**Mirá el tamaño de lo que concede.** `internal-app` es el permiso más ancho del producto: los dos
planos completos, `commands: ALL` y `queries: ALL` en el mapa de core, y la clase de caller
`connector`, que **no recorta ninguna fila** en las consultas — ve todos los proyectos, todos los
requerimientos y todas las horas. **Un conector con permiso acotado es un rol nuevo**, con su
plantilla y su entrada en ese mapa; no es una variante de este.

## Roles que estuvieron acá y ya no

| Rol | Por qué se fue |
| --- | --- |
| `external-publisher` | Enumeraba 9 subjects de escritura con plantilla propia, para un canal que nunca se usó. **Nunca existió en Zitadel.** Un servicio externo hoy lleva `internal-app`. |
| `bus-observer` | Diagnóstico local: escuchaba todo sin publicar, incluido `_INBOX.>` entero —las respuestas de *todos*—, lo que lo hacía inadecuado fuera de una máquina de desarrollo. Ya no se usaba. Para mirar el bus en local está [`deploy/bus-inspect.sh`](../../bus-inspect.sh). |

También desapareció `api.yaml`: la api no es un caso especial del bus, es el primer conector, y usa
`connector.yaml` como cualquier otro.

### Los campos `type` y `service` de `rules.yaml`

Se eliminaron. `type` declaraba si la identidad era persona o servicio; `service` nombraba el
endpoint que el usuario atendía, para expandir un placeholder `{{service}}`. Ninguno de los dos
hacía nada observable: las plantillas que necesitan dos prefijos de servicio los enumeran
literalmente, y las de persona nunca declararon endpoint. Era configuración que había que mantener
sincronizada a mano sin que nada dependiera de ella.

**`core` es el único que recibe requests por el bus** — el único con `sub.allow` sobre un prefijo
de servicio. Todos los demás solo emiten y escuchan su propio inbox, y por eso sus plantillas
llevan `response.max: 0`.
