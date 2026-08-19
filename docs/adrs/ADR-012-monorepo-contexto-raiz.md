# ADR-012: Monorepo npm con contexto de build en la raíz

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** monorepo, build, docker, ci
**Detectado desde:** `api`, `core`, `web`, `opus-web`

---

## Contexto

El producto tiene cuatro servicios que comparten código real, no incidental:
`@jiku/models` (los 28 modelos, ver [ADR-005](ADR-005-modelos-compartidos.md)),
`@jiku/nats-protocol` (el contrato del bus, que **tiene** que ser idéntico en ambos extremos) y
`@jiku/zitadel-auth`.

Con repositorios separados, cada paquete compartido habría que publicarlo a un registry, versionarlo
y actualizarlo en cada consumidor. Un cambio en el contrato del bus se convertiría en: publicar,
bumpear en api, bumpear en core, y desplegar coordinado — con una ventana en la que las versiones
no coinciden.

Para un equipo que desarrolla los cuatro servicios en simultáneo, ese ciclo es puro costo.

## Decisión

**Un monorepo npm con workspaces**: `api`, `core`, `web`, `opus-web` y `packages/*`.

La consecuencia menos obvia y más importante es de empaquetado: **los Dockerfiles viven en la
carpeta de cada servicio pero se construyen con contexto en la raíz del monorepo**, porque el build
necesita alcanzar `packages/`.

Detalles que el código documenta:

- **Cacheo de dependencias:** los Dockerfiles copian los manifiestos (`package.json`,
  `package-lock.json`) **antes** del código, para que `npm ci` se cachee y no se reejecute con cada
  cambio de fuente.
- **`--ignore-scripts` en los frontends:** `npm ci --ignore-scripts --workspace web
  --include-workspace-root` evita el `postinstall` de la raíz que compila `packages/*`, que los
  frontends no consumen.
- **`output: 'standalone'` en un workspace** emite el árbol completo con `node_modules` hoisteados
  en la raíz de `standalone/` y el server en `standalone/web/` — de ahí el
  `CMD ["node", "web/server.js"]`. Está documentado en el propio Dockerfile porque no es evidente.

**CI:** `ci.yml` corre lint y test de los cuatro workspaces. `dev-images.yml` publica `dev` y
`dev-{sha}` en cada push. `release.yml` publica las versiones, en matriz de cuatro servicios.

## Implementation Rules

- Todo servicio y paquete **DEBE** ser un workspace declarado en el `package.json` de la raíz.
- Un Dockerfile **DEBE** construirse con contexto en la **raíz del monorepo**, no en la carpeta del
  servicio. **NO SE DEBE** usar `docker build .` desde la carpeta del servicio: falla al no
  alcanzar `packages/`.
- Los Dockerfiles **DEBEN** copiar los manifiestos antes del código fuente, para preservar el cacheo
  de `npm ci`.
- Los frontends **DEBEN** instalar con `--ignore-scripts`: no consumen `packages/*` compilados.
- El gestor de paquetes **DEBE** ser **npm** con workspaces. **NO SE DEBEN** usar yarn, pnpm ni bun.
- Un cambio en `packages/*` **DEBE** ejecutarse con los tests de **todos** los servicios que lo
  consumen antes de mergear.
- Los cuatro servicios **DEBEN** correr sobre `node:24.12-alpine3.23` con usuario no-root, y usar
  build multi-stage.
- Una imagen **NO DEBE** hornear configuración: sin `ARG` de entorno ni `NEXT_PUBLIC_*` funcional
  ([ADR-009](ADR-009-token-confinado-al-servidor.md)).

## Consecuencias

### Positivas

- **Un cambio en el contrato del bus es atómico.** Publicador y consumidor se modifican en el mismo
  commit, así que no existe la ventana de versiones desalineadas.
- **Sin registry privado ni versionado de paquetes internos.**
- **Refactors cross-service en un solo cambio**, con el compilador verificando los dos extremos.
- **CI unificada:** un push corre lint y test de todo, y un cambio en `packages/*` se valida contra
  todos sus consumidores automáticamente.
- **Una sola versión de las dependencias compartidas** (TypeScript, Sequelize), que no pueden
  divergir entre servicios.

### Negativas

- **El contexto de build en la raíz confunde.** El comando esperable —construir desde la carpeta del
  servicio— falla, y el error no dice por qué. Es un tropiezo garantizado para alguien nuevo.
- **Los contextos de build son grandes**, aunque `.dockerignore` lo acota.
- **Acoplamiento de despliegue.** Un cambio incompatible en `packages/*` obliga a desplegar los
  servicios afectados juntos.
- **Una sola versión de las dependencias compartidas** — que también es un costo: actualizar
  TypeScript es una decisión de los cuatro servicios a la vez.
- **Los tsconfig divergen igual**: `core` tiene `strict: true` con tres flags extra y la api lo
  tiene apagado. El monorepo no impuso homogeneidad donde más importaría.

### Riesgos

- **Riesgo:** alguien intenta construir desde la carpeta del servicio y concluye que el Dockerfile
  está roto.
  - **Mitigación:** documentado en los Dockerfiles y en las convenciones de cada servicio.
- **Riesgo:** un cambio en `packages/*` rompe un consumidor que no se probó.
  - **Mitigación:** `ci.yml` corre los cuatro workspaces. La cobertura desigual (NFR-M07) limita la
    garantía.
- **Riesgo:** el monorepo se vuelve difícil de manejar si el equipo o los servicios crecen.
  - **Mitigación:** con cuatro servicios y un equipo, está lejos de ese punto. Separar sería posible
    a costa de publicar los paquetes.

## Alternativas Consideradas

### Alternativa 1: Repositorios separados con paquetes publicados

**Pros:**
- Independencia real de versionado y despliegue
- Contextos de build chicos y Dockerfiles convencionales
- Cada servicio actualiza dependencias a su ritmo

**Cons:**
- Un cambio en el contrato del bus se vuelve un ciclo de publicar + bumpear + desplegar coordinado
- Requiere registry privado
- Refactors cross-service dejan de ser atómicos

**Por qué se descartó:** el costo por cada cambio compartido era alto y recurrente, para un equipo
que toca los cuatro servicios seguido.

---

### Alternativa 2: Monorepo con herramienta dedicada (Nx, Turborepo)

**Pros:**
- Cacheo de builds y tests, ejecución solo de lo afectado
- Grafo de dependencias explícito
- CI más rápida en repos grandes

**Cons:**
- Una herramienta más que aprender y configurar
- El beneficio escala con el tamaño: con cuatro workspaces, npm workspaces alcanza

**Por qué se descartó:** no hay evidencia de que se haya evaluado. **Es la evolución natural si los
tiempos de CI se vuelven un problema.**

---

### Alternativa 3: Código compartido por copia

**Pros:**
- Sin tooling, sin workspaces

**Cons:**
- Divergencia garantizada, que es exactamente lo que ADR-005 vino a evitar

**Por qué se descartó:** el objetivo de compartir los modelos era que **no pudieran** divergir.

## Referencias

- Workspaces: `package.json` de la raíz
- Dockerfiles: uno por servicio, con contexto en la raíz
- CI: `.github/workflows/{ci,dev-images,release}.yml`
- ADRs relacionados: [ADR-005](ADR-005-modelos-compartidos.md), [ADR-009](ADR-009-token-confinado-al-servidor.md), [ADR-013](ADR-013-tests-contra-base-real.md)
