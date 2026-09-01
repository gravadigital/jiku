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

  /**
   * S-047 (CA-8, CA-9): TEST DE REGRESIÓN sobre la proyección de opus.
   *
   * `opus-requirements-id-get.ts` arma la respuesta campo por campo, y por eso NUNCA agrega
   * `editedAt`/`editedBy`: no es un filtro que pueda olvidarse, es un campo que nunca se
   * escribe. Este test es lo único que fija esa ausencia — si alguien "simplifica" la
   * proyección serializando el modelo completo (`toJSON()`), este test es el que tiene que
   * fallar. El fixture escribe `editedAt`/`editedBy` directo con el modelo (sin pasar por el
   * bus): esto es sobre la LECTURA, no sobre la edición.
   */
  describe('S-047: la proyección de opus nunca expone editedAt/editedBy (CA-8, CA-9)', () => {
    let publicEditedId: number;
    let internalEditedId: number;

    before(() => {
      return RequirementActivity.create({
        requirementId,
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'Comentario público editado',
        visibilityLevel: VisibilityLevel.Public,
        changedBy: 'zitadel-sub-01',
        editedAt: new Date(),
        editedBy: 'zitadel-sub-01',
      })
        .then((activity) => {
          publicEditedId = activity.id;
          // La actividad `internal` editada es la red de no-regresión: la ausencia de
          // editedAt/editedBy no puede depender de que el filtro de visibilidad la excluya —
          // tiene que estar ausente aunque la actividad SÍ llegara a la respuesta.
          return RequirementActivity.create({
            requirementId,
            typeOfActivity: 'comment',
            previousValue: '',
            newValue: 'Comentario interno editado',
            visibilityLevel: VisibilityLevel.Internal,
            changedBy: 'zitadel-sub-01',
            editedAt: new Date(),
            editedBy: 'zitadel-sub-01',
          });
        })
        .then((activity) => {
          internalEditedId = activity.id;
        });
    });

    after(() => {
      return RequirementActivity.destroy({ where: { requirementId } });
    });

    // TS-26: un comentario public editado, leído por un external-user con permiso: ninguna
    // actividad de la respuesta expone editedAt ni editedBy.
    it('TS-26: no expone editedAt ni editedBy en un comentario public editado', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          response.body.requirementActivity.should.be.an.Array();
          response.body.requirementActivity.length.should.be.above(0);
          response.body.requirementActivity.forEach((entry: Record<string, unknown>) => {
            entry.should.not.have.property('editedAt');
            entry.should.not.have.property('editedBy');
          });
        });
    });

    // TS-27: mezcla de una actividad public editada y una internal editada. La internal ni
    // siquiera aparece (ADR-006); la ausencia de editedAt/editedBy en la public no depende de
    // la visibilidad.
    it('TS-27: la ausencia no depende de la visibilidad, y lo internal sigue filtrado', () => {
      return request(application)
        .get(`/api/opus/requirements/${requirementId}`)
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(200)
        .then((response) => {
          const ids = response.body.requirementActivity.map((entry: { id: number }) => entry.id);
          ids.should.containEql(publicEditedId);
          ids.should.not.containEql(internalEditedId);

          response.body.requirementActivity.forEach((entry: Record<string, unknown>) => {
            entry.should.not.have.property('editedAt');
            entry.should.not.have.property('editedBy');
          });
        });
    });
  });
});
