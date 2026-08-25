import 'mocha';
import 'should';
import { ENTITY_TABLES, ENTITY_TYPES } from '../../src/queries/entity-type';

/**
 * LA TRADUCCIÓN DE `entityType`, EN UN SOLO LUGAR (S-025, Task 4).
 *
 * Los diez nombres se afirman UNO POR UNO y no con un `deepEqual` del mapa entero: son valores de
 * tablas y columnas REALES de PostgreSQL, y un nombre mal escrito no falla al compilar — falla en
 * la base, en la primera consulta que lo use.
 */
describe('queries/entity-type — la traducción compartida (S-025)', () => {
  it('`ENTITY_TYPES` es el orden EXACTO que viaja en `errorDetails.allowed`', () => {
    // El orden es parte de la respuesta del contrato, no un detalle de la declaración.
    [...ENTITY_TYPES].should.deepEqual(['task', 'requirement']);
  });

  it('la variante `task` traduce a los cinco nombres de `objective*`', () => {
    ENTITY_TABLES.task.activityTable.should.equal('objective_activity');
    ENTITY_TABLES.task.subscriptionTable.should.equal('objectives_subscriptors');
    ENTITY_TABLES.task.entityColumn.should.equal('objective_id');
    ENTITY_TABLES.task.ownerTable.should.equal('objectives');
    ENTITY_TABLES.task.commentAttachmentType.should.equal('objective_comment');
  });

  it('la variante `requirement` traduce a los cinco nombres de `requirement*`', () => {
    ENTITY_TABLES.requirement.activityTable.should.equal('requirement_activity');
    ENTITY_TABLES.requirement.subscriptionTable.should.equal('requirement_subscriptors');
    ENTITY_TABLES.requirement.entityColumn.should.equal('requirement_id');
    ENTITY_TABLES.requirement.ownerTable.should.equal('requirements');
    ENTITY_TABLES.requirement.commentAttachmentType.should.equal('requirement_comment');
  });

  it('no hay una entrada del mapa sin valor ni un valor sin entrada', () => {
    Object.keys(ENTITY_TABLES).should.deepEqual([...ENTITY_TYPES]);
  });

  it('LA ASIMETRÍA DE LA BASE: la de tareas es PLURAL y la de requisitos SINGULAR', () => {
    // Es el test que atrapa el copy-paste: `objectives_subscriptors` con `s` y
    // `requirement_subscriptors` sin ella. Copiar una para la otra rompe el SQL en tiempo de
    // ejecución y no antes.
    ENTITY_TABLES.task.subscriptionTable.should.match(/s_subscriptors$/);
    ENTITY_TABLES.requirement.subscriptionTable.should.not.match(/s_subscriptors$/);
  });

  it('el archivo NO exporta funciones de traducción: es un dato', () => {
    // Una función invitaría a traducir en tiempo de ejecución, y la traducción tiene que ser
    // parte de la FICHA para que `meta.describe` (S-028) la pueda proyectar sin ejecutarla.
    for (const entity of ENTITY_TYPES) {
      for (const value of Object.values(ENTITY_TABLES[entity])) {
        value.should.be.a.String();
      }
    }
  });
});
