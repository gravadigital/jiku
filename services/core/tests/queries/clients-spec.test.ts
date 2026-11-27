import 'mocha';
import 'should';
import { ErrorCode } from '@jiku/nats-protocol';
import { clientsSpec } from '../../src/queries/clients/clients-spec';
import { BaseFieldSpec, ExistsExternalScope } from '../../src/queries/types';

/**
 * Un campo del conjunto base, ESTRECHADO A COLUMNA.
 *
 * `ResourceSpec.base` pasó a ser `BaseSpec` en S-025 —una columna, un valor CONSTANTE o una
 * RELACIÓN—, y esta ficha declara solo columnas. El estrechamiento se hace UNA VEZ acá en vez de
 * repartir `as` por las aserciones, que es lo que apagaría la verificación en las fichas nuevas.
 */
function baseField(name: string): BaseFieldSpec {
  return clientsSpec.base[name] as BaseFieldSpec;
}


/**
 * LA FICHA DE `clients` COMO DATO (TS-68).
 *
 * Lo que se verifica es que la ficha se pueda LEER sin ejecutar nada: es la misma propiedad que
 * hace que `meta.describe` (S-028) pueda proyectarla sin una segunda copia, y la que hace que la
 * descripción del contrato no pueda mentir.
 */
describe('queries/clients — la ficha como dato (S-024)', () => {
  it('TS-68 · las cuatro listas de nombres se DERIVAN de sus mapas', () => {
    clientsSpec.baseNames.should.deepEqual(Object.keys(clientsSpec.base));
    clientsSpec.includableNames.should.deepEqual(Object.keys(clientsSpec.includable));
    clientsSpec.filterableNames.should.deepEqual(Object.keys(clientsSpec.filterable));
    clientsSpec.sortableNames.should.deepEqual(Object.keys(clientsSpec.sortable));
    clientsSpec.fieldNames.should.deepEqual([
      ...clientsSpec.baseNames,
      ...clientsSpec.includableNames,
    ]);
  });

  it('el recurso se llama `clients` en el contrato Y en la base: NO hay traducción', () => {
    // La UI dice "Actor". Esa traducción es de la UI, no de core.
    clientsSpec.name.should.equal('clients');
    clientsSpec.table.should.equal('clients');
  });

  it('CA-3 · el conjunto base son los cuatro campos declarados', () => {
    [...clientsSpec.baseNames].should.deepEqual(['id', 'name', 'createdAt', 'updatedAt']);
    // `description` es INCLUIBLE, no base: es texto sin cota.
    [...clientsSpec.includableNames].should.deepEqual(['description']);
  });

  it('cada campo declara SU columna real', () => {
    baseField('createdAt').column.should.equal('created_at');
    baseField('updatedAt').column.should.equal('updated_at');
    baseField('name').column.should.equal('name');
  });

  it('CA-3 · los filtros y los ordenables son los declarados, y son listas INDEPENDIENTES', () => {
    [...clientsSpec.filterableNames].should.deepEqual(['id', 'name', 'createdAt', 'q']);
    [...clientsSpec.sortableNames].should.deepEqual(['name', 'createdAt', 'updatedAt']);
    // `q` filtra y no ordena; `updatedAt` ordena y no filtra. Las dos listas no se derivan una de
    // la otra.
    clientsSpec.sortableNames.should.not.containEql('q');
    clientsSpec.filterableNames.should.not.containEql('updatedAt');
  });

  it('`q` busca en `name` y `description`, y NO se desvía a `id`', () => {
    [...clientsSpec.filterable.q.search!].should.deepEqual(['name', 'description']);
    (clientsSpec.filterable.q.searchNumericColumn === undefined).should.be.true();
  });

  it('ningún ordenable declara `nullable`: las tres columnas son NOT NULL', () => {
    for (const name of clientsSpec.sortableNames) {
      (clientsSpec.sortable[name].nullable === undefined).should.be.true();
    }
  });

  it('el orden por defecto es ASCENDENTE POR NOMBRE, no `-createdAt`', () => {
    [...clientsSpec.defaults.sort].should.deepEqual(['name']);
  });

  it('CA-3 · el recorte externo es INDIRECTO: un actor no tiene columna de proyecto', () => {
    const scope = clientsSpec.externalScope as ExistsExternalScope;

    scope.kind.should.equal('exists');
    scope.should.deepEqual({
      kind: 'exists',
      table: 'projects',
      foreignKey: 'client_id',
      localKey: 'id',
      projectColumn: 'id',
    });
  });

  it('el código de "no encontrado" es la CONSTANTE, no el literal', () => {
    clientsSpec.notFoundCode!.should.equal(ErrorCode.CLIENT_NOT_FOUND);
  });

  it('CA-3 · `projects` NO es un incluible de un actor', () => {
    clientsSpec.includableNames.should.not.containEql('projects');
    clientsSpec.fieldNames.should.not.containEql('projects');
  });
});
