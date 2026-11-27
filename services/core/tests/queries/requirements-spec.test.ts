import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { requirementsSpec } from '../../src/queries/requirements/requirements-spec';
import { BaseFieldSpec, ColumnExternalScope, IncludableComputedSpec, ManyRelationSpec, OneRelationSpec } from '../../src/queries/types';

/**
 * Un campo del conjunto base, ESTRECHADO A COLUMNA.
 *
 * `ResourceSpec.base` pasó a ser `BaseSpec` en S-025 —una columna, un valor CONSTANTE o una
 * RELACIÓN—, y esta ficha declara solo columnas. El estrechamiento se hace UNA VEZ acá en vez de
 * repartir `as` por las aserciones, que es lo que apagaría la verificación en las fichas nuevas.
 */
function baseField(name: string): BaseFieldSpec {
  return requirementsSpec.base[name] as BaseFieldSpec;
}


/**
 * LA FICHA DE `requirements` COMO DATO (TS-68), y las tres trampas que copiar la de `tasks`
 * dispara: el `priorityValue` que acá no existe, el `estimatedFinishDate` que acá SÍ ordena, y el
 * `where: 'r.active = true'` que acá rompe el SQL.
 */
describe('queries/requirements — la ficha como dato (S-024)', () => {
  it('TS-68 · las cuatro listas de nombres se DERIVAN de sus mapas', () => {
    requirementsSpec.baseNames.should.deepEqual(Object.keys(requirementsSpec.base));
    requirementsSpec.includableNames.should.deepEqual(Object.keys(requirementsSpec.includable));
    requirementsSpec.filterableNames.should.deepEqual(Object.keys(requirementsSpec.filterable));
    requirementsSpec.sortableNames.should.deepEqual(Object.keys(requirementsSpec.sortable));
    requirementsSpec.fieldNames.should.deepEqual([
      ...requirementsSpec.baseNames,
      ...requirementsSpec.includableNames,
    ]);
  });

  it('CA-7 · el conjunto base son los DOCE campos declarados, con sus columnas', () => {
    [...requirementsSpec.baseNames].sort().should.deepEqual([
      'createdAt',
      'createdBy',
      'estimatedFinishDate',
      'id',
      'priority',
      'projectId',
      'state',
      'tags',
      'title',
      'type',
      'updatedAt',
      'visibilityLevel',
    ]);
    baseField('estimatedFinishDate').column.should.equal('estimated_finish_date');
    baseField('visibilityLevel').column.should.equal('visibility_level');
  });

  it('CA-8 · `priorityValue` NO EXISTE en ninguna lista de este recurso', () => {
    // El doble de `tasks` es consecuencia del TIPO de la columna (`INTEGER` allá, `ENUM` acá), no
    // una decisión de estilo del contrato.
    for (const list of [
      requirementsSpec.baseNames,
      requirementsSpec.includableNames,
      requirementsSpec.filterableNames,
      requirementsSpec.sortableNames,
      requirementsSpec.fieldNames,
    ]) {
      list.should.not.containEql('priorityValue');
    }
  });

  it('CA-8 · `priority` se filtra por NOMBRE y SIN mapa de traducción', () => {
    requirementsSpec.filterable.priority.enum!.should.equal('priority');
    // En esta tabla el nombre del enum ES el valor de la columna: no hay nada que traducir.
    (requirementsSpec.filterable.priority.values === undefined).should.be.true();
    (baseField('priority').transform === undefined).should.be.true();
  });

  it('CA-8 · `estimatedFinishDate` está en las DOS listas: filtrable Y ordenable', () => {
    requirementsSpec.filterableNames.should.containEql('estimatedFinishDate');
    // La columna es `DATE`. En `tasks` es `VARCHAR` y por eso allá no es ordenable.
    requirementsSpec.sortableNames.should.containEql('estimatedFinishDate');
    requirementsSpec.sortable.estimatedFinishDate.nullable!.should.be.true();
  });

  it('CA-7 · `id` está declarado ordenable: es el recurso que destapó el desempate duplicado', () => {
    requirementsSpec.sortableNames.should.containEql('id');
  });

  it('CA-11/CA-12 · `totalMinutes` es SOLO incluible, calculado, y suma las DOS partes', () => {
    const computed = requirementsSpec.includable.totalMinutes as IncludableComputedSpec;

    computed.kind.should.equal('computed');
    requirementsSpec.includableNames.should.containEql('totalMinutes');
    // Ni filtrable ni ordenable: son dos subconsultas correlacionadas POR FILA.
    requirementsSpec.filterableNames.should.not.containEql('totalMinutes');
    requirementsSpec.sortableNames.should.not.containEql('totalMinutes');

    // LAS DOS PARTES: las horas del requisito y las de sus tareas.
    computed.expr.should.containEql('wtr.requirement_id = t.id');
    computed.expr.should.containEql('obj.requirement_id = t.id');
    // `SUM` sobre cero filas da NULL, y `null + 120` en SQL es `null`.
    computed.expr.should.containEql('COALESCE');

    // `SUM(integer)` vuelve como STRING (`bigint`): sin el transform viajaría `"180"`.
    (computed.transform!('180') as number).should.equal(180);
  });

  it('CA-9 · `tag` declara el contains con su forma, y NO es ordenable', () => {
    requirementsSpec.filterable.tag.contains!.should.deepEqual({
      column: 'tags',
      shape: ['key', 'value'],
    });
    requirementsSpec.sortableNames.should.not.containEql('tag');
  });

  it('CA-10 · `q` declara el desvío numérico a `id`', () => {
    requirementsSpec.filterable.q.searchNumericColumn!.should.equal('id');
    [...requirementsSpec.filterable.q.search!].should.deepEqual(['title', 'description']);
  });

  it('CA-7 · `responsiblePersons` NO lleva `where`: `people_requirements` no tiene `active`', () => {
    const relation = requirementsSpec.includable.responsiblePersons as ManyRelationSpec;

    // La tiene `people_objectives`, y copiar la ficha de `tasks` acá ROMPE EL SQL.
    (relation.where === undefined).should.be.true();
    relation.table.should.equal('people_requirements');
  });

  it('CA-7 · el `where` de `attachments` es de SEGURIDAD: la tabla es polimórfica', () => {
    const relation = requirementsSpec.includable.attachments as ManyRelationSpec;

    relation.where!.should.containEql("r.entity_type = 'requirement'");
    relation.where!.should.containEql('r.deleted_at IS NULL');
    relation.join!.table.should.equal('files');
  });

  it('CA-13 · `comments` está acotado a 10 y marca `commentsTruncated`', () => {
    const relation = requirementsSpec.includable.comments as ManyRelationSpec;

    relation.table.should.equal('requirement_activity');
    relation.cap!.should.equal(10);
    relation.truncatedFlag!.should.equal('commentsTruncated');
    relation.where!.should.containEql("r.type_of_activity = 'comment'");
    // El cuerpo se lee de `new_value`: la columna se llama así porque la tabla es de actividad.
    relation.fields.body.should.equal('r.new_value');
  });

  it('CA-7 · `subscriptors` es una lista de ESCALARES sobre la tabla en SINGULAR', () => {
    const relation = requirementsSpec.includable.subscriptors as ManyRelationSpec;

    // `requirement_subscriptors`, no `requirements_`: la de tasks sí es plural.
    relation.table.should.equal('requirement_subscriptors');
    relation.scalar!.should.equal('userId');
  });

  it('CA-7 · `project` es una relación 1:1 OBLIGATORIA con sus cuatro campos', () => {
    const relation = requirementsSpec.includable.project as OneRelationSpec;

    // `project_id` es NOT NULL y tiene FK: no hay requisito sin proyecto.
    relation.optional.should.be.false();
    Object.keys(relation.fields).should.deepEqual(['id', 'name', 'code', 'status']);
  });

  it('CA-7 · los enums llevan los valores EXACTOS del DBML', () => {
    [...requirementsSpec.enums.type].should.deepEqual([
      'funcionalidad',
      'mejora',
      'incidencia',
      'otro',
    ]);
    [...requirementsSpec.enums.priority].should.deepEqual([
      'sin_prioridad',
      'baja',
      'media',
      'alta',
      'urgente',
    ]);
    [...requirementsSpec.enums.state].should.deepEqual([
      'analisis',
      'planificacion',
      'en_cola',
      'desarrollo',
      'revision',
      'resuelto',
      'cancelado',
    ]);
    [...requirementsSpec.enums.visibilityLevel].should.deepEqual(['public', 'internal']);
  });

  it('CA-7 · el recorte externo es por proyecto Y visibilidad', () => {
    const scope = requirementsSpec.externalScope as ColumnExternalScope;

    scope.should.deepEqual({
      kind: 'column',
      projectColumn: 'project_id',
      visibility: { column: 'visibility_level', value: 'public' },
    });
  });

  it('el orden por defecto es `-createdAt` y el código de "no encontrado" es la CONSTANTE', () => {
    [...requirementsSpec.defaults.sort].should.deepEqual(['-createdAt']);
    requirementsSpec.notFoundCode!.should.equal(ErrorCode.REQUIREMENT_NOT_FOUND);
  });
});
