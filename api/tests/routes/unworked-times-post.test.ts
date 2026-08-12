import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, UnworkedTime, User, WorkedTime } from '@jiku/models';

describe('POST /api/unworked-times', () => {
  let application: Application;

  const todayStr = new Date().toISOString().split('T')[0];

  before(function() {
    application = start();

    return User.create({
      id: 'zitadel-sub-01',
      name: 'User 01',
      username: 'user01',
      email: 'user01@mail.com',
    })
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'Juan',
            lastName: 'Pérez',
            enabled: true,
            mustChargeWorkedTime: true,
            initDate: new Date('2024-01-01'),
            userId: 'zitadel-sub-01',
          }),
          Project.create({
            id: 1,
            code: 'ALPHA',
            name: 'Proyecto Alpha',
            type: 'comercial',
            status: 'activo',
            priority: 5,
            initDate: new Date(),
            createdBy: 'zitadel-sub-01',
          }),
        ]);
      })
  });

  after(() => {
    return UnworkedTime.destroy({ where: {} })
      .then(() => WorkedTime.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-03: POST valid → 201 with record
  it('should create unworked time and return 201', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 480, reason: 'vacaciones', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(201)
      .then((response) => {
        response.body.should.have.property('id');
        response.body.should.have.property('date');
        response.body.should.have.property('minutes', 480);
        response.body.should.have.property('reason', 'vacaciones');
        response.body.should.have.property('personId', 1);
        response.body.should.have.property('createdAt');
      });
  });

  // TS-04: No token → 401
  it('should return 401 without token', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 60, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-05: Invalid reason → 400 invalid_fields
  it('should return 400 with invalid reason', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 60, reason: 'vacaciones_extra', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-06: Missing date → 400 invalid_fields
  it('should return 400 when date is missing', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ minutes: 60, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-07: minutes=0 → 400 invalid_fields
  it('should return 400 when minutes is 0', () => {
    return request(application)
      .post('/api/unworked-times')
      .send({ date: todayStr, minutes: 0, reason: 'medico', personId: 1 })
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-08: Exceeds 1440 summing worked_times → 400 daily_limit_exceeded
  it('should return 400 when daily limit exceeded (via worked_times)', () => {
    return WorkedTime.create({
      id: 200,
      date: todayStr,
      minutes: 800,
      projectId: 1,
      personId: 1,
    })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 700, reason: 'tramite', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(400);
      })
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
      });
  });

  // TS-09: Exceeds 1440 summing unworked_times → 400 daily_limit_exceeded
  it('should return 400 when daily limit exceeded (via unworked_times)', () => {
    return UnworkedTime.create({
      id: 300,
      date: todayStr,
      minutes: 900,
      reason: 'estudio',
      personId: 1,
    })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 600, reason: 'tramite', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(400);
      })
      .then((response) => {
        response.body.code.should.equal('daily_limit_exceeded');
      });
  });

  // TS-10: Exactly 1440 minutes → 201 Created
  it('should return 201 when total is exactly 1440 minutes', () => {
    // Clean up previous test data and set exactly 720 already registered
    return UnworkedTime.destroy({ where: {} })
      .then(() => WorkedTime.destroy({ where: {} }))
      .then(() => {
        return WorkedTime.create({
          id: 201,
          date: todayStr,
          minutes: 720,
          projectId: 1,
          personId: 1,
        });
      })
      .then(() => {
        return request(application)
          .post('/api/unworked-times')
          .send({ date: todayStr, minutes: 720, reason: 'vacaciones', personId: 1 })
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer token_01_user')
          .expect(201);
      })
      .then((response) => {
        response.body.should.have.property('minutes', 720);
      });
  });
});
