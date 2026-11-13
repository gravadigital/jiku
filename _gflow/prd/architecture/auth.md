# Autenticación y autorización

## Credenciales

| ID | Credencial | Emisor | Se obtiene | Vida y renovación | Revocación | Origen |
|---|---|---|---|---|---|---|
| CRED-01 | Sesión de Gestión interna: cookie de NextAuth (httpOnly, `SameSite=Lax`, `Secure` con https) con un JWT cifrado que guarda el usuario, sus roles, el access token y su vencimiento | web | Login OIDC (Authorization Code + PKCE) contra Zitadel | Hasta **vida de la sesión de gestión**; termina antes si vence el access token; sin renovación | Cerrar sesión borra la sesión local; no cierra la sesión de Zitadel | inicial |
| CRED-02 | Sesión del Portal de clientes: cookie de Auth.js (`authjs.session-token`, httpOnly, `SameSite=Lax`) con el usuario, sus roles, el access token, el refresh token y su vencimiento | opus-web | Login OIDC (Authorization Code + PKCE, cliente público sin secreto) contra Zitadel | Hasta que vence el access token; el refresh token se guarda y no se usa | Cerrar sesión borra la sesión local; no cierra la sesión de Zitadel | inicial |
| CRED-03 | Access token de usuario: JWT de Zitadel con los roles del proyecto en el claim | Zitadel | En el login, dentro de CRED-01 o CRED-02; una persona que publica directo al bus usa el suyo | La que fija Zitadel; el producto no lo renueva | El producto no lo revoca ni lo introspecta: vale hasta su vencimiento | inicial |
| CRED-04 | Token del service user: JWT de Zitadel de una identidad de máquina (api con rol `internal-app`, core con rol `core`, cada conector con `internal-app`, jiku-docs con `docs`) | Zitadel | JWT bearer grant con una assertion RS256 firmada con la key JSON del service user (`ZITADEL_SERVICE_USER_KEY_B64` o `ZITADEL_SERVICE_USER_KEY`); se rechaza un token opaco | La que fija Zitadel; se renueva solo antes de vencer, con un margen de 300 segundos | Borrando la key o el service user en Zitadel | inicial |
| CRED-05 | Credencial NATS del sentinel (`sentinel-client.creds`), sin permisos propios | Operador NATS de la instalación (`deploy/nats/bootstrap.sh`) | Archivo generado al instalar y montado en api, core y cada conector | Sin vencimiento | Regenerando las credenciales del operador | inicial |
| CRED-06 | Usuario NATS que mintea el auth-callout en la cuenta `GESTION`, con los permisos de la plantilla del rol | auth-callout | En cada conexión al bus, presentando CRED-05 más CRED-03 o CRED-04 | Lo que dura la conexión | Cerrando la conexión; un rol sin regla en `rules.yaml` no obtiene usuario | inicial |
| CRED-07 | Token de link compartido de documentación (`jds_` más 43 caracteres) | jiku-docs | Al compartir un documento; se muestra una sola vez | Vence según **vencimientos de links compartidos** | Revocando el link (`DELETE /api/docs/shares/{id}`) | inicial |
| CRED-08 | URL firmada del almacenamiento (`PUT` de subida o `GET` de lectura con `inline` o `attachment`) | core (y jiku-docs para los adjuntos de documentos) | `files.request-upload` y `files.{fileId}.request-download` | **vida de la URL de subida** y **vida de la URL de descarga** | No se revoca: vence | inicial |

## Uso

| Credencial | Rol | Desde | Pasa por | Verifica | Origen |
|---|---|---|---|---|---|
| CRED-01 | `admin`, `user` | navegador | web (`proxy.ts` y el layout autenticado) | web: que exista la sesión; un `external-user` va a «Acceso no autorizado» | inicial |
| CRED-02 | `external-user`, `user`, `admin` | navegador | opus-web (middleware y proxy `/api/opus/[...path]`) | opus-web: que exista la sesión y que el access token no esté vencido | inicial |
| CRED-03 | `admin`, `user`, `external-user` | servidor de web o de opus-web (`Authorization: Bearer`) | api (`validateToken` global, salvo `GET /p/docs/*`) | api: firma contra las claves publicadas por Zitadel y vigencia (`exp`, `nbf`), sin audiencia ni emisor; roles = claves del claim `urn:zitadel:iam:org:project:roles`; después `hasAnyRole` en las lecturas que lo declaran | inicial |
| CRED-03 | `admin`, `user`, `external-user` | persona con cliente NATS | servidor NATS → auth-callout | auth-callout: JWT contra las claves de Zitadel; plantilla `person-internal` o `person-external` según el rol | inicial |
| CRED-04 | `internal-app` | api, conectores | servidor NATS → auth-callout | auth-callout: JWT contra las claves de Zitadel; plantilla `connector` | inicial |
| CRED-04 | `core` | core | servidor NATS → auth-callout | auth-callout: plantilla `core` (atiende `jiku-commands` y `jiku-queries`, publica eventos, consume `{instance}.events.auth`) | inicial |
| CRED-04 | `docs` | jiku-docs | servidor NATS → auth-callout | auth-callout: plantilla `docs` | inicial |
| CRED-05 | — | api, core, conectores, jiku-docs | servidor NATS | servidor NATS: firma del operador; el usuario no tiene permisos y dispara el auth-callout | inicial |
| CRED-06 | según la plantilla | la conexión autenticada | servidor NATS | servidor NATS: permisos de publicación y suscripción por subject; core además autoriza cada comando por rol (rol → método), clase de caller y permiso de proyecto, y acepta el sobre actor solo del publicador de confianza (`CORE_TRUSTED_PUBLISHER_ID`) | inicial |
| CRED-07 | anónimo | navegador | api (`/p/docs/{token}` en el host público, con rate limit) → jiku-docs (`shares.resolve`, `shares.attachment`) | api: formato del token; jiku-docs: que el link exista, no esté vencido ni revocado | inicial |
| CRED-08 | — | navegador (y la api para el HTML grande de un link público) | almacenamiento | almacenamiento: firma y vencimiento de la URL | inicial |

## Roles

| Rol | Actores | Permite | Origen |
|---|---|---|---|
| `admin` | U-01 | Entra a Gestión interna. Por la api: todas las lecturas internas y de documentación; en el portal solo los módulos y la documentación (proyectos, requisitos y previsualización del portal exigen `user` o `external-user`). En core: los 20 comandos internos más `week-assigned-times.replace`, y todas las consultas; carga y borra horas y ausencias de cualquier persona; edita comentarios ajenos. En documentación crea y restringe documentos restringidos. En el bus directo: consultas y comandos de core y de jiku-docs bajo su id | inicial |
| `user` | U-02 | Entra a Gestión interna y al Portal de clientes. Por la api: las lecturas internas, de documentación y del portal. En core: los 20 comandos internos más `requirements.{id}.subscriptors.new` con sobre actor, y todas las consultas; solo opera sus propias horas y ausencias y edita sus propios comentarios. En el bus directo: consultas y comandos de core y de jiku-docs bajo su id | inicial |
| `external-user` | U-03 | Entra solo al Portal de clientes (en Gestión interna, «Acceso no autorizado»). Por la api: las rutas del portal y las lecturas que no exigen rol. En core, solo con sobre actor y con permiso de proyecto sobre la entidad: `requirements.new`, `requirements.{id}.comment`, `requirements.{id}.subscriptors.new`, `requirements.{id}.subscriptors.{userId}.delete`, `files.request-upload` y `files.{fileId}.request-download`; todas las consultas con recorte externo. En el bus directo: solo consultas de core y de jiku-docs | inicial |
| `internal-app` | U-04 | Todos los comandos y consultas de core (la api publica con este rol y, como publicador de confianza, queda exenta de la compuerta de rol); consultas y comandos de jiku-docs; lectura de `JIKU_EVENTS` y `JIKU_DOCS_EVENTS`; lectura de `JIKU_MODULES`; su espacio en `JIKU_KV`. Es identidad de servicio | inicial |
| `core` | — | Identidad del servicio core: atiende los servicios del bus y publica eventos; no puede ejecutar comandos ni consultas. Es identidad de servicio | inicial |
| `docs` | — | Identidad del módulo jiku-docs: lo de `internal-app` más atender sus servicios, publicar sus eventos y escribir su clave en `JIKU_MODULES`; en core no autoriza nada y solo marca la identidad como de servicio | inicial |
| (sin rol del producto) | — | Entra a Gestión interna; la api rechaza las lecturas que exigen rol, core rechaza todos sus comandos y sus consultas responden `unknown_caller` | inicial |

## Proveedores externos de identidad

| Proveedor | Protocolo | Para qué roles | Qué datos toma | Cómo se vincula a la cuenta | Referencia | Origen |
|---|---|---|---|---|---|---|
| Zitadel | OIDC (Authorization Code + PKCE) para personas; OAuth 2.0 JWT bearer grant para service users; el auth-callout lo usa para autorizar el bus | `admin`, `user`, `external-user`, `internal-app`, `core`, `docs` | `sub`, nombre, usuario, email y los roles del proyecto | El `sub` es el id del Usuario (espejo); una Persona del equipo se vincula por su usuario | — | inicial |
