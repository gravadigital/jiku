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
  version: 2,
  id: PERSON_ID,
  name: 'Ana Pérez',
  username: 'ana@grava.digital',
  email: 'ana@grava.digital',
  roles: ['user'],
  instance: 'dev',
  matched_role: 'admin',
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
    user.email!.should.equal('ana@grava.digital');
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
    user.email!.should.equal('agomez@grava.digital');
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
      roles: ['internal-app'],
      matched_role: 'internal-app',
    });

    const service = (await User.findByPk(SERVICE_ID))!;
    service.roles.should.deepEqual(['internal-app']);
    service.identityType.should.equal('service');
    // La fila de la persona NO se tocó: el espejado es por PK.
    const person = (await User.findByPk(PERSON_ID))!;
    person.name.should.equal('Ana Pérez');
    person.identityType.should.equal('person');
  });

  it('TS-17b · un service user SIN email se espeja igual, con `email` en NULL', async () => {
    const info = sinon.spy(logger, 'info');
    const event: Record<string, unknown> = {
      ...validEvent(),
      id: SERVICE_ID,
      name: 'Jiku API',
      username: 'jiku-api',
      roles: ['internal-app'],
      matched_role: 'internal-app',
    };
    // Zitadel no devuelve el claim `email` en `userinfo` para un machine user, así que el
    // callout OMITE la clave. Es el evento tal cual llega en producción.
    delete event.email;

    await dispatcher().dispatch(event);

    const service = (await User.findByPk(SERVICE_ID))!;
    // La fila EXISTE, que es lo único que las dos compuertas del bus miran. Sin ella, este
    // service user recibe `caller_not_authorized` en todo comando y `unknown_caller` en toda
    // consulta.
    (service.email === null).should.be.true();
    service.name.should.equal('Jiku API');
    service.username.should.equal('jiku-api');
    service.roles.should.deepEqual(['internal-app']);
    service.identityType.should.equal('service');
    String(info.firstCall.args[0]).should.equal(`[events] ${SERVICE_ID}: created`);
  });

  it('TS-17c · las tres formas de "no hay email" dejan la MISMA fila', async () => {
    const service = (): Record<string, unknown> => ({
      ...validEvent(),
      id: SERVICE_ID,
      name: 'Jiku API',
      username: 'jiku-api',
      roles: ['internal-app'],
      matched_role: 'internal-app',
    });

    // Ausente. El callout omite la clave cuando `userinfo` no trae el claim.
    const absent = service();
    delete absent.email;
    await dispatcher().dispatch(absent);
    ((await User.findByPk(SERVICE_ID))!.email === null).should.be.true();

    // Cadena vacía. Es la forma que toma el evento si `CALLOUT_IDP_ENRICH` no está configurado
    // — el compose lo documenta: "sin esta línea los eventos llegan con los dos campos vacíos".
    await dispatcher().dispatch({ ...service(), email: '' });
    ((await User.findByPk(SERVICE_ID))!.email === null).should.be.true();

    // `null` explícito, por si el emisor cambia de forma de decirlo.
    await dispatcher().dispatch({ ...service(), email: null });
    ((await User.findByPk(SERVICE_ID))!.email === null).should.be.true();

    // Una sola fila en las tres: el espejado es por PK y es idempotente.
    (await User.count({ where: { id: SERVICE_ID } })).should.equal(1);
  });

  it('TS-17d · un service user CON email conserva el valor, no se anula', async () => {
    await dispatcher().dispatch({
      ...validEvent(),
      id: SERVICE_ID,
      name: 'External Connector',
      username: 'external-connector',
      email: 'connector@grava.digital',
      roles: ['internal-app'],
      matched_role: 'internal-app',
    });

    // La excepción es "puede no tener", no "no tiene". Un service user con dirección declarada
    // en Zitadel la conserva: el reemplazo total no la pisa con `null`.
    (await User.findByPk(SERVICE_ID))!.email!.should.equal('connector@grava.digital');
  });

  it('TS-17e · un service user que PIERDE el email lo deja en NULL (reemplazo total)', async () => {
    await dispatcher().dispatch({
      ...validEvent(),
      id: SERVICE_ID,
      name: 'External Connector',
      username: 'external-connector',
      email: 'connector@grava.digital',
      roles: ['internal-app'],
      matched_role: 'internal-app',
    });

    const withoutEmail: Record<string, unknown> = {
      ...validEvent(),
      id: SERVICE_ID,
      name: 'External Connector',
      username: 'external-connector',
      roles: ['internal-app'],
      matched_role: 'internal-app',
    };
    delete withoutEmail.email;
    await dispatcher().dispatch(withoutEmail);

    // El handler es REEMPLAZO TOTAL, no edición parcial: si Zitadel deja de declarar la
    // dirección, la fila deja de tenerla. Es la misma semántica que ya tiene `roles`.
    ((await User.findByPk(SERVICE_ID))!.email === null).should.be.true();
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

  it('TS-19 · matched_role ausente → person (la rama segura de siempre)', async () => {
    const event = validEvent();
    delete event.matched_role;

    await dispatcher().dispatch(event);

    const user = (await User.findByPk(PERSON_ID))!;
    // El evento NO se descarta: los obligatorios son cuatro y este no es uno. Desde S-069 el
    // valor se DERIVA, y la ausencia da `person` — el mismo resultado que el default de la v1.
    user.identityType.should.equal('person');
  });

  it('TS-20 · un matched_role DESCONOCIDO se espeja como person, y NO descarta', async () => {
    // ESTE TEST CAMBIÓ DE SENTIDO EN S-069, y conviene decir por qué en vez de borrarlo. Probaba
    // que un `identity_type` fuera del enum DESCARTABA el evento: sin esa validación Joi, la
    // columna —un ENUM nativo en producción— habría dado un error de Postgres, rollback, y un
    // evento perdido SIN `warn`.
    //
    // Esa guarda ya no puede existir porque EL CAMPO NO VIAJA. Y su motivo tampoco: el valor sale
    // de `identityTypeFromMatchedRole`, cuyo tipo de retorno es `IdentityType`, así que un valor
    // fuera del enum es IMPOSIBLE DE CONSTRUIR. La garantía pasó de una validación a un tipo, y
    // por eso un rol desconocido ahora se procesa en vez de descartarse.
    const warn = sinon.spy(logger, 'warn');

    await dispatcher().dispatch({ ...validEvent(), matched_role: 'rol-inventado' });

    warn.callCount.should.equal(0);
    const user = (await User.findByPk(PERSON_ID))!;
    user.identityType.should.equal(IdentityType.Person);
  });

  it('TS-20b · los dos roles de servicio de `rules.yaml` se espejan como service', async () => {
    for (const role of ['internal-app', 'core']) {
      await dispatcher().dispatch({
        ...validEvent(),
        id: SERVICE_ID,
        matched_role: role,
        email: null,
      });

      (await User.findByPk(SERVICE_ID))!.identityType.should.equal(IdentityType.Service);
      await User.destroy({ where: { id: SERVICE_ID } });
    }
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
    user.email!.should.equal('ana@grava.digital');
    user.roles.should.deepEqual(['user']);
    user.identityType.should.equal('person');
  });
});
