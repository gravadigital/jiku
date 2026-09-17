import 'mocha';
import 'should';
import { QueryTypes } from 'sequelize';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import {
  allModels, NotificationOutbox, User,
} from '@jiku/models';

/**
 * S-069: modelo nuevo `NotificationOutbox` — la cola de salida de notificaciones (REQ-015).
 *
 * Conviene ser explícito sobre qué prueba y qué no.
 *
 * LO QUE PRUEBA: lo que `sequelize.sync()` produce para `notification_outbox` — las 12
 * columnas, sus tipos y nulabilidad, los cuatro defaults, el índice **parcial** con su
 * predicado exacto (vía `pg_indexes`, porque `describeTable`/`showIndex` no reportan el
 * `WHERE` de un índice parcial), la ausencia de tipos ENUM nativos para `type`/`status`, y que
 * no hay ningún `UNIQUE` de idempotencia.
 *
 * LO QUE NO PRUEBA: que la migración de `api` (`S-069.api.*`, todavía no aplicada en esta
 * suite) haya creado la tabla en una base migrada — eso es CA-1/CA-2 del lado migración, y se
 * verifica contra ese DDL en su propio plan. El esquema de esta suite lo construye
 * `sequelize.sync()`, no las migraciones (ADR-013, su límite declarado).
 */

const NOTIFICATION_OUTBOX_TYPE = 'requirement.commented';

describe('S-069: modelo NotificationOutbox (cola de salida de notificaciones)', () => {
  let userId: string;

  before(function () {
    this.timeout(30000);
    return initDb()
      .then(() => User.create({
        id: 'zitadel-sub-outbox-01',
        name: 'Usuario Outbox',
        username: 'outboxuser',
        email: 'outbox@grava.io',
      }))
      .then((u) => { userId = u.id; });
  });

  after(() => {
    return NotificationOutbox.destroy({ where: {} })
      .then(() => User.destroy({ where: { id: userId } }));
  });

  describe('barrel de @jiku/models', () => {
    it('el barrel exporta NotificationOutbox', () => {
      (NotificationOutbox === undefined).should.be.false();
    });

    // TS-14
    it('TS-14: allModels registra NotificationOutbox y tiene exactamente 24 elementos', () => {
      allModels.includes(NotificationOutbox).should.be.true();
      allModels.length.should.be.equal(24);
    });
  });

  describe('estructura y contrato de la tabla (TS-1 a TS-4)', () => {
    // TS-1
    it('TS-1: la tabla tiene exactamente las 12 columnas esperadas, sin updated_at', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        const expected = [
          'id', 'type', 'channel', 'recipient_user_id', 'recipient_email', 'payload',
          'status', 'attempts', 'next_attempt_at', 'last_error', 'created_at', 'sent_at',
        ];
        const keys = Object.keys(table);
        expected.forEach((col) => keys.should.containEql(col));
        keys.should.have.length(expected.length);
        keys.should.not.containEql('updated_at');
      });
    });

    // TS-2
    it('TS-2: id es PK autoincremental de 64 bits (BIGINT, no INTEGER)', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        table.id.primaryKey.should.be.true();
        table.id.defaultValue.should.match(/nextval/i);
        table.id.type.should.match(/BIGINT/i);
      });
    });

    // TS-3
    it('TS-3: largos y nullability de las columnas de texto', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        table.type.type.should.match(/VARYING\(100\)|VARCHAR\(100\)/i);
        table.type.allowNull.should.be.false();

        table.channel.type.should.match(/VARYING\(20\)|VARCHAR\(20\)/i);
        table.channel.allowNull.should.be.false();

        table.recipient_user_id.type.should.match(/VARYING\(100\)|VARCHAR\(100\)/i);
        table.recipient_user_id.allowNull.should.be.false();

        table.recipient_email.type.should.match(/VARYING\(255\)|VARCHAR\(255\)/i);
        table.recipient_email.allowNull.should.be.false();

        table.status.type.should.match(/VARYING\(20\)|VARCHAR\(20\)/i);
        table.status.allowNull.should.be.false();

        table.last_error.type.should.match(/TEXT/i);
        table.last_error.allowNull.should.be.true();

        table.sent_at.allowNull.should.be.true();
      });
    });

    // TS-4
    it('TS-4: payload es JSONB NOT NULL', () => {
      return sequelize.getQueryInterface().describeTable('notification_outbox').then((table: any) => {
        table.payload.type.should.match(/JSONB/i);
        table.payload.allowNull.should.be.false();
      });
    });
  });

  describe('defaults al insertar (TS-5)', () => {
    // TS-5
    it('TS-5: los cuatro defaults se aplican al insertar sin ellos', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: userId,
        recipientEmail: 'dest@grava.io',
        payload: { requirementId: 1 },
      } as any).then((created) => {
        created.channel.should.equal('email');
        created.status.should.equal('pending');
        created.attempts.should.equal(0);
        (created.nextAttemptAt instanceof Date).should.be.true();
        (created.nextAttemptAt <= new Date()).should.be.true();
        (created.createdAt !== null && created.createdAt !== undefined).should.be.true();
        (created.sentAt === null).should.be.true();
        (created.lastError === null).should.be.true();
      });
    });
  });

  describe('el índice parcial (TS-6, TS-7)', () => {
    // TS-6
    it('TS-6: existe idx_notification_outbox_pending sobre (next_attempt_at, id), no único', () => {
      return sequelize.getQueryInterface().showIndex('notification_outbox').then((result: object) => {
        const indexes = result as any[];
        const idx = indexes.find((i) => i.name === 'idx_notification_outbox_pending');
        (idx === undefined).should.be.false();
        idx.fields.map((f: any) => f.attribute).should.eql(['next_attempt_at', 'id']);
        idx.unique.should.be.false();
      });
    });

    // TS-7. Prueba de red documentada en las Implementation Notes de la Tarea 4: quitar
    // temporalmente el `where` del modelo y confirmar que este escenario falla antes de
    // confiar en él (ejecutado manualmente al implementar, no automatizado acá).
    it('TS-7: el índice es parcial, con el predicado WHERE status = \'pending\'', () => {
      return sequelize.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_notification_outbox_pending'",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        rows.should.have.length(1);
        (rows[0].indexdef as string).should.match(/WHERE .*status.*=.*'pending'/i);
      });
    });
  });

  describe('type y status son VARCHAR, no ENUM (TS-8)', () => {
    // TS-8. Prueba de red: cambiar temporalmente `status` a DataType.ENUM y confirmar que
    // este escenario falla (ejecutado manualmente al implementar).
    it('TS-8: no existe ningún tipo ENUM de notification_outbox en el catálogo', () => {
      return sequelize.query(
        "SELECT typname FROM pg_type WHERE typtype = 'e'",
        { type: QueryTypes.SELECT }
      ).then((rows: any[]) => {
        const names = rows.map((r) => r.typname as string);
        names.should.not.containEql('enum_notification_outbox_type');
        names.should.not.containEql('enum_notification_outbox_status');
        names.filter((n) => /notification_outbox/i.test(n)).should.have.length(0);
      });
    });
  });

  describe('sin unique de idempotencia (TS-9, TS-10)', () => {
    // TS-9
    it('TS-9: ningún índice único cubre type/recipient_user_id/recipient_email/payload', () => {
      return sequelize.getQueryInterface().showIndex('notification_outbox').then((result: object) => {
        const indexes = result as any[];
        const offending = indexes.filter((i) => {
          if (!i.unique) return false;
          const fields = i.fields.map((f: any) => f.attribute);
          return fields.some((f: string) => ['type', 'recipient_user_id', 'recipient_email', 'payload'].includes(f));
        });
        offending.should.have.length(0);
      });
    });

    // TS-10
    it('TS-10: dos filas idénticas salvo el id se insertan sin error (caso legítimo de CA-4)', () => {
      const row = {
        type: 'requirement.commented.ts10',
        recipientUserId: userId,
        recipientEmail: 'dest@grava.io',
        payload: { requirementId: 7 },
      };
      return NotificationOutbox.create(row as any)
        .then(() => NotificationOutbox.create(row as any))
        .then(() => NotificationOutbox.count({
          where: { recipientUserId: userId, type: 'requirement.commented.ts10' },
        }))
        .then((count) => count.should.equal(2));
    });
  });

  describe('la FK a users (TS-11)', () => {
    // TS-11
    it('TS-11: rechaza un destinatario inexistente', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: 'no-existe-zitadel-sub',
        recipientEmail: 'x@grava.io',
        payload: {},
      } as any).then(() => { throw new Error('should have rejected'); }, (err: any) => {
        err.name.should.equal('SequelizeForeignKeyConstraintError');
      });
    });
  });

  describe('payload y recipientUserId hacen round-trip fielmente (TS-12, TS-13)', () => {
    // TS-12
    it('TS-12: payload vuelve como objeto, no como string', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: userId,
        recipientEmail: 'dest@grava.io',
        payload: { requirementId: 42, comment: { id: 9, author: 'Ana' } },
      } as any).then((created) => NotificationOutbox.findByPk(created.id))
        .then((found) => {
          (typeof found!.payload).should.equal('object');
          (found!.payload as any).comment.author.should.equal('Ana');
        });
    });

    // TS-13
    it('TS-13: recipientUserId viaja como string de 100, no como entero', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: 'zitadel-sub-outbox-01',
        recipientEmail: 'dest@grava.io',
        payload: {},
      } as any).then((created) => NotificationOutbox.findByPk(created.id))
        .then((found) => {
          found!.recipientUserId.should.equal('zitadel-sub-outbox-01');
          (typeof found!.recipientUserId).should.equal('string');
        });
    });
  });

  describe('transición a sent y last_error largo (TS-15, TS-16)', () => {
    // TS-15
    it('TS-15: transición a sent con sent_at', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: userId,
        recipientEmail: 'dest@grava.io',
        payload: {},
      } as any).then((created) => created.update({ status: 'sent', sentAt: new Date() }))
        .then((updated) => NotificationOutbox.findByPk(updated.id))
        .then((found) => {
          found!.status.should.equal('sent');
          (found!.sentAt instanceof Date).should.be.true();
        });
    });

    // TS-16
    it('TS-16: last_error acepta un texto largo (TEXT, no VARCHAR(255))', () => {
      return NotificationOutbox.create({
        type: NOTIFICATION_OUTBOX_TYPE,
        recipientUserId: userId,
        recipientEmail: 'dest@grava.io',
        payload: {},
      } as any).then((created) => created.update({ lastError: 'x'.repeat(5000), attempts: 3 }))
        .then((updated) => NotificationOutbox.findByPk(updated.id))
        .then((found) => {
          found!.lastError!.length.should.equal(5000);
          found!.attempts.should.equal(3);
        });
    });
  });
});
