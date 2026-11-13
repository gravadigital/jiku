---
id: dockerfile
display_name: Dockerfile (workspace de monorepo, contexto en la raíz)
language: node
description: Two-stage Dockerfile built from the repo root so the service can consume the shared workspace packages
applies_to: [worker]
required_by: []
package: null
---

# Dockerfile (core)

> **Reemplaza** la convención `dockerfile` del catálogo, que asume un repositorio por servicio con
> el contexto de build en su raíz y una etapa de test. Acá el contexto es la **raíz del monorepo**,
> porque core consume paquetes del workspace, y no hay etapa de test: los tests corren en CI, antes
> de construir la imagen.

## Cuándo aplica

La imagen de producción del servicio.

## El contexto es la raíz del repo

```dockerfile
# docker build -f core/Dockerfile ..
```

Es la restricción que explica todo lo demás. Core depende de `@jiku/models`, `@jiku/nats-protocol` y
`@jiku/zitadel-auth`, que viven en `packages/`. Con el contexto en `core/` esos paquetes quedarían
fuera del build.

En CI se hace explícito:

```yaml
context: .
file: core/Dockerfile
```

**No cambies el contexto a `core/`**: el build falla al resolver los paquetes del workspace.

## Las dos etapas

### `builder`

```dockerfile
FROM node:24.12-alpine3.23 AS builder
WORKDIR /repo

# Primero los manifiestos, después el código: Docker cachea el `npm ci`, que es lo lento.
COPY package.json package-lock.json ./
COPY packages/models/package.json packages/models/
COPY packages/nats-protocol/package.json packages/nats-protocol/
COPY packages/zitadel-auth/package.json packages/zitadel-auth/
COPY core/package.json core/
RUN npm ci --ignore-scripts --workspace core --include-workspace-root

COPY packages packages
COPY core core
RUN npm run build --workspace @jiku/models \
 && npm run build --workspace @jiku/nats-protocol \
 && npm run build --workspace @jiku/zitadel-auth \
 && npm run build --workspace core
```

- **Manifiestos antes que código.** El `npm ci` es la capa cara; copiar primero solo los
  `package.json` hace que un cambio en un archivo fuente no la invalide.
- **`--ignore-scripts`**: en ese punto solo están los `package.json`, sin código fuente, así que el
  `postinstall` de la raíz —que compila `packages/*`— no tendría qué compilar. El build va explícito
  abajo.
- **Los paquetes se compilan antes que core**, en orden: su `package.json` apunta a `dist/`.

### `runner`

```dockerfile
FROM node:24.12-alpine3.23 AS runner
ENV TZ=UTC
ENV NODE_ENV=production
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/*/package.json ...
COPY core/package.json core/
RUN npm ci --omit=dev --ignore-scripts --workspace core --include-workspace-root \
 && npm cache clean --force

COPY --from=builder /repo/packages/models/dist packages/models/dist
COPY --from=builder /repo/packages/nats-protocol/dist packages/nats-protocol/dist
COPY --from=builder /repo/packages/zitadel-auth/dist packages/zitadel-auth/dist
COPY --from=builder /repo/core/dist core/dist

CMD ["node", "./core/dist/src/index.js"]
```

- Se reinstala con `--omit=dev` en vez de copiar el `node_modules` del builder, que trae las
  dependencias de desarrollo de todo el workspace.
- **`--ignore-scripts` acá es obligatorio**: el `postinstall` de la raíz compila `packages/*` con
  `tsc`, que no está en las dependencias de producción. Los `dist` se copian del builder.
- **`ENV TZ=UTC`.** El servicio guarda fechas `YYYY-MM-DD` como string: sin zona fija, la fecha de un
  registro dependería de la zona del host.
- **`NODE_ENV=production`** activa los transports de archivo de Winston y **desactiva
  `sequelize.sync()`** (`models/index.ts:56`). Si no está en `production`, core intentaría sincronizar
  el esquema contra la base real.

## Lo que la imagen no trae

- **No corre migraciones.** Las corre `api` al arrancar. Ver [`orm`](./orm.md).
- **No expone puerto.** No hay `EXPOSE` ni `HEALTHCHECK`: el servicio no atiende HTTP, así que no hay
  endpoint que sondear. Su salud es estar conectado al bus, y eso se ve en el log.
- **No trae las creds del bus.** `NATS_CREDS` apunta a un archivo que el compose monta como volumen.

## Reglas

- El contexto de build es la **raíz del repo**, siempre: `docker build -f core/Dockerfile ..`
- Los `package.json` se copian antes que el código fuente.
- `--ignore-scripts` en los dos `npm ci`.
- Los paquetes compartidos se compilan en el builder y se copian como `dist/`; no se compilan en el
  runner.
- El runner instala con `--omit=dev`. No copies el `node_modules` del builder.
- `NODE_ENV=production` y `TZ=UTC` se fijan en la imagen, no se dejan al compose.
- Una dependencia nueva del workspace se agrega en **cuatro lugares** del Dockerfile: el `COPY` de
  su `package.json` en las dos etapas, su `npm run build` en el builder, y el `COPY --from=builder`
  de su `dist`. Olvidarse uno rompe en runtime, no en build.
- No agregues `EXPOSE` ni `HEALTHCHECK`: no hay superficie HTTP.
- La versión de Node se cambia en `.nvmrc` y en las dos etapas, juntas.

## Integración con otras convenciones

- **[`ci-github`](./ci-github.md)**: quién construye la imagen y con qué tags.
- **[`env-config`](./env-config.md)**: qué variables espera el contenedor.
- **[`orm`](./orm.md)**: por qué `NODE_ENV=production` importa (`sequelize.sync()`).
