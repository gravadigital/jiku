---
id: dockerfile
display_name: Dockerfile (workspace de monorepo, contexto en la raíz)
language: node
description: Multi-stage Dockerfile built from the monorepo root so workspace packages resolve
applies_to: [api]
required_by: []
package: null
---

# Dockerfile (api)

> **Reemplaza** la convención `dockerfile` del catálogo, que asume un servicio en su propio
> repositorio con el contexto de build en su carpeta. Acá el contexto es **la raíz del monorepo**,
> porque la api depende de tres paquetes del workspace.

## Cuándo aplica

El build de la imagen del servicio, en local y en CI.

## El contexto es la raíz, no `api/`

```sh
docker build -f api/Dockerfile ..
```

Si construís desde `api/`, los `COPY packages ...` fallan: los paquetes del workspace no están en
el contexto. La razón está escrita en la cabecera del propio Dockerfile.

## Dos etapas

```
builder  (node:24.12-alpine3.23)
   COPY package.json package-lock.json               ← manifiestos primero
   COPY packages/{models,nats-protocol,zitadel-auth}/package.json
   COPY api/package.json
   RUN npm ci --ignore-scripts --workspace api --include-workspace-root
   COPY packages packages
   COPY api api
   RUN build de los 3 paquetes → generate-api-doc → build de la api

runner   (node:24.12-alpine3.23)
   NODE_ENV=production
   RUN npm ci --omit=dev --ignore-scripts --workspace api --include-workspace-root
   COPY --from=builder  los dist/ de los 3 paquetes y de la api
   COPY api/db-upgrade                               ← las migraciones van a la imagen
   COPY api/.env.defaults → api/.env
   CMD ["npm", "run", "built-start"]
```

### Manifiestos antes del código

Los `package.json` se copian antes que las fuentes para que Docker cachee el `npm ci`, que es el
paso lento, y no lo repita cuando solo cambia un archivo `.ts`.

> Si agregás un paquete al workspace del que dependa la api, agregá su `COPY {pkg}/package.json`
> **en las dos etapas**, junto a los otros tres. Omitirlo en `runner` hace que la imagen falle al
> arrancar, no al construir.

### `--ignore-scripts` en las dos etapas, por razones distintas

| Etapa | Por qué |
|---|---|
| `builder` | en ese punto solo están los `package.json`, sin fuentes, así que el `postinstall` del root no tendría qué compilar. El build va explícito después |
| `runner` | el `postinstall` compila `packages/*` con `tsc`, que no está en las dependencias de producción. Acá no hace falta: los `dist` se copian del builder |

Quitarlo rompe el build. Está comentado en ambos lugares.

## `TZ=UTC`

Fijada en las dos etapas. Las reglas de calendario del servicio (ventana de carga de horas, semana
no pasada) comparan contra `new Date()`, así que la zona del host no puede influir.

## Las migraciones van en la imagen

`COPY api/db-upgrade api/db-upgrade`, porque `built-start` es
`npm run upgrade-db && node ./dist/bin`: la api corre las migraciones al arrancar. La imagen
también necesita `sequelize-cli`, que está en `dependencies` y no en `devDependencies`
justamente por esto.

## Reglas

- Construí siempre desde la raíz del repo: `docker build -f api/Dockerfile ..`.
- Un paquete nuevo del workspace se agrega con su `COPY {pkg}/package.json` en **las dos** etapas.
- No quites `--ignore-scripts` de ninguno de los dos `npm ci`.
- Los manifiestos se copian antes del código fuente. No reordenes los `COPY`.
- La etapa `runner` instala con `--omit=dev` y **no** compila: copia los `dist` del builder.
- No muevas `sequelize-cli` a `devDependencies`: la imagen la necesita para migrar al arrancar.
- Mantené `TZ=UTC` en las dos etapas.
- Una dependencia nueva que haga falta en runtime va en `dependencies`, no en `devDependencies`.
- Ambas etapas usan la **misma** versión de imagen base. Si actualizás, actualizá las dos.

## Integración con otras convenciones

- **env-config**: la imagen copia `.env.defaults` como `.env`.
- **orm**: las migraciones se copian y corren al arrancar, con credenciales propias.
- **ci-github**: los workflows construyen esta imagen y la publican.
- **_base**: los tres paquetes del workspace que se compilan antes de la api.
