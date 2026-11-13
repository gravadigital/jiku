---
id: ci-github
display_name: CI/CD (GitHub Actions)
language: nextjs
description: Tres workflows en la raíz del monorepo; opus-web no tiene pipeline propio
applies_to: [frontend, backend]
required_by: []
package: null
---

# CI/CD (opus-web)

> **Convención nueva**, sin equivalente en el catálogo (que solo trae `ci-gitlab`). No reemplaza
> nada.
>
> Los workflows son **del monorepo**, no de este servicio: `opus-web` no tiene pipeline propio.
> Este documento describe cómo participa.

## Los tres workflows

Viven en `.github/workflows/` en la raíz.

| Workflow | Dispara | Qué hace |
|---|---|---|
| `ci.yml` | push a `main`/`dev`, y cada PR | build + lint + test de todo el monorepo |
| `dev-images.yml` | push a la rama de desarrollo | publica las cuatro imágenes con tag `dev` y `dev-{sha}` |
| `release.yml` | tag de versión | publica las cuatro imágenes con el nombre del tag |

## `ci.yml`

```yaml
on:
  push:
    branches: [main, dev]
    paths-ignore: ['**.md', 'LICENSE', 'NOTICE', '.github/ISSUE_TEMPLATE/**', '.github/pull_request_template.md']
  pull_request:
    paths-ignore: [ ... ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**`paths-ignore` con el archivo del workflow excluido de la lista, a propósito.** El comentario lo
dice: *"Docs-only changes do not need the full suite. The workflow file itself is excluded from
the ignore list on purpose: editing CI must still run CI."*

**`concurrency` con `cancel-in-progress`:** un push nuevo cancela el anterior de la misma rama.

### Un solo job para los cuatro servicios

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: .nvmrc
    cache: npm

- name: Install
  run: npm ci                              # compila packages/* vía postinstall

- name: Versions agree across the monorepo
  run: ./scripts/set-version.sh --check

- name: Build
  run: npm run build
- name: Lint
  run: npm run lint
- name: Test
  run: npm test
```

Los cuatro pasos corren sobre los workspaces, así que **los 296 tests de `opus-web` se ejecutan
dentro del `npm test` de la raíz**. No hay un job por servicio.

**El chequeo de versiones** corre antes del build por un motivo escrito en el workflow: atrapa un
bump de versión a medio aplicar en el PR, en vez de al momento del tag cuando el release ya está
bloqueado.

**El `npm ci` de CI no lleva `--ignore-scripts`**, a diferencia del Dockerfile: acá sí se compilan
`packages/*`, porque `api` y `core` los consumen desde `dist/`.

### El servicio de PostgreSQL no es para este frontend

El job levanta un `postgres:15.4-alpine3.18` con variables de conexión. Es para los tests de `api`
y `core`, que corren contra una base real. `opus-web` no lo usa.

## Publicación de imágenes

Los dos workflows de publicación comparten la forma:

```yaml
strategy:
  fail-fast: false        # Una imagen fallida no debe cancelar las otras tres.
  matrix:
    service: [api, core, web, opus-web]

- uses: docker/build-push-action@v6
  with:
    context: .                                # la raíz, no la carpeta del servicio
    file: ${{ matrix.service }}/Dockerfile
    push: true
    tags: |
      ${{ env.REGISTRY_NAMESPACE }}/jiku-${{ matrix.service }}:dev
      ${{ env.REGISTRY_NAMESPACE }}/jiku-${{ matrix.service }}:dev-${{ github.sha }}
    cache-from: type=gha,scope=${{ matrix.service }}
    cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

**`context: .`** — el contexto es la raíz del monorepo, coherente con lo que el Dockerfile exige.
Ver [dockerfile](./dockerfile.md).

**Los dos tags de dev tienen un motivo escrito:** *"Two tags: `dev`, which moves, and `dev-<sha>`,
which does not. The immutable one is what makes a bad dev image diagnosable — without it, 'the dev
image from yesterday' is unrecoverable once the tag moves."*

**La caché comparte scope entre `dev-images.yml` y `release.yml` a propósito:** las capas son las
mismas, así que un build de dev calienta el de release y al revés.

**`fail-fast: false` más un job `summary`:**

```yaml
summary:
  needs: publish
  if: always()
  steps:
    - run: |
        if [[ "${{ needs.publish.result }}" != "success" ]]; then
          echo "::error::At least one dev image failed to publish. The dev tag may be a mix of this build and the previous one."
          exit 1
        fi
```

Sin ese job, una publicación parcial reportaría verde — y el tag `dev` quedaría siendo una mezcla
de este build y el anterior, que es lo que el mensaje advierte.

Cada imagen lleva labels OCI: `title`, `vendor` (Grava Digital) y `revision` (el SHA).

## Qué implica para trabajar en `opus-web`

**Antes de abrir un PR**, correr lo mismo que corre el CI:

```sh
npm run lint  --workspace opus-web
npm test      --workspace opus-web
npm run build --workspace opus-web
```

**Cosas a tener presentes:**

- **El lint de este servicio no bloquea por `any` ni por `set-state-in-effect`**: las dos reglas
  están en `warn` (`eslint.config.mjs:13-21`). El CI pasa con warnings.
- **Un cambio solo en `.md` no dispara el CI.** Si tocás documentación y código en el mismo PR, sí
  corre.
- **Romper el build de `opus-web` bloquea la publicación de las cuatro imágenes**, porque el job de
  publicación depende del de test.
- **Las versiones se manejan con `./scripts/set-version.sh`.** Editar el `version` de
  `opus-web/package.json` a mano hace fallar el chequeo.

## Qué no hay

- **Sin job por servicio.** Un cambio en `opus-web` corre también los tests de `api` y `core`,
  incluida la base de datos.
- **Sin reporte de cobertura publicado.** `test:cov` existe como script y no lo corre ningún
  workflow.
- **Sin escaneo de vulnerabilidades** de las imágenes ni de las dependencias.
- **Sin tests end-to-end** contra la imagen construida. Que la imagen levante y sirva no se prueba.
- **Sin deploy automático.** Los workflows publican imágenes; la actualización del entorno es
  manual con `deploy/`.
