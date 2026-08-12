import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, Person, PersonRequirement, Project, Requirement, RequirementActivity, RetentionStatus, User } from '@jiku/models';

describe('PATCH /api/requirements/:reqid', () => {
  let application: Application;

  before(() => {
    application = start();

    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Promise.all([
        Requirement.create({
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
        }),
        Requirement.create({
          id: 2,
          title: 'Req revision',
          description: 'Desc',
          type: 'mejora',
          priority: 'baja',
          state: 'revision',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 3,
          title: 'Req resuelto',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'resuelto',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 4,
          title: 'Req cancelado',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'media',
          state: 'cancelado',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 5,
          title: 'Req analisis para timestamp test',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'media',
          state: 'analisis',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          scheduledAt: null,
          inProgressAt: null,
          inReviewAt: null,
          finishedAt: null,
        }),
      ]));
  });

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  it('should return 401 if no token is provided', () => {
    return request(application)
      .patch('/api/requirements/1')
      .send({ title: 'Nuevo titulo' })
      .expect(401);
  });

  it('should return 404 when requirement does not exist', () => {
    return request(application)
      .patch('/api/requirements/9999')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Test' })
      .expect(404);
  });

  // TS-18 (S-064): valor de state inválido retorna 400 invalid_fields
  it('TS-18: should return 400 invalid_fields if state is not a valid enum value', () => {
    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'estado_invalido' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-1 (S-064): transición a en_cola aceptada
  it('TS-1: should accept transition to en_cola', () => {
    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'en_cola' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('en_cola');
      });
  });

  // TS-6 (legacy numbering): transición analisis → planificacion registra scheduledAt y actividad
  it('should transition analisis to planificacion, set scheduledAt and register activity', () => {
    return request(application)
      .patch('/api/requirements/5')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'planificacion' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('planificacion');
        (response.body.scheduledAt !== null).should.be.true();
        return RequirementActivity.findOne({ where: { requirementId: 5, typeOfActivity: 'state' } });
      })
      .then((activity) => {
        activity!.previousValue.should.equal('analisis');
        activity!.newValue.should.equal('planificacion');
        activity!.visibilityLevel.should.equal('public');
      });
  });

  // TS-2 (legacy numbering): transición analisis → cancelado es válida
  it('should allow transition from analisis to cancelado', () => {
    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'cancelado' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('cancelado');
      });
  });

  // TS-5 (S-064): retroceso desde revision ya no está bloqueado
  it('TS-5: should allow transition from revision to planificacion (no longer blocked)', () => {
    return request(application)
      .patch('/api/requirements/2')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'planificacion' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('planificacion');
      });
  });

  // transición revision → resuelto registra finishedAt (legacy, no confundir con TS-13 de S-064)
  it('should allow revision to resuelto and set finishedAt', () => {
    return Requirement.create({
      id: 60,
      title: 'Req revision para finishedAt',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'media',
      state: 'revision',
      estimatedFinishDate: '2026-06-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/60')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('resuelto');
      (response.body.finishedAt !== null).should.be.true();
    });
  });

  // TS-3 (S-064): reapertura desde resuelto
  it('TS-3: should allow reopening a requirement from resuelto', () => {
    return request(application)
      .patch('/api/requirements/3')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'desarrollo' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('desarrollo');
      });
  });

  // TS-4 (S-064): reapertura desde cancelado
  it('TS-4: should allow reopening a requirement from cancelado', () => {
    return request(application)
      .patch('/api/requirements/4')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'analisis' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('analisis');
      });
  });

  // TS-7: retroceso no sobreescribe scheduledAt
  it('TS-7: should not overwrite scheduledAt on re-entering planificacion', () => {
    let firstScheduledAt: string;

    // req id 5 fue transicionado a planificacion en TS-6, scheduledAt está seteado
    return request(application)
      .get('/api/requirements/5')
      .set('Authorization', 'Bearer token_01_user')
      .expect(200)
      .then((response) => {
        firstScheduledAt = response.body.scheduledAt;
        (firstScheduledAt !== null).should.be.true();
        // Retroceder a analisis
        return request(application)
          .patch('/api/requirements/5')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'analisis' })
          .expect(200);
      })
      .then(() => {
        // Volver a planificacion
        return request(application)
          .patch('/api/requirements/5')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'planificacion' })
          .expect(200);
      })
      .then((response) => {
        response.body.scheduledAt.should.equal(firstScheduledAt);
      });
  });

  // TS-1: valor planificacion aceptado por BD (model-level)
  it('TS-1: should save requirement with state planificacion without error', () => {
    return Requirement.create({
      id: 10,
      title: 'Req planificacion model',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'planificacion',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then((req) => {
      req.state.should.equal('planificacion');
    });
  });

  // TS-2: valor resuelto aceptado por BD (model-level)
  it('TS-2: should save requirement with state resuelto without error', () => {
    return Requirement.create({
      id: 11,
      title: 'Req resuelto model',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'resuelto',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then((req) => {
      req.state.should.equal('resuelto');
    });
  });

  // TS-5: transición planificacion → desarrollo válida, registra actividad
  it('TS-5: should allow planificacion to desarrollo and register activity', () => {
    return Requirement.create({
      id: 12,
      title: 'Req para TS-5',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'planificacion',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/12')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'desarrollo' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('desarrollo');
      return RequirementActivity.findOne({ where: { requirementId: 12, typeOfActivity: 'state' } });
    }).then((activity) => {
      activity!.previousValue.should.equal('planificacion');
      activity!.newValue.should.equal('desarrollo');
      activity!.visibilityLevel.should.equal('public');
    });
  });

  // TS-2 (S-064): transición libre revision → analisis ya no bloqueada
  it('TS-2: should allow transition from revision to analisis (free transition)', () => {
    return Requirement.create({
      id: 13,
      title: 'Req revision para TS-2',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'revision',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/13')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'analisis' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('analisis');
    });
  });

  describe('resolución de incidencias (S-082)', () => {
    before(() => {
      return User.create({ id: 'zitadel-sub-04', name: 'User 04', username: 'user04', email: 'user04@mail.com' });
    });

    after(() => {
      return User.destroy({ where: { id: 'zitadel-sub-04' } });
    });

    // TS-12 (S-066): regla de resolution_required sin cambios para incidencia creada en en_cola
    it('TS-12: should return 400 resolution_required for an incidencia created in en_cola without type/conclusion', () => {
      return Requirement.create({
        id: 27,
        title: 'Incidencia en_cola TS-12',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'en_cola',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: null,
        resolutionConclusion: null,
      }).then(() =>
        request(application)
          .patch('/api/requirements/27')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
      });
    });

    // TS-1: resolver incidencia persiste los 3 campos sin crear activity de resolución
    it('TS-1: should persist resolutionType, resolutionConclusion and resolutionComment without creating a resolution activity', () => {
      return Requirement.create({
        id: 70,
        title: 'Incidencia TS-1',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        estimatedFinishDate: '2026-07-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/70')
          .set('Authorization', 'Bearer token_01_user')
          .send({
            state: 'resuelto',
            resolutionType: 'error_interno',
            resolutionConclusion: 'Se corrigió el bug en el endpoint X',
            resolutionComment: 'El problema fue resuelto, gracias por reportarlo',
          })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
        response.body.resolutionType.should.equal('error_interno');
        response.body.resolutionConclusion.should.equal('Se corrigió el bug en el endpoint X');
        response.body.resolutionComment.should.equal('El problema fue resuelto, gracias por reportarlo');
        (response.body.finishedAt !== null).should.be.true();
        return RequirementActivity.count({ where: { requirementId: 70, typeOfActivity: 'resolution' } });
      }).then((count) => {
        count.should.equal(0);
      });
    });

    // TS-2: resolutionComment editable con requisito en resuelto
    it('TS-2: should allow editing resolutionComment on a resuelto requirement', () => {
      return Requirement.create({
        id: 71,
        title: 'Incidencia TS-2',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'resuelto',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionComment: 'nota vieja',
      }).then(() =>
        request(application)
          .patch('/api/requirements/71')
          .set('Authorization', 'Bearer token_01_user')
          .send({ resolutionComment: 'nota nueva' })
          .expect(200)
      ).then((response) => {
        response.body.resolutionComment.should.equal('nota nueva');
      });
    });

    // TS-3: resolutionConclusion editable con requisito en cancelado
    it('TS-3: should allow editing resolutionConclusion on a cancelado requirement', () => {
      return Requirement.create({
        id: 72,
        title: 'Incidencia TS-3',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'cancelado',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionConclusion: 'texto viejo',
      }).then(() =>
        request(application)
          .patch('/api/requirements/72')
          .set('Authorization', 'Bearer token_01_user')
          .send({ resolutionConclusion: 'texto nuevo' })
          .expect(200)
      ).then((response) => {
        response.body.resolutionConclusion.should.equal('texto nuevo');
      });
    });

    // TS-4: gate exige ambos campos - ninguno cargado
    it('TS-4: should return 400 resolution_required when resolving incidencia without type nor conclusion', () => {
      return Requirement.create({
        id: 73,
        title: 'Incidencia TS-4',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        estimatedFinishDate: '2026-07-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: null,
        resolutionConclusion: null,
      }).then(() =>
        request(application)
          .patch('/api/requirements/73')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
        return Requirement.findByPk(73);
      }).then((req) => {
        req!.state.should.equal('desarrollo');
      });
    });

    // TS-5: gate rechaza si falta resolutionConclusion
    it('TS-5: should return 400 resolution_required when resolutionConclusion is missing', () => {
      return Requirement.create({
        id: 74,
        title: 'Incidencia TS-5',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'revision',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: 'error_interno',
        resolutionConclusion: null,
      }).then(() =>
        request(application)
          .patch('/api/requirements/74')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
      });
    });

    // TS-6: gate rechaza si falta resolutionType
    it('TS-6: should return 400 resolution_required when resolutionType is missing', () => {
      return Requirement.create({
        id: 75,
        title: 'Incidencia TS-6',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'revision',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: null,
        resolutionConclusion: 'texto ya cargado',
      }).then(() =>
        request(application)
          .patch('/api/requirements/75')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
      });
    });

    // TS-7: gate satisfecho con un campo ya cargado y el otro en el mismo PATCH
    it('TS-7: should resolve incidencia combining already-set field with field sent in the same PATCH', () => {
      return Requirement.create({
        id: 76,
        title: 'Incidencia TS-7',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'revision',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: 'otro',
        resolutionConclusion: null,
      }).then(() =>
        request(application)
          .patch('/api/requirements/76')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto', resolutionConclusion: 'conclusión final' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
      });
    });

    // TS-8: otros tipos de requisito no exigen los campos
    it('TS-8: should resolve non-incidencia requirement without type nor conclusion', () => {
      return Requirement.create({
        id: 77,
        title: 'Funcionalidad TS-8',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'media',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/77')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
      });
    });

    // TS-9: external-user no puede editar resolutionComment
    it('TS-9: should reject external-user editing resolutionComment', () => {
      return Requirement.create({
        id: 78,
        title: 'Incidencia TS-9',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/78')
          .set('Authorization', 'Bearer token_04_external_user')
          .send({ resolutionComment: 'intento externo' })
          .expect(403)
      ).then((response) => {
        response.body.code.should.equal('access_denied');
      });
    });

    // TS-10: external-user no puede editar resolutionType/resolutionConclusion
    it('TS-10: should reject external-user editing resolutionType and resolutionConclusion', () => {
      return request(application)
        .patch('/api/requirements/78')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ resolutionType: 'otro', resolutionConclusion: 'x' })
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
        });
    });

    // TS-13: resolutionConclusion acepta texto libre (ya no enum)
    it('TS-13: should accept free text for resolutionConclusion', () => {
      return Requirement.create({
        id: 79,
        title: 'Incidencia TS-13',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/79')
          .set('Authorization', 'Bearer token_01_user')
          .send({ resolutionConclusion: 'Cualquier texto libre, no restringido a los 5 valores del enum viejo' })
          .expect(200)
      ).then((response) => {
        response.body.resolutionConclusion.should.equal('Cualquier texto libre, no restringido a los 5 valores del enum viejo');
      });
    });

    // TS-14: resolutionType rechaza valor fuera del enum
    it('TS-14: should return 400 invalid_fields when resolutionType is not a valid enum value', () => {
      return request(application)
        .patch('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .send({ resolutionType: 'valor_invalido' })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    // TS-15: limpiar resolutionComment con null explícito
    it('TS-15: should allow clearing resolutionComment with explicit null', () => {
      return Requirement.create({
        id: 80,
        title: 'Incidencia TS-15',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionComment: 'nota',
      }).then(() =>
        request(application)
          .patch('/api/requirements/80')
          .set('Authorization', 'Bearer token_01_user')
          .send({ resolutionComment: null })
          .expect(200)
      ).then((response) => {
        (response.body.resolutionComment === null).should.be.true();
      });
    });

    // TS-10 (S-064, sin cambios): PATCH sin resolutionComment no crea actividad de resolución
    it('should not create a resolution activity when resolutionComment is not sent', () => {
      return Requirement.create({
        id: 26,
        title: 'Incidencia TS-10-legacy',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        estimatedFinishDate: '2026-07-01',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/26')
          .set('Authorization', 'Bearer token_01_user')
          .send({ title: 'Nuevo título' })
          .expect(200)
      ).then(() =>
        RequirementActivity.findOne({ where: { requirementId: 26, typeOfActivity: 'resolution' } })
      ).then((activity) => {
        (activity === null).should.be.true();
      });
    });
  });

  describe('visibilityLevel y responsablePersonIds (S-060)', () => {
    before(() => {
      return Person.create({ id: 30, firstName: 'Carla', lastName: 'Diaz', enabled: true, initDate: new Date() })
        .then(() => Person.create({ id: 31, firstName: 'Dario', lastName: 'Ruiz', enabled: true, initDate: new Date() }))
        .then(() => Person.create({ id: 32, firstName: 'Elsa', lastName: 'Perez', enabled: true, initDate: new Date() }))
        .then(() => Requirement.create({
          id: 30,
          title: 'Req visibilityLevel',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }))
        .then(() => Requirement.create({
          id: 31,
          title: 'Req con responsables',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          estimatedFinishDate: '2026-06-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }))
        .then(() => Promise.all([
          PersonRequirement.create({ personId: 30, requirementId: 31, isLeader: true }),
          PersonRequirement.create({ personId: 31, requirementId: 31, isLeader: false }),
        ]));
    });

    after(() => {
      return PersonRequirement.destroy({ where: {} })
        .then(() => Person.destroy({ where: { id: [30, 31, 32] } }));
    });

    // TS-7: PATCH acepta visibilityLevel
    it('TS-7: should accept visibilityLevel and persist it', () => {
      return request(application)
        .patch('/api/requirements/30')
        .set('Authorization', 'Bearer token_01_user')
        .send({ visibilityLevel: 'internal' })
        .expect(200)
        .then(() => {
          return request(application)
            .get('/api/requirements/30')
            .set('Authorization', 'Bearer token_01_user')
            .expect(200);
        })
        .then((response) => {
          response.body.visibilityLevel.should.equal('internal');
        });
    });

    // TS-4: responsable inexistente en PATCH
    it('TS-4: should return 400 invalid_responsible_person when responsiblePersonIds entry does not exist', () => {
      return request(application)
        .patch('/api/requirements/31')
        .set('Authorization', 'Bearer token_01_user')
        .send({ responsiblePersonIds: [9999] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_responsible_person');
        });
    });

    // TS-5: reemplazo completo de responsables
    it('TS-5: should replace responsiblePersonIds completely, new first person as leader', () => {
      return request(application)
        .patch('/api/requirements/31')
        .set('Authorization', 'Bearer token_01_user')
        .send({ responsiblePersonIds: [32] })
        .expect(200)
        .then(() => {
          return request(application)
            .get('/api/requirements/31')
            .set('Authorization', 'Bearer token_01_user')
            .expect(200);
        })
        .then((response) => {
          response.body.responsiblePeople.should.have.length(1);
          response.body.responsiblePeople[0].id.should.equal(32);
          response.body.responsiblePeople[0].isLeader.should.equal(true);
        });
    });

    // TS-6: responsiblePersonIds vacio deja sin responsables
    it('TS-6: should leave requirement without responsibles when responsiblePersonIds is empty array', () => {
      return request(application)
        .patch('/api/requirements/31')
        .set('Authorization', 'Bearer token_01_user')
        .send({ responsiblePersonIds: [] })
        .expect(200)
        .then(() => {
          return request(application)
            .get('/api/requirements/31')
            .set('Authorization', 'Bearer token_01_user')
            .expect(200);
        })
        .then((response) => {
          response.body.responsiblePeople.should.be.an.Array();
          response.body.responsiblePeople.should.have.length(0);
        });
    });
  });

  describe('fix de responsables isLeader null (S-062)', () => {
    before(() => {
      return Promise.all([
        Person.create({ id: 50, firstName: 'Fede', lastName: 'Gomez', enabled: true, initDate: new Date() }),
        Person.create({ id: 51, firstName: 'Gaby', lastName: 'Ruiz', enabled: true, initDate: new Date() }),
      ])
        .then(() => Requirement.create({
          id: 50,
          title: 'Req responsables S-062',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }))
        .then(() => PersonRequirement.create({ personId: 50, requirementId: 50, isLeader: true }));
    });

    after(() => {
      return PersonRequirement.destroy({ where: { requirementId: 50 } })
        .then(() => Person.destroy({ where: { id: [50, 51] } }));
    });

    // TS-2: editar responsables sin error
    it('TS-2: should edit responsibles without error, new leader isLeader true', () => {
      return request(application)
        .patch('/api/requirements/50')
        .set('Authorization', 'Bearer token_01_user')
        .send({ responsiblePersonIds: [51] })
        .expect(200)
        .then(() => request(application)
          .get('/api/requirements/50')
          .set('Authorization', 'Bearer token_01_user')
          .expect(200))
        .then((response) => {
          response.body.responsiblePeople.should.have.length(1);
          response.body.responsiblePeople[0].id.should.equal(51);
          response.body.responsiblePeople[0].isLeader.should.equal(true);
        });
    });

    // TS-4: responsable inexistente en edicion no persiste vinculo parcial
    it('TS-4: should reject invalid responsiblePersonIds without persisting partial link', () => {
      return request(application)
        .patch('/api/requirements/50')
        .set('Authorization', 'Bearer token_01_user')
        .send({ responsiblePersonIds: [9999] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_responsible_person');
          return PersonRequirement.findAll({ where: { requirementId: 50 } });
        })
        .then((rows) => {
          rows.should.have.length(1);
          rows[0].personId.should.equal(51);
        });
    });
  });

  describe('actividad de campos title/description y state condicional (S-062)', () => {
    before(() => {
      return Promise.all([
        Requirement.create({
          id: 40,
          title: 'Título A',
          description: 'Desc A',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 41,
          title: 'Título A',
          description: 'Desc A',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 42,
          title: 'Título A',
          description: 'Desc A',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 43,
          title: 'Título A',
          description: 'Desc A',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'resuelto',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 44,
          title: 'Título A',
          description: 'Desc A',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
      ]);
    });

    // TS-5: PATCH sin state en payload no registra actividad state
    it('TS-5: should not register state activity when state is not in the payload', () => {
      return request(application)
        .patch('/api/requirements/40')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Nuevo' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 40, typeOfActivity: 'state' } }))
        .then((activity) => {
          (activity === null).should.be.true();
        });
    });

    // TS-6: PATCH con mismo valor de state no registra actividad state
    it('TS-6: should not register state activity when state value is unchanged', () => {
      return request(application)
        .patch('/api/requirements/41')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'desarrollo' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 41, typeOfActivity: 'state' } }))
        .then((activity) => {
          (activity === null).should.be.true();
        });
    });

    // TS-7: editar titulo registra actividad title
    it('TS-7: should register title activity when title changes', () => {
      return request(application)
        .patch('/api/requirements/42')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Título B' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 42, typeOfActivity: 'title' } }))
        .then((activity) => {
          activity!.previousValue.should.equal('Título A');
          activity!.newValue.should.equal('Título B');
        });
    });

    // TS-8: editar descripcion registra actividad description
    it('TS-8: should register description activity when description changes', () => {
      return request(application)
        .patch('/api/requirements/42')
        .set('Authorization', 'Bearer token_01_user')
        .send({ description: 'Desc B' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 42, typeOfActivity: 'description' } }))
        .then((activity) => {
          activity!.previousValue.should.equal('Desc A');
          activity!.newValue.should.equal('Desc B');
        });
    });

    // TS-9 (S-064): editar un requisito en resuelto ya no está bloqueado (no hay estados terminales)
    it('TS-9: should allow editing a requirement in resuelto and register activity', () => {
      return request(application)
        .patch('/api/requirements/43')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Intento de cambio' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 43, typeOfActivity: 'title' } }))
        .then((activity) => {
          activity!.previousValue.should.equal('Título A');
          activity!.newValue.should.equal('Intento de cambio');
        });
    });

    // TS-13: title y state simultaneos registran ambas actividades
    it('TS-13: should register both title and state activities when changed simultaneously', () => {
      return request(application)
        .patch('/api/requirements/44')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Título B', state: 'planificacion' })
        .expect(200)
        .then(() => Promise.all([
          RequirementActivity.findOne({ where: { requirementId: 44, typeOfActivity: 'title' } }),
          RequirementActivity.findOne({ where: { requirementId: 44, typeOfActivity: 'state' } }),
        ]))
        .then(([titleActivity, stateActivity]) => {
          titleActivity!.previousValue.should.equal('Título A');
          titleActivity!.newValue.should.equal('Título B');
          stateActivity!.previousValue.should.equal('analisis');
          stateActivity!.newValue.should.equal('planificacion');
        });
    });
  });

  describe('ciclo de vida con transición libre y campos de información base (S-064)', () => {
    before(() => {
      return User.create({ id: 'zitadel-sub-04', name: 'User 04', username: 'user04', email: 'user04@mail.com' })
        .then(() => Promise.all([
        Requirement.create({
          id: 100,
          title: 'Req funcionalidad sin info base',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 101,
          title: 'Req para scope independiente',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 102,
          title: 'Req con info base cargada',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          scope: 'A',
          technicalSolution: 'B',
          acceptanceCriteria: 'C',
        }),
        Requirement.create({
          id: 103,
          title: 'Req sin info base',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 104,
          title: 'Incidencia sin conclusion',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          resolutionType: null,
          resolutionConclusion: null,
        }),
        Requirement.create({
          id: 105,
          title: 'Incidencia con conclusion',
          description: 'Desc',
          type: 'incidencia',
          priority: 'alta',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          resolutionType: 'error_interno',
          resolutionConclusion: 'Conclusión ya cargada',
        }),
        Requirement.create({
          id: 106,
          title: 'Req desarrollo sin cambio de estado',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'desarrollo',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 107,
          title: 'Req para external-user',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }),
        Requirement.create({
          id: 108,
          title: 'Req para timestamps TS-13/TS-14',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
          scheduledAt: null,
          inProgressAt: null,
          inReviewAt: null,
          finishedAt: null,
        }),
        ]));
    });

    after(() => {
      return User.destroy({ where: { id: 'zitadel-sub-04' } });
    });

    // TS-6: transición a resuelto sin campos de información base cargados
    it('TS-6: should allow transitioning to resuelto without base info fields', () => {
      return request(application)
        .patch('/api/requirements/100')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(200)
        .then((response) => {
          response.body.state.should.equal('resuelto');
        });
    });

    // TS-7: carga de scope independiente del estado
    it('TS-7: should persist scope independently of state', () => {
      return request(application)
        .patch('/api/requirements/101')
        .set('Authorization', 'Bearer token_01_user')
        .send({ scope: 'texto del alcance' })
        .expect(200)
        .then((response) => {
          response.body.scope.should.equal('texto del alcance');
        });
    });

    // TS-8: GET expone los 3 campos nuevos con valores cargados
    it('TS-8: should expose scope, technicalSolution and acceptanceCriteria on GET', () => {
      return request(application)
        .get('/api/requirements/102')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          response.body.scope.should.equal('A');
          response.body.technicalSolution.should.equal('B');
          response.body.acceptanceCriteria.should.equal('C');
        });
    });

    // TS-9 (GET): campos nuevos son null por defecto
    it('TS-9: should default scope, technicalSolution and acceptanceCriteria to null', () => {
      return request(application)
        .get('/api/requirements/103')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          (response.body.scope === null).should.be.true();
          (response.body.technicalSolution === null).should.be.true();
          (response.body.acceptanceCriteria === null).should.be.true();
        });
    });

    // TS-11: incidencia sin resolution_conclusion rechazada al ir a resuelto
    it('TS-11: should reject transition to resuelto for incidencia without resolutionConclusion', () => {
      return request(application)
        .patch('/api/requirements/104')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('resolution_required');
        });
    });

    // TS-12: incidencia con resolution_conclusion ya cargado, resuelto aceptado sin info base
    it('TS-12: should accept transition to resuelto for incidencia with resolutionConclusion already set', () => {
      return request(application)
        .patch('/api/requirements/105')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(200)
        .then((response) => {
          response.body.state.should.equal('resuelto');
        });
    });

    // TS-13: timestamp se popula en primera transición a planificacion
    it('TS-13: should populate scheduledAt on first transition to planificacion', () => {
      return request(application)
        .patch('/api/requirements/108')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'planificacion' })
        .expect(200)
        .then((response) => {
          response.body.state.should.equal('planificacion');
          (response.body.scheduledAt !== null).should.be.true();
        });
    });

    // TS-14: timestamp no se sobreescribe en transición posterior al mismo estado
    it('TS-14: should not overwrite scheduledAt when re-entering planificacion later', () => {
      let firstScheduledAt: string;

      return request(application)
        .get('/api/requirements/108')
        .set('Authorization', 'Bearer token_01_user')
        .expect(200)
        .then((response) => {
          firstScheduledAt = response.body.scheduledAt;
          (firstScheduledAt !== null).should.be.true();
          return request(application)
            .patch('/api/requirements/108')
            .set('Authorization', 'Bearer token_01_user')
            .send({ state: 'desarrollo' })
            .expect(200);
        })
        .then(() => request(application)
          .patch('/api/requirements/108')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'planificacion' })
          .expect(200))
        .then((response) => {
          response.body.state.should.equal('planificacion');
          response.body.scheduledAt.should.equal(firstScheduledAt);
        });
    });

    // TS-17: estado sin cambio real no genera actividad
    it('TS-17: should not register state activity when state does not actually change', () => {
      return request(application)
        .patch('/api/requirements/106')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'desarrollo' })
        .expect(200)
        .then(() => RequirementActivity.findOne({ where: { requirementId: 106, typeOfActivity: 'state' } }))
        .then((activity) => {
          (activity === null).should.be.true();
        });
    });

    // TS-20: endpoint /review eliminado responde 404
    it('TS-20: should return 404 for POST /requirements/:reqid/review (endpoint removed)', () => {
      return request(application)
        .post('/api/requirements/1/review')
        .set('Authorization', 'Bearer token_01_user')
        .send({ action: 'accept' })
        .expect(404);
    });

    // TS-21: usuario externo no puede transicionar estado
    it('TS-21: should return 403 when external user tries to transition state', () => {
      return request(application)
        .patch('/api/requirements/107')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ state: 'desarrollo' })
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
        });
    });

    // TS-22: usuario externo no puede editar scope
    it('TS-22: should return 403 when external user tries to edit scope', () => {
      return request(application)
        .patch('/api/requirements/107')
        .set('Authorization', 'Bearer token_04_external_user')
        .send({ scope: 'texto' })
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
        });
    });

    // TS-23 (S-085/TS-3): editar un requisito existente para dejarlo sin tipo
    it('TS-23: should update type to null on an existing requirement', () => {
      return request(application)
        .patch('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .send({ type: null })
        .expect(200)
        .then((response) => {
          (response.body.type === null).should.be.true();
        });
    });

    // TS-24 (S-085/TS-5): rechaza type sin_tipo
    it('TS-24: should return 400 invalid_fields for type sin_tipo', () => {
      return request(application)
        .patch('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .send({ type: 'sin_tipo' })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });
  });

  describe('Attachments embebidos en descripción (fix drafts huérfanos)', () => {
    before(() => {
      return User.create({ id: 'zitadel-sub-patch-other', name: 'Other User', username: 'otherpatchuser', email: 'otherpatchuser@mail.com' });
    });

    after(() => {
      return User.destroy({ where: { id: 'zitadel-sub-patch-other' } });
    });

    function createDraft(uploadedBy: string = 'zitadel-sub-01') {
      return Attachment.create({
        entityType: AttachmentEntityType.RequirementDraft,
        entityId: null,
        fileName: 'test.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `test-key-patch-${Math.random()}`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy,
        retentionStatus: RetentionStatus.Active,
      });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true });
    });

    it('should re-link a requirement_draft attachment to the edited requirement', () => {
      return createDraft().then((draft) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ description: 'texto con ![attach:' + draft.id + ']', attachmentIds: [draft.id] })
          .expect(200)
          .then(() =>
            Attachment.findByPk(draft.id).then((found) => {
              found!.entityType.should.equal(AttachmentEntityType.Requirement);
              found!.entityId!.should.equal(1);
            })
          )
      );
    });

    it('should return 400 invalid_attachment_id when the attachment does not belong to the user', () => {
      return createDraft('zitadel-sub-patch-other').then((draft) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ attachmentIds: [draft.id] })
          .expect(400)
          .then((response) => {
            response.body.code.should.equal('invalid_attachment_id');
          })
      );
    });

    it('should not touch attachments when attachmentIds is not sent', () => {
      return createDraft().then((draft) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ title: 'Sin adjuntos en este patch' })
          .expect(200)
          .then(() =>
            Attachment.findByPk(draft.id).then((found) => {
              found!.entityType.should.equal(AttachmentEntityType.RequirementDraft);
            })
          )
      );
    });

    // attachmentIds representa el conjunto COMPLETO deseado: el backend deduce
    // qué confirmar (nuevo) y qué soft-eliminar (ya no está en la lista).
    it('should soft-delete an already-linked attachment when it is removed from attachmentIds', () => {
      return Attachment.create({
        entityType: AttachmentEntityType.Requirement,
        entityId: 1,
        fileName: 'already-linked.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `test-key-patch-remove-${Math.random()}`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy: 'zitadel-sub-01',
        retentionStatus: RetentionStatus.Active,
      }).then((linked) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ description: 'ya no tiene el adjunto', attachmentIds: [] })
          .expect(200)
          .then(() =>
            Attachment.findByPk(linked.id, { paranoid: false } as any).then((found) => {
              found!.retentionStatus.should.equal('scheduled_for_deletion');
              (found!.deletedAt !== null).should.be.true();
              found!.deletedBy!.should.equal('zitadel-sub-01');
            })
          )
      );
    });

    it('should keep an already-linked attachment when it is still present in attachmentIds', () => {
      return Attachment.create({
        entityType: AttachmentEntityType.Requirement,
        entityId: 1,
        fileName: 'still-linked.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `test-key-patch-keep-${Math.random()}`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        uploadedBy: 'zitadel-sub-01',
        retentionStatus: RetentionStatus.Active,
      }).then((linked) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ description: 'sigue con el adjunto ![attach:' + linked.id + ']', attachmentIds: [linked.id] })
          .expect(200)
          .then(() =>
            Attachment.findByPk(linked.id).then((found) => {
              found!.retentionStatus.should.equal('active');
              found!.entityType.should.equal(AttachmentEntityType.Requirement);
            })
          )
      );
    });

    it('should confirm new drafts and soft-delete removed ones in the same request', () => {
      return Promise.all([
        createDraft(),
        Attachment.create({
          entityType: AttachmentEntityType.Requirement,
          entityId: 1,
          fileName: 'to-be-removed.png',
          fileSize: 1024,
          mimeType: 'image/png',
          storageKey: `test-key-patch-mixed-${Math.random()}`,
          storageBucket: 'test-bucket',
          storageRegion: 'us-east-1',
          uploadedBy: 'zitadel-sub-01',
          retentionStatus: RetentionStatus.Active,
        }),
      ]).then(([newDraft, toRemove]) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ description: 'nuevo ![attach:' + newDraft.id + ']', attachmentIds: [newDraft.id] })
          .expect(200)
          .then(() =>
            Promise.all([
              Attachment.findByPk(newDraft.id),
              Attachment.findByPk(toRemove.id, { paranoid: false } as any),
            ])
          )
          .then(([foundNew, foundRemoved]) => {
            foundNew!.entityType.should.equal(AttachmentEntityType.Requirement);
            foundRemoved!.retentionStatus.should.equal('scheduled_for_deletion');
          })
      );
    });
  });
});
