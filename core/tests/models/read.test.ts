import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import {
  Client,
  Objective,
  PersonRequirement,
  Project,
  Requirement,
  RequirementActivity,
  RequirementSubscriptor,
  User,
} from '@jiku/models';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import { dispatch } from '../helpers/dispatch';

const CREATOR = 'zitadel-sub-read-test';

/** Ruta del fuente de `read.ts`, para las aserciones que son sobre el código y no sobre datos. */
const READ_SOURCE = join(__dirname, '..', '..', 'src', 'models', 'read.ts');

/**
 * Reimporta `src/models/read` con otras variables: se leen AL IMPORTARSE, así que no hay forma de
 * cambiarlas después. Devuelve una conexión NUEVA — hay que cerrarla en el test, o el pool queda
 * abierto hasta el final de la corrida.
 *
 * Local a este archivo a propósito, igual que el `reloadService()` de `tests/bus/service.test.ts`:
 * es un caso, no una necesidad general.
 */
function reloadRead(overrides: Record<string, string | undefined>): Sequelize {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    saved[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const modulePath = require.resolve('../../src/models/read');
  delete require.cache[modulePath];
  const loaded = require('../../src/models/read') as typeof import('../../src/models/read');

  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  delete require.cache[modulePath];
  return loaded.readDb;
}

describe('models/read — la conexión de solo lectura', () => {
  describe('no registra los modelos (CA-7)', () => {
    it('TS-1 · readDb no tiene ningún modelo registrado', () => {
      Object.keys(readDb.models).length.should.equal(0);
    });

    it('TS-2 · las clases de @jiku/models siguen atadas a la conexión de ESCRITURA', () => {
      // LA aserción del riesgo central: si alguien agrega los modelos a `read.ts`, las clases se
      // reasignan y `Objective.findAll()` sale por la conexión equivocada. En el sentido malo
      // —consultas por el usuario dueño— ADR-001 dejaría de valer SIN UN SOLO SÍNTOMA.
      // Los tres modelos y no uno: un registro parcial pasaría desapercibido con uno solo.
      for (const model of [Objective, Requirement, Project]) {
        ((model.sequelize as unknown) === (sequelize as unknown)).should.be.true();
        ((model.sequelize as unknown) === (readDb as unknown)).should.be.false();
      }
    });

    it('TS-3 · el fuente de read.ts no menciona los modelos', () => {
      // Complementa TS-1: atrapa el import muerto que un refactor deja a medio camino, que la
      // aserción en runtime no ve. El comentario de cabecera del módulo explica el riesgo de
      // reasignación de ADR-005 SIN nombrar los identificadores, justamente para que este
      // candado pueda ser sobre el texto crudo del archivo.
      const source = readFileSync(READ_SOURCE, 'utf8');
      source.should.not.containEql('allModels');
      source.should.not.containEql('models:');
      source.should.not.containEql('@jiku/models');
    });
  });

  describe('el rol lee y NO escribe, y la garantía es de Postgres (CA-5)', () => {
    it('TS-4 · la conexión de lectura LEE', async () => {
      const rows = await readDb.query<{ n: number }>(
        'SELECT count(*)::int AS n FROM clients',
        { type: QueryTypes.SELECT }
      );

      // Precondición de TS-5: sin esto, un fallo de permisos sería indistinguible de un fallo
      // de conexión.
      rows.length.should.equal(1);
      rows[0].n.should.be.a.Number();
    });

    it('TS-5 · un INSERT por la conexión de lectura lo RECHAZA POSTGRES', async () => {
      let thrown: any = null;
      try {
        await readDb.query(
          "INSERT INTO clients (name, description, created_at, updated_at) " +
            "VALUES ('Hackeado', 'x', now(), now())"
        );
      } catch (error) {
        thrown = error;
      }

      (thrown === null).should.be.false();
      // El código y el mensaje vienen de POSTGRES, no de una validación de TypeScript.
      String(thrown.original.code).should.equal('42501');
      String(thrown.original.message).should.containEql('permission denied for table clients');
    });

    it('TS-6 · UPDATE y DELETE también los rechaza', async () => {
      // Cubrir los tres verbos importa: un GRANT parcial mal hecho pasaría TS-5 y fallaría acá.
      for (const sql of ["UPDATE clients SET name = 'x'", 'DELETE FROM clients']) {
        let thrown: any = null;
        try {
          await readDb.query(sql);
        } catch (error) {
          thrown = error;
        }

        (thrown === null).should.be.false(sql);
        String(thrown.original.code).should.equal('42501', sql);
      }
    });
  });

  describe('un alta sigue funcionando después de que la lectura usó su conexión (CA-6)', () => {
    let projectId: number;

    before(async () => {
      await User.create({
        id: CREATOR,
        name: 'Creador Read',
        username: 'creador-read-test',
        email: 'read-test@mail.com',
      });
      const project = await Project.create({
        name: 'Proyecto Read',
        code: 'READ',
        status: 'activo',
        type: 'comercial',
        description: 'x',
        initDate: new Date(),
        createdBy: CREATOR,
      });
      projectId = project.id;
    });

    after(async () => {
      await RequirementActivity.destroy({ where: {} });
      await RequirementSubscriptor.destroy({ where: {} });
      await PersonRequirement.destroy({ where: {} });
      await Requirement.destroy({ where: {} });
      await Project.destroy({ where: {} });
      await User.destroy({ where: {} });
    });

    it('TS-7 · después de leer por readDb, un requirements.new escribe por el usuario DUEÑO', async () => {
      // (1) la conexión de lectura se USA: abre su socket y su pool.
      await readDb.query('SELECT 1', { type: QueryTypes.SELECT });

      // (2) y recién después, el alta. Es la única verificación de que los modelos no se
      // reasignaron: no protege contra un bug de hoy, protege contra el refactor de mañana
      // que "unifica las dos conexiones".
      const reply = await dispatch<{ id: number }>('requirements.new', {
        creator: CREATOR,
        title: 'Un requisito',
        description: 'Detalle',
        projectId,
      });

      reply.status.should.equal('success');
      const row = await Requirement.findByPk(reply.data!.id);
      (row === null).should.be.false();
      String(row!.title).should.equal('Un requisito');
      String(row!.createdBy).should.equal(CREATOR);
    });
  });

  describe('statement_timeout: la base corta antes que el bus (CA-8)', () => {
    it('TS-8 · una sentencia lenta la ABORTA Postgres, muy por debajo del timeout del caller', async () => {
      const slowDb = reloadRead({ POSTGRESQL_STATEMENT_TIMEOUT_MS: '300' });
      const started = Date.now();
      let thrown: any = null;

      try {
        await slowDb.query('SELECT pg_sleep(2)');
      } catch (error) {
        thrown = error;
      } finally {
        await slowDb.close();
      }

      (thrown === null).should.be.false();
      String(thrown.original.code).should.equal('57014');
      String(thrown.original.message).should.containEql(
        'canceling statement due to statement timeout'
      );
      // Cortó la base, no el `pg_sleep`. Y muy por debajo de los 10000 ms de
      // NATS_QUERY_TIMEOUT_MS que espera el caller.
      (Date.now() - started).should.be.below(2000);
    });

    it('TS-9 · el statement_timeout sale de la variable, con default 8000', () => {
      const byDefault = reloadRead({ POSTGRESQL_STATEMENT_TIMEOUT_MS: undefined });
      (byDefault.options.dialectOptions as any).statement_timeout.should.equal(8000);

      const explicit = reloadRead({ POSTGRESQL_STATEMENT_TIMEOUT_MS: '1234' });
      (explicit.options.dialectOptions as any).statement_timeout.should.equal(1234);
    });
  });

  describe('pool propio, que no le come conexiones al de escritura (CA-9)', () => {
    it('TS-10 · el pool sale de POSTGRESQL_READ_POOL_MAX (default 10) y el de escritura no se toca', () => {
      // El techo EFECTIVO vive en el pool del connection manager, no en `options.pool`:
      // Sequelize no mezcla sus defaults dentro de las opciones declaradas (el `options.pool`
      // de la conexión de escritura es `{}`), así que assertar ahí no diría nada del límite real.
      const maxSize = (db: Sequelize): number => (db as any).connectionManager.pool.maxSize;

      const byDefault = reloadRead({ POSTGRESQL_READ_POOL_MAX: undefined });
      maxSize(byDefault).should.equal(10);

      const explicit = reloadRead({ POSTGRESQL_READ_POOL_MAX: '3' });
      maxSize(explicit).should.equal(3);

      // El default IMPLÍCITO de Sequelize, igual que antes de esta story: `models/index.ts` no
      // declara pool y la story lo declara intacto. La asimetría (10 vs 5) está documentada en
      // `core/README.md`.
      sequelize.options.pool!.should.deepEqual({});
      maxSize(sequelize).should.equal(5);
    });

    it('TS-11 · saturar el pool de lectura NO frena una escritura', async () => {
      const smallDb = reloadRead({ POSTGRESQL_READ_POOL_MAX: '1' });
      // Sin `await`: con un pool de 1 y un `pg_sleep(1)`, el pool de lectura queda
      // garantizadamente saturado durante el dispatch.
      // Se captura el resultado en vez de silenciarlo: el escenario pide que la lectura
      // RESUELVA después, y un rechazo silenciado dejaría pasar un fallo del pool.
      const slowRead = smallDb.query('SELECT pg_sleep(1)').then(
        () => 'resolved' as const,
        (error: Error) => `rejected: ${error.message}` as const
      );

      try {
        const reply = await dispatch<{ id: number }>('clients.new', {
          name: 'Acme',
          description: 'Test',
        });

        reply.status.should.equal('success');
        const row = await Client.findByPk(reply.data!.id);
        (row === null).should.be.false();
        String(row!.name).should.equal('Acme');
        await Client.destroy({ where: { id: reply.data!.id } });
      } finally {
        // La lectura lenta tiene que haber RESUELTO, no rechazado: es la otra mitad de CA-9
        // —el pool saturado se libera solo— y sin esta aserción un fallo del pool pasaría mudo.
        (await slowRead).should.equal('resolved');
        await smallDb.close();
      }
    });
  });

  describe('el entorno de tests y la invariante del despliegue (CA-15, CA-8)', () => {
    it('TS-12 · en deploy/.env.dist el statement_timeout es ESTRICTAMENTE MENOR que el del bus', () => {
      const envDist = readFileSync(
        join(__dirname, '..', '..', '..', 'deploy', '.env.dist'),
        'utf8'
      );
      const read = (key: string): number => {
        const match = envDist.match(new RegExp(`^${key}=(.*)$`, 'm'));
        (match === null).should.be.false(key);
        return Number(match![1].trim());
      };

      // Es la INVARIANTE, no el valor de ninguna de las dos: un cambio futuro que la rompa
      // falla acá.
      read('POSTGRESQL_STATEMENT_TIMEOUT_MS').should.be.below(read('NATS_QUERY_TIMEOUT_MS'));
    });

    it('TS-32 · las POSTGRESQL_READ_* estaban puestas ANTES del primer import de src/', () => {
      for (const key of [
        'POSTGRESQL_READ_USER',
        'POSTGRESQL_READ_PASSWORD',
        'POSTGRESQL_READ_POOL_MAX',
        'POSTGRESQL_STATEMENT_TIMEOUT_MS',
      ]) {
        String(process.env[key] || '').should.not.be.empty();
      }

      // Si `setup-env.ts` las pusiera tarde, `readDb` habría quedado con valores vacíos.
      String(readDb.config.username).should.equal(process.env.POSTGRESQL_READ_USER);
      String(readDb.config.database).should.equal(process.env.POSTGRESQL_DB);
    });

    it('TS-33 · el rol de solo lectura existe y SOLO puede leer', async () => {
      const readUser = process.env.POSTGRESQL_READ_USER as string;

      // El rol NO puede ser el usuario dueño: si lo fuera, CA-5 pasaría sin probar nada.
      readUser.should.not.equal(process.env.POSTGRESQL_USER);

      const roles = await sequelize.query<{
        rolname: string;
        rolsuper: boolean;
        rolcanlogin: boolean;
      }>('SELECT rolname, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = :readUser', {
        type: QueryTypes.SELECT,
        replacements: { readUser },
      });
      roles.length.should.equal(1);
      roles[0].rolsuper.should.be.false();
      roles[0].rolcanlogin.should.be.true();

      const privileges = await sequelize.query<{
        sel: boolean;
        ins: boolean;
        upd: boolean;
        del: boolean;
      }>(
        `SELECT has_table_privilege(:readUser, 'clients', 'SELECT') AS sel,
                has_table_privilege(:readUser, 'clients', 'INSERT') AS ins,
                has_table_privilege(:readUser, 'clients', 'UPDATE') AS upd,
                has_table_privilege(:readUser, 'clients', 'DELETE') AS del`,
        { type: QueryTypes.SELECT, replacements: { readUser } }
      );
      privileges[0].sel.should.be.true();
      privileges[0].ins.should.be.false();
      privileges[0].upd.should.be.false();
      privileges[0].del.should.be.false();
    });
  });
});
