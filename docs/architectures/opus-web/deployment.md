# Deployment: opus-web

Imagen Docker publicada en Docker Hub como `gravadigital/jiku-opus-web`, servida detrás de
`nginx-proxy` con certificado de Let's Encrypt.

## La imagen

`opus-web/Dockerfile`, multi-stage, dos etapas.

### El contexto de build es la raíz del monorepo

No la carpeta del servicio. Está escrito en la primera línea del Dockerfile:

```dockerfile
# opus-web/Dockerfile:1-5
# El contexto de build es el ROOT del repo, no esta carpeta: opus-web es un workspace del
# monorepo, así que sus dependencias se resuelven desde el package-lock.json de la raíz.
#
#   docker build -f opus-web/Dockerfile ..
```

Un `docker build .` parado dentro de `opus-web/` **no funciona**: no encuentra el
`package-lock.json` de la raíz.

### Etapa `builder`

```dockerfile
FROM node:24.12-alpine3.23 AS builder
WORKDIR /repo

# Primero los manifiestos y después el código: así Docker cachea el `npm ci`, que es lo
# lento, y no lo repite cuando solo cambia un archivo fuente.
COPY package.json package-lock.json ./
COPY opus-web/package.json opus-web/
RUN npm ci --ignore-scripts --workspace opus-web --include-workspace-root

COPY opus-web opus-web
WORKDIR /repo/opus-web
RUN npm run build
```

Tres decisiones con su motivo:

| Qué | Por qué |
|---|---|
| Manifiestos antes que código | El `npm ci` es lo lento; cacheándolo aparte no se repite cuando solo cambia un fuente |
| `--ignore-scripts` | El `postinstall` de la raíz compila `packages/*`, que este frontend no consume. Además en esa capa solo están los `package.json`, sin código que compilar |
| `--workspace opus-web --include-workspace-root` | Instala solo este workspace y las dependencias hoisteadas de la raíz, no los otros tres servicios |

### Etapa `runner`

```dockerfile
FROM node:24.12-alpine3.23 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# En un workspace, `output: 'standalone'` emite el árbol del monorepo: los node_modules
# hoisteados quedan en la raíz de standalone/ y el server dentro de standalone/opus-web/.
COPY --from=builder --chown=nextjs:nodejs /repo/opus-web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/opus-web/.next/static ./opus-web/.next/static
COPY --from=builder /repo/opus-web/public ./opus-web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "opus-web/server.js"]
```

**El `CMD` es `opus-web/server.js`, no `server.js`.** Es la consecuencia de `output: 'standalone'`
en un workspace: Next emite el árbol del monorepo entero, con los `node_modules` hoisteados en la
raíz de `standalone/` y el servidor una carpeta adentro. El comentario del Dockerfile lo explica.
Es el mismo patrón que `web`, con su propio nombre de carpeta.

Corre como usuario **no-root** (`nextjs`, uid 1001).

`output: 'standalone'` se declara en `next.config.js:4`.

## Publicación

Dos workflows de GitHub Actions publican esta imagen, con la misma matriz de cuatro servicios
(`api`, `core`, `web`, `opus-web`).

| Workflow | Cuándo | Tags |
|---|---|---|
| `dev-images.yml` | Push a la rama de desarrollo | `dev` (se mueve) y `dev-{sha}` (inmutable) |
| `release.yml` | Tag de versión | El nombre del tag |

Los dos usan `context: .` (la raíz) y `file: opus-web/Dockerfile`, coherente con lo de arriba.

**Los dos tags de dev tienen un motivo escrito** (`dev-images.yml`): el inmutable
`dev-{sha}` es lo que hace diagnosticable una imagen de dev rota — sin él, "la imagen de dev de
ayer" es irrecuperable una vez que el tag se mueve.

La caché de buildx comparte scope entre los dos workflows a propósito: las capas son las mismas,
así que un build de dev calienta el de release y al revés.

`fail-fast: false` en la matriz, más un job `summary` que falla si alguno de los cuatro falló —
sin eso, una publicación parcial reportaría verde.

## CI

`ci.yml` corre en push a `main`/`dev` y en cada pull request, con `paths-ignore` para cambios
solo de documentación. Un solo job para todo el monorepo:

```yaml
- run: ./scripts/set-version.sh --check   # las versiones concuerdan
- run: npm run build
- run: npm run lint
- run: npm test
```

Los cuatro corren sobre los workspaces, así que `opus-web` no tiene pipeline propio: sus 296 tests
se ejecutan dentro de `npm test` de la raíz. El servicio de PostgreSQL del job es para `api` y
`core`; este frontend no lo usa.

`concurrency` con `cancel-in-progress`: un push nuevo cancela el anterior de la misma rama.

## Composición

### Producción — `deploy/docker-compose.yml`

```yaml
opus-web:
  image: gravadigital/jiku-opus-web:${OPUS_WEB_VERSION}
  container_name: jiku-${STAGE}-opus-web
  restart: always
  environment:
    - VIRTUAL_HOST=${OPUS_DOMAIN}
    - VIRTUAL_PORT=3000
    - LETSENCRYPT_HOST=${OPUS_DOMAIN}
    - API_URL=http://api:3000/
    # ... NEXTAUTH_* y ZITADEL_*
  networks:
    - ingress-network
```

Está **solo en `ingress-network`**, no en la red del bus. Es coherente: no habla con NATS ni con
la base; solo con `api`, que está en las dos.

`VIRTUAL_HOST` / `VIRTUAL_PORT` / `LETSENCRYPT_HOST` los consume `nginx-proxy` + `letsencrypt`.

`opus-web` y `web` tienen dominios distintos (`OPUS_DOMAIN` y `DOMAIN`) y versionado
independiente (`OPUS_WEB_VERSION`).

### Local — `deploy/docker-compose.local.yml`

Construye desde el fuente en vez de tirar la imagen:

```yaml
opus-web:
  build:
    context: ..
    dockerfile: opus-web/Dockerfile
  container_name: jiku-local-opus-web
  ports:
    - "3001:3000"
```

Publica el **3001** hacia afuera (el 3000 es de `web`). `deploy/local.sh:80` lo imprime al
levantar.

> **Los puertos del README de deploy no coinciden.** `deploy/README.md:95` y `:178` dicen que
> `opus-web` está en `localhost:3001`, y `:230` dice `opus-web on 3002`. El compose publica
> **3001**; el 3002 de esa línea no está en ningún archivo.

### Desarrollo sin Docker

```sh
npm run dev --workspace opus-web    # http://localhost:3000
```

`next dev` levanta en el 3000 por defecto, distinto del 3001 del contenedor. **Necesita la api
corriendo:** `API_URL` se lee en el servidor, así que solo tiene que ser alcanzable desde este
proceso.

## Qué no hay

- **Sin healthcheck.** Ni en el Dockerfile ni en el compose. `restart: always` reinicia si el
  proceso muere, pero un proceso vivo que no responde no se detecta.
- **Sin límites de recursos** declarados en el compose.
- **Sin réplicas ni estrategia de rollout.** Es un `docker compose up` con una instancia.
- **Sin tests end-to-end** que verifiquen la imagen construida. El CI corre unitarios sobre el
  fuente; que la imagen levante y sirva no se prueba en el pipeline.
