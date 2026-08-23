import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConnectionOptions, NatsConnection, ServiceConfig } from 'nats';
import { Reply, inboxPrefix, success } from '@jiku/nats-protocol';
import { BusHost } from '../../src/bus/host';
import { ServiceSpec } from '../../src/bus/service';
import { FakeConnection, FakeService, fakeConnection } from '../helpers/micro-double';

/**
 * `connect` se exporta de `nats` con un getter no configurable, así que no se puede sustituir
 * con sinon. El seam `openConnection()` de `BusHost` existe por eso, y esta subclase es su
 * único usuario: captura las opciones con las que el host se HABRÍA conectado y devuelve el
 * doble.
 */
class TestHost extends BusHost {
  captured: ConnectionOptions | null = null;
  /** Cuántas veces se abrió una conexión. Con dos servicios tiene que seguir siendo UNA. */
  openCount = 0;

  constructor(
    private double: FakeConnection,
    ...specs: ServiceSpec[]
  ) {
    super(...specs);
  }

  protected openConnection(options: ConnectionOptions): Promise<NatsConnection> {
    this.captured = options;
    this.openCount += 1;
    return Promise.resolve(this.double as unknown as NatsConnection);
  }
}

function specNamed(name: string): ServiceSpec {
  return {
    name,
    description: `spec ${name}`,
    patterns: ['clients.new'],
    handle: (): Promise<Reply> => Promise.resolve(success()),
  };
}

/** Las variables que `start()` lee. Se resetean SIEMPRE, para que la suite no dependa del
 * shell de quien la corre ni de un test anterior. */
const HOST_ENV_KEYS = [
  'NATS_URL',
  'NATS_CREDS',
  'NATS_USER_ID',
  'ZITADEL_SERVICE_USER_KEY',
  'ZITADEL_SERVICE_USER_KEY_B64',
  'ZITADEL_ISSUER_URL',
  'IDENTITY_ISSUER',
] as const;

describe('bus/host', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of HOST_ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    saved.clear();
  });

  it('TS-20 · el host siempre fija el inboxPrefix hasheado y el nombre de conexión', async () => {
    process.env.NATS_USER_ID = '323332022539911171';
    const nc = fakeConnection();
    const host = new TestHost(nc, specNamed('jiku-commands'));

    await host.start();

    const options = host.captured!;
    options.should.deepEqual({
      servers: 'nats://localhost:4222',
      inboxPrefix: inboxPrefix('323332022539911171'),
      name: 'jiku-core',
    });
    String(options.inboxPrefix).should.startWith('_INBOX.');
    String(options.inboxPrefix).replace('_INBOX.', '').length.should.equal(16);
  });

  it('TS-21 · sin service user el user id cae al default y SIGUE habiendo inboxPrefix', async () => {
    const nc = fakeConnection();
    const host = new TestHost(nc, specNamed('jiku-commands'));

    await host.start();

    // La ausencia del prefijo es EL bug que CA-14 previene: el síntoma sería un timeout, no un
    // error de permisos.
    String(host.captured!.inboxPrefix).should.equal(inboxPrefix('jiku-commands'));
  });

  it('TS-22 · los specs se registran EN SERIE, no en paralelo', async () => {
    let resolveA: ((service: FakeService) => void) | null = null;
    const requested: string[] = [];
    const nc = fakeConnection({
      add: (config: ServiceConfig): Promise<FakeService> => {
        requested.push(config.name);
        if (config.name === 'A') {
          return new Promise<FakeService>((resolve) => {
            resolveA = resolve;
          });
        }
        return Promise.resolve(nc.makeService(config));
      },
    });
    const host = new TestHost(nc, specNamed('A'), specNamed('B'));

    const started = host.start();
    await new Promise((resolve) => setImmediate(resolve));

    // A todavía no resolvió: B no puede haber sido pedido.
    requested.should.deepEqual(['A']);

    resolveA!(nc.makeService({ name: 'A', version: '1.0.0' }));
    await started;

    requested.should.deepEqual(['A', 'B']);
  });

  it('TS-23 · si el registro de un spec falla, start() rechaza y no sigue con el siguiente', async () => {
    const boom = new Error("'latest' is not a semver value");
    const requested: string[] = [];
    const nc = fakeConnection({
      add: (config: ServiceConfig): Promise<FakeService> => {
        requested.push(config.name);
        if (config.name === 'A') {
          return Promise.reject(boom);
        }
        return Promise.resolve(nc.makeService(config));
      },
    });
    const host = new TestHost(nc, specNamed('A'), specNamed('B'));
    let thrown: Error | null = null;

    try {
      await host.start();
    } catch (error) {
      thrown = error as Error;
    }

    (thrown === boom).should.be.true();
    requested.should.deepEqual(['A']);
  });

  it('TS-24 · stop() respeta el orden: servicios → drain → close', async () => {
    const nc = fakeConnection();
    const host = new TestHost(nc, specNamed('jiku-commands'));

    await host.start();
    await host.stop();

    // El `stopTokenRefresh` no aparece porque sin `ZITADEL_*` no hay service user y nunca se
    // arrancó el auto-refresh. Los tres eventos que SÍ ocurren van en este orden, y el orden es
    // la garantía: parar los servicios ANTES de drenar es lo que evita que una request nueva
    // entre durante el drain y se quede sin respuesta.
    nc.trace.should.deepEqual(['service.stop', 'connection.drain', 'connection.close']);
  });

  it('TS-25 · stop() sin start() previo no lanza', async () => {
    const nc = fakeConnection();

    await new TestHost(nc, specNamed('jiku-commands')).stop();

    nc.trace.should.deepEqual([]);
  });

  /**
   * El proceso con los DOS servicios. Los TS-X de S-012 de más arriba usan nombres genéricos
   * (`A`, `B`); estos usan los nombres REALES y en el orden real del contrato —comandos primero,
   * consultas después—, porque lo que se verifica es el cableado de `src/index.ts`.
   *
   * Los ids llevan el prefijo de la story: este archivo ya tiene un TS-24 y un TS-25 de S-012,
   * que son escenarios distintos.
   */
  describe('los DOS servicios del proceso', () => {
    it('S-013 TS-24 · dos specs sobre UNA conexión dan DOS servicios, registrados EN SERIE', async () => {
      let resolveCommands: ((service: FakeService) => void) | null = null;
      const requested: string[] = [];
      const nc = fakeConnection({
        add: (config: ServiceConfig): Promise<FakeService> => {
          requested.push(config.name);
          if (config.name === 'jiku-commands') {
            return new Promise<FakeService>((resolve) => {
              resolveCommands = resolve;
            });
          }
          return Promise.resolve(nc.makeService(config));
        },
      });
      const host = new TestHost(nc, specNamed('jiku-commands'), specNamed('jiku-queries'));

      const started = host.start();
      await new Promise((resolve) => setImmediate(resolve));

      // Con el `add` de jiku-commands pendiente, jiku-queries NO fue pedido todavía: el registro
      // es en serie, y de eso sale CA-12 sin código nuevo.
      requested.should.deepEqual(['jiku-commands']);

      resolveCommands!(nc.makeService({ name: 'jiku-commands', version: '1.0.0' }));
      await started;

      nc.configs.map((config) => config.name).should.deepEqual([
        'jiku-commands',
        'jiku-queries',
      ]);
      nc.created.length.should.equal(2);
      for (const service of nc.created) {
        service.groups.length.should.equal(1);
      }
      // UNA sola conexión para los dos servicios, con su inbox hasheado.
      host.openCount.should.equal(1);
      String(host.captured!.inboxPrefix).should.startWith('_INBOX.');
    });

    it('S-013 TS-25 · si falla el registro del SEGUNDO, start() rechaza y no queda uno solo arriba', async () => {
      const boom = new Error("'latest' is not a semver value");
      const nc = fakeConnection({
        add: (config: ServiceConfig): Promise<FakeService> => {
          if (config.name === 'jiku-queries') {
            return Promise.reject(boom);
          }
          return Promise.resolve(nc.makeService(config));
        },
      });
      const host = new TestHost(nc, specNamed('jiku-commands'), specNamed('jiku-queries'));
      let thrown: Error | null = null;

      try {
        await host.start();
      } catch (error) {
        thrown = error as Error;
      }

      (thrown === boom).should.be.true();
      // Se intentó registrar los dos, pero solo uno quedó creado. El rechazo llega a
      // `main().catch()` → `process.exit(1)`: el proceso NO puede quedar arriba con un servicio
      // registrado y el otro caído.
      nc.configs.map((config) => config.name).should.deepEqual([
        'jiku-commands',
        'jiku-queries',
      ]);
      nc.created.length.should.equal(1);
    });

    it('S-013 TS-26 · stop() para LOS DOS servicios ANTES de drenar', async () => {
      const nc = fakeConnection();
      const host = new TestHost(nc, specNamed('jiku-commands'), specNamed('jiku-queries'));

      await host.start();
      await host.stop();

      // DOS paradas primero. El orden es la garantía: al revés, una request nueva podría entrar
      // durante el drain y quedarse sin respuesta.
      nc.trace.should.deepEqual([
        'service.stop',
        'service.stop',
        'connection.drain',
        'connection.close',
      ]);
    });
  });

  /**
   * TS-28 · el cableado del proceso, leído del fuente.
   *
   * Es una verificación estática porque `src/index.ts` no se puede importar en un test: al
   * importarse conecta a la base y arranca el host. Lo que importa es que haya UNA sola llamada
   * a `new BusHost(` con los dos specs, y no dos hosts ni dos conexiones.
   */
  describe('el cableado de src/index.ts (TS-28)', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'src', 'index.ts'), 'utf8');

    it('construye el dispatcher de consultas y le pasa los patrones del registry', () => {
      source.should.containEql('QUERY_SERVICE');
      source.should.containEql('new QueryDispatcher(');
      source.should.containEql('queryRegistry.patterns()');
      source.should.containEql('registry.patterns()');
    });

    it('hay UNA sola llamada a new BusHost(', () => {
      source.split('new BusHost(').length.should.equal(2);
    });

    it('los DOS specs viajan DENTRO de esa única llamada', () => {
      // No alcanza con que los dos nombres aparezcan en el archivo: lo que CA-1 pide es que los
      // dos entren por el MISMO host. Se recorta el argumento de `new BusHost(` balanceando
      // paréntesis y se verifica ahí adentro.
      const start = source.indexOf('new BusHost(') + 'new BusHost('.length;
      let depth = 1;
      let end = start;
      while (end < source.length && depth > 0) {
        if (source[end] === '(') depth++;
        else if (source[end] === ')') depth--;
        if (depth > 0) end++;
      }
      depth.should.equal(0);
      const args = source.slice(start, end);
      args.should.containEql('COMMAND_SERVICE');
      args.should.containEql('QUERY_SERVICE');
      // Dos objetos literales, cada uno con su `handle`: uno por servicio.
      args.split('handle:').length.should.equal(3);
    });

    it('dotenv.config() sigue en las dos primeras líneas', () => {
      // `models/read.ts` y `bus/service.ts` leen `process.env` AL IMPORTARSE: ese orden ahora
      // protege a los dos.
      const head = source.split('\n').slice(0, 2).join('\n');
      head.should.containEql("import * as dotenv from 'dotenv'");
      head.should.containEql('dotenv.config()');
    });
  });
});
