---
id: dockerfile
display_name: Dockerfile (Next.js en workspace de monorepo)
language: nextjs
description: Multi-stage con output standalone y contexto en la raíz del monorepo
applies_to: [frontend]
required_by: []
package: null
---

# Dockerfile (web)

> **Reemplaza** la convención `dockerfile` del catálogo. Comparte lo esencial (multi-stage,
> `output: 'standalone'`, runtime no-root) pero difiere en tres puntos que el catálogo no cubre:
> **el contexto de build es la raíz del monorepo**, el install usa flags de workspace, y el árbol
> que emite `standalone` tiene una forma distinta.

## El contexto es la raíz, no `web/`

```sh
docker build -f web/Dockerfile ..
```

Está documentado en la cabecera del propio archivo:

```dockerfile
# El contexto de build es el ROOT del repo, no esta carpeta: web es un workspace del
# monorepo, así que sus dependencias se resuelven desde el package-lock.json de la raíz.
```

**Regla:** cualquier comando o pipeline que buildee esta imagen tiene que usar la raíz como
contexto. Buildear desde `web/` falla: no encuentra el lockfile.

## Etapas

Dos: `builder` y `runner`. **No hay etapa `test`** — a diferencia del catálogo, los tests corren en
CI con Node directo, no en Docker (ver [`ci-github.md`](./ci-github.md)).

```dockerfile
FROM node:24.12-alpine3.23 AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /repo

# Primero los manifiestos y después el código: así Docker cachea el `npm ci`, que es lo
# lento, y no lo repite cuando solo cambia un archivo fuente.
COPY package.json package-lock.json ./
COPY web/package.json web/
RUN npm ci --ignore-scripts --workspace web --include-workspace-root

COPY web web
WORKDIR /repo/web
RUN npm run build
```

**Reglas:**

- **Manifiestos antes que código.** Es lo que hace que un cambio de fuente no reinstale
  dependencias.
- `--workspace web --include-workspace-root`: instala solo lo de este workspace más lo de la raíz.
  Sin `--include-workspace-root` faltan las devDependencies compartidas.
- `--ignore-scripts` está por un motivo concreto, documentado:

  ```dockerfile
  # --ignore-scripts: el postinstall del root compila packages/*, que estos fronts no
  # consumen, y acá solo están los package.json (sin código que compilar).
  ```

  En este punto del build solo se copiaron los `package.json`, así que el `postinstall` fallaría de
  todas formas. **Si `web` alguna vez consume `@jiku/models`, este flag hay que revisarlo.**
- `libc6-compat` es necesario en alpine para los binarios nativos (`sharp`).

## Runtime

```dockerfile
FROM node:24.12-alpine3.23 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# En un workspace, `output: 'standalone'` emite el árbol del monorepo: los node_modules
# hoisteados quedan en la raíz de standalone/ y el server dentro de standalone/web/.
# Por eso se copia todo el árbol y el CMD apunta a web/server.js.
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/web/.next/static ./web/.next/static
COPY --from=builder /repo/web/public ./web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "web/server.js"]
```

**Reglas:**

- **`CMD` apunta a `web/server.js`, no a `server.js`.** Es la consecuencia directa de ser un
  workspace: `standalone/` reproduce el árbol del monorepo, con los `node_modules` hoisteados en su
  raíz y el server bajo `web/`. Es el error más fácil de cometer al copiar este Dockerfile de un
  proyecto de un solo paquete.
- `static` y `public` van a `./web/...`, no a `./`, por el mismo motivo.
- Usuario no-root `nextjs` (uid 1001), y `--chown` en los `COPY` de contenido dinámico.
- `HOSTNAME=0.0.0.0` es obligatorio: sin eso el server de Next escucha en localhost y el
  contenedor no responde desde afuera.
- `NEXT_TELEMETRY_DISABLED=1`.

## Requisito en `next.config.js`

```js
output: 'standalone',
```

Sin eso la etapa `runner` no tiene qué copiar. También está configurado:

```js
experimental: { serverActions: { bodySizeLimit: '10mb' } },
sassOptions: { includePaths: [path.join(__dirname, 'styles')] },
compiler: { styledComponents: true },
```

**Notas:**

- `bodySizeLimit: '10mb'` es el techo de las Server Actions. **El upload de adjuntos no pasa por
  ahí** — va por el route handler `/api/attachments`, que no tiene ese límite.
- `compiler.styledComponents: true` está activo pero **`styled-components` no es dependencia del
  proyecto** ni se importa en ningún archivo. Configuración sin uso.

## Configuración en runtime, no en build

La imagen **no lleva configuración**. Todas las variables se inyectan al arrancar el contenedor:

```yaml
# deploy/docker-compose.yml
web:
  image: gravadigital/jiku-web:${WEB_VERSION}
  environment:
    - API_URL=http://api:3000/
    - AUTH_URL=https://${DOMAIN}
    - AUTH_SECRET=${WEB_NEXTAUTH_SECRET}
    - ZITADEL_ISSUER=${IDENTITY_ISSUER}
    # ...
```

**Regla:** esto funciona porque **ninguna variable tiene prefijo `NEXT_PUBLIC_`**. Un
`NEXT_PUBLIC_*` se embebe en el bundle en build time y obligaría a una imagen por entorno. Ver
[`../environment.md`](../environment.md).

## Qué NO hacer

- No buildear con `web/` como contexto.
- No cambiar el `CMD` a `server.js`.
- No introducir variables `NEXT_PUBLIC_*`: rompe la imagen única para todos los entornos.
- No sacar `--ignore-scripts` sin verificar si `web` ya consume `packages/*`.
- No correr como root.
