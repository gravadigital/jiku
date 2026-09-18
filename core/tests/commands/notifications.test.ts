import 'mocha';
import 'should';
import sinon from 'sinon';
import { Op } from 'sequelize';
import {
  NotificationOutbox, Project, Requirement, RequirementActivity, RequirementSubscriptor,
  RequirementVisibilityLevel, User, UserProjectPermission, VisibilityLevel,
} from '@jiku/models';
import {
  ErrorCode, Reply, commandSubject, success, failure,
} from '@jiku/nats-protocol';
import { Dispatcher } from '../../src/bus/dispatcher';
import { CommandRegistry } from '../../src/commands/registry';
import { Command, CommandContext } from '../../src/commands/types';
import { getTrustedPublisherId } from '../../src/config';
import { fakePublisher } from '../helpers/dispatch';

/**
 * Los 33 escenarios de S-071 (REQ-015): el registro de tipos, las cuatro reglas de filtrado, el
 * payload congelado y el escritor invocado ANTES del commit.
 *
 * NINGÚN COMANDO DE PRODUCCIÓN DECLARA NOTIFICACIONES TODAVÍA (eso es S-072). Este archivo
 * registra COMANDOS DOBLE en un `CommandRegistry`/`Dispatcher` PROPIOS —el patrón que
 * `times-rules.test.ts:637` ya usa para el registry—, y los despacha por el camino real
 * (`Dispatcher.dispatch`), nunca llamando a `execute()` directo: es lo único que cubre la
 * transacción y el rollback (ADR-003). La aserción es siempre una consulta a `NotificationOutbox`
 * después del `dispatch()`.
 */

const TRUSTED = () => getTrustedPublisherId();

// ── Fixtures compartidos, creados una sola vez en el `before` ────────────────────────────────
const U1 = 'notif-u-actor'; // { name: 'Ana Pérez', email: 'ana@ej.com' }
const U2 = 'notif-u2';
const U3 = 'notif-u3';
const U4 = 'notif-u-svc'; // identityType: 'service', email: null
const U5 = 'notif-u5'; // sin permiso de proyecto sobre P1
const U4BIS = 'notif-u4bis'; // con correo y permiso, NO suscriptor de R412 (para el override)
const GHOST = 'notif-u-ghost'; // id sin fila en `users`, para el override que no resuelve

describe('notifications (S-071)', () => {
  let P1: number;
  let P2: number;
  let R412: number;
  let R413: number;

  before(async () => {
    await User.create({ id: U1, name: 'Ana Pérez', username: 'notif-ana', email: 'ana@ej.com' });
    await User.create({ id: U2, name: 'U2', username: 'notif-u2', email: 'u2@ej.com' });
    await User.create({ id: U3, name: 'U3', username: 'notif-u3', email: 'u3@ej.com' });
    await User.create({
      id: U4, name: 'Servicio', username: 'notif-svc', email: null, identityType: 'service',
    });
    await User.create({ id: U5, name: 'U5', username: 'notif-u5', email: 'u5@ej.com' });
    await User.create({ id: U4BIS, name: 'U4bis', username: 'notif-u4bis', email: 'u4bis@ej.com' });

    P1 = (await Project.create({
      name: 'Portal Norte', code: 'NOTIF1', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: U1,
    })).id;
    P2 = (await Project.create({
      name: null, code: 'NOTIF2', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: U1,
    })).id;

    // Permisos de proyecto sobre P1: todos menos U5 (regla 4, TS-13/TS-14/TS-25).
    for (const userId of [U1, U2, U3, U4, U4BIS]) {
      await UserProjectPermission.create({ userId, projectId: P1 });
    }

    R412 = (await Requirement.create({
      title: 'El buscador no filtra por etiqueta', description: 'x', projectId: P1,
      createdBy: U1, visibilityLevel: RequirementVisibilityLevel.Public,
    })).id;
    R413 = (await Requirement.create({
      title: 'Interno', description: 'x', projectId: P1,
      createdBy: U1, visibilityLevel: RequirementVisibilityLevel.Internal,
    })).id;
  });

  beforeEach(async () => {
    // El truncado es al arrancar cada test, no solo al arrancar la corrida: un escenario que
    // deja filas de otro tipo/requisito no puede colarse en el conteo del siguiente.
    await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });
    await RequirementSubscriptor.destroy({ where: {} });
    fakePublisher.reset();
  });

  after(async () => {
    // Limpieza explícita de TODOS los fixtures propios, en orden de FK (hijos primero). Sin esto,
    // los `UserProjectPermission`/`Requirement` que apuntan a `P1`/`P2` sobreviven al resto de la
    // corrida, y CUALQUIER otra suite que haga `Project.destroy({ where: {} })` —el patrón que
    // usa casi todo `core/tests/commands/`— revienta con una violación de FK que no tiene nada
    // que ver con lo que esa suite está probando.
    await NotificationOutbox.destroy({ where: {}, truncate: true, cascade: true });
    await RequirementSubscriptor.destroy({ where: {} });
    await RequirementActivity.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await UserProjectPermission.destroy({ where: {} });
    await Project.destroy({ where: {} });
    await User.destroy({ where: { id: [U1, U2, U3, U4, U5, U4BIS, GHOST] } });
  });

  // ── El comando doble: declara EXACTAMENTE lo que el test le pase ────────────────────────────

  interface DobleConfig {
    notifications?: Reply['notifications'];
    events?: Reply['events'];
    fail?: boolean;
    /** Para TS-3: un `INSERT` de dominio real, para verificar que el rollback también lo alcanza. */
    createClientOnExecute?: boolean;
  }

  let dispatcher: Dispatcher;
  let lastConfig: DobleConfig;

  beforeEach(() => {
    lastConfig = {};
    // `pattern: 'requirements.new'`, NO UN PATRÓN INVENTADO: la compuerta de autorización
    // (`authorize-caller.ts`) rechaza cualquier patrón que no esté en su mapa de roles, y el
    // registry de este archivo es PROPIO —no comparte nada con `core/src/commands/index.ts`—, así
    // que reusar un patrón ya autorizado para `user` no expone ningún comando de mentira en
    // producción: el `CommandRegistry` real nunca ve esta entrada.
    const doble: Command<Record<string, unknown>, unknown> = {
      pattern: 'requirements.new',
      validate: (payload) => ({ value: (payload ?? {}) as Record<string, unknown> }),
      execute: async (_payload, ctx: CommandContext) => {
        if (lastConfig.createClientOnExecute) {
          const { Client } = await import('@jiku/models');
          await Client.create({ name: 'Cliente de TS-3' }, { transaction: ctx.transaction });
        }
        if (lastConfig.fail) {
          return failure(ErrorCode.INTERNAL_ERROR, 'boom');
        }
        const reply = success();
        if (lastConfig.notifications !== undefined) {
          reply.notifications = lastConfig.notifications;
        }
        if (lastConfig.events !== undefined) {
          reply.events = lastConfig.events;
        }
        return reply;
      },
    };
    dispatcher = new Dispatcher(new CommandRegistry().register(doble), fakePublisher);
  });

  /** Despacha el comando doble con la config ya cargada en `lastConfig`. */
  function dispatchDoble(config: DobleConfig, body: unknown = {}, caller = TRUSTED()): Promise<Reply<unknown>> {
    lastConfig = config;
    return dispatcher.dispatch(commandSubject('requirements.new', caller), body) as Promise<Reply<unknown>>;
  }

  /** Filas de `notification_outbox`, ordenadas por `id` NUMÉRICO (BIGINT llega como string). */
  async function allRows() {
    const rows = await NotificationOutbox.findAll();
    return rows.sort((a, b) => Number(a.id) - Number(b.id));
  }

  // ============================================================================================
  // Camino feliz y forma del mecanismo (CA-1, CA-3, CA-6, CA-7)
  // ============================================================================================

  describe('camino feliz', () => {
    beforeEach(async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U1 },
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
    });

    it('TS-1 · se encola una fila por destinatario sobreviviente', async () => {
      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(2);
      const recipientIds = rows.map((r) => r.recipientUserId).sort();
      recipientIds.should.deepEqual([U2, U3].sort());
      rows.forEach((row) => {
        row.type.should.equal('requirement.created');
        row.channel.should.equal('email');
        row.status.should.equal('pending');
        row.attempts.should.equal(0);
        (row.sentAt === null).should.be.true();
        (row.lastError === null).should.be.true();
      });
    });

    it('TS-2 · la fila se escribe DENTRO de la transacción: rollback no deja nada', async () => {
      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        fail: true,
      });

      reply.status.should.equal('failure');
      (await allRows()).length.should.equal(0);
    });

    it('TS-3 · el escritor corre ANTES del commit: si lanza, hay rollback de TODO', async () => {
      const { Client } = await import('@jiku/models');
      const before = await Client.count();

      const reply = await dispatchDoble({
        notifications: [{ type: 'tipo.inexistente', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        createClientOnExecute: true,
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INTERNAL_ERROR);
      (await allRows()).length.should.equal(0);
      (await Client.count()).should.equal(before);
    });

    it('TS-9 · Regla 2: se reusa resolveRecipients() y no hay una segunda consulta equivalente', async () => {
      const spy = sinon.spy(RequirementSubscriptor, 'findAll');
      try {
        await dispatchDoble({
          notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        }, { actor: { id: U1, roles: ['user'] } });
        spy.callCount.should.equal(1);
      } finally {
        spy.restore();
      }
    });

    it('TS-26 · varias notificaciones declaradas en el mismo Reply se escriben todas', async () => {
      await dispatchDoble({
        notifications: [
          { type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 }, recipientOverride: U2 },
          { type: 'requirement.resolved', entity: { type: 'requirement', id: R412, projectId: P1 }, recipientOverride: U2 },
        ],
      });

      const rows = await allRows();
      rows.length.should.equal(2);
      rows.map((r) => r.type).sort().should.deepEqual(['requirement.created', 'requirement.resolved']);
      rows.forEach((r) => r.recipientUserId.should.equal(U2));
    });

    it('TS-27 · notifications: [] no escribe nada y no rompe', async () => {
      const reply = await dispatchDoble({ notifications: [] });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-28 · un Reply sin notifications se comporta exactamente como hoy', async () => {
      const reply = await dispatchDoble({});

      reply.status.should.equal('success');
      ('notifications' in reply).should.be.false();
      (await allRows()).length.should.equal(0);
    });

    it('TS-29 · los eventos se siguen emitiendo, y DESPUÉS del commit', async () => {
      const domainEvent = {
        eventId: 'ev-1', type: 'requirement.created', version: 'v1',
        occurredAt: new Date().toISOString(), correlationId: 'corr-1',
        actor: { id: U1 }, entity: { type: 'requirement', id: R412, projectId: P1 },
        snapshot: {},
      } as any;

      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        events: [domainEvent],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(2);
      fakePublisher.published.length.should.equal(1);
    });

    it('TS-30 · un fallo del escritor NO deja el evento publicado', async () => {
      const domainEvent = {
        eventId: 'ev-2', type: 'requirement.created', version: 'v1',
        occurredAt: new Date().toISOString(), correlationId: 'corr-2',
        actor: { id: U1 }, entity: { type: 'requirement', id: R412, projectId: P1 },
        snapshot: {},
      } as any;

      const reply = await dispatchDoble({
        notifications: [{ type: 'tipo.inexistente', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        events: [domainEvent],
      });

      reply.status.should.equal('failure');
      (await allRows()).length.should.equal(0);
      fakePublisher.published.length.should.equal(0);
    });
  });

  // ============================================================================================
  // Regla 1 — Visibilidad (CA-4, CA-5)
  // ============================================================================================

  describe('regla 1 — visibilidad', () => {
    it('TS-4 · un requisito internal no encola nada', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R413, userId: U2 },
        { requirementId: R413, userId: U3 },
      ]);

      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R413, projectId: P1 } }],
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-5 · el corte por visibilidad ocurre ANTES de resolver destinatarios', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R413, userId: U2 },
        { requirementId: R413, userId: U3 },
      ]);
      const spy = sinon.spy(RequirementSubscriptor, 'findAll');
      try {
        await dispatchDoble({
          notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R413, projectId: P1 } }],
        });
        spy.called.should.be.false();
      } finally {
        spy.restore();
      }
      (await allRows()).length.should.equal(0);
    });

    it('TS-6 · comentario internal sobre requisito public no encola', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
      const activity = await RequirementActivity.create({
        typeOfActivity: 'comment', previousValue: '', newValue: 'un comentario',
        visibilityLevel: VisibilityLevel.Internal, requirementId: R412, changedBy: U1,
      });

      const reply = await dispatchDoble({
        notifications: [{
          type: 'requirement.comment.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          data: { commentId: activity.id },
        }],
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-7 · comentario public sobre requisito public SÍ encola', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
      const activity = await RequirementActivity.create({
        typeOfActivity: 'comment', previousValue: '', newValue: 'un comentario',
        visibilityLevel: VisibilityLevel.Public, requirementId: R412, changedBy: U1,
      });

      await dispatchDoble({
        notifications: [{
          type: 'requirement.comment.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          data: { commentId: activity.id },
        }],
      });

      const rows = await allRows();
      rows.length.should.equal(2);
      rows.forEach((r) => r.type.should.equal('requirement.comment.created'));
      rows.map((r) => r.recipientUserId).sort().should.deepEqual([U2, U3].sort());
    });

    it('TS-8 · el default del comentario es internal: sin visibilityLevel explícito no encola', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
      const activity = await RequirementActivity.create({
        typeOfActivity: 'comment', previousValue: '', newValue: 'un comentario',
        requirementId: R412, changedBy: U1,
      });

      await dispatchDoble({
        notifications: [{
          type: 'requirement.comment.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          data: { commentId: activity.id },
        }],
      });

      (await allRows()).length.should.equal(0);
    });
  });

  // ============================================================================================
  // Regla 3 — Excluir actor · deduplicar · saltear sin email (CA-7)
  // ============================================================================================

  describe('regla 3 — exclusión / dedup / sin email', () => {
    it('TS-10 · el actor se excluye', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U1 },
        { requirementId: R412, userId: U2 },
      ]);

      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
      rows.some((r) => r.recipientUserId === U1).should.be.false();
    });

    it('TS-11 · un userId duplicado produce UNA sola fila', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U2 },
      ]);

      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
    });

    it('TS-12 · un destinatario sin correo se saltea sin hacer fallar al resto', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U4 },
      ]);

      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
    });

    it('TS-16 · lista vacía tras el filtrado: el único suscriptor es el actor', async () => {
      await RequirementSubscriptor.bulkCreate([{ requirementId: R412, userId: U1 }]);

      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });
  });

  // ============================================================================================
  // Regla 4 — Permiso de proyecto (CA-8)
  // ============================================================================================

  describe('regla 4 — permiso de proyecto', () => {
    it('TS-13 · sin permiso de proyecto no se encola', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U5 },
      ]);

      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U2);
    });

    it('TS-14 · el permiso se verifica con UNA consulta en lote', async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
        { requirementId: R412, userId: U5 },
      ]);
      const spy = sinon.spy(UserProjectPermission, 'findAll');
      try {
        await dispatchDoble({
          notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
        }, { actor: { id: U1, roles: ['user'] } });

        spy.callCount.should.equal(1);
        const call = spy.getCall(0).args[0] as any;
        call.where.projectId.should.equal(P1);
        const ids: string[] = call.where.userId[Op.in];
        [...ids].sort().should.deepEqual([U2, U3, U5].sort());
      } finally {
        spy.restore();
      }
    });

    it('TS-15 · un requisito sin suscriptores no escribe nada y el comando responde éxito', async () => {
      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });
  });

  // ============================================================================================
  // El payload congelado (CA-10 a CA-13)
  // ============================================================================================

  describe('el payload congelado', () => {
    beforeEach(async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U1 },
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
    });

    it('TS-17 · el payload tiene la forma genérica completa', async () => {
      await dispatchDoble({
        notifications: [{
          type: 'requirement.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          data: { foo: 'bar' },
        }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      const row = rows.find((r) => r.recipientUserId === U2)!;
      const payload = row.payload as any;
      Object.keys(payload).sort().should.deepEqual(['actor', 'data', 'entity', 'link', 'project', 'title'].sort());
      payload.entity.should.deepEqual({ type: 'requirement', id: R412, projectId: P1 });
      payload.title.should.equal('El buscador no filtra por etiqueta');
      payload.project.should.deepEqual({ name: 'Portal Norte' });
    });

    it('TS-18 · el payload está CONGELADO: cambiar el título después no lo altera', async () => {
      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      await Requirement.update({ title: 'Otro título' }, { where: { id: R412 } });

      const rows = await allRows();
      const row = rows.find((r) => r.recipientUserId === U2)!;
      (row.payload as any).title.should.equal('El buscador no filtra por etiqueta');
    });

    it('TS-19 · actor.name lleva el nombre humano cuando el sobre lo trae', async () => {
      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'], name: 'Ana Pérez' } });

      const rows = await allRows();
      const row = rows.find((r) => r.recipientUserId === U2)!;
      (row.payload as any).actor.should.deepEqual({ id: U1, name: 'Ana Pérez' });
    });

    it('TS-20 · actor.name tolera ser un id cuando no hay nombre que valga', async () => {
      // Canal exento: sin sobre, caller = publicador de confianza.
      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, {});

      const rows = await allRows();
      rows.length.should.be.above(0);
      const payload = rows[0].payload as any;
      payload.actor.name.should.equal(payload.actor.id);
    });

    it('TS-21 · el link se arma al encolar, completo', async () => {
      await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      const row = rows.find((r) => r.recipientUserId === U2)!;
      (row.payload as any).link.should.equal(`https://opus.ejemplo.com/projects/${P1}/requirements/${R412}`);
    });

    it('TS-22 · project.name null se congela sin lanzar', async () => {
      const req = await Requirement.create({
        title: 'En P2', description: 'x', projectId: P2, createdBy: U1,
        visibilityLevel: RequirementVisibilityLevel.Public,
      });
      await UserProjectPermission.create({ userId: U2, projectId: P2 });
      await RequirementSubscriptor.create({ requirementId: req.id, userId: U2 });

      const reply = await dispatchDoble({
        notifications: [{ type: 'requirement.created', entity: { type: 'requirement', id: req.id, projectId: P2 } }],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      const rows = await allRows();
      const row = rows.find((r) => r.recipientUserId === U2)!;
      (row.payload as any).project.should.deepEqual({ name: null });
    });
  });

  // ============================================================================================
  // Override (CA-14)
  // ============================================================================================

  describe('override (recipientOverride)', () => {
    beforeEach(async () => {
      await RequirementSubscriptor.bulkCreate([
        { requirementId: R412, userId: U1 },
        { requirementId: R412, userId: U2 },
        { requirementId: R412, userId: U3 },
      ]);
    });

    it('TS-23 · un destinatario explícito no pasa por "suscriptores menos actor"', async () => {
      await dispatchDoble({
        notifications: [{
          type: 'requirement.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          recipientOverride: U4BIS,
        }],
      }, { actor: { id: U1, roles: ['user'] } });

      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U4BIS);
    });

    it('TS-24 · si el destinatario explícito es el propio actor, no se encola nada', async () => {
      const reply = await dispatchDoble({
        notifications: [{
          type: 'requirement.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          recipientOverride: U1,
        }],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      (await allRows()).length.should.equal(0);
    });

    it('TS-25 · el destinatario explícito igual pasa por las reglas 1, 3 y 4', async () => {
      await dispatchDoble({
        notifications: [{
          type: 'requirement.created',
          entity: { type: 'requirement', id: R412, projectId: P1 },
          recipientOverride: U5,
        }],
      }, { actor: { id: U1, roles: ['user'] } });

      (await allRows()).length.should.equal(0);
    });

    it('TS-31 · un tipo con destinatario sin fila en users no rompe el encolado del resto', async () => {
      const reply = await dispatchDoble({
        notifications: [
          { type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 }, recipientOverride: GHOST },
          { type: 'requirement.created', entity: { type: 'requirement', id: R412, projectId: P1 }, recipientOverride: U4BIS },
        ],
      }, { actor: { id: U1, roles: ['user'] } });

      reply.status.should.equal('success');
      const rows = await allRows();
      rows.length.should.equal(1);
      rows[0].recipientUserId.should.equal(U4BIS);
    });
  });

  // ============================================================================================
  // Arranque y estructural (CA-1, CA-2, CA-12)
  // ============================================================================================

  describe('arranque y estructural', () => {
    it('un Reply construido con success() no tiene la clave notifications (Task 1)', () => {
      const reply = success({ id: 1 });
      ('notifications' in reply).should.be.false();
    });

    it('TS-32 · sin OPUS_URL el servicio no arranca', async () => {
      const original = process.env.OPUS_URL;
      delete process.env.OPUS_URL;
      const { loadConfig, resetConfig } = await import('../../src/config');
      resetConfig();
      try {
        (() => loadConfig()).should.throw(/OPUS_URL/);
      } finally {
        process.env.OPUS_URL = original;
        loadConfig();
      }
    });

    it('TS-41 (S-073) · OPUS_URL vacía (solo espacios) se trata igual que ausente', async () => {
      const original = process.env.OPUS_URL;
      process.env.OPUS_URL = '   ';
      const { loadConfig, resetConfig } = await import('../../src/config');
      resetConfig();
      try {
        (() => loadConfig()).should.throw(/OPUS_URL/);
      } finally {
        process.env.OPUS_URL = original;
        loadConfig();
      }
    });

    it('TS-33 · estructural: recipients.ts no nombra ningún tipo de notificación', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const filePath = path.join(__dirname, '../../src/notifications/recipients.ts');
      const source = fs.readFileSync(filePath, 'utf-8');

      const knownTypes = [
        'requirement.created', 'requirement.resolved', 'requirement.reopened',
        'requirement.comment.created',
      ];
      knownTypes.forEach((type) => {
        source.includes(type).should.be.false();
      });
    });

    it('un tipo desconocido lanza al resolverse', async () => {
      const reply = await dispatchDoble({
        notifications: [{ type: 'tipo.jamas.registrado', entity: { type: 'requirement', id: R412, projectId: P1 } }],
      });

      reply.status.should.equal('failure');
      reply.errorCode!.should.equal(ErrorCode.INTERNAL_ERROR);
    });
  });
});
