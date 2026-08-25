import 'mocha';
import 'should';
import * as fs from 'fs';
import * as path from 'path';
import sinon from 'sinon';
import { Sequelize } from 'sequelize-typescript';
import { Client, File, User } from '@jiku/models';
import { ErrorCode, querySubject, success } from '@jiku/nats-protocol';
import { ROLE_METHODS, rolesAuthorize } from '../../src/authorize-caller';
import { Dispatcher } from '../../src/bus/dispatcher';
import { registry } from '../../src/commands';
import { matchesPattern } from '../../src/commands/registry';
import logger from '../../src/logger';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import { queryRegistry } from '../../src/queries';
import { QueryDispatcher } from '../../src/queries/dispatcher';
import { QueryRegistry } from '../../src/queries/registry';
import { dispatch, dispatchQuery } from '../helpers/dispatch';
import { S3Double, installS3Double, uninstallS3Double } from '../helpers/s3-double';

/**
 * ESTE ARCHIVO TIENE QUE CORRER PRIMERO, Y EL NOMBRE DE LA CARPETA ES LO QUE LO GARANTIZA.
 * `.mocharc.json` levanta los `*.test.ts` de `tests/` recursivamente, y `tests/auth/` ordena
 * alfabéticamente antes que `tests/bus/`, `tests/commands/`, `tests/events/`, `tests/models/` y
 * `tests/queries/`. Importa porque CA-1
 * exige despachar con la tabla `users` COMPLETAMENTE VACÍA, y lo único que la deja vacía es el
 * `TRUNCATE ... RESTART IDENTITY CASCADE` de `tests/global-setup.ts`, que corre una vez al
 * arrancar la corrida.
 *
 * El `before` de CA-1 lo verifica en vez de suponerlo: si otro archivo dejó filas, el `destroy`
 * falla por las FK (`files.uploaded_by`, `projects.created_by`, …) o el `count` no da 0, y el
 * error dice exactamente qué pasó en vez de fallar por una causa confusa.
 */

describe('matchesPattern — el matcher por segmentos extraído del registry', () => {
  it('TS-7 · un patrón sin params es match exacto', () => {
    matchesPattern('clients.new', 'clients.new').should.be.true();
    matchesPattern('clients.new', 'clients.edit').should.be.false();
  });

  it('TS-8 · el segmento variable captura cualquier token', () => {
    matchesPattern('files.{fileId}.request-download', 'files.7.request-download').should.be.true();
    matchesPattern('requirements.{id}.comment', 'requirements.999.comment').should.be.true();
    // El id puede ser un número o un string de Zitadel, y ESA es la razón por la que el matching
    // es por segmentos y no por regex.
    matchesPattern('tasks.{id}.edit', 'tasks.abc-DEF_123.edit').should.be.true();
  });

  it('TS-9 · distinta cantidad de segmentos NUNCA matchea', () => {
    matchesPattern('tasks.{id}.edit', 'tasks.new').should.be.false();
    matchesPattern('tasks.new', 'tasks.7.edit').should.be.false();
    matchesPattern(
      'requirements.{id}.subscriptors.{userId}.delete',
      'requirements.7.comment'
    ).should.be.false();
  });

  it('TS-10 · el literal no matchea en la posición del param, ni al revés', () => {
    matchesPattern('tasks.{id}.edit', 'tasks.7.comment').should.be.false();
    matchesPattern('files.request-upload', 'files.7.request-upload').should.be.false();
  });
});

/**
 * El mapa rol → método, ejercitado PURO: sin base, sin despachador y sin config cargada. Los
 * tests de `authorizeCaller` —que sí tocan la base— entran por los despachadores más abajo,
 * como manda la convención `testing`.
 */
describe('ROLE_METHODS / rolesAuthorize — el mapa, puro y sin base', () => {
  /** Un patrón con `{param}` no es un método: se sustituye por un token concreto. */
  const asMethod = (pattern: string): string => pattern.replace(/\{[^}]+\}/g, '7');
  /** La forma del patrón en la gramática de subjects de NATS, que es la de la plantilla. */
  const asSubjectToken = (pattern: string): string => pattern.replace(/\{[^}]+\}/g, '*');

  const COMMANDS = registry.patterns();
  const QUERIES = queryRegistry.patterns();

  /**
   * Los nueve subjects LEÍDOS DE LA PLANTILLA DEL CALLOUT, no escritos a mano.
   *
   * Es la única mitigación posible del riesgo alto que la story registra sin mitigación técnica:
   * los nueve están enumerados en DOS archivos y nada los mantiene sincronizados. Leer la
   * plantilla convierte esa desincronización en un test rojo. Precedente en esta misma suite:
   * `models/read.test.ts` lee `deploy/.env.dist` para verificar los statement_timeout.
   */
  const templateSubjects = (): string[] => {
    const template = fs.readFileSync(
      path.join(__dirname, '../../../deploy/nats/auth-callout/templates/external-publisher.yaml'),
      'utf8'
    );
    const prefix = '{{instance}}.{{user_id}}.jiku-commands.v1.';
    return template
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- "') && line.includes(prefix))
      .map((line) => line.slice(3, -1).replace(prefix, ''));
  };

  it('TS-11 · external-publisher autoriza LOS 9 de la plantilla del callout, uno por uno', () => {
    const fromTemplate = templateSubjects();
    // Si la plantilla ganó o perdió un subject, este test es el que se pone rojo.
    fromTemplate.length.should.equal(9);
    ROLE_METHODS['external-publisher'].commands.length.should.equal(9);
    // El mapa y la plantilla dicen lo mismo, cada uno en su gramática.
    [...ROLE_METHODS['external-publisher'].commands]
      .map(asSubjectToken)
      .should.deepEqual(fromTemplate);

    for (const pattern of ROLE_METHODS['external-publisher'].commands) {
      rolesAuthorize(['external-publisher'], asMethod(pattern), 'commands').should.be.true();
    }
  });

  it('TS-12 · external-publisher NO autoriza los 11 comandos restantes', () => {
    const nine = new Set<string>(ROLE_METHODS['external-publisher'].commands);
    // Los 20 salen de `registry.patterns()` y no de una lista a mano: así un comando 21 que
    // nadie clasifique rompe este test, que es exactamente lo que se quiere.
    const rest = COMMANDS.filter((pattern) => !nine.has(pattern));
    rest.length.should.equal(11);

    for (const pattern of rest) {
      rolesAuthorize(['external-publisher'], asMethod(pattern), 'commands').should.be.false();
    }
    // `clients.new` es el ejemplo literal de CA-8.
    rolesAuthorize(['external-publisher'], 'clients.new', 'commands').should.be.false();
  });

  it('TS-13 · external-publisher NO autoriza ninguna de las 6 consultas', () => {
    // Espeja la plantilla: "un publicador externo publica comandos, no lee".
    for (const query of QUERIES) {
      rolesAuthorize(['external-publisher'], query, 'queries').should.be.false();
    }
  });

  it('TS-14 · admin, user y external-user: TODAS las consultas y NINGÚN comando', () => {
    for (const role of ['admin', 'user', 'external-user']) {
      for (const query of QUERIES) {
        rolesAuthorize([role], query, 'queries').should.be.true();
      }
      // CA-4, el criterio menos intuitivo del mapa: el rol `admin` tampoco escribe por el bus.
      for (const pattern of COMMANDS) {
        rolesAuthorize([role], asMethod(pattern), 'commands').should.be.false();
      }
    }
  });

  it('TS-15 · core y bus-observer no autorizan nada en ningún plano', () => {
    for (const role of ['core', 'bus-observer']) {
      for (const pattern of COMMANDS) {
        rolesAuthorize([role], asMethod(pattern), 'commands').should.be.false();
      }
      for (const query of QUERIES) {
        rolesAuthorize([role], query, 'queries').should.be.false();
      }
    }
  });

  it('TS-16 · internal-app no autoriza nada POR SU ROL: el paso de la api es por sub', () => {
    rolesAuthorize(['internal-app'], 'clients.new', 'commands').should.be.false();
    rolesAuthorize(['internal-app'], 'tasks.list', 'queries').should.be.false();
  });

  it('TS-17 · roles: [] no autoriza nada', () => {
    rolesAuthorize([], 'clients.new', 'commands').should.be.false();
    rolesAuthorize([], 'tasks.list', 'queries').should.be.false();
  });

  it('TS-18 · un rol DESCONOCIDO no autoriza nada (deny-by-default)', () => {
    // Es lo que hace aceptable guardar `roles` sin validar contra ningún catálogo.
    rolesAuthorize(['wizard'], 'clients.new', 'commands').should.be.false();
    rolesAuthorize(['wizard'], 'tasks.list', 'queries').should.be.false();
  });

  it('TS-19 · varios roles son una UNIÓN, no una precedencia', () => {
    const both = ['external-publisher', 'admin'];
    rolesAuthorize(both, 'files.request-upload', 'commands').should.be.true();
    rolesAuthorize(both, 'tasks.list', 'queries').should.be.true();
    // La unión no inventa permisos: `clients.new` no está en ninguno de los dos.
    rolesAuthorize(both, 'clients.new', 'commands').should.be.false();
  });

  it('TS-20 · (gate) el mapa declara EXACTAMENTE 7 roles y ningún sentinela en commands', () => {
    Object.keys(ROLE_METHODS)
      .sort()
      .should.deepEqual([
        'admin',
        'bus-observer',
        'core',
        'external-publisher',
        'external-user',
        'internal-app',
        'user',
      ]);
    // El sentinela `'*'` está PROHIBIDO en el plano de comandos: la escritura se enumera,
    // siempre. Un rol agregado sin decisión rompe este test, que es el punto.
    Object.values(ROLE_METHODS)
      .every((permissions) => Array.isArray(permissions.commands))
      .should.be.true();
  });

  it('TS-20b · (gate) el mapa NO tiene cache ni estado', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../src/authorize-caller.ts'), 'utf8');
    // Cachear reintroduciría los roles obsoletos con una ventana no medible (CA-17). La prosa
    // del comentario que explica por qué no hay cache queda fuera: solo se mira el código.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    /new Map|cache|Cache|ttl|TTL|memo/.test(code).should.be.false();
  });
});

/**
 * Los callers de los tests con base. `SIN_FILA` no se crea nunca: es el caso de CA-7.
 */
const EXT = 'sub-conector-externo';
const ADM = 'sub-persona-admin';
const VACIO = 'sub-sin-roles';
const MUTABLE = 'sub-roles-mutables';
const SIN_FILA = 'sub-sin-fila';

/** El payload mínimo válido de `files.request-upload`. */
const uploadPayload = { fileName: 'informe.pdf', mimeType: 'application/pdf', fileSize: 1024 };

describe('la compuerta de autorización · plano de comandos', () => {
  describe('CA-1 · la exención con la tabla `users` VACÍA', () => {
    before(async () => {
      // Idempotente y de diagnóstico: con este archivo corriendo primero es un no-op. Si otro
      // archivo dejó filas, esto falla por las FK y el error dice exactamente qué pasó, en vez
      // de que TS-21 falle por una causa confusa.
      await User.destroy({ where: {} });
    });

    after(async () => {
      await Client.destroy({ where: {} });
    });

    it('TS-21 · con `users` vacía, el caller exento pasa SIN consultar la base', async () => {
      (await User.count()).should.equal(0);
      const findByPk = sinon.spy(User, 'findByPk');
      try {
        const reply = await dispatch<{ id: number }>('clients.new', { name: 'Acme' });

        reply.status.should.equal('success');
        (typeof reply.data!.id).should.equal('number');
        // Ni una consulta: es la exención, no la base. Es el test que impide reintroducir el
        // deadlock de arranque, y el estado que ejercita —`users` vacía— no lo cubría ninguno.
        findByPk.callCount.should.equal(0);
        (await Client.count()).should.equal(1);
      } finally {
        findByPk.restore();
      }
    });

    it('TS-22 · con `users` vacía, ninguno de los 20 devuelve caller_not_authorized', async () => {
      (await User.count()).should.equal(0);

      for (const pattern of registry.patterns()) {
        const method = pattern.replace(/\{[^}]+\}/g, '1');
        const reply = await dispatch(method, {});

        // La mayoría contesta `invalid_fields` (Joi), y ESO es la prueba de que la compuerta las
        // dejó pasar hasta la validación.
        (reply.errorCode === ErrorCode.CALLER_NOT_AUTHORIZED).should.be.false();
      }
    });
  });

  describe('los rechazos y los pasos, con filas en `users`', () => {
    let s3: S3Double;

    before(async () => {
      await User.bulkCreate([
        {
          id: EXT,
          name: 'Conector',
          username: 'conector-auth',
          email: 'conector-auth@test.local',
          roles: ['external-publisher'],
        },
        {
          id: ADM,
          name: 'Persona Admin',
          username: 'admin-auth',
          email: 'admin-auth@test.local',
          roles: ['admin'],
        },
        // `roles: []` es el default de la columna, y se declara igual para que el caso se lea.
        { id: VACIO, name: 'Sin Roles', username: 'vacio-auth', email: 'vacio-auth@test.local' },
        {
          id: MUTABLE,
          name: 'Roles Mutables',
          username: 'mutable-auth',
          email: 'mutable-auth@test.local',
        },
      ]);
    });

    after(async () => {
      await File.destroy({ where: {} });
      await User.destroy({ where: {} });
      await Client.destroy({ where: {} });
    });

    beforeEach(() => {
      s3 = installS3Double();
    });

    afterEach(async () => {
      sinon.restore();
      uninstallS3Double();
      await File.destroy({ where: {} });
    });

    it('TS-23 · CA-7: un caller SIN fila se rechaza y no escribe nada', async () => {
      const before = await Client.count();

      const reply = await dispatch('clients.new', { name: 'Fantasma' }, SIN_FILA);

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'caller_not_authorized',
        errorMessage: 'El caller no está autorizado a ejecutar este método',
      });
      (await Client.count()).should.equal(before);
    });

    it('TS-23b · un subject SIN caller (segundo segmento vacío) se rechaza', async () => {
      // `callerFromSubject` devuelve `''`, que no es el publicador confiable —`loadConfig()`
      // garantiza que no sea vacío— y no tiene fila. Cae en el rechazo, que es lo correcto.
      const reply = await new Dispatcher(registry).dispatch('dev..jiku-commands.v1.clients.new', {
        name: 'X',
      });

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    });

    it('TS-24 · CA-8: con fila y external-publisher, un comando fuera de los 9 se rechaza', async () => {
      const before = await Client.count();

      // AUNQUE EL CALLOUT HAYA ACEPTADO SU CONEXIÓN: las dos capas son independientes a propósito.
      const reply = await dispatch('clients.new', { name: 'X' }, EXT);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await Client.count()).should.equal(before);
    });

    it('TS-25 · CA-10: con fila y roles vacíos, todo se rechaza', async () => {
      const upload = await dispatch('files.request-upload', uploadPayload, VACIO);
      const client = await dispatch('clients.new', { name: 'X' }, VACIO);

      upload.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      client.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      (await File.count()).should.equal(0);
    });

    it('TS-26 · CA-4: con roles admin, un comando se rechaza', async () => {
      // Es el criterio que alguien va a querer "arreglar": core no tiene las reglas de negocio
      // que dependen del usuario final (la ventana de carga de horas, quién imputa a otro).
      // Payload válido según el contrato (`WorkedTimesNewPayload`), a propósito: lo que se prueba
      // es que la compuerta rechaza ANTES de Joi, no que Joi rechace.
      const reply = await dispatch(
        'worked-times.new',
        { date: '2026-08-24', minutes: 480, projectId: 1, personId: 1 },
        ADM
      );

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    });

    it('TS-27 · CA-11: con external-publisher, uno de los 9 PASA leyendo los roles de la base', async () => {
      const reply = await dispatch<{ id: number }>('files.request-upload', uploadPayload, EXT);

      reply.status.should.equal('success');
      const file = await File.findByPk(reply.data!.id);
      // La rama externa de `resolveActor`, sin cambios: el actor es el caller del subject.
      file!.uploadedBy.should.equal(EXT);
      s3.callsOf('PutObject').length.should.equal(1);
    });

    it('TS-28 · CA-6: la compuerta corre ANTES de registry.resolve()', async () => {
      // Un comando INEXISTENTE con un caller no autorizado: si la compuerta corriera después,
      // el registry contestaría `unknown_command` primero. Es la única aserción del orden.
      const reply = await dispatch('widgets.explode', {}, SIN_FILA);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
    });

    it('TS-29 · CA-6: un rechazo NO abre ninguna transacción', async () => {
      const transaction = sinon.spy(sequelize, 'transaction');

      await dispatch('clients.new', { name: 'X' }, SIN_FILA);

      // Un caller no autorizado no consume una conexión del pool de escritura.
      transaction.callCount.should.equal(0);
    });

    it('TS-30 · CA-9: los dos casos devuelven errorCode Y errorMessage idénticos', async () => {
      const sinFila = await dispatch('clients.new', { name: 'X' }, SIN_FILA);
      const rolSinPermiso = await dispatch('clients.new', { name: 'X' }, EXT);

      // Si el MENSAJE difiriera, el mensaje sería el oráculo de existencia que el código evita.
      sinFila.errorCode!.should.equal(rolSinPermiso.errorCode!);
      sinFila.errorMessage!.should.equal(rolSinPermiso.errorMessage!);
    });

    it('TS-31 · el rechazo loguea UN warn con el caller y el método, y SIN el payload', async () => {
      const warn = sinon.spy(logger, 'warn');

      await dispatch('clients.new', { name: 'SECRETO' }, SIN_FILA);

      warn.callCount.should.equal(1);
      const message = String(warn.firstCall.args[0]);
      message.should.startWith('[auth]');
      message.should.containEql(SIN_FILA);
      message.should.containEql('clients.new');
      message.should.not.containEql('SECRETO');
    });

    it('TS-32 · el camino AUTORIZADO no loguea nada', async () => {
      const warn = sinon.spy(logger, 'warn');
      const info = sinon.spy(logger, 'info');

      // `attachments.{id}.delete` está entre los 9 y no resuelve actor, así que un `warn` acá
      // solo puede venir de la compuerta. Es lo que mantiene verde TS-15 de attachments.test.ts.
      await dispatch('attachments.999999.delete', {}, EXT);

      warn.called.should.be.false();
      // Sin `LOG_COMMANDS` el camino autorizado tampoco emite la traza de diagnóstico.
      info.called.should.be.false();
    });

    it('TS-33 · CA-16: el camino EXENTO no loguea nada y no toca la base', async () => {
      const warn = sinon.spy(logger, 'warn');
      const findByPk = sinon.spy(User, 'findByPk');

      await dispatch('clients.new', { name: 'Acme Exenta' });

      // El 100% del tráfico de hoy pasa por acá: ni una consulta más ni un milisegundo más.
      warn.called.should.be.false();
      findByPk.callCount.should.equal(0);
    });

    it('TS-34 · D-1: si findByPk rechaza, se DENIEGA con internal_error', async () => {
      const error = sinon.spy(logger, 'error');
      sinon.stub(User, 'findByPk').rejects(new Error('pool agotado'));
      const before = await Client.count();

      // Resuelve, no rechaza: el stack no cruza el bus.
      const reply = await dispatch('clients.new', { name: 'X' }, EXT);

      reply.should.deepEqual({
        status: 'failure',
        errorCode: 'internal_error',
        errorMessage: 'Internal error',
      });
      error.callCount.should.equal(1);
      String(error.firstCall.args[0]).should.startWith('[auth]');
      // Una compuerta que no puede decidir DENIEGA: dejar pasar convertiría una base caída en un
      // bypass de autorización.
      (await Client.count()).should.equal(before);
    });

    it('TS-35 · D-11: un roles que NO es un array DENIEGA, no explota', async () => {
      // La columna es JSONB sin CHECK y la tabla es escribible por SQL: el caso es alcanzable.
      await sequelize.query(`UPDATE users SET roles = '{"a":1}'::jsonb WHERE id = :id`, {
        replacements: { id: MUTABLE },
      });

      const reply = await dispatch('clients.new', { name: 'X' }, MUTABLE);

      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
      reply.errorCode!.should.not.equal(ErrorCode.INTERNAL_ERROR);

      await User.update({ roles: [] }, { where: { id: MUTABLE } });
    });

    it('TS-36 · D-8: LOG_COMMANDS no imprime el payload de un caller rechazado', async () => {
      const previous = process.env.LOG_COMMANDS;
      process.env.LOG_COMMANDS = 'true';
      const info = sinon.spy(logger, 'info');
      try {
        await dispatch('clients.new', { name: 'SECRETO' }, SIN_FILA);

        // La traza sigue DESPUÉS de la compuerta: de un caller rechazado se registra quién y qué
        // método, nunca qué mandó.
        const lines = info.getCalls().map((call) => String(call.args[0]));
        lines.some((line) => line.includes('SECRETO')).should.be.false();
      } finally {
        if (previous === undefined) {
          delete process.env.LOG_COMMANDS;
        } else {
          process.env.LOG_COMMANDS = previous;
        }
      }
    });

    it('TS-37 · CA-17: dos despachos del mismo caller hacen DOS findByPk', async () => {
      const findByPk = sinon.spy(User, 'findByPk');

      await dispatch('clients.new', { name: 'X' }, EXT);
      await dispatch('clients.new', { name: 'X' }, EXT);

      // Sin cache: cachear reintroduciría los roles obsoletos con una ventana no medible.
      findByPk.callCount.should.equal(2);
    });

    it('TS-38 · un cambio de roles en la base aplica en el despacho SIGUIENTE', async () => {
      const antes = await dispatch('files.request-upload', uploadPayload, MUTABLE);
      antes.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);

      await User.update({ roles: ['external-publisher'] }, { where: { id: MUTABLE } });

      const despues = await dispatch<{ id: number }>(
        'files.request-upload',
        uploadPayload,
        MUTABLE
      );
      // Es la propiedad que hace la revocación eventualmente consistente por el bus.
      despues.status.should.equal('success');

      await User.update({ roles: [] }, { where: { id: MUTABLE } });
    });
  });
});

describe('la compuerta de autorización · plano de consultas', () => {
  const QUERIES = queryRegistry.patterns();
  /**
   * Las consultas que YA TIENEN CONTRATO (S-022). Las otras cuatro siguen en `pendingContract`
   * hasta S-024 (`projects`) y S-025 (`comments`), y cuando no quede ninguna este array deja de
   * hacer falta.
   */
  const WITH_CONTRACT = ['tasks.list', 'tasks.get'];
  const USER_ROLE = 'sub-persona-user';
  const EXTERNAL_USER_ROLE = 'sub-persona-external-user';

  before(async () => {
    await User.bulkCreate([
      {
        id: EXT,
        name: 'Conector',
        username: 'conector-q',
        email: 'conector-q@test.local',
        roles: ['external-publisher'],
      },
      {
        id: ADM,
        name: 'Persona Admin',
        username: 'admin-q2',
        email: 'admin-q2@test.local',
        roles: ['admin'],
      },
      {
        id: USER_ROLE,
        name: 'Persona User',
        username: 'user-q',
        email: 'user-q@test.local',
        roles: ['user'],
      },
      {
        id: EXTERNAL_USER_ROLE,
        name: 'Persona Externa',
        username: 'external-user-q',
        email: 'external-user-q@test.local',
        roles: ['external-user'],
      },
    ]);
  });

  after(async () => {
    await User.destroy({ where: {} });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('TS-39 · el caller exento pasa las 6 consultas SIN tocar la base', async () => {
    const findByPk = sinon.spy(User, 'findByPk');

    for (const query of QUERIES) {
      const reply = await dispatchQuery(query, {});

      if (WITH_CONTRACT.includes(query)) {
        // DESDE S-022 estas dos TIENEN contrato: la prueba de que la compuerta las dejó pasar ya
        // no es el stub sino que la respuesta viene DEL OTRO LADO de ella. `tasks.list` con `{}`
        // devuelve la colección; `tasks.get` con `{}` devuelve `invalid_fields` porque le falta
        // el `id` — las dos son respuestas del contrato, y ninguna es `caller_not_authorized`,
        // que es lo único que este test afirma. La otra mitad sigue siendo `findByPk === 0`.
        reply.errorCode?.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED, query);
        reply.errorCode?.should.not.equal(ErrorCode.UNKNOWN_COMMAND, query);
      } else {
        // Las otras cuatro llegan al stub sin contrato, que es la misma prueba de siempre.
        reply.status.should.equal('failure', query);
        reply.errorCode!.should.equal(ErrorCode.UNKNOWN_COMMAND, query);
        reply.errorMessage!.should.equal(
          `La consulta ${query} todavía no tiene contrato definido`,
          query
        );
      }
    }
    findByPk.callCount.should.equal(0);
  });

  it('TS-40 · CA-12: external-publisher NO consulta, en ninguna de las 6', async () => {
    for (const query of QUERIES) {
      const reply = await dispatchQuery(query, {}, EXT);

      // El callout ya se lo impide en el transporte; la compuerta lo dice OTRA VEZ, y eso es
      // exactamente lo que "defensa en profundidad" significa.
      reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    }
  });

  it('TS-41 · los roles de producto SÍ consultan', async () => {
    for (const caller of [ADM, USER_ROLE, EXTERNAL_USER_ROLE]) {
      const reply = await dispatchQuery('tasks.get', {}, caller);

      // DESDE S-022 `tasks.get` tiene contrato, así que un payload sin `id` ya no muere en el
      // stub sino en la validación del contrato. Lo que este test afirma no cambia: que la
      // compuerta los DEJÓ PASAR, y `invalid_fields` solo se emite del otro lado de ella.
      reply.errorCode!.should.equal(ErrorCode.INVALID_FIELDS);
      reply.errorCode!.should.not.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    }
  });

  it('TS-42 · CA-7 en consultas: sin fila → rechazo, con el MISMO mensaje', async () => {
    const reply = await dispatchQuery('comments.list', {}, SIN_FILA);

    reply.should.deepEqual({
      status: 'failure',
      errorCode: 'caller_not_authorized',
      errorMessage: 'El caller no está autorizado a ejecutar este método',
    });
  });

  it('TS-43 · CA-6: la compuerta corre ANTES de registry.resolve()', async () => {
    const reply = await dispatchQuery('widgets.list', {}, SIN_FILA);

    reply.errorCode!.should.equal(ErrorCode.CALLER_NOT_AUTHORIZED);
    reply.errorCode!.should.not.equal(ErrorCode.UNKNOWN_COMMAND);
  });

  it('TS-44 · CA-6: la compuerta no abre transacción en NINGUNA de las dos conexiones', async () => {
    const writeTx = sinon.spy(sequelize, 'transaction');
    const readTx = sinon.spy(readDb, 'transaction');

    await dispatchQuery('tasks.list', {}, SIN_FILA);
    await dispatchQuery('tasks.list', {}, ADM);

    // Espiar solo una dejaría pasar el error más probable: abrir la transacción en la conexión
    // equivocada. Es la misma razón que el test existente ya dejó escrita.
    writeTx.callCount.should.equal(0);
    readTx.callCount.should.equal(0);
  });

  it('TS-45 · D-5: la compuerta NO usa ctx.db — lee por la conexión del dueño', async () => {
    // Si la compuerta leyera por `ctx.db`, este objeto falso haría estallar la lectura.
    const fakeDb = { marker: 'fake' } as unknown as Sequelize;
    let executed = false;
    const dispatcher = new QueryDispatcher(
      new QueryRegistry().register({
        pattern: 'tasks.list',
        // `validate` permisivo: la interfaz lo exige desde S-022 y este doble no valida nada.
        validate: (payload: unknown) => ({ value: payload }),
        execute: () => {
          executed = true;
          return Promise.resolve(success());
        },
      }),
      fakeDb
    );

    const reply = await dispatcher.dispatch(querySubject('tasks.list', ADM), {});

    executed.should.be.true();
    reply.status.should.equal('success');
  });
});
