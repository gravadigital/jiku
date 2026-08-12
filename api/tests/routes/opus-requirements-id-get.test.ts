import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, RequirementActivity, RequirementSubscriptor, User, UserProjectPermission } from '@jiku/models';

// token_04_external_user -> sub: 'zitadel-sub-04'

describe('GET /api/opus/requirements/:reqid', () => {
  let application: Application;

  const projectId = 8400;
  const requirementId = 8400;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User Uno', username: 'user01opusget', email: 'user01opusget@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External User', username: 'extuser04opusget', email: 'extopusget@mail.com' }))
      .then(() => Project.create({
        id: projectId, code: 'OG1', name: 'Opus Get Project', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: requirementId,
        title: 'Requisito opus get',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        projectId,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId }));
  });

  after(() => {
    return RequirementSubscriptor.destroy({ where: { requirementId } })
      .then(() => RequirementActivity.destroy({ where: { requirementId } }))
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: { id: requirementId } }))
      .then(() => Project.destroy({ where: { id: projectId } }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 404 if requirement does not exist', () => {
    return request(application)
      .get('/api/opus/requirements/9999')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  it('should return the requirement with createdBy as the raw creator sub', () => {
    return request(application)
      .get(`/api/opus/requirements/${requirementId}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then((response) => {
        response.body.createdBy.should.equal('zitadel-sub-01');
      });
  });

  it('should return the requirement with creator expanded to id, name and email', () => {
    return request(application)
      .get(`/api/opus/requirements/${requirementId}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then((response) => {
        response.body.creator.should.eql({
          id: 'zitadel-sub-01',
          name: 'User Uno',
          email: 'user01opusget@mail.com',
        });
      });
  });
});
