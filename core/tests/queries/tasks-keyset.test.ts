import 'mocha';
import 'should';
import * as sinon from 'sinon';
import { Objective } from '@jiku/models';
import { sequelize } from '../../src/models';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import { CREATOR, createTasks, createWorld, destroyWorld } from './task-fixtures';

/**
 * TS-18 · EL RECORRIDO COMPLETO DE 500 FILAS, CON ESCRITURAS CONCURRENTES EN CURSO.
 *
 * Es el test más caro de la story y el que más importa. SIN LA CONCURRENCIA NO PROBARÍA NADA:
 * una implementación con `OFFSET` recorre 500 filas quietas igual de bien. Lo que `OFFSET` no
 * puede hacer es sobrevivir a una inserción o a un borrado en el medio del recorrido, porque su
 * "página N" se define por posición y las posiciones se corren.
 *
 * El invariante es sobre LAS 500 QUE EXISTÍAN AL EMPEZAR: las nuevas pueden aparecer o no —el
 * keyset no promete una foto—, pero ninguna de las 500 puede faltar ni repetirse.
 */

const PROJECT_KEYSET = 21;
const FIRST_ID = 20000;
const TOTAL = 500;
const PAGE = 200;

interface Page {
  items: Record<string, any>[];
  page: { limit: number; returned: number; cursor?: string };
}

describe('queries/tasks — paginación keyset (CA-12, CA-13)', () => {
  const originals = Array.from({ length: TOTAL }, (_, index) => FIRST_ID + index);
  const extras: number[] = [];

  before(async () => {
    await createWorld([PROJECT_KEYSET]);
    await createTasks(
      originals.map((id) => ({
        id,
        title: `Keyset ${id}`,
        projectId: PROJECT_KEYSET,
      }))
    );

    // `created_at` DISTINTO por fila y en el pasado, en UNA sentencia: 500 UPDATE sueltos harían
    // este `before` más lento que el test. Que estén en el pasado importa: las filas que se
    // inserten DURANTE el recorrido llevan `now()` y, con el orden `-createdAt`, caen en la parte
    // ya recorrida — que es exactamente el caso que el keyset promete tolerar.
    await sequelize.query(
      `UPDATE objectives
          SET created_at = TIMESTAMP '2026-01-01 00:00:00' + make_interval(secs => id - :first)
        WHERE project_id = :project`,
      { replacements: { first: FIRST_ID, project: PROJECT_KEYSET } }
    );
  });

  after(async () => {
    await destroyWorld();
  });

  afterEach(() => sinon.restore());

  it('TS-18 · recorre las 500 sin repetir ni saltear, con escrituras en curso', async () => {
    const spy = sinon.spy(readDb, 'query');
    const seen: number[] = [];
    let cursor: string | undefined;
    let pages = 0;
    let lastCursor: string | undefined = 'inicial';

    do {
      const reply = await dispatchQuery<Page>('tasks.list', {
        // FILTRO Y ORDEN IDÉNTICOS entre página y página: es lo que el cursor exige.
        filter: { projectId: PROJECT_KEYSET },
        page: { limit: PAGE, cursor: cursor ?? null },
      });

      reply.status.should.equal('success');
      seen.push(...reply.data!.items.map((item) => item.id));
      cursor = reply.data!.page.cursor;
      lastCursor = cursor;
      pages += 1;

      if (cursor) {
        // ESCRITURAS CONCURRENTES, entre página y página. Sin esto el test pasa con OFFSET.
        const extraId = 21000 + pages;
        await Objective.create({
          id: extraId,
          title: `Insertada durante el recorrido ${pages}`,
          state: 'backlog',
          area: 'desarrollo',
          priority: 0,
          visibilityLevel: 'public',
          projectId: PROJECT_KEYSET,
          createdBy: CREATOR,
        } as any);
        extras.push(extraId);

        // Y una edición de una fila YA RECORRIDA: no puede reaparecer.
        await Objective.update(
          { title: `Editada en la vuelta ${pages}` },
          { where: { id: seen[0] }, silent: true }
        );
      }

      pages.should.be.below(20, 'el recorrido no termina: probable bucle infinito');
    } while (cursor);

    const originalsSeen = seen.filter((id) => originals.includes(id));

    // NI REPETIDAS...
    new Set(seen).size.should.equal(seen.length);
    // ...NI SALTEADAS: las 500 que existían al empezar están todas.
    new Set(originalsSeen).size.should.equal(TOTAL);
    // Y la ÚNICA señal de fin es la ausencia de cursor.
    (lastCursor === undefined).should.be.true();
    pages.should.be.aboveOrEqual(3);

    // La otra mitad de "falla si se implementa con OFFSET", verificable leyendo el SQL.
    for (const call of spy.getCalls()) {
      String(call.args[0]).should.not.containEql('OFFSET');
    }
  });

  it('CA-13 · `returned < limit` no significa fin; la ausencia de cursor sí', async () => {
    // Una página entera y la última: la primera trae `returned === limit` Y cursor, la última
    // trae menos y NO trae cursor. Son las dos únicas lecturas válidas.
    let cursor: string | undefined;
    let last: Page | null = null;
    let first: Page | null = null;

    do {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_KEYSET },
        page: { limit: PAGE, cursor: cursor ?? null },
      });
      first = first ?? reply.data!;
      last = reply.data!;
      cursor = reply.data!.page.cursor;
    } while (cursor);

    first!.page.returned.should.equal(PAGE);
    (first!.page.cursor === undefined).should.be.false();
    last!.page.returned.should.be.below(PAGE);
    (last!.page.cursor === undefined).should.be.true();
  });

  it('CA-12 · el recorrido por una columna NULL-able NO se corta en el primer NULL', async () => {
    // EL BUG QUE ESTE TEST EXISTE PARA IMPEDIR: `finishedAt` es ordenable y NULL-able, y una
    // comparación de tuplas con un NULL adentro da NULL —ninguna fila—. Con el predicado ingenuo,
    // el recorrido termina apenas la clave de corte cae en un NULL y el caller recibe DATOS DE
    // MENOS sin ningún síntoma: la respuesta es `success` y simplemente no trae cursor.
    //
    // La mitad de las 500 tiene `finished_at`; la otra mitad no. Con `DESC` los NULL van PRIMERO,
    // así que el corte cae dentro del bloque de NULL en alguna página, que es el caso peligroso.
    await sequelize.query(
      `UPDATE objectives
          SET finished_at = TIMESTAMP '2026-03-01 00:00:00' + make_interval(secs => id - :first)
        WHERE project_id = :project AND id % 2 = 0`,
      { replacements: { first: FIRST_ID, project: PROJECT_KEYSET } }
    );

    for (const sort of [['-finishedAt'], ['finishedAt']]) {
      const seen: number[] = [];
      let cursor: string | undefined;
      let pages = 0;

      do {
        const reply = await dispatchQuery<Page>('tasks.list', {
          filter: { projectId: PROJECT_KEYSET },
          sort,
          page: { limit: PAGE, cursor: cursor ?? null },
        });
        reply.status.should.equal('success', sort.join());
        seen.push(...reply.data!.items.map((item) => item.id));
        cursor = reply.data!.page.cursor;
        pages += 1;
        pages.should.be.below(20, `el recorrido no termina con sort ${sort.join()}`);
      } while (cursor);

      new Set(seen).size.should.equal(seen.length, sort.join());
      // TODAS las originales, las que tienen fecha de fin y las que no.
      seen.filter((id) => originals.includes(id)).length.should.equal(TOTAL, sort.join());
    }
  });

  it('el recorrido con `sort` explícito de dirección MIXTA también cierra', async () => {
    // La rama disyuntiva del keyset: la comparación de tuplas no sirve con direcciones mixtas, y
    // un bug ahí se ve como un recorrido que no termina o que saltea filas.
    const seen: number[] = [];
    let cursor: string | undefined;
    let pages = 0;

    do {
      const reply = await dispatchQuery<Page>('tasks.list', {
        filter: { projectId: PROJECT_KEYSET },
        sort: ['title', '-createdAt'],
        page: { limit: PAGE, cursor: cursor ?? null },
      });
      reply.status.should.equal('success');
      seen.push(...reply.data!.items.map((item) => item.id));
      cursor = reply.data!.page.cursor;
      pages += 1;
      pages.should.be.below(20, 'el recorrido no termina con direcciones mixtas');
    } while (cursor);

    new Set(seen).size.should.equal(seen.length);
    seen.filter((id) => originals.includes(id)).length.should.equal(TOTAL);
  });
});
