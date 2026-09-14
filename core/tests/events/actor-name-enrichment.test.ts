import 'mocha';
import 'should';
import { DomainEvent } from '@jiku/nats-protocol';
import { IdentityType, Project, Requirement, User } from '@jiku/models';
import { dispatch, fakePublisher } from '../helpers/dispatch';
import { getTrustedPublisherId } from '../../src/config';

/**
 * EL NOMBRE DEL ACTOR EN LOS EVENTOS DE DOMINIO, CUANDO EL SOBRE NO LO TRAE.
 *
 * EL PROBLEMA QUE ESTA SUITE FIJA, y que se descubrió probando REQ-014 en un entorno real: el
 * `actor.name` de los eventos llegaba con el `sub` de Zitadel en vez del nombre de la persona.
 *
 * LA CAUSA NO ESTABA EN `core`. El access token de Zitadel **no trae los claims de perfil**
 * (`name`, `preferred_username`, `email`) — verificado decodificando un token real, y es lo que
 * ya documentan `docs/flows/sincronizacion-de-identidades.md:157` y REQ-005. La api arma el sobre
 * EXCLUSIVAMENTE de ese token (`api/lib/utils/bus/actor.ts`), así que el sobre llega con `id` y
 * `roles` y sin un solo campo de perfil, y `resolveEventActor` caía hasta su último escalón.
 *
 * LOS OTROS DOS CONSUMIDORES DEL PRODUCTO SÍ ENRIQUECEN, y por eso el síntoma sorprendía: el
 * auth-callout llama a `/oidc/v1/userinfo` (`CALLOUT_IDP_ENRICH=profile`) y la web tiene su propia
 * ruta que hace lo mismo. La api es el único que lee la fuente que no trae el dato.
 *
 * POR QUÉ SE RESUELVE ACÁ Y NO EN LA API (la opción que parecía obvia): enriquecer en la api sería
 * una llamada HTTP a Zitadel POR COMANDO, dentro del timeout de 5 s de ADR-002 y en el camino de
 * escritura del producto. `core` ya tiene el dato a mano —`mirrorActor` lee la fila de `users`
 * dentro de la transacción, en el mismo `findByPk` que ya hacía— así que completarlo acá no cuesta
 * ni una consulta nueva ni una dependencia de red.
 *
 * LA FILA TIENE EL NOMBRE BUENO porque la escribe el evento `{instance}.events.auth` en modo
 * `strict`, y ese camino SÍ viene enriquecido por el callout. El sobre en `best-effort` no la pisa
 * (CA-11), que es justo lo que deja el dato disponible para esta lectura.
 *
 * DÓNDE ENTRA LA FILA EN LA PRECEDENCIA, que es lo que estas pruebas fijan:
 *
 *     name del sobre  ->  email del sobre  ->  NAME DE LA FILA  ->  id
 *
 * Los dos claims del sobre GANAN porque salen del token que la api ya verificó contra Zitadel y
 * son más frescos que la fila, que es un espejo (ADR-007). La fila gana sobre el `id` porque un
 * `sub` no es un nombre para nadie.
 *
 * LO QUE ESTA SUITE NO CAMBIA: el canal DIRECTO (sin sobre) sigue cayendo al `id`, y el contrato
 * sigue declarando que `EventActor.name` PUEDE SER UN ID (R-5 de REQ-014). El enriquecimiento es
 * del canal CON SOBRE y de nadie más.
 */

const CALLER = () => getTrustedPublisherId();

/** El `sub` de una persona con fila completa en `users`, como la deja el evento del callout. */
const CON_PERFIL = '900000000000000001';
/** Una identidad que NO tiene fila: el fallback tiene que seguir siendo el id. */
const SIN_FILA = '900000000000000002';

function eventoDe(type: string): DomainEvent<unknown> {
  const found = fakePublisher.published.find(
    (p) => (p.payload as { type: string }).type === type
  );
  if (!found) {
    throw new Error(`No se publicó ningún evento de tipo "${type}"`);
  }
  return found.payload as DomainEvent<unknown>;
}

describe('eventos de dominio — el nombre del actor se completa desde `users`', () => {
  let requirementId: number;

  before(async () => {
    // La fila que el evento del callout habría dejado: perfil COMPLETO. Va PRIMERO porque
    // `projects.created_by` y `requirements.created_by` son FK a `users.id`.
    await User.create({
      id: CON_PERFIL,
      name: 'Lautaro Alvarez',
      username: 'lautaroa-enrich',
      email: 'lautaroa-enrich@test.local',
      roles: ['admin'],
      identityType: IdentityType.Person,
    });

    const project = await Project.create({
      name: 'Proyecto actor', code: 'ACT', status: 'activo', type: 'comercial',
      description: 'x', initDate: new Date(), createdBy: CON_PERFIL,
    });

    const requirement = await Requirement.create({
      title: 'Requisito para eventos', description: 'D', projectId: project.id,
      createdBy: CON_PERFIL,
    });
    requirementId = requirement.id;
  });

  beforeEach(() => {
    fakePublisher.reset();
  });

  it('TS-1 · con sobre SIN perfil, actor.name sale de la fila de `users`', async () => {
    // EL SOBRE TAL COMO LO MANDA LA API HOY: `id` y `roles`, sin un solo campo de perfil. Es
    // exactamente la forma que produce un access token de Zitadel sin claims.
    const reply = await dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Hola, comento algo',
        visibilityLevel: 'internal',
        actor: { id: CON_PERFIL, roles: ['admin'] },
      },
      CALLER()
    );

    reply.status.should.equal('success');

    const event = eventoDe('requirement.comment.created');
    event.actor.should.deepEqual({ id: CON_PERFIL, name: 'Lautaro Alvarez' });
  });

  it('TS-2 · el `name` del sobre GANA sobre la fila cuando el sobre sí lo trae', async () => {
    // Si algún día la api enriquece —o Zitadel empieza a mandar el claim—, el sobre es la fuente
    // MÁS FRESCA y tiene que ganar: la fila es un espejo, no la verdad.
    const reply = await dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Comento con sobre completo',
        visibilityLevel: 'internal',
        actor: { id: CON_PERFIL, roles: ['admin'], name: 'Nombre Del Claim' },
      },
      CALLER()
    );

    reply.status.should.equal('success');
    eventoDe('requirement.comment.created').actor.should.deepEqual({
      id: CON_PERFIL,
      name: 'Nombre Del Claim',
    });
  });

  it('TS-2b · el `email` del sobre GANA sobre la fila: la fila entra DEBAJO de los dos claims', () =>
    dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Comento con email en el sobre',
        visibilityLevel: 'internal',
        actor: { id: CON_PERFIL, roles: ['admin'], email: 'del-claim@test.local' },
      },
      CALLER()
    ).then((reply) => {
      // La fila tiene 'Lautaro Alvarez' y IGUAL gana el `email` del sobre: es el escalón que
      // REQ-014 ya había decidido, y el enriquecimiento no puede reordenarlo.
      reply.status.should.equal('success');
      eventoDe('requirement.comment.created').actor.should.deepEqual({
        id: CON_PERFIL,
        name: 'del-claim@test.local',
      });
    }));

  it('TS-3 · sin fila en `users`, actor.name cae al id y el comando NO se rechaza', async () => {
    // El espejo CREA la fila con el fallback `email ?? id` (users.name es NOT NULL), así que el
    // nombre resultante es el id. Lo que importa es que no rechaza y no inventa un nombre.
    const reply = await dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Comento sin fila previa',
        visibilityLevel: 'internal',
        actor: { id: SIN_FILA, roles: ['admin'] },
      },
      CALLER()
    );

    reply.status.should.equal('success');
    eventoDe('requirement.comment.created').actor.should.deepEqual({
      id: SIN_FILA,
      name: SIN_FILA,
    });
  });

  it('TS-4 · el email de la fila NUNCA viaja en el evento', async () => {
    // `EventActor` no declara `email`, y la fila SÍ lo tiene: el enriquecimiento no puede
    // convertirse en una vía por la que una dirección se filtre al conector.
    await dispatch(
      `requirements.${requirementId}.comment`,
      {
        comment: 'Otro comentario',
        visibilityLevel: 'internal',
        actor: { id: CON_PERFIL, roles: ['admin'] },
      },
      CALLER()
    );

    const event = eventoDe('requirement.comment.created');
    ('email' in event.actor).should.be.false();
    JSON.stringify(event.actor).should.not.containEql('lautaroa-enrich@test.local');
  });

  // SIN `after` QUE BORRE LAS FILAS: `users` es el destino de varias FK (`projects.created_by`,
  // `requirements.created_by`, la Actividad de cada comentario) y borrar el actor dejaría al
  // `after` rechazando por constraint. El truncado de `global-setup.ts` corre por CORRIDA y se
  // encarga; los ids `9000000000000000xx` son propios de este archivo y no chocan con otro.
});
