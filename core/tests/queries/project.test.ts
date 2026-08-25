import 'mocha';
import 'should';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { projectRow } from '../../src/queries/engine/project';

/**
 * La proyección: de la fila cruda al item del contrato.
 *
 * Es donde vive ADR-004 en la dirección de LECTURA. Se testea sin base a propósito: lo que se
 * verifica es la traducción, no que PostgreSQL sepa hacer un SELECT.
 */

/** Una fila cruda tal como la devuelve el SELECT del motor, con los alias de la ficha. */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 8140,
    title: 'Una tarea',
    state: 'activo',
    area: 'desarrollo',
    priority: 2,
    priorityValue: 2,
    estimatedFinishDate: '2026-09-01',
    finishedAt: null,
    visibilityLevel: 'public',
    projectId: 12,
    requirementId: null,
    createdBy: 'u-creator',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    __k0: '2026-08-01T00:00:00.000Z',
    __k1: 8140,
    ...overrides,
  };
}

describe('queries/engine/project — la proyección (CA-8, CA-21)', () => {
  it('proyecta EXACTAMENTE el conjunto pedido, ni un campo más', () => {
    const { item } = projectRow(tasksSpec, ['id', 'title'], 2, row());

    Object.keys(item).sort().should.deepEqual(['id', 'title']);
    // Las claves internas del keyset NO salen al contrato.
    JSON.stringify(item).should.not.containEql('__k');
  });

  it('el conjunto base sale con los nombres del CONTRATO, no con los de la base', () => {
    const { item } = projectRow(tasksSpec, tasksSpec.baseNames, 2, row());

    Object.keys(item).sort().should.deepEqual([
      'area',
      'createdAt',
      'createdBy',
      'estimatedFinishDate',
      'finishedAt',
      'id',
      'priority',
      'priorityValue',
      'projectId',
      'requirementId',
      'state',
      'title',
      'updatedAt',
      'visibilityLevel',
    ]);
    // `description` no está: es incluible, no base.
    item.should.not.have.property('description');
  });

  it('TS-38 · `priority` va doble y el 5 NO SE PIERDE', () => {
    const urgent = projectRow(tasksSpec, ['priority', 'priorityValue'], 0, row({ priority: 5, priorityValue: 5 }));
    urgent.item.priority!.should.equal('urgente');
    urgent.item.priorityValue!.should.equal(5);

    const media = projectRow(tasksSpec, ['priority', 'priorityValue'], 0, row({ priority: 2, priorityValue: 2 }));
    media.item.priority!.should.equal('media');
    media.item.priorityValue!.should.equal(2);

    // El 4 también se lee `urgente`: los dos enteros comparten nombre, y por eso existe
    // `priorityValue`.
    const cuatro = projectRow(tasksSpec, ['priority', 'priorityValue'], 0, row({ priority: 4, priorityValue: 4 }));
    cuatro.item.priority!.should.equal('urgente');
    cuatro.item.priorityValue!.should.equal(4);
  });

  it('TS-57 · una relación 1:1 presente sale con SUS CUATRO CLAVES', () => {
    const { item } = projectRow(
      tasksSpec,
      ['id', 'project'],
      0,
      row({
        project__id: 12,
        project__name: 'Portal Jiku',
        project__code: 'PJK',
        project__status: 'activo',
      })
    );

    item.project!.should.deepEqual({ id: 12, name: 'Portal Jiku', code: 'PJK', status: 'activo' });
  });

  it('TS-57 · una relación 1:1 con FK nula es `null`, y la tarea SE DEVUELVE IGUAL', () => {
    const { item } = projectRow(
      tasksSpec,
      ['id', 'requirement'],
      0,
      row({ requirement__id: null, requirement__title: null, requirement__state: null })
    );

    // `null`, no un objeto de nulls: el LEFT JOIN no encontró fila.
    (item.requirement === null).should.be.true();
    item.id!.should.equal(8140);
  });

  it('las claves de orden salen aparte, para el cursor', () => {
    const { keys } = projectRow(tasksSpec, ['id'], 2, row());

    keys.should.deepEqual(['2026-08-01T00:00:00.000Z', 8140]);
  });

  it('una relación de colección deja su clave lista para el lote', () => {
    const { item } = projectRow(tasksSpec, ['id', 'comments'], 0, row());

    // El lugar de la clave lo fija el conjunto devuelto, no el momento en que llega el lote.
    item.comments!.should.deepEqual([]);
  });

  it('TS-58 · ningún item expone columnas que la ficha no declara', () => {
    const { item } = projectRow(
      tasksSpec,
      tasksSpec.baseNames,
      0,
      row({ ticket_slug: 'X-1', storage_key: 'k', storage_bucket: 'b', storage_region: 'r' })
    );

    for (const forbidden of ['ticketSlug', 'ticket_slug', 'storageKey', 'storage_key']) {
      item.should.not.have.property(forbidden);
    }
  });
});
