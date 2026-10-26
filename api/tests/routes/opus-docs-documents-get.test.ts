import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import {
  Project, Requirement, RequirementVisibilityLevel, User, UserProjectPermission,
} from '@jiku/models';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';
import { docsAvailable, itRespectsModuleState, success, expectedActor } from '../helpers/docs-module';
import { docsModule } from '../../lib/modules/registry';

describe('GET /api/opus/docs/documents (S-078)', () => {
  let application: Application;
  const projectId = 8700;
  const publicRequirementId = 8700;
  const internalRequirementId = 8701;
  const EMPTY = { items: [], page: { limit: 50, returned: 0 } };

  before(async () => {
    application = start();
    await User.create({ id: 'zitadel-sub-01', name: 'User Uno', username: 'user01opusdocs', email: 'user01opusdocs@mail.com' });
    await User.create({ id: 'zitadel-sub-03', name: 'Admin Tres', username: 'adm03opusdocs', email: 'adm03opusdocs@mail.com' });
    await User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'ext04opusdocs', email: 'ext04opusdocs@mail.com' });
    await Project.create({
      id: projectId, code: 'OD1', name: 'Opus Docs Project', type: 'comercial',
      status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
    });
    for (const [id, level] of [
      [publicRequirementId, RequirementVisibilityLevel.Public],
      [internalRequirementId, RequirementVisibilityLevel.Internal],
    ] as const) {
      await Requirement.create({
        id, title: `Requisito ${id}`, description: 'd', type: 'funcionalidad', priority: 'sin_prioridad',
        state: 'analisis', visibilityLevel: level, projectId, createdBy: 'zitadel-sub-01',
      });
    }
    await UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId });
  });

  after(async () => {
    await UserProjectPermission.destroy({ where: {} });
    await Requirement.destroy({ where: {} });
    await Project.destroy({ where: { id: projectId } });
    await User.destroy({ where: {} });
  });

  afterEach(() => docsModule.stop());

  const get = (url: string, token = 'token_04_external_user') =>
    request(application).get(url).set('Authorization', `Bearer ${token}`);
  const BASE = '/api/opus/docs/documents';

  it('S-078 · TS-29: por proyecto, externo con permiso', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(EMPTY));
    const res = await get(`${BASE}?projectId=${projectId}`);
    res.status.should.equal(200);
    res.body.should.deepEqual(EMPTY);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { projectId, visibility: 'public' }, sort: ['-updatedAt'], page: { limit: 50 },
      fields: ['id', 'title', 'version', 'visibility', 'createdAt', 'updatedAt'],
      actor: expectedActor('token_04_external_user'),
    });
  });

  it('S-078 · TS-30: externo sin permiso sobre el proyecto', async () => {
    await docsAvailable();
    const res = await get(`${BASE}?projectId=${projectId}`, 'token_06_external_user_no_permissions');
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied for this project.' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-31: proyecto inexistente', async () => {
    await docsAvailable();
    const res = await get(`${BASE}?projectId=999999`);
    res.status.should.equal(404);
    res.body.should.deepEqual({ code: 'project_not_found', message: 'Project not found' });
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-32: por requisito público', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(EMPTY));
    const res = await get(`${BASE}?requirementId=${publicRequirementId}`);
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { requirementId: publicRequirementId, visibility: 'public' }, sort: ['-updatedAt'],
      page: { limit: 50 }, fields: ['id', 'title', 'version', 'visibility', 'createdAt', 'updatedAt'], actor: expectedActor('token_04_external_user'),
    });
  });

  it('S-078 · TS-33: requisito interno', async () => {
    await docsAvailable();
    for (const token of ['token_04_external_user', 'token_01_user']) {
      const res = await get(`${BASE}?requirementId=${internalRequirementId}`, token);
      res.status.should.equal(404);
      res.body.should.deepEqual({ code: 'requirement_not_found', message: 'Requirement not found' });
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-34: la visibilidad no se puede pisar', async () => {
    await docsAvailable();
    const res = await get(`${BASE}?projectId=${projectId}&visibility=internal`);
    res.status.should.equal(400);
    res.body.code.should.equal('invalid_fields');
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-35: ni uno ni los dos', async () => {
    await docsAvailable();
    for (const url of [BASE, `${BASE}?projectId=${projectId}&requirementId=${publicRequirementId}`]) {
      const res = await get(url);
      res.status.should.equal(400);
      res.body.code.should.equal('invalid_fields');
    }
    fakeBus.moduleSent.length.should.equal(0);
  });

  it('S-078 · TS-36: usuario interno sin fila de permiso', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(EMPTY));
    const res = await get(`${BASE}?projectId=${projectId}`, 'token_01_user');
    res.status.should.equal(200);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { projectId, visibility: 'public' }, sort: ['-updatedAt'], page: { limit: 50 },
      fields: ['id', 'title', 'version', 'visibility', 'createdAt', 'updatedAt'],
      actor: expectedActor('token_01_user'),
    });
  });

  it('S-087 · TS-18: usuario admin también fuerza public', async () => {
    await docsAvailable();
    fakeBus.moduleReply('documents.list', success(EMPTY));
    const res = await get(`${BASE}?projectId=${projectId}`, 'token_03_admin');
    res.status.should.equal(200);
    res.body.should.deepEqual(EMPTY);
    (fakeBus.lastModule!.payload as any).should.deepEqual({
      filter: { projectId, visibility: 'public' }, sort: ['-updatedAt'], page: { limit: 50 },
      fields: ['id', 'title', 'version', 'visibility', 'createdAt', 'updatedAt'],
      actor: expectedActor('token_03_admin'),
    });
  });

  it('S-078 · TS-37: sin roles', async () => {
    await docsAvailable();
    const res = await get(`${BASE}?projectId=${projectId}`, 'token_08_no_roles');
    res.status.should.equal(403);
    res.body.should.deepEqual({ code: 'access_denied', message: 'Access denied' });
  });

  it('S-078 · TS-45: con módulo no instalado no toca la base', async () => {
    await docsModule.start();
    const res = await get(`${BASE}?projectId=999999`);
    res.status.should.equal(404);
    res.body.code.should.equal('module_not_installed');
  });

  itRespectsModuleState(() => application, `${BASE}?projectId=${projectId}`, 'token_04_external_user');
});
