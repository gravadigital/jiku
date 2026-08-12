import 'mocha';
import 'should';
import { start } from '../mocks/app';
import request from 'supertest';
import { Application } from 'express';
import { Person, Project, User, WeekAssignedTime } from '@jiku/models';

describe('PUT /api/week-assigned-times', () => {
  let application: Application;

  before(function() {
    application = start();

    // Crear usuarios, personas, proyectos de prueba
    return Promise.all([
      User.create({
        id: 'zitadel-sub-01',
        name: 'User 01',
        username: 'user01',
        email: 'user01@mail.com'
      }),
      User.create({
        id: 'zitadel-sub-03',
        name: 'Admin User',
        username: 'admin01',
        email: 'admin@mail.com'
      })
    ])
      .then(() => {
        return Promise.all([
          Person.create({
            id: 1,
            firstName: 'John',
            lastName: 'Doe',
            enabled: true,
            initDate: new Date(),
            mustChargeWorkedTime: true
          }),
          Project.create({
            id: 3,
            code: 'INT',
            name: 'Internal Project',
            type: 'interno',
            status: 'activo',
            initDate: new Date(),
            priority: 1,
            createdBy: 'zitadel-sub-01'
          }),
          Project.create({
            id: 7,
            code: 'COM',
            name: 'Commercial Project',
            type: 'comercial',
            status: 'activo',
            initDate: new Date(),
            priority: 1,
            createdBy: 'zitadel-sub-01'
          })
        ]);
      });
  });

  after(() => {
    // Limpiar datos de prueba
    return WeekAssignedTime.destroy({ where: {} })
      .then(() => Project.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  // TS-11: Sin token de autenticación
  it('should fail without token', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .send({ weekStart: '2026-02-10', allocations: [] })
      .expect(401)
      .then((response) => {
        response.body.code.should.equal('unauthorized');
      });
  });

  // TS-3: Usuario con rol "user" intenta crear asignaciones
  it('should fail with user role', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_01_user')
      .send({ weekStart: '2026-02-10', allocations: [] })
      .expect(403)
      .then((response) => {
        response.body.code.should.equal('access_denied');
      });
  });

  // TS-8: weekStart con formato inválido
  it('should fail with invalid weekStart format', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ weekStart: 'no-es-fecha', allocations: [] })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-9: allocations con datos inválidos (personId faltante)
  it('should fail with missing personId in allocation', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: '2026-02-10',
        allocations: [{ projectId: 3, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-10: allocations con minutes negativo
  it('should fail with negative minutes', () => {
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: '2026-02-10',
        allocations: [{ personId: 1, projectId: 3, minutes: -100 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_fields');
      });
  });

  // TS-5: Admin intenta editar semana pasada
  it('should fail when trying to modify past week', () => {
    // Calcular una fecha de semana pasada (lunes hace 2 semanas)
    const pastWeek = new Date();
    pastWeek.setDate(pastWeek.getDate() - 14);
    // Ajustar al lunes
    const dayOfWeek = pastWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    pastWeek.setDate(pastWeek.getDate() + diff);
    const pastWeekStr = pastWeek.toISOString().split('T')[0];

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: pastWeekStr,
        allocations: [{ personId: 1, projectId: 3, minutes: 900 }]
      })
      .expect(400)
      .then((response) => {
        response.body.code.should.equal('invalid_week');
        response.body.message.should.equal('No se pueden modificar semanas pasadas');
      });
  });

  // TS-1: Crear asignaciones para semana futura exitosamente
  it('should create allocations successfully for future week', () => {
    // Calcular una fecha de semana futura (lunes dentro de 2 semanas)
    const futureWeek = new Date();
    futureWeek.setDate(futureWeek.getDate() + 14);
    // Ajustar al lunes
    const dayOfWeek = futureWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    futureWeek.setDate(futureWeek.getDate() + diff);
    const weekStart = futureWeek.toISOString().split('T')[0];

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 900 }
        ]
      })
      .expect(200)
      .then((response) => {
        response.body.should.have.property('weekStart');
        response.body.should.have.property('weekEnd');
        response.body.should.have.property('allocations');
        response.body.allocations.should.have.length(2);

        // TS-13: Verificar derivación de internal=true (proyecto interno)
        const internalAlloc = response.body.allocations.find((a: any) => a.projectId === 3);
        internalAlloc.internal.should.be.true();

        // TS-14: Verificar derivación de internal=false (proyecto comercial)
        const commercialAlloc = response.body.allocations.find((a: any) => a.projectId === 7);
        commercialAlloc.internal.should.be.false();
      });
  });

  // TS-2: Actualizar asignaciones existentes reemplazando totalmente
  it('should replace existing allocations with new ones', () => {
    // Calcular una fecha de semana futura (lunes dentro de 3 semanas)
    const futureWeek = new Date();
    futureWeek.setDate(futureWeek.getDate() + 21);
    // Ajustar al lunes
    const dayOfWeek = futureWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    futureWeek.setDate(futureWeek.getDate() + diff);
    const weekStart = futureWeek.toISOString().split('T')[0];

    // Primero crear asignaciones iniciales
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 900 }
        ]
      })
      .expect(200)
      .then(() => {
        // Ahora actualizar con una lista diferente
        return request(application)
          .put('/api/week-assigned-times')
          .set('Authorization', 'Bearer token_03_admin')
          .send({
            weekStart: weekStart,
            allocations: [
              { personId: 1, projectId: 3, minutes: 1800 }
            ]
          })
          .expect(200);
      })
      .then((response) => {
        response.body.allocations.should.have.length(1);
        response.body.allocations[0].projectId.should.equal(3);
        response.body.allocations[0].minutes.should.equal(1800);
      });
  });

  // TS-6: Eliminar asignación individual enviando minutes=0
  it('should not create allocation when minutes is 0', () => {
    // Calcular una fecha de semana futura (lunes dentro de 4 semanas)
    const futureWeek = new Date();
    futureWeek.setDate(futureWeek.getDate() + 28);
    // Ajustar al lunes
    const dayOfWeek = futureWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    futureWeek.setDate(futureWeek.getDate() + diff);
    const weekStart = futureWeek.toISOString().split('T')[0];

    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 0 }
        ]
      })
      .expect(200)
      .then((response) => {
        // Solo debe crear la asignación con minutes > 0
        response.body.allocations.should.have.length(1);
        response.body.allocations[0].projectId.should.equal(3);
      });
  });

  // TS-7: Eliminar asignación individual omitiéndola de la lista
  it('should delete allocation when omitted from list', () => {
    // Calcular una fecha de semana futura (lunes dentro de 5 semanas)
    const futureWeek = new Date();
    futureWeek.setDate(futureWeek.getDate() + 35);
    // Ajustar al lunes
    const dayOfWeek = futureWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    futureWeek.setDate(futureWeek.getDate() + diff);
    const weekStart = futureWeek.toISOString().split('T')[0];

    // Primero crear dos asignaciones
    return request(application)
      .put('/api/week-assigned-times')
      .set('Authorization', 'Bearer token_03_admin')
      .send({
        weekStart: weekStart,
        allocations: [
          { personId: 1, projectId: 3, minutes: 900 },
          { personId: 1, projectId: 7, minutes: 900 }
        ]
      })
      .expect(200)
      .then(() => {
        // Ahora actualizar con solo una asignación (omitir la del proyecto 7)
        return request(application)
          .put('/api/week-assigned-times')
          .set('Authorization', 'Bearer token_03_admin')
          .send({
            weekStart: weekStart,
            allocations: [
              { personId: 1, projectId: 3, minutes: 900 }
            ]
          })
          .expect(200);
      })
      .then((response) => {
        // Solo debe quedar la asignación del proyecto 3
        response.body.allocations.should.have.length(1);
        response.body.allocations[0].projectId.should.equal(3);
      });
  });
});
