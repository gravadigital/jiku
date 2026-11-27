---
flow: autenticacion-y-entrada
requirements: [ACC-01, ACC-02, ACC-03, ACC-04, ACC-05, ACC-06, ACC-07, ACC-08, ACC-09, ACC-10, ACC-11, ACC-13, ACC-15, ACC-16, ACC-17, ACC-19]
modules: [api.access, core.identity]
---

# Ingreso al gestor interno y al portal de clientes

Una persona ingresa al gestor interno o al portal con su cuenta del proveedor de identidad; la sesión del frontend lleva su token de acceso, que la api valida en cada operación.

| # | From → To | What happens | Operation / table | Rules |
|---|---|---|---|---|
| 1 | navegador → web / opus-web | Sin sesión, cualquier pantalla redirige al ingreso; «Iniciar sesión» lleva al proveedor de identidad | — | ACC-01, ACC-02, ACC-05, ACC-09, ACC-E4 |
| 2 | web / opus-web → proveedor de identidad | Flujo de código de autorización con PKCE pidiendo los roles del proyecto; vuelve con el token de acceso y el de identidad | — | ACC-03 |
| 3 | web / opus-web | Guarda la sesión en la cookie de la aplicación con el token de acceso, los roles (claves del claim de roles del proyecto) y el `sub`; la sesión que llega al navegador incluye el token de acceso | — | ACC-03, ACC-17 |
| 4 | web / opus-web → api.access | La pantalla de entrada presenta la identidad ante la api desde el servidor; si falla, se ignora | `POST /auth/present` | ACC-04, ACC-E3 |
| 5 | api.access | Valida el token y responde 200 con cuerpo vacío: no lee ni escribe la base | — | ACC-04 |
| 6 | web | El gestor manda a «Acceso no autorizado» a quien tenga el rol `external-user`; al resto lo deja entrar aunque no tenga roles, y abre «Proyectos» | — | ACC-06, ACC-07 |
| 7 | opus-web | El portal no corta por rol y abre la lista de proyectos | `GET /opus/projects` | ACC-08 |
| 8 | web / opus-web → api.* | Cada operación lleva el token como `Authorization: Bearer` (en el gestor desde el servidor; en el portal por su proxy) | toda operación salvo `GET /p/docs/{token}` | ACC-15 |
| 9 | api.access | Verifica la firma contra las claves públicas del proveedor (sin emisor ni audiencia; ante una clave desconocida las vuelve a descargar) y arma la identidad solo con el token, sin consultar la base | — | ACC-16, ACC-E1 |
| 10 | api.* → core | En cada comando, la api agrega el sobre de identidad con id, roles y perfil del token; core crea o actualiza el usuario antes de autorizar | `users` | ACC-19, ACC-E6 |
| 11 | web / opus-web | La sesión vence a las 12 horas en el gestor o al vencer el token de acceso, y no se renueva; «Cerrar sesión» borra solo la sesión de la aplicación | — | ACC-10, ACC-11, ACC-13 |
