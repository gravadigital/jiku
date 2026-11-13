# ADR-013: Tests contra base de datos real, con un doble de bus que ejecuta `core`

**Estado:** Aceptado (implementado)
**Fecha:** 2026-08-18 (documentado retroactivamente; la decisión es anterior)
**Deciders:** Equipo de desarrollo de Grava Digital
**Tags:** testing, calidad, base-de-datos, integracion
**Detectado desde:** `api`, `core`

---

## Contexto

Con la escritura repartida entre dos servicios que se comunican por un bus
([ADR-001](ADR-001-separacion-lectura-escritura.md),
[ADR-002](ADR-002-comandos-nats-sin-jetstream.md)), un test unitario con mocks de Sequelize verifica
muy poco de lo que puede fallar. Los modos de fallo reales del producto son:

- El comando publicado no es el que la ruta creía, o su payload está mal armado
- La traducción del `errorCode` a status HTTP es incorrecta
- La escritura **no ocurrió** aunque la respuesta dijera que sí
- El rollback no revirtió lo que ya se había insertado
- El modelo no coincide con el esquema que crearon las migraciones

Ninguno de esos se detecta mockeando el ORM: un mock devuelve lo que se le dijo que devolviera,
así que confirma la expectativa en lugar de verificar el comportamiento.

## Decisión

**Los tests corren contra PostgreSQL real, sin mocks de Sequelize**, y el doble del bus de la api
**ejecuta `core` de verdad contra la misma base**.

### Base de datos real

- PostgreSQL efímero en Docker, levantado por `tests/setup-env.ts`.
- El esquema se construye con `sequelize.sync()`, y se limpia con
  `TRUNCATE ... RESTART IDENTITY CASCADE` una vez por corrida.
- En CI (`CI=true`) se usa la base del pipeline en lugar de levantar contenedor.
- `KEEP_DB=true` deja el contenedor vivo entre corridas, para inspeccionar después de un fallo.
- **Por qué el setup vive ahí y no en un `mochaGlobalSetup`:** `src/models/index.ts` construye el
  Sequelize **al importarse**, leyendo `process.env` en ese momento. Un global setup correría
  demasiado tarde.

### El `FakeBus` que ejecuta core

`api/tests/mocks/bus.ts`. El doble registra qué comando se publicó y, **por default, lo ejecuta
contra core con la misma base**.

Un solo test verifica entonces las tres cosas que importan:
1. Qué comando y qué payload se publicaron
2. Que la respuesta de core se tradujo bien a HTTP
3. Que **la escritura efectivamente ocurrió**

Con `reply()` / `failWith()` se corta la ejecución real para cubrir caminos de error sin
provocarlos. Core se carga **de forma perezosa**: si no está disponible, el doble sigue funcionando
con respuestas fijas.

### Los tests de core entran por el despachador

El helper `dispatch()` arma el subject completo y entra **por el despachador**, no por el `execute`
del comando. Es lo único que verifica el comportamiento transaccional, incluido el rollback
([ADR-003](ADR-003-transaccion-del-despachador.md)).

### Zona horaria

`TZ=UTC` fijado en los cuatro servicios. El comentario de `web/vitest.config.mts:10-14` registra el
motivo: un literal `'2026-08-01'` se parsea como medianoche UTC, y sin fijarlo los tests pasan en
local y fallan en CI.

## Implementation Rules

- Los tests de `api` y `core` **DEBEN** correr contra PostgreSQL real. **NO SE DEBEN** mockear los
  modelos de Sequelize.
- Los tests de comandos de `core` **DEBEN** entrar por el despachador (`dispatch()`), **NO** por
  `execute()` directamente.
- Un test de escritura de la api **DEBE** verificar las tres capas: comando publicado, traducción de
  la respuesta a HTTP, y que la fila quedó escrita. **NO SE DEBE** asertar solo el status HTTP.
- `reply()` / `failWith()` **DEBEN** usarse solo para cubrir caminos de error. El camino feliz
  **DEBE** ejecutar core de verdad.
- Cada archivo de test **DEBE** poder correr solo: el esquema y el mock de auth se preparan en
  fixtures globales de Mocha.
- `TZ=UTC` **DEBE** estar fijado en la configuración de test de todo servicio.
- La limpieza entre corridas **DEBE** ser `TRUNCATE ... RESTART IDENTITY CASCADE`, para que los ids
  autoincrementales sean predecibles.
- **NO SE DEBE** depender del orden de ejecución entre archivos de test.

## Consecuencias

### Positivas

- **Los tests verifican el comportamiento real, no la expectativa.** Un cambio que rompa la
  escritura falla, aunque el mock hubiera dicho que sí.
- **Un test cubre las tres capas** del camino de escritura. Es la decisión de mayor cobertura por
  esfuerzo de todo el producto.
- **El rollback está cubierto de verdad**, al entrar por el despachador.
- **Un desalineo modelo ↔ esquema se detecta** en cualquier camino con cobertura, lo que mitiga
  parcialmente el riesgo de [ADR-005](ADR-005-modelos-compartidos.md).
- **Sin mocks de Sequelize que mantener**, que son de los dobles más frágiles y menos informativos.
- **`KEEP_DB=true` hace que un fallo sea investigable**, no solo reproducible.

### Negativas

- **Los tests son más lentos** que con mocks: levantar el contenedor, sincronizar el esquema y
  truncar tiene un costo por corrida.
- **Requieren Docker en la máquina de desarrollo.** No se pueden correr en un entorno sin él.
- **El esquema de test lo construye `sequelize.sync()`**, no las migraciones. Es una **segunda
  fuente de verdad** del esquema: los tests podrían pasar contra un esquema que las migraciones
  nunca producirían (NFR-R07, FG-6).
- **El acoplamiento de los tests de la api con core es real.** Un cambio en core puede romper tests
  de la api, lo cual es correcto —el comportamiento cambió— pero sorprende al ubicar el fallo.

### Riesgos

- **Riesgo:** `sequelize.sync()` y las migraciones divergen, y los tests validan un esquema que no
  existe en producción.
  - **Mitigación:** ninguna hoy. Es el riesgo más serio de esta decisión y está registrado en
    NFR-R07 y en el feature group **FG-6**. Correr los tests contra el esquema producido por las
    migraciones sería la solución.
- **Riesgo:** la cobertura desigual da falsa confianza. `web` tiene 644 casos pero **ninguno** para
  `clients`, `time-allocation`, `contexts` ni `lib`; `opus-web` no cubre `middleware.ts` —el guard
  de toda la aplicación— ni los seis hooks de requisitos.
  - **Mitigación:** inventariado en NFR-M07.
- **Riesgo:** los tests se vuelven lentos y alguien introduce mocks "para acelerar", perdiendo la
  garantía.
  - **Mitigación:** las reglas explícitas de arriba.

## Alternativas Consideradas

### Alternativa 1: Tests unitarios con mocks de Sequelize

**Pros:**
- Rápidos, sin Docker, aislados
- Fallos localizados en una unidad

**Cons:**
- No detectan ninguno de los modos de fallo reales listados en el Contexto
- Los mocks de un ORM son frágiles: cada cambio de consulta rompe el mock sin que cambie el
  comportamiento

**Por qué se descartó:** confirmarían la expectativa en lugar de verificar el comportamiento, que
es exactamente lo contrario de lo que se buscaba.

---

### Alternativa 2: SQLite en memoria en lugar de PostgreSQL

**Pros:**
- Muy rápido, sin Docker
- Sin contenedores que administrar

**Cons:**
- El esquema usa `JSONB` con operadores de contains (`tags @> '[...]'::jsonb`), enums nativos e
  índices únicos parciales — nada de eso es equivalente en SQLite
- Un test que pase en SQLite no garantiza nada sobre PostgreSQL

**Por qué se descartó:** el producto usa funcionalidad específica de PostgreSQL en consultas
centrales. Testear contra otro motor daría una garantía falsa.

---

### Alternativa 3: `FakeBus` con respuestas fijas, sin ejecutar core

**Pros:**
- Tests de la api independientes de core
- Más rápidos y con fallos más localizados

**Cons:**
- No verifica que la escritura ocurrió: solo que la api hizo lo que creía
- La traducción del `errorCode` a HTTP se testearía contra respuestas inventadas, no contra las que
  core emite de verdad

**Por qué se descartó parcialmente:** **está implementado y disponible** vía `reply()` / `failWith()`,
y se usa para los caminos de error. La decisión fue que el **default** ejecute core, no que la
alternativa no existiera.

## Referencias

- Implementación: `api/tests/mocks/bus.ts`, `core/tests/setup-env.ts`, `web/vitest.config.mts:10-14`
- Cobertura por servicio: NFR-M01 y NFR-M07 en [`docs/prd/requirements.md`](../prd/requirements.md)
- ADRs relacionados: [ADR-001](ADR-001-separacion-lectura-escritura.md), [ADR-003](ADR-003-transaccion-del-despachador.md), [ADR-005](ADR-005-modelos-compartidos.md)
