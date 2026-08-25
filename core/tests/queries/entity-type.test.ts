import 'mocha';
import 'should';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ATTACHMENT_DB_TYPES,
  ATTACHMENT_ENTITY_CONTRACT,
  ATTACHMENT_ENTITY_DB,
  ATTACHMENT_ENTITY_OWNERS,
  ATTACHMENT_ENTITY_TYPES,
  ENTITY_TABLES,
  ENTITY_TYPES,
} from '../../src/queries/entity-type';

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

/**
 * EL MAPA DE `attachments.entity_type` — LOS CINCO VALORES, EN LAS DOS DIRECCIONES (S-027, Task 1).
 *
 * Es el mismo archivo y a propósito (CA-17): `comments` traduce dos valores y `attachments` cinco,
 * y CUATRO DE LOS CINCO SE SUPERPONEN. Dos copias divergen el día que se agregue un sexto tipo de
 * entidad, y el bug aparece en UNO SOLO de los dos caminos.
 */
describe('queries/entity-type — el mapa de `attachments` (S-027)', () => {
  it('TS-1 · los CINCO valores del contrato, en el orden de `errorDetails.allowed`', () => {
    [...ATTACHMENT_ENTITY_TYPES].should.deepEqual([
      'project',
      'requirement',
      'requirement_comment',
      'task',
      'task_comment',
    ]);
  });

  it('TS-2 · la DIRECCIÓN DE ENTRADA: contrato -> base, completa', () => {
    // Los dos que traducen son `task` y `task_comment`: son los que ADR-004 dejó con el
    // vocabulario viejo en la base.
    ({ ...ATTACHMENT_ENTITY_DB }).should.deepEqual({
      project: 'project',
      requirement: 'requirement',
      requirement_comment: 'requirement_comment',
      task: 'objective',
      task_comment: 'objective_comment',
    });
  });

  it('TS-3 · la DIRECCIÓN DE SALIDA es derivada y el round-trip es BIYECTIVO en los cinco', () => {
    // La última Implementation Rule de ADR-004: al agregar un valor al enum del bus, la traducción
    // a la base tiene que ser biyectiva. Se verifica recorriendo el mapa, no leyéndolo.
    for (const contract of ATTACHMENT_ENTITY_TYPES) {
      ATTACHMENT_ENTITY_CONTRACT[ATTACHMENT_ENTITY_DB[contract]].should.equal(contract);
    }
    Object.keys(ATTACHMENT_ENTITY_CONTRACT).length.should.equal(ATTACHMENT_ENTITY_TYPES.length);
  });

  it('TS-4 · EL GATE DE CA-17: los `*_comment` salen del mapa que ya usaba `comments`', () => {
    // Si alguien escribiera `'objective_comment'` una segunda vez, este test seguiría verde y
    // TS-102 —el grep sobre `src/`— es el que lo atrapa. Los dos juntos son la garantía.
    ENTITY_TABLES.task.commentAttachmentType.should.equal(ATTACHMENT_ENTITY_DB.task_comment);
    ENTITY_TABLES.requirement.commentAttachmentType.should.equal(
      ATTACHMENT_ENTITY_DB.requirement_comment
    );
  });

  it('TS-5 · …y los de ENTIDAD también, con la asimetría PLURAL/SINGULAR intacta', () => {
    ENTITY_TABLES.task.entityAttachmentType.should.equal(ATTACHMENT_ENTITY_DB.task);
    ENTITY_TABLES.requirement.entityAttachmentType.should.equal(ATTACHMENT_ENTITY_DB.requirement);
    // La tabla es `objectives` (plural) y el `entity_type` `objective` (singular): derivarlo
    // sacando la `s` sería un truco que se rompe con la primera tabla que no pluralice así.
    ENTITY_TABLES.task.ownerTable.should.equal('objectives');
    ENTITY_TABLES.task.entityAttachmentType.should.equal('objective');
  });

  it('TS-6 · el valor LEGADO `comment` no tiene traducción y no está en la lista blanca', () => {
    // La migración `20260729_01` separó `comment` en dos y dejó filas viejas sin migrar. Esas
    // filas NO APARECEN: es deny-by-default (ADR-008), no un bug.
    (ATTACHMENT_ENTITY_CONTRACT['comment'] === undefined).should.be.true();
    [...ATTACHMENT_DB_TYPES].should.not.containEql('comment');
    [...ATTACHMENT_DB_TYPES].should.deepEqual([
      'project',
      'requirement',
      'requirement_comment',
      'objective',
      'objective_comment',
    ]);
  });

  it('TS-7 · los descriptores de entidad dueña se DERIVAN de `ENTITY_TABLES`', () => {
    // Campo por campo contra el mapa, NO contra literales: es lo que hace que un sexto tipo de
    // entidad se agregue en un solo lugar.
    Object.keys(ATTACHMENT_ENTITY_OWNERS).should.deepEqual([...ATTACHMENT_DB_TYPES]);

    const taskComment = ATTACHMENT_ENTITY_OWNERS[ATTACHMENT_ENTITY_DB.task_comment];
    taskComment.table.should.equal(ENTITY_TABLES.task.activityTable);
    taskComment.owner!.table.should.equal(ENTITY_TABLES.task.ownerTable);
    taskComment.owner!.foreignKey.should.equal(ENTITY_TABLES.task.entityColumn);
    // LAS DOS VISIBILIDADES: la del comentario (default `internal`) y la de la tarea.
    taskComment.ownVisibility!.value.should.equal('public');
    taskComment.visibility!.value.should.equal('public');

    const requirementComment = ATTACHMENT_ENTITY_OWNERS[ATTACHMENT_ENTITY_DB.requirement_comment];
    requirementComment.table.should.equal(ENTITY_TABLES.requirement.activityTable);
    requirementComment.owner!.table.should.equal(ENTITY_TABLES.requirement.ownerTable);
    requirementComment.owner!.foreignKey.should.equal(ENTITY_TABLES.requirement.entityColumn);

    // Las dos de ENTIDAD no saltan: llevan el proyecto en su propia columna.
    const task = ATTACHMENT_ENTITY_OWNERS[ATTACHMENT_ENTITY_DB.task];
    task.table.should.equal(ENTITY_TABLES.task.ownerTable);
    (task.owner === undefined).should.be.true();
    task.projectColumn.should.equal('project_id');

    // `project` NO DECLARA VISIBILIDAD y recorta por su PROPIA `id`: un proyecto no tiene
    // `visibility_level`, y la ausencia es del esquema, no un olvido.
    const project = ATTACHMENT_ENTITY_OWNERS[ATTACHMENT_ENTITY_DB.project];
    project.table.should.equal('projects');
    project.projectColumn.should.equal('id');
    (project.visibility === undefined).should.be.true();
    (project.ownVisibility === undefined).should.be.true();
  });

  it('TS-8 · el módulo NO importa nada del motor: es un dato del plano, no una pieza de `engine/`', () => {
    const source = readFileSync(
      join(__dirname, '..', '..', 'src', 'queries', 'entity-type.ts'),
      'utf8'
    );

    source.should.not.containEql("from './engine");
    source.should.not.containEql("from '../engine");
    source.should.not.containEql("from '@jiku/models'");
  });
});
