import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConnectionOptions, NatsConnection, ServiceConfig } from 'nats';
import * as sinon from 'sinon';
import { Reply, inboxPrefix, success } from '@jiku/nats-protocol';
import logger from '../../src/logger';
import { BusHost, EventSpec } from '../../src/bus/host';
import { ServiceSpec } from '../../src/bus/service';
import { FakeConnection, FakeService, encode, fakeConnection } from '../helpers/micro-double';

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
  // El queue group del consumidor de eventos. Sin resetearla, TS-25 de S-016 dependería del
  // shell de quien corre la suite.
  'NATS_EVENTS_QUEUE',
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
   * El consumidor de eventos: la suscripción PLANA, sin bus y sin base.
   *
   * Los ids llevan el prefijo de la story porque este archivo ya tiene un TS-24 y un TS-25 de
   * S-012 y otros de S-013, que son escenarios distintos.
   *
   * TODO test que empuje mensajes tiene que drenar antes de terminar: el iterador del doble no
   * termina solo —una suscripción se queda abierta para recibir— y el `for await` del consumidor
   * corre con `void` y sin `await` desde `start()`.
   */
  describe('el consumidor de eventos (S-016)', () => {
    const AUTH_SUBJECT = 'dev.events.auth';

    /** El payload del contrato, tal como el auth-callout lo publica (`snake_case`). */
    const authEvent = (): Uint8Array =>
      encode(
        JSON.stringify({
          type: 'authenticated',
          version: 1,
          id: '281234567890123456',
          name: 'Ana Pérez',
          username: 'ana@grava.digital',
          email: 'ana@grava.digital',
          roles: ['user'],
          instance: 'dev',
          identity_type: 'person',
        })
      );

    /** Un turno del event loop: lo que hace falta para ver que algo NO pasó TODAVÍA. */
    const tick = (): Promise<void> =>
      new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

    function consumer(handle: (payload: unknown) => Promise<void>): EventSpec {
      return { subject: AUTH_SUBJECT, handle };
    }

    const noop = (): Promise<void> => Promise.resolve();

    it('S-016 TS-24 · start() se suscribe al subject LITERAL, con queue group, DESPUÉS de los servicios', async () => {
      const nc: FakeConnection = fakeConnection({
        add: (config: ServiceConfig): Promise<FakeService> => {
          // La traza del `add` la pone el test y no el doble: agregársela al doble cambiaría la
          // aserción de apagado de los ocho tests que ya existen.
          nc.trace.push('services.add');
          return Promise.resolve(nc.makeService(config));
        },
      });
      const host = new TestHost(
        nc,
        specNamed('jiku-commands'),
        specNamed('jiku-queries')
      ).withEventConsumer(consumer(noop));

      await host.start();

      nc.subscriptions.length.should.equal(1);
      const subscription = nc.subscriptions[0];
      subscription.subject.should.equal(AUTH_SUBJECT);
      // Subject LITERAL: un wildcard compilaría y hoy recibiría lo mismo, pero dejaría al código
      // pidiendo más permiso del que la plantilla del callout concede (ADR-008).
      subscription.subject.should.not.containEql('*');
      subscription.subject.should.not.containEql('>');
      String(subscription.opts!.queue).should.equal('jiku-events');
      // Los servicios PRIMERO: si el registro de uno falla, el arranque tiene que morir sin
      // haber abierto una suscripción a medias.
      nc.trace.should.deepEqual(['services.add', 'services.add', 'subscribe']);

      await host.stop();
    });

    it('S-016 TS-25 · el queue group sale de NATS_EVENTS_QUEUE, con default jiku-events', async () => {
      const withDefault = fakeConnection();
      const first = new TestHost(withDefault, specNamed('jiku-commands')).withEventConsumer(
        consumer(noop)
      );
      await first.start();
      String(withDefault.subscriptions[0].opts!.queue).should.equal('jiku-events');
      await first.stop();

      process.env.NATS_EVENTS_QUEUE = 'otro-grupo';
      const overridden = fakeConnection();
      const second = new TestHost(overridden, specNamed('jiku-commands')).withEventConsumer(
        consumer(noop)
      );
      await second.start();
      // El default vive donde se lee la variable, no duplicado en dos archivos.
      String(overridden.subscriptions[0].opts!.queue).should.equal('otro-grupo');
      await second.stop();
    });

    it('S-016 TS-26 · loguea la línea que separa "no se suscribió" de "se suscribió y no llega nada"', async () => {
      const info = sinon.spy(logger, 'info');
      try {
        const nc = fakeConnection();
        const host = new TestHost(nc, specNamed('jiku-commands')).withEventConsumer(
          consumer(noop)
        );

        await host.start();

        // ES EL CRITERIO, NO UN ADORNO: `subscribe()` no falla si el callout no autorizó el
        // subject —el cliente NATS no valida permisos de suscripción localmente— y la violación
        // aparece en el log del SERVIDOR, no acá.
        const lines = info
          .getCalls()
          .map((call) => String(call.args[0]))
          .filter((line) => line.startsWith('[events]'));
        lines.should.deepEqual([`[events] suscripto a ${AUTH_SUBJECT}`]);

        await host.stop();
      } finally {
        info.restore();
      }
    });

    it('S-016 TS-27 · SIN withEventConsumer() no hay suscripción, y el apagado viejo no cambia', async () => {
      const nc = fakeConnection();
      // La forma exacta de los ocho tests existentes del archivo.
      const host = new TestHost(nc, specNamed('jiku-commands'));

      await host.start();

      nc.subscriptions.length.should.equal(0);
      nc.trace.should.not.containEql('subscribe');

      await host.stop();

      nc.trace.should.deepEqual(['service.stop', 'connection.drain', 'connection.close']);
    });

    it('S-016 TS-28 · el consumidor de eventos NO es un servicio micro', async () => {
      const nc = fakeConnection();
      const host = new TestHost(
        nc,
        specNamed('jiku-commands'),
        specNamed('jiku-queries')
      ).withEventConsumer(consumer(noop));

      await host.start();

      nc.configs.length.should.equal(2);
      nc.configs.map((config) => config.name).should.deepEqual([
        'jiku-commands',
        'jiku-queries',
      ]);
      // Ninguna config menciona eventos: `registerService()` no se invocó una tercera vez, y por
      // eso `nats micro ls` sigue mostrando exactamente dos servicios.
      JSON.stringify(nc.configs).should.not.containEql('events');
      nc.created.length.should.equal(2);
      for (const service of nc.created) {
        service.groups.length.should.equal(1);
      }

      await host.stop();
    });

    it('S-016 TS-29 · un cuerpo que no es JSON: warn, el handle NO se invoca, y el iterador sigue vivo', async () => {
      const warn = sinon.spy(logger, 'warn');
      try {
        const nc = fakeConnection();
        const handle = sinon.spy((_payload: unknown): Promise<void> => Promise.resolve());
        const host = new TestHost(nc, specNamed('jiku-commands')).withEventConsumer(
          consumer(handle)
        );
        await host.start();
        const subscription = nc.subscriptions[0];

        await subscription.push(encode('{no-json'));

        warn.callCount.should.equal(1);
        String(warn.firstCall.args[0]).should.startWith('[events]');
        handle.callCount.should.equal(0);
        // NADIE RESPONDIÓ: `respond()` sobre un mensaje sin `reply` subject es un no-op
        // silencioso que además ensucia los contadores de `$SRV`.
        subscription.delivered[0].replyCount.should.equal(0);

        await subscription.push(authEvent());

        // La segunda mitad es la que importa: el cuerpo malo NO mató el iterador.
        handle.callCount.should.equal(1);
        (handle.firstCall.args[0] as { id: string }).id.should.equal('281234567890123456');

        await host.stop();
      } finally {
        warn.restore();
      }
    });

    it('S-016 TS-30 · un handle que RECHAZA no mata el iterador', async () => {
      const warn = sinon.spy(logger, 'warn');
      const error = sinon.spy(logger, 'error');
      const rejections: unknown[] = [];
      const onRejection = (reason: unknown): void => {
        rejections.push(reason);
      };
      process.on('unhandledRejection', onRejection);
      try {
        const nc = fakeConnection();
        let calls = 0;
        const handle = (): Promise<void> => {
          calls += 1;
          return calls === 1 ? Promise.reject(new Error('boom')) : Promise.resolve();
        };
        const host = new TestHost(nc, specNamed('jiku-commands')).withEventConsumer(
          consumer(handle)
        );
        await host.start();
        const subscription = nc.subscriptions[0];

        await subscription.push(authEvent());
        await subscription.push(authEvent());

        const logged = [...warn.getCalls(), ...error.getCalls()].map((call) =>
          String(call.args[0])
        );
        logged.filter((line) => line.includes('boom')).length.should.equal(1);
        // SIN el try/catch por mensaje, `calls` se quedaría en 1: el iterador habría terminado y
        // core dejaría de recibir eventos PARA SIEMPRE, con un solo error en el log y sin que
        // ningún healthcheck lo note.
        calls.should.equal(2);

        await host.stop();
        await tick();
        rejections.should.deepEqual([]);
      } finally {
        process.off('unhandledRejection', onRejection);
        warn.restore();
        error.restore();
      }
    });

    it('S-016 TS-31 · stop() drena la suscripción ENTRE los servicios y la conexión', async () => {
      const nc = fakeConnection();
      const host = new TestHost(
        nc,
        specNamed('jiku-commands'),
        specNamed('jiku-queries')
      ).withEventConsumer(consumer(noop));

      await host.start();
      // Lo único que `start()` deja en la traza es la suscripción.
      nc.trace.should.deepEqual(['subscribe']);
      const afterStart = nc.trace.length;

      await host.stop();

      // EL ORDEN ES LA GARANTÍA: servicios primero (que no entre una request nueva), suscripción
      // después (que el evento en vuelo termine), conexión al final.
      nc.trace.slice(afterStart).should.deepEqual([
        'service.stop',
        'service.stop',
        'subscription.drain',
        'connection.drain',
        'connection.close',
      ]);
    });

    it('S-016 TS-32 · stop() sin start() previo, y stop() sin consumidor, no lanzan', async () => {
      const withConsumer = fakeConnection();
      await new TestHost(withConsumer, specNamed('jiku-commands'))
        .withEventConsumer(consumer(noop))
        .stop();
      // Es la regresión del TS-25 de S-012: declarar el consumidor no abre nada.
      withConsumer.trace.should.deepEqual([]);

      const withoutConsumer = fakeConnection();
      const host = new TestHost(withoutConsumer, specNamed('jiku-commands'));
      await host.start();
      await host.stop();
      withoutConsumer.trace.should.not.containEql('subscription.drain');
    });

    it('S-016 TS-33 · un evento EN VUELO termina antes de que drain() resuelva', async () => {
      const nc = fakeConnection();
      let release: (() => void) | null = null;
      let completed = false;
      const handle = (): Promise<void> =>
        new Promise<void>((resolve) => {
          release = (): void => {
            completed = true;
            resolve();
          };
        });
      const host = new TestHost(nc, specNamed('jiku-commands')).withEventConsumer(
        consumer(handle)
      );
      await host.start();

      // Sin `await`: el handle está bloqueado a propósito.
      void nc.subscriptions[0].push(authEvent());
      while (release === null) {
        await tick();
      }

      let stopped = false;
      const stopping = host.stop().then(() => {
        stopped = true;
      });
      await tick();
      // El drenaje NO puede haber terminado con un evento a medias: sin JetStream, un evento
      // cortado se pierde sin rastro.
      stopped.should.be.false();
      completed.should.be.false();

      (release as unknown as () => void)();
      await stopping;

      completed.should.be.true();
      const trace = nc.trace;
      trace
        .indexOf('subscription.drain')
        .should.be.below(trace.indexOf('connection.drain'));
    });

    it('S-016 TS-34 · withEventConsumer() después de start() LANZA', async () => {
      const nc = fakeConnection();
      const host = new TestHost(nc, specNamed('jiku-commands'));
      await host.start();
      let thrown: Error | null = null;

      try {
        host.withEventConsumer(consumer(noop));
      } catch (error) {
        thrown = error as Error;
      }

      // Sin el guard el síntoma sería "no llega ni un evento", que es el síntoma que toda esta
      // story pelea por hacer diagnosticable.
      (thrown === null).should.be.false();
      String(thrown!.message).should.containEql('withEventConsumer');
      String(thrown!.message).should.containEql('start()');

      await host.stop();
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
