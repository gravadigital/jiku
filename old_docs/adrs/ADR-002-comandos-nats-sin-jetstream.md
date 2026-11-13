# ADR-002: Toda mutación es un comando NATS request/reply, sin JetStream

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** arquitectura, mensajeria, nats, disponibilidad, integridad
**Detectado desde:** `api`, `core`

---

## Contexto

Una vez decidido que la api no escribe y core sí ([ADR-001](ADR-001-separacion-lectura-escritura.md)),
hacía falta un canal entre los dos. Las opciones eran una API HTTP interna en core, un bus de
mensajes, o acceso compartido a la base con locks.

El requisito no era solo transportar la intención de escritura: era que **el usuario recibiera una
respuesta útil**. Un `POST /api/requirements` tiene que devolver el requisito creado o un error
que el frontend pueda mostrar, no un "encolado, vuelva más tarde". El producto es una herramienta
de trabajo interactiva, no un procesador de lotes.

## Decisión

Usar **NATS en modo request/reply, sin JetStream**. La api publica un comando y **espera la
respuesta** con un timeout; core valida, escribe en una transacción y responde.

**Gramática del subject:**
```
{instance}.{user-id}.{svc}.{version}.{comando}
dev.323332022539911171.gestion.v1.clients.new
```

Core se suscribe a `{instance}.*.gestion.v1.>` con **queue group `gestion`**: el wildcard cubre a
cualquier caller y el queue group hace que varias réplicas se repartan los mensajes en lugar de
procesar cada una lo mismo.

**Formato de respuesta**, igual para los 17 comandos:
```json
{ "status": "success", "data": { "id": 7 } }
{ "status": "failure", "errorCode": "project_not_found", "errorMessage": "Project not found" }
```

El `status` **decide la transacción** (ver [ADR-003](ADR-003-transaccion-del-despachador.md)).

**Sin JetStream es una decisión explícita, no un olvido.** JetStream daría cola, persistencia y
reintento, pero cambiaría la semántica: el comando dejaría de ser síncrono desde la perspectiva
del usuario y el frontend tendría que manejar "aceptado pero todavía no aplicado". Se eligió
mantener la respuesta inmediata y **asumir que un comando perdido es un comando perdido**.

Implementado en:
- `api/lib/utils/bus/send-command.ts` — publicación y traducción de la respuesta a HTTP
- `api/lib/utils/bus/protocol.ts:40-75` — mapa de 20 códigos de error a status HTTP
- `core/src/bus/consumer.ts:69-70` — suscripción con queue group
- `packages/nats-protocol/` — gramática de subjects, formato de `Reply`, hash del inbox

### El inbox usa un hash, el subject no

El `user-id` va **crudo** en el subject; el inbox usa un **hash** (sha256 → base32 sin padding →
16 caracteres en minúscula). Tiene que dar exactamente lo mismo que calcula el auth-callout, que
es quien mintea el permiso: sin fijar `inboxPrefix` al conectar, la librería genera un inbox
aleatorio y **las respuestas nunca llegan**.

## Implementation Rules

- Todo comando **DEBE** publicarse con el subject `{instance}.{user-id}.gestion.v1.{comando}`,
  usando la gramática de `@jiku/nats-protocol`. **NO SE DEBE** construir el subject a mano.
- El cliente NATS **DEBE** fijar `inboxPrefix` explícitamente al conectar, con el hash del user id
  que calcula `@jiku/nats-protocol`. Sin esto las respuestas no llegan.
- El `userId` con el que publica la api **DEBE** salir de la key del service user, **NO** de una
  variable de entorno: tiene que coincidir exactamente con el `sub` que el auth-callout lee del
  token para autorizar el subject.
- Toda respuesta **DEBE** tener el formato `{ status: 'success', data }` o
  `{ status: 'failure', errorCode, errorMessage }`. **NO SE DEBEN** inventar otros formatos.
- Los comandos de creación **DEBEN** devolver únicamente `{ id }`. Las ediciones y borrados, nada.
- Todo `errorCode` nuevo **DEBE** agregarse al mapa de `api/lib/utils/bus/protocol.ts` con su
  status HTTP. Un código sin mapeo cae en un 500 genérico.
- El timeout de la request es `NATS_REQUEST_TIMEOUT_MS` (default **5000 ms**); al expirar la api
  **DEBE** responder **503**.
- **NO SE DEBE** transportar datos estructurados dentro de `errorMessage`. El caso actual de
  `daily_limit_exceeded` —que la api recupera parseando el mensaje con un regex— es deuda
  explícita, no un patrón a imitar.
- Core **NO DEBE** publicar en el plano de comandos: solo responde el `Reply` de la request que
  recibe. **Sí publica eventos de dominio**, en un plano distinto y con JetStream — ver
  [ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md).

## Consecuencias

### Positivas

- **El usuario recibe una respuesta útil de inmediato**, con el recurso creado o un error
  accionable. La escritura se siente síncrona aunque cruce un bus.
- **Sin infraestructura de estado en el bus.** NATS core no persiste nada: no hay streams que
  administrar, ni consumers que configurar, ni almacenamiento que crezca.
- **Las réplicas de core escalan sin coordinación** gracias al queue group.
- **El subject con wildcard para el caller** permite sumar un publicador nuevo sin tocar el código
  de core: pasa a ser una decisión de política del bus.
- **El contrato está versionado en el subject** (`v1`), así que una v2 puede convivir.

### Negativas

- **Un comando perdido es un comando perdido.** Sin cola, sin reintento, sin persistencia y sin
  idempotencia. Si core está caído cuando la api publica, la request expira, el usuario ve un 503
  y **la operación no ocurrió**. No hay reconciliación posterior.
- **La disponibilidad de escritura del producto es exactamente la de core.** No hay degradación
  elegante: o escribe, o no.
- **La ventana de respuesta perdida es indistinguible del fallo.** Si core escribe y la respuesta
  se pierde, el cliente ve un error de algo que **sí pasó**. No hay forma de saberlo desde el
  frontend.
- **El timeout de 5 s es un límite duro para cualquier comando.** Una operación que tarde más
  falla aunque haya escrito bien.

### Riesgos

- **Riesgo:** un comando lento (por volumen de datos o por bloqueo en la base) supera los 5 s y el
  usuario ve un 503 de una operación exitosa.
  - **Mitigación:** ninguna hoy. Es el modo de fallo más confuso del sistema.
- **Riesgo:** no hay forma de saber cuántas escrituras se perdieron.
  - **Mitigación:** ninguna hoy — no hay métricas ni logs verificables en producción. Es el
    contenido del feature group **FG-3**.
- **Riesgo:** una feature futura que necesite entrega garantizada se construye sobre **este**
  plano de comandos y hereda la pérdida silenciosa.
  - **Mitigación:** ninguna automática — es una decisión de diseño a rechazar en revisión. **Ya no
    es el caso de FG-2**: desde REQ-014, FG-2 (notificaciones) se construye sobre el plano de
    **eventos de dominio**, que tiene stream con retención de 7 días
    ([ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md)), y no sobre este. El riesgo sigue
    vigente para cualquier feature que sí decida apoyarse en un comando request/reply para algo
    que necesite entrega garantizada.

## Alternativas Consideradas

### Alternativa 1: NATS con JetStream

**Pros:**
- Cola, persistencia, reintento e idempotencia por `Nats-Msg-Id`
- Un comando publicado con core caído se procesa cuando vuelve
- Métricas de stream y de consumer sin instrumentar nada

**Cons:**
- Cambia la semántica de la escritura a asíncrona: el frontend tendría que manejar "aceptado, aún
  no aplicado", con polling o websockets para saber el resultado
- Los comandos no son naturalmente idempotentes hoy: reprocesar `worked-times.new` duplicaría el
  registro
- Infraestructura de streams que administrar

**Por qué se descartó:** el costo de rehacer la interacción de todos los formularios del producto
para un modelo asíncrono superaba el beneficio, dado que el producto es interno y la caída de core
es un evento raro y visible. **Es la alternativa a reconsiderar en FG-3** — el descarte fue una
decisión de momento, no permanente.

> **Este descarte sigue vigente para comandos, y la adopción de JetStream para eventos de dominio
> ([ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md)) no lo reabre.** Son dos planos con dos
> semánticas distintas sobre la misma infraestructura de bus: los comandos siguen siendo
> request/reply síncrono porque el usuario espera una respuesta inmediata en el momento; los
> eventos son fire-and-forget hacia un conector que no está esperando nada. Que uno haya adoptado
> JetStream no dice nada sobre si el otro debería — la reconsideración de esta alternativa **para
> comandos** sigue siendo, exclusivamente, el contenido de FG-3.

---

### Alternativa 2: API HTTP interna en core

**Pros:**
- Semántica request/response nativa, sin librería de bus
- Herramientas de debugging conocidas (curl, logs de acceso)

**Cons:**
- Core tendría que exponer un puerto y un framework web, con su superficie de ataque
- La autorización habría que resolverla de nuevo: hoy la resuelve el auth-callout del bus
- Sin queue group: el balanceo entre réplicas requeriría un balanceador delante

**Por qué se descartó:** que core **no exponga HTTP** es parte de su definición de seguridad. Es
inalcanzable desde la red de ingress por diseño.

---

### Alternativa 3: Escritura directa a la base desde la api

**Pros:**
- Lo más simple, sin bus ni servicio adicional

**Cons:**
- Contradice [ADR-001](ADR-001-separacion-lectura-escritura.md) por completo

**Por qué se descartó:** era exactamente el problema que ADR-001 vino a resolver.

## Referencias

- Contrato completo: [`docs/apis/core.yaml`](../apis/core.yaml) (AsyncAPI 2.6, 17 comandos, 21 códigos de error)
- Arquitectura: [`docs/prd/architecture.md`](../prd/architecture.md)
- Feature group que lo revisa: **FG-3** en [`docs/prd/feature-groups.md`](../prd/feature-groups.md)
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md), [ADR-003](ADR-003-transaccion-del-despachador.md), [ADR-007](ADR-007-identidad-zitadel-auth-callout.md), [ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md) (JetStream, pero para el plano de eventos, no el de comandos)
