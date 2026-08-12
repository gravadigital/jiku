import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, User } from '@jiku/models';

const REQ_BASE = {
  type: 'funcionalidad' as const,
  description: 'desc',
  priority: 'sin_prioridad' as const,
  estimatedFinishDate: '2026-12-01',
  tags: null,
  createdBy: 'zitadel-sub-01',
};

describe('GET /opus/projects/:projid/requirements — state-based ordering', () => {
  let application: Application;
  const PROJECT_ID = 50;

  before(() => {
    application = start();
    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    }).then(() =>
      Project.create({
        id: PROJECT_ID,
        name: 'Ordering Test Project',
        type: 'comercial',
        status: 'activo',
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      })
    );
  });

  afterEach(() => {
    return Requirement.destroy({ where: {} });
  });

  after(() => {
    return Project.destroy({ where: {} }).then(() =>
      User.destroy({ where: {} })
    );
  });

  // TS-4: analisis → ordered by id ASC (lowest id first)
  it('TS-4: should order analisis requirements by id ASC (lowest id first)', () => {
    return Requirement.create({ ...REQ_BASE, id: 101, title: 'Analisis First', state: 'analisis', projectId: PROJECT_ID })
      .then(() => Requirement.create({ ...REQ_BASE, id: 102, title: 'Analisis Second', state: 'analisis', projectId: PROJECT_ID }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=analisis`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(2);
        response.body[0].id.should.equal(101);
        response.body[1].id.should.equal(102);
      });
  });

  // TS-5: planificacion → ordered by id ASC
  it('TS-5: should order planificacion requirements by id ASC', () => {
    return Requirement.create({ ...REQ_BASE, id: 201, title: 'Programado Higher Id', state: 'planificacion', projectId: PROJECT_ID })
      .then(() => Requirement.create({ ...REQ_BASE, id: 202, title: 'Programado Lower Id', state: 'planificacion', projectId: PROJECT_ID }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=planificacion`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(2);
        response.body[0].id.should.equal(201);
        response.body[1].id.should.equal(202);
      });
  });

  // TS-6: revision → ordered by id ASC
  it('TS-6: should order revision requirements by id ASC', () => {
    return Requirement.create({ ...REQ_BASE, id: 401, title: 'Revision Higher Id', state: 'revision', projectId: PROJECT_ID })
      .then(() => Requirement.create({ ...REQ_BASE, id: 402, title: 'Revision Lower Id', state: 'revision', projectId: PROJECT_ID }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=revision`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(2);
        response.body[0].id.should.equal(401);
        response.body[1].id.should.equal(402);
      });
  });

  // TS-7: resuelto → ordered by finishedAt DESC (most recently finished first)
  it('TS-7: should order resuelto requirements by finishedAt DESC (most recent first)', () => {
    const recentFinish = new Date(Date.now() - 5000);
    const oldFinish = new Date(Date.now() - 20000);

    return Requirement.create({ ...REQ_BASE, id: 501, title: 'Finished Recent', state: 'resuelto', projectId: PROJECT_ID, finishedAt: recentFinish })
      .then(() => Requirement.create({ ...REQ_BASE, id: 502, title: 'Finished Old', state: 'resuelto', projectId: PROJECT_ID, finishedAt: oldFinish }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=resuelto`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(2);
        response.body[0].id.should.equal(501);
        response.body[1].id.should.equal(502);
      });
  });

  // TS-8: resuelto NULLS LAST — requirement with null finishedAt goes to the end
  it('TS-8: should put resuelto requirements with null finishedAt at the end (NULLS LAST)', () => {
    const finishedAt = new Date(Date.now() - 5000);

    return Requirement.create({ ...REQ_BASE, id: 601, title: 'Finished With Date', state: 'resuelto', projectId: PROJECT_ID, finishedAt })
      .then(() => Requirement.create({ ...REQ_BASE, id: 602, title: 'Finished Without Date', state: 'resuelto', projectId: PROJECT_ID, finishedAt: null }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=resuelto`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(2);
        response.body[0].id.should.equal(601);
        response.body[1].id.should.equal(602);
      });
  });

  // cancelado → returns cancelado requirements (filter, no early return)
  it('should return cancelado requirements when filtering by state=cancelado', () => {
    return Requirement.create({ ...REQ_BASE, id: 701, title: 'Cancelado One', state: 'cancelado', projectId: PROJECT_ID })
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=cancelado`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(1);
        response.body[0].id.should.equal(701);
      });
  });

  // pagination still works with id ASC ordering
  it('should respect limit and skip with state-based id ASC ordering', () => {
    return Requirement.create({ ...REQ_BASE, id: 801, title: 'Analisis Page First', state: 'analisis', projectId: PROJECT_ID })
      .then(() => Requirement.create({ ...REQ_BASE, id: 802, title: 'Analisis Page Second', state: 'analisis', projectId: PROJECT_ID }))
      .then(() =>
        request(application)
          .get(`/api/opus/projects/${PROJECT_ID}/requirements?state=analisis&limit=1&skip=1`)
          .set('Authorization', 'Bearer token_01_user')
          .expect(200)
      ).then((response) => {
        response.body.should.be.an.Array().with.lengthOf(1);
        response.body[0].id.should.equal(802);
      });
  });
});
