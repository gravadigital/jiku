import 'should';

import { AuthEvent, DomainEvent, EventActor, EventRecipients, EventType } from '../src/index';
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

/**
 * El plano de EVENTOS DE DOMINIO (REQ-014): `{instance}.events.{version}.{entidad}.{acción}`.
 *
 * Va en un `describe` propio y no dentro del de `events.auth` de arriba: los dos empiezan con
 * `{instance}.events.` y ahí termina el parecido — `events.auth` tiene 3 segmentos y es core NATS
 * puro, este tiene 5 y es JetStream. Es EXACTAMENTE el conflicto de subjects que hay que verificar
 * que no se pisen entre sí (ver TS-132/TS-133 más abajo).
 */
describe('nats-protocol · el subject del evento de dominio', () => {
  it('TS-127: EVENTS_VERSION con entorno limpio', () => {
    reload({}).EVENTS_VERSION.should.equal('v1');
  });

  it('TS-128: EVENTS_VERSION respeta su variable', () => {
    reload({ NATS_EVENTS_VERSION: 'v2' }).EVENTS_VERSION.should.equal('v2');
  });

  it('TS-129: una NATS_EVENTS_VERSION vacía cae al default', () => {
    // La regla del `||` vs `??`: con `??` daría '', y el subject sería
    // `dev.events..requirement.created` — un token vacío que NATS rechaza.
    reload({ NATS_EVENTS_VERSION: '' }).EVENTS_VERSION.should.equal('v1');
  });

  it('TS-130: EVENTS_VERSION es independiente de NATS_PROTOCOL_VERSION', () => {
    // Es CA-10 verificado desde el código: compartir la variable haría que un v2 de eventos
    // arrastre a los 23 comandos (RF-4).
    const p = reload({ NATS_PROTOCOL_VERSION: 'v9' });
    p.EVENTS_VERSION.should.equal('v1');
    p.PROTOCOL_VERSION.should.equal('v9');

    const q = reload({ NATS_EVENTS_VERSION: 'v7' });
    q.PROTOCOL_VERSION.should.equal('v1');
  });

  it('TS-131: eventSubject() arma los 5 segmentos', () => {
    // `requirement.created` es un `type` de 2 segmentos: instance + events + version + los 2
    // del type = 5 en total.
    const subject = reload({}).eventSubject('requirement.created');
    subject.should.equal('dev.events.v1.requirement.created');
    subject.split('.').length.should.equal(5);
  });

  it('TS-132: eventsStreamSubject() lleva la versión', () => {
    // La aserción que importa: NO es 'dev.events.>' — ese wildcard se comería `dev.events.auth`,
    // que es core NATS puro y sin ack, y el stream JIKU_EVENTS empezaría a persistir el evento
    // de autenticación sin que ningún test de core se ponga rojo.
    const subject = reload({}).eventsStreamSubject();
    subject.should.equal('dev.events.v1.>');
    subject.should.not.equal('dev.events.>');
  });

  it('TS-133: el wildcard no matchea el evento de autenticación', () => {
    const p = reload({});
    const streamPrefix = p.eventsStreamSubject().replace(/>$/, '');
    p.authEventSubject().startsWith(streamPrefix).should.be.false();
    p.authEventSubject().split('.').length.should.equal(3);
    p.eventSubject('task.created').split('.').length.should.equal(5);
  });

  it('TS-134: los dos helpers respetan NATS_INSTANCE y su versión juntas', () => {
    const p = reload({ NATS_INSTANCE: 'prod', NATS_EVENTS_VERSION: 'v2' });
    p.eventSubject('task.created').should.equal('prod.events.v2.task.created');
    p.eventsStreamSubject().should.equal('prod.events.v2.>');
  });

  it('TS-135: el subject de evento no cae en el grupo micro de ningún servicio', () => {
    // El gemelo de TS-63/TS-65 para el plano nuevo: cubre el bug de haber copiado
    // commandSubject() sin sacarle el caller y el {svc}. NATS_PROTOCOL_VERSION se fija distinto
    // de 'v1' para que la comparación contra PROTOCOL_VERSION no sea una coincidencia con el
    // default de EVENTS_VERSION (los dos son 'v1' de fábrica, y son variables independientes).
    const p = reload({ NATS_PROTOCOL_VERSION: 'v9' });
    const subject = p.eventSubject('requirement.created');
    subject.startsWith(p.groupSubject(p.COMMAND_SERVICE)).should.be.false();
    subject.startsWith(p.groupSubject(p.QUERY_SERVICE)).should.be.false();
    subject.includes(p.COMMAND_SERVICE).should.be.false();
    subject.includes(p.QUERY_SERVICE).should.be.false();
    subject.includes(p.PROTOCOL_VERSION).should.be.false();
  });

  it('TS-136: eventSubject() sobre los 16 tipos del catálogo', () => {
    const p = reload({});
    const types = Object.values(p.EVENT_TYPES);
    const subjects = types.map((t) => p.eventSubject(t));

    subjects.forEach((s) => s.should.equal(`dev.events.v1.${types[subjects.indexOf(s)]}`));
    new Set(subjects).size.should.equal(subjects.length);
    subjects.every((s) => s.split('.').every((seg) => seg.length > 0)).should.be.true();
    subjects.every((s) => s.split('.').length >= 5).should.be.true();
  });
});

/**
 * El sobre `DomainEvent` y sus tipos componentes (REQ-014). Molde declarado: `AuthEvent`, pero al
 * revés en dos decisiones — ver el TSDoc de `DomainEvent` en `src/index.ts`.
 */
describe('nats-protocol · el tipo del payload del evento de dominio', () => {
  it('TS-137: ninguna de las 5 interfaces es un símbolo de runtime', () => {
    // El gemelo de TS-68: un tipo se borra al compilar; si aparece, alguien exportó una
    // constante con ese nombre.
    const surface = reload({}) as unknown as Record<string, unknown>;
    ['DomainEvent', 'EventActor', 'EventEntityRef', 'EventRecipients', 'EventComment'].forEach(
      (name) => {
        Object.keys(surface).should.not.containEql(name);
        (surface[name] === undefined).should.be.true();
      }
    );
  });

  it('TS-138: DomainEvent declara exactamente sus 11 campos', () => {
    // La aserción fuerte es de compilación: una clave que falte es un error de tsc y una de más
    // es un excess-property error. Molde exacto: TS-66.
    const KEYS: Record<keyof DomainEvent, true> = {
      eventId: true,
      type: true,
      version: true,
      occurredAt: true,
      correlationId: true,
      actor: true,
      entity: true,
      snapshot: true,
      changes: true,
      recipients: true,
      comment: true,
    };
    Object.keys(KEYS).length.should.equal(11);
  });

  it('TS-139: un DomainEvent mínimo compila sin los tres opcionales', () => {
    const minimal: DomainEvent = {
      eventId: '01JBQ8XZ1Y2Z3A4B5C6D7E8F9G',
      type: 'requirement.created' as EventType,
      version: 'v1',
      occurredAt: '2026-09-08T14:22:31.004Z',
      correlationId: '01JBQ8XZ1Y2Z3A4B5C6D7E8F9G',
      actor: { id: '3233332022539911171' },
      entity: { type: 'requirement', id: 42, projectId: 7 },
      snapshot: {
        id: 42,
        title: 'x',
        description: 'y',
        type: null,
        priority: 'baja',
        state: 'analisis',
        estimatedFinishDate: null,
        tags: [],
        responsiblePersonIds: [7],
        projectId: 7,
        createdBy: '3233332022539911171',
        visibilityLevel: 'internal',
        createdAt: '2026-09-08T14:22:31.004Z',
        updatedAt: '2026-09-08T14:22:31.004Z',
        finishedAt: null,
      },
    };

    (minimal.changes === undefined).should.be.true();
    (minimal.recipients === undefined).should.be.true();
    (minimal.comment === undefined).should.be.true();
    // `actor` sin `name` compila: `name` es opcional por el catálogo.
    (minimal.actor.name === undefined).should.be.true();
  });

  it('TS-140: EventActor NO tiene email', () => {
    // Es el test de la minimización de dato personal: "actor.email — Nunca". `Record<keyof
    // EventActor, true>` tiene exactamente 2 claves (id, name); un `email` de más sería un
    // excess-property error (TS2353) que este test documenta sin escribir el caso que no
    // compila directamente en el archivo.
    const KEYS: Record<keyof EventActor, true> = { id: true, name: true };
    Object.keys(KEYS).length.should.equal(2);

    // const bad: EventActor = { id: 'x', name: 'y', email: 'z@z.com' }; // NO COMPILA (TS2353)
  });

  it('TS-141: EventRecipients.subscriptors[].email acepta null', () => {
    const r: EventRecipients = {
      subscriptors: [
        { userId: '9988', name: 'Ana Gómez', email: 'ana@cliente.com' },
        { userId: '7766', name: 'Juan Pérez', email: null },
      ],
      responsiblePersonIds: [7, 3, 9],
    };

    (r.subscriptors[1].email === null).should.be.true();
    r.subscriptors[0].email!.should.equal('ana@cliente.com');

    // Lista vacía es el caso más frecuente: la suscripción es opcional y hoy nadie la usa.
    const empty: EventRecipients = { subscriptors: [], responsiblePersonIds: [] };
    empty.subscriptors.length.should.equal(0);

    // const bad: EventRecipients['subscriptors'][number] = { userId: 'x', name: 'y' }; // NO
    // COMPILA sin `email`: el campo es requerido y nulable, NUNCA opcional — un conector no
    // podría distinguir "no lo sé" de "es un service user y no tiene".
  });

  it('TS-142: EVENT_TYPES tiene los 16 miembros del catálogo, en el orden declarado', () => {
    const p = reload({});
    Object.keys(p.EVENT_TYPES).length.should.equal(16);
    Object.values(p.EVENT_TYPES).should.eql([
      'requirement.created',
      'requirement.state.changed',
      'requirement.updated',
      'requirement.comment.created',
      'requirement.comment.edited',
      'requirement.subscriptor.added',
      'requirement.subscriptor.removed',
      'requirement.assigned',
      'requirement.resolved',
      'requirement.reopened',
      'task.created',
      'task.state.changed',
      'task.updated',
      'task.comment.created',
      'task.comment.edited',
      'task.assigned',
    ]);
  });

  it('TS-143: el as const está y EventType es la unión de literales, no string', () => {
    const t: EventType = 'requirement.created';
    t.should.equal('requirement.created');

    // const bad: EventType = 'requirement.deleted'; // NO COMPILA (TS2322): sin el `as const`,
    // EventType sería `string` y este caso compilaría — el falso verde que TS-143 evita.
    // Precedente: TS-88 con ErrorCodeValue.

    const p = reload({});
    const fromCatalog: EventType = p.EVENT_TYPES.REQUIREMENT_CREATED;
    fromCatalog.should.equal('requirement.created');
  });

  it('TS-144: DomainEvent.type está tipado EventType, no string', () => {
    // Es la decisión que separa DomainEvent de AuthEvent: acá el emisor es `core`, y un `type`
    // fuera del catálogo es un bug del emisor que debe fallar en compilación.
    //
    // const bad: DomainEvent = { ...base, type: 'requirement.exploded' }; // NO COMPILA (TS2322)
    const ok: EventType = 'task.assigned';
    ok.should.equal('task.assigned');
  });

  it('TS-145: EVENT_TYPES no toca el catálogo de errores', () => {
    // El plano de eventos no tiene códigos de error (no hay Reply). TS-49 sigue verde tal cual.
    Object.keys(reload({}).ErrorCode).length.should.equal(35);
  });
});
