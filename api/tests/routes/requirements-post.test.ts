import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Attachment, File, Objective, Person, Project, ProjectPerson, Requirement, RequirementActivity, User } from '@jiku/models';

describe('POST /api/requirements', () => {
  let application: Application;

  before(function () {
    this.timeout(30000);
    application = start();

    // El stub de `storageService.uploadFromBuffer` se retiró con S-004: ninguna ruta mueve
    // bytes ya, el módulo no existe y el doble solo cubría un camino que desapareció.
    return User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' })
      .then(() => User.create({ id: 'zitadel-sub-04', name: 'User 04', username: 'user04', email: 'user04@mail.com' }))
      .then(() => Project.create({ id: 1, name: 'Project1', code: 'P1', type: 'comercial', status: 'activo', initDate: new Date(), createdBy: 'zitadel-sub-01' }))
      .then(() => Person.create({ id: 10, firstName: 'Ana', lastName: 'Gómez', enabled: true, initDate: new Date() }))
      .then(() => Person.create({ id: 99, firstName: 'Otro', lastName: 'Persona', enabled: true, initDate: new Date() }))
      .then(() => ProjectPerson.create({ projectId: 1, personId: 10 }))
      // persona 99 NO asociada al proyecto
      ;
  });

  /**
   * Los `fileIds` son ids de `files`, no de `attachments` (REQ-001, S-003): el archivo ya
   * existe por sí solo y el vínculo lo crea core contra el requisito recién guardado. Por eso
   * el fixture es un `File`, y `uploadedBy` importa: es la regla de titularidad (RF-12).
   */
  function createFile(uploadedBy = 'zitadel-sub-01'): Promise<File> {
    return File.create({
      fileName: 'img.png',
      fileSize: 1024,
      mimeType: 'image/png',
      storageKey: `grava-gestion/f/${Math.random()}.png`,
      storageBucket: 'test-bucket',
      storageRegion: 'sfo2',
      byteStatus: 'pending',
      retentionStatus: 'active',
      uploadedBy,
    } as any, { validate: false });
  }

  after(() => {
    return RequirementActivity.destroy({ where: {} })
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Attachment.destroy({ where: {}, force: true }))
      .then(() => File.destroy({ where: {}, force: true }))
      .then(() => ProjectPerson.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-14: sin token
  it('TS-14: should return 401 if no token is provided', () => {
    return request(application)
      .post('/api/requirements')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1 })
      .expect(401);
  });

  // TS-4: enum state inválido
  it('TS-4: should return 400 for invalid state enum', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1, state: 'foo' })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-5: enum type inválido
  it('TS-5: should return 400 for invalid type enum', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'xxx', estimatedFinishDate: '2026-07-01', projectId: 1 })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-6: enum visibilityLevel inválido
  it('TS-6: should return 400 for invalid visibilityLevel enum', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1, visibilityLevel: 'secret' })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-8: proyecto inexistente
  it('TS-8: should return 404 for non-existent project', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 99999 })
      .expect(404)
      .then((res) => {
        res.body.code.should.equal('project_not_found');
      });
  });

  it('should allow a responsible person that is not associated with the project', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', projectId: 1, responsiblePersonIds: [99] })
      .expect(201)
      .then((res) => {
        res.body.responsiblePeople.should.have.length(1);
        res.body.responsiblePeople[0].id.should.equal(99);
        res.body.responsiblePeople[0].isLeader.should.equal(true);
      });
  });

  // TS-3: responsable inexistente
  it('TS-3: should return 400 invalid_responsible_person when a responsiblePersonIds entry does not exist', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1, responsiblePersonIds: [9999] })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_responsible_person');
      });
  });

  // TS-3 (S-062): sin vinculo parcial en people_requirements ni requisito creado
  it('TS-3: should not create requirement nor partial people_requirements link when responsible does not exist', () => {
    let countBefore: number;
    return Requirement.count()
      .then((c) => { countBefore = c; })
      .then(() => request(application)
        .post('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Req sin vinculo parcial', description: 'D', type: 'funcionalidad', projectId: 1, responsiblePersonIds: [9999] })
        .expect(400))
      .then((res) => {
        res.body.code.should.equal('invalid_responsible_person');
        return Requirement.count();
      })
      .then((countAfter) => {
        countAfter.should.equal(countBefore);
        return Requirement.findOne({ where: { title: 'Req sin vinculo parcial' } });
      })
      .then((requirement) => {
        (requirement === null).should.be.true();
      });
  });

  // TS-2 (S-060): crear requisito con multiples responsables, primero como lider
  it('TS-2: should create requirement with multiple responsiblePersonIds, first as leader', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Req multi', description: 'd', type: 'mejora', estimatedFinishDate: '2026-07-01', projectId: 1, responsiblePersonIds: [10, 99] })
      .expect(201)
      .then((res) => {
        res.body.responsiblePeople.should.have.length(2);
        res.body.responsiblePeople.should.containDeep([
          { id: 10, isLeader: true },
          { id: 99, isLeader: null },
        ]);
      });
  });

  // TS-1 (S-062): isLeader debe ser null (no false) para responsables no-lideres
  it('TS-1: should create requirement with responsiblePersonIds, non-leader isLeader is null', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Req S-062', description: 'd', type: 'funcionalidad', projectId: 1, responsiblePersonIds: [10, 99] })
      .expect(201)
      .then((res) => {
        res.body.responsiblePeople.should.have.length(2);
        res.body.responsiblePeople.should.containDeep([
          { id: 10, isLeader: true },
          { id: 99, isLeader: null },
        ]);
      });
  });

  // estado default analisis
  it('should default state to analisis and visibilityLevel to public', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Req B', description: 'd', type: 'mejora', estimatedFinishDate: '2026-07-01', projectId: 1 })
      .expect(201)
      .then((res) => {
        res.body.state.should.equal('analisis');
        res.body.visibilityLevel.should.equal('public');
        res.body.responsiblePeople.should.be.an.Array();
        res.body.responsiblePeople.should.have.length(0);
      });
  });

  it('should create a requirement without estimatedFinishDate', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Sin fecha', description: 'd', type: 'mejora', projectId: 1 })
      .expect(201)
      .then((res) => {
        (res.body.estimatedFinishDate === null).should.be.true();
      });
  });

  // TS-3: estado válido explícito
  it('TS-3: should respect explicit state value', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Req C', description: 'd', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1, state: 'desarrollo' })
      .expect(201)
      .then((res) => {
        res.body.state.should.equal('desarrollo');
      });
  });

  // TS-9: `fileId` inexistente → 400 `invalid_fields` y rollback del requisito. El rollback es
  // la mitad que importa: la entidad y sus vínculos quedan juntos o ninguno.
  it('TS-9: should return 400 invalid_fields for a non-existent fileId and not create requirement', () => {
    let countBefore: number;
    return Requirement.count()
      .then((c) => { countBefore = c; })
      .then(() => request(application)
        .post('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Con adjunto invalido', description: 'd', type: 'funcionalidad', estimatedFinishDate: '2026-07-01', projectId: 1, fileIds: [7777] })
        .expect(400))
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
        return Requirement.count();
      })
      .then((countAfter) => {
        countAfter.should.equal(countBefore);
      });
  });

  // RF-12: titularidad. El archivo lo subió otro usuario, así que el actor no puede vincularlo.
  it('should return 403 file_not_owned when the file was uploaded by another user', () => {
    let countBefore: number;
    return Requirement.count()
      .then((c) => { countBefore = c; })
      .then(() => createFile('zitadel-sub-04'))
      .then((file) => request(application)
        .post('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .send({ title: 'Archivo ajeno', description: 'd', type: 'funcionalidad', projectId: 1, fileIds: [file.id] })
        .expect(403))
      .then((res) => {
        res.body.code.should.equal('file_not_owned');
        return Requirement.count();
      })
      .then((countAfter) => {
        countAfter.should.equal(countBefore);
      });
  });

  // Más de 10 `fileIds`: lo corta Joi en la api, sin round-trip del bus.
  it('should return 400 invalid_fields for more than 10 fileIds', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Demasiados',
        description: 'd',
        type: 'funcionalidad',
        projectId: 1,
        fileIds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // create completo con responsable y archivo vinculado
  it('should create requirement with state, visibilityLevel, responsiblePersonIds and link the file', () => {
    let file: File;
    return createFile()
      .then((created) => { file = created; })
      .then(() => request(application)
        .post('/api/requirements')
        .set('Authorization', 'Bearer token_01_user')
        .send({
          title: 'Req A',
          description: 'desc',
          type: 'funcionalidad',
          estimatedFinishDate: '2026-07-01',
          projectId: 1,
          state: 'planificacion',
          visibilityLevel: 'internal',
          responsiblePersonIds: [10],
          fileIds: [file.id],
        })
        .expect(201))
      .then((res) => {
        res.body.should.have.property('id');
        res.body.state.should.equal('planificacion');
        res.body.visibilityLevel.should.equal('internal');
        res.body.responsiblePeople.should.be.an.Array();
        res.body.responsiblePeople.should.have.length(1);
        res.body.responsiblePeople[0].id.should.equal(10);
        res.body.responsiblePeople[0].firstName.should.equal('Ana');
        res.body.responsiblePeople[0].lastName.should.equal('Gómez');
        res.body.responsiblePeople[0].isLeader.should.equal(true);
        const reqId = res.body.id;
        return Attachment.findOne({ where: { fileId: file.id } })
          .then((att) => {
            att!.entityType.should.equal('requirement');
            att!.entityId!.should.equal(reqId);
            // El PUT al bucket lo reportó el cliente: vincular es lo que da por subido el byte.
            return File.findByPk(file.id);
          })
          .then((refreshed) => {
            (refreshed as any).byteStatus.should.equal('uploaded');
          });
      });
  });

  // Legacy tests preserved
  it('should return 400 if projectId is missing', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', priority: 'baja', estimatedFinishDate: '2026-06-01' })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  it('should default priority to sin_prioridad when not provided', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Sin prioridad', description: 'Desc', type: 'funcionalidad', estimatedFinishDate: '2026-06-01', projectId: 1 })
      .expect(201)
      .then((response) => {
        response.body.priority.should.equal('sin_prioridad');
      });
  });

  // TS-9 (S-064): campos nuevos son null por defecto al crear sin especificarlos
  it('TS-9: should default scope, technicalSolution and acceptanceCriteria to null', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Req sin info base', description: 'd', type: 'funcionalidad', projectId: 1 })
      .expect(201)
      .then((res) => {
        (res.body.scope === null).should.be.true();
        (res.body.technicalSolution === null).should.be.true();
        (res.body.acceptanceCriteria === null).should.be.true();
      });
  });

  // TS-10 (S-064): POST acepta los 3 campos opcionales de información base
  it('TS-10: should accept scope, technicalSolution and acceptanceCriteria on create', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({
        title: 'Req con info base',
        description: 'd',
        type: 'funcionalidad',
        projectId: 1,
        scope: 'texto',
        technicalSolution: 'texto',
        acceptanceCriteria: 'texto',
      })
      .expect(201)
      .then((res) => {
        res.body.scope.should.equal('texto');
        res.body.technicalSolution.should.equal('texto');
        res.body.acceptanceCriteria.should.equal('texto');
      });
  });

  // TS-19 (S-064): valor de state inválido rechazado en POST
  it('TS-19: should return 400 invalid_fields for invalid state value', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'funcionalidad', projectId: 1, state: 'estado_invalido' })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  it('should not create any Objective when creating a requirement', () => {
    return Objective.count()
      .then((countBefore) => {
        return request(application)
          .post('/api/requirements')
          .set('Authorization', 'Bearer token_01_user')
          .send({ title: 'Sin objetivo', description: 'D', type: 'incidencia', estimatedFinishDate: '2026-06-30', projectId: 1 })
          .expect(201)
          .then(() => Objective.count())
          .then((countAfter) => {
            countAfter.should.equal(countBefore);
          });
      });
  });

  // TS-20 (S-085/TS-1): crear requisito omitiendo type
  it('TS-20: should create a requirement with type null when type is omitted', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Sin tipo omitido', description: 'D', projectId: 1 })
      .expect(201)
      .then((res) => {
        (res.body.type === null).should.be.true();
      });
  });

  // TS-21 (S-085/TS-2): crear requisito con type null explícito
  it('TS-21: should create a requirement with type null when type is explicitly null', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Sin tipo explicito', description: 'D', projectId: 1, type: null })
      .expect(201)
      .then((res) => {
        (res.body.type === null).should.be.true();
      });
  });

  // TS-22 (S-085/TS-4): rechaza type sin_tipo
  it('TS-22: should return 400 invalid_fields for type sin_tipo', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'T', description: 'D', type: 'sin_tipo', projectId: 1 })
      .expect(400)
      .then((res) => {
        res.body.code.should.equal('invalid_fields');
      });
  });

  // TS-23 (S-085/TS-10): regresión, type válido sigue funcionando
  it('TS-23: should create a requirement with a valid type value', () => {
    return request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_01_user')
      .send({ title: 'Con tipo', description: 'D', projectId: 1, type: 'incidencia' })
      .expect(201)
      .then((res) => {
        res.body.type.should.equal('incidencia');
      });
  });
});
