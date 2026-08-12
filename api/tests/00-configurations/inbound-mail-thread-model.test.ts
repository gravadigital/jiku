import 'mocha';
import 'should';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import { InboundMailThread, Project, Requirement, RequirementPriority, RequirementState, RequirementType, User } from '@jiku/models';

const MAIL_BOT_ID = 'system-mail-bot';

// Datos base para crear un requisito válido (campos obligatorios de requirements).
function baseRequirement(projectId: number, createdBy: string) {
  return {
    title: 'Requisito de prueba',
    description: 'Descripción de prueba',
    type: RequirementType.Funcionalidad,
    priority: RequirementPriority.Media,
    state: RequirementState.Analisis,
    projectId,
    createdBy,
  };
}

describe('S-062: inbound_mail_threads, projects.ticket_slug y usuario mail-bot', () => {
  let userId: string;
  let projectId: number;
  let requirementId: number;

  before(function () {
    this.timeout(30000);
    return initDb()
      // Usuario autor + seed idempotente del mail-bot (el suite usa sync(), no migraciones,
      // por lo que sembramos el mail-bot con el mismo INSERT ... ON CONFLICT DO NOTHING).
      .then(() => User.create({
        id: 'user-inbound-test-01',
        name: 'Inbound Test User',
        username: 'inboundtest',
        email: 'inboundtest@mail.com',
      }))
      .then((u) => { userId = u.id; })
      .then(() => sequelize.query(`
        INSERT INTO users (id, name, username, email, created_at, updated_at)
        VALUES ('${MAIL_BOT_ID}', 'Mail Bot', 'mail-bot', 'mail-bot@example.invalid', now(), now())
        ON CONFLICT (id) DO NOTHING;
      `))
      .then(() => Project.create({
        code: 'P-INBOUND',
        name: 'Proyecto Inbound',
        type: 'interno',
        status: 'activo',
        initDate: new Date(),
        createdBy: userId,
      }))
      .then((p) => { projectId = p.id; })
      .then(() => Requirement.create(baseRequirement(projectId, userId)))
      .then((r) => { requirementId = r.id; });
  });

  after(() => {
    return InboundMailThread.destroy({ where: {} })
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: { id: [userId, MAIL_BOT_ID] } }));
  });

  // ---------------------------------------------------------------------------
  // Estructura de la tabla inbound_mail_threads (TS-1, TS-2)
  // ---------------------------------------------------------------------------

  // TS-1: Tabla inbound_mail_threads existe con columnas correctas
  it('should have the inbound_mail_threads table with the expected columns', () => {
    return sequelize.getQueryInterface().describeTable('inbound_mail_threads').then((table: any) => {
      table.should.have.property('id');
      table.id.primaryKey.should.be.true();
      table.id.defaultValue.should.match(/nextval/i);

      table.should.have.property('requirement_id');
      table.requirement_id.allowNull.should.be.false();

      table.should.have.property('message_id');
      table.message_id.allowNull.should.be.false();
      table.message_id.type.should.match(/VARYING\(500\)|VARCHAR\(500\)/i);

      table.should.have.property('created_at');
      table.created_at.allowNull.should.be.false();
    });
  });

  // TS-2: Índices de inbound_mail_threads creados
  it('should have the unique message_id index and the requirement_id index', () => {
    return sequelize.getQueryInterface().showIndex('inbound_mail_threads').then((result: object) => {
      const indexes = result as any[];
      const uk = indexes.find((i) => i.name === 'uk_inbound_mail_threads_message_id');
      const idx = indexes.find((i) => i.name === 'idx_inbound_mail_threads_requirement_id');

      (uk === undefined).should.be.false();
      uk.unique.should.be.true();
      uk.fields.map((f: any) => f.attribute).should.containEql('message_id');

      (idx === undefined).should.be.false();
      idx.fields.map((f: any) => f.attribute).should.containEql('requirement_id');
    });
  });

  // ---------------------------------------------------------------------------
  // Comportamiento de inbound_mail_threads (TS-3, TS-4, TS-5, TS-6, TS-7)
  // ---------------------------------------------------------------------------

  // TS-3: Inserción válida de hilo entrante
  it('should create an inbound mail thread when the input is valid', () => {
    return InboundMailThread.create({
      requirementId,
      messageId: '<msg-1@grava.io>',
    }).then((thread) => {
      thread.id.should.be.a.Number();
      thread.requirementId.should.equal(requirementId);
      thread.messageId.should.equal('<msg-1@grava.io>');
      (thread as any).createdAt.should.not.be.null();
    });
  });

  // TS-4: message_id es único global
  it('should reject a duplicate message_id with a unique constraint error', () => {
    return InboundMailThread.create({
      requirementId,
      messageId: '<dup@grava.io>',
    }).then(() => {
      return InboundMailThread.create({
        requirementId,
        messageId: '<dup@grava.io>',
      }).then(() => { throw new Error('should have rejected'); }, (err: any) => {
        err.name.should.equal('SequelizeUniqueConstraintError');
      });
    });
  });

  // TS-5: N message_id por requirement_id permitido
  it('should allow multiple message_ids for the same requirement_id', () => {
    return InboundMailThread.create({ requirementId, messageId: '<a@grava.io>' })
      .then(() => InboundMailThread.create({ requirementId, messageId: '<b@grava.io>' }))
      .then((second) => {
        second.id.should.be.a.Number();
        return InboundMailThread.count({ where: { requirementId, messageId: ['<a@grava.io>', '<b@grava.io>'] } });
      })
      .then((count) => count.should.equal(2));
  });

  // TS-6: FK ON DELETE CASCADE
  it('should cascade-delete inbound mail threads when the requirement is destroyed', () => {
    let cascadeReqId: number;
    return Requirement.create(baseRequirement(projectId, userId))
      .then((r) => {
        cascadeReqId = r.id;
        return InboundMailThread.bulkCreate([
          { requirementId: cascadeReqId, messageId: '<casc-1@grava.io>' },
          { requirementId: cascadeReqId, messageId: '<casc-2@grava.io>' },
        ]);
      })
      .then(() => Requirement.destroy({ where: { id: cascadeReqId } }))
      .then(() => InboundMailThread.count({ where: { requirementId: cascadeReqId } }))
      .then((count) => count.should.equal(0));
  });

  // TS-7: FK inválida rechazada
  it('should reject an inbound mail thread referencing a non-existent requirement', () => {
    return InboundMailThread.create({
      requirementId: 999999,
      messageId: '<x@grava.io>',
    }).then(() => { throw new Error('should have rejected'); }, (err: any) => {
      err.name.should.equal('SequelizeForeignKeyConstraintError');
    });
  });

  // ---------------------------------------------------------------------------
  // Columna projects.ticket_slug (TS-8, TS-9, TS-10, TS-11)
  // ---------------------------------------------------------------------------

  // TS-8: Columna projects.ticket_slug existe
  it('should have the nullable ticket_slug column on projects', () => {
    return sequelize.getQueryInterface().describeTable('projects').then((table: any) => {
      table.should.have.property('ticket_slug');
      table.ticket_slug.allowNull.should.be.true();
      table.ticket_slug.type.should.match(/VARYING\(255\)|VARCHAR\(255\)/i);
    });
  });

  // TS-9: ticket_slug UNIQUE
  it('should reject a second project with a duplicate ticket_slug', () => {
    return Project.create({
      code: 'P-SLUG-1', name: 'Slug 1', type: 'interno', status: 'activo',
      initDate: new Date(), createdBy: userId, ticketSlug: 'soporte',
    }).then(() => {
      return Project.create({
        code: 'P-SLUG-2', name: 'Slug 2', type: 'interno', status: 'activo',
        initDate: new Date(), createdBy: userId, ticketSlug: 'soporte',
      }).then(() => { throw new Error('should have rejected'); }, (err: any) => {
        err.name.should.equal('SequelizeUniqueConstraintError');
      });
    });
  });

  // TS-10: Múltiples ticket_slug NULL permitidos
  it('should allow multiple projects with a null ticket_slug', () => {
    return Project.create({
      code: 'P-NULL-1', name: 'Null 1', type: 'interno', status: 'activo',
      initDate: new Date(), createdBy: userId, ticketSlug: null,
    }).then(() => Project.create({
      code: 'P-NULL-2', name: 'Null 2', type: 'interno', status: 'activo',
      initDate: new Date(), createdBy: userId, ticketSlug: null,
    })).then((second) => {
      second.id.should.be.a.Number();
    });
  });

  // TS-11: Modelo Project refleja ticketSlug
  it('should persist and read back ticketSlug on the Project model', () => {
    return Project.create({
      code: 'P-VENTAS', name: 'Ventas', type: 'interno', status: 'activo',
      initDate: new Date(), createdBy: userId, ticketSlug: 'ventas',
    }).then((created) => Project.findByPk(created.id))
      .then((project) => {
        project!.ticketSlug!.should.equal('ventas');
      });
  });

  // ---------------------------------------------------------------------------
  // Usuario de sistema mail-bot (TS-12, TS-13, TS-14)
  // ---------------------------------------------------------------------------

  // TS-12: Usuario mail-bot existe
  it('should have the mail-bot system user', () => {
    return User.findByPk(MAIL_BOT_ID).then((user) => {
      (user === null).should.be.false();
      user!.name.should.equal('Mail Bot');
      user!.username.should.equal('mail-bot');
      user!.email.should.equal('mail-bot@example.invalid');
    });
  });

  // TS-13: mail-bot referenciable como created_by
  it('should allow a requirement authored by the mail-bot user', () => {
    return Requirement.create(baseRequirement(projectId, MAIL_BOT_ID)).then((req) => {
      req.id.should.be.a.Number();
      req.createdBy.should.equal(MAIL_BOT_ID);
    });
  });

  // TS-14: Idempotencia del seed
  it('should not duplicate the mail-bot user when the seed insert runs again', () => {
    return sequelize.query(`
      INSERT INTO users (id, name, username, email, created_at, updated_at)
      VALUES ('${MAIL_BOT_ID}', 'Mail Bot', 'mail-bot', 'mail-bot@example.invalid', now(), now())
      ON CONFLICT (id) DO NOTHING;
    `).then(() => User.count({ where: { id: MAIL_BOT_ID } }))
      .then((count) => count.should.equal(1));
  });

  // TS-15: Rollback de migraciones (down).
  // El suite de tests construye el schema con sequelize.sync(), no ejecuta las migraciones,
  // por lo que el rollback (down) no es exercible aquí. Se verifica manualmente:
  //   npm run upgrade-db  (aplica up)  y luego el down de cada migración vía sequelize-cli
  //   db:migrate:undo. Ver README de la story S-062 / Story Plan (Tarea 5, Implementation Notes).
});
