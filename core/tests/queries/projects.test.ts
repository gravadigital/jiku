import 'mocha';
import 'should';
import { Reply } from '@jiku/nats-protocol';
import { dispatchQuery } from '../helpers/dispatch';
import { PROJECT_MAIN, PROJECT_OTHER, createWorld, destroyWorld } from './task-fixtures';
import {
  CLIENT_MAIN,
  MISSING_ID,
  ORIGIN_MAIN,
  PROJECT_ORPHAN,
  createDomainWorld,
  destroyDomainWorld,
} from './domain-fixtures';

/**
 * `projects.list` y `projects.get` CONTRA BASE REAL, por el despachador.
 *
 * Los dos endpoints EXISTEN DESDE S-013 como stubs de `pendingContract`; esta suite verifica
 * primero que dejaron de serlo y después el contrato completo del recurso.
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

describe('queries/projects — el contrato del recurso (S-024)', () => {
  before(async () => {
    await createWorld([PROJECT_MAIN, PROJECT_OTHER]);
    await createDomainWorld();
  });

  after(async () => {
    await destroyDomainWorld();
    await destroyWorld();
  });

  it('TS-6 · `projects.list` DEJA DE RESPONDER `pendingContract`', async () => {
    const reply = await dispatchQuery<Collection>('projects.list', {});

    reply.status.should.equal('success');
    reply.data!.items.should.be.an.Array();
    // El mensaje del stub que este recurso deja atrás.
    JSON.stringify(reply).should.not.containEql('todavía no tiene contrato definido');
  });

  it('TS-7 · `projects.get` DEJA DE RESPONDER `pendingContract`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('projects.get', {
      id: PROJECT_MAIN,
    });

    reply.status.should.equal('success');
    reply.data!.id!.should.equal(PROJECT_MAIN);
  });

  it('TS-8 · el conjunto base son los DIEZ campos y el sort default es `-createdAt`', async () => {
    const reply = await dispatchQuery<Collection>('projects.list', {});

    Object.keys(items(reply)[0]).sort().should.deepEqual([
      'clientId',
      'code',
      'createdAt',
      'createdBy',
      'id',
      'name',
      'originId',
      'status',
      'type',
      'updatedAt',
    ]);
    // El más nuevo primero: el 13 es de marzo, el 14 de febrero y el 12 de enero. EL MUNDO TIENE
    // TRES PROYECTOS Y NO DOS —el 14 existe para probar que el JOIN de `client` es LEFT— así que el
    // orden por defecto se verifica sobre los tres.
    ids(reply).should.deepEqual([PROJECT_OTHER, PROJECT_ORPHAN, PROJECT_MAIN]);
    for (const item of items(reply)) {
      for (const absent of ['description', 'properties', 'initDate', 'endDate', 'priority']) {
        item.should.not.have.property(absent);
      }
    }
  });

  it('TS-9 · CA-5 · `properties` se traduce a `[{code, value}]`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('projects.get', {
      id: PROJECT_MAIN,
      include: ['properties'],
    });

    // La columna guarda un OBJETO plano; el contrato dice LISTA. Y el `null` de una clave presente
    // se PRESERVA: no se descarta la clave.
    reply.data!.properties!.should.deepEqual([
      { code: 'documentacion', value: 'https://d.local' },
      { code: 'board_de_tareas', value: null },
    ]);
  });

  it('TS-10 · CA-5 · con la columna en NULL, `properties` es `[]` y no `null`', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('projects.get', {
      id: PROJECT_ORPHAN,
      include: ['properties'],
    });

    // El contrato declara `properties` como lista, y un consumidor que haga `.map()` sobre `null`
    // rompe.
    reply.data!.properties!.should.deepEqual([]);
  });

  it('TS-11 · `client` y `origin` vienen como relaciones 1:1', async () => {
    const reply = await dispatchQuery<Record<string, unknown>>('projects.get', {
      id: PROJECT_MAIN,
      include: ['client', 'origin'],
    });

    reply.data!.client!.should.deepEqual({ id: CLIENT_MAIN, name: 'Acme' });
    reply.data!.origin!.should.deepEqual({ id: ORIGIN_MAIN, name: 'Referido' });
  });

  it('TS-12 · un proyecto SIN actor SE DEVUELVE IGUAL, con `client: null`', async () => {
    const reply = await dispatchQuery<Collection>('projects.list', {
      include: ['client', 'origin'],
    });
    const orphan = items(reply).find((item) => item.id === PROJECT_ORPHAN);

    // LEFT JOIN y no INNER: con INNER este proyecto desaparecería de la colección, que es datos de
    // menos y en silencio.
    (orphan === undefined).should.be.false();
    (orphan!.client === null).should.be.true();
    (orphan!.origin === null).should.be.true();
  });

  it('TS-13 · `description`, `initDate`, `endDate` y `priority` son incluibles', async () => {
    const included = await dispatchQuery<Record<string, unknown>>('projects.get', {
      id: PROJECT_MAIN,
      include: ['description', 'initDate', 'endDate', 'priority'],
    });
    const plain = await dispatchQuery<Record<string, unknown>>('projects.get', { id: PROJECT_MAIN });

    for (const name of ['description', 'initDate', 'endDate', 'priority']) {
      included.data!.should.have.property(name);
      plain.data!.should.not.have.property(name);
    }
  });

  it('TS-14 · `filter.q` busca en `name`, `code` y `description`', async () => {
    const byCode = await dispatchQuery<Collection>('projects.list', { filter: { q: 'PJK' } });
    const byName = await dispatchQuery<Collection>('projects.list', { filter: { q: 'Portal' } });

    ids(byCode).should.deepEqual([PROJECT_MAIN]);
    ids(byName).should.deepEqual([PROJECT_MAIN]);
  });

  it('TS-15 · el keyset sobre una columna NULL-able NO corta el recorrido', async () => {
    const first = await dispatchQuery<Collection>('projects.list', {
      sort: ['priority'],
      page: { limit: 2 },
    });
    const second = await dispatchQuery<Collection>('projects.list', {
      sort: ['priority'],
      page: { limit: 2, cursor: first.data!.page.cursor },
    });

    // Los tres proyectos entre las dos páginas, sin repetidos: el `NULL` de `priority` del 13 no
    // corta nada. Sin `nullable: true` en la ficha, la segunda página vendría vacía.
    const recorridos = [...ids(first), ...ids(second)];
    recorridos.slice().sort().should.deepEqual(
      [PROJECT_MAIN, PROJECT_OTHER, PROJECT_ORPHAN].slice().sort()
    );
    new Set(recorridos).size.should.equal(3);
  });

  it('TS-29 · CA-5 · `properties` NO es filtrable', async () => {
    const reply = await dispatchQuery('projects.list', { filter: { properties: 'x' } });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('invalid_fields');
    reply.errorDetails!.field!.should.equal('filter');
    reply.errorDetails!.value!.should.equal('properties');
    (reply.errorDetails!.allowed as string[]).should.not.containEql('properties');
  });

  it('TS-39 a TS-42 · CA-6 · `ticketSlug` en las CUATRO palancas responde `invalid_fields`', async () => {
    const cases: [string, unknown, string][] = [
      ['projects.list', { filter: { ticketSlug: 'JIK-1' } }, 'filter'],
      ['projects.list', { fields: ['ticketSlug'] }, 'fields'],
      ['projects.get', { id: PROJECT_MAIN, include: ['ticketSlug'] }, 'include'],
      ['projects.list', { sort: ['ticketSlug'] }, 'sort'],
    ];

    for (const [pattern, payload, field] of cases) {
      const reply = await dispatchQuery(pattern, payload);

      // "No está declarado" ES la única forma de "no se puede pedir": no hace falta código propio.
      reply.status.should.equal('failure', `${field}: ${JSON.stringify(reply)}`);
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal(field);
      reply.errorDetails!.value!.should.equal('ticketSlug');
      (reply.errorDetails!.allowed as string[]).should.not.containEql('ticketSlug');
    }
  });

  it('TS-43 · un nombre inventado en las cuatro palancas responde `invalid_fields`', async () => {
    const cases: [unknown, string][] = [
      [{ filter: { nombreInventado: 1 } }, 'filter'],
      [{ sort: ['nombreInventado'] }, 'sort'],
      [{ fields: ['nombreInventado'] }, 'fields'],
      [{ include: ['nombreInventado'] }, 'include'],
    ];

    for (const [payload, field] of cases) {
      const reply = await dispatchQuery('projects.list', payload);

      reply.status.should.equal('failure', field);
      reply.errorCode!.should.equal('invalid_fields');
      reply.errorDetails!.field!.should.equal(field);
    }
  });

  it('TS-45 · un filtro sin coincidencias devuelve `items: []`, nunca `project_not_found`', async () => {
    const reply = await dispatchQuery<Collection>('projects.list', {
      filter: { code: 'no-existe' },
    });

    reply.status.should.equal('success');
    items(reply).should.deepEqual([]);
  });

  it('TS-70 · las cuatro palancas de `list` son un ERROR en el `get`', async () => {
    for (const key of ['filter', 'sort', 'page', 'count']) {
      const reply = await dispatchQuery('projects.get', { id: PROJECT_MAIN, [key]: {} });

      reply.status.should.equal('failure', key);
      reply.errorCode!.should.equal('invalid_fields');
      (reply.errorDetails!.allowed as string[]).should.deepEqual(['id', 'fields', 'include']);
    }
  });

  it('un id inexistente responde `project_not_found`', async () => {
    const reply = await dispatchQuery('projects.get', { id: MISSING_ID });

    reply.status.should.equal('failure');
    reply.errorCode!.should.equal('project_not_found');
  });

  it('`filter.clientId` es la forma de pedir los proyectos de un actor', async () => {
    // Es lo que reemplaza al `include: ["projects"]` que la ficha de `clients` no declara.
    const reply = await dispatchQuery<Collection>('projects.list', {
      filter: { clientId: CLIENT_MAIN },
    });

    ids(reply).should.deepEqual([PROJECT_MAIN]);
  });
});
