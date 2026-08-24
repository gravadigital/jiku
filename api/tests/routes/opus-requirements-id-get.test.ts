import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { IdentityType, Project, Requirement, RequirementActivity, RequirementSubscriptor, User, UserProjectPermission, VisibilityLevel } from '@jiku/models';

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
      .then(() => UserProjectPermission.create({ userId: 'zitadel-sub-04', projectId }))
      // S-019: la identidad automatica. Sin esta fila ningun payload diria `service` y la
      // suite cubriria un solo valor de los dos.
      .then(() => User.create({
        id: 'zitadel-sub-svc',
        name: 'Conector Portal',
        username: 'conector-portal',
        email: 'conector@portal.test',
        identityType: IdentityType.Service,
      }));
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

  /**
   * S-019 CA-7: el `eql` es ESTRICTO a proposito.
   *
   * Este handler NO serializa el modelo: `sendResponse` arma la respuesta campo por campo, asi
   * que sumar `identityType` al `include` no cambia un byte de lo que sale. Este deep-equal es
   * la asercion que atrapa que alguien toque el `include` y se olvide de la proyeccion a mano
   * (o al reves).
   */
  it('S-019 TS-15: should return the requirement creator with the four author keys', () => {
    return request(application)
      .get(`/api/opus/requirements/${requirementId}`)
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(200)
      .then((response) => {
        response.body.creator.should.eql({
          id: 'zitadel-sub-01',
          name: 'User Uno',
          email: 'user01opusget@mail.com',
          identityType: 'person',
        });
      });
  });

  describe('S-019: el autor del feed, los suscriptores y el filtro de visibilidad', () => {
    let publicActivityId: number;
    let internalActivityId: number;

    before(() => {
      return RequirementActivity.create({
        requirementId,
        typeOfActivity: 'state',
        previousValue: '',
        newValue: 'analisis',
        visibilityLevel: VisibilityLevel.Public,
        changedBy: 'zitadel-sub-svc',
      })
        .then((activity) => {
          publicActivityId = activity.id;
          // La actividad `internal` es la red de no-regresion de ADR-006: agregar un campo a la
          // autoria no debe abrir el filtro de visibilidad del portal.
          return RequirementActivity.create({
            requirementId,
            typeOfActivity: 'title',
            previousValue: 'Antes',
            newValue: 'Despues',
            visibilityLevel: VisibilityLevel.Internal,
            changedBy: 'zitadel-sub-svc',
          });
        })
        .then((activity) => {
          internalActivityId = activity.id;
          return RequirementSubscriptor.create({ requirementId, userId: 'zitadel-sub-04' });
        });
    });

    after(() => {
      return RequirementSubscriptor.destroy({ where: { requirementId } })
        .then(() => RequirementActivity.destroy({ where: { requirementId } }));
    });

    it('S-019 TS-16: should return every feed author with the four author keys', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          response.body.requirementActivity.should.be.an.Array();
          response.body.requirementActivity.length.should.be.above(0);
          response.body.requirementActivity.forEach((entry: { user: Record<string, unknown> }) => {
            Object.keys(entry.user).should.have.length(4);
            entry.user.should.have.property('id');
            entry.user.should.have.property('name');
            entry.user.should.have.property('email');
            entry.user.should.have.property('identityType');
          });
          const serviceEntry = response.body.requirementActivity
            .find((entry: any) => entry.id === publicActivityId);
          serviceEntry.user.identityType.should.equal('service');
          serviceEntry.user.name.should.equal('Conector Portal');
        });
    });

    // `subscriptors` es un SELECTOR, no una autoria: un service user no tiene por que estar
    // suscripto, y la marca no tiene donde ir en una lista de destinatarios. Si este test
    // empieza a fallar con 4 claves, alguien agrego el campo por simetria con los payloads de
    // autoria: no es simetrico.
    it('S-019 TS-17: should keep subscriptors at exactly three keys', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          response.body.subscriptors.should.be.an.Array();
          response.body.subscriptors.length.should.be.above(0);
          response.body.subscriptors.forEach((subscriptor: Record<string, unknown>) => {
            Object.keys(subscriptor).should.have.length(3);
            subscriptor.should.have.property('id');
            subscriptor.should.have.property('name');
            subscriptor.should.have.property('email');
            Object.keys(subscriptor).should.not.containEql('identityType');
          });
        });
    });

    // Es la superficie de `external-user`, la menos confiable: `roles` no puede salir por
    // ninguno de los TRES objetos de usuario de esta respuesta.
    it('S-019 TS-18: should not leak roles in creator, feed authors nor subscriptors', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          Object.keys(response.body.creator).should.not.containEql('roles');
          response.body.requirementActivity.forEach((entry: { user: Record<string, unknown> }) => {
            Object.keys(entry.user).should.not.containEql('roles');
          });
          response.body.subscriptors.forEach((subscriptor: Record<string, unknown>) => {
            Object.keys(subscriptor).should.not.containEql('roles');
          });
        });
    });

    // ADR-006: el portal solo ve actividad `public`. Agregar `identityType` no toca el filtro.
    it('S-019 TS-19: should keep internal activity out of the portal response', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          response.body.requirementActivity
            .map((entry: { id: number }) => entry.id)
            .should.not.containEql(internalActivityId);
        });
    });
  });
});
