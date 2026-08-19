# ADR-007: Identidad federada en Zitadel, con el auth-callout como autorizador del bus

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** seguridad, identidad, oidc, nats, autorizacion
**Detectado desde:** `web`, `opus-web`, `api`, `core`

---

## Contexto

El producto necesitaba resolver dos problemas de identidad que parecen distintos y no lo son:

1. **Quién es cada persona y qué rol tiene**, para los dos frontends y la api.
2. **Quién puede publicar comandos de escritura en el bus.** Como core no verifica quién actúa
   —confía en el `creator`/`author`/`editor` que viaja en el cuerpo del mensaje— alguien que
   pudiera publicar en el subject correcto podría **escribir como cualquier persona**.

La organización ya usa Zitadel como proveedor de identidad, así que la primera parte tenía
respuesta. La segunda no: NATS con autenticación por credenciales estáticas daría un secreto
compartido que, si se filtra, abre la escritura entera.

## Decisión

**Zitadel es la fuente de verdad de identidad para todo el producto**, incluida la autorización
del bus.

### Para los usuarios

- Authorization Code + PKCE desde los dos frontends. Comparten la app OIDC (mismo
  `ZITADEL_CLIENT_ID`) con secretos de sesión distintos. `opus-web` no usa client secret: es
  cliente público con PKCE.
- Los roles llegan en el claim `urn:zitadel:iam:org:project:{PROJECT_ID}:roles`. Tres roles:
  `admin`, `user`, `external-user`.
- La api valida el token contra el **JWKS** de `{IDENTITY_URL}/oauth/v2/keys`, y **resincroniza
  las claves con reintentos** si el `kid` del token no está entre las conocidas: cubre la rotación
  en Zitadel sin reiniciar el servicio (`auth-helper.ts:26`).
- La tabla `users` es un **espejo** del proveedor: el producto la lee y no la escribe.

### Para el bus

Un componente desplegado, **`auth-callout`**, intercepta cada conexión a NATS, valida el token
contra Zitadel y **mintea los permisos** de publicación y de inbox según `rules.yaml`.

- La api y core se autentican con un **service user con JSON key**, cuyo access token
  `@jiku/zitadel-auth` **renueva solo** (caduca en ~1 h). Pasarlo por variable de entorno
  obligaría a reiniciar cada hora.
- El `userId` con el que la api publica **sale de la key, no de una variable**: tiene que coincidir
  exactamente con el `sub` que el callout lee del token para autorizar el subject.
- El permiso de inbox que mintea el callout es `_INBOX.<hash(user-id)>.>`, con el mismo hash que
  calcula `@jiku/nats-protocol`. Por eso el cliente **debe** fijar `inboxPrefix` explícitamente.

**Esto convierte al auth-callout en el componente de seguridad más crítico del producto**: es lo
único que impide que alguien distinto de la api escriba comandos.

## Implementation Rules

- Todo servicio que se conecte al bus **DEBE** autenticarse con el token de un service user
  obtenido vía `@jiku/zitadel-auth`, con auto-refresh. **NO SE DEBE** usar un token de larga
  duración por variable de entorno.
- El `userId` para publicar **DEBE** derivarse de la key del service user, **NO** de una variable
  de entorno.
- El cliente NATS **DEBE** fijar `inboxPrefix` con el hash de `@jiku/nats-protocol`.
- La api **DEBE** validar los tokens de usuario contra el JWKS de Zitadel, con resincronización
  ante `kid` desconocido (`KEY_SYNC_ATTEMPS` reintentos).
- Los roles **DEBEN** leerse del claim `urn:zitadel:iam:org:project:{PROJECT_ID}:roles`.
  **NO SE DEBEN** almacenar roles en la base ni derivarlos de otra fuente.
- `AUTH_BYPASS=true` **DEBE** seguir siendo opt-in explícito, **prohibido con
  `NODE_ENV=production`** (el arranque debe fallar) y exigir `DEV_USER_ID`. **NO SE DEBE**
  activar por ausencia de otra variable.
- El producto **NO DEBE** escribir la tabla `users` para modificar identidad: es espejo del
  proveedor. (El alta de la fila local es otro asunto — ver FG-1.)
- Un cambio en `rules.yaml` del auth-callout **DEBE** tratarse como cambio de seguridad: es lo que
  define quién puede escribir en el producto.

## Consecuencias

### Positivas

- **Una sola fuente de identidad** para los cuatro servicios y los dos frontends. Alta, baja y
  cambio de rol se hacen en Zitadel.
- **Sin contraseñas en el producto.** No hay hashing, ni recuperación, ni política de contraseñas
  que mantener.
- **La autorización del bus es dinámica y por identidad**, no un secreto compartido. Revocar el
  service user en Zitadel corta la escritura de inmediato.
- **La rotación de claves de Zitadel no requiere reinicio**, gracias a la resincronización del
  JWKS.
- **El token del bus se renueva solo**, así que su vida corta (~1 h) no es un costo operativo.
- **SSO real:** el equipo entra con la identidad corporativa que ya usa.

### Negativas

- **Zitadel es un punto único de fallo.** Si está caído, nadie entra y —más grave— **los servicios
  no pueden renovar su token de bus**, así que la escritura se detiene cuando el token vigente
  caduca.
- **El producto no puede dar de alta un usuario.** La identidad viene de Zitadel, pero la fila
  local en `users` no la crea nadie: quien autentica sin fila recibe 401 `user_not_found`. Es el
  hueco de alcance más grande del producto (FG-1).
- **Configuración distribuida y frágil.** Los roles dependen de que `ZITADEL_PROJECT_ID` esté bien
  configurado en cada frontend: **si está mal, los roles llegan vacíos y nada falla visiblemente**.
- **El auth-callout es un componente más que operar**, con sus credenciales de sentinel, sus seeds
  de cuenta y su `rules.yaml`.

### Riesgos

- **Riesgo crítico:** si la política del auth-callout falla o se configura mal, **core no tiene
  segunda línea de defensa**. Cualquiera que pueda publicar podría escribir como cualquier
  persona.
  - **Mitigación:** ninguna en el código. Es la consecuencia asumida del diseño de core
    ([ADR-002](ADR-002-comandos-nats-sin-jetstream.md)). Una verificación en core del `creator`
    contra el subject sería la defensa en profundidad que hoy falta.
- **Riesgo:** `ZITADEL_PROJECT_ID` mal configurado deja a todos los usuarios sin roles, en
  silencio.
  - **Mitigación:** ninguna hoy. Un assert al arrancar que verifique que el claim de roles existe
    sería suficiente.
- **Riesgo:** el bypass de desarrollo se activa en un entorno expuesto.
  - **Mitigación:** implementada y buena — el arranque falla con `NODE_ENV=production`, y el
    comentario del código registra que la versión anterior se activaba por ausencia de variable,
    dejando la api abierta con rol `admin` en silencio.

## Revisión: el comando de descarga recibe un `fileId` (REQ-001 / S-005, 2026-08-19)

**La decisión de este ADR no cambia**, y el modelo de confianza tampoco. Lo que cambia es su
**superficie**, y es una consecuencia que tiene que quedar registrada.

Con REQ-001 el storage pasa a tener un solo dueño. El comando que entrega la URL prefirmada es
`files.{fileId}.request-download`, y **recibe el id del archivo**. `core` firma sobre ese archivo y
**no sabe por qué se autorizó la descarga**: la autorización es de la `api`, que valida el permiso
sobre la entidad del vínculo antes de publicar.

**La consecuencia:** quien pueda publicar en el bus puede pedir la URL de **cualquier archivo del
catálogo por su id**, salteando la autorización de la `api`.

Es **el mismo modelo de confianza que este ADR ya declara para toda la escritura** —quien tiene
credenciales de service user puede publicar cualquier comando—, con dos diferencias que vale
nombrar:

1. **Ahora cubre también la lectura**, no solo la mutación.
2. **La superficie es el catálogo de archivos**, no el de vínculos autorizables. Un archivo con dos
   vínculos —uno a una entidad `public` y otro a una `internal`— tiene **un solo objeto y una sola
   clave**: quien obtenga la URL por el vínculo público accede al mismo byte que el vínculo interno
   protege. Ya era así, pero hasta ahora nadie podía pedir "el archivo" sin pasar por un vínculo.

### Mitigación evaluada y descartada

Se evaluó agregar un **`attachmentId` opcional** al payload, que `core` validaría contra el
`file_id` del vínculo. **Se descartó por simetría con `files.request-upload`**, que tampoco lo
lleva: hacer que un comando del módulo de archivos conozca el modelo de vínculos rompería el corte
de responsabilidades que REQ-001 establece (`core` es dueño del storage, la `api` de la
autorización).

**Queda disponible como mitigación aditiva** si el modelo de confianza del bus se endurece más
adelante. No se implementó en S-005.

## Alternativas Consideradas

### Alternativa 1: Autenticación propia en la api (usuarios y contraseñas)

**Pros:**
- Sin dependencia externa; el producto controla el alta de usuarios de punta a punta
- Menos componentes que operar

**Cons:**
- Hashing, recuperación, política de contraseñas, sesiones y 2FA a implementar y mantener
- Sin SSO: el equipo tendría una credencial más
- No resuelve la autorización del bus

**Por qué se descartó:** la organización ya tenía Zitadel, y reimplementar identidad es de las
peores relaciones costo/riesgo posibles. **Con la ironía de que el alta de usuarios —lo único que
esta alternativa daba gratis— es hoy el hueco principal del producto.**

---

### Alternativa 2: NATS con credenciales estáticas (creds de cuenta)

**Pros:**
- Mucho más simple: un archivo de credenciales por servicio, sin callout ni tokens que renovar
- Sin dependencia de Zitadel para que el bus funcione

**Cons:**
- Un secreto compartido de larga duración: si se filtra, la escritura del producto queda abierta
- Revocar exige rotar credenciales y reiniciar servicios
- Los permisos serían estáticos, no derivados de la identidad y el rol

**Por qué se descartó:** dado que core confía en el cuerpo del mensaje, la autorización del bus
**es** la autorización de escritura del producto. Un secreto estático no era garantía suficiente.

---

### Alternativa 3: Core verifica el `creator` contra el subject

**Pros:**
- Defensa en profundidad: el callout dejaría de ser el único punto de fallo
- Detectaría un comando con `creator` falsificado

**Cons:**
- El subject identifica al **service user de la api**, no a la persona: la api usa un único service
  user para todas sus personas. La verificación exigiría cambiar el modelo de identidad del bus,
  con un service user por persona o un token de usuario propagado

**Por qué se descartó (por ahora):** no era descartable en principio sino **irrealizable con el
modelo de identidad actual del bus**. Sigue siendo la mitigación correcta del riesgo crítico, y
requeriría su propio ADR.

## Referencias

- Deploy del callout: `deploy/docker-compose.yml:59-85`, reglas en `deploy/nats/auth-callout/rules.yaml`
- Paquete: `packages/zitadel-auth/`
- Arquitectura de seguridad: [`docs/prd/architecture.md`](../prd/architecture.md)
- Feature group relacionado: **FG-1** en [`docs/prd/feature-groups.md`](../prd/feature-groups.md)
- ADRs relacionados: [ADR-002](ADR-002-comandos-nats-sin-jetstream.md), [ADR-006](ADR-006-dos-frontends-una-api.md), [ADR-008](ADR-008-autorizacion-deny-by-default.md)
