import 'mocha';
import 'should';
import { initDb } from '../mocks/app';
import { sequelize } from '../../lib/models';
import {
  Project, Requirement, RequirementPriority, RequirementState, RequirementType, User,
} from '@jiku/models';

const MAIL_BOT_ID = 'system-mail-bot';

describe('S-062: projects.ticket_slug y usuario mail-bot', () => {
  let userId: string;

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
      `));
  });

  after(() => {
    return Requirement.destroy({ where: {} })
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: { id: [userId, MAIL_BOT_ID] } }));
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
      user!.email!.should.equal('mail-bot@example.invalid');
    });
  });

  // TS-13: mail-bot referenciable como created_by de un Requirement — el caso real que
  // motiva el usuario de sistema (autor de requisitos creados desde un mail entrante).
  it('should allow a requirement authored by the mail-bot user', () => {
    return Project.create({
      code: 'P-MAILBOT', name: 'Mail Bot Project', type: 'interno', status: 'activo',
      initDate: new Date(), createdBy: MAIL_BOT_ID,
    }).then((project) => Requirement.create({
      title: 'Requisito de prueba',
      description: 'Descripción de prueba',
      type: RequirementType.Funcionalidad,
      priority: RequirementPriority.Media,
      state: RequirementState.Analisis,
      projectId: project.id,
      createdBy: MAIL_BOT_ID,
    })).then((req) => {
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
});
