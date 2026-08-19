---
id: testing
display_name: Testing (Mocha + base real + FakeBus que ejecuta core)
language: node
description: Mocha with should/sinon, an ephemeral PostgreSQL in Docker, and a bus double that dispatches to the real core
applies_to: [api]
required_by: []
package: mocha
---

# Testing (api, Mocha)

> **Reemplaza** la convención `testing` del catálogo, que usa Vitest con Testcontainers. Este
> servicio usa Mocha con `should`, y levanta el PostgreSQL con `docker` directamente. Lo más
> particular: el doble del bus **ejecuta los comandos contra el core real**.

## Cuándo aplica

Todo el servicio. Un archivo de ruta nuevo lleva su archivo de test.

## Paquete

```
mocha                  # 11.7, runner
should                 # 13.2, aserciones (estilo BDD)
sinon                  # 21, stubs y spies
supertest              # 7.1, requests HTTP contra el Application
nock                   # 14, intercepta HTTP saliente (Zitadel)
mockery                # 2.1, reemplaza módulos en el require cache
mockdate               # 3.0, congela la fecha
nyc                    # 17, cobertura
```

## Estructura y comandos

```
tests/
├── setup-env.ts             levanta el PostgreSQL y fija las variables ANTES de todo
├── global-setup.ts          crea el esquema (fixture global de Mocha); teardown apaga el contenedor
├── register-jwt-mock.ts     instala el mock de jsonwebtoken
├── mocks/
│   ├── app.ts               inicializa el Application con .env.test
│   ├── bus.ts               el FakeBus
│   └── jsonwebtoken-mock.ts
├── 00-configurations/       tests de modelos y conexión (corren primero por el nombre)
├── routes/                  61 archivos, uno por archivo de ruta
└── utils/                   unitarios, sin base de datos
```

```sh
npm test                                    # todo
npm run test:unit                           # solo tests/utils — sin base
npm run test:integration                    # configuraciones + rutas
npm run test:coverage                       # con nyc
npx mocha tests/routes/clients-get.test.ts  # un archivo
```

| Variable | Efecto |
|---|---|
| `KEEP_DB=true` | deja el contenedor vivo para que la próxima corrida arranque más rápido |
| `CI=true` | no levanta contenedor: usa la base del entorno (la del pipeline) |

`.mocharc.json` carga los cuatro archivos de setup en orden, con timeout de 60 s.

> **Cualquier archivo corre solo.** El esquema y el mock de auth se preparan en fixtures globales,
> así que no hace falta correr la suite completa para probar un endpoint. No agregues setup de
> esquema en un archivo de test.

## Base de datos real

No hay mocks de Sequelize: los tests corren contra un PostgreSQL de verdad.

> **En los tests la base NO es de solo lectura.** El contenedor usa el usuario `test`, que tiene
> permisos completos, así que los tests **preparan y limpian su propio estado** con
> `Model.create()` y `Model.destroy({ where: {} })` — algo que el código de producción no puede
> hacer. Es lo que permite armar el escenario de un test sin pasar por core. El esquema se crea
**una vez para toda la corrida** en `mochaGlobalSetup` (`tests/global-setup.ts:15-20`), con
`sequelize.sync()`.

> Crear el esquema una sola vez es lo que permite ejecutar un archivo aislado sin fallar con
> `relation "users" does not exist`.

En CI la base la provee el pipeline (`services.postgres` en `ci.yml`), y el teardown **no** la
borra: no es suya.

## El `FakeBus`

La pieza distintiva. Registra qué comandos publicó la api y, por default, **los ejecuta contra
core con la misma base de datos** (`tests/mocks/bus.ts`).

Un solo test verifica tres cosas a la vez:

1. qué comando se publicó y con qué payload,
2. que la api traduce la respuesta al HTTP esperado,
3. que la escritura efectivamente ocurrió.

El doble **ya está instalado** para toda la corrida: `tests/setup-env.ts:31` hace
`setBus(fakeBus)`, y un root hook de Mocha le hace `reset()` antes de cada test, para que un
`failWith` o una respuesta fija de un archivo no se filtre al siguiente
(`tests/setup-env.ts:37-41`).

> **No llames a `setBus` en un archivo de test.** Ya está hecho. Un `beforeEach` local con
> `fakeBus.reset()` es redundante pero inofensivo, y varios archivos lo tienen.

```ts
import { fakeBus } from '../mocks/bus';

it('publica clients.new y devuelve el cliente creado', async () => {
  const res = await request(app).post('/api/clients')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Acme' });

  res.status.should.equal(201);
  fakeBus.last!.command.should.equal('clients.new');       // 1. el comando
  fakeBus.last!.payload.name.should.equal('Acme');
  res.body.name.should.equal('Acme');                       // 2. la traducción
  // 3. core ya escribió: el cliente existe en la base
});
```

### Cortar la ejecución real

Para cubrir caminos de error sin fabricar el estado que los provoca:

```ts
fakeBus.reply('clients.new', { status: 'failure', errorCode: 'invalid_fields', errorMessage: '...' });
fakeBus.replyDefault({ status: 'success', data: { id: 1 } });
fakeBus.failWith(new Error('timeout'));    // simula bus caído → 503
```

Core se carga de forma **perezosa** desde `../../../core/src/`. Si no está instalado, el doble
sigue funcionando con respuestas fijas, y los tests que dependan de la escritura real fallan con
un mensaje claro en vez de pasar en falso.

## Autenticación en los tests

`tests/register-jwt-mock.ts` instala un mock de `jsonwebtoken` **antes** de que se cargue
cualquier módulo, así que `jwt.verify` no llama a Zitadel. Los tests arman el token con el `sub`
y los roles que necesitan.

Para el HTTP saliente hacia Zitadel (JWKS, userinfo) se usa `nock`.

## Aserciones

Estilo `should`, encadenado sobre el valor:

```ts
res.status.should.equal(200);
res.body.should.be.an.Array();
res.body.length.should.equal(3);
res.body.should.have.property('code', 'access_denied');
```

## Qué cubrir en un test de ruta

El patrón de los 61 archivos existentes:

- **Camino feliz** con el status y la forma del cuerpo.
- **Validación**: cada campo requerido ausente, cada enum con valor inválido → 400.
- **Autorización**: cada rol que no debería pasar → 403. Y para adjuntos, un archivo de test
  aparte solo de permisos (`attachments-post-permissions.test.ts`).
- **Entidad inexistente** → 404.
- **Comando publicado**: nombre y payload, incluidas las traducciones (`priority` numérica →
  enum, `personIds` → `responsiblePersonIds`).
- **Bus caído** → 503, con `failWith`.
- **Reglas de negocio** con sus límites: el día 11 de la ventana de horas, la semana pasada, la
  incidencia sin conclusión.

Fechas: `mockdate` para congelar el día cuando la regla depende del calendario.

## Reglas

- Un archivo de ruta nuevo lleva `tests/routes/{mismo-nombre}.test.ts`.
- No mockees Sequelize ni la base. Los tests corren contra PostgreSQL real.
- No prepares el esquema en un archivo de test: lo hacen los fixtures globales.
- Toda mutación se testea con el `FakeBus`, verificando **comando y payload**, no solo el status.
- No llames a `setBus`: el doble ya está instalado y se resetea por root hook.
- Limpiá los datos que creaste en `after` / `afterEach` con `Model.destroy({ where: {} })`. Un
  test que deja filas contamina al siguiente.
- Usá `reply()` / `failWith()` para los caminos de error, no para el camino feliz: ahí dejá que
  ejecute core.
- Todo endpoint con `hasAnyRole` lleva un test por rol rechazado.
- Toda regla de negocio se testea **en su límite**, no en el centro del rango válido.
- Congelá la fecha con `mockdate` cuando la regla dependa del calendario.
- Aserciones con `should`. No mezcles `assert` ni `expect`.
- Un test no depende del orden de ejecución ni del estado que dejó otro.

## Integración con otras convenciones

- **bus-commands**: el `FakeBus` es el doble de `bus()`, intercambiable vía `setBus`.
- **orm**: los tests usan el mismo Sequelize; el esquema se crea con `sync()`.
- **auth-jwt**: el mock de `jsonwebtoken` evita llamar a Zitadel.
- **authorization**: los tests por rol y el archivo dedicado de permisos de adjuntos.
- **ci-github**: el pipeline provee la base y fija `CI=true`.
