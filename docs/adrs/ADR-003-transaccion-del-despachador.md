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
    replantear el comando o el modelo.
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

- Implementación: `core/src/bus/dispatcher.ts:42-64`, `core/src/bus/consumer.ts:101-105`
- Arquitectura: [`docs/architectures/core/`](../architectures/core/)
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md), [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-013](ADR-013-tests-contra-base-real.md)
