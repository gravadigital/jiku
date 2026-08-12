# El contexto de build es el ROOT del repo, no esta carpeta: web es un workspace del
# monorepo, así que sus dependencias se resuelven desde el package-lock.json de la raíz.
#
#   docker build -f web/Dockerfile ..
#
FROM node:24.12-alpine3.23 AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /repo

# Primero los manifiestos y después el código: así Docker cachea el `npm ci`, que es lo
# lento, y no lo repite cuando solo cambia un archivo fuente.
COPY package.json package-lock.json ./
COPY web/package.json web/
# --ignore-scripts: el postinstall del root compila packages/*, que estos fronts no
# consumen, y acá solo están los package.json (sin código que compilar).
RUN npm ci --ignore-scripts --workspace web --include-workspace-root

COPY web web

WORKDIR /repo/web
RUN npm run build

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
