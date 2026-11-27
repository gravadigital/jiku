import 'mocha';
import 'should';
import { dispatchQuery } from '../helpers/dispatch';
import {
  PROJECT_MAIN,
  PROJECT_OTHER,
  Q_ADMIN,
  Q_EXTERNAL,
  Q_MIXED,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import { Q_LONELY, createTeamWorld, destroyTeamWorld } from './team-fixtures';

/**
 * `project-permissions.list` — QUIÉN VE QUÉ PROYECTO (S-026, Task 8).
 *
 * La tabla que SOSTIENE EL AISLAMIENTO del portal de clientes, expuesta como recurso propio. Su
 * decisión de superficie más fina: un externo ve QUIÉN MÁS accede a *su* proyecto, no el mapa
 * completo de accesos del producto.
 *
 * LAS ASERCIONES NO USAN IDS LITERALES de `user_project_permissions`: la PK es autoincremental y su
 * valor depende de qué archivo del suite corrió antes. Se afirma por `(userId, projectId)`.
 */

function pairs(reply: any): string[] {
  return reply.data.items.map((item: any) => `${item.userId}@${item.projectId}`);
}

describe('queries/project-permissions.list — la ficha más chica y su superficie', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-65 · el conjunto base son CUATRO campos, SIN `updatedAt`', async () => {
    const reply: any = await dispatchQuery('project-permissions.list', {
      filter: { userId: Q_EXTERNAL },
    });

    reply.status.should.equal('success');
    // La columna `updated_at` EXISTE en la tabla y la ficha NO la declara (CA-12): un permiso se
    // otorga y se revoca, no se edita.
    Object.keys(reply.data.items[0]).should.deepEqual(['id', 'userId', 'projectId', 'createdAt']);
  });

  it('TS-66 · `filter.projectId` y `filter.userId`', async () => {
    const byProject: any = await dispatchQuery('project-permissions.list', {
      filter: { projectId: PROJECT_MAIN },
    });
    byProject.data.items.forEach((item: any) => item.projectId.should.equal(PROJECT_MAIN));
    pairs(byProject).should.containEql(`${Q_EXTERNAL}@${PROJECT_MAIN}`);
    pairs(byProject).should.containEql(`${Q_MIXED}@${PROJECT_MAIN}`);

    const byUser: any = await dispatchQuery('project-permissions.list', {
      filter: { userId: Q_MIXED },
    });
    pairs(byUser).should.deepEqual([`${Q_MIXED}@${PROJECT_MAIN}`]);
  });

  it('TS-67 · los dos incluibles, y `user` SIN `email`', async () => {
    const reply: any = await dispatchQuery('project-permissions.list', {
      filter: { userId: Q_EXTERNAL },
      include: ['user', 'project'],
    });

    const item = reply.data.items[0];
    item.user.should.deepEqual({ id: Q_EXTERNAL, name: 'Externa', username: 'q-external' });
    item.project.should.deepEqual({ id: PROJECT_MAIN, name: 'Portal Jiku', code: 'PJK' });
  });

  it('TS-68 · lo ordenable es SOLO `id`', async () => {
    const byCreatedAt: any = await dispatchQuery('project-permissions.list', {
      sort: ['createdAt'],
    });
    byCreatedAt.errorCode.should.equal('invalid_fields');
    byCreatedAt.errorDetails.allowed.should.deepEqual(['id']);

    const byProjectId: any = await dispatchQuery('project-permissions.list', {
      sort: ['projectId'],
    });
    byProjectId.errorCode.should.equal('invalid_fields');
    byProjectId.errorDetails.allowed.should.deepEqual(['id']);
  });

  it('TS-69 · CA-13 · el recorte externo son SOLO las filas de proyectos permitidos', async () => {
    // LA FILA DE OTRO PROYECTO EXISTE, y sin ella esta aserción sería vacía: si todas las filas de
    // la tabla fueran del 12, un `externalScope` borrado pasaría el test igual.
    const unclipped: any = await dispatchQuery('project-permissions.list', {});
    pairs(unclipped).should.containEql(`${Q_ADMIN}@${PROJECT_OTHER}`);

    const reply: any = await dispatchQuery('project-permissions.list', {}, Q_EXTERNAL);

    reply.status.should.equal('success');
    reply.data.items.length.should.be.above(0);
    reply.data.items.forEach((item: any) => item.projectId.should.equal(PROJECT_MAIN));
    // La fila del 13 que el caller SÍ podría ver sin el recorte queda afuera.
    pairs(reply).should.not.containEql(`${Q_ADMIN}@${PROJECT_OTHER}`);
    // `Q_LONELY` no tiene ninguna fila, así que no puede aparecer.
    reply.data.items.forEach((item: any) => item.userId.should.not.equal(Q_LONELY));
  });

  it('TS-70 · un externo ve QUIÉN MÁS accede a su proyecto, no "solo las mías"', async () => {
    const reply: any = await dispatchQuery('project-permissions.list', {}, Q_EXTERNAL);

    // El instinto de "solo las mías" sería OTRO recurso: el recorte es por proyecto permitido.
    pairs(reply).should.containEql(`${Q_MIXED}@${PROJECT_MAIN}`);
    pairs(reply).should.containEql(`${Q_EXTERNAL}@${PROJECT_MAIN}`);
  });
});
