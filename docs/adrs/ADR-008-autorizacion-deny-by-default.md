# ADR-008: Autorización deny-by-default por path, no por ruta

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** seguridad, autorizacion, api, express
**Detectado desde:** `api`

---

## Contexto

La api organiza sus 61 endpoints como **un archivo por ruta**, montados por un barrel que `app.ts`
recorre. Agregar un endpoint es crear un archivo y una línea en el barrel.

Esa forma tiene una ventaja clara —nada más se toca— y un riesgo de seguridad directo: si la
autenticación se declara **por ruta**, cada archivo nuevo tiene que acordarse de incluirla. Un
endpoint sin el middleware queda público, y como cada archivo es independiente, en revisión de
código el faltante no salta: no hay nada anómalo en el diff, solo falta una línea.

El producto tiene además un caso legítimo de endpoint público (el adjunto marcado como público)
y el bypass de desarrollo, así que "todo protegido sin excepciones" no era viable.

## Decisión

Instalar `validateToken` **globalmente para todo path**, y declarar las excepciones como una
**lista explícita de exenciones** (`api/lib/config/public.ts`), armada como regex de lookahead
negativo (`app.ts:32-35`).

El resultado es **deny-by-default**: un endpoint nuevo queda protegido sin que su autor haga nada.
Dejarlo público exige un cambio deliberado en un archivo cuyo único propósito es enumerar lo
público — un cambio que **sí** salta en revisión.

Sobre esa base, dos capas más:

- **Por rol:** `hasAnyRole([...])` en las rutas que lo requieren, sobre los roles del claim de
  Zitadel ([ADR-007](ADR-007-identidad-zitadel-auth-callout.md)).
- **Por entidad:** `validateProjectPermissions` y `canUserAccessEntity`/`canUserViewEntity`, que
  resuelven el proyecto desde 9 tipos de entidad y verifican `user_project_permissions`.

**Consecuencia que hay que conocer para leer el código:** un archivo de ruta puede **parecer
desprotegido y estar cubierto**. La protección no está en el archivo que se está leyendo.

## Implementation Rules

- `validateToken` **DEBE** instalarse globalmente en `app.ts`. **NO SE DEBE** declarar
  autenticación ruta por ruta.
- Un endpoint público **DEBE** agregarse explícitamente a `api/lib/config/public.ts`. Cualquier
  cambio en ese archivo es un **cambio de seguridad** y debe revisarse como tal.
- Un endpoint público **DEBE** validar por su cuenta lo que corresponda. El caso vigente
  (`GET /api/opus/attachments/:id/public`) verifica que el adjunto esté marcado público, responde
  403 en cualquier otro caso, y manda `X-Content-Type-Options: nosniff` con CSP de sandbox.
- Un endpoint que requiere rol **DEBE** declarar `hasAnyRole([...])` explícitamente. La
  autenticación global no implica autorización.
- Un endpoint accesible a `external-user` **DEBE** además verificar permiso de proyecto: el rol
  solo no alcanza ([ADR-006](ADR-006-dos-frontends-una-api.md)).
- Un tipo de entidad nuevo con adjuntos **DEBE** agregarse a la resolución de proyecto de
  `attachments-access.ts`. Un tipo no contemplado **no se autoriza**, que es el comportamiento
  correcto.
- Al leer un archivo de ruta, **NO SE DEBE** concluir que está desprotegido por no ver el
  middleware: la protección es global.

## Consecuencias

### Positivas

- **Un endpoint nuevo nace protegido.** El modo de fallo por omisión desapareció.
- **Lo público es enumerable.** `public.ts` es la lista completa y auditable de la superficie sin
  autenticación: hoy, un solo endpoint.
- **Exponer algo requiere intención.** El cambio ocurre en un archivo de seguridad, no perdido
  entre la lógica de un handler.
- **Las tres capas son independientes.** Autenticar, autorizar por rol y autorizar por entidad son
  decisiones separadas, y saltarse una no saltea las otras.

### Negativas

- **La protección no es visible en el archivo de la ruta.** Alguien que lee `objectives-get.ts` no
  ve ninguna verificación y podría concluir que está abierto. Es un costo de legibilidad real.
- **La lista de exenciones es una regex de lookahead negativo**, que es difícil de leer y fácil de
  romper. Un error ahí puede exponer más de lo previsto sin que nada falle.
- **Autenticado no es autorizado.** Como la autenticación es automática, es fácil olvidarse de que
  el rol y la entidad **no** lo son. El olvido de `hasAnyRole` sigue siendo posible y silencioso.

### Riesgos

- **Riesgo:** una exención mal escrita en la regex cubre más paths de los previstos.
  - **Mitigación:** ninguna automática hoy. Un test que verifique que **exactamente** los paths
    esperados quedan exentos sería la verificación correcta, y es barato de escribir.
- **Riesgo:** un endpoint nuevo bajo `/api/opus/*` se agrega sin `validateProjectPermissions`.
  Queda autenticado —así que no es una brecha abierta— pero accesible a cualquier cliente para
  cualquier proyecto.
  - **Mitigación:** ninguna automática. Registrado como riesgo en ADR-006 y en FG-4.
- **Riesgo:** alguien agrega autenticación por ruta "por las dudas", generando dos mecanismos que
  divergen.
  - **Mitigación:** las reglas de implementación de arriba.

## Alternativas Consideradas

### Alternativa 1: Middleware por ruta (allowlist explícita)

**Pros:**
- La protección se ve en el archivo que se está leyendo
- Sin regex de exenciones

**Cons:**
- Un archivo nuevo que se olvide el middleware queda **público**
- El error es de omisión: no aparece en el diff

**Por qué se descartó:** invierte el default de seguridad. Con 61 archivos de ruta y una
convención de "un archivo por endpoint", el olvido era cuestión de tiempo.

---

### Alternativa 2: Autorización declarativa en el barrel

**Pros:**
- Combina lo mejor de ambas: default seguro y declaración visible en un solo lugar
- El barrel sería un mapa legible de qué exige cada endpoint

**Cons:**
- Exige reestructurar el barrel, que hoy solo monta rutas iterando `Object.keys(routes)`
- Un endpoint podría quedar sin entrada en el mapa, con el mismo problema de omisión

**Por qué se descartó:** no hay evidencia en el código de que se haya evaluado. **Es la evolución
natural si la legibilidad se vuelve un problema real**, y resolvería también el olvido de
`hasAnyRole` si el default del mapa fuese denegar.

---

### Alternativa 3: Autorización en el gateway (nginx-proxy)

**Pros:**
- La api no tendría que ocuparse
- Punto único de política

**Cons:**
- La autorización por entidad necesita datos (`user_project_permissions`) que el gateway no tiene
- `nginx-proxy` es un reverse proxy con TLS, no un policy engine

**Por qué se descartó:** solo cubriría la primera capa. Las dos que más importan —rol y entidad—
requieren lógica de dominio.

## Referencias

- Implementación: `api/lib/config/public.ts`, `api/lib/app.ts:32-35`,
  `api/lib/utils/middlewares/validate-token.ts:12-24`, `api/lib/utils/attachments-access.ts`
- Arquitectura de seguridad: [`docs/prd/architecture.md`](../prd/architecture.md)
- ADRs relacionados: [ADR-006](ADR-006-dos-frontends-una-api.md), [ADR-007](ADR-007-identidad-zitadel-auth-callout.md)
