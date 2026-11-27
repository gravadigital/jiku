import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { IdentityType, Objective, ObjectiveActivity, Person, PersonObjective, Project, Requirement, User, WorkedTime } from '@jiku/models';

describe('GET /api/objectives/:id', () => {
  let application: Application;

  before(function () {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com'
    })
      .then(() => {
        return Project.create({
          id: 1,
          code: 'code1',
          name: 'Project1',
          type: 'comercial',
          description: 'Project test 1',
          status: 'activo',
          priority: 1,
          originId: 1,
          initDate: new Date(),
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'john',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          }),
          Person.create({
            id: 2,
            firstName: 'jane',
            lastName: 'doe',
            enabled: true,
            initDate: new Date()
          })
        ]);
      })
      .then(() => {
        return Objective.create({
          id: 1,
          title: 'Objective test 1',
          description: 'Objective test 1 description',
          state: 'activo',
          area: 'desarrollo',
          priority: 1,
          projectId: 1,
          createdBy: 'zitadel-sub-01'
        });
      })
      .then(() => {
        return Promise.all([
          PersonObjective.create({personId: 1, objectiveId: 1}),
          PersonObjective.create({personId: 2, objectiveId: 1, isLeader: true})
        ]);
      })
      .then(() => {
        return Promise.all([
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'state',
            previousValue: '',
            newValue: 'activo',
            objectiveId: 1
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'priority',
            previousValue: '0',
            newValue: '1',
            objectiveId: 1,
          }),
          ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'area',
            previousValue: '',
            newValue: 'desarrollo',
            objectiveId: 1,
          })
        ]);
      })
      .then(() => {
        return Promise.all([
          WorkedTime.create({
            id: 1,
            objectiveId: 1,
            projectId: 1,
            personId: 1,
            minutes: 60,
            date: new Date('2024-01-01')
          }),
          WorkedTime.create({
            id: 2,
            objectiveId: 1,
            projectId: 1,
            personId: 1,
            minutes: 90,
            date: new Date('2024-01-02')
          }),
        ]);
      });
  });

  after(() => {
    return Objective.destroy({where: {}})
      .then(() => {
        return Project.destroy({where: {}});
      })
      .then(() => {
        return Person.destroy({where: {}});
      })
      .then(() => {
        return PersonObjective.destroy({where: {}});
      })
      .then(() => {
        return ObjectiveActivity.destroy({where: {}});
      })
      .then(() => {
        return User.destroy({where: {}});
      })
      .then(() => {
        return WorkedTime.destroy({where: {}});
      });
  });

  it('should fail with incorrect id', () => {
    return request(application)
      .get('/api/objectives/4')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('objective_not_found');
        response.body.message.should.equal('Objective not found');
      });
  });

  it('should get a objective by id 1', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        const expectedObject =
          {
            id: 1,
            title: 'Objective test 1',
            description: 'Objective test 1 description',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            project: {name: 'Project1'},
            creator: {name: 'User 01'},
            workedMinutes: 150,
            persons: [
              {firstName: 'jane', lastName: 'doe'},
              {firstName: 'john', lastName: 'doe'}
            ],
            ObjectiveActivity: [
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'state', previousValue: '', newValue: 'activo', user: {name: 'User 01'}},
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'priority', previousValue: '0', newValue: '1', user: {name: 'User 01'}},
              {changedBy: 'zitadel-sub-01', typeOfActivity: 'area', previousValue: '', newValue: 'desarrollo', user: {name: 'User 01'}},
            ]
          };
        response.body.should.containDeep(expectedObject);
      });
  });

  // CA-12 (S-015) + CA-1 (S-019): acota los DOS `include` de `User` de esta ruta -- `creator`
  // y el `user` de cada `ObjectiveActivity` -- a cuatro campos. La asercion es sobre las CLAVES
  // PRESENTES, no sobre la ausencia de `roles`: un `should.not.have.property('roles')` pasaria
  // igual el dia que se agregue otra columna al modelo.
  //
  // El 3 paso a 4 por S-019: el cuarto campo es `identityType`, y `roles` sigue afuera.
  // La MISMA lista alimenta el historial y los comentarios de `detalle-tarea` (el front la
  // parte filtrando por `typeOfActivity === 'comment'`), asi que esta asercion cubre los dos
  // lugares que pide CA-5.
  it('S-019 TS-7: should return creator and every activity user with exactly the four keys', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        Object.keys(response.body.creator).should.have.length(4);
        response.body.creator.should.have.property('id');
        response.body.creator.should.have.property('name');
        response.body.creator.should.have.property('email');
        response.body.creator.identityType.should.equal('person');

        const activities = response.body.ObjectiveActivity;
        activities.should.be.an.Array();
        activities.length.should.be.above(0);
        activities.forEach((activity: { user: Record<string, unknown> }) => {
          Object.keys(activity.user).should.have.length(4);
          activity.user.should.have.property('id');
          activity.user.should.have.property('name');
          activity.user.should.have.property('email');
          activity.user.should.have.property('identityType');
        });
      });
  });

  // S-019 TS-9: `roles` es el campo que NO puede salir (D-12 de REQ-005). La unica barrera es
  // el `attributes` acotado del `include`.
  it('S-019 TS-9: should not leak roles nor username in creator nor in any activity user', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        Object.keys(response.body.creator).should.not.containEql('roles');
        Object.keys(response.body.creator).should.not.containEql('username');
        response.body.ObjectiveActivity.forEach((activity: { user: Record<string, unknown> }) => {
          Object.keys(activity.user).should.not.containEql('roles');
          Object.keys(activity.user).should.not.containEql('username');
        });
      });
  });

  /**
   * S-019 CA-5: el autor de un COMENTARIO de una identidad automatica se marca.
   *
   * Fixture propia, con el patron del describe de S-010 de mas abajo: las tres actividades que
   * arma el `before` del archivo son de tipo state / priority / area, y hace falta una de tipo
   * `comment` con un autor de servicio.
   */
  describe('S-019: el comentario de una identidad automatica', () => {
    let serviceCommentId: number;

    before(() => {
      return User.create({
        id: 'zitadel-sub-svc',
        name: 'Conector Portal',
        username: 'conector-portal',
        email: 'conector@portal.test',
        identityType: IdentityType.Service,
      })
        .then(() => ObjectiveActivity.create({
          changedBy: 'zitadel-sub-svc',
          typeOfActivity: 'comment',
          previousValue: '',
          newValue: 'Sincronizado desde el portal',
          objectiveId: 1,
        }))
        .then((activity) => {
          serviceCommentId = activity.id;
        });
    });

    after(() => {
      return ObjectiveActivity.destroy({ where: { id: serviceCommentId } })
        .then(() => User.destroy({ where: { id: 'zitadel-sub-svc' } }));
    });

    // CA-11: la marca acompaña al nombre, no lo reemplaza.
    it('S-019 TS-8: should mark the service author of a comment and keep its name', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const comment = response.body.ObjectiveActivity
            .find((activity: any) => activity.id === serviceCommentId);
          comment.typeOfActivity.should.equal('comment');
          comment.user.identityType.should.equal('service');
          comment.user.name.should.equal('Conector Portal');
        });
    });
  });

  // TS-17: objective sin vinculo expone requirementId null
  it('TS-17: should expose requirementId as null when objective has no linked requirement', () => {
    return request(application)
      .get('/api/objectives/1')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        (response.body.requirementId === null).should.be.true();
      });
  });

  describe('requirementId en detalle (S-060, TS-16)', () => {
    before(() => {
      return Requirement.create({
        id: 80,
        title: 'Requisito vinculado a detalle',
        description: 'Desc',
        type: 'funcionalidad',
        state: 'analisis',
        projectId: 1,
        createdBy: 'zitadel-sub-01',
      })
        .then(() => Objective.update({ requirementId: 80 }, { where: { id: 1 } }));
    });

    after(() => {
      return Objective.update({ requirementId: null }, { where: { id: 1 } })
        .then(() => Requirement.destroy({ where: { id: 80 } }));
    });

    it('TS-16: should expose requirementId in objective detail when linked', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.requirementId.should.equal(80);
        });
    });
  });

  /**
   * S-010: la respuesta deja de traer las 9 claves de la integración con sistemas externos.
   *
   * La aserción es sobre `Object.keys(...)` y no sobre `res.body.externalUrl === undefined`:
   * lo segundo pasa igual si la clave existe con valor `undefined`, y lo que hay que verificar
   * es que la clave NO ESTÁ en el JSON.
   */
  describe('S-010: la integración con sistemas externos no viaja en la respuesta', () => {
    const OBJECTIVE_INTEGRATION_KEYS = [
      'externalProjectId',
      'externalIssueId',
      'externalIssueKey',
      'externalUrl',
      'externalRawData',
      'lastSyncedAt',
    ];
    const ACTIVITY_INTEGRATION_KEYS = [
      'externalReferenceUrl',
      'externalUserName',
      'externalUserId',
    ];

    let commentId: number;

    // Fixture propia: TS-10 necesita una actividad de tipo `comment`, y las que arma el
    // `before` del archivo son de tipo state / priority / area.
    before(() => {
      return ObjectiveActivity.create({
        changedBy: 'zitadel-sub-01',
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'un comentario',
        objectiveId: 1,
      }).then((activity) => {
        commentId = activity.id;
      });
    });

    after(() => {
      return ObjectiveActivity.destroy({ where: { id: commentId } });
    });

    it('TS-9: el objetivo no expone ninguna de las 6 claves de la integración', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const keys = Object.keys(response.body);
          OBJECTIVE_INTEGRATION_KEYS.forEach((key) => {
            keys.should.not.containEql(key);
          });
          ['id', 'title', 'state', 'area', 'priority', 'visibilityLevel', 'projectId', 'createdBy', 'workedMinutes'].forEach((key) => {
            keys.should.containEql(key);
          });
        });
    });

    it('TS-10: las actividades no exponen ninguna de las 3 claves de la integración', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const activities = response.body.ObjectiveActivity;
          activities.should.be.an.Array();
          activities.length.should.be.above(0);
          activities.some((a: any) => a.typeOfActivity === 'comment').should.be.true();
          activities.forEach((activity: any) => {
            const keys = Object.keys(activity);
            ACTIVITY_INTEGRATION_KEYS.forEach((key) => {
              keys.should.not.containEql(key);
            });
            ['typeOfActivity', 'previousValue', 'newValue', 'visibilityLevel', 'user'].forEach((key) => {
              keys.should.containEql(key);
            });
          });
        });
    });
  });

  /**
   * S-047 (CA-7): la lectura interna expone `editedAt`/`editedBy` sin código nuevo, porque el
   * handler serializa el modelo completo con `toJSON()` en vez de armar una proyección campo
   * por campo — las columnas ya existen en el modelo desde S-046. Este bloque es de
   * VERIFICACIÓN: fija que la lectura sigue exponiéndolos, y que un comentario no editado
   * expone los dos campos en null (presentes, no ausentes).
   */
  describe('S-047: editedAt/editedBy en la lectura interna (CA-7)', () => {
    let editedCommentId: number;
    let plainCommentId: number;

    before(() => {
      return ObjectiveActivity.create({
        changedBy: 'zitadel-sub-01',
        typeOfActivity: 'comment',
        previousValue: '',
        newValue: 'Comentario editado',
        objectiveId: 1,
        editedAt: new Date(),
        editedBy: 'zitadel-sub-01',
      })
        .then((activity) => {
          editedCommentId = activity.id;
          return ObjectiveActivity.create({
            changedBy: 'zitadel-sub-01',
            typeOfActivity: 'comment',
            previousValue: '',
            newValue: 'Comentario sin editar',
            objectiveId: 1,
          });
        })
        .then((activity) => {
          plainCommentId = activity.id;
        });
    });

    after(() => {
      return ObjectiveActivity.destroy({ where: { id: [editedCommentId, plainCommentId] } });
    });

    // TS-24: la actividad editada expone los dos campos con valor.
    it('TS-24: expone editedAt y editedBy en una actividad editada', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const activity = response.body.ObjectiveActivity
            .find((a: any) => a.id === editedCommentId);
          (activity.editedAt !== null).should.be.true();
          activity.editedBy.should.equal('zitadel-sub-01');
        });
    });

    // TS-25: un comentario NO editado expone editedAt/editedBy en null, no ausentes — el front
    // distingue "no editado" de "campo que no llegó".
    it('TS-25: un comentario no editado expone editedAt y editedBy en null', () => {
      return request(application)
        .get('/api/objectives/1')
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          const activity = response.body.ObjectiveActivity
            .find((a: any) => a.id === plainCommentId);
          activity.should.have.property('editedAt', null);
          activity.should.have.property('editedBy', null);
        });
    });
  });
});
