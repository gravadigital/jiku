import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, UnworkedTime, User, WorkedTime } from '@jiku/models';
import { dayOffset, HOY, HOY_M10, HOY_M11, MANANA } from '../helpers/dates';
import { fakeBus } from '../mocks/bus';

describe('POST /api/worked-times', () => {
  let application: Application;

  const todayStr = HOY;
  const twoDaysAgoStr = dayOffset(-2);
  const threeDaysAgoStr = dayOffset(-3);
  const fourDaysAgoStr = dayOffset(-4);
  const fiveDaysAgoStr = dayOffset(-5);
  const tomorrowStr = MANANA;

  before(function() {
    application = start();

    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-02',
        name: 'User 02',
        username: 'user02',
        email: 'user02@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin 01',
        username: 'admin01',
        email: 'admin01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-04',
        name: 'External User 01',
        username: 'external01',
        email: 'external01@mail.com'
      }),
      // TS-11: el actor SIN Persona vinculada. `token_05_user_profile` ya existe en el mock con rol
      // `user`, así que no hace falta tocarlo. Se le crea igual su fila en `users` (espejo,
      // S-029) porque `core` resuelve la Persona a partir del actor -- no por la autenticación
      // de la api, que desde S-034 no consulta `users`. NO se le crea Persona: esa ausencia ES
      // el caso que TS-11 prueba.
      User.create({
        id: 'zitadel-sub-05',
        name: 'Sin Persona',
        username: 'sinpersona',
        email: 'sinpersona@mail.com'
      }),
    ])
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01'
          }),
          Person.create({
            id: 2,
            firstName: 'Ana',
            lastName: 'García',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-02'
          }),
          Person.create({
            id: 3,
            firstName: 'Carlos',
            lastName: 'López',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-03'
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 2,
            code: 'BETA',
            name: 'Proyecto Beta',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01'
          }),
        ]);
      })
      .then(() => {
        return Promise.all([
          // Requisitos para los TS de carga a requisito
          Requirement.create({ id: 1, title: 'Req A', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'desarrollo', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
          Requirement.create({ id: 2, title: 'Req B (proyecto 2)', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'analisis', estimatedFinishDate: '2026-07-01', projectId: 2, tags: null, createdBy: 'zitadel-sub-01' }),
          Requirement.create({ id: 3, title: 'Req cancelado', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'cancelado', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
          Requirement.create({ id: 4, title: 'Req resuelto', description: 'Desc', type: 'funcionalidad', priority: 'sin_prioridad', state: 'resuelto', estimatedFinishDate: '2026-07-01', projectId: 1, tags: null, createdBy: 'zitadel-sub-01' }),
        ]);
      })
      .then(() => {
        return Promise.all([
          
          Objective.create({
            id: 1,
            title: 'Objetivo Test',
            state: 'activo',
            area: 'desarrollo',
            priority: 1,
            projectId: 1,
            requirementId: 1,
            createdBy: 'zitadel-sub-01',
            visibilityLevel: 'public'
          }),
        ]);
      })
      .then(() => {
        // Pre-existing records: 1200 minutes for person 1 on today (for TS-10, TS-22)
        return Promise.all([
          WorkedTime.create({
            id: 100,
            date: todayStr,
            minutes: 600,
            projectId: 1,
            personId: 1
          }),
          WorkedTime.create({
            id: 101,
            date: todayStr,
            minutes: 600,
            projectId: 1,
            personId: 1
          }),
          // 120 minutes for person 1 on 2 days ago (for TS-23)
          WorkedTime.create({
            id: 102,
            date: twoDaysAgoStr,
            minutes: 120,
            projectId: 1,
            personId: 1,
            objectiveId: 1
          }),
        ]);
      });
  });

  after(() => {
    return WorkedTime.destroy({where: {}})
      // TS-16 (H-7) crea una ausencia para probar que el tope de horas NO la suma.
      .then(() => UnworkedTime.destroy({where: {}}))
      .then(() => Objective.destroy({where: {}}))
      .then(() => Requirement.destroy({where: {}}))
      .then(() => Person.destroy({where: {}}))
      .then(() => Project.destroy({where: {}}))
      .then(() => User.destroy({where: {}}));
  });

  // TS-8: Happy path - create worked time
  it('should create a worked time record', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 120,
        projectId: 1,
        objectiveId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('minutes', 120);
        response.body.should.have.property('projectId', 1);
        response.body.should.have.property('project');
        response.body.project.should.have.property('id', 1);
        response.body.project.should.have.property('name', 'Proyecto Alpha');
        response.body.project.should.have.property('code', 'ALPHA');
        response.body.should.have.property('objectiveId', 1);
        response.body.should.have.property('objective');
        response.body.objective.should.have.property('id', 1);
        response.body.objective.should.have.property('title', 'Objetivo Test');
        response.body.should.have.property('personId', 1);
        response.body.should.have.property('createdAt');
      });
  });

  // TS-9: Create without objectiveId → null
  it('should create a worked time record without objectiveId', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: fourDaysAgoStr,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('minutes', 60);
        (response.body.objectiveId === null).should.be.true();
        (response.body.objective === null).should.be.true();
      });
  });

  // TS-1: Carga solo a proyecto → requirementId null, objectiveId null
  it('TS-1: should create worked time only to project (no objective, no requirement)', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        (response.body.objectiveId === null).should.be.true();
        (response.body.objective === null).should.be.true();
        (response.body.requirementId === null).should.be.true();
        (response.body.requirement === null).should.be.true();
      });
  });

  // TS-2: Carga imputada a un requisito válido
  it('TS-2: should create worked time imputed to a requirement', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 90,
        projectId: 1,
        requirementId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('requirementId', 1);
        response.body.should.have.property('requirement');
        response.body.requirement.should.have.property('id', 1);
        response.body.requirement.should.have.property('title', 'Req A');
        (response.body.objectiveId === null).should.be.true();
        (response.body.objective === null).should.be.true();
        response.body.should.have.property('projectId', 1);
      });
  });

  // TS-3: Carga a objetivo (de un requisito) no guarda requirement_id
  it('TS-3: should not store requirement_id when imputing to an objective', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        objectiveId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('objectiveId', 1);
        response.body.should.have.property('objective');
        response.body.objective.should.have.property('id', 1);
        (response.body.requirementId === null).should.be.true();
        (response.body.requirement === null).should.be.true();
      });
  });

  // TS-4: Exclusión objetivo ↔ requisito → 400 invalid_fields
  it('TS-4: should fail when both objectiveId and requirementId are provided', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        objectiveId: 1,
        requirementId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-5: Requisito de otro proyecto → 400 requirement_project_mismatch
  it('TS-5: should fail when requirement belongs to a different project', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        requirementId: 2
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('requirement_project_mismatch');
      });
  });

  // TS-6: Requisito inexistente → 400 requirement_not_found
  it('TS-6: should fail when requirement does not exist', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        requirementId: 9999
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('requirement_not_found');
      });
  });

  // TS-7: Estado cancelado válido → 201
  it('TS-7: should accept a requirement in state cancelado', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        requirementId: 3
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('requirementId', 3);
      });
  });

  // TS-8: Estado resuelto válido → 201
  it('TS-8: should accept a requirement in state resuelto', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        requirementId: 4
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('requirementId', 4);
      });
  });

  // TS-9: Límite diario con carga a requisito → 400 daily_limit_exceeded
  // (persona 1 ya tiene 1200 min cargados hoy en el fixture; +300 supera 1440)
  it('TS-9: should enforce daily limit when imputing to a requirement', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: todayStr,
        minutes: 300,
        projectId: 1,
        requirementId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
      });
  });

  // TS-10: Rol externo con carga a requisito → 403 caller_not_authorized
  // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa rol->método de
  // core (S-030, authorizeWithRoles), que responde caller_not_authorized.
  it('TS-10: should deny external-user role when imputing to a requirement', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        requirementId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('caller_not_authorized');
      });
  });

  // TS-10 (orig): Exceeding 24h → 400
  it('should fail when exceeding 24h daily limit', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: todayStr,
        minutes: 300,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
        response.body.should.have.property('remainingMinutes', 240);
      });
  });

  // TS-22: Exact 24h limit → 201
  it('should create when reaching exactly 24h limit', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: todayStr,
        minutes: 240,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('minutes', 240);
      });
  });

  // TS-11: Future date → 400
  it('should fail with future date', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: tomorrowStr,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_date_range');
      });
  });

  // TS-12: Date > 7 days ago → 400
  it('should fail with date older than 7 days', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: HOY_M11,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_date_range');
      });
  });

  // TS-13: User loading other person's hours → 403
  it('should fail when user tries to load hours for another person', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        personId: 2
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-14: Admin loading other person's hours → 201
  it('should allow admin to load hours for another person', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: fiveDaysAgoStr,
        minutes: 60,
        projectId: 1,
        personId: 2
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_03_admin')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('personId', 2);
      });
  });

  // TS-20: Non-existent project → 400
  it('should fail with non-existent project', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 9999
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('project_not_found');
      });
  });

  // TS-21: Non-existent objective → 400
  it('should fail with non-existent objective', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1,
        objectiveId: 9999
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('objective_not_found');
      });
  });

  // TS-23: Second record same project/objective/day → 201
  it('should allow creating second record for same project/objective/day', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: twoDaysAgoStr,
        minutes: 60,
        projectId: 1,
        objectiveId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('minutes', 60);
        response.body.should.have.property('projectId', 1);
        response.body.should.have.property('objectiveId', 1);
      });
  });

  it('should fail without token', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  it('should fail with missing required fields', () => {
    return request(application)
      .post('/api/worked-times')
      .send({})
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // S-034: el rechazo ya no viene de un hasAnyRole de la api -- viene del mapa rol->método de
  // core (S-030, authorizeWithRoles), que responde caller_not_authorized.
  it('should fail with external-user role', () => {
    return request(application)
      .post('/api/worked-times')
      .send({
        date: threeDaysAgoStr,
        minutes: 60,
        projectId: 1
      })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_04_external_user')
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('caller_not_authorized');
      });
  });
  /**
   * S-031 · LAS REGLAS QUE SE FUERON A `core`, EJERCIDAS POR HTTP.
   *
   * Ninguno de estos tests usa `reply()`: el `FakeBus` ejecuta CORE REAL contra la misma base, así
   * que lo que se está verificando es la cadena completa —la api publica con el sobre, `core`
   * decide, la api traduce el reply a HTTP—. Es la única forma de afirmar CA-12 desde acá: que el
   * status y el `code` que ve el frontend son EXACTAMENTE los de antes, aunque ahora los decida
   * otro servicio.
   *
   * Mocha corre los `it` propios de un `describe` ANTES que los de sus hijos, así que para cuando
   * este bloque arranca la Persona 1 ya tiene 1440 minutos cargados en HOY por los tests de
   * arriba. Por eso los escenarios que necesitan cupo usan otras fechas o la Persona 2.
   */
  describe('S-031 · las reglas mudadas a core', () => {
    // TS-1: sin `personId`, core lo resuelve desde el actor (CA-5)
    it('TS-1: crea la hora sin `personId`: core lo resuelve desde el actor', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 120, projectId: 1, objectiveId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('id');
          response.body.should.have.property('minutes', 120);
          response.body.should.have.property('projectId', 1);
          response.body.should.have.property('objectiveId', 1);
          (response.body.requirementId === null).should.be.true();
          response.body.project.should.have.property('name', 'Proyecto Alpha');
          response.body.objective.should.have.property('title', 'Objetivo Test');
          // Lo que prueba CA-5: la Persona salió del actor, no del cuerpo.
          response.body.should.have.property('personId', 1);
        });
    });

    // TS-2: CA-11 en el payload — la api ya no manda `personId` cuando el cuerpo no lo trae
    it('TS-2: publica el comando SIN la clave `personId` y CON el sobre del actor', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1, objectiveId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then(() => {
          (fakeBus.last as any).command.should.equal('worked-times.new');
          const payload = (fakeBus.last as any).payload;
          // NO ALCANZA `payload.personId === undefined`: con `personId: undefined` explícito la
          // clave EXISTIRÍA, y el `FakeBus` no serializa (el bus real sí, y la borraría). Lo que
          // hace verdadera esta aserción es el spread condicional de la ruta (H-5).
          ('personId' in payload).should.be.false();
          payload.actor.id.should.equal('zitadel-sub-01');
          payload.actor.roles.should.containEql('user');
        });
    });

    // TS-3: CA-13 — la traducción `objectiveId` → `taskId` sobrevive
    it('TS-3: conserva la traducción `objectiveId` → `taskId` (CA-13)', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1, objectiveId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then(() => {
          const payload = (fakeBus.last as any).payload;
          payload.taskId.should.equal(1);
          // El nombre del contrato HTTP no viaja al bus: es traducción, no alias.
          ('objectiveId' in payload).should.be.false();
          payload.date.should.equal(HOY_M10);
        });
    });

    // TS-4: borde inferior DENTRO de la ventana (CA-1)
    it('TS-4: acepta el borde inferior exacto de la ventana (hoy − 10)', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('personId', 1);
        });
    });

    // TS-5: borde inferior FUERA de la ventana (CA-1, CA-12)
    it('TS-5: rechaza hoy − 11 con `invalid_date_range`, y el mensaje no cambia', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M11, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_date_range');
          response.body.message.should.equal(
            'Solo se pueden cargar horas del día actual y los 10 días previos'
          );
        });
    });

    // TS-6: borde superior DENTRO de la ventana (CA-1)
    it('TS-6: acepta el día actual', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_02_user')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('personId', 2);
        });
    });

    // TS-7: borde superior FUERA de la ventana (CA-2, CA-12)
    it('TS-7: rechaza mañana con `invalid_date_range` (la ventana también corta hacia adelante)', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: MANANA, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_date_range');
        });
    });

    // TS-8: C-41 — un `user` imputa a otra Persona (CA-3, CA-12)
    it('TS-8: un `user` que imputa a otra Persona recibe 403 `access_denied`', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1, personId: 2 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('access_denied');
          // El texto es el mismo que respondía la api: para el usuario final no cambió nada.
          response.body.message.should.equal('Solo podés cargar tus propias horas');
        });
    });

    // TS-9: CA-4 — un `admin` sí imputa a terceros
    it('TS-9: un `admin` sí imputa a otra Persona, y el `personId` explícito viaja', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1, personId: 2 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_03_admin')
        .expect(201)
        .then((response) => {
          response.body.should.have.property('personId', 2);
          const payload = (fakeBus.last as any).payload;
          payload.personId.should.equal(2);
          payload.actor.roles.should.containEql('admin');
        });
    });

    // TS-10: CA-6 — el `.oxor` de la api ya no existe
    it('TS-10: publica los dos campos excluyentes y es CORE quien rechaza (CA-6)', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1, objectiveId: 1, requirementId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          // LA MITAD QUE IMPORTA: el comando SÍ SE PUBLICÓ. Si el `.oxor` siguiera en la api,
          // `fakeBus.sent` estaría vacío y el test pasaría por la razón equivocada.
          (fakeBus.last as any).command.should.equal('worked-times.new');
          const payload = (fakeBus.last as any).payload;
          payload.taskId.should.equal(1);
          payload.requirementId.should.equal(1);
        });
    });

    // TS-11: CA-5 — actor sin Persona vinculada (CA-12)
    it('TS-11: un actor sin Persona vinculada recibe 400 `person_not_found`', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_05_user_profile')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('person_not_found');
        });
    });

    // TS-12: S-034 elimina `hasAnyRole` de esta ruta (CA-5) -- el rechazo por rol ya no corta
    // en la api, lo decide `core` desde el sobre de identidad (S-030, authorizeWithRoles). El
    // comando SE PUBLICA (a diferencia del comportamiento viejo que este test documentaba).
    it('TS-12: el rol lo decide `core`, no un `hasAnyRole` de la api', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_04_external_user')
        .expect(403)
        .then((response) => {
          response.body.code.should.equal('caller_not_authorized');
          fakeBus.sent.length.should.equal(1);
        });
    });

    // TS-13: Joi de la api sigue validando la FORMA (CA-12, CA-15)
    it('TS-13: la forma del input se sigue validando en el borde del sistema', () => {
      return request(application)
        .post('/api/worked-times')
        .send({})
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('invalid_fields');
          response.body.message.should.startWith('Invalid field - ');
          fakeBus.sent.length.should.equal(0);
        });
    });

    // TS-14: sin token (CA-12)
    it('TS-14: sin token responde 401 `unauthorized`', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .expect(401)
        .then((response) => {
          response.body.code.should.equal('unauthorized');
        });
    });

    // TS-15: tope diario, con `remainingMinutes` recuperado del mensaje (CA-7, CA-12)
    it('TS-15: el tope diario responde 400 con `remainingMinutes`', () => {
      // Día propio: los tests de arriba ya llenaron HOY para la Persona 1, y HOY_M10 lo usan los
      // escenarios de la ventana. Con 1200 previos, 300 más dejan `remainingMinutes: 240`.
      const diaDelTope = dayOffset(-9);
      return WorkedTime.create({
        id: 900, date: diaDelTope, minutes: 1200, projectId: 1, personId: 1,
      })
        .then(() => {
          return request(application)
            .post('/api/worked-times')
            .send({ date: diaDelTope, minutes: 300, projectId: 1 })
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer token_01_user')
            .expect(400);
        })
        .then((response) => {
          response.body.code.should.equal('daily_limit_exceeded');
          // La api lo recupera con un regex sobre el mensaje de core (FG-4 migrará el consumo a
          // `errorDetails`); mientras tanto, esto es lo que el frontend lee.
          response.body.should.have.property('remainingMinutes', 240);
        });
    });

    // TS-16: H-7 — el tope de HORAS no suma ausencias, y es correcto (CA-7)
    it('TS-16: el tope de horas NO suma ausencias (asimetría deliberada, H-7)', () => {
      // 1400 minutos de AUSENCIA para la Persona 2 en HOY. `worked-times.new` cuenta SOLO horas
      // trabajadas —lo dice el contrato del bus—, así que 60 minutos más SE ACEPTAN. La dirección
      // inversa (`unworked-times.new`, que sí suma las dos) es OTRA regla y está cubierta en
      // `unworked-times-post.test.ts`.
      return UnworkedTime.create({
        id: 901, date: HOY, minutes: 1400, reason: 'vacaciones', personId: 2,
      })
        .then(() => {
          return request(application)
            .post('/api/worked-times')
            .send({ date: HOY, minutes: 60, projectId: 1 })
            .set('Accept', 'application/json')
            .set('Authorization', 'Bearer token_02_user')
            .expect(201);
        })
        .then((response) => {
          response.body.should.have.property('personId', 2);
        });
    });

    // TS-17: las referencias inexistentes siguen saliendo del reply de core (CA-12)
    it('TS-17: un proyecto inexistente sigue saliendo 400 `project_not_found`', () => {
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY_M10, minutes: 60, projectId: 9999 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(400)
        .then((response) => {
          response.body.code.should.equal('project_not_found');
        });
    });

    // TS-18: bus caído — la operación NO ocurrió (ADR-002, CA-12)
    it('TS-18: sin suscriptores responde 503 `service_unavailable`', () => {
      fakeBus.failWithNoResponders();
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(503)
        .then((response) => {
          response.body.code.should.equal('service_unavailable');
        });
    });

    // TS-19: bus lento — la operación PUDO ocurrir (ADR-002, CA-12)
    it('TS-19: un timeout responde 504 `gateway_timeout`', () => {
      fakeBus.failWithTimeout();
      return request(application)
        .post('/api/worked-times')
        .send({ date: HOY, minutes: 60, projectId: 1 })
        .set('Accept', 'application/json')
        .set('Authorization', 'Bearer token_01_user')
        .expect(504)
        .then((response) => {
          response.body.code.should.equal('gateway_timeout');
        });
    });
  });
});
