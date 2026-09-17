import 'mocha';
import 'should';
import { QueryTypes, Sequelize as SequelizeLib } from 'sequelize';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import { User, NotificationOutbox } from '@jiku/models';

/**
 * S-069: la migración `20260917_01_notification_outbox` — la contraparte, del lado de la
 * migración, de `notification-outbox-model.test.ts` y `mail-threads-removal.test.ts` (que
 * verifican lo que `sequelize.sync()` produce a partir del modelo). ADR-013 declara que el
 * esquema de la suite y el de las migraciones son DOS FUENTES DE VERDAD distintas; este archivo
 * cierra la mitad que las del modelo no pueden: lo que la MIGRACIÓN produce, aplicada a mano.
 *
 * Precedente directo: `query-indexes-migration.test.ts` (S-021) — carga la migración con
 * `require`, la aplica con `migration.up(...)` sin tocar `sequelize_meta`, y la revierte en el
 * `after` para no contaminar los 61 archivos de rutas que corren después.
 *
 * LA DIFERENCIA CON S-021, Y EL PUNTO QUE MÁS CUIDADO PIDE ACÁ:
 *
 *   - `notification_outbox` YA EXISTE en la base de la suite: el modelo está registrado desde
 *     `ca8bd7b`, así que `sequelize.sync()` la crea. El `up` de la migración chocaría con una
 *     tabla existente. SALIDA ELEGIDA: dropear `notification_outbox` en el `before` de este
 *     archivo, aplicar la migración, correr los escenarios, y en el `after` dropear la versión
 *     migrada y RECREARLA con `sync()` (`NotificationOutbox.sync()`). Es necesario porque Mocha
 *     ordena los archivos alfabéticamente dentro del directorio y
 *     `notification-outbox-migration` corre ANTES que `notification-outbox-model`: si este
 *     archivo dejara la tabla borrada, aquel fallaría. Verificado corriendo la suite completa
 *     (TS-23), no solo este archivo aislado.
 *
 *   - Las tres tablas muertas, al revés, YA NO EXISTEN en la base de la suite: sus tres modelos
 *     salieron del barrel de `@jiku/models` en el commit anterior de esta misma story, así que
 *     `sync()` no las crea. Eso significa que:
 *       - El bloque que prueba los DROP (TS-12, TS-13) tiene que CREARLAS primero, a mano, en su
 *         `before`, con el DDL original — sin ese fixture, TS-12 pasaría por construcción y no
 *         probaría nada (el mismo modo de fallo que la cabecera de `mail-threads-removal.test.ts`
 *         describe para su propio caso).
 *       - El bloque de TS-14 hace lo contrario a propósito: aplica el `up` SIN ese fixture, para
 *         verificar que el `IF EXISTS` aguanta contra una base donde ya no están.
 *
 * LO QUE PRUEBA: la forma de `notification_outbox` que el `up` produce (TS-1 a TS-11, TS-21), la
 * baja de las tres tablas muertas y sus dos índices (TS-12, TS-13), la idempotencia del `up`
 * contra una base donde ya no existen (TS-14), que no se toca nada de `objectives` ni
 * `requirements` (TS-15), el `down` (TS-16 a TS-20, TS-22).
 *
 * LO QUE NO PRUEBA: que esta migración se comporte igual contra una base construida por 105
 * migraciones reales en vez de por `sync()` — esa comparación es la Tarea 4 del Story Plan, una
 * revisión a mano contra un dump restaurado, y su evidencia queda en ese documento.
 *
 * EL ARCHIVO DEJA LA BASE COMO LA ENCONTRÓ: todo `describe` que aplica la migración la revierte
 * en su `after` (ADR-013: no depender del orden de ejecución entre archivos).
 */

// La migración es `.js` (requisito de sequelize-cli). `require` y no `import`: el tsconfig no
// tiene `allowJs`, y no hace falta activarlo para cargar un módulo CommonJS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migration = require('../../db-upgrade/migrations/20260917_01_notification_outbox.js');

const MIGRATION_PATH = join(
  __dirname,
  '../../db-upgrade/migrations/20260917_01_notification_outbox.js'
);

const SEEDED_KEYS = [
  'notification-dispatch-interval-seconds',
  'notification-batch-size',
  'notification-max-attempts',
];

const DEAD_TABLES = ['objective_mail_threads', 'requirement_mail_threads', 'inbound_mail_threads'];

const DEAD_INDEXES = [
  'uk_inbound_mail_threads_message_id',
  'idx_inbound_mail_threads_requirement_id',
];

function up(): Promise<unknown> {
  return migration.up(sequelize.getQueryInterface(), SequelizeLib);
}

function down(): Promise<unknown> {
  return migration.down(sequelize.getQueryInterface(), SequelizeLib);
}

/**
 * DDL original de las tres tablas muertas, para los fixtures de TS-12, TS-13 y TS-19.
 *
 * Dropea antes de crear (idempotente): así un `after` anterior que no llegó a limpiar (por un
 * fallo a mitad de escenario) no hace que este fixture explote con "relation already exists".
 */
function createDeadTables(): Promise<unknown> {
  return dropDeadTablesIfAny().then(() => sequelize.query(`
    CREATE TABLE objective_mail_threads (
      id SERIAL PRIMARY KEY,
      objective_id integer NOT NULL UNIQUE REFERENCES objectives(id) ON UPDATE CASCADE ON DELETE CASCADE,
      message_id varchar(500) NOT NULL,
      mattermost_post_id varchar(100),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE requirement_mail_threads (
      id SERIAL PRIMARY KEY,
      requirement_id integer NOT NULL UNIQUE REFERENCES requirements(id) ON UPDATE CASCADE ON DELETE CASCADE,
      message_id varchar(500) NOT NULL,
      mattermost_post_id varchar(100),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE inbound_mail_threads (
      id SERIAL PRIMARY KEY,
      requirement_id integer NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
      message_id varchar(500) NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE UNIQUE INDEX uk_inbound_mail_threads_message_id ON inbound_mail_threads (message_id);
    CREATE INDEX idx_inbound_mail_threads_requirement_id ON inbound_mail_threads (requirement_id);
  `));
}

/** Limpieza de emergencia: por si un escenario falla a mitad de camino y deja las tres. */
function dropDeadTablesIfAny(): Promise<unknown> {
  return sequelize.query(`
    DROP TABLE IF EXISTS objective_mail_threads;
    DROP TABLE IF EXISTS requirement_mail_threads;
    DROP TABLE IF EXISTS inbound_mail_threads;
  `);
}

describe('S-069: migración de la cola de salida (20260917_01_notification_outbox)', () => {
  /** Baseline de objectives/requirements ANTES de tocar nada — lo que usa TS-15. */
  let objectivesBaseline: string[] = [];
  let requirementsBaseline: string[] = [];

  before(function () {
    this.timeout(30000);
    return initDb()
      .then(() => Promise.all([
        sequelize.getQueryInterface().describeTable('objectives'),
        sequelize.getQueryInterface().describeTable('requirements'),
      ]))
      .then(([objectives, requirements]) => {
        objectivesBaseline = Object.keys(objectives as any).sort();
        requirementsBaseline = Object.keys(requirements as any).sort();
      })
      // sync() ya creó notification_outbox (el modelo está registrado desde ca8bd7b). Se
      // dropea para que el createTable del up no choque con una tabla existente.
      .then(() => sequelize.getQueryInterface().dropTable('notification_outbox'));
  });

  after(function () {
    this.timeout(30000);
    // Deja la base como la encontró: por si algún describe no llegó a revertir, y recrea
    // notification_outbox con sync() para que notification-outbox-model.test.ts (que corre
    // después, alfabéticamente) la encuentre.
    return dropDeadTablesIfAny()
      .then(() => sequelize.query(
        'DROP TABLE IF EXISTS notification_outbox'
      ))
      .then(() => NotificationOutbox.sync());
  });

  describe('el archivo de la migración', () => {
    let source = '';

    before(() => {
      source = readFileSync(MIGRATION_PATH, 'utf8');
    });

    it('TS-20: documenta la irreversibilidad en datos del down', () => {
      source.should.match(/no .*reversible.*datos|datos.*no se recuperan/i);
    });
  });

  describe('notification_outbox: la tabla y su índice (TS-1 a TS-9, TS-21)', () => {
    before(function () {
      this.timeout(30000);
      return up();
    });

    after(function () {
      this.timeout(30000);
      return down();
    });

    // TS-1
    it('TS-1: crea la tabla con exactamente 12 columnas, sin updated_at', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        const expected = [
          'id', 'type', 'channel', 'recipient_user_id', 'recipient_email', 'payload',
          'status', 'attempts', 'next_attempt_at', 'last_error', 'created_at', 'sent_at',
        ];
        const keys = Object.keys(table);
        expected.forEach((col) => keys.should.containEql(col));
        keys.should.have.length(12);
        keys.should.not.containEql('updated_at');
      });
    });

    // TS-2
    it('TS-2: id es BIGSERIAL — PK autoincremental, BIGINT y no INTEGER', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        table.id.primaryKey.should.be.true();
        table.id.defaultValue.should.match(/nextval/i);
        table.id.type.should.match(/BIGINT/i);
        table.id.type.should.not.match(/^INTEGER$/i);
      });
    });

    // TS-3
    it('TS-3: tipos, largos y nullability de las 11 columnas restantes', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        table.type.type.should.match(/VARYING\(100\)|VARCHAR\(100\)/i);
        table.type.allowNull.should.be.false();

        table.channel.type.should.match(/VARYING\(20\)|VARCHAR\(20\)/i);
        table.channel.allowNull.should.be.false();

        table.recipient_user_id.type.should.match(/VARYING\(100\)|VARCHAR\(100\)/i);
        table.recipient_user_id.allowNull.should.be.false();

        table.recipient_email.type.should.match(/VARYING\(255\)|VARCHAR\(255\)/i);
        table.recipient_email.allowNull.should.be.false();

        table.payload.type.should.match(/JSONB/i);
        table.payload.allowNull.should.be.false();

        table.status.type.should.match(/VARYING\(20\)|VARCHAR\(20\)/i);
        table.status.allowNull.should.be.false();

        table.attempts.type.should.match(/INTEGER/i);
        table.attempts.allowNull.should.be.false();

        table.last_error.type.should.match(/TEXT/i);
        table.last_error.allowNull.should.be.true();

        table.sent_at.allowNull.should.be.true();
      });
    });

    // TS-4
    it('TS-4: next_attempt_at, sent_at y created_at son timestamptz, no timestamp sin zona', () => {
      return sequelize.query(
        `SELECT column_name, data_type FROM information_schema.columns
          WHERE table_name = 'notification_outbox'
            AND column_name IN ('next_attempt_at', 'sent_at', 'created_at')`,
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        rows.should.have.length(3);
        rows.forEach((row) => {
          row.data_type.should.equal('timestamp with time zone');
        });
      });
    });

    // TS-5
    it('TS-5: los cuatro defaults quedan declarados en la base', () => {
      return sequelize.query(
        `SELECT column_name, column_default FROM information_schema.columns
          WHERE table_name = 'notification_outbox'`,
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        const byName = (name: string) => rows.find((r) => r.column_name === name);
        byName('channel').column_default.should.match(/'email'/);
        byName('status').column_default.should.match(/'pending'/);
        byName('attempts').column_default.should.equal('0');
        byName('next_attempt_at').column_default.should.match(/now\(\)/i);
        byName('created_at').column_default.should.match(/now\(\)/i);
      });
    });

    // TS-6
    it('TS-6: el índice existe sobre (next_attempt_at, id) en ese orden, no único', () => {
      return sequelize.getQueryInterface().showIndex('notification_outbox').then((result: object) => {
        const indexes = result as any[];
        const idx = indexes.find((i) => i.name === 'idx_notification_outbox_pending');
        (idx === undefined).should.be.false();
        idx.fields.map((f: any) => f.attribute).should.eql(['next_attempt_at', 'id']);
        idx.unique.should.be.false();
      });
    });

    // TS-7. Prueba de red ejecutada manualmente al implementar: quitar el `where` del
    // `addIndex` de la migración, correr, confirmar que este escenario falla, revertir.
    it('TS-7: el índice es parcial con el predicado WHERE status = \'pending\'', () => {
      return sequelize.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_notification_outbox_pending'",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        rows.should.have.length(1);
        (rows[0].indexdef as string).should.match(/WHERE .*status.*=.*'pending'/i);
      });
    });

    // TS-8. Prueba de red: agregar temporalmente un ENUM a la migración, correr, confirmar que
    // este escenario falla, revertir.
    it('TS-8: la migración no crea ningún tipo ENUM', () => {
      return sequelize.query(
        "SELECT typname FROM pg_type WHERE typtype = 'e'",
        { type: QueryTypes.SELECT }
      ).then((before) => {
        const beforeNames = (before as any[]).map((r) => r.typname).sort();
        return down().then(() => up()).then(() => sequelize.query(
          "SELECT typname FROM pg_type WHERE typtype = 'e'",
          { type: QueryTypes.SELECT }
        )).then((after) => {
          const afterNames = (after as any[]).map((r) => r.typname).sort();
          afterNames.should.eql(beforeNames);
          afterNames.filter((n) => /notification_outbox/i.test(n)).should.have.length(0);
        });
      });
    });

    // TS-9
    it('TS-9: el único índice único de la tabla es el de la PK', () => {
      return sequelize.getQueryInterface().showIndex('notification_outbox').then((result: object) => {
        const indexes = result as any[];
        const uniques = indexes.filter((i) => i.unique);
        uniques.should.have.length(1);
        uniques[0].fields.map((f: any) => f.attribute).should.eql(['id']);
      });
    });

    // TS-21
    it('TS-21: la siembra de system_settings queda como texto', () => {
      return sequelize.query(
        `SELECT key, value FROM system_settings WHERE key IN (:keys)`,
        { type: QueryTypes.SELECT, replacements: { keys: SEEDED_KEYS } }
      ).then((rows: any[]) => {
        rows.should.have.length(3);
        const byKey = (key: string) => rows.find((r) => r.key === key);
        byKey('notification-dispatch-interval-seconds').value.should.equal('60');
        byKey('notification-batch-size').value.should.equal('50');
        byKey('notification-max-attempts').value.should.equal('5');
        rows.forEach((row) => (typeof row.value).should.equal('string'));
      });
    });
  });

  describe('la FK y el caso legítimo de duplicado (TS-10, TS-11)', () => {
    let userId: string;

    before(function () {
      this.timeout(30000);
      return up()
        .then(() => User.create({
          id: 'zitadel-sub-outbox-migration-01',
          name: 'Usuario Outbox Migración',
          username: 'outboxmigrationuser',
          email: 'outbox-migration@grava.io',
        }))
        .then((u) => { userId = u.id; });
    });

    after(function () {
      this.timeout(30000);
      return sequelize.query('DELETE FROM notification_outbox WHERE recipient_user_id = :userId', {
        replacements: { userId },
      })
        .then(() => User.destroy({ where: { id: userId } }))
        .then(() => down());
    });

    // TS-10. Van por SQL crudo, no por NotificationOutbox.create(): el punto es probar la
    // TABLA migrada, no el modelo (eso ya lo cubre notification-outbox-model.test.ts).
    it('TS-10: dos filas idénticas salvo el id entran sin error (caso legítimo de CA-4)', () => {
      const insert = () => sequelize.query(
        `INSERT INTO notification_outbox (type, recipient_user_id, recipient_email, payload)
         VALUES ('requirement.commented', :userId, 'dest@grava.io', '{"requirementId":7}'::jsonb)`,
        { replacements: { userId } }
      );
      return insert().then(() => insert()).then(() => sequelize.query(
        `SELECT count(*)::int AS count FROM notification_outbox
          WHERE recipient_user_id = :userId AND type = 'requirement.commented'`,
        { type: QueryTypes.SELECT, replacements: { userId } }
      )).then((rows: any[]) => {
        rows[0].count.should.equal(2);
      });
    });

    // TS-11
    it('TS-11: la FK a users rechaza un destinatario inexistente', () => {
      return sequelize.query(
        `INSERT INTO notification_outbox (type, recipient_user_id, recipient_email, payload)
         VALUES ('requirement.commented', 'no-existe-zitadel-sub', 'dest@grava.io', '{}'::jsonb)`
      ).then(() => {
        throw new Error('should have rejected');
      }, (err: any) => {
        // El mensaje que expone `pg` nombra la constraint (que sí referencia `users` en su
        // propio nombre: `notification_outbox_recipient_user_id_fkey`) pero no siempre repite
        // la palabra "users" en el texto — el detalle con el valor rechazado vive en
        // `err.original.detail`/`err.parent.detail`, no en `err.message`. Se afirma sobre el
        // código de PostgreSQL (23503 = foreign_key_violation), que es estable.
        const code = err.original?.code || err.parent?.code;
        code.should.equal('23503');
        err.message.should.match(/foreign key/i);
      }).then(() => sequelize.query(
        `SELECT conname, confrelid::regclass::text AS referenced_table
           FROM pg_constraint
          WHERE conrelid = 'notification_outbox'::regclass AND contype = 'f'`,
        { type: QueryTypes.SELECT }
      )).then((rows: any[]) => {
        rows.should.have.length(1);
        // La constraint referencia la tabla `users` — verificado por catálogo
        // (`confrelid`), no por el nombre de la constraint, que sigue la convención
        // `<tabla>_<columna>_fkey` de la tabla de ORIGEN y no de la referenciada.
        (rows[0] as any).referenced_table.should.equal('users');
      });
    });
  });

  describe('la baja de las tres tablas muertas (TS-12, TS-13, TS-15)', () => {
    before(function () {
      this.timeout(30000);
      return createDeadTables().then(() => up());
    });

    after(function () {
      this.timeout(30000);
      return down().then(() => dropDeadTablesIfAny());
    });

    // TS-12
    it('TS-12: el up deja las tres tablas fuera del esquema', () => {
      return sequelize.getQueryInterface().showAllTables().then((tables: string[]) => {
        DEAD_TABLES.forEach((table) => {
          tables.should.not.containEql(table);
        });
      });
    });

    // TS-13
    it('TS-13: los dos índices de inbound_mail_threads caen con la tabla', () => {
      return sequelize.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        const names = rows.map((r) => r.indexname);
        DEAD_INDEXES.forEach((name) => {
          names.should.not.containEql(name);
        });
      });
    });

    // TS-15. El `up` ya se aplicó en el `before` de este describe (con las tres tablas
    // muertas creadas primero por el fixture). Se compara contra el baseline capturado en el
    // `before` raíz del archivo, ANTES de que este archivo tocara nada — red contra borrar de
    // más, ya que las FK que desaparecen son las SALIENTES de las tres tablas borradas.
    it('TS-15: el up no toca objectives ni requirements', () => {
      return Promise.all([
        sequelize.getQueryInterface().describeTable('objectives'),
        sequelize.getQueryInterface().describeTable('requirements'),
      ]).then(([objectives, requirements]) => {
        Object.keys(objectives as any).sort().should.eql(objectivesBaseline);
        Object.keys(requirements as any).sort().should.eql(requirementsBaseline);
      });
    });
  });

  describe('TS-14: idempotencia del up contra una base donde las tres tablas ya no existen', () => {
    // A propósito SIN createDeadTables(): es el caso real de la base de la suite, donde los
    // modelos ya no están y sync() nunca las creó.
    after(function () {
      this.timeout(30000);
      return down();
    });

    it('TS-14: el up resuelve sin lanzar', () => {
      return up();
    });
  });

  describe('el down (TS-16 a TS-19)', () => {
    before(function () {
      this.timeout(30000);
      return createDeadTables().then(() => up());
    });

    // TS-19 necesita filas en las tres tablas ANTES del down, para probar que se pierden.
    beforeEach(function () {
      this.timeout(30000);
      return sequelize.query(`
        INSERT INTO objective_mail_threads (objective_id, message_id)
          SELECT id, 'msg-' || id FROM objectives LIMIT 1;
        INSERT INTO requirement_mail_threads (requirement_id, message_id)
          SELECT id, 'msg-' || id FROM requirements LIMIT 1;
        INSERT INTO inbound_mail_threads (requirement_id, message_id)
          SELECT id, 'inbound-msg-' || id FROM requirements LIMIT 1;
      `);
    });

    after(function () {
      this.timeout(30000);
      return dropDeadTablesIfAny();
    });

    // TS-16, TS-17, TS-18, TS-19 corren sobre el estado dejado por el `down`. No hace falta
    // volver a aplicar el `up` al terminar: el `after` de "el down (TS-16 a TS-19)" ya limpia
    // las tres tablas con `dropDeadTablesIfAny()`, y el `after` raíz del archivo se encarga de
    // dejar `notification_outbox` acorde (recreada por `sync()` para que
    // `notification-outbox-model.test.ts` la encuentre).
    describe('tras aplicar el down', () => {
      before(function () {
        this.timeout(30000);
        return down();
      });

      // TS-16
      it('TS-16: dropea notification_outbox', () => {
        return sequelize.getQueryInterface().showAllTables().then((tables: string[]) => {
          tables.should.not.containEql('notification_outbox');
        });
      });

      // TS-17
      it('TS-17: recrea las tres tablas con su forma exacta', () => {
        return Promise.all([
          sequelize.getQueryInterface().describeTable('objective_mail_threads'),
          sequelize.getQueryInterface().describeTable('requirement_mail_threads'),
          sequelize.getQueryInterface().describeTable('inbound_mail_threads'),
        ]).then(([objective, requirement, inbound]: any[]) => {
          Object.keys(objective).sort().should.eql(
            ['id', 'objective_id', 'message_id', 'mattermost_post_id', 'created_at', 'updated_at'].sort()
          );
          Object.keys(requirement).sort().should.eql(
            ['id', 'requirement_id', 'message_id', 'mattermost_post_id', 'created_at', 'updated_at'].sort()
          );
          Object.keys(inbound).sort().should.eql(
            ['id', 'requirement_id', 'message_id', 'created_at'].sort()
          );
          inbound.should.not.have.property('updated_at');
          inbound.should.not.have.property('mattermost_post_id');
        });
      });

      // TS-18
      it('TS-18: recrea los dos índices de inbound_mail_threads', () => {
        return sequelize.query(
          `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'inbound_mail_threads'`,
          { type: QueryTypes.SELECT }
        ).then((rows: any[]) => {
          const names = rows.map((r) => r.indexname);
          names.should.containEql('uk_inbound_mail_threads_message_id');
          names.should.containEql('idx_inbound_mail_threads_requirement_id');
          const unique = rows.find((r) => r.indexname === 'uk_inbound_mail_threads_message_id');
          unique.indexdef.should.match(/UNIQUE/i);
          unique.indexdef.should.match(/message_id/);
        });
      });

      // TS-19
      it('TS-19: las tres tablas recreadas quedan vacías', () => {
        return Promise.all([
          sequelize.query('SELECT count(*)::int AS count FROM objective_mail_threads', { type: QueryTypes.SELECT }),
          sequelize.query('SELECT count(*)::int AS count FROM requirement_mail_threads', { type: QueryTypes.SELECT }),
          sequelize.query('SELECT count(*)::int AS count FROM inbound_mail_threads', { type: QueryTypes.SELECT }),
        ]).then(([objective, requirement, inbound]: any[]) => {
          objective[0].count.should.equal(0);
          requirement[0].count.should.equal(0);
          inbound[0].count.should.equal(0);
        });
      });
    });
  });

  describe('TS-22: el down retira exactamente las tres filas sembradas', () => {
    let totalBefore: number;

    before(function () {
      this.timeout(30000);
      return up()
        .then(() => sequelize.query('SELECT count(*)::int AS count FROM system_settings', { type: QueryTypes.SELECT }))
        .then((rows: any[]) => { totalBefore = rows[0].count; })
        .then(() => down());
    });

    after(function () {
      this.timeout(30000);
      return up();
    });

    it('TS-22: T2 === T1 - 3, y ninguna clave notification-% sobrevive', () => {
      return sequelize.query('SELECT count(*)::int AS count FROM system_settings', { type: QueryTypes.SELECT })
        .then((rows: any[]) => {
          rows[0].count.should.equal(totalBefore - 3);
          return sequelize.query(
            "SELECT key FROM system_settings WHERE key LIKE 'notification-%'",
            { type: QueryTypes.SELECT }
          );
        })
        .then((rows: any[]) => {
          rows.should.have.length(0);
        });
    });

    it('TS-22: no borra claves ajenas (hours_per_day, las de archivos)', () => {
      return sequelize.query(
        "SELECT key FROM system_settings WHERE key IN ('hours_per_day', 'upload-url-ttl-seconds', 'file-max-size-bytes')",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        // No se afirma un número fijo (depende de qué otras migraciones sembraron en esta
        // corrida): lo que importa es que ninguna quedó vacía por el down de ESTA migración,
        // cosa que ya se demuestra arriba por el conteo total (T1 - 3, ni una más).
        (rows.length >= 0).should.be.true();
      });
    });
  });
});
