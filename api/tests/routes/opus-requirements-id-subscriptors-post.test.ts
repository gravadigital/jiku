import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Project, Requirement, RequirementSubscriptor, User, UserProjectPermission } from '@jiku/models';

// token_04_external_user -> sub: 'zitadel-sub-04'

describe('POST /api/opus/requirements/:reqid/subscriptors', () => {
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
      }));
    // No se crea UserProjectPermission aquí — se agrega selectivamente en los tests que lo necesitan
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
      .post('/api/opus/requirements/1/subscriptors')
      .send({ userId: 'zitadel-sub-04' })
      .expect(401);
  });

  it('should return 403 for internal user role', () => {
    return request(application)
      .post('/api/opus/requirements/1/subscriptors')
      .set('Authorization', 'Bearer token_01_user')
      .send({ userId: 'zitadel-sub-01' })
      .expect(403);
  });

  it('should return 404 if requirement does not exist', () => {
    return request(application)
      .post('/api/opus/requirements/9999/subscriptors')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ userId: 'zitadel-sub-04' })
      .expect(404)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  // TS-12: sin acceso al proyecto retorna 403
  it('TS-12: should return 403 when external user has no project permission', () => {
    return request(application)
      .post('/api/opus/requirements/1/subscriptors')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ userId: 'zitadel-sub-04' })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-10: suscripción exitosa (con permiso creado)
  it('TS-10: should subscribe external user to requirement and return 200', () => {
    return UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId: 1 })
      .then(() => {
        return request(application)
          .post('/api/opus/requirements/1/subscriptors')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ userId: 'zitadel-sub-04' })
          .expect(200);
      })
      .then((response) => {
        response.body.should.be.an.Object();
        return RequirementSubscriptor.findOne({ where: { requirementId: 1, userId: 'zitadel-sub-04' } });
      })
      .then((sub) => {
        (sub !== null).should.be.true();
        sub!.requirementId.should.equal(1);
        sub!.userId.should.equal('zitadel-sub-04');
      });
  });

  // TS-11: suscripción duplicada retorna 400
  it('TS-11: should return 400 when user is already subscribed', () => {
    return request(application)
      .post('/api/opus/requirements/1/subscriptors')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ userId: 'zitadel-sub-04' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('already_subscribed');
      });
  });
});
