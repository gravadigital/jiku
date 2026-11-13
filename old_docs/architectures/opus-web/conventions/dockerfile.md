---
id: dockerfile
display_name: Dockerfile (Next.js en workspace de monorepo)
language: nextjs
description: Multi-stage con contexto en la raíz del monorepo, standalone, usuario no-root
applies_to: [frontend]
required_by: []
package: null
---

# Dockerfile (opus-web)

> **Convención nueva**, sin equivalente directo en el catálogo. Documenta las decisiones que hacen
> que un Next.js dentro de un workspace npm se empaquete bien — que no son las del Dockerfile de
> Next.js estándar.

## La regla que rompe todo si se ignora

**El contexto de build es la raíz del repositorio, no la carpeta del servicio.** Está en la
primera línea del archivo:

```dockerfile
# opus-web/Dockerfile:1-5
# El contexto de build es el ROOT del repo, no esta carpeta: opus-web es un workspace del
# monorepo, así que sus dependencias se resuelven desde el package-lock.json de la raíz.
#
#   docker build -f opus-web/Dockerfile ..
```

Un `docker build .` parado dentro de `opus-web/` **falla**: no encuentra el `package-lock.json` de
la raíz.

Los workflows lo respetan con `context: .` y `file: opus-web/Dockerfile`
(ver [ci-github](./ci-github.md)), y `docker-compose.local.yml:186-188` con
`context: ..` + `dockerfile: opus-web/Dockerfile`.

## Etapa `builder`

```dockerfile
FROM node:24.12-alpine3.23 AS builder
WORKDIR /repo

# Primero los manifiestos y después el código: así Docker cachea el `npm ci`, que es lo
# lento, y no lo repite cuando solo cambia un archivo fuente.
COPY package.json package-lock.json ./
COPY opus-web/package.json opus-web/
# --ignore-scripts: el postinstall del root compila packages/*, que estos fronts no
# consumen, y acá solo están los package.json (sin código que compilar).
RUN npm ci --ignore-scripts --workspace opus-web --include-workspace-root

COPY opus-web opus-web

WORKDIR /repo/opus-web
RUN npm run build
```

Cuatro decisiones, todas con su comentario:

| Qué | Por qué |
|---|---|
| Manifiestos antes que código | El `npm ci` es lo lento. Cacheándolo aparte no se repite cuando solo cambia un fuente |
| `--ignore-scripts` | El `postinstall` de la raíz compila `packages/*`, que este frontend no consume. Y en esa capa solo están los `package.json`, sin código que compilar |
| `--workspace opus-web` | Instala solo este workspace, no los otros tres servicios |
| `--include-workspace-root` | Necesario para las dependencias hoisteadas en la raíz |

**Regla:** el orden `COPY manifiestos → npm ci → COPY código` no se altera. Invertirlo invalida la
caché del `npm ci` en cada cambio de código.

> **`--ignore-scripts` es válido *porque* este servicio no consume `packages/*`.** Si algún día
> importara `@jiku/models`, este flag habría que sacarlo — y entonces el `COPY` de manifiestos
> tendría que incluir también los de `packages/`.

## Etapa `runner`

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

### `output: 'standalone'` y las rutas que produce

Declarado en `next.config.js:4`. Emite un árbol autocontenido con solo las dependencias que el
runtime necesita — sin él habría que copiar `node_modules` entero.

**En un workspace, ese árbol replica la estructura del monorepo.** De ahí las tres rutas del
`COPY`:

| Origen | Destino | Qué es |
|---|---|---|
| `.next/standalone` | `./` | El árbol: `node_modules/` hoisteados en la raíz y `opus-web/server.js` adentro |
| `.next/static` | `./opus-web/.next/static` | Los assets con hash, que `standalone` no incluye |
| `public` | `./opus-web/public` | Estáticos servidos tal cual |

**Y de ahí el `CMD`:**

```dockerfile
CMD ["node", "opus-web/server.js"]     # NO "server.js"
```

Es el error clásico al copiar este Dockerfile a otro servicio: el nombre de la carpeta cambia.
`web/Dockerfile` tiene el mismo patrón con `web/server.js`.

### `HOSTNAME=0.0.0.0`

Sin esto, el server de Next escucha en `localhost` dentro del contenedor y **nadie lo alcanza desde
afuera**. Es obligatorio en cualquier contenedor.

### Usuario no-root

`nextjs` (uid 1001) del grupo `nodejs` (gid 1001), creados como `--system`. El `--chown` en los dos
primeros `COPY` evita un `RUN chown` posterior, que duplicaría la capa.

`public` se copia **sin `--chown`**: el proceso solo la lee.

## Configuración en runtime, no en build

**Ninguna variable de entorno se hornea en la imagen.** No hay ningún `ARG`, ni `NEXT_PUBLIC_*`
que se resuelva en build.

Es lo que permite que la misma imagen sirva en cualquier entorno. Y es coherente con la
arquitectura: el navegador llama a `/api/opus/*` de su propio origen, así que **el bundle no
necesita saber dónde está la api**. `API_URL` la lee el route handler, en el servidor, en cada
request.

```ts
// src/app/api/opus/[...path]/route.ts:16
const API_URL = () => process.env.API_URL ?? '';
```

Una función, no una constante — se evalúa por request.

**Regla:** no agregar un `ARG` ni una `NEXT_PUBLIC_*` al Dockerfile. Eso ataría la imagen a un
despliegue.

Las únicas dos `ENV` de build son `NODE_ENV=production` y `NEXT_TELEMETRY_DISABLED=1`, que no
dependen del entorno.

> **`next.config.js:10-12` sí inyecta una variable en build:** `NEXT_PUBLIC_APP_VERSION` desde
> `npm_package_version`. No se lee en ningún archivo de `src/`, así que hoy no ata nada.

## `.dockerignore`

`opus-web/.dockerignore` existe, pero **con el contexto en la raíz el que aplica es el de la raíz**
(`/.dockerignore`). El del servicio queda sin efecto para este build.

## Qué no hay

- **Sin `HEALTHCHECK`.** Ni en el Dockerfile ni en el compose. `restart: always` reinicia un
  proceso muerto, pero uno vivo que no responde no se detecta.
- **Sin etapa de test.** Los tests corren en CI sobre el fuente, no dentro del build.
- **Sin multi-arquitectura.** Se construye solo para la arquitectura del runner.
- **Sin escaneo de vulnerabilidades** de la imagen.

## Checklist para tocar este Dockerfile

1. ¿El `COPY` de manifiestos sigue antes del `npm ci`?
2. ¿El `CMD` sigue apuntando a `opus-web/server.js` con la carpeta correcta?
3. ¿`HOSTNAME=0.0.0.0` sigue puesto?
4. ¿Sigue corriendo como `nextjs`, sin volver a `root`?
5. ¿No agregaste ningún `ARG` ni `NEXT_PUBLIC_*`?
6. Probarlo desde la raíz: `docker build -f opus-web/Dockerfile .`
