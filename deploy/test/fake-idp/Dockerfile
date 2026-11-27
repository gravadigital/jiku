# Fake identity provider for the local stack and the end-to-end tests (see server.js).
# No dependencies: only Node's standard library.
FROM node:24-alpine
WORKDIR /app
COPY server.js users.json ./
# The machine-user key files go here; a named volume mounted on it keeps this ownership.
RUN mkdir /keys && chown node:node /keys
USER node
EXPOSE 9400
HEALTHCHECK --interval=2s --timeout=2s --retries=30 CMD wget -qO- http://127.0.0.1:9400/health || exit 1
CMD ["node", "server.js"]
