import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { TASK_PRIORITY_VALUES, TaskPriority } from '../../src/commands/tasks/priority';
import { tasksSpec } from '../../src/queries/tasks/tasks-spec';
import { OneRelationSpec, ManyRelationSpec } from '../../src/queries/types';

/**
 * TS-53 · LA FICHA ES UN DATO, legible por otro código sin ejecutar nada.
 *
 * Es el criterio de aceptación más importante del diseño (CA-30) y el que decide si las 17 fichas
 * que vienen después son datos que se escriben o motores que se reimplementan. Se lee acá igual
 * que la va a leer S-028 para derivar `meta.describe`: recorriendo el objeto.
 */
describe('queries/tasks — la ficha como DATO (CA-30)', () => {
  it('TS-53 · el recurso se llama `tasks` y la tabla es `objectives`', () => {
    tasksSpec.name.should.equal('tasks');
    // ADR-004: el vocabulario del producto vive en el contrato, no en el esquema.
    tasksSpec.table.should.equal('objectives');
  });

  it('TS-53 · el conjunto base son EXACTAMENTE los 14 campos del contrato', () => {
    [...tasksSpec.baseNames].sort().should.deepEqual([
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
    // `description` NO es base: es texto sin cota (RF-17).
    tasksSpec.baseNames.should.not.containEql('description');
  });

  it('TS-53 · cada campo base declara SU COLUMNA, que es lo único que puede llegar al SQL', () => {
    tasksSpec.base.createdAt.column.should.equal('created_at');
    tasksSpec.base.projectId.column.should.equal('project_id');
    tasksSpec.base.visibilityLevel.column.should.equal('visibility_level');
    tasksSpec.base.estimatedFinishDate.column.should.equal('estimated_finish_date');
    // `priority` y `priorityValue` son LA MISMA COLUMNA leída de dos formas (CA-21).
    tasksSpec.base.priority.column.should.equal('priority');
    tasksSpec.base.priorityValue.column.should.equal('priority');
    // Y solo una de las dos traduce.
    (typeof tasksSpec.base.priority.transform).should.equal('function');
    (tasksSpec.base.priorityValue.transform === undefined).should.be.true();
  });

  it('TS-53 · los incluibles declaran su `kind`, y las colecciones su tope y su marca', () => {
    // El ORDEN importa: es el que viaja en `errorDetails.allowed` de un `include` inventado.
    tasksSpec.includableNames.should.deepEqual([
      'description',
      'project',
      'requirement',
      'responsiblePersons',
      'comments',
      'subscriptors',
    ]);

    tasksSpec.includable.description.kind.should.equal('field');
    for (const name of ['project', 'requirement', 'responsiblePersons', 'comments', 'subscriptors']) {
      tasksSpec.includable[name].kind.should.equal('relation', name);
    }

    const project = tasksSpec.includable.project as OneRelationSpec;
    project.cardinality.should.equal('one');
    project.optional.should.be.false();
    Object.keys(project.fields).sort().should.deepEqual(['code', 'id', 'name', 'status']);

    // La FK es NULL-able y sin constraint: LEFT JOIN o la tarea sin requisito desaparece.
    (tasksSpec.includable.requirement as OneRelationSpec).optional.should.be.true();

    const comments = tasksSpec.includable.comments as ManyRelationSpec;
    comments.cardinality.should.equal('many');
    comments.cap!.should.equal(10);
    comments.truncatedFlag!.should.equal('commentsTruncated');
    // La traducción de vocabulario está DECLARADA: `new_value` es `body`, `changed_by` es `authorId`.
    comments.fields.body.should.equal('r.new_value');
    comments.fields.authorId.should.equal('r.changed_by');

    // `subscriptors` devuelve escalares, no objetos: el contrato dice `[userId]`.
    (tasksSpec.includable.subscriptors as ManyRelationSpec).scalar!.should.equal('userId');
  });

  it('TS-53 · `filterable` y `sortable` son listas INDEPENDIENTES (CA-7)', () => {
    // `estimatedFinishDate` está en una y NO en la otra, y es la razón por la que las dos listas
    // existen por separado: la columna es VARCHAR, así que se puede comparar pero no ordenar.
    tasksSpec.filterableNames.should.containEql('estimatedFinishDate');
    tasksSpec.sortableNames.should.not.containEql('estimatedFinishDate');

    tasksSpec.sortableNames.should.deepEqual([
      'title',
      'state',
      'priority',
      'finishedAt',
      'createdAt',
      'updatedAt',
    ]);

    for (const name of [
      'id',
      'projectId',
      'requirementId',
      'state',
      'area',
      'priority',
      'priorityValue',
      'visibilityLevel',
      'createdBy',
      'responsiblePersonId',
      'finishedAt',
      'createdAt',
      'updatedAt',
      'q',
    ]) {
      tasksSpec.filterableNames.should.containEql(name);
    }
  });

  it('TS-53 · `q` declara SOBRE QUÉ COLUMNAS busca', () => {
    // Qué se busca es parte del contrato: si no estuviera declarado, `meta.describe` no podría
    // decirlo y el caller tendría que adivinarlo.
    [...tasksSpec.filterable.q.search!].should.deepEqual(['title', 'description']);
  });

  it('TS-53 · `responsiblePersonId` filtra por otra tabla, y la relación tiene OTRA regla', () => {
    // La asimetría de `active` es deliberada y está declarada en la ficha, no escondida en el SQL.
    tasksSpec.filterable.responsiblePersonId.via!.table.should.equal('people_objectives');
    tasksSpec.filterable.responsiblePersonId.via!.column.should.equal('person_id');
    // El filtro NO menciona `active`...
    JSON.stringify(tasksSpec.filterable.responsiblePersonId).should.not.containEql('active');
    // ...y la relación SÍ, con solo los activos.
    (tasksSpec.includable.responsiblePersons as ManyRelationSpec).where!.should.equal(
      'r.active = true'
    );
  });

  it('TS-53 · el default de orden es `["-createdAt"]`', () => {
    [...tasksSpec.defaults.sort].should.deepEqual(['-createdAt']);
  });

  it('TS-53 · el enum de `priority` SE DERIVA de TASK_PRIORITY_VALUES, no se escribe literal', () => {
    // Comparación por IDENTIDAD: si alguien lo copiara a un literal, este test se pondría rojo
    // aunque los cinco valores coincidieran hoy. Un enum literal se desincroniza en silencio.
    ((tasksSpec.enums.priority as unknown) === (TASK_PRIORITY_VALUES as unknown)).should.be.true();
    tasksSpec.enums.priority.length.should.equal(5);

    // Los tres enums de la base van literales, con los valores EXACTOS del DBML (con la `ñ`).
    [...tasksSpec.enums.state].should.deepEqual([
      'backlog',
      'activo',
      'en_revision',
      'finalizado',
      'cancelado',
    ]);
    [...tasksSpec.enums.area].should.deepEqual([
      'diseño',
      'desarrollo',
      'gestion',
      'investigacion',
    ]);
    [...tasksSpec.enums.visibilityLevel].should.deepEqual(['public', 'internal']);
  });

  it('TS-53 · filtrar por `priority` con nombre incluye el 4 Y el 5, porque los dos se leen igual', () => {
    // Es la sutileza que se perdería al duplicar el mapa: `FROM_NUMBER[5] = urgente`.
    [...tasksSpec.filterable.priority.values![TaskPriority.Urgente]].should.deepEqual([4, 5]);
    [...tasksSpec.filterable.priority.values![TaskPriority.Media]].should.deepEqual([2]);
    [...tasksSpec.filterable.priority.values![TaskPriority.SinPrioridad]].should.deepEqual([0]);
  });

  it('TS-58 · `ticketSlug` no aparece en NINGUNA lista (RF-26)', () => {
    // La ficha es el lugar donde algo se declara o no existe: "no está declarado" es la única
    // forma de "no se puede pedir".
    for (const list of [
      tasksSpec.baseNames,
      tasksSpec.includableNames,
      tasksSpec.filterableNames,
      tasksSpec.sortableNames,
      tasksSpec.fieldNames,
    ]) {
      list.should.not.containEql('ticketSlug');
    }
    JSON.stringify(tasksSpec).should.not.containEql('ticket_slug');
  });

  it('TS-44 · el recorte del modo externo se declara con COLUMNAS, y declararlo es aplicarlo', () => {
    // S-023 le sacó a la ficha el par `applied`/`appliedBy`: mientras existiera, un recurso podía
    // declarar un recorte y desactivarlo con un booleano, y los 17 que vienen después lo iban a
    // copiar de acá. El estado peligroso deja de ser REPRESENTABLE.
    tasksSpec.externalScope.projectColumn.should.equal('project_id');
    tasksSpec.externalScope.visibility.should.deepEqual({
      // COLUMNA y no campo del contrato: al SQL solo llegan nombres que la ficha declara como
      // columnas, y el motor no tiene que resolver `visibilityLevel` contra `base` en tiempo de
      // armado —una búsqueda que puede fallar—.
      column: 'visibility_level',
      value: 'public',
    });
    Object.keys(tasksSpec.externalScope).sort().should.deepEqual(['projectColumn', 'visibility']);
  });

  it('el código de "no encontrado" es `task_not_found`, con la CONSTANTE', () => {
    tasksSpec.notFoundCode.should.equal(ErrorCode.TASK_NOT_FOUND);
    // `objective_not_found` se queda en los comandos.
    tasksSpec.notFoundCode.should.not.equal(ErrorCode.OBJECTIVE_NOT_FOUND);
  });

  it('`fieldNames` es `base ∪ includable`: lo que `fields` puede nombrar', () => {
    [...tasksSpec.fieldNames].sort().should.deepEqual(
      [...tasksSpec.baseNames, ...tasksSpec.includableNames].sort()
    );
  });

  it('el campo truncable por presupuesto es el texto sin cota', () => {
    [...tasksSpec.truncatable].should.deepEqual(['description']);
  });
});
