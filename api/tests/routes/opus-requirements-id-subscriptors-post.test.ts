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

  // S-034 (CA-5): esta ruta pierde el `hasAnyRole(['external-user'])` de la api. El rol `user`
  // NO estaba excluido por `core` -- solo lo estaba por ese `hasAnyRole` más estricto de la
  // api, que ya no está. `requirements.{id}.subscriptors.new` SÍ está en
  // `USER_ENVELOPE_COMMANDS` (S-030): un `user` interno suscribiéndose a sí mismo ahora llega
  // hasta el resto de la cadena -- "story migra reglas, no las inventa"
  // (core/src/authorize-caller.ts). `validatePermissionFromUserBody` es un chequeo LOCAL de
  // esta ruta, no tocado por S-034 (no es `validateProjectPermissions`): sigue exigiendo que
  // el `userId` del cuerpo tenga fila en `user_project_permissions`, así que se le crea una
  // para que el 200 se deba al cambio de rol y no a otra causa.
  it('un `user` interno ahora puede suscribirse (el hasAnyRole de la api ya no lo bloquea)', () => {
    return UserProjectPermission.create({ userId: 'zitadel-sub-01', projectId: 1 })
      .then(() => request(application)
        .post('/api/opus/requirements/1/subscriptors')
        .set('Authorization', 'Bearer token_01_user')
        .send({ userId: 'zitadel-sub-01' })
        .expect(200))
      .then((response) => {
        response.body.should.be.an.Object();
        return RequirementSubscriptor.findOne({ where: { requirementId: 1, userId: 'zitadel-sub-01' } });
      })
      .then((sub) => {
        (sub !== null).should.be.true();
      });
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

  // TS-12: sin acceso al proyecto retorna 403.
  // S-034 (CA-7) elimina `validateProjectPermissions` (el chequeo sobre EL CALLER) de esta
  // ruta, pero `validatePermissionFromUserBody` -- el chequeo LOCAL sobre el `userId` DEL
  // CUERPO, que no es `validateProjectPermissions` y no está en el alcance de esta story --
  // sigue ahí y ahora es el primero en correr. Caller y `userId` del cuerpo son la misma
  // persona en este test, así que el resultado observable (403, sin permiso) no cambia, pero
  // el `code` sí: ya no es el `access_denied` que emitía `validateProjectPermissions`, es el
  // `no_permission` de `validatePermissionFromUserBody`.
  it('TS-12: should return 403 when external user has no project permission', () => {
    return request(application)
      .post('/api/opus/requirements/1/subscriptors')
      .set('Authorization', 'Bearer token_04_external_user')
      .send({ userId: 'zitadel-sub-04' })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('no_permission');
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
