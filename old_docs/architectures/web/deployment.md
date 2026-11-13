# Deployment: web

## Imagen

| | |
|---|---|
| Nombre | `gravadigital/jiku-web` |
| Base | `node:24.12-alpine3.23` |
| Etapas | `builder`, `runner` |
| Usuario | `nextjs` (uid 1001), grupo `nodejs` (gid 1001) |
| Puerto | 3000 |
| Entrypoint | `node web/server.js` |

El detalle del Dockerfile y sus reglas está en
[`conventions/dockerfile.md`](./conventions/dockerfile.md). Lo esencial para operar:

- **El contexto de build es la raíz del monorepo:** `docker build -f web/Dockerfile ..`
- **El `CMD` es `web/server.js`, no `server.js`.** `output: 'standalone'` en un workspace emite el
  árbol del monorepo.
- **La imagen no lleva configuración.** Ninguna variable tiene prefijo `NEXT_PUBLIC_`, así que la
  misma imagen sirve para cualquier entorno.

## Publicación

Por GitHub Actions, con matriz de los cuatro servicios. Ver
[`conventions/ci-github.md`](./conventions/ci-github.md).

| Disparador | Tags |
|---|---|
| Push a la rama de desarrollo | `dev` (se mueve) y `dev-<sha>` (inmutable) |
| Tag de versión | versión exacta, serie minor, `latest` |

## Arranque

No hay secuencia de arranque: no hay migraciones ni conexión a base. El proceso levanta y sirve.

**Dependencias en runtime:**

| Dependencia | Cuándo se necesita | Qué pasa si no está |
|---|---|---|
| `api` (`API_URL`) | En cada request de datos | Las pantallas fallan con el `error.tsx` de la ruta o quedan vacías. **El login sigue funcionando** |
| Zitadel (`ZITADEL_ISSUER`) | Login y refresh de descubrimiento OIDC | Nadie puede loguearse. Las sesiones ya emitidas siguen válidas hasta expirar |

**Consecuencia práctica:** `web` levanta y responde aunque `api` esté caída. No hay healthcheck que
lo detecte.

## Composición

```yaml
# deploy/docker-compose.yml:9-27
web:
  image: gravadigital/jiku-web:${WEB_VERSION}
  container_name: jiku-${STAGE}-web
  restart: always
  environment:
    - VIRTUAL_HOST=${DOMAIN}
    - VIRTUAL_PORT=3000
    - LETSENCRYPT_HOST=${DOMAIN}
    - API_URL=http://api:3000/
    - APP_NAME=${APP_NAME:-Jiku}
    - EXTERNAL_LINKS=${EXTERNAL_LINKS:-}
    - AUTH_URL=https://${DOMAIN}
    - AUTH_SECRET=${WEB_NEXTAUTH_SECRET}
    - ZITADEL_ISSUER=${IDENTITY_ISSUER}
    - ZITADEL_CLIENT_ID=${IDENTITY_CLIENT_ID}
    - ZITADEL_PROJECT_ID=${IDENTITY_PROJECT_ID}
  networks:
    - ingress-network
```

**Notas:**

- Solo está en `ingress-network`, junto a `api`. No toca la red del bus ni la de la base.
- TLS y virtual host los resuelve `nginx-proxy` + `letsencrypt` con `VIRTUAL_HOST` /
  `LETSENCRYPT_HOST`. La aplicación no maneja certificados.
- `restart: always`.
- `web` y `opus-web` corren la misma configuración de identidad con **secretos de sesión
  distintos**.

## No hay

Registrado explícitamente, porque su ausencia es lo que hay que saber al operar:

- **Healthcheck.** Ni en el Dockerfile ni en el compose. El contenedor "arriba" no implica que
  pueda hablar con la api.
- **Límites de recursos.** Sin `mem_limit` ni `cpus`.
- **Observabilidad.** Sin métricas, sin tracing, sin log estructurado. Los logs son
  `console.warn`/`console.error` a stdout, en texto plano. `api` y `core` sí tienen logger; `web`
  no.
- **Estrategia de rollback documentada.** El mecanismo existe (tags inmutables `dev-<sha>` y
  versiones exactas), pero el procedimiento no está escrito.
- **Sesiones persistentes.** La sesión es un JWT en cookie: escalar a varias réplicas no necesita
  almacenamiento compartido, pero todas las réplicas necesitan el **mismo `AUTH_SECRET`**.

## Verificación después de desplegar

1. `GET https://{DOMAIN}/login` responde 200 y muestra "Bienvenido".
2. El login redirige a Zitadel y vuelve. Termina en `/`, que hoy muestra `<h1>Home</h1>` — ver
   limitaciones conocidas en [`overview.md`](./overview.md).
3. Navegar a `/clients`: si lista actores, `API_URL` y el token funcionan.
4. Confirmar que el usuario tiene rol: sin roles la navegación aparece pero la api responde 401.
5. Revisar los logs del contenedor: no debe aparecer ningún `===== ACCESS TOKEN =====`. Si aparece,
   `LOG_ACCESS_TOKEN` quedó definido.
