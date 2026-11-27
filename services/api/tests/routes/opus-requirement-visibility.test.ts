import 'mocha';
import should from 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import {
  Project,
  Requirement,
  RequirementActivity,
  RequirementSubscriptor,
  RequirementVisibilityLevel,
  User,
  UserProjectPermission,
} from '@jiku/models';
import { fakeBus } from '../mocks/bus';

/**
 * El recorte por visibilidad de la superficie `/api/opus/*`.
 *
 * La superficie ya filtraba la ACTIVIDAD interna de un requisito (S-019), pero no el requisito
 * en sí: un `visibilityLevel: 'internal'` se listaba, se leía, se editaba y se comentaba desde
 * el portal de clientes. Este archivo es la red de no-regresión de ese recorte.
 *
 * Las cuatro rutas se prueban con `token_01_user` —un usuario INTERNO— a propósito: el recorte
 * es de la superficie, no del rol. Que un `user` vea todo por el bus es una decisión explícita
 * (S-023 CA-15); que lo vea en la pantalla que comparte con el cliente, no.
 *
 * El 404 sobre lo interno sigue el criterio de S-023 CA-14: "no existe" y "no lo podés ver"
 * responden exactamente lo mismo, porque distinguirlos confirma que el recurso existe.
 */
describe('Recorte por visibilidad en /api/opus/*', () => {
  let application: Application;

  const projectId = 8600;
  const publicRequirementId = 8600;
  const internalRequirementId = 8601;

  before(() => {
    application = start();

    return User.create({
      id: 'zitadel-sub-01', name: 'User Uno', username: 'user01opusvis', email: 'user01opusvis@mail.com',
    })
      .then(() => User.create({
        id: 'zitadel-sub-04', name: 'External User', username: 'ext04opusvis', email: 'ext04opusvis@mail.com',
      }))
      .then(() => Project.create({
        id: projectId, code: 'OV1', name: 'Opus Visibility Project', type: 'comercial',
        status: 'activo', priority: 1, initDate: new Date(), createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: publicRequirementId,
        title: 'Requisito publico',
        description: 'Visible en el portal',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        visibilityLevel: RequirementVisibilityLevel.Public,
        projectId,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Requirement.create({
        id: internalRequirementId,
        title: 'Requisito interno',
        description: 'NO debe salir por el portal',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'analisis',
        visibilityLevel: RequirementVisibilityLevel.Internal,
        projectId,
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId }));
  });

  after(() => {
    return RequirementSubscriptor.destroy({ where: {} })
      .then(() => RequirementActivity.destroy({ where: {} }))
      .then(() => UserProjectPermission.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: { id: projectId } }))
      .then(() => User.destroy({ where: {} }));
  });

  describe('GET /api/opus/projects/:projid/requirements', () => {
    it('deja fuera del listado el requisito interno, para un usuario interno', () => {
      return request(application)
        .get(`/api/opus/projects/${projectId}/requirements`)
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const ids = response.body.map((r: { id: number }) => r.id);
          ids.should.containEql(publicRequirementId);
          ids.should.not.containEql(internalRequirementId);
        });
    });

    it('deja fuera del listado el requisito interno, para un usuario externo', () => {
      return request(application)
        .get(`/api/opus/projects/${projectId}/requirements`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          const ids = response.body.map((r: { id: number }) => r.id);
          ids.should.containEql(publicRequirementId);
          ids.should.not.containEql(internalRequirementId);
        });
    });
  });

  describe('GET /api/opus/requirements/:reqid', () => {
    it('sirve el requisito publico', () => {
      return request(application)
        .get(`/api/opus/requirements/${publicRequirementId}`)
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.id.should.equal(publicRequirementId);
        });
    });

    it('responde 404 sobre el requisito interno, aun siendo usuario interno', () => {
      return request(application)
        .get(`/api/opus/requirements/${internalRequirementId}`)
        .set('Authorization', 'Bearer token_01_user')
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('requirement_not_found');
        });
    });

    /**
     * S-023 CA-14: las dos respuestas tienen que ser IDENTICAS —mismo codigo y mismo mensaje—
     * o el 404 del interno le confirma al cliente que ese requisito existe.
     */
    it('el 404 del interno es indistinguible del 404 de un id inexistente', () => {
      return request(application)
        .get(`/api/opus/requirements/${internalRequirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(404)
        .then((internalResponse) => {
          return request(application)
            .get('/api/opus/requirements/999999')
            .set('Authorization', 'Bearer token_04_external_user')
            .expect(404)
            .then((missingResponse) => {
              internalResponse.body.should.eql(missingResponse.body);
            });
        });
    });
  });

  describe('PATCH /api/opus/requirements/:reqid', () => {
    it('responde 404 sobre el requisito interno y no publica ningun comando', () => {
      fakeBus.reset();

      return request(application)
        .patch(`/api/opus/requirements/${internalRequirementId}`)
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'en_curso' })
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('requirement_not_found');
          // El corte va ANTES del bus: un comando publicado seria una escritura sobre algo
          // que el portal no deberia poder ni ver.
          should(fakeBus.last).be.undefined();
        });
    });
  });

  describe('POST /api/opus/requirements/:reqid/comments', () => {
    it('responde 404 sobre el requisito interno y no publica ningun comando', () => {
      fakeBus.reset();

      return request(application)
        .post(`/api/opus/requirements/${internalRequirementId}/comments`)
        .set('Authorization', 'Bearer token_01_user')
        .send({ comment: 'No deberia entrar' })
        .expect(404)
        .then((response) => {
          response.body.code.should.equal('requirement_not_found');
          should(fakeBus.last).be.undefined();
        });
    });
  });
});
