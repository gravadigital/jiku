import 'mocha';
import 'should';
import sinon from 'sinon';
import { readDb } from '../../src/models/read';
import { dispatchQuery } from '../helpers/dispatch';
import {
  Q_EXTERNAL,
  createQueryCallers,
  createWorld,
  destroyQueryCallers,
  destroyWorld,
} from './task-fixtures';
import {
  PERSON_LINKED,
  UT_MEDICO,
  UT_VACACIONES,
  WT_LATE,
  WT_REQ,
  createTeamWorld,
  destroyTeamWorld,
} from './team-fixtures';

/**
 * `unworked-times.list` — LAS AUSENCIAS (S-026, Task 7).
 *
 * El hermano que NO hay que copiar de `worked-times`: ordena ASCENDENTE, tiene el único enum de los
 * seis recursos, y su columna `date` es `DATE` y no `TIMESTAMP`.
 */

const REASONS = [
  'tramite',
  'corte_servicios',
  'vacaciones',
  'dia_no_laborable',
  'personal',
  'medico',
  'estudio',
  'enfermedad',
  'otro',
];

function ids(reply: any): number[] {
  return reply.data.items.map((item: any) => item.id);
}

describe('queries/unworked-times.list — la ficha, el enum y el orden ascendente', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-53 · el conjunto base son SIETE campos exactos', async () => {
    const reply: any = await dispatchQuery('unworked-times.list', { filter: { id: UT_MEDICO } });

    reply.status.should.equal('success');
    Object.keys(reply.data.items[0]).should.deepEqual([
      'id',
      'date',
      'minutes',
      'reason',
      'personId',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('TS-54 · `filter.reason` acepta los valores del enum', async () => {
    const reply: any = await dispatchQuery('unworked-times.list', { filter: { reason: 'medico' } });

    ids(reply).should.deepEqual([UT_MEDICO]);
  });

  it('TS-55 · un `reason` fuera del enum es `invalid_fields` con LOS NUEVE en `allowed`', async () => {
    const reply: any = await dispatchQuery('unworked-times.list', { filter: { reason: 'feriado' } });

    reply.status.should.equal('failure');
    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.field.should.equal('filter.reason');
    // Los NUEVE, en el orden exacto del DBML. No "un array no vacío".
    reply.errorDetails.allowed.should.deepEqual(REASONS);
  });

  it('TS-56 · `person` es el único incluible', async () => {
    const ok: any = await dispatchQuery('unworked-times.list', {
      filter: { id: UT_MEDICO },
      include: ['person'],
    });
    ok.data.items[0].person.should.deepEqual({
      id: PERSON_LINKED,
      firstName: 'Carla',
      lastName: 'Benítez',
    });

    const bad: any = await dispatchQuery('unworked-times.list', { include: ['project'] });
    bad.errorCode.should.equal('invalid_fields');
    bad.errorDetails.allowed.should.deepEqual(['person']);
  });

  it('TS-57 · el sort default es `["date"]` ASCENDENTE y el desempate es `id` ASC', async () => {
    const reply: any = await dispatchQuery('unworked-times.list', {
      filter: { personId: PERSON_LINKED },
    });

    /*
     * EL DEFAULT ES ASCENDENTE, a diferencia del `-date` de `worked-times`.
     *
     * LA ASERCIÓN COMPARA CONTRA EL ID DE LA FILA MÁS VIEJA y no contra "está ordenado": invertido,
     * el resultado SIGUE ESTANDO ORDENADO, así que un `should be sorted` pasaría con el bug adentro.
     */
    ids(reply).should.deepEqual([UT_MEDICO, UT_VACACIONES]);
  });

  it('TS-58 · lo ordenable de `unworked-times` son dos nombres', async () => {
    const reply: any = await dispatchQuery('unworked-times.list', { sort: ['minutes'] });

    reply.errorCode.should.equal('invalid_fields');
    reply.errorDetails.allowed.should.deepEqual(['date', 'id']);
  });

  it('TS-64 · H-4 · el rango de fechas se comporta DISTINTO en las dos tablas, y queda fijado', async () => {
    /*
     * H-4 · `worked_times.date` es `TIMESTAMP` y `unworked_times.date` es `DATE` (inconsistencia 4
     * del esquema). Dos recursos hermanos, el mismo nombre de campo, DOS TIPOS DISTINTOS.
     *
     * El contrato NO LO PUEDE OCULTAR y no lo intenta con un `transform` inventado: la diferencia es
     * real, y este test la fija para que un cambio del driver o del esquema la rompa RUIDOSAMENTE.
     * `meta.describe` (S-028) tiene que exponer el tipo de cada campo por esto mismo.
     */
    const unworked: any = await dispatchQuery('unworked-times.list', {
      filter: { personId: PERSON_LINKED, date: { lte: '2026-08-31' } },
    });
    // Columna `DATE`: el 31 entra.
    ids(unworked).should.containEql(UT_VACACIONES);

    const worked: any = await dispatchQuery('worked-times.list', {
      filter: { personId: PERSON_LINKED, date: { lte: '2026-08-31' } },
    });
    // Columna `TIMESTAMP`: la fila de medianoche entra y la de las 14:30 QUEDA AFUERA del mismo
    // rango. Es lo que el camino de escritura del producto oculta —siempre guarda medianoche— y lo
    // que una carga manual o un dato histórico destapan.
    ids(worked).should.containEql(WT_REQ);
    ids(worked).should.not.containEql(WT_LATE);
  });
});

describe('queries/unworked-times.list — SIN ACCESO EXTERNO (CA-9)', () => {
  before(async () => {
    await createWorld();
    await createQueryCallers();
    await createTeamWorld();
  });

  after(async () => {
    await destroyTeamWorld();
    await destroyQueryCallers();
    await destroyWorld();
  });

  it('TS-4 · un caller externo recibe `items: []` SIN EJECUTAR UNA SOLA CONSULTA', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      const reply: any = await dispatchQuery('unworked-times.list', {}, Q_EXTERNAL);

      reply.status.should.equal('success');
      reply.data.items.should.deepEqual([]);
      spy.callCount.should.equal(0);
    } finally {
      spy.restore();
    }
  });

  it('TS-7 · `count: "only"` externo devuelve `total: 0` sin SQL', async () => {
    const spy = sinon.spy(readDb, 'query');
    try {
      const reply: any = await dispatchQuery('unworked-times.list', { count: 'only' }, Q_EXTERNAL);

      reply.data.page.total.should.equal(0);
      reply.data.items.should.deepEqual([]);
      reply.data.page.returned.should.equal(0);
      spy.callCount.should.equal(0);
    } finally {
      spy.restore();
    }
  });
});
