import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { dispatchQuery } from '../helpers/dispatch';
import { PROJECT_MAIN, PROJECT_OTHER, createWorld, destroyWorld } from './task-fixtures';
import {
  CLIENT_FOREIGN,
  CLIENT_MAIN,
  CLIENT_ORPHAN,
  CLIENT_OTHER,
  MISSING_ID,
  createDomainWorld,
  destroyDomainWorld,
} from './domain-fixtures';

/**
 * `clients.list` y `clients.get` CONTRA BASE REAL, por el despachador.
 *
 * Entran por `dispatchQuery()` y no llamando a `execute`: el camino incluye las dos compuertas del
 * despachador y la resolución del método, que es donde un contrato nuevo se rompe primero.
 *
 * El caller por defecto es el publicador confiable —clase CONECTOR, o sea SIN recorte—. El recorte
 * del modo externo se verifica en `domain-external-scope.test.ts`.
 */

interface Collection {
  items: Record<string, unknown>[];
  page: { limit: number; returned: number; cursor?: string; total?: number };
}

function items(reply: Reply<Collection>): Record<string, unknown>[] {
  reply.status.should.equal('success', JSON.stringify(reply));
  return reply.data!.items;
}

function ids(reply: Reply<Collection>): number[] {
  return items(reply).map((item) => item.id as number);
}

describe('queries/clients — el contrato del recurso (S-024)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
  });

  after(async () => {
    await destroyDomainWorld();
    await destroyWorld();
  });

  it('TS-1 · sin palancas devuelve el conjunto base con el sort default (`name` ASC)', async () => {
    const reply = await dispatchQuery<Collection>('clients.list', {});

    // ALFABÉTICO, no por antigüedad: es el default que declara la ficha de este recurso.
    // EL MUNDO TIENE CUATRO ACTORES Y NO DOS —los otros dos existen para el recorte externo, donde
    // el actor SIN proyectos es la fila que atrapa el error— así que el escenario se verifica sobre
    // los cuatro: Acme, Beta, Delta, Gamma.
    ids(reply).should.deepEqual([CLIENT_MAIN, CLIENT_OTHER, CLIENT_FOREIGN, CLIENT_ORPHAN]);
    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'createdAt',
      'id',
      'name',
      'updatedAt',
    ]);
    reply.data!.page.limit.should.equal(50);
    reply.data!.page.returned.should.equal(4);
  });

  it('TS-2 · `get` devuelve EL RECURSO, sin envoltorio de colección', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('clients.get', { id: CLIENT_MAIN });

    reply.status.should.equal('success');
    reply.data!.id!.should.equal(CLIENT_MAIN);
    reply.data!.name!.should.equal('Acme');
    // Ni `items` ni `page`: `data` ES el recurso.
    reply.data!.should.not.have.property('items');
    reply.data!.should.not.have.property('page');
  });

  it('TS-3 · `description` es INCLUIBLE y no base', async () => {
    const included = await dispatchQuery<Record<string, unknown>>('clients.get', {
      id: CLIENT_MAIN,
      include: ['description'],
    });
    const plain = await dispatchQuery<Record<string, unknown>>('clients.get', { id: CLIENT_MAIN });

    included.data!.description!.should.equal('Actor de fixture');
    plain.data!.should.not.have.property('description');
  });

  it('TS-4 · `filter.q` busca en `name` Y en `description`', async () => {
    const byName = await dispatchQuery<Collection>('clients.list', { filter: { q: 'acm' } });
    const byDescription = await dispatchQuery<Collection>('clients.list', {
      filter: { q: 'historico' },
    });

    ids(byName).should.deepEqual([CLIENT_MAIN]);
    // La coincidencia está en la `description`, no en el nombre: el actor 5002 se llama "Beta".
    ids(byDescription).should.deepEqual([CLIENT_OTHER]);
  });

  it('TS-5 · CA-3 · los proyectos de un actor NO son un `include`', async () => {
    const reply = await dispatchQuery('clients.get', { id: CLIENT_MAIN, include: ['projects'] });

    // Se piden con `projects.list` + `filter.clientId`: una colección sin cota anidada en cada
    // item de una página de 200 actores es una respuesta sin techo.
    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('invalid_fields');
    reply.errorDetails!.field!.should.equal('include');
    reply.errorDetails!.value!.should.equal('projects');
    (reply.errorDetails!.allowed as string[]).should.deepEqual(['description']);
  });

  it('TS-43 · un nombre inventado en las CUATRO palancas responde `invalid_fields`', async () => {
    const cases: [string, unknown, string][] = [
      ['clients.list', { filter: { nombreInventado: 1 } }, 'filter'],
      ['clients.list', { sort: ['nombreInventado'] }, 'sort'],
      ['clients.list', { fields: ['nombreInventado'] }, 'fields'],
      ['clients.list', { include: ['nombreInventado'] }, 'include'],
    ];

    for (const [pattern, payload, field] of cases) {
      const reply = await dispatchQuery(pattern, payload);

      // NUNCA `success` ignorando el nombre: un filtro ignorado devuelve datos de más.
      reply.status.should.equal('failure', `${field}: ${JSON.stringify(reply)}`);
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal(field);
      reply.errorDetails!.value!.should.equal('nombreInventado');
      (reply.errorDetails!.allowed as string[]).should.not.containEql('nombreInventado');
    }
  });

  it('TS-45 · un filtro sin coincidencias devuelve `items: []`, nunca `client_not_found`', async () => {
    const reply = await dispatchQuery<Collection>('clients.list', {
      filter: { name: 'no-existe' },
    });

    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-70 · las cuatro palancas de `list` son un ERROR en el `get`', async () => {
    for (const key of ['filter', 'sort', 'page', 'count']) {
      const reply = await dispatchQuery('clients.get', { id: CLIENT_MAIN, [key]: {} });

      reply.status.should.equal('failure', key);
      reply.errorCode!.should.equal('invalid_fields');
      (reply.errorDetails!.allowed as string[]).should.deepEqual(['id', 'fields', 'include']);
    }
  });

  it('un id inexistente responde `client_not_found` con la constante del catálogo', async () => {
    // Con el caller por defecto, que es el publicador confiable: clase CONECTOR, o sea SIN recorte.
    // El caso "existe pero no lo podés ver" —y que responde EXACTAMENTE lo mismo— lo verifica
    // `domain-external-scope.test.ts` con un caller externo.
    const reply = await dispatchQuery('clients.get', { id: MISSING_ID });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('client_not_found');
  });

  it('TS-69 · un campo de identidad en el nivel superior del payload es `invalid_fields`', async () => {
    const reply = await dispatchQuery('clients.list', { userId: 'otro' });

    // Quién pregunta sale del SEGUNDO TOKEN DEL SUBJECT y solo de ahí: el subject lo firma el
    // auth-callout y el cuerpo no.
    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('invalid_fields');
    reply.errorDetails!.field!.should.equal('payload');
    reply.errorDetails!.value!.should.equal('userId');
    reply.errorMessage!.should.containEql('quién pregunta sale del subject');
  });

  it('la paginación recorre los actores sin repetidos ni salteados', async () => {
    const first = await dispatchQuery<Collection>('clients.list', { page: { limit: 1 } });
    const second = await dispatchQuery<Collection>('clients.list', {
      page: { limit: 1, cursor: first.data!.page.cursor },
    });
    const third = await dispatchQuery<Collection>('clients.list', {
      page: { limit: 1, cursor: second.data!.page.cursor },
    });

    // Orden por `name` con desempate por `id`: el recorrido es total y estable.
    ids(first).should.deepEqual([CLIENT_MAIN]);
    ids(second).should.deepEqual([CLIENT_OTHER]);
    ids(third).should.deepEqual([CLIENT_FOREIGN]);
  });

  it('`count: "only"` devuelve el total sin traer filas', async () => {
    const reply = await dispatchQuery<Collection>('clients.list', { count: 'only' });

    reply.data!.page.total!.should.equal(4);
    items(reply).should.deepEqual([]);
  });
});
