# Authentication and authorization

## Credentials

| ID | Credential | Issuer | Obtained | Lifetime and renewal | Revocation | Origin |
|---|---|---|---|---|---|---|
| CRED-01 | Access token de persona: JWT de Zitadel con los roles del proyecto en el claim de roles | Zitadel | Flujo de código de autorización con PKCE desde web u opus-web (misma aplicación OIDC), pidiendo los roles del proyecto | El que configura Zitadel. No se renueva: al vencer termina la sesión y hay que volver a ingresar | Se desactiva la identidad en Zitadel; la api no consulta a Zitadel en cada pedido (verifica firma, emisor y audiencia), así que un token ya emitido sigue valiendo hasta vencer | #626 |
| CRED-02 | Token de máquina: JWT de Zitadel de un usuario de servicio (api, core, conectores, jiku-docs) | Zitadel | Grant jwt-bearer firmado con la key JSON del usuario de servicio, pidiendo la audiencia del proyecto (scope `urn:zitadel:iam:org:project:id:{id}:aud`): sin ella la api y el bus lo rechazan | Alrededor de una hora; `@jiku/zitadel-auth` lo renueva solo en api y core | Se borra la key o se desactiva el usuario de servicio en Zitadel | #626 |
| CRED-03 | Credenciales sentinel de NATS (`sentinel-client.creds`) | Operador NATS de la instalación (`deploy/nats/bootstrap.sh`) | Archivo generado en la instalación y montado en cada servicio que se conecta al bus | Sin vencimiento propio; no dan permisos: cada conexión con ellas dispara el auth-callout, que autoriza con el token | Se regenera la identidad NATS de la instalación | initial |
| CRED-04 | Sesión del navegador: cookie de NextAuth de web y de opus-web (secretos distintos) | web / opus-web | Al volver del proveedor de identidad con el código de autorización | Gestor interno: hasta 12 horas y termina antes si vence el access token. Portal: termina cuando vence el access token. Sin renovación | «Cerrar sesión» borra la cookie de la aplicación; la sesión en Zitadel queda abierta | initial |
| CRED-05 | Link compartido de documento: token en `/p/docs/{token}` | jiku-docs (lo crea a pedido de la api) | Un miembro del equipo crea el link desde el gestor | 7, 15, 30, 90 o 180 días (30 por defecto); no se renueva | Se revoca desde el gestor; vencido o revocado, la página responde «Este link no está disponible» | initial |

## Use

| Credential | Role | From | Passes through | Verifies | Origin |
|---|---|---|---|---|---|
| CRED-04 | admin, user | navegador | — | web (NextAuth); con rol `external-user` la sesión va a «Acceso no autorizado» | initial |
| CRED-04 | external-user, user | navegador | — | opus-web (NextAuth), sin corte por rol | initial |
| CRED-01 | admin, user, external-user | servidor de web, proxy de opus-web (la sesión también lo entrega al JavaScript del navegador) | `Authorization: Bearer` en cada operación de la api | api: firma contra las claves públicas de Zitadel, emisor de la instancia configurada y audiencia del proyecto; los roles salen del claim de roles del proyecto | #626 |
| CRED-01 | admin, user, external-user | cliente del bus de la persona | conexión a NATS con CRED-03 | auth-callout: valida el token contra Zitadel (firma, emisor y audiencia del proyecto; roles del claim del proyecto) y aplica la plantilla de la primera regla de rol; core autoriza cada método con los roles guardados del usuario | #626 |
| CRED-02 | internal-app | api | conexión a NATS con CRED-03; cada comando lleva el sobre de identidad (id y roles de CRED-01) | auth-callout por la conexión; core acepta el sobre porque el caller es `CORE_TRUSTED_PUBLISHER_ID` y autoriza con los roles del sobre | initial |
| CRED-02 | internal-app | conector externo | conexión a NATS con CRED-03 | auth-callout por la conexión; core autoriza cada método con los roles guardados del usuario | initial |
| CRED-02 | core | core | conexión a NATS con CRED-03 | auth-callout: plantilla de core (atender `jiku-commands` y `jiku-queries`, publicar eventos) | initial |
| CRED-02 | docs | jiku-docs | conexión a NATS con CRED-03 | auth-callout: plantilla de docs (servicios `jiku-docs-*` más lo del conector) | initial |
| CRED-03 | admin, user, external-user, internal-app, core, docs | todo cliente del bus | conexión a NATS | servidor NATS: la cuenta del sentinel delega la autorización en el auth-callout | initial |
| CRED-05 | — | navegador del visitante | `GET /p/docs/{token}` en el host público de documentos | jiku-docs, consultado por la api | initial |

## Roles

| Role | Actors | Allows | Origin |
|---|---|---|---|
| admin | U-01 | Lo de `user` en el Gestor interno y en el bus, y además guardar la asignación semanal, cargar o borrar horas y ausencias de otras personas y editar comentarios ajenos. Sin el rol `user`, el Portal de clientes no le lista proyectos | initial |
| user | U-02 | El Gestor interno (clientes, proyectos, requisitos, tareas, archivos, horas, ausencias, documentación) y el Portal de clientes sobre todos los proyectos `activo`; publicar directo en el bus los comandos del equipo y las consultas | initial |
| external-user | U-03 | Solo el Portal de clientes: proyectos `activo` con permiso de proyecto, sus requisitos públicos, crear y comentar requisitos, suscribirse; por el bus, solo consultas, filtradas a esos proyectos y a lo público | initial |
| internal-app | U-04 | Conector: todos los comandos y consultas de core, sus eventos de dominio, su espacio clave/valor, el registro de módulos y los servicios del módulo de documentación; la api usa este rol | initial |
| core | — | Identidad de servicio de core: atender los servicios de comandos y consultas, publicar eventos de dominio y recibir el evento de autenticación | initial |
| docs | — | Identidad de servicio de jiku-docs (junto con `internal-app`): atender sus servicios del bus y registrarse en `JIKU_MODULES` | initial |

## External identity providers

| Provider | Protocol | For which roles | Data it takes | How it is linked to the account | Reference | Origin |
|---|---|---|---|---|---|---|
| Zitadel | OIDC (código de autorización con PKCE) para personas; jwt-bearer con key JSON para usuarios de servicio; JWKS para validar | admin, user, external-user, internal-app, core, docs | `sub`, nombre, usuario, email y los roles del proyecto | El id del usuario es el `sub`: core crea o actualiza el usuario en cada autenticación en el bus y con el sobre de cada comando de la api. Una persona se vincula a su usuario por un dato cargado en la base (su `sub`) | — | initial |
