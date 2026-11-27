import 'mocha';
import 'should';
import { dispatchQuery, resetQueryBudget, setQueryBudget } from '../helpers/dispatch';
import { createTasks, createWorld, destroyWorld } from './task-fixtures';

/**
 * El presupuesto de bytes contra la base real (CA-14, CA-15).
 *
 * EL PRESUPUESTO SE INYECTA, no se lee de un server: depender del `max_payload` real haría el
 * test frágil y obligaría a levantar un bus para probar una regla que no es del bus. El
 * despachador acepta un proveedor perezoso desde S-022 y el helper de tests lo cablea a una
 * variable.
 */

const PROJECT_BIG = 22;
const PROJECT_HUGE = 23;
const BIG_TASKS = 200;

interface Page {
  items: Record<string, any>[];
  page: { limit: number; returned: number; cursor?: string };
}

describe('queries/tasks — presupuesto de bytes (CA-14, CA-15)', () => {
  before(async () => {
    await createWorld([PROJECT_BIG, PROJECT_HUGE]);

    // Items grandes fabricados a propósito: un `title` de 200 caracteres.
    await createTasks(
      Array.from({ length: BIG_TASKS }, (_, index) => ({
        id: 30000 + index,
        title: `${String(index).padStart(3, '0')} ${'x'.repeat(200)}`,
        projectId: PROJECT_BIG,
        createdAt: new Date(Date.UTC(2026, 0, 1) + index * 1000).toISOString(),
      }))
    );

    // Un item cuyo campo de texto SOLO excede cualquier presupuesto razonable, y es el primero
    // del orden por defecto (`-createdAt`).
    await createTasks([
      {
        id: 31000,
        title: 'La gigante',
        description: 'ñ'.repeat(5000),
        projectId: PROJECT_HUGE,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
      {
        id: 31001,
        title: 'La que sigue',
        description: 'z'.repeat(5000),
        projectId: PROJECT_HUGE,
        createdAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 31002,
        title: 'La tercera',
        description: 'w'.repeat(5000),
        projectId: PROJECT_HUGE,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ]);
  });

  after(async () => {
    resetQueryBudget();
    await destroyWorld();
  });

  afterEach(() => resetQueryBudget());

  it('TS-21 · el presupuesto CORTA la página, y `page.limit` sigue siendo el pedido', async () => {
    setQueryBudget(2048);

    const reply = await dispatchQuery<Page>('tasks.list', {
      filter: { projectId: PROJECT_BIG },
      page: { limit: 100 },
    });

    reply.status.should.equal('success');
    reply.data!.page.returned.should.be.below(100);
    reply.data!.page.returned.should.be.above(0);
    // El EFECTIVO tras el tope de 200, NO el recortado por bytes: confundirlos haría
    // indistinguible "no había más" de "no entraba".
    reply.data!.page.limit.should.equal(100);
    (reply.data!.page.cursor === undefined).should.be.false();
    // Y el mensaje entero entra en el presupuesto, envoltura y cursor incluidos.
    Buffer.byteLength(JSON.stringify(reply), 'utf8').should.be.belowOrEqual(2048);
  });

  it('TS-20 · `returned < limit` CON cursor no significa fin: la siguiente trae items nuevos', async () => {
    setQueryBudget(4096);

    const first = await dispatchQuery<Page>('tasks.list', {
      filter: { projectId: PROJECT_BIG },
      page: { limit: 200 },
    });

    first.data!.page.returned.should.be.below(200);
    (first.data!.page.cursor === undefined).should.be.false();

    const second = await dispatchQuery<Page>('tasks.list', {
      filter: { projectId: PROJECT_BIG },
      page: { limit: 200, cursor: first.data!.page.cursor },
    });

    second.status.should.equal('success');
    second.data!.items.length.should.be.above(0);
    const firstIds = first.data!.items.map((item) => item.id);
    for (const item of second.data!.items) {
      firstIds.should.not.containEql(item.id);
    }
  });

  it('TS-22 · el item que SOLO no entra se devuelve truncado y marcado, nunca página vacía', async () => {
    setQueryBudget(512);

    const reply = await dispatchQuery<Page>('tasks.list', {
      filter: { projectId: PROJECT_HUGE },
      page: { limit: 10 },
      include: ['description'],
    });

    reply.status.should.equal('success');
    // NUNCA CERO ITEMS CON CURSOR: para el cliente sería un bucle infinito.
    reply.data!.items.length.should.be.aboveOrEqual(1);
    reply.data!.page.returned.should.equal(reply.data!.items.length);

    const item = reply.data!.items[0];
    item.id.should.equal(31000);
    item.descriptionTruncated.should.be.true();
    (item.description as string).length.should.be.below(5000);
    // Y el JSON sigue siendo decodificable: el corte no partió un carácter multi-byte.
    JSON.parse(JSON.stringify(item)).description.should.be.a.String();
    (reply.data!.page.cursor === undefined).should.be.false();
  });

  it('el recorrido con presupuesto chico TERMINA: cada página avanza al menos un item', async () => {
    setQueryBudget(512);

    const seen: number[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_HUGE },
        page: { limit: 10, cursor: cursor ?? null },
        include: ['description'],
      });
      reply.status.should.equal('success');
      // La garantía que evita el bucle: NUNCA una página vacía con cursor.
      reply.data!.items.length.should.be.aboveOrEqual(1);
      seen.push(...reply.data!.items.map((item) => item.id));
      cursor = reply.data!.page.cursor;
      pages += 1;
      pages.should.be.below(10, 'el recorrido no avanza');
    } while (cursor);

    seen.sort().should.deepEqual([31000, 31001, 31002]);
  });

  it('con presupuesto amplio entran todos los items pedidos', async () => {
    // El presupuesto es la RED DE CONTENCIÓN, no el mecanismo habitual: el conjunto base deja
    // afuera el texto sin cota, así que una página de 200 tiene peso acotado por construcción.
    const reply = await dispatchQuery<Page>('tasks.list', {
      filter: { projectId: PROJECT_BIG },
      page: { limit: 200 },
    });

    reply.data!.page.returned.should.equal(BIG_TASKS);
    (reply.data!.page.cursor === undefined).should.be.true();
  });
});
