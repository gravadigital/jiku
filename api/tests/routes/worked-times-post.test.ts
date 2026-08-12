import 'mocha';
import 'should';
import {start} from '../mocks/app';
import request from 'supertest';
import {Application} from 'express';
import { Objective, Person, Project, Requirement, User, WorkedTime } from '@jiku/models';

function getDateStr(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

describe('POST /api/worked-times', () => {
  let application: Application;

  const todayStr = getDateStr(0);
  const twoDaysAgoStr = getDateStr(-2);
  const threeDaysAgoStr = getDateStr(-3);
  const fourDaysAgoStr = getDateStr(-4);
  const fiveDaysAgoStr = getDateStr(-5);
  const eightDaysAgoStr = getDateStr(-11);
  const tomorrowStr = getDateStr(1);

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

  // TS-10: Rol externo con carga a requisito → 403 access_denied
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
        response.body.code.should.equal('access_denied');
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
        date: eightDaysAgoStr,
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
        response.body.code.should.equal('access_denied');
      });
  });
});
