---
id: ci-github
display_name: CI/CD (GitHub Actions)
language: node
description: Three GitHub Actions workflows - suite on PR, moving dev images, tag-driven releases
applies_to: [api]
required_by: []
package: null
---

# CI/CD (api, GitHub Actions)

> **Convención nueva**, no un reemplazo: el catálogo solo trae `ci-gitlab`. Los workflows son del
> monorepo y cubren los cuatro servicios a la vez, así que lo de acá aplica igual a `core`, `web`
> y `opus-web`.

## Cuándo aplica

Todo cambio que se pushea. Los tres workflows viven en `.github/workflows/`.

## Los tres workflows

| Workflow | Disparador | Qué hace |
|---|---|---|
| `ci.yml` | push a `main`/`dev` y **todo** PR | suite completa: versiones, build, lint, test |
| `dev-images.yml` | push a `dev`, o manual | corre la suite y publica las 4 imágenes con tag `dev` |
| `release.yml` | tag `v*.*.*` | verifica la versión, corre la suite y publica los tags inmutables |

### El pipeline común

Los tres corren la misma secuencia, con un PostgreSQL de servicio:

```
npm ci                          ← compila packages/* vía postinstall
./scripts/set-version.sh --check  (solo ci.yml y release.yml)
npm run build
npm run lint
npm test
```

La base la provee el pipeline (`services.postgres`, `postgres:15.4-alpine3.18`) y las variables
`POSTGRESQL_*` apuntan a `localhost`. **Tienen que coincidir con `api/.env.test` y
`core/.env.test`.** `CI=true` —que Actions setea solo— hace que los tests usen esa base en vez de
levantar un contenedor propio. Ver [`testing`](./testing.md).

### `paths-ignore`

Un cambio solo de documentación no corre la suite. La lista excluye `**.md`, `LICENSE`, `NOTICE` y
las plantillas de issue/PR, pero **no** los workflows: editar CI tiene que correr CI.

`ci.yml` y `dev-images.yml` comparten la misma lista, a propósito.

### Concurrencia

| Workflow | Política |
|---|---|
| `ci.yml` | `cancel-in-progress: true` — una corrida por rama; un push nuevo cancela el anterior |
| `dev-images.yml` | `cancel-in-progress: false` — compiten por el mismo tag mutable, pero una corrida en vuelo no se cancela, así el registry nunca queda con mitad de un build y mitad de otro |
| `release.yml` | `cancel-in-progress: false` — dos de cuatro imágenes publicadas es peor que ninguna |

## Publicación de imágenes

Matriz de los cuatro servicios, con `fail-fast: false` para que una imagen fallida no cancele las
otras tres. El contexto de build es **la raíz del repo** (`context: .`,
`file: {service}/Dockerfile`), por lo que explica [`dockerfile`](./dockerfile.md).

### Tags

| Workflow | Tags |
|---|---|
| `dev-images.yml` | `dev` (se mueve) y `dev-{sha}` (inmutable) |
| `release.yml` | `{version}`, `{major}.{minor}` y `latest` |

> El `dev-{sha}` existe para que un dev image malo sea diagnosticable: sin él, "la imagen dev de
> ayer" es irrecuperable una vez que el tag se movió.

### Caché

`type=gha` con `scope={service}`, compartido **a propósito** entre `dev-images.yml` y
`release.yml`: las capas son las mismas, así que un build de dev calienta el de release y
viceversa. Scopeado por servicio para que no se desalojen entre sí.

### El job `summary`

Con `fail-fast: false`, una publicación parcial reportaría verde. `dev-images.yml` agrega un job
final que falla explícitamente si alguna imagen no se publicó, avisando que el tag `dev` puede ser
una mezcla de dos builds.

## La versión

`release.yml` **no confía en que CI corrió** sobre ese commit: un tag puede apuntar a cualquier
cosa. Antes de construir:

1. deriva la versión del tag (`v1.2.3` → `1.2.3`),
2. compara contra `package.json` del root y falla si no coinciden,
3. verifica con `./scripts/set-version.sh --check` que **todos** los workspaces tengan la misma
   versión.

`ci.yml` corre el mismo `--check`, para que un bump a medias se detecte en el PR y no al taguear,
cuando el release ya está bloqueado.

## Reglas

- La suite tiene que pasar en verde antes de mergear. No hay excepción por "es solo un cambio
  chico".
- Un cambio que toca `.github/workflows/` corre CI: no lo agregues a `paths-ignore`.
- Las variables `POSTGRESQL_*` de los tres workflows tienen que coincidir con `api/.env.test`. Si
  cambiás una, cambiá las cuatro ubicaciones.
- No agregues secretos al repo. Los de Docker Hub van por `secrets.DOCKERHUB_*`.
- Una imagen nueva se agrega a la matriz `service:` de `dev-images.yml` **y** de `release.yml`.
- Publicar un release es taguear `v{version}` **después** de correr `scripts/set-version.sh` y
  commitear. El tag que no coincide con el árbol no publica nada.
- No pongas `cancel-in-progress: true` en los workflows que publican.
- El contexto de build es la raíz. No lo cambies a la carpeta del servicio.
- Un servicio nuevo con base de datos hereda el bloque `services.postgres`; no montes otra base.

## Integración con otras convenciones

- **testing**: el pipeline provee la base y fija `CI=true`.
- **dockerfile**: los workflows construyen desde la raíz, con `file: {service}/Dockerfile`.
- **env-config**: las variables de test del pipeline reflejan `.env.test`.
