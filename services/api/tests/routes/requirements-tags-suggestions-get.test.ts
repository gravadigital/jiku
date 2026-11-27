import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, RequirementActivity, User } from '@jiku/models';

describe('GET /api/requirements/tags/suggestions', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Req con tags',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'alta',
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: [
          { key: 'tipo', value: 'bug' },
          { key: 'tipo', value: 'mejora' },
          { key: 'area', value: 'frontend' },
        ],
        createdBy: 'zitadel-sub-01',
      }));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .get('/api/requirements/tags/suggestions?projectId=1')
      .expect(401);
  });

  it('should return 400 if projectId is missing', () => {
    return request(application)
      .get('/api/requirements/tags/suggestions')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should return grouped tag suggestions by project (TS-13)', () => {
    return request(application)
      .get('/api/requirements/tags/suggestions?projectId=1')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        response.body.should.be.an.Array();
        const tipoGroup = response.body.find((g: any) => g.key === 'tipo');
        const areaGroup = response.body.find((g: any) => g.key === 'area');
        tipoGroup.should.not.be.undefined();
        tipoGroup.values.should.containDeep(['bug', 'mejora']);
        areaGroup.should.not.be.undefined();
        areaGroup.values.should.containDeep(['frontend']);
      });
  });
});
