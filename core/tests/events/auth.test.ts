import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Op } from 'sequelize';
import { IdentityType, Person, User, UserProjectPermission } from '@jiku/models';
import logger from '../../src/logger';
import { EventDispatcher } from '../../src/events/dispatcher';
import { syncUser } from '../../src/events/auth/user-sync';

const PERSON_ID = '281234567890123456';
const SERVICE_ID = '281234567890999999';

/** Evento válido mínimo, sobre el que cada test cambia UN campo. */
const validEvent = (): Record<string, unknown> => ({
  type: 'authenticated',
  version: 1,
  id: PERSON_ID,
  name: 'Ana Pérez',
  username: 'ana@grava.digital',
  email: 'ana@grava.digital',
  roles: ['user'],
  instance: 'dev',
  identity_type: 'person',
});

/**
 * Se construye con el handler REAL. `syncUser()` NUNCA se llama directamente: los tests entran
 * por el despachador, que es lo único que verifica el comportamiento transaccional (ADR-013).
 */
function dispatcher(): EventDispatcher {
  return new EventDispatcher(syncUser);
}

describe('events/auth/user-sync', () => {
  afterEach(async () => {
    // SOLO los dos ids de este archivo: otras suites siembran usuarios y el truncado es al
    // arrancar la corrida, no entre tests.
    await User.destroy({ where: { id: { [Op.in]: [PERSON_ID, SERVICE_ID] } } });
    sinon.restore();
  });

  it('TS-15 · un evento válido CREA la fila con los seis valores', async () => {
    const info = sinon.spy(logger, 'info');

    await dispatcher().dispatch(validEvent());

    const user = (await User.findByPk(PERSON_ID))!;
    user.id.should.equal(PERSON_ID);
    user.name.should.equal('Ana Pérez');
    user.username.should.equal('ana@grava.digital');
    user.email.should.equal('ana@grava.digital');
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
    info.callCount.should.equal(1);
    String(info.firstCall.args[0]).should.equal(`[events] ${PERSON_ID}: created`);
  });

  it('TS-16 · un segundo evento SOBREESCRIBE los cinco campos en LA MISMA fila', async () => {
    await dispatcher().dispatch(validEvent());
    const info = sinon.spy(logger, 'info');

    await dispatcher().dispatch({
      ...validEvent(),
      name: 'Ana Gómez',
      username: 'agomez@grava.digital',
      email: 'agomez@grava.digital',
      roles: ['user', 'admin'],
    });

    // UNA sola fila, sin duplicado.
    (await User.count({ where: { id: PERSON_ID } })).should.equal(1);
    const user = (await User.findByPk(PERSON_ID))!;
    user.name.should.equal('Ana Gómez');
    user.username.should.equal('agomez@grava.digital');
    user.email.should.equal('agomez@grava.digital');
    user.roles.should.deepEqual(['user', 'admin']);
    info.callCount.should.equal(1);
    String(info.firstCall.args[0]).should.equal(`[events] ${PERSON_ID}: updated`);
  });

  it('TS-17 · el service user del conector externo se espeja igual que una persona', async () => {
    await dispatcher().dispatch(validEvent());

    await dispatcher().dispatch({
      ...validEvent(),
      id: SERVICE_ID,
      name: 'External Connector',
      username: 'external-connector',
      email: 'connector@grava.digital',
      roles: ['external-publisher'],
      identity_type: 'service',
    });

    const service = (await User.findByPk(SERVICE_ID))!;
    service.roles.should.deepEqual(['external-publisher']);
    service.identityType.should.equal('service');
    // La fila de la persona NO se tocó: el espejado es por PK.
    const person = (await User.findByPk(PERSON_ID))!;
    person.name.should.equal('Ana Pérez');
    person.identityType.should.equal('person');
  });

  it('TS-18 · roles se REEMPLAZA ENTERO, no se mergea (la trampa del JSONB)', async () => {
    await User.create({
      id: PERSON_ID,
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
      roles: ['admin', 'user', 'external-user'],
      identityType: IdentityType.Person,
    } as any);

    await dispatcher().dispatch({ ...validEvent(), roles: ['user'] });

    const user = (await User.findByPk(PERSON_ID))!;
    // Exactamente un elemento. Un `update` de un campo JSONB reemplaza el valor entero: es la
    // semántica buscada, verificada donde el ORM podría haber hecho otra cosa.
    user.roles.should.deepEqual(['user']);
  });

  it('TS-19 · identity_type ausente → person (el default de la columna)', async () => {
    const event = validEvent();
    delete event.identity_type;

    await dispatcher().dispatch(event);

    const user = (await User.findByPk(PERSON_ID))!;
    // El evento NO se descarta: los obligatorios son cuatro y este no es uno.
    user.identityType.should.equal('person');
  });

  it('TS-20 · identity_type fuera del enum → DESCARTA, sin tocar la fila', async () => {
    await User.create({
      id: PERSON_ID,
      name: 'External Connector',
      username: 'external-connector',
      email: 'connector@grava.digital',
      roles: ['external-publisher'],
      identityType: IdentityType.Service,
    } as any);
    const warn = sinon.spy(logger, 'warn');

    await dispatcher().dispatch({ ...validEvent(), identity_type: 'robot' });

    warn.callCount.should.equal(1);
    // Sin la validación Joi esto sería un error de Postgres -> rollback -> evento perdido SIN
    // `warn`: la columna es un ENUM nativo en producción.
    const user = (await User.findByPk(PERSON_ID))!;
    user.identityType.should.equal('service');
  });

  it('TS-21 · el log distingue ALTA de ACTUALIZACIÓN', async () => {
    const info = sinon.spy(logger, 'info');

    await dispatcher().dispatch(validEvent());
    await dispatcher().dispatch(validEvent());

    info.callCount.should.equal(2);
    // Es la razón por la que no se usa `sequelize.upsert()`: es el dato que se quiere al
    // diagnosticar por qué una identidad no tiene los roles que debería.
    String(info.getCall(0).args[0]).should.endWith(': created');
    String(info.getCall(1).args[0]).should.endWith(': updated');
  });

  it('TS-22 · un evento NO crea Persona ni permisos de proyecto', async () => {
    await dispatcher().dispatch(validEvent());

    // El candado de alcance: el alta de Persona y el CRUD de permisos son FG-1, no esta story.
    (await Person.count()).should.equal(0);
    (await UserProjectPermission.count()).should.equal(0);
  });

  it('TS-23 · el evento es IDEMPOTENTE: N veces el mismo payload deja el mismo estado', async () => {
    await dispatcher().dispatch(validEvent());
    await dispatcher().dispatch(validEvent());
    await dispatcher().dispatch(validEvent());

    // Es lo que hace que el queue group sea una optimización y no una necesidad de corrección:
    // dos réplicas procesando el mismo evento escribirían lo mismo.
    (await User.count({ where: { id: PERSON_ID } })).should.equal(1);
    const user = (await User.findByPk(PERSON_ID))!;
    user.name.should.equal('Ana Pérez');
    user.username.should.equal('ana@grava.digital');
    user.email.should.equal('ana@grava.digital');
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
  });
});
