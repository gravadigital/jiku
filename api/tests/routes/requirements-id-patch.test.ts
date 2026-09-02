import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, AttachmentEntityType, File, Person, PersonRequirement, Project, Requirement, RequirementActivity, RetentionStatus, User, UserProjectPermission } from '@jiku/models';
import { fakeBus } from '../mocks/bus';

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

  // TS-22 de Test Scenarios (REQ-012/S-049): el 404 sale de validateRequirement, ANTES de
  // publicar el comando -- verificado leyendo fakeBus.last, que no debe registrar un
  // requirements.9999.edit.
  it('TS-22: should return 404 when requirement does not exist, without publishing the command', () => {
    return request(application)
      .patch('/api/requirements/9999')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Test' })
      .expect(404)
      .then(() => {
        fakeBus.sent.length.should.equal(0);
      });
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

  // TS-1 (S-064, actualizado por S-033): transición a en_cola aceptada — la tabla de
  // transiciones de C-15 (S-033) exige pasar por `planificacion` primero, ya no es un salto
  // libre de dos pasos.
  it('TS-1: should accept transition to en_cola', () => {
    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'planificacion' })
      .expect(200)
      .then(() =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'en_cola' })
          .expect(200)
      )
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

  // TS-5 (S-064, actualizado por S-033): el retroceso de un paso se permite (CA-5) — pero la
  // tabla de C-15 (S-033) lo acota a un paso en la secuencia, no a cualquier salto hacia atrás.
  it('TS-5: should allow a one-step backward transition from revision to desarrollo', () => {
    return request(application)
      .patch('/api/requirements/2')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'desarrollo' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('desarrollo');
      });
  });

  // transición revision → resuelto registra finishedAt (legacy, no confundir con TS-13 de S-064)
  // Actualizado por S-033: C-17 exige tipo + conclusión al resolver, para todo `type` — el PATCH
  // ahora los manda, igual que cualquier resolución.
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
        .send({ state: 'resuelto', resolutionType: 'otro', resolutionConclusion: 'Resuelto' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('resuelto');
      (response.body.finishedAt !== null).should.be.true();
    });
  });

  // TS-3 (S-064, revertido por S-033, reabierto por REQ-012/S-049): la secuencia de estados (C-15)
  // se deroga. `resuelto` deja de ser terminal: la reapertura se acepta.
  it('TS-3: should allow reopening a requirement from resuelto (no longer terminal, REQ-012)', () => {
    return request(application)
      .patch('/api/requirements/3')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'desarrollo' })
      .expect(200)
      .then((response) => {
        response.body.state.should.equal('desarrollo');
      });
  });

  // TS-4 (S-064, revertido por S-033, reabierto por REQ-012/S-049): mismo motivo que TS-3 —
  // `cancelado` también deja de ser terminal.
  it('TS-4: should allow reopening a requirement from cancelado (no longer terminal, REQ-012)', () => {
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

  // TS-5 (actualizado por S-033): planificacion → desarrollo saltea en_cola — solo válido para
  // `incidencia` (CA-3). La `funcionalidad` original de este test caía justo en el caso que
  // CA-4 rechaza, así que el fixture pasa a `incidencia` para seguir probando el camino
  // aceptado y el registro de actividad.
  it('TS-5: should allow planificacion to desarrollo for an incidencia and register activity', () => {
    return Requirement.create({
      id: 12,
      title: 'Req para TS-5',
      description: 'Desc',
      type: 'incidencia',
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

  // TS-2 (S-064, revertido por S-033, reabierto por REQ-012/S-049): revision → analisis vuelve a
  // ser una transición libre — la tabla de secuencia de C-15 (S-033) se deroga por completo, no
  // solo se relaja: cualquier salto hacia atrás se acepta, sean cuatro pasos o uno.
  it('TS-2: should allow a multi-step backward transition from revision to analisis (REQ-012)', () => {
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

  // TS-2 de Test Scenarios (S-049): salto de dos pasos desde analisis, no solo uno — cubre el
  // caso "saltea varios estados a la vez", no solo "saltea el inmediato siguiente".
  it('TS-2b: should allow a two-step forward jump from analisis to desarrollo (REQ-012)', () => {
    return Requirement.create({
      id: 200,
      title: 'Req analisis para salto de dos pasos',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'analisis',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/200')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'desarrollo' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('desarrollo');
    });
  });

  // TS-5 de Test Scenarios (S-049): cancelado deja de ser terminal — otro caso además de TS-4,
  // saliendo hacia un estado distinto (en_cola) para no depender de un único destino.
  it('TS-5b: should allow reopening from cancelado to en_cola (REQ-012)', () => {
    return Requirement.create({
      id: 201,
      title: 'Req cancelado para reapertura a en_cola',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'cancelado',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/201')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'en_cola' })
        .expect(200)
    ).then((response) => {
      response.body.state.should.equal('en_cola');
    });
  });

  // TS-18 de Test Scenarios (S-049): mitigación de R1 — el salto libre sigue siendo auditable
  // aunque ya no sea prevenible. La actividad de tipo state se sigue registrando igual que antes.
  it('TS-18: should still register a state activity on a free jump (REQ-012, R1 mitigation)', () => {
    return Requirement.create({
      id: 202,
      title: 'Req analisis para actividad de salto libre',
      description: 'Desc',
      type: 'funcionalidad',
      priority: 'sin_prioridad',
      state: 'analisis',
      estimatedFinishDate: '2026-07-01',
      projectId: 1,
      tags: null,
      createdBy: 'zitadel-sub-01',
    }).then(() =>
      request(application)
        .patch('/api/requirements/202')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(200)
    ).then(() =>
      RequirementActivity.findOne({ where: { requirementId: 202, typeOfActivity: 'state' } })
    ).then((activity) => {
      activity!.previousValue.should.equal('analisis');
      activity!.newValue.should.equal('resuelto');
      activity!.visibilityLevel.should.equal('public');
    });
  });

  // TS-23 de Test Scenarios (REQ-012/S-049, CA-16): invalid_state_transition sigue mapeado a
  // 400 en STATUS_BY_ERROR_CODE aunque ya nadie lo emita -- misma política que
  // invalid_attachment_id. Este es el ÚNICO uso legítimo de fakeBus.reply() en toda la story:
  // es un camino de error que ya no se puede fabricar contra core real, precisamente porque
  // el emisor desapareció. Sin este doble no habría forma de ejercitar la entrada del mapa
  // que CA-16 obliga a conservar.
  it('TS-23: should still map invalid_state_transition to 400 (CA-16, no emitter, kept in the catalog)', () => {
    fakeBus.reply('requirements.1.edit', {
      status: 'failure',
      errorCode: 'invalid_state_transition',
      errorMessage: 'no debería ocurrir: sin emisor tras REQ-012',
    });

    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'desarrollo' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_state_transition');
      });
  });

  // TS-24 de Test Scenarios (REQ-012/S-049): bus caído en una transición libre -> 503, igual
  // que cualquier otro comando. La apertura de transiciones no cambia el manejo de fallas de
  // transporte.
  it('TS-24: should return 503 service_unavailable when the bus is down on a free transition', () => {
    fakeBus.failWithNoResponders();

    return request(application)
      .patch('/api/requirements/1')
      .set('Authorization', 'Bearer token_01_user')
      .send({ state: 'desarrollo' })
      .expect(503)
      .then((response) => {
        response.body.code.should.equal('service_unavailable');
      });
  });

  describe('resolución de incidencias (S-082)', () => {
    before(() => {
      // Proyecto 302 y zitadel-sub-07 (token_07_user_and_external_mixed, roles mixtos): SIN
      // fila en user_project_permissions -- lo usa el test de precedencia de TS-21
      // (REQ-012/S-049, CA-14).
      return User.create({ id: 'zitadel-sub-04', name: 'User 04', username: 'user04', email: 'user04@mail.com' })
        .then(() => User.create({ id: 'zitadel-sub-07', name: 'User 07 Mixto', username: 'user07mix', email: 'user07mix@mail.com' }))
        .then(() => Project.create({
          id: 302, name: 'Project sin permiso', code: 'P302', type: 'comercial',
          status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01',
        }));
    });

    after(() => {
      return UserProjectPermission.destroy({ where: { userId: ['zitadel-sub-04', 'zitadel-sub-07'] } })
        .then(() => User.destroy({ where: { id: ['zitadel-sub-04', 'zitadel-sub-07'] } }))
        .then(() => Requirement.destroy({ where: { projectId: 302 } }))
        .then(() => Project.destroy({ where: { id: 302 } }));
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

    // TS-4: core exige ambos campos (C-17, aplicado por `core` desde S-033) - ninguno cargado
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

    // TS-5: core rechaza si falta resolutionConclusion (C-17, aplicado por `core` desde S-033)
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

    // TS-6: core rechaza si falta resolutionType (C-17, aplicado por `core` desde S-033)
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

    // TS-7: la regla de core se satisface con un campo ya cargado y el otro en el mismo PATCH
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

    // TS-8 (S-033, revertido por REQ-012/S-049): C-17 vuelve a acotarse a `incidencia`
    // (core/src/commands/requirements/requirements-edit.ts:99). Una `funcionalidad` ya no exige
    // tipo ni conclusión para resolverse — CA-6.
    it('TS-8: should allow resolving a funcionalidad without type nor conclusion (REQ-012)', () => {
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
        (response.body.resolutionType === null).should.be.true();
        (response.body.resolutionConclusion === null).should.be.true();
      });
    });

    // TS-7 de Test Scenarios (REQ-012/S-049): mismo caso que TS-8 pero con type `mejora` — la
    // regla se testea en su límite: los tres tipos no-incidencia, no solo uno.
    it('TS-7b: should allow resolving a mejora without type nor conclusion (REQ-012)', () => {
      return Requirement.create({
        id: 203,
        title: 'Mejora sin resolución',
        description: 'Desc',
        type: 'mejora',
        priority: 'media',
        state: 'revision',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/203')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
      });
    });

    // TS-8b de Test Scenarios (REQ-012/S-049): mismo caso con type `otro`.
    it('TS-8b: should allow resolving an otro without type nor conclusion (REQ-012)', () => {
      return Requirement.create({
        id: 204,
        title: 'Otro sin resolución',
        description: 'Desc',
        type: 'otro',
        priority: 'media',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/204')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
      });
    });

    // TS-11 / TS-12 de Test Scenarios (REQ-012/S-049): la `incidencia` sigue exigiendo tipo y
    // conclusión — la regla no desaparece, se acota. El rollback del despachador (ADR-003) se
    // verifica releyendo la base directo, no por GET: sin escritura de estado ni actividad.
    it('TS-11: should return 400 resolution_required for an incidencia without resolution, and roll back (REQ-012, ADR-003)', () => {
      return Requirement.create({
        id: 205,
        title: 'Incidencia sin resolución para rollback',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/205')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
        return Requirement.findByPk(205);
      }).then((req) => {
        // el estado no cambió: el rollback del despachador no dejó nada escrito
        req!.state.should.equal('desarrollo');
        return RequirementActivity.findOne({ where: { requirementId: 205, typeOfActivity: 'state' } });
      }).then((activity) => {
        (activity === null).should.be.true();
      });
    });

    // TS-13 de Test Scenarios (REQ-012/S-049, CA-15): el tipo se lee de la fila, no del payload
    // — el intento de reclasificar en el mismo PATCH no esquiva la regla de `incidencia`.
    it('TS-13b: should evaluate resolution_required from the stored type, not the payload (CA-15)', () => {
      return Requirement.create({
        id: 206,
        title: 'Incidencia que intenta reclasificarse',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/206')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto', type: 'funcionalidad' })
          .expect(400)
      ).then((response) => {
        response.body.code.should.equal('resolution_required');
      });
    });

    // TS-2 de Test Scenarios (S-033): la misma funcionalidad, con tipo y conclusión en el
    // mismo PATCH, sí se resuelve — ahora esos campos son opcionales, no prohibidos, para una
    // funcionalidad (REQ-012).
    it('should resolve a funcionalidad when type and conclusion are sent in the same PATCH', () => {
      return Requirement.create({
        id: 81,
        title: 'Funcionalidad TS-2 (S-033)',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'media',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/81')
          .set('Authorization', 'Bearer token_01_user')
          .send({
            state: 'resuelto',
            resolutionType: 'otro',
            resolutionConclusion: 'Resuelto en el sprint',
          })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
        response.body.resolutionType.should.equal('otro');
        response.body.resolutionConclusion.should.equal('Resuelto en el sprint');
        fakeBus.last!.command.should.equal('requirements.81.edit');
        const payload = fakeBus.last!.payload as any;
        payload.state.should.equal('resuelto');
        payload.resolutionType.should.equal('otro');
        payload.resolutionConclusion.should.equal('Resuelto en el sprint');
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
        // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa
        // rol->método de core (S-030, authorizeWithRoles), que responde caller_not_authorized.
        response.body.code.should.equal('caller_not_authorized');
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
          // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa
        // rol->método de core (S-030, authorizeWithRoles), que responde caller_not_authorized.
        response.body.code.should.equal('caller_not_authorized');
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

    // TS-21 de Test Scenarios (REQ-012/S-049, CA-14): access_denied se evalúa ANTES que
    // cualquier regla de transición o de resolución. El requisito vive en el proyecto 302,
    // donde zitadel-sub-07 (token_07_user_and_external_mixed) NO tiene fila en
    // user_project_permissions. Es una incidencia SIN datos de resolución: si la
    // autorización no cortara primero, la respuesta sería 400 resolution_required, no 403
    // access_denied -- el test detecta justo esa precedencia.
    //
    // Por qué roles MIXTOS y no token_04_external_user (external-user puro): un external-user
    // puro nunca llega a la compuerta de entidad -- lo corta antes el mapa rol->método de core
    // con caller_not_authorized (ver TS-9/TS-10/TS-21 más abajo, que prueban justo eso). Con
    // roles mixtos el método SÍ está autorizado (por `user`), pero `resolveCallerClass` elige
    // la clase MÁS RESTRICTIVA y cae en `external`, activando el chequeo de
    // user_project_permissions -- el mismo patrón que usa core/tests/commands/requirements.test.ts
    // (TS-38) para este caso.
    it('TS-21: should return 403 access_denied before evaluating resolution_required (CA-14)', () => {
      return Requirement.create({
        id: 212,
        title: 'Incidencia en proyecto sin permiso',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'desarrollo',
        projectId: 302,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/212')
          .set('Authorization', 'Bearer token_07_user_and_external_mixed')
          .send({ state: 'resuelto' })
          .expect(403)
      ).then((response) => {
        response.body.code.should.equal('access_denied');
      });
    });

    // TS-6 de Test Scenarios (S-033, reabierto por REQ-012/S-049): saltear estados deja de
    // rechazarse — la secuencia (C-15) se deroga, la transición se acepta.
    it('TS-1: should allow skipping states (analisis to desarrollo, REQ-012)', () => {
      return Requirement.create({
        id: 82,
        title: 'Funcionalidad TS-6 (S-033)',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'media',
        state: 'analisis',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/82')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'desarrollo' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('desarrollo');
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

    // TS-6: transición a resuelto sin campos de información base cargados. Actualizado por
    // S-033: C-17 sigue exigiendo tipo + conclusión de RESOLUCIÓN (no confundir con los campos
    // de información base, que es lo que este test verifica que NO hace falta cargar).
    it('TS-6: should allow transitioning to resuelto without base info fields', () => {
      return request(application)
        .patch('/api/requirements/100')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto', resolutionType: 'otro', resolutionConclusion: 'Resuelto' })
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

    // TS-14: timestamp no se sobreescribe en transición posterior al mismo estado. Actualizado
    // por S-033: llegar a `desarrollo` desde `planificacion` pasa por `en_cola` (C-15) — ya no
    // es un salto directo.
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
            .send({ state: 'en_cola' })
            .expect(200);
        })
        .then(() => request(application)
          .patch('/api/requirements/108')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'desarrollo' })
          .expect(200))
        .then(() => request(application)
          .patch('/api/requirements/108')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'en_cola' })
          .expect(200))
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

    // TS-16 de Test Scenarios (REQ-012/S-049, CA-11): salir de `resuelto` hacia un estado NO
    // terminal limpia los tres datos de resolución en el mismo update
    // (core/.../requirements-edit.ts:134-144).
    it('TS-16: should clear resolution data when leaving resuelto to a non-terminal state (CA-11)', () => {
      return Requirement.create({
        id: 208,
        title: 'Incidencia resuelta para reapertura',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'resuelto',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: 'otro',
        resolutionConclusion: 'conclusión',
        resolutionComment: 'comentario',
      }).then(() =>
        request(application)
          .patch('/api/requirements/208')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'desarrollo' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('desarrollo');
        (response.body.resolutionType === null).should.be.true();
        (response.body.resolutionConclusion === null).should.be.true();
        (response.body.resolutionComment === null).should.be.true();
        // Verificación de R2: la limpieza NO deja una actividad de tipo `resolution` que
        // preserve los valores anteriores — el hook (@BeforeUpdate en
        // packages/models/src/requirement.model.ts) solo registra `activityLog` para `title`,
        // `description` y `state`. La información de resolución se pierde al reabrir. Se
        // reporta como hallazgo en el resumen de implementación (no se agrega el registro
        // desde `api`: el hook vive en `core`/`packages/models`, fuera de alcance de este plan).
        return RequirementActivity.findOne({ where: { requirementId: 208, typeOfActivity: 'resolution' } });
      }).then((activity) => {
        (activity === null).should.be.true();
      });
    });

    // TS-17 de Test Scenarios (REQ-012/S-049, CA-11): resuelto → cancelado NO limpia los datos
    // de resolución. Verificado contra core/src/commands/requirements/requirements-edit.ts:134-
    // 138: `leavesResolved` excluye explícitamente `payload.state === Cancelado` además de
    // `Resuelto` — ambos son terminales y la limpieza solo aplica al reabrir hacia un estado
    // real de trabajo.
    it('TS-17: should NOT clear resolution data when moving from resuelto to cancelado (CA-11)', () => {
      return Requirement.create({
        id: 209,
        title: 'Incidencia resuelta para cancelar',
        description: 'Desc',
        type: 'incidencia',
        priority: 'alta',
        state: 'resuelto',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
        resolutionType: 'otro',
        resolutionConclusion: 'conclusión',
        resolutionComment: 'comentario',
      }).then(() =>
        request(application)
          .patch('/api/requirements/209')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'cancelado' })
          .expect(200)
      ).then((response) => {
        response.body.state.should.equal('cancelado');
        response.body.resolutionType.should.equal('otro');
        response.body.resolutionConclusion.should.equal('conclusión');
        response.body.resolutionComment.should.equal('comentario');
      });
    });

    // TS-14 de Test Scenarios (REQ-012/S-049, CA-9): inProgressAt conserva la PRIMERA fecha al
    // reabrir — write-once, a diferencia de finishedAt.
    it('TS-14b: should keep the first inProgressAt date when reopened (CA-9)', () => {
      let firstInProgressAt: string;

      return Requirement.create({
        id: 210,
        title: 'Req para inProgressAt write-once',
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
      }).then(() =>
        request(application)
          .patch('/api/requirements/210')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'desarrollo' })
          .expect(200)
      ).then((response) => {
        firstInProgressAt = response.body.inProgressAt;
        (firstInProgressAt !== null).should.be.true();
        return request(application)
          .patch('/api/requirements/210')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(200);
      }).then(() => request(application)
        .patch('/api/requirements/210')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'desarrollo' })
        .expect(200)
      ).then((response) => {
        response.body.state.should.equal('desarrollo');
        response.body.inProgressAt.should.equal(firstInProgressAt);
      });
    });

    // TS-15 de Test Scenarios (REQ-012/S-049, CA-10): finishedAt deja de ser write-once — se
    // reescribe en cada entrada a resuelto. Sin mockdate: las fechas se comparan entre sí
    // (distinta / no nula), no contra un valor fijo — congelar el reloj rompería justo la
    // distinción que este test necesita.
    it('TS-15: should overwrite finishedAt on each new resolution (CA-10)', () => {
      let firstFinishedAt: string;

      return Requirement.create({
        id: 211,
        title: 'Req para finishedAt re-escribible',
        description: 'Desc',
        type: 'funcionalidad',
        priority: 'sin_prioridad',
        state: 'desarrollo',
        projectId: 1,
        tags: null,
        createdBy: 'zitadel-sub-01',
      }).then(() =>
        request(application)
          .patch('/api/requirements/211')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'resuelto' })
          .expect(200)
      ).then((response) => {
        firstFinishedAt = response.body.finishedAt;
        (firstFinishedAt !== null).should.be.true();
        return request(application)
          .patch('/api/requirements/211')
          .set('Authorization', 'Bearer token_01_user')
          .send({ state: 'desarrollo' })
          .expect(200);
      }).then(() => request(application)
        .patch('/api/requirements/211')
        .set('Authorization', 'Bearer token_01_user')
        .send({ state: 'resuelto' })
        .expect(200)
      ).then((response) => {
        response.body.state.should.equal('resuelto');
        (response.body.finishedAt !== null).should.be.true();
        // no-write-once: la segunda resolución produce una fecha distinta de la primera.
        // Si aparece intermitencia por resolución de columna, la aserción robusta sería
        // new Date(F2).getTime() >= new Date(F1).getTime() -- no agregar sleep.
        response.body.finishedAt.should.not.equal(firstFinishedAt);
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
          // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa
        // rol->método de core (S-030, authorizeWithRoles), que responde caller_not_authorized.
        response.body.code.should.equal('caller_not_authorized');
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
          // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa
        // rol->método de core (S-030, authorizeWithRoles), que responde caller_not_authorized.
        response.body.code.should.equal('caller_not_authorized');
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

  describe('vinculación de archivos existentes (REQ-001, S-003)', () => {
    before(() => {
      return User.create({ id: 'zitadel-sub-patch-other', name: 'Other User', username: 'otherpatchuser', email: 'otherpatchuser@mail.com' });
    });

    after(() => {
      return User.destroy({ where: { id: 'zitadel-sub-patch-other' } });
    });

    /**
     * `fileIds` son ids de `files`: el archivo existe por sí solo y el vínculo se crea contra
     * el requisito ya existente. `uploadedBy` es lo que decide la titularidad (RF-12).
     */
    function createFile(uploadedBy: string = 'zitadel-sub-01'): Promise<File> {
      return File.create({
        fileName: 'test.png',
        fileSize: 1024,
        mimeType: 'image/png',
        storageKey: `grava-gestion/f/${Math.random()}.png`,
        storageBucket: 'test-bucket',
        storageRegion: 'us-east-1',
        byteStatus: 'pending',
        retentionStatus: RetentionStatus.Active,
        uploadedBy,
      } as any, { validate: false });
    }

    /** Un vínculo ya existente sobre el requisito 1, para los casos de conjunto completo. */
    function linkExisting(file: File) {
      return Attachment.create({
        entityType: AttachmentEntityType.Requirement,
        entityId: 1,
        fileId: file.id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        storageKey: file.storageKey,
        storageBucket: file.storageBucket,
        storageRegion: file.storageRegion,
        uploadedBy: file.uploadedBy,
      } as any, { validate: false });
    }

    afterEach(() => {
      return Attachment.destroy({ where: {}, force: true })
        .then(() => File.destroy({ where: {}, force: true }));
    });

    it('vincula un archivo existente al requisito editado', () => {
      return createFile().then((file) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ description: 'texto con adjunto', fileIds: [file.id] })
          .expect(200)
          .then(() => Attachment.findOne({ where: { fileId: file.id } }))
          .then((found) => {
            found!.entityType.should.equal(AttachmentEntityType.Requirement);
            found!.entityId!.should.equal(1);
            return File.findByPk(file.id);
          })
          .then((refreshed) => {
            // Vincular es lo que da por subido el byte: nadie verifica el bucket acá.
            (refreshed as any).byteStatus.should.equal('uploaded');
          })
      );
    });

    // RF-12: la titularidad reemplazó a la vieja validación de pertenencia del draft.
    it('devuelve 403 file_not_owned cuando el archivo lo subió otro usuario', () => {
      return createFile('zitadel-sub-patch-other').then((file) =>
        request(application)
          .patch('/api/requirements/1')
          .set('Authorization', 'Bearer token_01_user')
          .send({ fileIds: [file.id] })
          .expect(403)
          .then((response) => {
            response.body.code.should.equal('file_not_owned');
            // Y no dejó el vínculo a medias: la transacción del comando revirtió todo.
            return Attachment.count({ where: { fileId: file.id } });
          })
          .then((count) => {
            count.should.equal(0);
          })
      );
    });

    it('devuelve 400 invalid_fields cuando el fileId no existe', () => {
      return request(application)
        .patch('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .send({ fileIds: [987654] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('devuelve 400 invalid_fields con más de 10 fileIds', () => {
      return request(application)
        .patch('/api/requirements/1')
        .set('Authorization', 'Bearer token_01_user')
        .send({ fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
        });
    });

    it('no toca los vínculos cuando el patch no manda fileIds', () => {
      return createFile()
        .then((file) => linkExisting(file))
        .then((link) =>
          request(application)
            .patch('/api/requirements/1')
            .set('Authorization', 'Bearer token_01_user')
            .send({ title: 'Sin adjuntos en este patch' })
            .expect(200)
            .then(() => Attachment.findByPk(link.id))
            .then((found) => {
              (found !== null).should.be.true();
            })
        );
    });

    // `fileIds` es el conjunto COMPLETO deseado: lo que ya no viene pierde el vínculo.
    // Se borra el VÍNCULO, nunca el archivo (D-04): un `File` puede tener 0..N vínculos.
    it('desvincula un archivo que ya no viene en fileIds, sin borrar el archivo', () => {
      let file: File;
      return createFile()
        .then((created) => { file = created; return linkExisting(created); })
        .then((link) =>
          request(application)
            .patch('/api/requirements/1')
            .set('Authorization', 'Bearer token_01_user')
            .send({ description: 'ya no tiene el adjunto', fileIds: [] })
            .expect(200)
            .then(() => Attachment.findByPk(link.id, { paranoid: false } as any))
        )
        .then((found) => {
          (found === null).should.be.true();
          return File.findByPk(file.id);
        })
        .then((stillThere) => {
          (stillThere !== null).should.be.true();
        });
    });

    // La fila del vínculo que sobrevive conserva su id: preservarla no cuesta nada y es
    // información que un delete+insert perdería.
    it('conserva el vínculo que sigue presente en fileIds', () => {
      let file: File;
      return createFile()
        .then((created) => { file = created; return linkExisting(created); })
        .then((link) =>
          request(application)
            .patch('/api/requirements/1')
            .set('Authorization', 'Bearer token_01_user')
            .send({ description: 'sigue con el adjunto', fileIds: [file.id] })
            .expect(200)
            .then(() => Attachment.findByPk(link.id))
        )
        .then((found) => {
          (found !== null).should.be.true();
          found!.entityType.should.equal(AttachmentEntityType.Requirement);
          found!.entityId!.should.equal(1);
        });
    });

    it('vincula los nuevos y desvincula los removidos en el mismo request', () => {
      let newFile: File;
      let removedLinkId: number;
      return Promise.all([createFile(), createFile()])
        .then(([nuevo, viejo]) => {
          newFile = nuevo;
          return linkExisting(viejo);
        })
        .then((toRemove) => {
          removedLinkId = toRemove.id;
          return request(application)
            .patch('/api/requirements/1')
            .set('Authorization', 'Bearer token_01_user')
            .send({ description: 'nuevo adjunto', fileIds: [newFile.id] })
            .expect(200);
        })
        .then(() => Promise.all([
          Attachment.findOne({ where: { fileId: newFile.id } }),
          Attachment.findByPk(removedLinkId, { paranoid: false } as any),
        ]))
        .then(([foundNew, foundRemoved]) => {
          foundNew!.entityType.should.equal(AttachmentEntityType.Requirement);
          foundNew!.entityId!.should.equal(1);
          (foundRemoved === null).should.be.true();
        });
    });
  });

  // TS-13 (S-029, CA-6 y CA-7): `editor` sigue viajando —es DATO DE DOMINIO— y vale lo mismo que
  // `actor.id`, que sale del `sub` del claim. Que coincidan es lo que evita que core rechace el
  // comando por CA-6: dos identidades distintas en un mismo comando son un error del publicador,
  // no una elección. Vive acá y no en `actor-envelope.test.ts` porque el fixture del requisito ya
  // existe: duplicarlo para repetir la misma aserción es trabajo sin cobertura nueva.
  it('TS-13: `editor` y `actor.id` coinciden y core no rechaza el comando', () => {
    return request(application)
      .patch('/api/requirements/2')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Nuevo título' })
      // El 200 ES la aserción de que no salió 400 `invalid_fields`.
      .expect(200)
      .then(() => {
        const payload = (fakeBus.last as any).payload;
        payload.editor.should.equal(payload.actor.id);
        payload.actor.id.should.equal('zitadel-sub-01');
      });
  });
});
