import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { projectsSpec } from '../../src/queries/projects/projects-spec';
import { BaseFieldSpec, ColumnExternalScope, OneRelationSpec } from '../../src/queries/types';

/**
 * Un campo del conjunto base, ESTRECHADO A COLUMNA.
 *
 * `ResourceSpec.base` pasó a ser `BaseSpec` en S-025 —una columna, un valor CONSTANTE o una
 * RELACIÓN—, y esta ficha declara solo columnas. El estrechamiento se hace UNA VEZ acá en vez de
 * repartir `as` por las aserciones, que es lo que apagaría la verificación en las fichas nuevas.
 */
function baseField(name: string): BaseFieldSpec {
  return projectsSpec.base[name] as BaseFieldSpec;
}


/**
 * LA FICHA DE `projects` COMO DATO (TS-68), y las dos ausencias deliberadas del recurso.
 */
describe('queries/projects — la ficha como dato (S-024)', () => {
  it('TS-68 · las cuatro listas de nombres se DERIVAN de sus mapas', () => {
    projectsSpec.baseNames.should.deepEqual(Object.keys(projectsSpec.base));
    projectsSpec.includableNames.should.deepEqual(Object.keys(projectsSpec.includable));
    projectsSpec.filterableNames.should.deepEqual(Object.keys(projectsSpec.filterable));
    projectsSpec.sortableNames.should.deepEqual(Object.keys(projectsSpec.sortable));
    projectsSpec.fieldNames.should.deepEqual([
      ...projectsSpec.baseNames,
      ...projectsSpec.includableNames,
    ]);
  });

  it('CA-4 · el conjunto base son DIEZ campos, con sus columnas reales', () => {
    projectsSpec.baseNames.length.should.equal(10);
    [...projectsSpec.baseNames].should.deepEqual([
      'id',
      'code',
      'name',
      'type',
      'status',
      'clientId',
      'originId',
      'createdBy',
      'createdAt',
      'updatedAt',
    ]);
    baseField('clientId').column.should.equal('client_id');
    baseField('originId').column.should.equal('origin_id');
    baseField('createdBy').column.should.equal('created_by');
  });

  it('CA-6 · `ticketSlug` NO EXISTE para esta API, en ninguna de las cuatro listas', () => {
    for (const list of [
      projectsSpec.baseNames,
      projectsSpec.includableNames,
      projectsSpec.filterableNames,
      projectsSpec.sortableNames,
      projectsSpec.fieldNames,
    ]) {
      list.should.not.containEql('ticketSlug');
    }
    // Ni el nombre de la columna asoma por ningún lado de la ficha.
    JSON.stringify(projectsSpec).should.not.containEql('ticket_slug');
  });

  it('CA-5 · `properties` es INCLUIBLE y NO filtrable', () => {
    projectsSpec.includableNames.should.containEql('properties');
    // La columna es `JSON` y no `JSONB`: no admite el contains indexado, y un filtro en memoria o
    // un `Seq Scan` con cast por fila rompen el keyset.
    projectsSpec.filterableNames.should.not.containEql('properties');
    projectsSpec.sortableNames.should.not.containEql('properties');
  });

  it('CA-5 · `properties` declara SU columna real y su traducción de lectura', () => {
    const properties = projectsSpec.includable.properties;

    properties.kind.should.equal('field');
    (properties as { column: string }).column.should.equal('key_value_pairs');
    (typeof (properties as { transform?: unknown }).transform).should.equal('function');
  });

  it('CA-4 · los cuatro ordenables NULL-ables lo declaran, y los otros cuatro no', () => {
    for (const name of ['name', 'code', 'priority', 'endDate']) {
      projectsSpec.sortable[name].nullable!.should.be.true();
    }
    for (const name of ['status', 'initDate', 'createdAt', 'updatedAt']) {
      (projectsSpec.sortable[name].nullable === undefined).should.be.true();
    }
  });

  it('CA-4 · `client` y `origin` son relaciones 1:1 OPCIONALES', () => {
    for (const name of ['client', 'origin']) {
      const relation = projectsSpec.includable[name] as OneRelationSpec;

      relation.kind.should.equal('relation');
      relation.cardinality.should.equal('one');
      // LEFT JOIN: las dos FK son NULL-ables y con INNER un proyecto sin actor desaparecería.
      relation.optional.should.be.true();
      Object.keys(relation.fields).should.deepEqual(['id', 'name']);
    }
  });

  it('CA-4 · los enums llevan los valores EXACTOS del DBML', () => {
    [...projectsSpec.enums.type].should.deepEqual([
      'interno',
      'comercial',
      'investigacion',
      'propuesta',
    ]);
    [...projectsSpec.enums.status].should.deepEqual([
      'analisis',
      'activo',
      'inactivo',
      'finalizado',
      'cancelado',
    ]);
  });

  it('CA-4 · `priority` se filtra por ENTERO, no por nombre: en esta tabla la columna es INTEGER', () => {
    projectsSpec.filterable.priority.kind!.should.equal('integer');
    (projectsSpec.filterable.priority.enum === undefined).should.be.true();
  });

  it('CA-4 · el recorte externo es por SU PROPIA `id` y SIN visibilidad', () => {
    const scope = projectsSpec.externalScope as ColumnExternalScope;

    scope.should.deepEqual({ kind: 'column', projectColumn: 'id' });
    // La ausencia de `visibility` significa "no tiene columna de visibilidad", no "no recortes".
    (scope.visibility === undefined).should.be.true();
  });

  it('el orden por defecto es `-createdAt` y el código de "no encontrado" es la CONSTANTE', () => {
    [...projectsSpec.defaults.sort].should.deepEqual(['-createdAt']);
    projectsSpec.notFoundCode!.should.equal(ErrorCode.PROJECT_NOT_FOUND);
  });
});
