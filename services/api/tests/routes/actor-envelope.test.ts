import 'mocha';
import 'should';
import request from 'supertest';
import { Application } from 'express';
import {
  Client,
  Person,
  Project,
  Requirement,
  RequirementActivity,
  User,
  WorkedTime,
} from '@jiku/models';
import { start } from '../mocks/app';
import { fakeBus } from '../mocks/bus';

function getDateStr(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * El sobre de identidad, verificado DE PUNTA A PUNTA (S-029).
 *
 * Ninguno de estos tests usa `reply()` ni `replyDefault()`: el `FakeBus` ejecuta CORE REAL contra
 * la misma base, así que un test de ruta de la api recorre las cuatro etapas del diseño —la api
 * arma el sobre, core lo acepta por venir del publicador de confianza, lo espeja en `users` en su
 * PROPIA transacción y recién entonces ejecuta el comando—. Es la única forma de observar desde
 * acá CA-5, CA-6, CA-8, CA-9 y CA-16, y es la más barata: el andamiaje ya existía.
 *
 * Los dos que más importan son TS-16 (el espejo sobrevive al rollback del comando) y TS-6 (los
 * roles salen del claim y no de la fila). El primero es la propiedad más contraintuitiva del
 * diseño; el segundo es el que se pone rojo si alguien "mejora" `buildActor` leyendo `req.user`.
 */
describe('El sobre de identidad en los comandos de la api (S-029)', () => {
  let application: Application;
  /**
   * El requisito del fixture se crea SIN id explícito y su id se guarda acá.
   *
   * No es cosmético: sembrar `id: 1` a mano deja la secuencia de PostgreSQL atrás, y el primer
   * `requirements.new` que ejecuta core real choca con la PK y sale 500 "Validation error", muy
   * lejos de su causa. En un archivo que ejecuta comandos DE VERDAD, los ids los pone la base.
   */
  let requirementId: number;

  const todayStr = getDateStr(0);

  before(() => {
    application = start();

    return Promise.all([
      User.create({ id: 'zitadel-sub-01', name: 'User 01', username: 'user01', email: 'user01@mail.com' }),
      User.create({ id: 'zitadel-sub-03', name: 'Admin 01', username: 'admin01', email: 'admin01@mail.com' }),
      // La fila del token CON claims de perfil. Se siembra con valores propios para que se vea
      // que el espejo los reemplaza con los del claim, que es lo que `pickPresent` hace cuando el
      // campo VINO.
      User.create({ id: 'zitadel-sub-05', name: 'Sin perfil', username: 'sin-perfil', email: 'sin-perfil@mail.com' }),
    ])
      .then(() => Project.create({
        id: 1,
        code: 'ALPHA',
        name: 'Proyecto Alpha',
        type: 'comercial',
        status: 'activo',
        priority: 5,
        initDate: new Date(),
        createdBy: 'zitadel-sub-01',
      }))
      .then(() => Promise.all([
        Requirement.create({
          title: 'Req para comentar',
          description: 'Desc',
          type: 'funcionalidad',
          priority: 'sin_prioridad',
          state: 'analisis',
          estimatedFinishDate: '2026-07-01',
          projectId: 1,
          tags: null,
          createdBy: 'zitadel-sub-01',
        }).then((requirement) => {
          requirementId = requirement.id;
        }),
        // La persona del usuario `token_01_user`: es lo que hace que TS-16 atraviese las tres
        // validaciones que la api todavía conserva (se mudan en S-031).
        Person.create({
          id: 1,
          firstName: 'Juan',
          lastName: 'Pérez',
          enabled: true,
          mustChargeWorkedTime: true,
          initDate: new Date('2024-01-01'),
          userId: 'zitadel-sub-01',
        }),
      ]));
  });

  after(() => {
    // El orden respeta las FKs: lo que apunta antes que lo apuntado.
    return WorkedTime.destroy({ where: {} })
      .then(() => RequirementActivity.destroy({ where: {} }))
      .then(() => Requirement.destroy({ where: {} }))
      .then(() => Client.destroy({ where: {} }))
      .then(() => Person.destroy({ where: {} }))
      .then(() => Project.destroy({ where: {} }))
      .then(() => User.destroy({ where: {} }));
  });

  beforeEach(() => {
    fakeBus.reset();
  });

  afterEach(() => {
    return Client.destroy({ where: {} });
  });

  // TS-5 (CA-14): el `id` del sobre es el `sub` del claim. No el `personId`, no el service user
  // de la api que arma el subject: la persona que apretó el botón.
  it('TS-5: `actor.id` es el `sub` del claim', async () => {
    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme' })
      .expect(201);

    (fakeBus.last as any).payload.actor.id.should.equal('zitadel-sub-01');
  });

  // TS-7 (CA-14, CA-11): sin claims de perfil las tres claves NO VIAJAN. La aserción es sobre las
  // claves y no sobre los valores a propósito: una clave presente con `undefined` sería un caso
  // distinto para el espejo, que distingue "no lo mandaron" de "lo mandaron vacío".
  it('TS-7: sin claims de perfil el sobre tiene exactamente `id` y `roles`', async () => {
    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme' })
      .expect(201);

    Object.keys((fakeBus.last as any).payload.actor).sort().should.deepEqual(['id', 'roles']);
  });

  // TS-6 (CA-14) — EL TEST QUE PROTEGE LA DECISIÓN DE `buildActor`.
  //
  // Los `roles` de la fila CONTRADICEN el claim a propósito: es la única forma de distinguir
  // desde afuera "el sobre sale del claim" de "el sobre sale de la base". Si este test se pone
  // rojo, la pregunta no es cómo arreglarlo: es si alguien cambió `buildActor` para leer
  // `req.user`, que es lo que ADR-007 prohíbe.
  //
  // La fila se siembra DENTRO del test y no en el `before` porque después del primer comando el
  // espejo deja `users.roles = ['user']`: sembrada afuera, la contradicción ya no existiría y el
  // test pasaría por la razón equivocada.
  it('TS-6: `actor.roles` sale del claim, no de `users.roles`', async () => {
    await User.update({ roles: ['external-user'] }, { where: { id: 'zitadel-sub-01' } });

    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme' })
      .expect(201);

    (fakeBus.last as any).payload.actor.roles.should.deepEqual(['user']);
  });

  // TS-8 (CA-14): con los tres claims de perfil, viajan los tres — y `preferred_username` llega
  // como `username`, que es como se llama en el sobre y en la columna.
  it('TS-8: con claims de perfil el sobre lleva los cinco campos', async () => {
    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_05_user_profile')
      .send({ name: 'Acme' })
      .expect(201);

    (fakeBus.last as any).payload.actor.should.deepEqual({
      id: 'zitadel-sub-05',
      roles: ['user'],
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
    });
  });

  // TS-10 (CA-6, CA-7): `creator` sigue viajando —es DATO DE DOMINIO, termina en
  // `requirements.created_by`— y vale lo mismo que `actor.id`. Que coincidan es lo que evita el
  // rechazo de core por CA-6: dos identidades distintas en un mismo comando son un error del
  // publicador, no una elección.
  it('TS-10: `creator` y `actor.id` coinciden y core no rechaza', async () => {
    const response = await request(application)
      .post('/api/requirements')
      .set('Authorization', 'Bearer token_03_admin')
      .send({ title: 'Requisito con sobre', description: 'Desc', projectId: 1 })
      .expect(201);

    // El `.expect(201)` de arriba ES la aserción de que core NO respondió 400 `invalid_fields`:
    // si el sobre y `creator` difirieran, CA-6 habría rechazado el comando y no habría requisito.
    const payload = (fakeBus.last as any).payload;
    payload.creator.should.equal(payload.actor.id);
    payload.actor.id.should.equal('zitadel-sub-03');

    await Requirement.destroy({ where: { id: response.body.id } });
  });

  // TS-12 (CA-6, CA-7, CA-16): la Actividad queda A NOMBRE DE QUIEN ACTÚA, no del service user de
  // la api. Y sin tocar el comando: `requirements.{id}.comment` sigue leyendo `payload.author`,
  // que ya ES el del sobre por construcción — o core habría rechazado el comando por CA-6.
  it('TS-12: la Actividad queda a nombre de la persona del sobre', async () => {
    const response = await request(application)
      .post(`/api/requirements/${requirementId}/comments`)
      .set('Authorization', 'Bearer token_01_user')
      .send({ comment: 'Un comentario' })
      .expect(201);

    const payload = (fakeBus.last as any).payload;
    payload.author.should.equal(payload.actor.id);
    payload.actor.id.should.equal('zitadel-sub-01');

    const activity = await RequirementActivity.findByPk(response.body.id);
    (activity !== null).should.be.true();
    activity!.changedBy.should.equal('zitadel-sub-01');

    await RequirementActivity.destroy({ where: {} });
  });

  // TS-14 (CA-14, CA-5): core ACEPTA el sobre del publicador de confianza. Sin `reply()` fijo, así
  // que el 201 es prueba de que el comando se ejecutó de verdad: si el `caller` no fuera el
  // publicador de confianza, CA-3 lo habría rechazado con 400 `invalid_fields` y no habría fila.
  it('TS-14: core acepta el sobre y ejecuta el comando', async () => {
    const response = await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme', description: 'd' })
      .expect(201);

    const client = await Client.findByPk(response.body.id);
    (client !== null).should.be.true();
    client!.name.should.equal('Acme');
  });

  // TS-15 (CA-8, CA-9): el espejo CORRIGE una fila vieja. Es el caso de las filas cargadas a mano
  // antes de REQ-005, que quedaron con `roles: []` y no autorizan nada: cualquier comando desde la
  // api las deja al día, porque el rol viaja en el sobre.
  it('TS-15: el espejo corrige `users.roles` e `identityType`', async () => {
    await User.update({ roles: [], identityType: 'service' }, { where: { id: 'zitadel-sub-01' } });

    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme' })
      .expect(201);

    const user = await User.findByPk('zitadel-sub-01');
    user!.roles.should.deepEqual(['user']);
    user!.identityType.should.equal('person');
  });

  // TS-16 (CA-9, CA-17) — LA PRUEBA MÁS IMPORTANTE DE LA STORY.
  //
  // El espejo corre en su PROPIA transacción y ANTES de la compuerta, así que sobrevive al
  // rollback del comando: el hecho sobre la IDENTIDAD queda, el hecho sobre la OPERACIÓN no.
  //
  // `minutes: 1441` supera el tope diario de core (1440) SIN tener `max` en el Joi de la api, así
  // que el 400 llega DEL REPLY y no del borde HTTP. Es exactamente lo que hace falta: cuando el
  // comando falla, el espejo YA CORRIÓ.
  it('TS-16: el espejo queda aunque el comando falle por una regla de dominio', async () => {
    await User.update({ roles: [] }, { where: { id: 'zitadel-sub-01' } });
    const before = await WorkedTime.count();

    const response = await request(application)
      .post('/api/worked-times')
      .set('Accept', 'application/json')
      .set('Authorization', 'Bearer token_01_user')
      .send({ date: todayStr, minutes: 1441, projectId: 1, personId: 1 })
      .expect(400);

    response.body.code.should.equal('daily_limit_exceeded');

    // El hecho sobre la IDENTIDAD quedó...
    const user = await User.findByPk('zitadel-sub-01');
    user!.roles.should.deepEqual(['user']);
    user!.identityType.should.equal('person');

    // ...y el hecho sobre la OPERACIÓN no.
    (await WorkedTime.count()).should.equal(before);
  });

  // TS-17 (CA-11): el espejo es BEST-EFFORT en los campos de perfil. Un sobre sin `name` no borra
  // el nombre que la fila ya tenía — `pickPresent` sólo escribe lo que vino—, que es la diferencia
  // deliberada con el camino del evento, que descarta sin crear fila parcial.
  it('TS-17: un sobre sin `name` no pisa el perfil que la fila ya tenía', async () => {
    await User.update(
      { name: 'User 01', username: 'user01', email: 'user01@mail.com' },
      { where: { id: 'zitadel-sub-01' } }
    );

    await request(application)
      .post('/api/clients')
      .set('Authorization', 'Bearer token_01_user')
      .send({ name: 'Acme' })
      .expect(201);

    const user = await User.findByPk('zitadel-sub-01');
    user!.name.should.equal('User 01');
    user!.username.should.equal('user01');
    user!.email!.should.equal('user01@mail.com');
  });
});
