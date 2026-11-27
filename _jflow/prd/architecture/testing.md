# How it is tested

How each entry point of the product is tested end to end, against `make up` and through its real interface: the identity each role comes in with and how each external system is replaced. `jflow.py def-check` requires a row per surface, per exposed interface (`Exposes` in services.md), per role and per external integration.

## Entry points

| Entry point | Type | Service | Actors | How it is tested | Test | Origin |
|---|---|---|---|---|---|---|
| Gestor interno | web | web | U-01, U-02 | Playwright (Chromium) en la imagen oficial, con la red del host: entra a `http://localhost:3000`, hace el login con código + PKCE contra el proveedor de identidad falso, elige el usuario y llega a la aplicación; un error de consola falla el test | `services/web/e2e/login.e2e.ts` | initial |
| Portal de clientes | web | opus-web | U-03, U-02 | Playwright (Chromium) contra `http://localhost:3001`: el test crea cliente y proyecto por la api como administrador, da permiso al usuario de cliente en la base, entra como ese usuario por el login del proveedor falso y ve el proyecto; un error de consola falla el test | `services/opus-web/e2e/portal.e2e.ts` | initial |
| Documento compartido | web | api | U-05 | Cliente HTTP anónimo contra `GET /p/docs/{token}` de la api de `make up`: sin el módulo jiku-docs instalado la página pública responde la misma página genérica para cualquier causa, que es lo que se verifica | `services/api/e2e/api.e2e.ts` | initial |
| api HTTP | HTTP | api | U-01, U-02, U-03 | Cliente HTTP contra `http://localhost:3100` con access tokens reales del proveedor falso: sin token responde 401; el administrador crea un cliente y un proyecto, que viajan por NATS y el auth-callout hasta core y la base, y un miembro del equipo los lee; un usuario de cliente recibe 403 en los requisitos internos | `services/api/e2e/api.e2e.ts` | initial |
| core NATS | NATS | core | U-02, U-03, U-04 | Cliente NATS contra `nats://localhost:4222` con las credenciales sentinel y el token de la persona: el auth-callout real lo autoriza según su rol, consulta `projects.list` por `jiku-queries` y recibe éxito; publicar en el subject de otra identidad no se entrega. El rol `internal-app` lo ejerce la propia api en el test de api HTTP | `services/core/e2e/core.e2e.ts` | initial |

## Test identities

| Role | How the identity is obtained in tests | Origin |
|---|---|---|
| admin | Usuario `admin` (Ana Admin) del proveedor de identidad falso (`deploy/test/fake-idp/users.json`): en el navegador se elige en su página de login; los clientes HTTP y NATS piden el token firmado a `GET /test/token?user=admin`. Los tokens llevan los mismos claims que Zitadel (`sub`, `aud`, `urn:zitadel:iam:org:project:roles` y el del proyecto) | initial |
| user | Usuario `user` (Uriel Usuario) del proveedor falso, igual que admin | initial |
| external-user | Usuario `external` (Elena Externa) del proveedor falso, igual que admin; su permiso sobre un proyecto lo crea el test en `user_project_permissions` | initial |
| internal-app | Usuario de máquina `jiku-api` del proveedor falso: al arrancar escribe su clave en el volumen `idp-keys` y la api pide el token con el grant jwt-bearer, como con Zitadel. Es el publicador de confianza (`CORE_TRUSTED_PUBLISHER_ID`) | initial |
| core | Usuario de máquina `jiku-core` del proveedor falso, con su clave en el volumen `idp-keys` y el grant jwt-bearer | initial |
| docs | No se usa en las pruebas: es la identidad del módulo externo jiku-docs, que no forma parte del stack local (ver INT-04) | initial |

## External systems

| System | How it is replaced in tests | Origin |
|---|---|---|
| INT-01 Zitadel (proveedor de identidad: OIDC, JWKS, userinfo, jwt-bearer) | El proveedor de identidad falso `deploy/test/fake-idp` (servicio `fake-idp` del compose, emisor `http://idp.localhost:9400`): discovery, JWKS, autorización con código + PKCE, token (código y jwt-bearer), userinfo y fin de sesión en las mismas rutas que Zitadel. Los servicios y el auth-callout apuntan a él solo por configuración | initial |
| INT-02 Almacenamiento S3 compatible | MinIO local (servicio `storage`, alias `storage.localhost:9000` para que la URL prefirmada sea la misma para core y para el navegador), con el bucket creado por `storage-setup` | initial |
| INT-03 Servidor SMTP | Mailpit (servicio `mailpit`, SMTP en 1025, interfaz en `http://localhost:8025`) | initial |
| INT-04 jiku-docs (módulo opcional de documentación, por el bus, descubierto en el KV `JIKU_MODULES`) | No se reemplaza: el módulo opcional no está en el stack local, y la api se comporta como sin el módulo instalado (las rutas de documentación responden que el módulo no está disponible). Sus pruebas con el módulo son de integración, con un doble del bus | initial |
| INT-05 NATS auth-callout (gravadigital/nats-zitadel-auth-callout) | No se reemplaza: corre la imagen real `gravadigital/nats-zitadel-auth-callout:1.0.0` con las reglas del repositorio, validando los tokens contra el proveedor falso; la identidad de NATS la genera `deploy/nats/bootstrap.sh` en un contenedor | initial |

## How to run them

`make test-e2e` levanta el producto con `make up` si no está (`docker compose up -d --build --wait`: todo con Docker, sin credenciales) y corre el nivel end to end de cada servicio (`S=` limita a uno). Los datos de prueba los crea cada test (por la api como administrador; el permiso de proyecto del usuario de cliente, que el producto no escribe, directo en la base). Los reportes JUnit quedan en `reports/junit/{servicio}-e2e.xml` y las capturas en `reports/screenshots/` y `reports/playwright/`. Los tests de integración usan el servicio `postgres-test` (perfil `test`) con el esquema que construyen las migraciones. El nivel end to end corre solo localmente, nunca en el CI.
