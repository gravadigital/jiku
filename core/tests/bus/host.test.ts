import 'mocha';
import 'should';
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

  constructor(
    private double: FakeConnection,
    ...specs: ServiceSpec[]
  ) {
    super(...specs);
  }

  protected openConnection(options: ConnectionOptions): Promise<NatsConnection> {
    this.captured = options;
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
});
