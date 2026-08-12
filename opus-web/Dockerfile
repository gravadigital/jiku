# El contexto de build es el ROOT del repo, no esta carpeta: opus-web es un workspace del
# monorepo, así que sus dependencias se resuelven desde el package-lock.json de la raíz.
#
#   docker build -f opus-web/Dockerfile ..
#
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
