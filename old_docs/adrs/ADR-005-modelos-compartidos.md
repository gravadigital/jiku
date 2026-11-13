# ADR-005: Modelos compartidos en `@jiku/models`, sin abrir la conexión

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** monorepo, orm, modelado, integridad
**Detectado desde:** `api`, `core`

---

## Contexto

`api` y `core` acceden a **la misma base de datos** con **credenciales distintas**: la api en solo
lectura, core con el usuario dueño ([ADR-001](ADR-001-separacion-lectura-escritura.md)).

Eso plantea un problema concreto: los dos necesitan las mismas 28 definiciones de modelo Sequelize
—columnas, tipos, relaciones, hooks, scopes— pero **no pueden compartir la conexión**, porque la
conexión es justamente lo que los distingue.

Si cada servicio define sus propios modelos, divergen. Y la divergencia entre el modelo que lee y
el que escribe es especialmente dañina: la api podría leer un campo que core nunca escribe, o core
escribir un valor que la api no sabe interpretar, sin que nada falle hasta que un usuario lo vea.

## Decisión

Extraer los 28 modelos a un paquete del workspace, **`@jiku/models`**, que exporta las **clases**
pero **deliberadamente no abre la conexión**.

Cada servicio registra las clases en **su propio** `Sequelize`, con sus credenciales:
- `api/lib/models/index.ts:19-31` — instancia de solo lectura
- `core/src/models/index.ts:17-27` — instancia con el usuario dueño

El paquete describe **la base tal como es**: nombres de tabla reales (`objectives`, `clients`),
tipos reales, hooks del modelo. Las traducciones de vocabulario no viven acá sino en core
([ADR-004](ADR-004-vocabulario-en-el-contrato.md)).

Los hooks que sí viven en el paquete son los que pertenecen al dato, no al caso de uso:
- `@BeforeUpdate` en `objectives`, que setea y limpia `finishedAt` según la transición de estado
- `@BeforeUpdate` en `requirements`, que calcula el `activityLog` y las cuatro marcas temporales
- `@DefaultScope` en `attachments`, que excluye `checksum` de las consultas por default

Junto a `@jiku/models` hay otros dos paquetes compartidos con la misma lógica: `@jiku/nats-protocol`
(el contrato del bus tiene que ser idéntico en los dos extremos) y `@jiku/zitadel-auth` (los dos
backends necesitan el token del service user con auto-refresh).

## Implementation Rules

- Los modelos Sequelize **DEBEN** vivir en `@jiku/models`. **NO SE DEBE** definir un modelo dentro
  de `api/` o de `core/`.
- `@jiku/models` **NO DEBE** abrir una conexión ni leer variables de entorno de base de datos.
  Exporta clases; la instancia la crea cada servicio.
- Cada servicio **DEBE** registrar las clases en su propio `Sequelize` con sus credenciales.
- Un cambio de esquema **DEBE** hacerse en dos lugares en el mismo cambio: la migración en
  `api/db-upgrade/migrations/` y el modelo en `@jiku/models`. Uno sin el otro deja el código y la
  base desalineados.
- Los hooks que van en el modelo son los que pertenecen **al dato** (mantener `finishedAt`
  consistente con `state`). Los que dependen del caso de uso o del rol **DEBEN** ir en el comando
  de core o en la api.
- Los nombres en `@jiku/models` **DEBEN** ser los reales de la base. La traducción de vocabulario
  es responsabilidad de core.
- Al agregar un modelo, **DEBE** registrarse en el índice del paquete: los dos servicios lo
  importan desde ahí.

## Consecuencias

### Positivas

- **Api y core no pueden divergir en la definición de los datos.** Es el objetivo central y lo
  cumple de forma estructural: hay una sola definición.
- **Hace posible la garantía de solo lectura de ADR-001.** Sin esta separación entre clase y
  conexión, compartir modelos habría significado compartir credenciales.
- **Los hooks del dato se aplican igual desde los dos servicios**, aunque solo core escriba.
- **Un cambio de esquema tiene un solo lugar de modelo que tocar.**

### Negativas

- **Los servicios están acoplados por el paquete.** Un cambio en `@jiku/models` afecta a los dos y
  obliga a desplegarlos juntos si el cambio no es compatible.
- **El monorepo se vuelve obligatorio.** Los Dockerfiles tienen que construirse con contexto en la
  raíz ([ADR-012](ADR-012-monorepo-contexto-raiz.md)) porque los servicios dependen de paquetes del
  workspace.
- **La sincronización modelo ↔ migración es manual.** Nada verifica que el modelo describa lo que
  la migración creó; el desalineo se descubre en runtime.
- **El paquete describe la base tal como es, con sus inconsistencias**: `estimated_finish_date` es
  `VARCHAR` en tareas y `DATE` en requisitos, `priority` es entero en tareas y enum en requisitos.
  El paquete las propaga en vez de esconderlas — que es lo correcto, pero significa que las
  inconsistencias del esquema llegan al código de los dos servicios.

### Riesgos

- **Riesgo:** una migración cambia una columna y nadie actualiza el modelo. El error aparece en
  runtime, posiblemente solo en un camino poco transitado.
  - **Mitigación:** parcial. Los tests de core y de la api corren contra PostgreSQL real
    ([ADR-013](ADR-013-tests-contra-base-real.md)), así que un desalineo en un camino cubierto se
    detecta. Uno en un camino sin cobertura, no.
- **Riesgo:** `sequelize.sync()` corre en testing y development, mientras producción se construye
  con las migraciones: **dos fuentes de verdad** para el mismo esquema.
  - **Mitigación:** ninguna hoy. Registrado en NFR-R07 y en el feature group **FG-6**.

## Alternativas Consideradas

### Alternativa 1: Modelos duplicados en cada servicio

**Pros:**
- Servicios independientes, sin paquete compartido
- Cada uno define solo lo que usa

**Cons:**
- Divergencia garantizada con el tiempo
- La divergencia entre el que lee y el que escribe es especialmente difícil de detectar

**Por qué se descartó:** era exactamente el riesgo que el paquete vino a eliminar.

---

### Alternativa 2: Paquete compartido que también abre la conexión

**Pros:**
- Más simple de usar: importar y listo
- Un solo lugar donde configurar la base

**Cons:**
- **Rompe ADR-001**: los dos servicios tendrían la misma conexión o el paquete tendría que
  parametrizar credenciales, volviendo a la configuración a cada servicio de todos modos

**Por qué se descartó:** la separación de credenciales es la garantía de integridad del producto.
El paquete no puede ser quien la disuelva.

---

### Alternativa 3: Sin ORM, SQL directo con tipos generados del esquema

**Pros:**
- Los tipos se derivan de la base, imposible que diverjan
- Sin comportamiento oculto en hooks

**Cons:**
- Reescribir 61 endpoints y 17 comandos
- Se pierden los hooks del modelo, que hoy mantienen `finishedAt` y el `activityLog`
  consistentes sin que cada llamador se acuerde

**Por qué se descartó:** el costo de migración era enorme para un producto en producción, y el
problema que resolvería (divergencia de tipos) ya lo resuelve el paquete compartido.

## Referencias

- Paquete: `packages/models/`
- Esquema: [`docs/db-schemas/jiku.md`](../db-schemas/jiku.md)
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md), [ADR-004](ADR-004-vocabulario-en-el-contrato.md), [ADR-012](ADR-012-monorepo-contexto-raiz.md), [ADR-013](ADR-013-tests-contra-base-real.md)
