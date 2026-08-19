---
id: ci-github
display_name: CI/CD (GitHub Actions)
language: node
description: Three workflows — CI on push and PR, dev images per push, versioned release on tag
applies_to: [worker]
required_by: []
package: null
---

# CI/CD (core, GitHub Actions)

> **Convención nueva**: el catálogo solo trae `ci-gitlab`. Los workflows son **del monorepo**, no de
> core: los cuatro servicios comparten pipeline y se publican juntos. Esta convención documenta lo
> que core aporta y lo que tiene que respetar.

## Cuándo aplica

Todo cambio en el repositorio. Core no tiene pipeline propio.

## Los tres workflows

| Workflow | Dispara | Qué hace |
|---|---|---|
| `ci.yml` | push a `main`/`dev`, y todo PR | Install, check de versiones, build, lint, test |
| `dev-images.yml` | push a las ramas de desarrollo | Los mismos checks + publica `dev` y `dev-<sha>` |
| `release.yml` | tag de versión | Los mismos checks + publica `{version}`, `{major}.{minor}` y `latest` |

Los tres corren la **misma suite** antes de publicar. Una imagen nunca sale de un árbol que no pasó
los tests.

## Los tests de core necesitan una base

```yaml
services:
  postgres:
    image: postgres:15.4-alpine3.18
    env:
      POSTGRES_DB: gestionTest
      POSTGRES_USER: test
      POSTGRES_PASSWORD: testing
    ports: ['5432:5432']
    options: >-
      --health-cmd pg_isready ...

env:
  POSTGRESQL_HOST: localhost
  POSTGRESQL_PORT: 5432
  POSTGRESQL_DB: gestionTest
  POSTGRESQL_USER: test
  POSTGRESQL_PASSWORD: testing
```

**Estos valores tienen que coincidir con `core/.env.test` y `api/.env.test`.** GitHub Actions define
`CI=true` por su cuenta, y eso hace que `tests/setup-env.ts` use esta base en vez de levantar un
contenedor. Ver [`testing`](./testing.md).

## El orden de los pasos

```yaml
- run: npm ci                          # el postinstall compila packages/*
- run: ./scripts/set-version.sh --check
- run: npm run build
- run: npm run lint
- run: npm test
```

- **`npm ci` compila `packages/*`** vía el `postinstall` de la raíz. Sin eso, core no resuelve
  `@jiku/models` ni `@jiku/nats-protocol`, que se consumen desde `dist/`.
- **El check de versiones va antes del build**: un bump a medio aplicar se ve en el PR y no al
  taggear, cuando el release ya está bloqueado.
- El `npm test` de la raíz corre los cuatro servicios.

## Concurrencia

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Una corrida por rama: pushes seguidos cancelan la anterior.

## Publicación

Matriz sobre los cuatro servicios, con el contexto en la raíz:

```yaml
matrix:
  service: [api, core, web, opus-web]
# ...
context: .
file: ${{ matrix.service }}/Dockerfile
cache-from: type=gha,scope=${{ matrix.service }}
cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

- **`fail-fast: false`**: una imagen que falla no cancela las otras tres. Un release parcial es más
  fácil de terminar que de reconstruir.
- **Un `summary` que falla si alguna imagen faltó.** Con `fail-fast` apagado, sin ese job un release
  parcial reportaría verde.
- **La caché es por servicio** para que las cuatro imágenes no se desalojen entre sí. `dev-images` y
  `release` comparten scope a propósito: las capas son las mismas, así que un build de dev calienta
  el de release.

### Tags

| Workflow | Tags |
|---|---|
| `dev-images.yml` | `dev` (se mueve) y `dev-<sha>` (inmutable) |
| `release.yml` | `{version}`, `{major}.{minor}`, `latest` |

El `dev-<sha>` inmutable es lo que hace diagnosticable una imagen de dev mala: sin él, "la imagen de
dev de ayer" es irrecuperable una vez que el tag se movió.

## Qué NO hay

- **Sin deploy automático.** Los workflows publican imágenes; el despliegue es manual con el compose
  de `deploy/`.
- **Sin cobertura reportada.** `npm run test:coverage` existe en core pero CI corre `npm test`.
- **Sin escaneo de vulnerabilidades** de imágenes ni dependencias.
- **Sin matriz de versiones de Node**: una sola, la de `.nvmrc`.

## Reglas

- Un cambio en core no lleva pipeline propio: usa el del monorepo.
- Si cambian las credenciales de test, se cambian en **tres lugares**: `core/.env.test`,
  `api/.env.test` y los tres workflows.
- Un test que necesite un servicio externo nuevo se declara en `services:` de los tres workflows, o
  falla solo en release.
- La versión de Node se cambia en `.nvmrc`; los workflows la leen de ahí (`node-version-file`).
- Un servicio nuevo se agrega a la matriz de `dev-images.yml` y `release.yml`, y a `workspaces` en el
  `package.json` de la raíz.
- No agregues un paso que publique sin haber corrido los tests.
- No enciendas `fail-fast` en la matriz de publicación.
- Los tests no pueden depender de que la base esté vacía al empezar: el truncado es responsabilidad
  del `global-setup`.

## Integración con otras convenciones

- **[`testing`](./testing.md)**: `CI=true` y de dónde sale la base.
- **[`dockerfile`](./dockerfile.md)**: el contexto en la raíz y la caché por servicio.
