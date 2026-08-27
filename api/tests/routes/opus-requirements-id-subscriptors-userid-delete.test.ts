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

  // S-034 (CA-5): esta ruta pierde el `hasAnyRole(['external-user'])` de la api. El 403 se
  // mantiene, pero ahora sale de `core`: `requirements.{id}.subscriptors.{userId}.delete` no
  // está en `USER_ENVELOPE_COMMANDS` (ni en ningún rol interno) -- ver el comentario de
  // `authorize-caller.ts`, "un admin NO PUEDE desuscribir a nadie por HTTP hoy" -- así que
  // `authorizeWithRoles` lo rechaza con `caller_not_authorized`, no con el `access_denied` que
  // emitía el `hasAnyRole` de la api. Hace falta una fila de suscripción previa: sin ella,
  // `validateSubscriptionExists` (chequeo LOCAL, no tocado por S-034) corta antes con 404 y
  // el comando nunca llega a publicarse -- ahí el rechazo de `core` no sería alcanzable.
  it('should return 403 for internal user role', () => {
    return RequirementSubscriptor.create({ requirementId: 1, userId: 'zitadel-sub-01' })
      .then(() => request(application)
        .delete('/api/opus/requirements/1/subscriptors/zitadel-sub-01')
        .set('Authorization', 'Bearer token_01_user')
        .expect(403))
      .then((response) => {
        response.body.code.should.equal('caller_not_authorized');
      });
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
