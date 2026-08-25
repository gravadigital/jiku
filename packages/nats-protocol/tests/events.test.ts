import 'should';

import { AuthEvent } from '../src/index';
import { reload } from './helpers/reload';

/**
 * El subject del evento y el tipo de su payload, en un archivo propio.
 *
 * NO van dentro de `protocol.test.ts`: ese archivo es "los nombres de servicio y los subjects de
 * la gramática", y el evento es precisamente lo que NO sigue la gramática. Meterlo ahí adentro
 * contradiría en la organización del test lo que la nota dice en el código.
 */
describe('nats-protocol · el subject del evento de autenticación', () => {
  it('TS-59: authEventSubject() con entorno limpio', () => {
    reload({}).authEventSubject().should.equal('dev.events.auth');
  });

  it('TS-60: authEventSubject() respeta NATS_INSTANCE', () => {
    reload({ NATS_INSTANCE: 'prod' }).authEventSubject().should.equal('prod.events.auth');
  });

  it('TS-61: una NATS_INSTANCE vacía cae al default', () => {
    // Es la regla del `||` vs `??` del paquete: con `??` daría '.events.auth', un token vacío
    // que NATS rechaza. El helper la hereda porque deriva de INSTANCE, no de process.env.
    reload({ NATS_INSTANCE: '' }).authEventSubject().should.equal('dev.events.auth');
  });

  it('TS-62: tres segmentos exactos, y el segundo es el literal events', () => {
    const segments = reload({}).authEventSubject().split('.');
    segments.should.eql(['dev', 'events', 'auth']);
    segments.length.should.equal(3);
    segments[1].should.equal('events');
    segments[2].should.equal('auth');
  });

  it('TS-63: no lleva el token {svc} ni la versión del protocolo', () => {
    const p = reload({});
    const subject = p.authEventSubject();
    subject.includes(p.COMMAND_SERVICE).should.be.false();
    subject.includes(p.QUERY_SERVICE).should.be.false();
    subject.includes(p.PROTOCOL_VERSION).should.be.false();
  });

  it('TS-64: NATS_PROTOCOL_VERSION no lo afecta', () => {
    // Cubre el bug de haber copiado commandSubject() sin sacarle la versión: `dev.events.auth.v1`
    // no lo autoriza ninguna plantilla, y no produce un error — produce cero eventos.
    reload({ NATS_PROTOCOL_VERSION: 'v2' }).authEventSubject().should.equal('dev.events.auth');
  });

  it('TS-65: el subject del evento no cae en el grupo micro de ningún servicio', () => {
    // El test conceptual del plan: si alguien "arregla" el subject para que entre en la gramática
    // de cinco segmentos, es el que cae.
    const p = reload({});
    const event = p.authEventSubject();
    event.startsWith(p.groupSubject(p.COMMAND_SERVICE)).should.be.false();
    event.startsWith(p.groupSubject(p.QUERY_SERVICE)).should.be.false();
    event.split('.').length.should.equal(3);
    p.commandSubject('clients.new', 'u1').split('.').length.should.equal(6);
  });
});

describe('nats-protocol · el tipo del payload del evento', () => {
  it('TS-66: AuthEvent declara exactamente los nueve campos', () => {
    // `Record<keyof AuthEvent, true>` es la aserción FUERTE, y es de COMPILACIÓN: una clave que
    // falte es un error de tsc, y una de más es un excess-property error. El `length` es solo la
    // parte que mocha puede reportar.
    //
    // Es el único test que este paquete puede hacer y core no: el despachador hace
    // `result.value as AuthEvent`, y un cast NO VERIFICA NADA.
    const KEYS: Record<keyof AuthEvent, true> = {
      type: true,
      version: true,
      instance: true,
      id: true,
      name: true,
      username: true,
      email: true,
      roles: true,
      identity_type: true,
    };
    Object.keys(KEYS).length.should.equal(9);
  });

  it('TS-67: el payload real de 15 campos se estrecha sin perder ninguno de los nueve', () => {
    // El crudo se tipa `Record<string, unknown>`, NO `AuthEvent`: un literal de 15 campos
    // asignado directo sería un excess-property error, que es justamente la prueba de que los
    // seis ignorados no están declarados.
    const raw: Record<string, unknown> = {
      type: 'authenticated',
      version: 1,
      id: '281234567890123456',
      name: 'Ana Pérez',
      username: 'ana@grava.digital',
      email: 'ana@grava.digital',
      roles: ['user'],
      authenticated_at: '2026-08-23T18:04:11.123Z',
      expires_at: '2026-08-23T19:04:11Z',
      instance: 'prod',
      identity_type: 'person',
      matched_role: 'user',
      template: 'templates/person.yaml',
      client_ip: '10.1.2.3',
      session: 'UAWUJEWODGQJGMUGZBJH4Y6XKTVD5V4G5EQZXUJA5QV3ZL2TP2JY3ZNH',
    };
    Object.keys(raw).length.should.equal(15);

    const e = raw as unknown as AuthEvent;
    e.id.should.equal('281234567890123456');
    e.roles.should.eql(['user']);
    e.identity_type.should.equal('person');
    e.version.should.equal(1);
    e.type.should.equal('authenticated');
    e.instance.should.equal('prod');
    e.name.should.equal('Ana Pérez');
    e.username.should.equal('ana@grava.digital');
    e.email!.should.equal('ana@grava.digital');

    // `identity_type` es `string`, NO el enum de @jiku/models: un valor fuera del enum es un
    // evento INVÁLIDO —que el esquema Joi de core descarta— no un tipo imposible. Si acá
    // estuviera el enum, el test de descarte de core no se podría escribir.
    const robot: AuthEvent = { ...e, identity_type: 'robot' };
    robot.identity_type.should.equal('robot');

    // `type` y `version` van widened a propósito: en el cable un `version: 2` o un
    // `type: 'deauthenticated'` son valores legítimos que core descarta, y congelarlos como
    // literales volvería intipeable la rama de descarte.
    const otro: AuthEvent = { ...e, type: 'deauthenticated', version: 2 };
    otro.version.should.equal(2);
  });

  it('TS-67b: `email` acepta `null`, que es la forma de una identidad de servicio', () => {
    // Un machine user de Zitadel no tiene dirección de correo: `userinfo` no devuelve el claim,
    // así que el callout omite la clave y el esquema Joi de core la normaliza a `null`. Que el
    // tipo lo admita es lo que permite espejar esa identidad — sin fila en `users`, las dos
    // compuertas del bus la rechazan con `caller_not_authorized` y `unknown_caller`.
    const service: AuthEvent = {
      type: 'authenticated',
      version: 1,
      instance: 'prod',
      id: '387842544790142978',
      name: 'Jiku API',
      username: 'jiku-api',
      email: null,
      roles: ['internal-app'],
      identity_type: 'service',
    };

    (service.email === null).should.be.true();
    service.identity_type.should.equal('service');

    // Y sigue admitiendo un string: la excepción es "PUEDE no tener", no "no tiene". Un service
    // user con dirección declarada en Zitadel la conserva.
    const conEmail: AuthEvent = { ...service, email: 'connector@grava.digital' };
    conEmail.email!.should.equal('connector@grava.digital');
  });

  it('TS-68: AuthEvent no es un símbolo de runtime', () => {
    // Un tipo se borra al compilar. Si apareciera, alguien exportó una constante con ese nombre.
    const surface = reload({}) as unknown as Record<string, unknown>;
    Object.keys(surface).should.not.containEql('AuthEvent');
    (surface.AuthEvent === undefined).should.be.true();
  });
});
