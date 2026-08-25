import 'mocha';
import 'should';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as sinon from 'sinon';
import { NatsError, NatsConnection, ServiceMsg } from 'nats';
import { Reply, commandSubject, failure, success } from '@jiku/nats-protocol';
import { ServiceSpec, registerService } from '../../src/bus/service';
import { registry } from '../../src/commands';
import { queryRegistry } from '../../src/queries';
import logger from '../../src/logger';
import { FakeMsg, decode, encode, fakeConnection, fakeMsg } from '../helpers/micro-double';

/** La descripción real del servicio, la misma que `src/index.ts` construye. */
const DESCRIPTION = 'Comandos de dominio de Jiku: la única vía de escritura a la base';

/**
 * Los 20 endpoints, COPIADOS del contrato (`docs/apis/core.yaml`:151-171), no recalculados con
 * `endpointName`/`endpointSubject`. Recalcularlos verificaría que el paquete es consistente
 * consigo mismo; copiarlos verifica que el servicio expone lo que el contrato promete.
 */
const CONTRACT_ENDPOINTS: [string, string][] = [
  ['clients-new', 'clients.new'],
  ['clients-edit', 'clients.*.edit'],
  ['projects-new', 'projects.new'],
  ['projects-edit', 'projects.*.edit'],
  ['tasks-new', 'tasks.new'],
  ['tasks-edit', 'tasks.*.edit'],
  ['tasks-comment', 'tasks.*.comment'],
  ['requirements-new', 'requirements.new'],
  ['requirements-edit', 'requirements.*.edit'],
  ['requirements-resolve', 'requirements.*.resolve'],
  ['requirements-comment', 'requirements.*.comment'],
  ['requirements-subscriptors-new', 'requirements.*.subscriptors.new'],
  ['requirements-subscriptors-delete', 'requirements.*.subscriptors.*.delete'],
  ['attachments-delete', 'attachments.*.delete'],
  ['files-request-upload', 'files.request-upload'],
  ['files-request-download', 'files.*.request-download'],
  ['worked-times-new', 'worked-times.new'],
  ['worked-times-delete', 'worked-times.*.delete'],
  ['unworked-times-new', 'unworked-times.new'],
  ['unworked-times-delete', 'unworked-times.*.delete'],
];

function specFor(
  handle: ServiceSpec['handle'],
  patterns: string[] = ['clients.new']
): ServiceSpec {
  return { name: 'jiku-commands', description: DESCRIPTION, patterns, handle };
}

/** La descripción real del servicio de consultas, la misma que `src/index.ts` construye. */
const QUERIES_DESCRIPTION = 'Consultas de lectura de Jiku: proyectos, tareas y comentarios';

/**
 * Los 18 endpoints de consulta, COPIADOS de la tabla del contrato, no recalculados. Ninguno lleva
 * `{param}`, así que ningún subject lleva `*`: es una decisión de performance (el cache de
 * subjects de 1024 entradas del server), no un olvido.
 */
const QUERY_CONTRACT_ENDPOINTS: [string, string][] = [
  ['clients-list', 'clients.list'],
  ['clients-get', 'clients.get'],
  ['projects-list', 'projects.list'],
  ['projects-get', 'projects.get'],
  ['requirements-list', 'requirements.list'],
  ['requirements-get', 'requirements.get'],
  ['tasks-list', 'tasks.list'],
  ['tasks-get', 'tasks.get'],
  ['comments-list', 'comments.list'],
  ['comments-get', 'comments.get'],
  ['activity-list', 'activity.list'],
  ['subscriptions-list', 'subscriptions.list'],
  // Los dos de S-027: `registerService` los deriva del registro, así que sumar la ficha alcanzó
  // para que el endpoint exista y `nats micro info jiku-queries` los liste.
  ['attachments-list', 'attachments.list'],
  ['files-get', 'files.get'],
  // Los seis de S-026. `endpointName('worked-times.list')` es `'worked-times-list'`: el guion del
  // nombre del recurso NO es un separador de subject, y `String.replace` con un string reemplaza
  // la PRIMERA ocurrencia — los patrones tienen un solo punto.
  ['people-list', 'people.list'],
  ['users-list', 'users.list'],
  ['worked-times-list', 'worked-times.list'],
  ['unworked-times-list', 'unworked-times.list'],
  ['week-assigned-times-list', 'week-assigned-times.list'],
  ['project-permissions-list', 'project-permissions.list'],
];

/**
 * El spec de consultas, con la descripción REAL: si mañana cambia en `src/index.ts`, el test lo
 * delata. Mismo criterio que `specFor()` para los comandos.
 */
function queriesSpecFor(
  handle: ServiceSpec['handle'],
  patterns: string[] = queryRegistry.patterns()
): ServiceSpec {
  return { name: 'jiku-queries', description: QUERIES_DESCRIPTION, patterns, handle };
}

/** Deja correr los microtasks: el handler de micro invoca `handle()` con `void`, sin `await`. */
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/** Todos los `.ts` de `core/src`, para las aserciones que son sobre el código y no sobre datos. */
function sourceFiles(dir = join(__dirname, '..', '..', 'src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

/**
 * Entrega un mensaje por el MISMO camino que un mensaje real: el handler que
 * `registerService` registró en el endpoint. No se llama a `handle()` directamente —igual que
 * los tests de comandos entran por el despachador y no por `execute()`.
 */
async function deliver(msg: FakeMsg, handle: ServiceSpec['handle']): Promise<void> {
  const nc = fakeConnection();
  await registerService(nc as unknown as NatsConnection, specFor(handle));
  const handler = nc.created[0].group.endpoints[0].handler;
  (typeof handler).should.equal('function');
  handler!(null, msg as unknown as ServiceMsg);
  await flush();
}

/**
 * Igual que `deliver()`, pero por el endpoint que `registerService` registró para el spec de
 * CONSULTAS. Es el mismo `handle()` de los comandos —eso es justamente lo que verifica CA-14—,
 * así que lo único que cambia es el spec.
 */
async function deliverQuery(
  msg: FakeMsg,
  handle: ServiceSpec['handle'],
  pattern = 'tasks.list'
): Promise<void> {
  const nc = fakeConnection();
  await registerService(nc as unknown as NatsConnection, queriesSpecFor(handle, [pattern]));
  const handler = nc.created[0].group.endpoints[0].handler;
  (typeof handler).should.equal('function');
  handler!(null, msg as unknown as ServiceMsg);
  await flush();
}

/**
 * Reimporta el módulo con otro `SERVICE_VERSION`: se lee AL IMPORTARSE, así que no hay forma de
 * cambiarlo después del import. Local a este archivo a propósito: es un caso, no una necesidad
 * general. Mismo patrón que `packages/nats-protocol/tests/helpers/reload.ts`.
 */
function reloadService(version?: string): typeof import('../../src/bus/service') {
  const saved = process.env.SERVICE_VERSION;
  if (version === undefined) {
    delete process.env.SERVICE_VERSION;
  } else {
    process.env.SERVICE_VERSION = version;
  }

  const modulePath = require.resolve('../../src/bus/service');
  delete require.cache[modulePath];
  const loaded = require('../../src/bus/service') as typeof import('../../src/bus/service');

  if (saved === undefined) {
    delete process.env.SERVICE_VERSION;
  } else {
    process.env.SERVICE_VERSION = saved;
  }
  delete require.cache[modulePath];
  return loaded;
}

describe('bus/service', () => {
  describe('dobles de micro (humo)', () => {
    it('fakeMsg().json() parsea el cuerpo', () => {
      fakeMsg({ data: encode('{"a":1}') }).json<{ a: number }>().a.should.equal(1);
    });

    it('fakeMsg().json() lanza con un cuerpo que no es JSON, igual que la librería real', () => {
      (() => fakeMsg({ data: encode('{no-json') }).json()).should.throw();
    });

    it('fakeConnection().services.add registra la config y devuelve un servicio con addGroup', () => {
      const nc = fakeConnection();
      return nc.services.add({ name: 'jiku-commands', version: '1.0.0' }).then((service) => {
        nc.configs[0].name.should.equal('jiku-commands');
        service.addGroup('dev.*.jiku-commands.v1').endpoints.length.should.equal(0);
      });
    });
  });

  // TS-27. El helper de tests dejó de armar el subject a mano (Tarea 1); esto verifica que el
  // string que produce es IDÉNTICO al que producía la concatenación manual que había antes.
  describe('la gramática del subject que usa el helper de tests (TS-27)', () => {
    it('commandSubject("clients.new", "api") es dev.api.jiku-commands.v1.clients.new', () => {
      commandSubject('clients.new', 'api').should.equal('dev.api.jiku-commands.v1.clients.new');
    });
  });

  describe('handle() / respond(): ninguna request queda sin contestar', () => {
    const DELETE_SUBJECT = 'dev.api.jiku-commands.v1.unworked-times.7.delete';
    const NEW_SUBJECT = 'dev.api.jiku-commands.v1.clients.new';

    it('TS-1 · un cuerpo vacío se trata como {}, no como error', async () => {
      const calls: { subject: string; payload: unknown }[] = [];
      const msg = fakeMsg({ subject: DELETE_SUBJECT, data: new Uint8Array(0) });

      await deliver(msg, (subject, payload) => {
        calls.push({ subject, payload });
        return Promise.resolve(success());
      });

      calls.length.should.equal(1);
      calls[0].subject.should.equal(DELETE_SUBJECT);
      JSON.stringify(calls[0].payload).should.equal('{}');
      decode(msg.responses[0].data).should.equal('{"status":"success"}');
      msg.errorResponses.length.should.equal(0);
    });

    it('TS-2 · un payload que no es JSON se contesta invalid_fields y no llega al despachador', async () => {
      let invoked = 0;
      const msg = fakeMsg({ subject: NEW_SUBJECT, data: encode('{no-json') });

      await deliver(msg, () => {
        invoked += 1;
        return Promise.resolve(success());
      });

      invoked.should.equal(0);
      msg.errorResponses.length.should.equal(1);
      msg.errorResponses[0].code.should.equal(500);
      msg.errorResponses[0].description.should.equal('invalid_fields');
      decode(msg.errorResponses[0].data).should.equal(
        '{"status":"failure","errorCode":"invalid_fields","errorMessage":"Malformed JSON payload"}'
      );
    });

    it('TS-3 · un handler que rechaza se contesta internal_error', async () => {
      const msg = fakeMsg({ subject: NEW_SUBJECT, data: encode('{"name":"Acme"}') });

      await deliver(msg, () => Promise.reject(new Error('boom')));

      msg.replyCount.should.equal(1);
      msg.errorResponses[0].code.should.equal(500);
      msg.errorResponses[0].description.should.equal('internal_error');
      decode(msg.errorResponses[0].data).should.equal(
        '{"status":"failure","errorCode":"internal_error","errorMessage":"Internal error"}'
      );
    });

    it('TS-4 · un handler que lanza sincrónicamente tampoco se escapa', async () => {
      const msg = fakeMsg({ subject: NEW_SUBJECT, data: encode('{"name":"Acme"}') });

      await deliver(msg, () => {
        throw new Error('sync boom');
      });

      msg.replyCount.should.equal(1);
      msg.errorResponses[0].description.should.equal('internal_error');
    });

    it('TS-5 · un success viaja por respond(), sin headers de error', async () => {
      const msg = fakeMsg({ subject: NEW_SUBJECT, data: encode('{"name":"Acme"}') });

      await deliver(msg, () => Promise.resolve(success({ id: 7 })));

      decode(msg.responses[0].data).should.equal('{"status":"success","data":{"id":7}}');
      msg.errorResponses.length.should.equal(0);
    });

    it('TS-6 · un failure de negocio viaja EN EL CUERPO, con el errorCode como descripción', async () => {
      const msg = fakeMsg({ subject: 'dev.api.jiku-commands.v1.tasks.new', data: encode('{}') });

      await deliver(msg, () =>
        Promise.resolve(failure('project_not_found', 'Project not found'))
      );

      msg.responses.length.should.equal(0);
      msg.errorResponses[0].code.should.equal(500);
      msg.errorResponses[0].description.should.equal('project_not_found');
      decode(msg.errorResponses[0].data).should.equal(
        '{"status":"failure","errorCode":"project_not_found","errorMessage":"Project not found"}'
      );
    });

    it('TS-7 · un failure sin errorCode no rompe la respuesta', async () => {
      const msg = fakeMsg({ subject: NEW_SUBJECT, data: encode('{}') });

      await deliver(msg, () => Promise.resolve({ status: 'failure' } as Reply));

      msg.errorResponses[0].description.should.equal('error');
      decode(msg.errorResponses[0].data).should.equal('{"status":"failure"}');
    });

    it('TS-8 · ningún camino deja el mensaje sin contestar: exactamente una respuesta', async () => {
      const cases: { name: string; msg: FakeMsg; handle: ServiceSpec['handle'] }[] = [
        {
          name: 'cuerpo vacío',
          msg: fakeMsg({ subject: DELETE_SUBJECT, data: new Uint8Array(0) }),
          handle: () => Promise.resolve(success()),
        },
        {
          name: 'cuerpo no-JSON',
          msg: fakeMsg({ subject: NEW_SUBJECT, data: encode('{no-json') }),
          handle: () => Promise.resolve(success()),
        },
        {
          name: 'handler que rechaza',
          msg: fakeMsg({ subject: NEW_SUBJECT, data: encode('{"name":"Acme"}') }),
          handle: () => Promise.reject(new Error('boom')),
        },
        {
          name: 'failure de negocio',
          msg: fakeMsg({ subject: NEW_SUBJECT, data: encode('{}') }),
          handle: () => Promise.resolve(failure('project_not_found', 'Project not found')),
        },
      ];

      for (const testCase of cases) {
        await deliver(testCase.msg, testCase.handle);
        testCase.msg.replyCount.should.equal(1, testCase.name);
      }
    });

    it('TS-9 · el payload inválido se loguea como warn, no como error', async () => {
      const warn = sinon.spy(logger, 'warn');
      const error = sinon.spy(logger, 'error');
      try {
        await deliver(
          fakeMsg({ subject: NEW_SUBJECT, data: encode('{no-json') }),
          () => Promise.resolve(success())
        );

        warn.callCount.should.equal(1);
        String(warn.firstCall.args[0]).should.startWith('[bus]');
        error.callCount.should.equal(0);
      } finally {
        warn.restore();
        error.restore();
      }
    });

    // Tarea 3 · AC-8, segunda mitad. El plan la exige pero no le dedica un TS-X: sin este test
    // la rama de `logger.error` de `handle()` quedaba sin ejercitar.
    it('la excepción se loguea como error con prefijo [bus], y no como warn', async () => {
      const warn = sinon.spy(logger, 'warn');
      const error = sinon.spy(logger, 'error');
      try {
        await deliver(
          fakeMsg({ subject: NEW_SUBJECT, data: encode('{"name":"Acme"}') }),
          () => Promise.reject(new Error('boom'))
        );

        error.callCount.should.equal(1);
        String(error.firstCall.args[0]).should.startWith('[bus]');
        String(error.firstCall.args[0]).should.containEql('boom');
        warn.callCount.should.equal(0);
      } finally {
        warn.restore();
        error.restore();
      }
    });
  });

  describe('registerService()', () => {
    const handle = (): Promise<Reply> => Promise.resolve(success());

    it('TS-10 · el servicio se anuncia con nombre, versión, queue group y metadata', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, registry.patterns())
      );

      nc.configs.length.should.equal(1);
      nc.configs[0].should.deepEqual({
        name: 'jiku-commands',
        version: '1.0.0',
        description: DESCRIPTION,
        queue: 'jiku-commands',
        metadata: { instance: 'dev', protocol: 'v1' },
      });
    });

    it('TS-11 · el grupo se arma con groupSubject(), con el * del caller y SIN .>', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, registry.patterns())
      );

      nc.created[0].groups.length.should.equal(1);
      String(nc.created[0].group.subject).should.equal('dev.*.jiku-commands.v1');
    });

    it('TS-12 · los 20 endpoints salen del registry, con el par (nombre, subject) del contrato', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, registry.patterns())
      );

      const registered = nc.created[0].group.endpoints.map(
        (endpoint) => [endpoint.name, endpoint.subject] as [string, string | undefined]
      );
      registered.length.should.equal(20);
      registered.should.deepEqual(CONTRACT_ENDPOINTS);
    });

    it('TS-13 · no hay lista escrita a mano: un patrón nuevo se registra solo', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, [...registry.patterns(), 'widgets.{id}.archive'])
      );

      const endpoints = nc.created[0].group.endpoints;
      endpoints.length.should.equal(21);
      endpoints[20].name.should.equal('widgets-archive');
      String(endpoints[20].subject).should.equal('widgets.*.archive');

      // La otra mitad del escenario, y la que de verdad prueba que no hay lista a mano: el
      // endpoint 21 se registró sin que `widgets` aparezca en NINGÚN archivo de `src/`.
      const mentioning = sourceFiles().filter((file) =>
        readFileSync(file, 'utf8').includes('widgets')
      );
      mentioning.should.deepEqual([]);
    });

    it('TS-14 · cada endpoint recibe un handler, no queda como iterador', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, registry.patterns())
      );

      for (const endpoint of nc.created[0].group.endpoints) {
        (typeof endpoint.handler).should.equal('function');
      }
    });

    it('TS-15 · un subject duplicado falla el registro, nombrando servicio y subject', async () => {
      const nc = fakeConnection();
      let thrown: Error | null = null;

      try {
        await registerService(
          nc as unknown as NatsConnection,
          specFor(handle, ['tasks.{id}.edit', 'tasks.{other}.edit'])
        );
      } catch (error) {
        thrown = error as Error;
      }

      (thrown === null).should.be.false();
      thrown!.message.should.containEql('jiku-commands');
      thrown!.message.should.containEql('tasks.*.edit');
      nc.created[0].group.endpoints.length.should.equal(1);
    });

    it('TS-16 · los 20 patrones reales no se solapan', async () => {
      const nc = fakeConnection();

      await registerService(
        nc as unknown as NatsConnection,
        specFor(handle, registry.patterns())
      );

      const subjects = nc.created[0].group.endpoints.map((endpoint) => endpoint.subject);
      new Set(subjects).size.should.equal(20);
    });

    it('TS-17 · la versión sale de SERVICE_VERSION, con default 1.0.0 SemVer estricto', async () => {
      const strictSemVer = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

      const withoutEnv = fakeConnection();
      await reloadService().registerService(
        withoutEnv as unknown as NatsConnection,
        specFor(handle)
      );
      String(withoutEnv.configs[0].version).should.equal('1.0.0');
      strictSemVer.test(String(withoutEnv.configs[0].version)).should.be.true();

      const withEnv = fakeConnection();
      await reloadService('2.3.4').registerService(
        withEnv as unknown as NatsConnection,
        specFor(handle)
      );
      String(withEnv.configs[0].version).should.equal('2.3.4');
    });

    it('TS-18 · un SERVICE_VERSION inválido se pasa tal cual: no se sanea', async () => {
      const nc = fakeConnection();

      await reloadService('latest').registerService(
        nc as unknown as NatsConnection,
        specFor(handle)
      );

      String(nc.configs[0].version).should.equal('latest');
    });

    it('TS-19 · si services.add rechaza, el error se propaga sin envolverse', async () => {
      const boom = new Error("'latest' is not a semver value");
      const nc = fakeConnection({ add: () => Promise.reject(boom) });
      let thrown: Error | null = null;

      try {
        await registerService(nc as unknown as NatsConnection, specFor(handle));
      } catch (error) {
        thrown = error as Error;
      }

      (thrown === boom).should.be.true();
      nc.created.length.should.equal(0);
    });

    // Tarea 4 · AC-6, primera rama. Tampoco tiene un TS-X propio: sin este test la rama de
    // `err` no nulo del handler registrado quedaba sin ejercitar.
    it('un err no nulo en el handler se loguea y RETORNA, sin contestar el mensaje', async () => {
      const nc = fakeConnection();
      await registerService(nc as unknown as NatsConnection, specFor(handle));
      const endpointHandler = nc.created[0].group.endpoints[0].handler!;
      const msg = fakeMsg({ subject: 'dev.api.jiku-commands.v1.clients.new' });
      const error = sinon.spy(logger, 'error');

      try {
        endpointHandler(new Error('subscription boom') as NatsError, msg as unknown as ServiceMsg);
        await flush();

        error.callCount.should.equal(1);
        String(error.firstCall.args[0]).should.startWith('[bus] jiku-commands clients.new');
        // No hay request que contestar: el error es de la suscripción, no de un mensaje.
        msg.replyCount.should.equal(0);
      } finally {
        error.restore();
      }
    });
  });

  /**
   * El SEGUNDO servicio del proceso. Nada de lo que verifica es código nuevo de `service.ts`:
   * `registerService` ya era genérico desde S-012, y lo que S-013 comprueba es que las
   * propiedades que dejó implementadas SE CUMPLEN CON DOS.
   */
  describe('registerService() con el spec de CONSULTAS (jiku-queries)', () => {
    const handle = (): Promise<Reply> => Promise.resolve(success());

    it('TS-21 · el servicio de consultas se anuncia con nombre, versión, queue group y metadata', async () => {
      const nc = fakeConnection();

      await registerService(nc as unknown as NatsConnection, queriesSpecFor(handle));

      nc.configs.length.should.equal(1);
      // `queue: 'jiku-queries'`, NO `q`: sin esa línea el balanceo entre réplicas se compartiría
      // con el de comandos y nada lo delataría.
      nc.configs[0].should.deepEqual({
        name: 'jiku-queries',
        version: '1.0.0',
        description: QUERIES_DESCRIPTION,
        queue: 'jiku-queries',
        metadata: { instance: 'dev', protocol: 'v1' },
      });
    });

    it('TS-22 · el grupo de consultas es el suyo, con el * del caller y SIN .>', async () => {
      const nc = fakeConnection();

      await registerService(nc as unknown as NatsConnection, queriesSpecFor(handle));

      nc.created[0].groups.length.should.equal(1);
      String(nc.created[0].group.subject).should.equal('dev.*.jiku-queries.v1');
    });

    it('TS-23 · un endpoint por patrón, con el par (nombre, subject) del contrato y SIN *', async () => {
      const nc = fakeConnection();

      await registerService(nc as unknown as NatsConnection, queriesSpecFor(handle));

      const registered = nc.created[0].group.endpoints.map(
        (endpoint) => [endpoint.name, endpoint.subject] as [string, string | undefined]
      );
      // UNO POR PATRÓN DEL REGISTRO: sumar una ficha nueva a `queries/index.ts` alcanza para que
      // el endpoint exista, y por eso el número sale del registro y no de un literal.
      registered.length.should.equal(queryRegistry.patterns().length);
      registered.should.deepEqual(QUERY_CONTRACT_ENDPOINTS);

      for (const [name, subject] of registered) {
        String(subject).should.not.containEql('*');
        name.should.not.containEql('.');
      }
    });

    it('TS-27 · un payload no-JSON en un endpoint de CONSULTA se contesta por el mismo handle()', async () => {
      let invoked = 0;
      const msg = fakeMsg({
        subject: 'dev.api.jiku-queries.v1.tasks.list',
        data: encode('{no-json'),
      });

      await deliverQuery(msg, () => {
        invoked += 1;
        return Promise.resolve(success());
      });

      invoked.should.equal(0);
      msg.replyCount.should.equal(1);
      msg.errorResponses[0].code.should.equal(500);
      msg.errorResponses[0].description.should.equal('invalid_fields');
      decode(msg.errorResponses[0].data).should.equal(
        '{"status":"failure","errorCode":"invalid_fields","errorMessage":"Malformed JSON payload"}'
      );
    });

    it('TS-27 · una excepción en un endpoint de CONSULTA también se contesta, con internal_error', async () => {
      const msg = fakeMsg({
        subject: 'dev.api.jiku-queries.v1.tasks.list',
        data: encode('{}'),
      });

      await deliverQuery(msg, () => Promise.reject(new Error('boom')));

      msg.replyCount.should.equal(1);
      msg.errorResponses[0].code.should.equal(500);
      msg.errorResponses[0].description.should.equal('internal_error');
      decode(msg.errorResponses[0].data).should.equal(
        '{"status":"failure","errorCode":"internal_error","errorMessage":"Internal error"}'
      );
    });
  });
});
