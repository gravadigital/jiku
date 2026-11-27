# Fake jiku-docs module for the local stack and the end-to-end tests (see server.js).
# One dependency: the NATS client, pinned to the version the services use.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js ./
USER node
CMD ["node", "server.js"]
