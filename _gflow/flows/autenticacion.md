---
flow: autenticacion
requirements: [ACC-01, ACC-02, ACC-03, ACC-04, ACC-06, ACC-07, ACC-08, ACC-14, ACC-15, ACC-E1, ACC-E6, ACC-E7]
modules: [api.other, core.identity]
---

# Autenticación y espejo de identidades

Una persona entra con su cuenta de Zitadel a cualquiera de las dos superficies y se presenta ante la api; el producto mantiene el espejo de su identidad con el sobre actor de cada comando y con el evento de autenticación que el auth-callout publica en cada conexión al bus.

| # | Desde → Hacia | Qué pasa | Operación / tabla | Reglas |
|---|---|---|---|---|
| 1 | navegador → web u opus-web | Sin sesión, cualquier pantalla lleva al login | web: `proxy.ts` → `/login`; opus-web: middleware → `/login` | ACC-01, ACC-02 |
| 2 | web u opus-web → Zitadel | Inicia el login OIDC con PKCE pidiendo los scopes de roles y de audiencia del proyecto | `signIn('zitadel')` → `{ZITADEL_ISSUER}` | ACC-01, ACC-02 |
| 3 | Zitadel → web u opus-web | Vuelve con el código; NextAuth obtiene el access token y guarda la sesión con el `sub`, los roles del claim y el vencimiento | `/api/auth/callback/zitadel`; cookie de sesión (CRED-01, CRED-02) | ACC-06 |
| 4 | web u opus-web → api | Al terminar el login se presenta; si falla, el ingreso sigue igual | `POST /api/auth/present` (desde `/login/enter` en web) | ACC-03 |
| 5 | api → api | Verifica el token contra las claves de Zitadel y responde vacío sin registrar nada | 200 `{}` | ACC-08, ACC-E1, GAR-36 |
| 6 | web → navegador | Un Cliente va a «Acceso no autorizado»; los demás, a Proyectos | `/unauthorized` o `/projects` | ACC-04, ACC-E6 |
| 7 | opus-web → api | Lista los proyectos accesibles y entra al tablero del primero en orden alfabético, o muestra que no tiene acceso a ninguno | `GET /api/opus/projects` | ACC-02, ACC-E7 |
| 8 | api → core | En cada comando que publica en nombre de la persona va el sobre actor | `{instance}.{user-id}.jiku-commands.v1.{método}` | ACC-10 |
| 9 | core → PostgreSQL | Espeja el actor antes de autorizar, en su propia transacción (mejor esfuerzo) | `users` (`id` = `sub`, nombre, usuario, email, roles) | ACC-14, INV-21, GAR-26 |
| 10 | identidad → NATS → auth-callout | Toda identidad que conecta al bus (api, core, conectores, jiku-docs, personas con cliente NATS) presenta las credenciales del sentinel y su token; el callout lo valida y mintea los permisos de la plantilla de su rol | `rules.yaml` y plantillas | GAR-53 |
| 11 | auth-callout → core | Publica el evento de la identidad autenticada, enriquecido con su perfil; core lo recibe en una sola réplica | `{instance}.events.auth` (`type` `authenticated`, `version` 2), queue group `jiku-events` | ACC-14, GAR-52 |
| 12 | core → PostgreSQL | Valida instancia y esquema (si no, lo descarta con un aviso en el log, sin reintento) y reemplaza los cinco campos de la identidad; `identity_type` = `service` para los roles `internal-app`, `core` y `docs` | `users` | ACC-14, ACC-15, INV-21, GAR-25, GAR-26 |
| 13 | navegador → web u opus-web | Cerrar sesión borra la sesión local y vuelve al login, sin cerrar la sesión de Zitadel | `signOut` | ACC-07 |
