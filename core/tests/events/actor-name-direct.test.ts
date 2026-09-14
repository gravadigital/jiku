import 'mocha';
import 'should';
import { DomainEvent } from '@jiku/nats-protocol';
import { IdentityType, Project, Requirement, User } from '@jiku/models';
import { dispatch, fakePublisher } from '../helpers/dispatch';

/**
 * EL NOMBRE DEL ACTOR EN EL CANAL **DIRECTO** (una persona publicando al bus, sin sobre).
 *
 * LA MITAD QUE S-068 DEJÓ AFUERA. Aquella story completó el `actor.name` de los eventos leyendo la
 * fila de `users`, pero lo hizo DENTRO del `if (actor)` del despachador, así que solo alcanzó al
 * canal de la api. Publicando directo por `jiku-commands` el evento seguía saliendo con el `sub`,
 * que es lo que se vio probando REQ-014 contra el bus real.
 *
 * NO CUESTA UNA CONSULTA, y es la razón por la que se arregla acá y no en otro lado: en el canal
 * directo el despachador YA LEE la fila para autorizar (`readCallerRoles` hace `findByPk` y se
 * quedaba SOLO con `roles`, descartando el `name` que venía en la misma fila). El arreglo es dejar
 * de tirar ese dato, no ir a buscarlo.
 *
 * LOS TRES CANALES, Y LA ASIMETRÍA ES DELIBERADA:
 *
 *   SOBRE:    name del sobre -> email del sobre -> name de la fila -> id
 *   DIRECTO:                                       name de la fila -> id
 *   EXENTO:                                                          id
 *
 * EL EXENTO NO LEE LA BASE A PROPÓSITO (S-017 CA-1) y por eso se queda en el `id`: es la exención
 * que evita la caída total de escritura cuando el evento de autenticación se pierde. Hacer que ese
 * canal consulte `users` para adornar un campo opcional reintroduciría exactamente el modo de
 * falla que la exención existe para prevenir.
 */

/** Una persona que publica DIRECTO al bus: tiene fila, con nombre, y rol que autoriza. */
const PERSONA_BUS = '900000000000000011';

function eventoDe(type: string): DomainEvent<unknown> {
  const found = fakePublisher.published.find(
    (p) => (p.payload as { type: string }).type === type
  );
  if (!found) {
    throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  }
  return found.payload as DomainEvent<unknown>;
}

describe('eventos de dominio — actor.name en el canal DIRECTO (sin sobre)', () => {
  let requirementId: number;

  before(async () => {
    // CON `roles` EN LA FILA, a diferencia del canal del sobre: acá la compuerta lee `users.roles`
    // porque no hay claim que valga. Sin `admin` el comando se rechazaría con
    // `caller_not_authorized` y el test no llegaría a mirar ningún evento.
    await User.create({
      id: PERSONA_BUS,
      name: 'Lautaro Alvarez',
      username: 'lautaroa-bus',
      email: 'lautaroa-bus@test.local',
      roles: ['admin'],
      identityType: IdentityType.Person,
    });

    const project = await Project.create({
      name: 'Proyecto bus directo', code: 'BUS', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: PERSONA_BUS,
    });

    const requirement = await Requirement.create({
      title: 'Requisito canal directo', description: 'D', projectId: project.id,
      createdBy: PERSONA_BUS,
    });
    requirementId = requirement.id;
  });

  beforeEach(() => {
    fakePublisher.reset();
  });

  it('TS-1 · sin sobre, actor.name sale de la fila de `users` y no es el id', async () => {
    // EL CALLER ES LA PERSONA, no el publicador de confianza: es lo que hace que este dispatch
    // recorra el canal directo y no el exento.
    const reply = await dispatch(
      `requirements.${requirementId}.comment`,
      { comment: 'Comento publicando directo', visibilityLevel: 'internal' },
      PERSONA_BUS
    );

    reply.status.should.equal('success');
    eventoDe('requirement.comment.created').actor.should.deepEqual({
      id: PERSONA_BUS,
      name: 'Lautaro Alvarez',
    });
  });

  it('TS-2 · la identidad del evento sigue siendo la del subject, no la del cuerpo', async () => {
    // EL ENRIQUECIMIENTO NO PUEDE MOVER LA AUTORÍA. `resolveActor` ignora lo que el cuerpo declare
    // en el canal directo —la identidad ES el subject, avalada por el auth-callout— y completar el
    // nombre no cambia esa regla: el `id` del evento tiene que seguir siendo el del subject aunque
    // el payload declare otro autor.
    const reply = await dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Comento declarando otro autor',
        visibilityLevel: 'internal',
        author: '999999999999999999',
      },
      PERSONA_BUS
    );

    reply.status.should.equal('success');
    const actor = eventoDe('requirement.comment.created').actor;
    actor.id.should.equal(PERSONA_BUS);
    actor.name!.should.equal('Lautaro Alvarez');
  });

  it('TS-3 · el email de la fila NUNCA viaja, tampoco por este camino', () =>
    dispatch(
      `requirements.${requirementId}.comment`,
      { comment: 'Otro más', visibilityLevel: 'internal' },
      PERSONA_BUS
    ).then(() => {
      const actor = eventoDe('requirement.comment.created').actor;
      ('email' in actor).should.be.false();
      JSON.stringify(actor).should.not.containEql('lautaroa-bus@test.local');
    }));
});
