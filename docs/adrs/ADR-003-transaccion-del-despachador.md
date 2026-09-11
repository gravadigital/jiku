# ADR-003: La transacción es del despachador, nunca del comando

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** integridad, transacciones, core, diseño-de-api-interna
**Detectado desde:** `core`

---

## Contexto

Con toda la escritura concentrada en core ([ADR-001](ADR-001-separacion-lectura-escritura.md)),
quedaba por resolver cómo se garantiza la atomicidad de cada comando.

El patrón habitual es que cada handler abra su transacción, la pase a las operaciones y haga
commit al final o rollback en el `catch`. Ese patrón tiene un modo de fallo conocido y difícil de
detectar en revisión: **una rama de error que retorna sin hacer rollback**. Un comando que valida
en tres pasos y falla en el tercero, si el segundo ya insertó filas y el `return` temprano no
libera la transacción, deja escritura a medias o una conexión colgada.

Es un error de omisión —no aparece nada en el diff, falta algo— y por eso es el que más
sobrevive a la revisión de código.

## Decisión

**Invertir la propiedad de la transacción**: la abre y la cierra el **despachador**, no el
comando.

`core/src/bus/dispatcher.ts:42-54`:
1. El despachador abre la transacción
2. Ejecuta el comando, pasándole la transacción en su contexto
3. Hace **commit si el reply es `success`**, y **rollback en cualquier otro caso**

Los comandos reciben la transacción pero **no tienen acceso a `commit` ni a `rollback`**. No
pueden cerrarla aunque quieran.

La consecuencia es estructural: un comando que responde `failure` con tres filas ya insertadas
**las pierde todas, sin tener que hacer nada**. Olvidarse el rollback dejó de ser posible porque
el rollback no es responsabilidad del comando.

### El despachador también es dueño de los efectos externos (REQ-014 / S-063)

La propiedad de la transacción se extiende a **cualquier efecto externo que un comando declare**
—hoy, la publicación de eventos de dominio ([ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md))—.
**Esto no cambia la decisión de arriba: la amplía.** El comando sigue sin poder tocar la
transacción, y ahora tampoco puede tocar lo que pasa después de ella.

`core/src/bus/dispatcher.ts:396-415`, verbatim, es el registro de por qué el patrón tiene la forma
que tiene:

```
// LA EMISIÓN VA ACÁ Y EN SU PROPIO try/catch, y las dos cosas son la story (S-063).
//
// DESPUÉS DEL COMMIT porque publicar antes emitiría eventos de escrituras que después
// rollean. La ventana entre el commit y el publish está ASUMIDA (R-6 del REQ): si falla
// acá, el evento SE PIERDE y no se repone.
//
// EN SU PROPIO try/catch PORQUE EL `catch` DE MÁS ABAJO HACE `rollback()` — y para este
// punto la transacción YA ESTÁ COMMITEADA. Un rechazo que escapara de acá haría un rollback
// sobre una transacción terminada, ese segundo rechazo taparía el original, y un comando
// que escribió bien saldría `failure internal_error`: el usuario vería un error de algo
// que SÍ pasó (R-A). El precedente de cómo se evita está 200 líneas más arriba, en
// `mirrorActor`.
//
// `reply.events?.length` Y NO `reply.events !== undefined`: un `events: []` no tiene que
// entrar a este camino (TS-7) — no hay nada que publicar y entrar igual solo arriesgaría
// sin ganar nada.
//
// Y `emitEvents` YA NO RECHAZA NUNCA (garantía de la Task 2) así que este `await` es
// seguro. AUN ASÍ el try/catch propio va igual: la garantía tiene que ser LOCAL Y VISIBLE
// en este archivo, no una propiedad que alguien pueda romper editando otro (R-B).
```

**El modo de fallo que esto evita, etiquetado R-A del REQ:** si la publicación lanzara entre el
`commit()` y el `return`, caería en el `catch` general de más abajo, que hace
`await transaction.rollback()` — sobre una transacción **ya terminada**. Ese segundo rechazo
**rechaza** y **tapa el error original**, y un comando que escribió bien saldría
`failure internal_error`: el usuario vería un error de una operación que **sí ocurrió**. Es
exactamente lo que D-9 de REQ-014 prohíbe.

**Por qué el `try`/`catch` propio va igual, aunque el emisor ya prometa no rechazar (R-B del
REQ):** en producción, un `unhandled rejection` del publicador **mata el proceso** — el logger de
`core` corre con `exitOnError: true` en `NODE_ENV=production`. La garantía de "nunca lanza" tiene
que ser **local y visible en este archivo**, no una propiedad que dependa de que nadie rompa
`emit-events.ts` en un cambio futuro.

**El precedente de este patrón ya existía en el mismo archivo, para otro efecto externo:**
`mirrorActor` resuelve el mismo problema —una transacción propia que puede fallar después de que la
principal ya cerró— con `await transaction.rollback().catch(() => undefined)`. La emisión de
eventos es el **segundo** caso del mismo patrón, no uno inventado para la ocasión.

### El despachador nunca lanza

Complemento necesario de lo anterior (`core/src/bus/dispatcher.ts:60-64`): todo error inesperado
se traduce a un `Reply` de falla.

Del otro lado hay una request esperando. Quedarse sin contestar dejaría a la api colgada hasta su
timeout de 5 s, y el usuario vería un 503 en lugar del error real. El `consume()` del consumer
tiene además una última red por si el despachador fallara al fallar
(`core/src/bus/consumer.ts:101-105`).

## Implementation Rules

- Un comando **DEBE** recibir la transacción por su contexto y usarla en todas sus operaciones de
  base de datos. **NO DEBE** abrir una transacción propia.
- Un comando **NO DEBE** llamar a `commit()` ni a `rollback()`. Si el código de un comando los
  invoca, está mal escrito.
- Un comando **DEBE** señalar el fallo devolviendo un `Reply` con `status: 'failure'` y su
  `errorCode`. **NO DEBE** lanzar una excepción para señalar un fallo de negocio esperado.
- El despachador **DEBE** hacer commit **solo** si el reply es `success`, y rollback en todos los
  demás casos, incluidas las excepciones inesperadas.
- El despachador **NO DEBE** lanzar nunca: todo error se traduce a un `Reply` de falla.
- Los tests de comandos **DEBEN** entrar por el despachador (helper `dispatch()`), no llamando a
  `execute()` directamente: es lo único que verifica el comportamiento transaccional, incluido el
  rollback.
- El despachador es dueño de los **efectos externos** que un comando declare (hoy, eventos de
  dominio en `Reply.events`), igual que es dueño de la transacción. Un efecto externo **DEBE**
  ejecutarse **después** del `commit()`, **solo** si el `reply` es `success`, y **NO DEBE**
  propagar su error — ni al `reply` ni haciendo `rollback()` sobre la transacción, que para ese
  punto **ya está commiteada** y terminada (R-A). Un rollback sobre una transacción terminada
  rechaza, ese segundo rechazo tapa el original, y un comando que escribió bien saldría
  `failure internal_error`: el usuario vería un error de una operación que sí ocurrió. La
  implementación de referencia es la emisión de eventos de `core/src/bus/dispatcher.ts:396-415`.

## Consecuencias

### Positivas

- **Es estructuralmente imposible dejar una escritura a medias** por olvidarse un rollback. El
  modo de fallo desapareció, no se mitigó.
- **Los comandos son más simples de leer y de escribir.** No tienen manejo de transacción: solo
  validan, escriben y devuelven un reply.
- **La regla es verificable de un vistazo.** Si un comando menciona `commit` o `rollback`, está
  mal. No hace falta razonar sobre las ramas de error.
- **La api nunca queda colgada esperando**, porque el despachador siempre responde.
- **Los tests cubren la transacción de verdad**: al entrar por el despachador, verifican el
  rollback igual que el camino feliz.

### Negativas

- **Un comando no puede hacer commit parcial.** Si una operación necesitara persistir algo aunque
  el resto falle —por ejemplo un registro de auditoría del intento fallido— no hay forma de
  hacerlo dentro del comando.
- **Toda la transacción vive mientras dura el comando**, incluidas las validaciones lentas. Un
  comando que consulta mucho antes de escribir mantiene la transacción abierta ese tiempo.
- **Sin transacciones anidadas ni savepoints.** El modelo es todo o nada por comando.

### Riesgos

- **Riesgo:** un comando futuro necesita persistir algo fuera de la transacción y alguien lo
  resuelve abriendo una segunda conexión.
  - **Mitigación:** ninguna automática. Debe rechazarse en revisión; el caso correcto sería
    replantear el comando o el modelo. **Distinto de un efecto externo no persistente** (como
    publicar un evento): ese caso sí tiene un patrón declarado —después del commit, en su propio
    `try`/`catch`, sin propagar error—, y no habilita abrir una segunda conexión de base de datos
    para escribir. El patrón declarado es para efectos que no son una escritura a la base.
- **Riesgo:** un comando lento mantiene la transacción abierta y genera contención en la base.
  - **Mitigación:** el timeout de 5 s de la api ([ADR-002](ADR-002-comandos-nats-sin-jetstream.md))
    acota indirectamente cuánto puede durar, pero **no cancela la transacción**: core sigue
    trabajando aunque nadie espere la respuesta.

## Alternativas Consideradas

### Alternativa 1: Cada comando administra su propia transacción

**Pros:**
- Control total: commits parciales, savepoints, transacciones anidadas
- Es el patrón más habitual y más familiar

**Cons:**
- Cada comando nuevo puede omitir el rollback en una rama de error
- El error es de omisión, así que no se ve en el diff

**Por qué se descartó:** es exactamente el modo de fallo que esta decisión elimina.

---

### Alternativa 2: Decorador o middleware transaccional por comando

**Pros:**
- Misma garantía, aplicada por decoración
- Permitiría excepciones declarativas (un comando marcado como no transaccional)

**Cons:**
- Un comando puede olvidarse de aplicar el decorador y nadie lo nota
- La garantía vuelve a ser opt-in

**Por qué se descartó:** por la misma razón que ADR-001 eligió permisos de base sobre convención
de código. Si la garantía se puede omitir, en algún momento se omite.

---

### Alternativa 3: Sin transacción, escritura idempotente y compensaciones

**Pros:**
- Sin transacciones largas, mejor concurrencia

**Cons:**
- Exige diseñar compensación para cada operación
- Complejidad desproporcionada para el volumen del producto

**Por qué se descartó:** el producto escribe pocas filas por comando sobre una base única.
PostgreSQL da atomicidad gratis; renunciar a ella sería pagar complejidad por nada.

## Referencias

- Implementación: `core/src/bus/dispatcher.ts:384-394` (la transacción), `core/src/bus/dispatcher.ts:430-434`
  (el despachador nunca lanza), `core/src/bus/dispatcher.ts:396-415` (el efecto externo post-commit,
  REQ-014 / S-063)
- Flujo de punta a punta del efecto externo: [`docs/flows/eventos-de-dominio.md`](../flows/eventos-de-dominio.md)
- Arquitectura: [`docs/architectures/core/`](../architectures/core/)
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md), [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-013](ADR-013-tests-contra-base-real.md), [ADR-014](ADR-014-jetstream-para-eventos-de-dominio.md) (el efecto externo que este ADR ahora cubre)
