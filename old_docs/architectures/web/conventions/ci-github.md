---
id: ci-github
display_name: CI/CD (GitHub Actions)
language: nextjs
description: CI del monorepo y publicación de imágenes Docker con GitHub Actions
applies_to: [frontend]
required_by: []
package: null
---

# CI/CD (web)

> **Convención nueva, no un reemplazo.** El catálogo de Next.js solo trae `ci-gitlab`; este
> monorepo usa GitHub Actions. Aplica a los cuatro workspaces (`api`, `core`, `web`, `opus-web`),
> no solo a `web`: el CI es del monorepo.

## Los tres workflows

| Workflow | Disparador | Qué hace |
|---|---|---|
| `.github/workflows/ci.yml` | push a `main`/`dev`, y todo PR | install, chequeo de versiones, build, lint, test — de los 4 workspaces |
| `.github/workflows/dev-images.yml` | push a la rama de desarrollo | publica `dev` y `dev-<sha>` de las 4 imágenes |
| `.github/workflows/release.yml` | tag de versión | publica versión exacta, serie minor y `latest` |

## `ci.yml`

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

paths-ignore:
  - '**.md'
  - 'LICENSE'
  - 'NOTICE'
  - '.github/ISSUE_TEMPLATE/**'
  - '.github/pull_request_template.md'
```

**Reglas:**

- `concurrency` con `cancel-in-progress`: un push nuevo cancela el run anterior de la misma rama.
- `paths-ignore` excluye cambios solo de documentación. **El propio archivo de workflow no está en
  la lista, a propósito** — editar el CI tiene que correr el CI.
- Node se toma de `.nvmrc` con `node-version-file`, no hardcodeado. Un solo lugar para la versión.
- `cache: npm` sobre el `package-lock.json` de la raíz.

### Pasos

```yaml
- run: npm ci                              # el postinstall compila packages/*
- run: ./scripts/set-version.sh --check    # las versiones concuerdan en el monorepo
- run: npm run build
- run: npm run lint
- run: npm test
```

**Reglas:**

- `npm ci` en la raíz, **sin** `--workspace`: instala todo el monorepo y el `postinstall` compila
  `packages/*`, que `api` y `core` consumen desde `dist/`. `web` no los consume, pero comparte el
  install.
- El chequeo de versiones corre **antes** del build: detecta un bump a medio aplicar en el PR, no
  al momento del tag cuando el release ya está bloqueado.
- Los scripts de la raíz iteran los workspaces: `npm test` en la raíz corre el de `api`, `core`,
  `web` y `opus-web`.

### La base de datos es de `api` y `core`

El job levanta un servicio `postgres:15.4-alpine3.18` porque los tests de `api` y `core` corren
contra una base real. **`web` no la usa** — sus tests son jsdom puro. Los valores tienen que
coincidir con `api/.env.test` y `core/.env.test`.

## Publicación de imágenes

Los dos workflows de imágenes usan la misma matriz:

```yaml
strategy:
  fail-fast: false
  matrix:
    service: [api, core, web, opus-web]
```

**Reglas:**

- `fail-fast: false`: si una imagen falla, las otras terminan. El comentario del workflow lo
  justifica — *"easier to finish than to reconstruct"*.
- El contexto de build es la **raíz del repositorio**, no el directorio del servicio, porque cada
  servicio es un workspace. Ver [`dockerfile.md`](./dockerfile.md).
- El Dockerfile se referencia como `{service}/Dockerfile`.

### Tags

| Workflow | Tags |
|---|---|
| `dev-images.yml` | `dev` (se mueve) y `dev-<sha>` (inmutable) |
| `release.yml` | versión exacta, serie minor, y `latest` — vía `docker/metadata-action@v5` |

**Regla:** el tag inmutable de dev existe para poder diagnosticar. El comentario del workflow:
*"The immutable one is what makes a bad dev image diagnosable — without it, 'the dev image from
yesterday' is unrecoverable once the tag moves."*

### Verificación final

Los dos workflows tienen un job que falla explícitamente si algún job de la matriz no publicó, en
vez de dejar un release parcial pasando por verde.

## Secretos

| Secreto | Uso |
|---|---|
| `DOCKERHUB_USERNAME` | login en el registry |
| `DOCKERHUB_TOKEN` | idem |

**Regla:** ningún secreto de aplicación (`AUTH_SECRET`, credenciales de Zitadel) vive en el CI.
Las imágenes no llevan configuración: se inyecta en runtime. Ver
[`../environment.md`](../environment.md).

## Qué NO hacer

- No agregar un paso que necesite variables de entorno de aplicación. `web` no tiene ninguna
  requerida en build time.
- No hardcodear la versión de Node: está en `.nvmrc`.
- No sacar `paths-ignore` ni agregar el propio workflow a la lista.
- No quitar `fail-fast: false` de las matrices de publicación.
