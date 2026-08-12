import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, RequirementSubscriptor, User, UserProjectPermission } from '@jiku/models';

// token_04_external_user -> sub: 'zitadel-sub-04'

describe('DELETE /api/opus/requirements/:reqid/subscriptors/:userId', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'External 04', username: 'ext04', email: 'ext04@mail.com' }))
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Requirement.create({
        id: 1,
        title: 'Req analisis',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        estimatedFinishDate: '2026-06-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 1 }))
      .then(() => RequirementSubscriptor.create({ requirementId: 1, userId: 'zitadel-sub-04' }));
  });

  after(() => {
    return RequirementSubscriptor.destroy({ where: {} })
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .delete('/api/opus/requirements/1/subscriptors/zitadel-sub-04')
      .expect(401);
  });

  it('should return 403 for internal user role', () => {
    return request(application)
      .delete('/api/opus/requirements/1/subscriptors/zitadel-sub-01')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403);
  });

  // TS-14: userId distinto al autenticado retorna 403
  it('TS-14: should return 403 when userId in path does not match authenticated user', () => {
    return request(application)
      .delete('/api/opus/requirements/1/subscriptors/otro-user-id')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-15: suscripción inexistente retorna 404
  it('TS-15: should return 404 when subscription does not exist', () => {
    return RequirementSubscriptor.destroy({ where: {} })
      .then(() => {
        return request(application)
          .delete('/api/opus/requirements/1/subscriptors/zitadel-sub-04')
          .set('Authorization', 'Bearer token_04_external_user')
          .expect(404);
      })
      .then((response) => {
        response.body.code.should.equal('subscription_not_found');
      });
  });

  // TS-13: desuscripción exitosa retorna 200
  it('TS-13: should delete subscription and return 200', () => {
    return RequirementSubscriptor.create({ requirementId: 1, userId: 'zitadel-sub-04' })
      .then(() => {
        return request(application)
          .delete('/api/opus/requirements/1/subscriptors/zitadel-sub-04')
          .set('Authorization', 'Bearer token_04_external_user')
          .expect(200);
      })
      .then(() => {
        return RequirementSubscriptor.findOne({ where: { requirementId: 1, userId: 'zitadel-sub-04' } });
      })
      .then((sub) => {
        (sub === null).should.be.true();
      });
  });
});
