# El contexto de build es el ROOT del repo, no esta carpeta: core depende de los paquetes
# del workspace (@jiku/models, @jiku/nats-protocol) que viven en packages/.
#
#   docker build -f services/core/Dockerfile ..
#
FROM node:24.12-alpine3.23 AS builder

WORKDIR /repo

# Primero los manifiestos y después el código: así Docker cachea el `npm ci`, que es lo
# lento, y no lo repite cuando solo cambia un archivo fuente.
COPY package.json package-lock.json ./
COPY packages/models/package.json packages/models/
COPY packages/nats-protocol/package.json packages/nats-protocol/
COPY packages/zitadel-auth/package.json packages/zitadel-auth/
COPY services/core/package.json services/core/
# --ignore-scripts: en este punto solo están los package.json, sin código fuente, así
# que el postinstall del root no tendría qué compilar. El build explícito va abajo.
RUN npm ci --ignore-scripts --workspace services/core --include-workspace-root

COPY packages packages
COPY services/core services/core
RUN npm run build --workspace @jiku/models \
 && npm run build --workspace @jiku/nats-protocol \
 && npm run build --workspace @jiku/zitadel-auth \
 && npm run build --workspace services/core

FROM node:24.12-alpine3.23 AS runner

ENV TZ=UTC
ENV NODE_ENV=production

WORKDIR /repo

# Solo las dependencias de producción. El node_modules del builder trae también las de
# desarrollo de todo el workspace.
COPY package.json package-lock.json ./
COPY packages/models/package.json packages/models/
COPY packages/nats-protocol/package.json packages/nats-protocol/
COPY packages/zitadel-auth/package.json packages/zitadel-auth/
COPY services/core/package.json services/core/
# --ignore-scripts: el postinstall del root compila packages/* con tsc, que no está
# en las dependencias de producción. Acá no hace falta: los dist se copian del builder.
RUN npm ci --omit=dev --ignore-scripts --workspace services/core --include-workspace-root \
 && npm cache clean --force

# Los paquetes compartidos se consumen compilados: su package.json apunta a dist/.
COPY --from=builder /repo/packages/models/dist packages/models/dist
COPY --from=builder /repo/packages/nats-protocol/dist packages/nats-protocol/dist
COPY --from=builder /repo/packages/zitadel-auth/dist packages/zitadel-auth/dist
COPY --from=builder /repo/services/core/dist services/core/dist

CMD ["node", "./services/core/dist/src/index.js"]
