# ADR-014: JetStream para eventos de dominio

**Estado:** Aceptado (implementado)
**Fecha:** 2026-09-08 (documentado retroactivamente; la decisión y su implementación son de
REQ-014 · S-061 a S-067)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** arquitectura, mensajeria, nats, jetstream, eventos-de-dominio, integridad
**Detectado desde:** REQ-014 · S-061 a S-067

---

## Contexto

El producto permite a un cliente **suscribirse a un requisito** (`requirement_subscriptors`) desde
antes de este REQ, y esa suscripción no producía ningún efecto: registraba interés en una tabla y
ahí terminaba. No había mail, ni push, ni webhook, ni siquiera un indicador de novedades dentro de
la aplicación (FG-2 de `docs/prd/feature-groups.md`). La causa no era que faltara decidir el canal:
era que **no había ningún mecanismo por el que un cambio saliera de `core`**. Los dos planos
existentes —comandos y consultas— son ambos request/reply, sin persistencia y sin ningún tercero
suscripto: ninguno de los dos sirve para que un conector externo se entere de que algo cambió.

REQ-014 cierra ese hueco: `core` pasa a **publicar** hechos de dominio ya ocurridos —un requisito
creado, una tarea reasignada, un comentario editado— para que cualquier conector externo a Jiku los
consuma sin tener que preguntar por polling. Es el primer plano donde `core` es el **emisor** y no
el atendido, y es el primer uso de JetStream del producto: hace falta algo que **quede grabado**,
porque a diferencia de un comando o una consulta, nadie está esperando la respuesta en el momento.

## Decisión

Usar **NATS JetStream**, exclusivamente para el stream **`JIKU_EVENTS`**, sobre el subject
`{instance}.events.v1.>`. **Nada más pasa a tener JetStream**: los comandos siguen siendo
request/reply sin JetStream ([ADR-002](ADR-002-comandos-nats-sin-jetstream.md), D-3 de REQ-014), y
las consultas también. La adopción de JetStream acá **no revisa** esa decisión — son dos planos
distintos sobre la misma infraestructura de bus, y ADR-002 lo anota explícitamente.

### La gramática del subject

```
{instance}.events.{version}.{entidad}.{acción}
dev.events.v1.requirement.state.changed
```

| Segmento | Valor | Fuente |
|---|---|---|
| `instance` | `dev` / `prod` | `NATS_INSTANCE` |
| `events` | literal | — |
| `version` | `v1` | `NATS_EVENTS_VERSION` |
| `entidad` | `requirement` \| `task` | del catálogo. `task`, **nunca** `objective` — es vocabulario del contrato, no del esquema ([ADR-004](ADR-004-vocabulario-en-el-contrato.md)) |
| `acción` | `created`, `state.changed`, … | del catálogo |

**`{version}` va antes de la entidad, y no al final, a propósito:** así un `pub.allow` o un
`filter_subject` puede cubrir `dev.events.v1.requirement.>` —una versión **entera**— sin enumerar
evento por evento. El `type` del payload **es** los segmentos finales del subject:
`eventSubject(type)` en `@jiku/nats-protocol` los concatena en un único lugar, así que el subject y
`DomainEvent.type` no pueden divergir.

### El versionado es independiente del de comandos

`NATS_EVENTS_VERSION` es una variable **propia**, distinta de `NATS_PROTOCOL_VERSION` (la de
comandos y consultas). Compartirla arrastraría un `v2` de eventos a los 23 comandos que no tienen
nada que ver con el cambio. Van en variables separadas y pueden convivir en valores distintos sin
que ningún plano se entere del otro.

| Cambio | Versión |
|---|---|
| Agregar un campo opcional al payload | Sigue `v1`. El conector lo ignora |
| Agregar un evento nuevo | Sigue `v1`. Subject nuevo, nadie se rompe |
| Quitar o renombrar un campo | `v2` |
| Cambiar el tipo o la semántica de un campo | `v2` |
| Quitar un campo del `snapshot` | `v2` |

### Las tres garantías de entrega

- **At-least-once, con deduplicación del lado del conector.** `core` genera un `eventId` (ULID) por
  evento; el conector **DEBE** deduplicar por ese campo.
- **Best-effort, sin outbox.** Si el commit tiene éxito y el publish falla, el evento **se pierde**
  y se loguea a `stdout`. No hay reintento ni tabla de reconciliación. El conector no puede
  detectar un evento perdido: para él, ese evento simplemente nunca existió.
- **Retención de 7 días, con pérdida silenciosa después.** Un conector caído más de 7 días pierde
  los eventos publicados mientras estuvo caído, sin forma de saber cuáles. Es comportamiento
  declarado y esperado, no una condición de error.

**Este stream no es una fuente reconstruible de estado.** Un conector que necesite el estado
completo y actual de una entidad consulta `docs/apis/core-queries.yaml` — el stream de eventos solo
lleva lo que cambió, cuándo cambió, y solo mientras la retención lo permita.

### La ventana entre el commit y el publish

```
1. Abrir transacción
2. El comando valida y escribe
3. COMMIT                      ← el dato ya está en Postgres
4. Publicar los eventos        ← si este paso falla, el evento SE PIERDE
5. Responder el Reply
```

Publicar antes del commit **no es una alternativa**: emitiría eventos de escrituras que después
rollean, que es justo lo que evita D-1 de REQ-014 ("los eventos los publica el despachador, después
del commit. Nunca el comando").

| Regla | |
|---|---|
| **El fallo NO afecta al comando** | La escritura ya está commiteada y el `Reply` es `success`. El usuario ve su operación hecha, porque lo está |
| **El fallo NO se propaga** | El emisor nunca lanza: un error al publicar no puede convertir un comando exitoso en un 500 |
| **Se loguea a `stdout`** | Nivel error, con `eventId`, `type`, `entity.type:id`, `projectId` y la causa |
| **Un evento perdido no se repone nunca** | Sin reintento, sin barrido. El conector no puede detectarlo |

**JetStream no cierra esta ventana.** Tener un stream garantiza que un mensaje **publicado y
confirmado** no se pierda — la ventana de esta decisión está **antes** del publish, en el intervalo
entre el `COMMIT` y el intento de publicar. Confundir "hay stream" con "la emisión es durable" es el
error de lectura más común sobre esta decisión, y por eso queda dicho acá en lugar de asumido.

### Los parámetros del stream

| Parámetro | Valor |
|---|---|
| Stream | `JIKU_EVENTS` |
| Subjects | `{instance}.events.v1.>` — **con la versión**, nunca `{instance}.events.>` (se comería `{instance}.events.auth`, el evento de autenticación de `sincronizacion-de-identidades.md`) |
| Retención | `limits`, `max_age` **7 días** |
| Storage | `file` |
| Consumers | Durables, uno por conector, con su propio `filter_subject` |

Verificado contra `deploy/nats/create-events-stream.sh`, que crea y verifica el stream con estos
mismos valores (`--retention limits --max-age 7d --storage file`, subject
`$INSTANCE.events.$EVENTS_VERSION.>`).

### `docs/apis/core-events.yaml` es la fuente de verdad

Este ADR documenta retroactivamente una decisión ya tomada e implementada. Todo su contenido
técnico —la gramática, el versionado, las garantías, la ventana— está declarado primero en
`docs/apis/core-events.yaml`, escrito **antes** que el código emisor (al revés que los otros dos
contratos del servicio, que se escribieron leyendo código ya en producción). **Ante una
discrepancia entre el código y ese contrato, manda el contrato** — la misma regla que ADR-004 ya
declara para `core.yaml` y `core-queries.yaml`.

## Implementation Rules

- El subject de un evento **DEBE** armarse solo con `eventSubject(type)` de `@jiku/nats-protocol`.
  **NO SE DEBE** construirlo a mano ni concatenar segmentos en otro lugar.
- El conector **DEBE** deduplicar por `eventId`. La entrega es at-least-once y un mismo evento
  puede llegar más de una vez.
- El subject del stream y de cualquier permiso de publicación **DEBE** llevar la versión
  (`{instance}.events.v1.>`) y **NUNCA** puede ser `{instance}.events.>`: ese wildcard se comería
  `{instance}.events.auth`, que es un plano distinto sin JetStream.
- La emisión **DEBE** ocurrir después del `commit()` de la transacción del comando, nunca antes, y
  su fallo **NO DEBE** propagarse ni convertir un `Reply` exitoso en uno de error
  ([ADR-003](ADR-003-transaccion-del-despachador.md)).
- `version` en el sobre del evento **DEBE** salir de `EVENTS_VERSION` (`@jiku/nats-protocol`) y
  **NUNCA** ser un literal `'v1'` escrito a mano: un `v2` futuro no tiene que tocar el emisor.
- Ante una discrepancia entre el código y `docs/apis/core-events.yaml`, **manda el documento**.
- Un comando **NO DEBE** publicar directamente: declara eventos en `Reply.events` y es el
  despachador quien los emite ([ADR-003](ADR-003-transaccion-del-despachador.md); convención
  `bus-publisher`).

## Consecuencias

### Positivas

- **FG-2 (Notificaciones) deja de estar bloqueado por falta de mecanismo.** El bloque `recipients`
  que viaja en los eventos de requisito da a un conector el destinatario y su dirección sin
  ninguna consulta adicional.
- **Los conectores externos dejan de depender de polling.** Un cambio de dominio se entera en
  segundos, no en el intervalo del próximo `GET`.
- **El versionado independiente evita que un cambio de contrato de eventos rompa los 23 comandos**,
  y viceversa.
- **La retención de 7 días da un colchón real** contra caídas cortas de un conector, sin exigirle
  estar siempre arriba.

### Negativas

- **Un evento perdido es un evento perdido.** Sin outbox, sin reintento, sin reconciliación. El
  conector no puede detectarlo.
- **Infraestructura nueva que administrar**: un stream con su retención, sus consumers durables y
  su propio permiso de publicación por versión.
- **El `snapshot` completo en cada evento** (nunca truncado, a diferencia del contrato de lectura)
  aumenta el tamaño de cada mensaje frente a una alternativa que solo notificara el cambio.

### Riesgos

- **R-3** — *"El texto de los comentarios `internal` queda 7 días en el stream, en el mismo
  subject que los `public`"*. **Asumido** (D-8 de REQ-014: sin corte por visibilidad, los
  consumidores de este plano son todos internos). Con condición de reapertura explícita: si entra
  un consumidor no interno, el corte por visibilidad vuelve a ser necesario, y es un cambio de
  subject — o sea, **`v2`**.
- **R-6** — *"Commit OK + publish falla ⇒ evento perdido"*. **Asumido y cerrado** (D-9 de
  REQ-014). JetStream no cierra esta ventana: garantiza que un mensaje **publicado y confirmado**
  no se pierda, y la ventana de esta decisión está **antes** del publish. Revisable si aparece un
  conector que **construya estado** a partir de los eventos en vez de solo notificar — agregar un
  outbox después no cambia el contrato, los conectores no notan la diferencia.
- **R-C** — el `snapshot` con `description` completa sin truncar puede acercarse al `max_payload`
  del server NATS (1 MB por defecto) en un requisito con una descripción muy larga. **Mitigación:**
  el límite está declarado en el contrato; `BusHost.maxPayload()` ya expone el número que anuncia
  el server, así que el emisor puede tratar el evento que no cabe como un fallo de publicación más
  (mismo camino de D-9) en vez de tirar.

## Alternativas Consideradas

### Alternativa 1: Outbox transaccional

**Pros:**
- Cierra la ventana entre el commit y el publish: el evento se persiste en la misma transacción
  del comando y un proceso aparte lo publica con reintento.
- Entrega garantizada incluso si el publish falla en el momento.

**Cons:**
- Tabla nueva, proceso de barrido nuevo, y reconciliación que mantener.
- El comando no puede persistir nada fuera de la transacción del despachador sin reabrir la
  discusión que [ADR-003](ADR-003-transaccion-del-despachador.md) ya cerró.

**Por qué se descartó:** decisión D-9 de REQ-014, tomada y cerrada. Se asume la ventana entre el
commit y el publish, sin tabla intermedia ni reconciliación, porque hoy ningún conector previsto
construye estado a partir de los eventos — todos solo notifican. **Condición de revisión:** si
aparece un conector que sí construya estado, un hueco deja de ser un aviso que no llegó y pasa a
ser estado corrupto de forma permanente, y ahí el outbox pasa a ser necesario. Agregarlo después no
cambia el contrato: los conectores no notan la diferencia.

Una sub-alternativa que surge de la misma idea —**publicar antes del commit**— no es alternativa en
absoluto: emitiría eventos de escrituras que después rollean, que es justo lo que D-1 evita.

---

### Alternativa 2: Un stream por versión

**Pros:**
- Aislamiento total entre versiones: cada una con su propia retención y orden.

**Cons:**
- Un `v2` de eventos duplicaría infraestructura (stream, límites, permisos) por un beneficio que
  ningún caso de uso pide hoy.

**Por qué se descartó:** cuando la versión de eventos incremente, el subject nuevo
(`{instance}.events.v2.>`) se **agrega** a los subjects del mismo stream `JIKU_EVENTS` — un stream
por versión partiría retención y orden sin beneficio. Los consumidores se separan por
`filter_subject`, no por stream (`deploy/nats/create-events-stream.sh`).

---

### Alternativa 3: Corte por visibilidad en el subject

**Pros:**
- Permitiría un `sub.allow` más fino: un consumidor externo podría suscribirse solo a los eventos
  que le corresponden por permiso.

**Cons:**
- Multiplicaría los subjects (y los permisos) por cada combinación de visibilidad y tipo de
  evento, sobre un catálogo de 16 tipos.

**Por qué se descartó:** es **D-8 de REQ-014** — todos los consumidores de este plano son
aplicaciones internas, sin corte por visibilidad entre ellas. El permiso de publicación se autoriza
por **versión entera** (`eventsStreamSubject()`), no por subject literal: es la excepción declarada
a la política general de `sub.allow` con subjects literales
([ADR-008](ADR-008-autorizacion-deny-by-default.md), regla 2), legítima precisamente porque el
permiso es por versión del contrato y no por tipo de evento. **Condición de revisión:** si entra un
consumidor no interno, el corte por visibilidad vuelve a ser necesario — y es un cambio de subject,
o sea **`v2`** (R-3).

---

Dos alternativas menores, de convención más que de arquitectura del stream:

- **Exponer la `NatsConnection` desde `BusHost`**: descartada porque rompería el encapsulamiento
  que `maxPayload()` preservaba a propósito. Se eligió inyectar un `EventPublisher` por
  constructor, como el despachador ya recibe `registry` — lo que además hace trivial el doble en
  los tests (`FakeEventPublisher`).
- **Generar el ULID en `packages/nats-protocol`**: descartada porque el paquete no tiene
  dependencias runtime (solo devDependencies) y agregarle una lo convertiría en algo más que un
  contrato. El `eventId` lo genera `core`, en el emisor.

## Referencias

- Contrato completo: [`docs/apis/core-events.yaml`](../apis/core-events.yaml) (AsyncAPI 2.6, 16
  eventos)
- Flujo de punta a punta: [`docs/flows/eventos-de-dominio.md`](../flows/eventos-de-dominio.md)
- Feature group que desbloquea: **FG-2** en
  [`docs/prd/feature-groups.md`](../prd/feature-groups.md)
- ADRs relacionados: [ADR-002](ADR-002-comandos-nats-sin-jetstream.md) (los comandos NO adoptan
  JetStream), [ADR-003](ADR-003-transaccion-del-despachador.md) (el despachador es dueño también de
  los efectos externos), [ADR-004](ADR-004-vocabulario-en-el-contrato.md) (por qué la entidad es
  `task` y no `objective`), [ADR-008](ADR-008-autorizacion-deny-by-default.md) (deny-by-default y la
  excepción del permiso por versión)
